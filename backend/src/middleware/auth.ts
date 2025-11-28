import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '../logger';
import userStorage from '../storage/userStorage';
import { User } from '../../../shared/types';

const PROXY_HEADER_EMAIL = 'x-auth-request-email';
const PROXY_HEADER_USER = 'x-auth-request-user';
const PROXY_HEADER_NAME = 'x-auth-request-preferred-username';
const PROXY_HEADER_FULLNAME = 'x-auth-request-fullname';
const PROXY_HEADER_AVATAR = 'x-auth-request-avatar-url';
const PROXY_HEADER_PROVIDER = 'x-auth-request-provider';

const getHeaderValue = (req: Request, header: string): string | undefined => {
  const value = req.headers[header] ?? req.headers[header.toLowerCase()];
  if (Array.isArray(value)) {
    return value[0];
  }
  return value as string | undefined;
};

const authenticateViaProxyHeaders = async (
  req: Request,
): Promise<User | null> => {
  const email = getHeaderValue(req, PROXY_HEADER_EMAIL);
  if (!email) {
    return null;
  }

  const providerHeader = (getHeaderValue(req, PROXY_HEADER_PROVIDER) || '')
    .toLowerCase()
    .trim();
  const provider: 'github' | 'google' =
    providerHeader === 'google' ? 'google' : 'github';

  const providerId =
    getHeaderValue(req, PROXY_HEADER_USER) ||
    getHeaderValue(req, PROXY_HEADER_NAME) ||
    email;
  const displayName =
    getHeaderValue(req, PROXY_HEADER_NAME) ||
    getHeaderValue(req, PROXY_HEADER_FULLNAME) ||
    providerId;
  const avatar = getHeaderValue(req, PROXY_HEADER_AVATAR);

  let user = await userStorage.getUserByProvider(provider, providerId);
  if (!user) {
    user = await userStorage.createUser({
      email,
      name: displayName,
      provider,
      providerId,
      avatar,
    });
  } else {
    user.lastLoginAt = new Date();
    await userStorage.updateUser(user);
  }

  req.user = user;
  req.userId = user.id;
  logger.debug(
    { email, provider, providerId },
    'Authenticated via oauth2-proxy headers',
  );
  return user;
};

// Extend Express Request to include user
declare module 'express-serve-static-core' {
  interface Request {
    user?: User;
    userId?: string;
  }
}

interface JwtPayload {
  userId: string;
  email: string;
  iat: number;
  exp: number;
}

/**
 * Middleware to authenticate requests using JWT
 */
export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers['authorization'];
    const token = authHeader?.split(' ')[1]; // Bearer TOKEN

    if (token) {
      const jwtSecret = process.env.JWT_SECRET || 'your_jwt_secret_here';
      try {
        // Verify token
        const decoded = jwt.verify(token, jwtSecret) as JwtPayload;

        // Get user from storage
        const user = await userStorage.getUser(decoded.userId);

        if (!user) {
          res.status(401).json({ error: 'User not found' });
          return;
        }

        // Attach user to request
        req.user = user;
        req.userId = user.id;

        next();
        return;
      } catch (error) {
        if (error instanceof jwt.JsonWebTokenError) {
          logger.warn({ error: error.message }, 'Invalid JWT token');
        } else if (error instanceof jwt.TokenExpiredError) {
          logger.warn('JWT token expired');
        } else {
          logger.error({ error }, 'Authentication error');
        }
        // Fall through to proxy header authentication before failing request
      }
    }

    const proxyUser = await authenticateViaProxyHeaders(req);
    if (proxyUser) {
      next();
      return;
    }

    res.status(401).json({ error: 'Authentication required' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Optional authentication middleware - doesn't fail if no token provided
 * Useful for endpoints that work with or without authentication
 */
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader?.split(' ')[1];

    if (!token) {
      const proxyUser = await authenticateViaProxyHeaders(req);
      if (!proxyUser) {
        next();
        return;
      }
      next();
      return;
    }

    const jwtSecret = process.env.JWT_SECRET || 'your_jwt_secret_here';
    const decoded = jwt.verify(token, jwtSecret) as JwtPayload;
    const user = await userStorage.getUser(decoded.userId);

    if (user) {
      req.user = user;
      req.userId = user.id;
    }

    next();
  } catch (error) {
    const proxyUser = await authenticateViaProxyHeaders(req);
    if (!proxyUser) {
      // Silently fail for optional auth
      next();
      return;
    }
    next();
  }
};

/**
 * Generate JWT token for user
 */
export const generateToken = (user: User): string => {
  const jwtSecret = process.env.JWT_SECRET || 'your_jwt_secret_here';
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';

  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
    },
    jwtSecret,
    { expiresIn } as jwt.SignOptions,
  );
};

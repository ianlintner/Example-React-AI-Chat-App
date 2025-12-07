import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '../logger';
import userStorage from '../storage/userStorage';
import { User } from '../../../shared/types';

// Extend Express Request to include user
declare module 'express-serve-static-core' {
  interface Request {
    user?: User;
    userId?: string;
  }
}

interface JwtPayload {
  sub: string; // Subject (User ID)
  email?: string;
  name?: string;
  picture?: string;
  preferred_username?: string;
  iss?: string;
  aud?: string | string[];
}

/**
 * Middleware to authenticate requests using headers injected by Istio/Envoy
 * The EnvoyFilter extracts claims from the validated JWT and puts them in headers.
 */
export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    // Check for headers injected by Istio EnvoyFilter
    const subject = req.headers['x-auth-subject'] as string;

    if (!subject) {
      // If headers are missing, check if we have a raw token to debug or fail
      // But generally, if we are here, it means Istio didn't inject headers
      // which implies no valid token was found/processed by the filter.
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const email =
      (req.headers['x-auth-email'] as string) || `${subject}@example.com`;
    const name =
      (req.headers['x-auth-name'] as string) ||
      (req.headers['x-auth-username'] as string) ||
      'User';
    const avatar = req.headers['x-auth-picture'] as string;
    const issuer = req.headers['x-auth-issuer'] as string;

    // Optional: Verify issuer if not already handled by RequestAuthentication
    if (issuer && issuer !== 'https://oauth2.cat-herding.net') {
      logger.warn({ issuer }, 'Unexpected token issuer header');
    }

    // Find or create user
    let user = await userStorage.getUserByProvider('oauth2', subject);

    if (!user) {
      user = await userStorage.createUser({
        email,
        name,
        provider: 'oauth2',
        providerId: subject,
        avatar,
      });
      logger.info({ userId: user.id }, 'Created new user from Istio headers');
    } else {
      // Update user info if changed
      let changed = false;
      if (avatar && user.avatar !== avatar) {
        user.avatar = avatar;
        changed = true;
      }
      if (name && user.name !== name) {
        user.name = name;
        changed = true;
      }

      user.lastLoginAt = new Date();
      changed = true;

      if (changed) {
        await userStorage.updateUser(user);
      }
    }

    // Attach user to request
    req.user = user;
    req.userId = user.id;

    next();
  } catch (error) {
    logger.error({ error }, 'Authentication error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Optional authentication middleware
 */
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    // Check if we have the subject header
    const subject = req.headers['x-auth-subject'] as string;
    if (!subject) {
      next();
      return;
    }
    await authenticateToken(req, res, next);
  } catch (error) {
    // Ignore errors for optional auth
    next();
  }
};

/**
 * Generate JWT token for user (Legacy/Local use)
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

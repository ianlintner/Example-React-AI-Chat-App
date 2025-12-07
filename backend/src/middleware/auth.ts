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
 * Middleware to authenticate requests using JWT
 * Trusts that Istio RequestAuthentication has already validated the signature.
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

    if (!token) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Decode token (Istio validates signature, so we can just decode)
    const decoded = jwt.decode(token) as JwtPayload | null;

    if (!decoded || !decoded.sub) {
      logger.warn('Invalid JWT token structure');
      res.status(401).json({ error: 'Invalid token' });
      return;
    }

    // Check issuer if needed (optional, Istio does this too)
    if (decoded.iss && decoded.iss !== 'https://oauth2.cat-herding.net') {
       logger.warn({ issuer: decoded.iss }, 'Unexpected token issuer');
       // We might want to allow it if we trust Istio config, but good to log
    }

    const providerId = decoded.sub;
    const email = decoded.email || `${providerId}@example.com`; // Fallback
    const name = decoded.name || decoded.preferred_username || 'User';
    const avatar = decoded.picture;

    // Find or create user
    let user = await userStorage.getUserByProvider('oauth2', providerId);
    
    // Also check by email if not found by providerId (migration path)
    if (!user && email) {
        // This might be risky if emails aren't verified, but for this internal app it's likely fine
        // user = await userStorage.getUserByEmail(email); 
        // Let's stick to providerId for now to be safe
    }

    if (!user) {
      user = await userStorage.createUser({
        email,
        name,
        provider: 'oauth2',
        providerId,
        avatar,
      });
      logger.info({ userId: user.id }, 'Created new user from JWT');
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
      changed = true; // Always update last login

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
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
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

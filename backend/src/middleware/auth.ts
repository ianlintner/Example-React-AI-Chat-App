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

    if (!token) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const jwtSecret = process.env.JWT_SECRET || 'your_jwt_secret_here';

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
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      logger.warn({ error: error.message }, 'Invalid JWT token');
      res.status(401).json({ error: 'Invalid token' });
      return;
    }

    if (error instanceof jwt.TokenExpiredError) {
      logger.warn('JWT token expired');
      res.status(401).json({ error: 'Token expired' });
      return;
    }

    logger.error({ error }, 'Authentication error');
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
    // Silently fail for optional auth
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

import { Router, Request, Response } from 'express';
import passport from '../services/authService';
import { generateToken } from '../middleware/auth';
import { authRateLimiter } from '../middleware/rateLimit';
import { logger } from '../logger';
import { User } from '../../../shared/types';

const router = Router();

/**
 * @swagger
 * /api/auth/github:
 *   get:
 *     summary: Initiate GitHub OAuth flow
 *     tags: [Authentication]
 *     responses:
 *       302:
 *         description: Redirects to GitHub OAuth
 */
router.get(
  '/github',
  authRateLimiter,
  passport.authenticate('github', { session: false }),
);

/**
 * @swagger
 * /api/auth/github/callback:
 *   get:
 *     summary: GitHub OAuth callback
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: Authentication successful, returns JWT token
 *       401:
 *         description: Authentication failed
 */
router.get(
  '/github/callback',
  passport.authenticate('github', {
    session: false,
    failureRedirect: '/auth/failure',
  }),
  (req: Request, res: Response): void => {
    try {
      const user = req.user as User;
      if (!user) {
        res.status(401).json({ error: 'Authentication failed' });
        return;
      }

      const token = generateToken(user);

      // For web: redirect with token in query param (will be handled by frontend)
      // For mobile: return JSON with token
      const mobileApp = req.query.mobile === 'true';

      if (mobileApp) {
        res.json({
          success: true,
          token,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            avatar: user.avatar,
            provider: user.provider,
          },
        });
        return;
      }

      // Redirect to frontend with token
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:19006';
      const redirectUrl = `${frontendUrl}/auth/callback?token=${token}`;
      res.redirect(redirectUrl);
    } catch (error) {
      logger.error({ error }, 'GitHub callback error');
      res.status(500).json({ error: 'Authentication error' });
    }
  },
);

/**
 * @swagger
 * /api/auth/google:
 *   get:
 *     summary: Initiate Google OAuth flow
 *     tags: [Authentication]
 *     responses:
 *       302:
 *         description: Redirects to Google OAuth
 */
router.get(
  '/google',
  authRateLimiter,
  passport.authenticate('google', { session: false }),
);

/**
 * @swagger
 * /api/auth/google/callback:
 *   get:
 *     summary: Google OAuth callback
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: Authentication successful, returns JWT token
 *       401:
 *         description: Authentication failed
 */
router.get(
  '/google/callback',
  passport.authenticate('google', {
    session: false,
    failureRedirect: '/auth/failure',
  }),
  (req: Request, res: Response): void => {
    try {
      const user = req.user as User;
      if (!user) {
        res.status(401).json({ error: 'Authentication failed' });
        return;
      }

      const token = generateToken(user);

      // For web: redirect with token in query param
      // For mobile: return JSON with token
      const mobileApp = req.query.mobile === 'true';

      if (mobileApp) {
        res.json({
          success: true,
          token,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            avatar: user.avatar,
            provider: user.provider,
          },
        });
        return;
      }

      // Redirect to frontend with token
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:19006';
      const redirectUrl = `${frontendUrl}/auth/callback?token=${token}`;
      res.redirect(redirectUrl);
    } catch (error) {
      logger.error({ error }, 'Google callback error');
      res.status(500).json({ error: 'Authentication error' });
    }
  },
);

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current user profile
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile
 *       401:
 *         description: Not authenticated
 */
router.get('/me', (req: Request, res: Response): void => {
  // This will be protected by authenticateToken middleware in main app
  const user = req.user;

  if (!user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  res.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      provider: user.provider,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    },
  });
});

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Logout user
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: Logout successful
 */
router.post('/logout', (req: Request, res: Response) => {
  // Client-side will delete the JWT token
  // In a more sophisticated system, we could maintain a token blacklist
  logger.info({ userId: req.userId }, 'User logged out');
  res.json({ success: true, message: 'Logged out successfully' });
});

/**
 * Authentication failure handler
 */
router.get('/failure', (req: Request, res: Response) => {
  logger.warn('Authentication failure');
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:19006';
  res.redirect(`${frontendUrl}/auth/login?error=auth_failed`);
});

export default router;

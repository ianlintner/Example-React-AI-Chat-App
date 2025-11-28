import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { logger } from '../logger';

const router = Router();

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current user profile
 *     description: Returns user information from oauth2-proxy headers when authenticated at cluster level
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: User profile (from oauth2-proxy headers)
 *       401:
 *         description: Not authenticated
 */
router.get('/me', authenticateToken, (req: Request, res: Response): void => {
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
 *     description: Client-side logout (oauth2-proxy handles actual session termination)
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: Logout successful
 */
router.post('/logout', (req: Request, res: Response) => {
  // Client-side will delete any cached tokens
  // Actual session termination is handled by oauth2-proxy at cluster level
  logger.info({ userId: req.userId }, 'User logout requested');
  res.json({ success: true, message: 'Logged out successfully' });
});

export default router;

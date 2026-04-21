import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { resolveIdentity } from '../middleware/identity';
import { logger } from '../logger';

const router = Router();

/**
 * @swagger
 * /api/auth/session:
 *   get:
 *     summary: Get current session (anonymous or authenticated)
 *     description: >
 *       Returns the caller's tier and, when authenticated, a minimal user
 *       profile. Always succeeds (200) — anonymous callers get a
 *       synthesized "Guest" user and tier='anonymous'. The frontend uses
 *       this to decide whether to show the login banner and which model
 *       tier badge to render.
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: Session snapshot
 */
router.get(
  '/session',
  resolveIdentity,
  (req: Request, res: Response): void => {
    const user = req.user;
    const tier = req.tier ?? 'anonymous';
    const authenticated = tier === 'authenticated';

    res.json({
      tier,
      authenticated,
      user: user
        ? {
            id: user.id,
            name: user.name,
            email: user.email,
            avatar: user.avatar,
            provider: user.provider,
          }
        : null,
      loginUrl: authenticated ? null : process.env.LOGIN_URL || '/oauth2/start',
    });
  },
);

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

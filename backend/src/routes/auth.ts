import { Router, Request, Response } from 'express';
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
router.get('/session', resolveIdentity, (req: Request, res: Response): void => {
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
});

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current user profile (degrades to anon)
 *     description: >
 *       Returns the caller's tier snapshot. Authenticated callers get a
 *       user object populated from Istio headers; anonymous callers get
 *       `user: null` plus tier/loginUrl so the frontend can render a
 *       sign-in CTA without crashing on 401.
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: Session snapshot (user null when anonymous)
 */
router.get('/me', resolveIdentity, (req: Request, res: Response): void => {
  const tier = req.tier ?? 'anonymous';
  const authenticated = tier === 'authenticated';
  const user = authenticated ? req.user : null;

  res.json({
    user: user
      ? {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar: user.avatar,
          provider: user.provider,
          createdAt: user.createdAt,
          lastLoginAt: user.lastLoginAt,
        }
      : null,
    tier,
    authenticated,
    loginUrl: authenticated ? null : process.env.LOGIN_URL || '/oauth2/start',
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

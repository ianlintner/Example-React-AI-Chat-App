import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4, validate as uuidValidate } from 'uuid';
import { logger } from '../logger';
import userStorage from '../storage/userStorage';
import { User } from '../../../shared/types';

export type Tier = 'anonymous' | 'authenticated';

declare module 'express-serve-static-core' {
  interface Request {
    tier?: Tier;
    isAnonymous?: boolean;
  }
}

const ANON_COOKIE_NAME = '_chat_anon';
// 8h rolling session; refreshed on every request that hits resolveIdentity.
const ANON_COOKIE_MAX_AGE_MS = 8 * 60 * 60 * 1000;

function anonCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: ANON_COOKIE_MAX_AGE_MS,
  };
}

function buildAnonUser(anonId: string): User {
  return {
    id: `anon_${anonId}`,
    email: `${anonId}@anon.local`,
    name: 'Guest',
    provider: 'anonymous',
    providerId: anonId,
    createdAt: new Date(),
  };
}

async function resolveAuthenticated(
  req: Request,
  subject: string,
): Promise<User> {
  const email =
    (req.headers['x-auth-email'] as string) || `${subject}@example.com`;
  const name =
    (req.headers['x-auth-name'] as string) ||
    (req.headers['x-auth-username'] as string) ||
    'User';
  const avatar = req.headers['x-auth-picture'] as string | undefined;

  let user = await userStorage.getUserByProvider('oauth2', subject);
  if (!user) {
    user = await userStorage.createUser({
      email,
      name,
      provider: 'oauth2',
      providerId: subject,
      avatar,
    });
    logger.info({ userId: user.id }, 'Created user from Istio headers');
    return user;
  }

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
  if (changed) {
    await userStorage.updateUser(user);
  }
  return user;
}

/**
 * resolveIdentity — unified identity middleware for anonymous + authenticated.
 *
 * - If Istio has injected `x-auth-subject`, the caller is authenticated:
 *   hydrate/persist the user and set tier='authenticated'.
 * - Otherwise, read the `_chat_anon` cookie (UUID v4). If absent or invalid,
 *   mint a new anonymous id and set the cookie. The anon user is NOT
 *   persisted in userStorage — it is synthesized per-request to avoid
 *   unbounded growth from bots/scanners.
 *
 * Downstream handlers read `req.tier` and `req.isAnonymous` to drive
 * rate-limit tier, LLM selection, and feature gating. `req.userId` /
 * `req.user` are always populated so existing code that keys on userId
 * keeps working — anon ids are namespaced as `anon_<uuid>`.
 */
export const resolveIdentity = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const subject = req.headers['x-auth-subject'] as string | undefined;

    if (subject) {
      const user = await resolveAuthenticated(req, subject);
      req.user = user;
      req.userId = user.id;
      req.tier = 'authenticated';
      req.isAnonymous = false;
      return next();
    }

    // Anonymous path.
    const existing = (req as Request & { cookies?: Record<string, string> })
      .cookies?.[ANON_COOKIE_NAME];
    let anonId: string;
    if (typeof existing === 'string' && uuidValidate(existing)) {
      anonId = existing;
    } else {
      anonId = uuidv4();
    }
    // Always refresh the cookie — rolling 8h expiry.
    res.cookie(ANON_COOKIE_NAME, anonId, anonCookieOptions());

    req.user = buildAnonUser(anonId);
    req.userId = req.user.id;
    req.tier = 'anonymous';
    req.isAnonymous = true;
    return next();
  } catch (error) {
    logger.error({ error }, 'Identity resolution error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Gate a route to authenticated users only. Use after resolveIdentity.
 */
export const requireAuthenticated = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  if (req.tier !== 'authenticated') {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  next();
};

export const ANON_COOKIE = {
  name: ANON_COOKIE_NAME,
  maxAgeMs: ANON_COOKIE_MAX_AGE_MS,
} as const;

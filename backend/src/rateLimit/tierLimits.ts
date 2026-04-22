/**
 * Per-tier chat quotas.
 *
 * Kept in its own module so it can be imported by anything that needs
 * the numbers (e.g. the socket-side rate-limit helper) without pulling
 * in the express-rate-limit middleware, whose module-load constructs
 * RedisStore and can fail in test environments where Redis is reachable
 * for the middleware but mocked out for the importing test.
 */
export const TIER_LIMITS = {
  anonymous: {
    apiPerMinute: 60,
    chatPerMinute: 5,
    chatPerDay: 50,
  },
  authenticated: {
    apiPerMinute: 300,
    chatPerMinute: 30,
    chatPerDay: 1000,
  },
} as const;

export type TierLimitKey = keyof typeof TIER_LIMITS;

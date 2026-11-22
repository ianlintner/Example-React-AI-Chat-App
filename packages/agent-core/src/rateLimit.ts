/** Tiered chat rate limits ported from backend/src/rateLimit/tierLimits.ts. */
import type { Principal } from './seams';

type AccessTier = Principal['tier'];

export const TIER_LIMITS = {
  anonymous: { requests: 10, windowMs: 60_000, burst: 3 },
  free: { requests: 60, windowMs: 60_000, burst: 10 },
  pro: { requests: 300, windowMs: 60_000, burst: 40 },
} as const satisfies Record<
  AccessTier,
  { requests: number; windowMs: number; burst: number }
>;

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterMs: number;
}

export interface RateLimiter {
  consume(principal: Principal): Promise<RateLimitResult>;
}

/** Fixed-window limiter with a small burst bucket; deterministic in tests. */
export class TierRateLimiter implements RateLimiter {
  private readonly windows = new Map<
    string,
    { start: number; count: number }
  >();
  private readonly bursts = new Map<
    string,
    { tokens: number; updatedAt: number }
  >();

  constructor(private readonly now: () => number = Date.now) {}

  async consume(principal: Principal): Promise<RateLimitResult> {
    const tier = principal.tier;
    const { requests, windowMs, burst } = TIER_LIMITS[tier];
    const key = `${principal.kind}:${principal.userId}`;
    const time = this.now();

    const window = this.windows.get(key);
    if (!window || time - window.start >= windowMs) {
      this.windows.set(key, { start: time, count: 0 });
    }
    const currentWindow = this.windows.get(key)!;
    const bucket = this.bursts.get(key) ?? { tokens: burst, updatedAt: time };
    // Refill one burst token every windowMs / requests.
    const refillMs = windowMs / requests;
    bucket.tokens = Math.min(
      burst,
      bucket.tokens + Math.floor((time - bucket.updatedAt) / refillMs),
    );
    bucket.updatedAt = time;

    const allowed = currentWindow.count < requests && bucket.tokens > 0;
    if (allowed) {
      currentWindow.count++;
      bucket.tokens--;
    }
    this.bursts.set(key, bucket);

    return {
      allowed,
      limit: requests,
      remaining: Math.max(0, requests - currentWindow.count),
      retryAfterMs: allowed
        ? 0
        : Math.max(1, currentWindow.start + windowMs - time),
    };
  }
}

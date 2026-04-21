jest.mock('../../logger');
jest.mock('../../rateLimit/redisClient', () => ({
  getRateLimitRedis: jest.fn().mockResolvedValue(null),
}));

import {
  apiRateLimiter,
  chatRateLimiter,
  chatDailyLimiter,
  globalIpCeilingLimiter,
  authRateLimiter,
  socketConnectionLimiter,
  TIER_LIMITS,
} from '../rateLimit';

describe('rateLimit middleware', () => {
  describe('TIER_LIMITS', () => {
    it('gives authenticated users a higher per-minute chat quota than anonymous', () => {
      expect(TIER_LIMITS.authenticated.chatPerMinute).toBeGreaterThan(
        TIER_LIMITS.anonymous.chatPerMinute,
      );
    });

    it('gives authenticated users a higher per-day chat quota than anonymous', () => {
      expect(TIER_LIMITS.authenticated.chatPerDay).toBeGreaterThan(
        TIER_LIMITS.anonymous.chatPerDay,
      );
    });

    it('gives authenticated users a higher per-minute API quota than anonymous', () => {
      expect(TIER_LIMITS.authenticated.apiPerMinute).toBeGreaterThan(
        TIER_LIMITS.anonymous.apiPerMinute,
      );
    });

    it('keeps anonymous chat quota strict enough to bound LLM cost', () => {
      // Floor so the limit is meaningful but keeps the demo usable.
      expect(TIER_LIMITS.anonymous.chatPerMinute).toBeLessThanOrEqual(10);
      expect(TIER_LIMITS.anonymous.chatPerDay).toBeLessThanOrEqual(100);
    });
  });

  describe('exports', () => {
    const limiters = {
      apiRateLimiter,
      chatRateLimiter,
      chatDailyLimiter,
      globalIpCeilingLimiter,
      authRateLimiter,
      socketConnectionLimiter,
    };

    it.each(Object.entries(limiters))(
      '%s is a 3-arg express middleware',
      (_name, limiter) => {
        expect(typeof limiter).toBe('function');
        expect(limiter.length).toBeGreaterThanOrEqual(3);
      },
    );
  });
});

jest.mock('../../logger');
jest.mock('../redisClient', () => ({
  getRateLimitRedis: jest.fn().mockResolvedValue(null),
}));

import {
  checkChatRateLimit,
  __resetChatLimitMemStore,
} from '../checkChatLimit';
import { TIER_LIMITS } from '../../middleware/rateLimit';
import { getRateLimitRedis } from '../redisClient';

describe('checkChatRateLimit', () => {
  beforeEach(() => {
    __resetChatLimitMemStore();
    (getRateLimitRedis as jest.Mock).mockResolvedValue(null);
  });

  describe('in-memory fallback', () => {
    it('allows traffic under the per-minute limit', async () => {
      const identity = 'anon_abc';
      for (let i = 0; i < TIER_LIMITS.anonymous.chatPerMinute; i++) {
        const result = await checkChatRateLimit(identity, 'anonymous');
        expect(result.allowed).toBe(true);
      }
    });

    it('blocks the call that exceeds the per-minute limit', async () => {
      const identity = 'anon_burst';
      // Consume the whole bucket
      for (let i = 0; i < TIER_LIMITS.anonymous.chatPerMinute; i++) {
        // eslint-disable-next-line no-await-in-loop
        await checkChatRateLimit(identity, 'anonymous');
      }
      const result = await checkChatRateLimit(identity, 'anonymous');
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.bucket).toBe('minute');
        expect(result.limit).toBe(TIER_LIMITS.anonymous.chatPerMinute);
        expect(result.retryAfterSec).toBeGreaterThan(0);
        expect(result.retryAfterSec).toBeLessThanOrEqual(60);
      }
    });

    it('applies the authenticated tier limits when tier=authenticated', async () => {
      const identity = 'user_1';
      // Anonymous limit is much lower than authenticated — if tiering
      // is wrong, we'd be blocked after chatPerMinute (anon) calls.
      for (let i = 0; i < TIER_LIMITS.anonymous.chatPerMinute + 1; i++) {
        // eslint-disable-next-line no-await-in-loop
        const result = await checkChatRateLimit(identity, 'authenticated');
        expect(result.allowed).toBe(true);
      }
    });

    it('scopes buckets per-identity', async () => {
      const burstIdentity = 'anon_a';
      for (let i = 0; i < TIER_LIMITS.anonymous.chatPerMinute; i++) {
        // eslint-disable-next-line no-await-in-loop
        await checkChatRateLimit(burstIdentity, 'anonymous');
      }
      const blocked = await checkChatRateLimit(burstIdentity, 'anonymous');
      expect(blocked.allowed).toBe(false);

      const fresh = await checkChatRateLimit('anon_b', 'anonymous');
      expect(fresh.allowed).toBe(true);
    });

    it('fails open when the store throws', async () => {
      (getRateLimitRedis as jest.Mock).mockRejectedValueOnce(
        new Error('redis exploded'),
      );
      const result = await checkChatRateLimit('anon_fail', 'anonymous');
      expect(result.allowed).toBe(true);
    });
  });

  describe('redis path', () => {
    it('sets TTL on first INCR for each bucket key', async () => {
      const counts = new Map<string, number>();
      const sendCommand = jest.fn();
      sendCommand.mockImplementation((args: string[]) => {
        const [cmd, key] = args;
        if (cmd === 'INCR') {
          const next = (counts.get(key) ?? 0) + 1;
          counts.set(key, next);
          return Promise.resolve(next);
        }
        if (cmd === 'EXPIRE') {
          return Promise.resolve(1);
        }
        if (cmd === 'TTL') {
          return Promise.resolve(42);
        }
        return Promise.resolve(0);
      });
      (getRateLimitRedis as jest.Mock).mockResolvedValue({ sendCommand });

      const result = await checkChatRateLimit('anon_r', 'anonymous');
      expect(result.allowed).toBe(true);
      // First call should set the expiry on both the minute and day keys.
      const expireCalls = sendCommand.mock.calls.filter(
        ([args]) => args[0] === 'EXPIRE',
      );
      expect(expireCalls).toHaveLength(2);
    });

    it('reports the minute bucket when INCR exceeds chatPerMinute', async () => {
      const sendCommand = jest.fn();
      const limit = TIER_LIMITS.anonymous.chatPerMinute;
      sendCommand.mockImplementation((args: string[]) => {
        const [cmd, key] = args;
        if (cmd === 'INCR') {
          return Promise.resolve(
            key?.startsWith('rl:socket-chat-min:') ? limit + 1 : 1,
          );
        }
        if (cmd === 'EXPIRE') {
          return Promise.resolve(1);
        }
        if (cmd === 'TTL') {
          return Promise.resolve(17);
        }
        return Promise.resolve(0);
      });
      (getRateLimitRedis as jest.Mock).mockResolvedValue({ sendCommand });

      const result = await checkChatRateLimit('anon_r2', 'anonymous');
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.bucket).toBe('minute');
        expect(result.limit).toBe(limit);
        expect(result.retryAfterSec).toBe(17);
      }
    });
  });
});

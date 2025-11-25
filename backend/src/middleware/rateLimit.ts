import rateLimit from 'express-rate-limit';
// Temporarily disabled Redis-backed rate limiting due to deployment issues
// import RedisStore from 'rate-limit-redis';
// import { createClient } from 'redis';
import { Request } from 'express';
import { logger } from '../logger';

// Create Redis client for rate limiting
// Temporarily disabled - using in-memory store for deployment
/*
const buildRedisUrl = (): string => {
  if (process.env.REDIS_URL) return process.env.REDIS_URL;
  const host = process.env.REDIS_HOST || 'localhost';
  const port = process.env.REDIS_PORT || '6379';
  const password = process.env.REDIS_PASSWORD || '';
  const authSegment = password ? `:${encodeURIComponent(password)}@` : '';
  return `redis://${authSegment}${host}:${port}`;
};

const redisClient = createClient({ url: buildRedisUrl() });

redisClient.on('error', err => {
  logger.error({ err }, 'Redis client error in rate limiter');
});

redisClient.connect().catch(err => {
  logger.error({ err}, 'Failed to connect rate limit Redis client');
});
*/

/**
 * Rate limiter for authenticated API requests
 * Allows 500 requests per hour per user
 */
export const apiRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 500, // 500 requests per hour per user
  standardHeaders: true,
  legacyHeaders: false,
  // Temporarily using in-memory store instead of Redis
  // store: new RedisStore({
  //   sendCommand: (...args: Array<string>) => redisClient.sendCommand(args),
  //   prefix: 'rl:api:',
  // }),
  // Using default IPv6-safe key generator (req.ip). Removed custom user/IP merge
  // to eliminate IPv6 validation warnings. Can be reintroduced with helper once
  // library types are confirmed.
  handler: (req, res) => {
    const identifier = req.userId ? `user ${req.userId}` : `IP ${req.ip}`;
    logger.warn({ identifier }, 'API rate limit exceeded');
    res.status(429).json({
      error: 'Too many requests',
      message: 'You have exceeded the rate limit. Please try again later.',
      retryAfter: res.getHeader('Retry-After'),
    });
  },
  skip: req => {
    // Skip rate limiting for health check endpoints
    return (
      req.path === '/health' ||
      req.path === '/healthz' ||
      req.path === '/api/health'
    );
  },
});

/**
 * Rate limiter specifically for chat messages
 * Allows 50 messages per hour per user (demo-friendly limit)
 */
export const chatRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // 50 chat messages per hour
  standardHeaders: true,
  legacyHeaders: false,
  // Temporarily using in-memory store instead of Redis
  // store: new RedisStore({
  //   sendCommand: (...args: Array<string>) => redisClient.sendCommand(args),
  //   prefix: 'rl:chat:',
  // }),
  // Default key generator (req.ip) used for IPv6 safety.
  handler: (req, res) => {
    const identifier = req.userId ? `user ${req.userId}` : `IP ${req.ip}`;
    logger.warn({ identifier }, 'Chat rate limit exceeded');
    res.status(429).json({
      error: 'Chat rate limit exceeded',
      message:
        'You have sent too many messages. Please wait before sending more.',
      retryAfter: res.getHeader('Retry-After'),
      limit: 50,
      window: '1 hour',
    });
  },
});

/**
 * Stricter rate limiter for unauthenticated requests
 * Protects authentication endpoints from brute force
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per 15 minutes per IP
  standardHeaders: true,
  legacyHeaders: false,
  // Temporarily using in-memory store instead of Redis
  // store: new RedisStore({
  //   sendCommand: (...args: Array<string>) => redisClient.sendCommand(args),
  //   prefix: 'rl:auth:',
  // }),
  // Default key generator (req.ip) used for IPv6 safety.
  handler: (req, res) => {
    logger.warn({ ip: req.ip }, 'Auth rate limit exceeded');
    res.status(429).json({
      error: 'Too many authentication attempts',
      message: 'Please try again later.',
      retryAfter: res.getHeader('Retry-After'),
    });
  },
});

/**
 * WebSocket connection rate limiter
 * Limits socket connections per IP/user
 */
export const socketConnectionLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20, // 20 connection attempts per 5 minutes
  standardHeaders: false,
  legacyHeaders: false,
  // Temporarily using in-memory store instead of Redis
  // store: new RedisStore({
  //   sendCommand: (...args: Array<string>) => redisClient.sendCommand(args),
  //   prefix: 'rl:socket:',
  // }),
  // Default key generator (req.ip) used for IPv6 safety.
  handler: (req, res) => {
    logger.warn(
      { ip: req.ip, userId: req.userId },
      'Socket connection rate limit exceeded',
    );
    res.status(429).json({
      error: 'Too many connection attempts',
      message: 'Please wait before trying to connect again.',
    });
  },
  skip: req => {
    // Skip rate limiting for authenticated users with valid tokens
    return !!req.userId;
  },
});

// Temporarily disabled Redis client export
// export { redisClient as rateLimitRedisClient };

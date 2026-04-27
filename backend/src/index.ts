import express from 'express';
import cookieParser from 'cookie-parser';
import cors, { CorsOptionsDelegate } from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { initializeTracing } from './tracing/tracer';
import { createServer } from 'http';
import { Server } from 'socket.io';
import chatRoutes from './routes/chat';
import conversationRoutes from './routes/conversations';
import reactionRoutes from './routes/reactions';
import validationRoutes from './routes/validation';
import agentTestBenchRoutes from './routes/agentTestBench';
import { createSwaggerSpec, registerSwaggerRoutes } from './routes/swaggerDocs';
import messageQueueRoutes from './routes/messageQueue';
import authRoutes from './routes/auth';
import embedAuthRoutes from './routes/embedAuth';
import { setupSocketHandlers } from './socket/socketHandlers';
import {
  httpMetricsMiddleware,
  register,
  registerAppInfo,
} from './metrics/prometheus';
import { createQueueService } from './messageQueue/queueService';
import { getLogger, patchConsole } from './logger';
import { resolveIdentity } from './middleware/identity';
import {
  apiRateLimiter,
  chatRateLimiter,
  chatDailyLimiter,
  globalIpCeilingLimiter,
} from './middleware/rateLimit';

dotenv.config();
patchConsole();
const log = getLogger(false);

// Enable verbose debugging
const DEBUG =
  process.env.DEBUG === 'true' || process.env.NODE_ENV !== 'production';
const debugLog = (...args: any[]) =>
  DEBUG && console.log('[DEBUG]', new Date().toISOString(), ...args);

debugLog('🚀 Starting server initialization...');
debugLog('Environment:', {
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
});

// Global error handlers for uncaught exceptions
process.on('uncaughtException', err => {
  console.error('❌ UNCAUGHT EXCEPTION:', err);
  console.error(err.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ UNHANDLED REJECTION:', reason);
  console.error('Promise:', promise);
});

debugLog('Global error handlers registered');

// Initialize OpenTelemetry tracing
try {
  debugLog('Initializing OpenTelemetry tracing...');
  initializeTracing();
  debugLog('OpenTelemetry tracing initialized successfully');
} catch (err) {
  console.error('❌ Failed to initialize tracing:', err);
}

// Generate test traces only in non-production when explicitly enabled
if (
  (process.env.NODE_ENV || '').toLowerCase() !== 'production' &&
  (process.env.ENABLE_TRACE_TESTS || '').toLowerCase() === 'true'
) {
  log.info('🔍 Generating initial test traces for debugging...');
  setTimeout(() => {
    const { generateTestTraces } = require('./tracing/testTraces');
    generateTestTraces();
  }, 2000);
}

debugLog('Creating Express app and HTTP server...');
const app = express();
const server = createServer(app);
debugLog('Express app and HTTP server created');

// ---------------------------------------------------------------------------
// CORS origin helper
//
// express-cors does not support glob strings in an origin array, so we use
// a function that:
//   1. Always allows any *.cat-herding.net subdomain (covers chat, portfolio,
//      www, roauth2, dsa, auth-demo, and any future subdomain).
//   2. Always allows the apex domain cat-herding.net.
//   3. Allows localhost ports in development for local dev convenience.
//   4. Falls back to the FRONTEND_URL env var when set (useful in staging).
// ---------------------------------------------------------------------------
const CAT_HERDING_ORIGIN_RE = /^https:\/\/([\w-]+\.)?cat-herding\.net(:\d+)?$/;

const DEV_LOCALHOST_ORIGINS = new Set([
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:5176',
  'http://localhost:5177',
  'http://localhost:5178',
  'http://localhost:8080',
  'http://localhost:8081',
  'http://localhost:5001',
]);

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) {
    return true; // server-to-server / curl — no Origin header
  }
  if (CAT_HERDING_ORIGIN_RE.test(origin)) {
    return true;
  }
  if (
    process.env.NODE_ENV !== 'production' &&
    DEV_LOCALHOST_ORIGINS.has(origin)
  ) {
    return true;
  }
  if (process.env.FRONTEND_URL && origin === process.env.FRONTEND_URL) {
    return true;
  }
  return false;
}

const corsOriginFn: CorsOptionsDelegate = (req, callback) => {
  const origin = req.headers.origin;
  if (isAllowedOrigin(origin)) {
    callback(null, { origin: true, credentials: true });
  } else {
    callback(null, { origin: false });
  }
};

debugLog('Creating Socket.IO server...');
const io = new Server(server, {
  path: '/api/socket.io',
  cors: {
    // Socket.IO accepts a plain function for origin too.
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin '${origin}' not allowed`));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  },
});
debugLog('Socket.IO server created with path /api/socket.io');

const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors(corsOriginFn));
app.use(express.json());
app.use(cookieParser());

// Prometheus metrics middleware + build info
app.use(httpMetricsMiddleware);
registerAppInfo();
// Anonymous-session rolling-window tracker — sets anon_sessions_active gauge.
// eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy load avoids early side effects in tests
const { startAnonSessionTracker } = require('./metrics/anonSessionTracker');
startAnonSessionTracker();

// Per-pod DoS ceiling (IP-keyed, blunt instrument sitting above the
// tiered per-identity limits). Skips /health and /metrics internally.
app.use(globalIpCeilingLimiter);

// Routes - Authentication (public). Uses its own IP-based auth limiter
// inside the router; no identity resolution required.
app.use('/api/auth', authRoutes);

// Embed widget OAuth2 token-exchange proxy (public by design — user is
// mid sign-in so no authenticateToken is applied; endpoint is rate-limited
// inside the router).
app.use('/api/auth/embed', embedAuthRoutes);

// Data routes — `resolveIdentity` accepts both authenticated (Istio
// headers) and anonymous (`_chat_anon` cookie) callers. `apiRateLimiter`
// runs after so it can tier-key on `req.tier`. Chat routes add
// per-minute and per-day caps on top.
const dataMiddleware = [resolveIdentity, apiRateLimiter];
app.use(
  '/api/chat',
  ...dataMiddleware,
  chatRateLimiter,
  chatDailyLimiter,
  chatRoutes,
);
app.use('/api/conversations', ...dataMiddleware, conversationRoutes);
app.use('/api/reactions', ...dataMiddleware, reactionRoutes);
app.use('/api/validation', ...dataMiddleware, validationRoutes);
app.use('/api/test-bench', ...dataMiddleware, agentTestBenchRoutes);
app.use('/api/queue', ...dataMiddleware, messageQueueRoutes);
/**
 * Swagger UI and JSON
 * UI:   /docs
 * JSON: /docs/json
 */
const openApiSpec = createSwaggerSpec();
registerSwaggerRoutes(app, openApiSpec);

// Health check endpoints
/**
 * @openapi
 * /health:
 *   get:
 *     tags: [health]
 *     summary: Liveness probe
 *     responses:
 *       '200':
 *         description: Service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: OK
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
app.get('/health', (req, res) => {
  // Keep health endpoint robust: never throw, tracer optional
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { tracer } = require('./tracing/tracer');
    const span = tracer.startSpan('health_check');
    span.setAttributes({ 'http.method': 'GET', 'http.route': '/health' });
    span.end();
  } catch (_e) {
    // ignore tracing failures
  }
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

/**
 * @openapi
 * /api/health:
 *   get:
 *     tags: [health]
 *     summary: API health check
 *     responses:
 *       '200':
 *         description: API is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
app.get('/api/health', (req, res) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { tracer } = require('./tracing/tracer');
    const span = tracer.startSpan('api_health_check');
    span.setAttributes({ 'http.method': 'GET', 'http.route': '/api/health' });
    span.end();
  } catch (_e) {
    // ignore tracing failures
  }
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Minimal startup health endpoint (no tracing)
app.get('/healthz', (_req, res) => {
  res.status(200).send('ok');
});

// Prometheus metrics endpoint
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (ex) {
    res.status(500).end(ex);
  }
});

// Serve static frontend files with resilient path resolution
// Primary expected location after build: dist/backend/public (relative to compiled __dirname)
const distPublicPath = path.join(__dirname, '..', 'public');
// Fallback location when assets copied to root (e.g., /app/public in container)
const rootPublicPath = path.join(process.cwd(), 'public');
// Final resolution: prefer dist path, else root path, else dist path (will trigger 500 on access)
const publicPathResolved = fs.existsSync(distPublicPath)
  ? distPublicPath
  : fs.existsSync(rootPublicPath)
    ? rootPublicPath
    : distPublicPath;

log.info({ publicPathResolved }, '🔧 Static asset directory resolved');
debugLog('Static asset directory:', publicPathResolved);
app.use(express.static(publicPathResolved));
debugLog('Static file middleware registered');

// SPA fallback - serve index.html for all non-API routes
app.use((req, res, next) => {
  // Skip API routes, health checks (/health, /healthz), metrics, docs, and socket.io
  if (
    req.path.startsWith('/api/') ||
    ['/health', '/healthz'].includes(req.path) ||
    req.path.startsWith('/metrics') ||
    req.path.startsWith('/docs')
  ) {
    return next();
  }
  const indexPath = path.join(publicPathResolved, 'index.html');
  if (!fs.existsSync(indexPath)) {
    log.error({ indexPath }, 'Frontend index.html missing');
    return res.status(500).send('Frontend files not available');
  }
  res.sendFile(indexPath, err => {
    if (err) {
      log.error({ err, indexPath }, 'Failed to serve index.html');
      res.status(500).send('Frontend files not available');
    }
  });
});

// Socket.IO setup
debugLog('Setting up Socket.IO handlers...');
try {
  setupSocketHandlers(io);
  debugLog('Socket.IO handlers setup complete');
} catch (err) {
  console.error('❌ Failed to setup Socket.IO handlers:', err);
  throw err;
}

// Initialize message queue system
debugLog('Creating queue service...');
const queueService = createQueueService(io);
debugLog('Queue service created');

// Start server
debugLog('Starting server on port', PORT);
server.listen(PORT, async () => {
  debugLog('Server listen callback triggered');
  log.info(`🚀 Server running on port ${PORT}`);
  log.info(
    `🌐 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`,
  );
  log.info(`💾 Using in-memory storage for demo purposes`);

  // Initialize queue service
  try {
    await queueService.initialize();
    log.info(
      `📨 Message Queue System initialized (${queueService.getProviderType()} provider)`,
    );
  } catch (error) {
    log.error({ error }, '❌ Failed to initialize message queue system');
  }
});

// Graceful shutdown
process.on('SIGINT', async () => {
  log.info('\n🛑 Received SIGINT, shutting down gracefully...');

  try {
    // Shutdown queue service
    await queueService.shutdown();

    // Close server
    server.close(() => {
      log.info('👋 Server shut down complete');
      process.exit(0);
    });
  } catch (error) {
    log.error({ error }, 'Error during shutdown');
    process.exit(1);
  }
});

process.on('SIGTERM', async () => {
  log.info('\n🛑 Received SIGTERM, shutting down gracefully...');

  try {
    // Shutdown queue service
    await queueService.shutdown();

    // Close server
    server.close(() => {
      log.info('👋 Server shut down complete');
      process.exit(0);
    });
  } catch (error) {
    log.error({ error }, 'Error during shutdown');
    process.exit(1);
  }
});

export { io };

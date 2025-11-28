import express from 'express';
import cors from 'cors';
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
import { setupSocketHandlers } from './socket/socketHandlers';
import { httpMetricsMiddleware, register } from './metrics/prometheus';
import { createQueueService } from './messageQueue/queueService';
import { getLogger, patchConsole } from './logger';
import { authenticateToken } from './middleware/auth';
import { apiRateLimiter, chatRateLimiter } from './middleware/rateLimit';

dotenv.config();
patchConsole();
const log = getLogger(false);

// Enable verbose debugging
const DEBUG = process.env.DEBUG === 'true' || process.env.NODE_ENV !== 'production';
const debugLog = (...args: any[]) => DEBUG && console.log('[DEBUG]', new Date().toISOString(), ...args);

debugLog('🚀 Starting server initialization...');
debugLog('Environment:', { NODE_ENV: process.env.NODE_ENV, PORT: process.env.PORT });

// Global error handlers for uncaught exceptions
process.on('uncaughtException', (err) => {
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

// CORS configuration - allow same origin in production, multiple origins in dev
const isProduction = process.env.NODE_ENV === 'production';
const allowedOrigins = process.env.FRONTEND_URL
  ? Array.isArray(process.env.FRONTEND_URL)
    ? process.env.FRONTEND_URL
    : [process.env.FRONTEND_URL]
  : [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:5175',
      'http://localhost:5176',
      'http://localhost:5177',
      'http://localhost:5178',
      'http://localhost:8080',
      'http://localhost:5001', // Same origin when combined
      // Production domains
      'https://chat.hugecat.net',
      'https://chat.cat-herding.net',
    ];

debugLog('Creating Socket.IO server...');
const io = new Server(server, {
  path: '/api/socket.io',
  cors: {
    origin: isProduction ? true : allowedOrigins, // Allow all origins in production (behind oauth2-proxy)
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  },
});
debugLog('Socket.IO server created with path /api/socket.io');

const PORT = process.env.PORT || 5001;

// Middleware
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);
app.use(express.json());

// Prometheus metrics middleware
app.use(httpMetricsMiddleware);

// Global API rate limiter (applies to all routes)
app.use(apiRateLimiter);

// Routes - Authentication (public)
app.use('/api/auth', authRoutes);

// Protected routes - require authentication
app.use('/api/chat', authenticateToken, chatRateLimiter, chatRoutes);
app.use('/api/conversations', authenticateToken, conversationRoutes);
app.use('/api/reactions', authenticateToken, reactionRoutes);
app.use('/api/validation', authenticateToken, validationRoutes);
app.use('/api/test-bench', authenticateToken, agentTestBenchRoutes);
app.use('/api/queue', authenticateToken, messageQueueRoutes);
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

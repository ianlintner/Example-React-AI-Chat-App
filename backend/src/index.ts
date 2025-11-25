import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import session from 'express-session';
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
import { initializePassport } from './services/authService';
import passport from './services/authService';

dotenv.config();
patchConsole();
const log = getLogger(false);

// Initialize OpenTelemetry tracing
initializeTracing();

// Initialize Passport authentication
initializePassport();

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

const app = express();
const server = createServer(app);

// CORS configuration - allow same origin in production, multiple origins in dev
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
    ];

const io = new Server(server, {
  path: '/api/socket.io',
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  },
});

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

// Session middleware (for Passport OAuth)
app.use(
  session({
    secret:
      process.env.SESSION_SECRET || 'your_session_secret_change_in_production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production', // HTTPS only in production
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  }),
);

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

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

// Serve static frontend files
const publicPath = path.join(__dirname, '..', 'public');
app.use(express.static(publicPath));

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
  // Serve index.html for all other routes (SPA fallback)
  res.sendFile(path.join(publicPath, 'index.html'), err => {
    if (err) {
      log.error({ err, path: publicPath }, 'Failed to serve index.html');
      res.status(500).send('Frontend files not available');
    }
  });
});

// Socket.IO setup
setupSocketHandlers(io);

// Initialize message queue system
const queueService = createQueueService(io);

// Start server
server.listen(PORT, async () => {
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

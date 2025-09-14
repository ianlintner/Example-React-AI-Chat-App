import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
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
import { setupSocketHandlers } from './socket/socketHandlers';
import { httpMetricsMiddleware, register } from './metrics/prometheus';
import { createQueueService } from './messageQueue/queueService';
import { getLogger, patchConsole } from './logger';

dotenv.config();
patchConsole();
const log = getLogger(false);

// Initialize OpenTelemetry tracing
initializeTracing();

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
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:5175',
      'http://localhost:5176',
      'http://localhost:5177',
      'http://localhost:5178',
      'http://localhost:8080',
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  },
});

const PORT = process.env.PORT || 5001;

// Middleware
app.use(
  cors({
    origin: process.env.FRONTEND_URL || [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:5175',
      'http://localhost:5176',
      'http://localhost:5177',
      'http://localhost:5178',
      'http://localhost:8080',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);
app.use(express.json());

// Prometheus metrics middleware
app.use(httpMetricsMiddleware);

// Routes
app.use('/api/chat', chatRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/reactions', reactionRoutes);
app.use('/api/validation', validationRoutes);
app.use('/api/test-bench', agentTestBenchRoutes);
app.use('/api/queue', messageQueueRoutes);
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
  const { tracer } = require('./tracing/tracer');
  const span = tracer.startSpan('health_check');

  span.setAttributes({
    'http.method': 'GET',
    'http.route': '/health',
    'http.status_code': 200,
  });

  span.addEvent('health_check_performed');
  span.setStatus({ code: 1 }); // OK
  span.end();

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
  const { tracer } = require('./tracing/tracer');
  const span = tracer.startSpan('api_health_check');

  span.setAttributes({
    'http.method': 'GET',
    'http.route': '/api/health',
    'http.status_code': 200,
  });

  span.addEvent('api_health_check_performed');
  span.setStatus({ code: 1 }); // OK
  span.end();

  res.json({ status: 'OK', timestamp: new Date().toISOString() });
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

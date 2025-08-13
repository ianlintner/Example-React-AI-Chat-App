import promClient from 'prom-client';

// Create a Registry
const register = new promClient.Registry();

// Add default metrics (CPU, memory, etc.)
promClient.collectDefaultMetrics({ register });

// Custom metrics
const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
});

const httpRequestsTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

const activeConnections = new promClient.Gauge({
  name: 'websocket_connections_active',
  help: 'Number of active WebSocket connections',
});

const chatMessagesTotal = new promClient.Counter({
  name: 'chat_messages_total',
  help: 'Total number of chat messages processed',
  labelNames: ['type', 'agent_type'],
});

const agentResponseTime = new promClient.Histogram({
  name: 'agent_response_time_seconds',
  help: 'Time taken for agent to respond to messages',
  labelNames: ['agent_type', 'success'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
});

const aiModelRequests = new promClient.Counter({
  name: 'ai_model_requests_total',
  help: 'Total number of AI model requests',
  labelNames: ['model', 'success'],
});

const aiModelTokensUsed = new promClient.Counter({
  name: 'ai_model_tokens_used_total',
  help: 'Total number of tokens used by AI models',
  labelNames: ['model', 'type'], // type: prompt, completion
});

// Validation metrics - enhanced to match dashboard functionality
const validationChecks = new promClient.Counter({
  name: 'validation_checks_total',
  help: 'Total number of validation checks performed',
  labelNames: ['agent_type', 'result', 'proactive'], // result: pass, fail
});

const validationScores = new promClient.Histogram({
  name: 'validation_scores',
  help: 'Distribution of validation scores',
  labelNames: ['agent_type', 'proactive'],
  buckets: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
});

const validationIssues = new promClient.Counter({
  name: 'validation_issues_total',
  help: 'Total number of validation issues by severity',
  labelNames: ['agent_type', 'severity', 'issue_type'],
});

const validationResponseLength = new promClient.Histogram({
  name: 'validation_response_length_chars',
  help: 'Length of responses being validated',
  labelNames: ['agent_type'],
  buckets: [50, 100, 200, 500, 1000, 2000, 5000, 10000],
});

const validationMetrics = new promClient.Histogram({
  name: 'validation_quality_metrics',
  help: 'Various quality metrics from validation',
  labelNames: ['agent_type', 'metric_type'], // metric_type: readability, technical_accuracy, appropriateness, coherence
  buckets: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
});

const memoryStorageOperations = new promClient.Counter({
  name: 'memory_storage_operations_total',
  help: 'Total number of memory storage operations',
  labelNames: ['operation'], // operation: read, write, delete
});

// Register all metrics
register.registerMetric(httpRequestDuration);
register.registerMetric(httpRequestsTotal);
register.registerMetric(activeConnections);
register.registerMetric(chatMessagesTotal);
register.registerMetric(agentResponseTime);
register.registerMetric(aiModelRequests);
register.registerMetric(aiModelTokensUsed);
register.registerMetric(validationChecks);
register.registerMetric(validationScores);
register.registerMetric(validationIssues);
register.registerMetric(validationResponseLength);
register.registerMetric(validationMetrics);
register.registerMetric(memoryStorageOperations);

// Middleware for HTTP metrics
export function httpMetricsMiddleware(req: any, res: any, next: any): void {
  const start = Date.now();

  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route?.path || req.path || 'unknown';
    const method = req.method;
    const statusCode = res.statusCode.toString();

    httpRequestDuration.observe(
      { method, route, status_code: statusCode },
      duration,
    );
    httpRequestsTotal.inc({ method, route, status_code: statusCode });
  });

  next();
}

// Export metrics objects
export const metrics = {
  httpRequestDuration,
  httpRequestsTotal,
  activeConnections,
  chatMessagesTotal,
  agentResponseTime,
  aiModelRequests,
  aiModelTokensUsed,
  validationChecks,
  validationScores,
  validationIssues,
  validationResponseLength,
  validationMetrics,
  memoryStorageOperations,
};

export { register };
export default promClient;

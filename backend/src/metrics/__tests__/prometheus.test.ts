import promClient from 'prom-client';
import { metrics, register, httpMetricsMiddleware } from '../prometheus';

// Mock prom-client
jest.mock('prom-client', () => {
  const mockHistogram = {
    observe: jest.fn(),
  };
  const mockCounter = {
    inc: jest.fn(),
  };
  const mockGauge = {
    set: jest.fn(),
    inc: jest.fn(),
    dec: jest.fn(),
  };
  const mockRegistry = {
    registerMetric: jest.fn(),
    metrics: jest.fn().mockResolvedValue('mocked metrics'),
  };

  return {
    Registry: jest.fn(() => mockRegistry),
    Histogram: jest.fn(() => mockHistogram),
    Counter: jest.fn(() => mockCounter),
    Gauge: jest.fn(() => mockGauge),
    collectDefaultMetrics: jest.fn(),
    default: {
      Registry: jest.fn(() => mockRegistry),
      Histogram: jest.fn(() => mockHistogram),
      Counter: jest.fn(() => mockCounter),
      Gauge: jest.fn(() => mockGauge),
      collectDefaultMetrics: jest.fn(),
    },
  };
});

describe('Prometheus Metrics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Metrics Initialization', () => {
    it('should create all required metrics', () => {
      expect(metrics.httpRequestDuration).toBeDefined();
      expect(metrics.httpRequestsTotal).toBeDefined();
      expect(metrics.activeConnections).toBeDefined();
      expect(metrics.chatMessagesTotal).toBeDefined();
      expect(metrics.agentResponseTime).toBeDefined();
      expect(metrics.aiModelRequests).toBeDefined();
      expect(metrics.aiModelTokensUsed).toBeDefined();
      expect(metrics.validationChecks).toBeDefined();
      expect(metrics.memoryStorageOperations).toBeDefined();
    });

    it('should create registry and register metrics', () => {
      expect(promClient.Registry).toHaveBeenCalled();
      expect(promClient.collectDefaultMetrics).toHaveBeenCalled();
    });

    it('should create histograms with correct configuration', () => {
      expect(promClient.Histogram).toHaveBeenCalledWith({
        name: 'http_request_duration_seconds',
        help: 'Duration of HTTP requests in seconds',
        labelNames: ['method', 'route', 'status_code'],
        buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
      });

      expect(promClient.Histogram).toHaveBeenCalledWith({
        name: 'agent_response_time_seconds',
        help: 'Time taken for agent to respond to messages',
        labelNames: ['agent_type', 'success'],
        buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
      });
    });

    it('should create counters with correct configuration', () => {
      expect(promClient.Counter).toHaveBeenCalledWith({
        name: 'http_requests_total',
        help: 'Total number of HTTP requests',
        labelNames: ['method', 'route', 'status_code'],
      });

      expect(promClient.Counter).toHaveBeenCalledWith({
        name: 'chat_messages_total',
        help: 'Total number of chat messages processed',
        labelNames: ['type', 'agent_type'],
      });

      expect(promClient.Counter).toHaveBeenCalledWith({
        name: 'ai_model_requests_total',
        help: 'Total number of AI model requests',
        labelNames: ['model', 'success'],
      });

      expect(promClient.Counter).toHaveBeenCalledWith({
        name: 'ai_model_tokens_used_total',
        help: 'Total number of tokens used by AI models',
        labelNames: ['model', 'type'],
      });

      expect(promClient.Counter).toHaveBeenCalledWith({
        name: 'validation_checks_total',
        help: 'Total number of validation checks performed',
        labelNames: ['type', 'result'],
      });

      expect(promClient.Counter).toHaveBeenCalledWith({
        name: 'memory_storage_operations_total',
        help: 'Total number of memory storage operations',
        labelNames: ['operation'],
      });
    });

    it('should create gauge with correct configuration', () => {
      expect(promClient.Gauge).toHaveBeenCalledWith({
        name: 'websocket_connections_active',
        help: 'Number of active WebSocket connections',
      });
    });
  });

  describe('HTTP Metrics Middleware', () => {
    let mockReq: any;
    let mockRes: any;
    let mockNext: jest.Mock;

    beforeEach(() => {
      mockReq = {
        method: 'GET',
        path: '/api/test',
        route: { path: '/api/test' },
      };
      mockRes = {
        statusCode: 200,
        on: jest.fn(),
      };
      mockNext = jest.fn();
    });

    it('should call next middleware', () => {
      httpMetricsMiddleware(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should register finish event listener', () => {
      httpMetricsMiddleware(mockReq, mockRes, mockNext);
      expect(mockRes.on).toHaveBeenCalledWith('finish', expect.any(Function));
    });

    it('should record metrics on response finish', (done) => {
      const startTime = Date.now();
      
      mockRes.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'finish') {
          // Simulate some time passing
          setTimeout(() => {
            callback();
            
            // Verify metrics were called
            expect(metrics.httpRequestDuration.observe).toHaveBeenCalledWith(
              { method: 'GET', route: '/api/test', status_code: '200' },
              expect.any(Number)
            );
            expect(metrics.httpRequestsTotal.inc).toHaveBeenCalledWith({
              method: 'GET',
              route: '/api/test',
              status_code: '200',
            });
            done();
          }, 10);
        }
      });

      httpMetricsMiddleware(mockReq, mockRes, mockNext);
    });

    it('should handle requests without route', (done) => {
      mockReq.route = undefined;
      
      mockRes.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'finish') {
          callback();
          
          expect(metrics.httpRequestDuration.observe).toHaveBeenCalledWith(
            { method: 'GET', route: '/api/test', status_code: '200' },
            expect.any(Number)
          );
          done();
        }
      });

      httpMetricsMiddleware(mockReq, mockRes, mockNext);
    });

    it('should handle requests without path', (done) => {
      mockReq.route = undefined;
      mockReq.path = undefined;
      
      mockRes.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'finish') {
          callback();
          
          expect(metrics.httpRequestDuration.observe).toHaveBeenCalledWith(
            { method: 'GET', route: 'unknown', status_code: '200' },
            expect.any(Number)
          );
          done();
        }
      });

      httpMetricsMiddleware(mockReq, mockRes, mockNext);
    });

    it('should handle different status codes', (done) => {
      mockRes.statusCode = 404;
      
      mockRes.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'finish') {
          callback();
          
          expect(metrics.httpRequestsTotal.inc).toHaveBeenCalledWith({
            method: 'GET',
            route: '/api/test',
            status_code: '404',
          });
          done();
        }
      });

      httpMetricsMiddleware(mockReq, mockRes, mockNext);
    });
  });

  describe('Exports', () => {
    it('should export register', () => {
      expect(register).toBeDefined();
    });

    it('should export metrics object', () => {
      expect(metrics).toBeDefined();
      expect(typeof metrics).toBe('object');
    });

    it('should export promClient as default', () => {
      expect(promClient).toBeDefined();
    });
  });
});

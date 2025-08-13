import { metrics, register, httpMetricsMiddleware } from '../prometheus';
import promClient from 'prom-client';

describe('Prometheus Metrics', () => {
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
      expect(metrics.validationScores).toBeDefined();
      expect(metrics.validationIssues).toBeDefined();
      expect(metrics.validationResponseLength).toBeDefined();
      expect(metrics.validationMetrics).toBeDefined();
      expect(metrics.memoryStorageOperations).toBeDefined();
    });

    it('should have histogram metrics with observe method', () => {
      expect(typeof metrics.httpRequestDuration.observe).toBe('function');
      expect(typeof metrics.agentResponseTime.observe).toBe('function');
      expect(typeof metrics.validationScores.observe).toBe('function');
    });

    it('should have counter metrics with inc method', () => {
      expect(typeof metrics.httpRequestsTotal.inc).toBe('function');
      expect(typeof metrics.chatMessagesTotal.inc).toBe('function');
      expect(typeof metrics.aiModelRequests.inc).toBe('function');
      expect(typeof metrics.validationChecks.inc).toBe('function');
    });

    it('should have gauge metrics with set method', () => {
      expect(typeof metrics.activeConnections.set).toBe('function');
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

    it('should record metrics when response finishes', done => {
      // Spy on the metrics methods
      const observeSpy = jest.spyOn(metrics.httpRequestDuration, 'observe');
      const incSpy = jest.spyOn(metrics.httpRequestsTotal, 'inc');

      mockRes.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'finish') {
          setTimeout(() => {
            callback();

            // Verify metrics were called
            expect(observeSpy).toHaveBeenCalledWith(
              { method: 'GET', route: '/api/test', status_code: '200' },
              expect.any(Number),
            );
            expect(incSpy).toHaveBeenCalledWith({
              method: 'GET',
              route: '/api/test',
              status_code: '200',
            });

            // Clean up spies
            observeSpy.mockRestore();
            incSpy.mockRestore();
            done();
          }, 10);
        }
      });

      httpMetricsMiddleware(mockReq, mockRes, mockNext);
    });

    it('should handle requests without route', done => {
      mockReq.route = undefined;
      const observeSpy = jest.spyOn(metrics.httpRequestDuration, 'observe');

      mockRes.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'finish') {
          callback();

          expect(observeSpy).toHaveBeenCalledWith(
            { method: 'GET', route: '/api/test', status_code: '200' },
            expect.any(Number),
          );

          observeSpy.mockRestore();
          done();
        }
      });

      httpMetricsMiddleware(mockReq, mockRes, mockNext);
    });

    it('should handle requests without path', done => {
      mockReq.route = undefined;
      mockReq.path = undefined;
      const observeSpy = jest.spyOn(metrics.httpRequestDuration, 'observe');

      mockRes.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'finish') {
          callback();

          expect(observeSpy).toHaveBeenCalledWith(
            { method: 'GET', route: 'unknown', status_code: '200' },
            expect.any(Number),
          );

          observeSpy.mockRestore();
          done();
        }
      });

      httpMetricsMiddleware(mockReq, mockRes, mockNext);
    });

    it('should handle different status codes', done => {
      mockRes.statusCode = 404;
      const incSpy = jest.spyOn(metrics.httpRequestsTotal, 'inc');

      mockRes.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'finish') {
          callback();

          expect(incSpy).toHaveBeenCalledWith({
            method: 'GET',
            route: '/api/test',
            status_code: '404',
          });

          incSpy.mockRestore();
          done();
        }
      });

      httpMetricsMiddleware(mockReq, mockRes, mockNext);
    });
  });

  describe('Registry and Exports', () => {
    it('should export register', () => {
      expect(register).toBeDefined();
      expect(typeof register.metrics).toBe('function');
    });

    it('should export metrics object', () => {
      expect(metrics).toBeDefined();
      expect(typeof metrics).toBe('object');
    });

    it('should export promClient as default', () => {
      expect(promClient).toBeDefined();
    });

    it('should be able to collect metrics', async () => {
      const metricsOutput = await register.metrics();
      expect(typeof metricsOutput).toBe('string');
    });
  });
});

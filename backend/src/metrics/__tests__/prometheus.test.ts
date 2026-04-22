import {
  metrics,
  register,
  httpMetricsMiddleware,
  metricsEmit,
} from '../prometheus';
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
        baseUrl: '',
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
      const observeSpy = jest.spyOn(metrics.httpRequestDuration, 'observe');
      const incSpy = jest.spyOn(metrics.httpRequestsTotal, 'inc');

      mockRes.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'finish') {
          setTimeout(() => {
            callback();

            expect(observeSpy).toHaveBeenCalledWith(
              expect.objectContaining({
                http_method: 'GET',
                http_route: '/api/test',
                http_status_code: '200',
                status_class: '2xx',
              }),
              expect.any(Number),
            );
            expect(incSpy).toHaveBeenCalledWith(
              expect.objectContaining({
                http_method: 'GET',
                http_route: '/api/test',
                http_status_code: '200',
                status_class: '2xx',
              }),
            );

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
            expect.objectContaining({
              http_method: 'GET',
              http_route: '/api/test',
              http_status_code: '200',
            }),
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
            expect.objectContaining({
              http_method: 'GET',
              http_route: 'unknown',
              http_status_code: '200',
            }),
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

          expect(incSpy).toHaveBeenCalledWith(
            expect.objectContaining({
              http_method: 'GET',
              http_route: '/api/test',
              http_status_code: '404',
              status_class: '4xx',
            }),
          );

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

  describe('Tier-aware metrics', () => {
    async function valueOf(
      name: string,
      labels: Record<string, string>,
    ): Promise<number> {
      const json = await register.getMetricsAsJSON();
      const m = json.find(x => x.name === name) as
        | { values: Array<{ value: number; labels: Record<string, string> }> }
        | undefined;
      if (!m) {
        return 0;
      }
      const match = m.values.find(v =>
        Object.entries(labels).every(([k, val]) => v.labels[k] === val),
      );
      return match?.value ?? 0;
    }

    it('chat_messages_by_tier_total increments per tier + role', async () => {
      const before = await valueOf('chat_messages_by_tier_total', {
        tier: 'anonymous',
        role: 'user',
      });
      metricsEmit.tier.chatMessage('anonymous', 'user');
      metricsEmit.tier.chatMessage('anonymous', 'user');
      metricsEmit.tier.chatMessage('authenticated', 'assistant');
      const anonUser = await valueOf('chat_messages_by_tier_total', {
        tier: 'anonymous',
        role: 'user',
      });
      const authAssistant = await valueOf('chat_messages_by_tier_total', {
        tier: 'authenticated',
        role: 'assistant',
      });
      expect(anonUser).toBe(before + 2);
      expect(authAssistant).toBeGreaterThanOrEqual(1);
    });

    it('unknown tier collapses to "other"', async () => {
      metricsEmit.tier.chatMessage('bogus-tier' as never, 'user');
      const other = await valueOf('chat_messages_by_tier_total', {
        tier: 'other',
        role: 'user',
      });
      expect(other).toBeGreaterThanOrEqual(1);
    });

    it('llm_requests_by_tier_total captures provider/model/outcome', async () => {
      metricsEmit.tier.llmRequest(
        'anonymous',
        'foundry',
        'gpt-4o-mini',
        'success',
      );
      const v = await valueOf('llm_requests_by_tier_total', {
        tier: 'anonymous',
        provider: 'foundry',
        model: 'gpt-4o-mini',
        outcome: 'success',
      });
      expect(v).toBeGreaterThanOrEqual(1);
    });

    it('rate_limit_hits_total captures scope/tier/bucket', async () => {
      metricsEmit.tier.rateLimitHit('http', 'anonymous', 'minute');
      metricsEmit.tier.rateLimitHit('socket', 'anonymous', 'day');
      const http = await valueOf('rate_limit_hits_total', {
        scope: 'http',
        tier: 'anonymous',
        bucket: 'minute',
      });
      const sock = await valueOf('rate_limit_hits_total', {
        scope: 'socket',
        tier: 'anonymous',
        bucket: 'day',
      });
      expect(http).toBeGreaterThanOrEqual(1);
      expect(sock).toBeGreaterThanOrEqual(1);
    });

    it('anon_sessions_active gauge can be set', async () => {
      metricsEmit.tier.anonSessionsActive(7);
      const v = await valueOf('anon_sessions_active', {});
      expect(v).toBe(7);
    });
  });
});

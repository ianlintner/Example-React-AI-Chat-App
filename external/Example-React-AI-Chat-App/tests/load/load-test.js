import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
export let errorRate = new Rate('errors');

export let options = {
  stages: [
    { duration: '30s', target: 5 }, // Ramp up to 5 users
    { duration: '1m', target: 10 }, // Stay at 10 users
    { duration: '30s', target: 15 }, // Ramp up to 15 users
    { duration: '2m', target: 15 }, // Stay at 15 users
    { duration: '30s', target: 0 }, // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests must complete below 500ms
    http_req_failed: ['rate<0.05'], // Error rate must be below 5%
    errors: ['rate<0.05'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://backend:5001';

export default function () {
  const responses = {};

  // Test health endpoint
  responses.health = http.get(`${BASE_URL}/health`);
  check(responses.health, {
    'health check status is 200': r => r.status === 200,
    'health check response time < 100ms': r => r.timings.duration < 100,
  });

  // Test API health endpoint
  responses.apiHealth = http.get(`${BASE_URL}/api/health`);
  check(responses.apiHealth, {
    'api health status is 200': r => r.status === 200,
  });

  // Test metrics endpoint
  responses.metrics = http.get(`${BASE_URL}/metrics`);
  check(responses.metrics, {
    'metrics endpoint status is 200': r => r.status === 200,
    'metrics content type is correct': r =>
      r.headers['Content-Type'].includes('text/plain'),
  });

  // Test chat API endpoints
  responses.conversations = http.get(`${BASE_URL}/api/conversations`);
  check(responses.conversations, {
    'conversations endpoint status is 200': r => r.status === 200,
  });

  // Test validation endpoint
  responses.validation = http.get(`${BASE_URL}/api/validation/status`);
  check(responses.validation, {
    'validation endpoint accessible': r => r.status === 200 || r.status === 404, // 404 is acceptable if endpoint doesn't exist
  });

  // Test test-bench endpoint
  responses.testBench = http.get(`${BASE_URL}/api/test-bench/agents`);
  check(responses.testBench, {
    'test-bench endpoint accessible': r => r.status === 200 || r.status === 404,
  });

  // Test queue endpoint
  responses.queue = http.get(`${BASE_URL}/api/queue/status`);
  check(responses.queue, {
    'queue endpoint accessible': r => r.status === 200 || r.status === 404,
  });

  // Record errors
  errorRate.add(responses.health.status !== 200);

  // Add some realistic delay between requests
  sleep(Math.random() * 2 + 1); // Sleep 1-3 seconds
}

export function handleSummary(data) {
  return {
    'load-test-results.json': JSON.stringify(data, null, 2),
  };
}

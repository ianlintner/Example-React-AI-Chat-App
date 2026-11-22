import { describe, expect, it, vi } from 'vitest';
import { loadRouterConfig } from './config';
import { createJevClient, ROUTER_QUESTIONS } from './jev';

describe('createJevClient wire format', () => {
  it('posts a choice question per routing dimension with a Bearer key', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        model: 'jev-test',
        answers: Object.fromEntries(
          Object.values(ROUTER_QUESTIONS).map(name => [
            name,
            {
              type: 'choice',
              choice: name === 'skill' ? 'code' : 'no',
              confidence: 0.9,
              probabilities: { code: 0.9, other: 0.1 },
            },
          ]),
        ),
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);
    try {
      const config = loadRouterConfig({
        ROUTER_MODE: 'shadow',
        JEV_API_KEY: 'test-key',
        JEV_BASE_URL: 'https://example.test',
      });
      const result = await createJevClient(config).classify({ text: 'hello' });
      const [url, init] = fetchMock.mock.calls[0]! as unknown as [
        URL,
        RequestInit,
      ];
      expect(String(url)).toBe('https://example.test/v1/systemone');
      expect(init.method).toBe('POST');
      expect((init.headers as Record<string, string>).authorization).toBe(
        'Bearer test-key',
      );
      const body = JSON.parse(String(init.body)) as {
        model: string;
        state: string;
        questions: Record<string, { type: string; criteria: object }>;
      };
      expect(body.state).toBe('hello');
      expect(Object.keys(body.questions)).toEqual(
        Object.values(ROUTER_QUESTIONS),
      );
      for (const question of Object.values(body.questions)) {
        expect(question.type).toBe('choice');
        expect(question.criteria).toBeDefined();
      }
      expect(result.skill.choice).toBe('code');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

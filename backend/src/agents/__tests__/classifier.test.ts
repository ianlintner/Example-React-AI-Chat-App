import { classifyMessage } from '../classifier';

describe('Agent Classifier', () => {
  test('should classify joke requests correctly', async () => {
    const result = await classifyMessage('Tell me a joke');
    expect(result.agentType).toBe('joke');
    expect(result.confidence).toBeGreaterThan(0.6);
  });

  test('should classify trivia requests correctly', async () => {
    const result = await classifyMessage('Tell me an interesting fact');
    expect(result.agentType).toBe('trivia');
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  test('should classify GIF requests correctly', async () => {
    const result = await classifyMessage('Show me a funny gif');
    expect(result.agentType).toBe('gif');
    expect(result.confidence).toBeGreaterThan(0.7);
  });

  test('should classify technical questions correctly', async () => {
    const result = await classifyMessage('How do I implement React hooks?');
    expect(result.agentType).toBe('website_support');
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  test('should classify programming questions correctly', async () => {
    const result = await classifyMessage('How to debug JavaScript code?');
    expect(result.agentType).toBe('website_support');
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  test('should fallback to general for unclear messages', async () => {
    const result = await classifyMessage('hello');
    expect(result.agentType).toBe('general');
    expect(result.confidence).toBe(0.5);
  });

  test('should prioritize GIF requests over other types', async () => {
    const result = await classifyMessage('Send me a reaction gif that is funny');
    expect(result.agentType).toBe('gif');
    expect(result.confidence).toBeGreaterThan(0.7);
  });

  test('should handle complex technical queries', async () => {
    const result = await classifyMessage('I need help with API integration and database queries');
    expect(result.agentType).toBe('website_support');
    expect(result.confidence).toBeGreaterThan(0.5);
  });
});

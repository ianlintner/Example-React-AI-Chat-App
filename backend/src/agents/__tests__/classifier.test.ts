import { classifyMessage } from '../classifier';

describe('Agent Classifier', () => {
  test('should classify joke requests correctly', async () => {
    const result = await classifyMessage('Tell me a joke');
    expect(result.agentType).toBe('joke');
    expect(result.confidence).toBeGreaterThan(0.7);
  });

  test('should classify trivia requests correctly', async () => {
    const result = await classifyMessage('Tell me something interesting');
    expect(result.agentType).toBe('trivia');
    expect(result.confidence).toBeGreaterThan(0.7);
  });

  test('should classify GIF requests correctly', async () => {
    const result = await classifyMessage('Show me a funny gif');
    expect(result.agentType).toBe('gif');
    expect(result.confidence).toBeGreaterThan(0.7);
  });

  test('should classify technical questions correctly', async () => {
    const result = await classifyMessage('How do I implement React hooks?');
    expect(result.agentType).toBe('technical');
    expect(result.confidence).toBeGreaterThan(0.6);
  });

  test('should classify hold-related queries correctly', async () => {
    const result = await classifyMessage('How long is the wait time?');
    expect(result.agentType).toBe('hold_agent');
    expect(result.confidence).toBeGreaterThan(0.7);
  });

  test('should fallback to general for unclear messages', async () => {
    const result = await classifyMessage('hello');
    expect(result.agentType).toBe('general');
  });
});

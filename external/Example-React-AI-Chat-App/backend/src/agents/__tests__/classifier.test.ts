// Mock OpenAI first, before any imports
const mockOpenAICreate = jest.fn();

// Mock the entire OpenAI module
jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: mockOpenAICreate,
        },
      },
    })),
  };
});

import { classifyMessage } from '../classifier';
import { AgentType, MessageClassification } from '../types';

describe('Message Classifier', () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    jest.clearAllMocks();

    // Store original environment
    originalEnv = process.env.OPENAI_API_KEY;

    // Clear the mock
    mockOpenAICreate.mockClear();
  });

  afterEach(() => {
    // Restore original environment
    if (originalEnv !== undefined) {
      process.env.OPENAI_API_KEY = originalEnv;
    } else {
      delete process.env.OPENAI_API_KEY;
    }
  });

  describe('Fallback Classification (No OpenAI)', () => {
    beforeEach(() => {
      delete process.env.OPENAI_API_KEY;
    });

    describe('Website Support Classification', () => {
      it('should classify programming-related messages as website_support', async () => {
        const testCases = [
          'How do I fix this react component?',
          'Debug this javascript error',
          'My python code is not working',
          'Help me with css styling',
          'How to use docker?',
          'Git repository issues',
          'Frontend framework help',
          'Async await promises help',
          'Help me code this',
          'Programming assistance needed',
        ];

        for (const message of testCases) {
          const result = await classifyMessage(message);
          expect(result.agentType).toBe('website_support');
          expect(result.confidence).toBeGreaterThan(0.5);
          expect(result.confidence).toBeLessThanOrEqual(0.8);
          expect(result.reasoning).toContain('technical keywords');
        }
      });

      it('should give higher confidence for messages with more technical keywords', async () => {
        const simpleMessage = 'Help me code';
        const complexMessage =
          'Help me debug this React component with TypeScript and async await promises';

        const simpleResult = await classifyMessage(simpleMessage);
        const complexResult = await classifyMessage(complexMessage);

        expect(simpleResult.agentType).toBe('website_support');
        expect(complexResult.agentType).toBe('website_support');
        expect(complexResult.confidence).toBeGreaterThan(
          simpleResult.confidence,
        );
      });
    });

    describe('GIF Classification', () => {
      it('should classify GIF-related messages with highest priority', async () => {
        const testCases = [
          'Show me a funny gif',
          'Send me a reaction gif',
          'I need a cat gif',
          'Give me an animated image',
          'Share a meme with me',
          'Show me a happy gif',
          'Send an excited gif',
          'I want a celebration gif',
          'Gif of thumbs up please',
          'Dancing gif please',
        ];

        for (const message of testCases) {
          const result = await classifyMessage(message);
          expect(result.agentType).toBe('gif');
          expect(result.confidence).toBeGreaterThan(0.7);
          expect(result.confidence).toBeLessThanOrEqual(0.95);
          expect(result.reasoning).toContain('GIF');
        }
      });

      it('should prioritize GIF over other classifications', async () => {
        const message = 'Show me a funny coding gif'; // Has both technical and gif keywords
        const result = await classifyMessage(message);

        expect(result.agentType).toBe('gif');
        expect(result.reasoning).toContain('GIF');
      });
    });

    describe('Joke Classification', () => {
      it('should classify joke-related messages as joke', async () => {
        const testCases = [
          'Tell me a dad joke',
          'Make me laugh',
          'Share a funny joke',
          'I need a good pun',
          'Tell me something cheesy',
          'Give me a witty one-liner',
          'Share some humor',
          'Make me groan with a dad joke',
          'Tell me a corny joke',
          'I want a silly joke',
        ];

        for (const message of testCases) {
          const result = await classifyMessage(message);
          expect(result.agentType).toBe('joke');
          expect(result.confidence).toBeGreaterThan(0.6);
          expect(result.confidence).toBeLessThanOrEqual(0.9);
          expect(result.reasoning).toContain('joke keywords');
        }
      });

      it('should be lower priority than GIF but higher than trivia', async () => {
        const jokeMessage = 'Tell me a joke';
        const result = await classifyMessage(jokeMessage);

        expect(result.agentType).toBe('joke');
        expect(result.confidence).toBeGreaterThan(0.6);
      });
    });

    describe('Trivia Classification', () => {
      it('should classify trivia-related messages as trivia', async () => {
        const testCases = [
          'Tell me a fun fact',
          'Share some trivia with me',
          'Give me a random fact',
          'Share an interesting fact',
          'What is an amazing fact?',
          'Educate me with facts',
          'Share interesting history',
          'Tell me some fascinating knowledge',
          'Give me trivia',
          'Share trivia about animals',
        ];

        for (const message of testCases) {
          const result = await classifyMessage(message);
          expect(result.agentType).toBe('trivia');
          expect(result.confidence).toBeGreaterThan(0.55);
          expect(result.confidence).toBeLessThanOrEqual(0.85);
          expect(result.reasoning).toContain('trivia keywords');
        }
      });
    });

    describe('General Classification', () => {
      it('should classify general messages as general', async () => {
        const testCases = [
          'How are you today?',
          'What should I have for lunch?',
          'Tell me about your day',
          'I need advice about relationships',
          'What is the meaning of life?',
          'Help me make a decision',
          'Random conversation starter',
          'Just want to chat about weather',
        ];

        for (const message of testCases) {
          const result = await classifyMessage(message);
          expect(result.agentType).toBe('general');
          expect(result.confidence).toBe(0.5);
          expect(result.reasoning).toContain('No specific keywords detected');
        }
      });
    });

    describe('Priority System', () => {
      it('should prioritize classifications correctly: GIF > Joke > Trivia > Technical > General', async () => {
        // Test GIF priority over everything
        const gifTechnical = await classifyMessage('Show me a programming gif');
        expect(gifTechnical.agentType).toBe('gif');

        const gifJoke = await classifyMessage('Funny joke gif please');
        expect(gifJoke.agentType).toBe('gif');

        // Test joke priority over trivia and technical (when no GIF)
        const jokeFact = await classifyMessage('Tell me a funny science joke');
        expect(jokeFact.agentType).toBe('joke');

        // Test trivia priority over general
        const triviaGeneral = await classifyMessage(
          'Share an interesting fun fact about animals',
        );
        expect(triviaGeneral.agentType).toBe('trivia');
      });
    });

    describe('Edge Cases', () => {
      it('should handle empty messages', async () => {
        const result = await classifyMessage('');
        expect(result.agentType).toBe('general');
        expect(result.confidence).toBe(0.5);
      });

      it('should handle whitespace-only messages', async () => {
        const result = await classifyMessage('   \n\t  ');
        expect(result.agentType).toBe('general');
        expect(result.confidence).toBe(0.5);
      });

      it('should handle very long messages', async () => {
        const longMessage = `${'programming '.repeat(100)}help me debug this`;
        const result = await classifyMessage(longMessage);
        expect(result.agentType).toBe('website_support');
        expect(result.confidence).toBeGreaterThan(0.5);
      });

      it('should handle messages with mixed case', async () => {
        const result = await classifyMessage('TELL ME A FUNNY JOKE PLEASE');
        expect(result.agentType).toBe('joke');
      });

      it('should handle messages with special characters', async () => {
        const result = await classifyMessage('Tell me a joke!!! 😄🤣');
        expect(result.agentType).toBe('joke');
      });

      it('should handle single character messages', async () => {
        const result = await classifyMessage('?');
        expect(result.agentType).toBe('general');
        expect(result.confidence).toBe(0.5);
      });
    });

    describe('Confidence Scoring', () => {
      it('should cap confidence at maximum values', async () => {
        // Create message with many keywords to test capping
        const manyGifKeywords =
          'gif animated meme funny visual reaction cute happy sad dance'
            .split(' ')
            .join(' ');
        const result = await classifyMessage(manyGifKeywords);

        expect(result.agentType).toBe('gif');
        expect(result.confidence).toBeLessThanOrEqual(0.95);
      });

      it('should increase confidence with more relevant keywords', async () => {
        const oneKeyword = await classifyMessage('joke');
        const multipleKeywords = await classifyMessage(
          'dad joke funny humor pun',
        );

        expect(oneKeyword.agentType).toBe('joke');
        expect(multipleKeywords.agentType).toBe('joke');
        expect(multipleKeywords.confidence).toBeGreaterThan(
          oneKeyword.confidence,
        );
      });
    });
  });

  describe('OpenAI Integration', () => {
    beforeEach(() => {
      process.env.OPENAI_API_KEY = 'test-api-key';
    });

    it('should use OpenAI classification when API key is available', async () => {
      const mockClassification = {
        agentType: 'joke',
        confidence: 0.95,
        reasoning: 'User is requesting a joke',
      };

      mockOpenAICreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify(mockClassification),
            },
          },
        ],
      });

      const result = await classifyMessage('Tell me a joke');

      expect(mockOpenAICreate).toHaveBeenCalledWith({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: expect.stringContaining('Tell me a joke'),
          },
        ],
        max_tokens: 200,
        temperature: 0.1,
      });

      expect(result).toEqual(mockClassification);
    });

    it('should fall back to keyword matching when OpenAI API fails', async () => {
      mockOpenAICreate.mockRejectedValue(new Error('API Error'));

      const result = await classifyMessage('Tell me a joke');

      expect(result.agentType).toBe('joke');
      expect(result.reasoning).toContain('joke keywords');
    });

    it('should fall back when OpenAI returns invalid JSON', async () => {
      mockOpenAICreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: 'Invalid JSON response',
            },
          },
        ],
      });

      const result = await classifyMessage('Tell me a joke');

      expect(result.agentType).toBe('joke');
      expect(result.reasoning).toContain('joke keywords');
    });

    it('should fall back when OpenAI returns empty response', async () => {
      mockOpenAICreate.mockResolvedValue({
        choices: [],
      });

      const result = await classifyMessage('Tell me a joke');

      expect(result.agentType).toBe('joke');
      expect(result.reasoning).toContain('joke keywords');
    });

    it('should handle OpenAI timeout errors', async () => {
      mockOpenAICreate.mockRejectedValue(new Error('Request timeout'));

      const result = await classifyMessage('Tell me a programming joke');

      // Should fall back to keyword classification
      expect(result.agentType).toBe('joke'); // Joke has higher priority than technical
      expect(result.reasoning).toContain('joke keywords');
    });
  });

  describe('Classification Consistency', () => {
    beforeEach(() => {
      delete process.env.OPENAI_API_KEY; // Use fallback for consistency testing
    });

    it('should return consistent results for similar messages', async () => {
      const similarMessages = [
        'Tell me a joke',
        'Share a joke with me',
        'I want to hear a joke',
      ];

      const results = await Promise.all(
        similarMessages.map(msg => classifyMessage(msg)),
      );

      results.forEach(result => {
        expect(result.agentType).toBe('joke');
        expect(result.confidence).toBeGreaterThan(0.6);
      });
    });

    it('should handle variations in phrasing', async () => {
      const variations = [
        'Show me a gif',
        'I need a gif',
        'Can you share a gif?',
        'Give me a gif please',
      ];

      const results = await Promise.all(
        variations.map(msg => classifyMessage(msg)),
      );

      results.forEach(result => {
        expect(result.agentType).toBe('gif');
        expect(result.confidence).toBeGreaterThan(0.7);
      });
    });
  });

  describe('Return Type Validation', () => {
    it('should always return a valid MessageClassification object', async () => {
      const testMessages = [
        'Tell me a joke',
        'Show me code',
        'Random message',
        '',
        '123',
        'Special characters: !@#$%^&*()',
      ];

      for (const message of testMessages) {
        const result = await classifyMessage(message);

        expect(result).toHaveProperty('agentType');
        expect(result).toHaveProperty('confidence');
        expect(result).toHaveProperty('reasoning');

        expect(typeof result.agentType).toBe('string');
        expect(typeof result.confidence).toBe('number');
        expect(typeof result.reasoning).toBe('string');

        expect(result.confidence).toBeGreaterThanOrEqual(0);
        expect(result.confidence).toBeLessThanOrEqual(1);

        // Validate agentType is one of the expected types
        const validAgentTypes: AgentType[] = [
          'general',
          'joke',
          'trivia',
          'gif',
          'website_support',
          'account_support',
          'billing_support',
          'operator_support',
          'hold_agent',
        ];
        expect(validAgentTypes).toContain(result.agentType);
      }
    });
  });

  describe('Performance', () => {
    it('should classify messages within reasonable time', async () => {
      delete process.env.OPENAI_API_KEY; // Use fast fallback

      const start = Date.now();
      await classifyMessage('Tell me a joke');
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100); // Should be very fast for fallback
    });

    it('should handle multiple concurrent classifications', async () => {
      delete process.env.OPENAI_API_KEY;

      const messages = Array(10)
        .fill(0)
        .map((_, i) => `Test message ${i}`);

      const start = Date.now();
      const results = await Promise.all(
        messages.map(msg => classifyMessage(msg)),
      );
      const duration = Date.now() - start;

      expect(results).toHaveLength(10);
      expect(duration).toBeLessThan(1000);
    });
  });
});

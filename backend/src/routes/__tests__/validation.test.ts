import request from 'supertest';
import express from 'express';
import validationRouter from '../validation';
import { responseValidator } from '../../validation/responseValidator';

// Mock the responseValidator
jest.mock('../../validation/responseValidator');

const mockResponseValidator = responseValidator as jest.Mocked<
  typeof responseValidator
>;

// Create Express app for testing
const app = express();
app.use(express.json());
app.use('/api/validation', validationRouter);

describe('Validation Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/validation/stats', () => {
    it('should return validation statistics successfully', async () => {
      const mockStats = {
        totalValidations: 100,
        averageScore: 0.82,
        validationRate: 0.85,
        issueBreakdown: {
          content_high: 5,
          technical_medium: 8,
          appropriateness_low: 3,
        },
      };

      mockResponseValidator.getValidationStats.mockReturnValue(mockStats);

      const response = await request(app).get('/api/validation/stats');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: mockStats,
      });
      expect(mockResponseValidator.getValidationStats).toHaveBeenCalled();
    });

    it('should return 500 when responseValidator throws error', async () => {
      mockResponseValidator.getValidationStats.mockImplementation(() => {
        throw new Error('System error');
      });

      const response = await request(app).get('/api/validation/stats');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        success: false,
        error: 'Failed to fetch validation statistics',
      });
    });
  });

  describe('GET /api/validation/logs', () => {
    const mockLogs = [
      {
        id: 'log-1',
        timestamp: new Date('2023-01-01'),
        agentType: 'joke' as const,
        userMessage: 'Tell me a joke',
        aiResponse: 'Test response 1',
        conversationId: 'conv-1',
        userId: 'user-1',
        isProactive: false,
        validationResult: {
          isValid: true,
          score: 0.9,
          issues: [],
          metrics: {
            responseLength: 100,
            sentenceCount: 2,
            readabilityScore: 0.8,
            technicalAccuracy: 0.9,
            appropriatenessScore: 0.9,
            coherenceScore: 0.8,
          },
        },
      },
      {
        id: 'log-2',
        timestamp: new Date('2023-01-02'),
        agentType: 'dnd_master' as const,
        userMessage: 'Start a campaign',
        aiResponse: 'Test response 2',
        conversationId: 'conv-2',
        userId: 'user-2',
        isProactive: false,
        validationResult: {
          isValid: false,
          score: 0.3,
          issues: [
            {
              type: 'content' as const,
              severity: 'high' as const,
              message: 'Invalid format',
              suggestion: 'Use proper format',
            },
          ],
          metrics: {
            responseLength: 50,
            sentenceCount: 1,
            readabilityScore: 0.3,
            technicalAccuracy: 0.4,
            appropriatenessScore: 0.5,
            coherenceScore: 0.3,
          },
        },
      },
      {
        id: 'log-3',
        timestamp: new Date('2023-01-03'),
        agentType: 'general' as const,
        userMessage: 'Help me',
        aiResponse: 'Test response 3',
        conversationId: 'conv-3',
        userId: 'user-3',
        isProactive: false,
        validationResult: {
          isValid: true,
          score: 0.8,
          issues: [],
          metrics: {
            responseLength: 80,
            sentenceCount: 2,
            readabilityScore: 0.7,
            technicalAccuracy: 0.8,
            appropriatenessScore: 0.8,
            coherenceScore: 0.7,
          },
        },
      },
    ];

    it('should return paginated validation logs successfully', async () => {
      mockResponseValidator.getValidationLogs.mockReturnValue(mockLogs);

      const response = await request(app).get('/api/validation/logs');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: {
          logs: mockLogs.map(log => ({
            ...log,
            timestamp: log.timestamp.toISOString(),
          })),
          total: 3,
          limit: 50,
          offset: 0,
        },
      });
      expect(mockResponseValidator.getValidationLogs).toHaveBeenCalled();
    });

    it('should handle custom limit and offset parameters', async () => {
      mockResponseValidator.getValidationLogs.mockReturnValue(mockLogs);

      const response = await request(app).get(
        '/api/validation/logs?limit=1&offset=1',
      );

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: {
          logs: [
            {
              ...mockLogs[1],
              timestamp: mockLogs[1].timestamp.toISOString(),
            },
          ],
          total: 3,
          limit: 1,
          offset: 1,
        },
      });
    });

    it('should return 500 when responseValidator throws error', async () => {
      mockResponseValidator.getValidationLogs.mockImplementation(() => {
        throw new Error('System error');
      });

      const response = await request(app).get('/api/validation/logs');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        success: false,
        error: 'Failed to fetch validation logs',
      });
    });
  });

  describe('GET /api/validation/logs/:agentType', () => {
    const mockLogs = [
      {
        id: 'log-1',
        timestamp: new Date('2023-01-01'),
        agentType: 'joke' as const,
        userMessage: 'Tell me a joke',
        aiResponse: 'Test joke response',
        conversationId: 'conv-1',
        userId: 'user-1',
        isProactive: false,
        validationResult: {
          isValid: true,
          score: 0.9,
          issues: [],
          metrics: {
            responseLength: 100,
            sentenceCount: 2,
            readabilityScore: 0.8,
            technicalAccuracy: 0.9,
            appropriatenessScore: 0.9,
            coherenceScore: 0.8,
          },
        },
      },
      {
        id: 'log-2',
        timestamp: new Date('2023-01-02'),
        agentType: 'dnd_master' as const,
        userMessage: 'Start a campaign',
        aiResponse: 'Test dnd response',
        conversationId: 'conv-2',
        userId: 'user-2',
        isProactive: false,
        validationResult: {
          isValid: false,
          score: 0.3,
          issues: [
            {
              type: 'content' as const,
              severity: 'high' as const,
              message: 'Invalid format',
              suggestion: 'Use proper format',
            },
          ],
          metrics: {
            responseLength: 50,
            sentenceCount: 1,
            readabilityScore: 0.3,
            technicalAccuracy: 0.4,
            appropriatenessScore: 0.5,
            coherenceScore: 0.3,
          },
        },
      },
      {
        id: 'log-3',
        timestamp: new Date('2023-01-03'),
        agentType: 'joke' as const,
        userMessage: 'Another joke please',
        aiResponse: 'Another joke response',
        conversationId: 'conv-3',
        userId: 'user-3',
        isProactive: false,
        validationResult: {
          isValid: true,
          score: 0.8,
          issues: [],
          metrics: {
            responseLength: 80,
            sentenceCount: 2,
            readabilityScore: 0.7,
            technicalAccuracy: 0.8,
            appropriatenessScore: 0.8,
            coherenceScore: 0.7,
          },
        },
      },
    ];

    it('should return filtered validation logs by agent type', async () => {
      mockResponseValidator.getValidationLogs.mockReturnValue(mockLogs);

      const response = await request(app).get('/api/validation/logs/joke');

      const expectedJokeLogs = mockLogs
        .filter(log => log.agentType === 'joke')
        .map(log => ({
          ...log,
          timestamp: log.timestamp.toISOString(),
        }));

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: {
          logs: expectedJokeLogs,
          total: 2,
          limit: 50,
          offset: 0,
          agentType: 'joke',
        },
      });
    });

    it('should handle pagination for filtered logs', async () => {
      mockResponseValidator.getValidationLogs.mockReturnValue(mockLogs);

      const response = await request(app).get(
        '/api/validation/logs/joke?limit=1&offset=0',
      );

      const expectedJokeLogs = mockLogs
        .filter(log => log.agentType === 'joke')
        .slice(0, 1)
        .map(log => ({
          ...log,
          timestamp: log.timestamp.toISOString(),
        }));

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: {
          logs: expectedJokeLogs,
          total: 2,
          limit: 1,
          offset: 0,
          agentType: 'joke',
        },
      });
    });

    it('should return empty array for non-existent agent type', async () => {
      mockResponseValidator.getValidationLogs.mockReturnValue(mockLogs);

      const response = await request(app).get(
        '/api/validation/logs/nonexistent',
      );

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: {
          logs: [],
          total: 0,
          limit: 50,
          offset: 0,
          agentType: 'nonexistent',
        },
      });
    });

    it('should return 500 when responseValidator throws error', async () => {
      mockResponseValidator.getValidationLogs.mockImplementation(() => {
        throw new Error('System error');
      });

      const response = await request(app).get('/api/validation/logs/joke');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        success: false,
        error: 'Failed to fetch validation logs',
      });
    });
  });

  describe('GET /api/validation/failed', () => {
    const mockLogs = [
      {
        id: 'log-1',
        timestamp: new Date('2023-01-01'),
        agentType: 'joke' as const,
        userMessage: 'Tell me a joke',
        aiResponse: 'Valid response',
        conversationId: 'conv-1',
        userId: 'user-1',
        isProactive: false,
        validationResult: {
          isValid: true,
          score: 0.9,
          issues: [],
          metrics: {
            responseLength: 100,
            sentenceCount: 2,
            readabilityScore: 0.8,
            technicalAccuracy: 0.9,
            appropriatenessScore: 0.9,
            coherenceScore: 0.8,
          },
        },
      },
      {
        id: 'log-2',
        timestamp: new Date('2023-01-02'),
        agentType: 'dnd_master' as const,
        userMessage: 'Start a campaign',
        aiResponse: 'Invalid response 1',
        conversationId: 'conv-2',
        userId: 'user-2',
        isProactive: false,
        validationResult: {
          isValid: false,
          score: 0.3,
          issues: [
            {
              type: 'content' as const,
              severity: 'high' as const,
              message: 'Invalid format',
              suggestion: 'Use proper format',
            },
          ],
          metrics: {
            responseLength: 50,
            sentenceCount: 1,
            readabilityScore: 0.3,
            technicalAccuracy: 0.4,
            appropriatenessScore: 0.5,
            coherenceScore: 0.3,
          },
        },
      },
      {
        id: 'log-3',
        timestamp: new Date('2023-01-03'),
        agentType: 'general' as const,
        userMessage: 'Help me',
        aiResponse: 'Invalid response 2',
        conversationId: 'conv-3',
        userId: 'user-3',
        isProactive: false,
        validationResult: {
          isValid: false,
          score: 0.4,
          issues: [
            {
              type: 'appropriateness' as const,
              severity: 'medium' as const,
              message: 'Poor quality',
              suggestion: 'Improve response quality',
            },
          ],
          metrics: {
            responseLength: 60,
            sentenceCount: 1,
            readabilityScore: 0.4,
            technicalAccuracy: 0.5,
            appropriatenessScore: 0.4,
            coherenceScore: 0.4,
          },
        },
      },
    ];

    it('should return only failed validations', async () => {
      mockResponseValidator.getValidationLogs.mockReturnValue(mockLogs);

      const response = await request(app).get('/api/validation/failed');

      const expectedFailedLogs = mockLogs
        .filter(log => !log.validationResult.isValid)
        .map(log => ({
          ...log,
          timestamp: log.timestamp.toISOString(),
        }));

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: {
          logs: expectedFailedLogs,
          total: 2,
          limit: 50,
          offset: 0,
        },
      });
    });

    it('should handle pagination for failed validations', async () => {
      mockResponseValidator.getValidationLogs.mockReturnValue(mockLogs);

      const response = await request(app).get(
        '/api/validation/failed?limit=1&offset=0',
      );

      const expectedFailedLogs = mockLogs
        .filter(log => !log.validationResult.isValid)
        .slice(0, 1)
        .map(log => ({
          ...log,
          timestamp: log.timestamp.toISOString(),
        }));

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: {
          logs: expectedFailedLogs,
          total: 2,
          limit: 1,
          offset: 0,
        },
      });
    });

    it('should return empty array when no failed validations exist', async () => {
      const validLogs = [
        {
          id: 'log-1',
          timestamp: new Date('2023-01-01'),
          agentType: 'joke' as const,
          userMessage: 'Tell me a joke',
          aiResponse: 'Valid response',
          conversationId: 'conv-1',
          userId: 'user-1',
          isProactive: false,
          validationResult: {
            isValid: true,
            score: 0.9,
            issues: [],
            metrics: {
              responseLength: 100,
              sentenceCount: 2,
              readabilityScore: 0.8,
              technicalAccuracy: 0.9,
              appropriatenessScore: 0.9,
              coherenceScore: 0.8,
            },
          },
        },
      ];

      mockResponseValidator.getValidationLogs.mockReturnValue(validLogs);

      const response = await request(app).get('/api/validation/failed');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: {
          logs: [],
          total: 0,
          limit: 50,
          offset: 0,
        },
      });
    });

    it('should return 500 when responseValidator throws error', async () => {
      mockResponseValidator.getValidationLogs.mockImplementation(() => {
        throw new Error('System error');
      });

      const response = await request(app).get('/api/validation/failed');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        success: false,
        error: 'Failed to fetch failed validations',
      });
    });
  });

  describe('GET /api/validation/summary', () => {
    const mockLogs = [
      {
        id: 'log-1',
        timestamp: new Date('2023-01-01'),
        agentType: 'joke' as const,
        userMessage: 'Tell me a joke',
        aiResponse: 'Valid joke response',
        conversationId: 'conv-1',
        userId: 'user-1',
        isProactive: false,
        validationResult: {
          isValid: true,
          score: 0.9,
          issues: [],
          metrics: {
            responseLength: 100,
            sentenceCount: 2,
            readabilityScore: 0.8,
            technicalAccuracy: 0.9,
            appropriatenessScore: 0.9,
            coherenceScore: 0.8,
          },
        },
      },
      {
        id: 'log-2',
        timestamp: new Date('2023-01-02'),
        agentType: 'joke' as const,
        userMessage: 'Another joke',
        aiResponse: 'Invalid joke response',
        conversationId: 'conv-2',
        userId: 'user-2',
        isProactive: false,
        validationResult: {
          isValid: false,
          score: 0.3,
          issues: [
            {
              type: 'content' as const,
              severity: 'high' as const,
              message: 'Invalid format',
              suggestion: 'Use proper format',
            },
            {
              type: 'appropriateness' as const,
              severity: 'medium' as const,
              message: 'Poor quality',
              suggestion: 'Improve quality',
            },
          ],
          metrics: {
            responseLength: 50,
            sentenceCount: 1,
            readabilityScore: 0.3,
            technicalAccuracy: 0.4,
            appropriatenessScore: 0.3,
            coherenceScore: 0.3,
          },
        },
      },
      {
        id: 'log-3',
        timestamp: new Date('2023-01-03'),
        agentType: 'dnd_master' as const,
        userMessage: 'Start a campaign',
        aiResponse: 'Valid dnd response',
        conversationId: 'conv-3',
        userId: 'user-3',
        isProactive: false,
        validationResult: {
          isValid: true,
          score: 0.8,
          issues: [
            {
              type: 'technical' as const,
              severity: 'low' as const,
              message: 'Minor issue',
              suggestion: 'Minor improvement',
            },
          ],
          metrics: {
            responseLength: 80,
            sentenceCount: 2,
            readabilityScore: 0.7,
            technicalAccuracy: 0.8,
            appropriatenessScore: 0.8,
            coherenceScore: 0.7,
          },
        },
      },
    ];

    it('should return validation summary by agent type', async () => {
      mockResponseValidator.getValidationLogs.mockReturnValue(mockLogs);

      const response = await request(app).get('/api/validation/summary');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: {
          joke: {
            total: 2,
            valid: 1,
            invalid: 1,
            averageScore: 0.6, // (0.9 + 0.3) / 2
            validationRate: 0.5, // 1 valid out of 2 total
            issues: {
              high: 1,
              medium: 1,
              low: 0,
            },
          },
          dnd_master: {
            total: 1,
            valid: 1,
            invalid: 0,
            averageScore: 0.8,
            validationRate: 1.0,
            issues: {
              high: 0,
              medium: 0,
              low: 1,
            },
          },
        },
      });
    });

    it('should handle empty logs', async () => {
      mockResponseValidator.getValidationLogs.mockReturnValue([]);

      const response = await request(app).get('/api/validation/summary');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: {},
      });
    });

    it('should return 500 when responseValidator throws error', async () => {
      mockResponseValidator.getValidationLogs.mockImplementation(() => {
        throw new Error('System error');
      });

      const response = await request(app).get('/api/validation/summary');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        success: false,
        error: 'Failed to generate validation summary',
      });
    });
  });

  describe('POST /api/validation/clear', () => {
    it('should clear validation logs successfully', async () => {
      mockResponseValidator.clearLogs.mockImplementation(() => {});

      const response = await request(app).post('/api/validation/clear');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        message: 'Validation logs cleared successfully',
      });
      expect(mockResponseValidator.clearLogs).toHaveBeenCalled();
    });

    it('should return 500 when responseValidator throws error', async () => {
      mockResponseValidator.clearLogs.mockImplementation(() => {
        throw new Error('System error');
      });

      const response = await request(app).post('/api/validation/clear');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        success: false,
        error: 'Failed to clear validation logs',
      });
    });
  });
});

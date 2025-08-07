import request from 'supertest';
import express from 'express';
import reactionsRouter from '../reactions';
import { jokeLearningSystem } from '../../agents/jokeLearningSystem';
import { UserReaction } from '../../agents/learningTypes';

// Mock the jokeLearningSystem
jest.mock('../../agents/jokeLearningSystem');

const mockJokeLearningSystem = jokeLearningSystem as jest.Mocked<typeof jokeLearningSystem>;

// Create Express app for testing
const app = express();
app.use(express.json());
app.use('/api/reactions', reactionsRouter);

describe('Reactions Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/reactions/record', () => {
    const validReaction = {
      messageId: 'msg-123',
      userId: 'user-456',
      reactionType: 'laugh',
      jokeType: 'pun',
      jokeCategory: 'wordplay',
    };

    it('should record a reaction successfully', async () => {
      mockJokeLearningSystem.recordReaction.mockImplementation(() => {});

      const response = await request(app)
        .post('/api/reactions/record')
        .send(validReaction);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        message: 'Reaction recorded successfully',
      });

      expect(mockJokeLearningSystem.recordReaction).toHaveBeenCalledWith(
        expect.objectContaining({
          messageId: 'msg-123',
          userId: 'user-456',
          reactionType: 'laugh',
          jokeType: 'pun',
          jokeCategory: 'wordplay',
          timestamp: expect.any(Date),
        })
      );
    });

    it('should return 400 when messageId is missing', async () => {
      const invalidReaction = {
        userId: validReaction.userId,
        reactionType: validReaction.reactionType,
        jokeType: validReaction.jokeType,
        jokeCategory: validReaction.jokeCategory,
      };

      const response = await request(app)
        .post('/api/reactions/record')
        .send(invalidReaction);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: 'Missing required fields: messageId, userId, reactionType',
      });

      expect(mockJokeLearningSystem.recordReaction).not.toHaveBeenCalled();
    });

    it('should return 400 when userId is missing', async () => {
      const invalidReaction = {
        messageId: validReaction.messageId,
        reactionType: validReaction.reactionType,
        jokeType: validReaction.jokeType,
        jokeCategory: validReaction.jokeCategory,
      };

      const response = await request(app)
        .post('/api/reactions/record')
        .send(invalidReaction);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: 'Missing required fields: messageId, userId, reactionType',
      });

      expect(mockJokeLearningSystem.recordReaction).not.toHaveBeenCalled();
    });

    it('should return 400 when reactionType is missing', async () => {
      const invalidReaction = {
        messageId: validReaction.messageId,
        userId: validReaction.userId,
        jokeType: validReaction.jokeType,
        jokeCategory: validReaction.jokeCategory,
      };

      const response = await request(app)
        .post('/api/reactions/record')
        .send(invalidReaction);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: 'Missing required fields: messageId, userId, reactionType',
      });

      expect(mockJokeLearningSystem.recordReaction).not.toHaveBeenCalled();
    });

    it('should return 400 when reactionType is invalid', async () => {
      const invalidReaction = {
        ...validReaction,
        reactionType: 'invalid',
      };

      const response = await request(app)
        .post('/api/reactions/record')
        .send(invalidReaction);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: 'Invalid reaction type. Must be one of: laugh, groan, love, meh, dislike',
      });

      expect(mockJokeLearningSystem.recordReaction).not.toHaveBeenCalled();
    });

    it('should accept all valid reaction types', async () => {
      const validReactionTypes = ['laugh', 'groan', 'love', 'meh', 'dislike'];

      for (const reactionType of validReactionTypes) {
        mockJokeLearningSystem.recordReaction.mockImplementation(() => {});

        const reaction = { ...validReaction, reactionType };
        const response = await request(app)
          .post('/api/reactions/record')
          .send(reaction);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      }
    });

    it('should handle optional fields correctly', async () => {
      const minimalReaction = {
        messageId: 'msg-123',
        userId: 'user-456',
        reactionType: 'laugh',
      };

      mockJokeLearningSystem.recordReaction.mockImplementation(() => {});

      const response = await request(app)
        .post('/api/reactions/record')
        .send(minimalReaction);

      expect(response.status).toBe(200);
      expect(mockJokeLearningSystem.recordReaction).toHaveBeenCalledWith(
        expect.objectContaining({
          messageId: 'msg-123',
          userId: 'user-456',
          reactionType: 'laugh',
          jokeType: undefined,
          jokeCategory: undefined,
          timestamp: expect.any(Date),
        })
      );
    });

    it('should return 500 when jokeLearningSystem throws error', async () => {
      mockJokeLearningSystem.recordReaction.mockImplementation(() => {
        throw new Error('System error');
      });

      const response = await request(app)
        .post('/api/reactions/record')
        .send(validReaction);

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        error: 'Internal server error',
      });
    });
  });

  describe('GET /api/reactions/profile/:userId', () => {
    const mockProfile = {
      userId: 'user-123',
      preferredCategories: ['puns', 'wordplay'],
      preferredTypes: ['pun', 'wordplay'],
      dislikedCategories: ['dark'],
      dislikedTypes: ['sarcasm'],
      humorStyle: 'clever' as const,
      reactionHistory: [],
      lastInteraction: new Date('2023-01-01'),
      totalJokesHeard: 50,
      averageReactionScore: 0.75,
    };

    it('should return user profile successfully', async () => {
      mockJokeLearningSystem.getUserProfile.mockReturnValue(mockProfile);

      const response = await request(app).get('/api/reactions/profile/user-123');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        userId: 'user-123',
        preferredCategories: ['puns', 'wordplay'],
        preferredTypes: ['pun', 'wordplay'],
        dislikedCategories: ['dark'],
        dislikedTypes: ['sarcasm'],
        humorStyle: 'clever',
        reactionHistory: [],
        lastInteraction: '2023-01-01T00:00:00.000Z',
        totalJokesHeard: 50,
        averageReactionScore: 0.75,
      });
      expect(mockJokeLearningSystem.getUserProfile).toHaveBeenCalledWith('user-123');
    });

    it('should return 404 when user profile not found', async () => {
      mockJokeLearningSystem.getUserProfile.mockReturnValue(null);

      const response = await request(app).get('/api/reactions/profile/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        error: 'User profile not found',
      });
    });

    it('should return 500 when jokeLearningSystem throws error', async () => {
      mockJokeLearningSystem.getUserProfile.mockImplementation(() => {
        throw new Error('System error');
      });

      const response = await request(app).get('/api/reactions/profile/user-123');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        error: 'Internal server error',
      });
    });
  });

  describe('GET /api/reactions/metrics', () => {
    it('should return learning metrics successfully', async () => {
      const mockMetrics = {
        totalJokesGenerated: 500,
        totalReactions: 1000,
        overallSuccessRate: 0.75,
        categoryPerformance: new Map([
          ['puns', 0.8],
          ['wordplay', 0.9],
        ]),
        userSatisfactionTrend: [0.7, 0.72, 0.75, 0.78, 0.8],
        adaptationAccuracy: 0.85,
      };

      mockJokeLearningSystem.getLearningMetrics.mockReturnValue(mockMetrics);

      const response = await request(app).get('/api/reactions/metrics');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        totalJokesGenerated: 500,
        totalReactions: 1000,
        overallSuccessRate: 0.75,
        categoryPerformance: {
          puns: 0.8,
          wordplay: 0.9,
        },
        userSatisfactionTrend: [0.7, 0.72, 0.75, 0.78, 0.8],
        adaptationAccuracy: 0.85,
      });
    });

    it('should return 500 when jokeLearningSystem throws error', async () => {
      mockJokeLearningSystem.getLearningMetrics.mockImplementation(() => {
        throw new Error('System error');
      });

      const response = await request(app).get('/api/reactions/metrics');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        error: 'Internal server error',
      });
    });
  });

  describe('GET /api/reactions/categories', () => {
    it('should return joke categories successfully', async () => {
      const mockCategories = [
        {
          name: 'dad_jokes',
          description: 'Classic groan-worthy puns and wordplay',
          examples: ["Why don't scientists trust atoms? Because they make up everything!"],
          difficulty: 'easy' as const,
          appropriateness: 'family' as const,
        },
        {
          name: 'wordplay',
          description: 'Clever puns and linguistic humor',
          examples: ['I used to be a banker, but I lost interest.'],
          difficulty: 'medium' as const,
          appropriateness: 'family' as const,
        },
      ];

      mockJokeLearningSystem.getJokeCategories.mockReturnValue(mockCategories);

      const response = await request(app).get('/api/reactions/categories');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockCategories);
      expect(mockJokeLearningSystem.getJokeCategories).toHaveBeenCalled();
    });

    it('should return 500 when jokeLearningSystem throws error', async () => {
      mockJokeLearningSystem.getJokeCategories.mockImplementation(() => {
        throw new Error('System error');
      });

      const response = await request(app).get('/api/reactions/categories');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        error: 'Internal server error',
      });
    });
  });

  describe('GET /api/reactions/recommendation/:userId', () => {
    it('should return personalized joke recommendation successfully', async () => {
      const mockRecommendation = {
        category: 'dad_jokes',
        type: 'pun',
        style: 'clever',
        avoidCategories: ['dark', 'sarcastic'],
      };

      mockJokeLearningSystem.getPersonalizedJokeRecommendation.mockReturnValue(mockRecommendation);

      const response = await request(app).get('/api/reactions/recommendation/user-123');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockRecommendation);
      expect(mockJokeLearningSystem.getPersonalizedJokeRecommendation).toHaveBeenCalledWith('user-123');
    });

    it('should return 500 when jokeLearningSystem throws error', async () => {
      mockJokeLearningSystem.getPersonalizedJokeRecommendation.mockImplementation(() => {
        throw new Error('System error');
      });

      const response = await request(app).get('/api/reactions/recommendation/user-123');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        error: 'Internal server error',
      });
    });
  });
});

import request from 'supertest';
import express from 'express';
import conversationsRouter from '../conversations';
import { storage } from '../../storage/memoryStorage';

// Mock dependencies
jest.mock('../../storage/memoryStorage');

const mockStorage = storage as jest.Mocked<typeof storage>;

// Create Express app for testing
const app = express();
app.use(express.json());
app.use('/api/conversations', conversationsRouter);

describe('Conversations Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockConversation = {
    id: 'conv-123',
    title: 'Test Conversation',
    messages: [
      {
        id: 'msg-1',
        content: 'Hello',
        role: 'user' as const,
        timestamp: new Date('2023-01-01'),
        conversationId: 'conv-123',
      },
      {
        id: 'msg-2',
        content: 'Hi there!',
        role: 'assistant' as const,
        timestamp: new Date('2023-01-01'),
        conversationId: 'conv-123',
        agentUsed: 'general' as const,
        confidence: 0.8,
      },
    ],
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-01'),
  };

  describe('GET /api/conversations', () => {
    it('should return all conversations with last message only', async () => {
      const conversations = [mockConversation];
      mockStorage.getSortedConversations.mockReturnValue(conversations);

      const response = await request(app).get('/api/conversations');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toMatchObject({
        id: 'conv-123',
        title: 'Test Conversation',
        messages: expect.arrayContaining([
          expect.objectContaining({
            id: 'msg-2',
            content: 'Hi there!',
            role: 'assistant',
            timestamp: expect.any(String),
            conversationId: 'conv-123',
            agentUsed: 'general',
            confidence: 0.8,
          }),
        ]),
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });

      // Should only have last message
      expect(response.body[0].messages).toHaveLength(1);
      expect(mockStorage.getSortedConversations).toHaveBeenCalled();
    });

    it('should handle empty conversations list', async () => {
      mockStorage.getSortedConversations.mockReturnValue([]);

      const response = await request(app).get('/api/conversations');

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('should return 500 when storage throws error', async () => {
      mockStorage.getSortedConversations.mockImplementation(() => {
        throw new Error('Storage error');
      });

      const response = await request(app).get('/api/conversations');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        message: 'Internal server error',
        code: 'INTERNAL_ERROR',
      });
    });
  });

  describe('GET /api/conversations/:id', () => {
    it('should return specific conversation with all messages', async () => {
      mockStorage.getConversation.mockReturnValue(mockConversation);

      const response = await request(app).get('/api/conversations/conv-123');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: 'conv-123',
        title: 'Test Conversation',
        messages: expect.arrayContaining([
          expect.objectContaining({ id: 'msg-1' }),
          expect.objectContaining({ id: 'msg-2' }),
        ]),
      });

      expect(mockStorage.getConversation).toHaveBeenCalledWith('conv-123');
    });

    it('should return 404 when conversation not found', async () => {
      mockStorage.getConversation.mockReturnValue(undefined);

      const response = await request(app).get('/api/conversations/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        message: 'Conversation not found',
        code: 'CONVERSATION_NOT_FOUND',
      });
    });

    it('should return 500 when storage throws error', async () => {
      mockStorage.getConversation.mockImplementation(() => {
        throw new Error('Storage error');
      });

      const response = await request(app).get('/api/conversations/conv-123');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        message: 'Internal server error',
        code: 'INTERNAL_ERROR',
      });
    });
  });

  describe('POST /api/conversations', () => {
    it('should create new conversation with valid title', async () => {
      mockStorage.addConversation.mockImplementation(conv => {
        return conv;
      });

      const response = await request(app).post('/api/conversations').send({
        title: 'New Conversation',
      });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        id: expect.any(String),
        title: 'New Conversation',
        messages: [],
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });

      expect(mockStorage.addConversation).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.any(String),
          title: 'New Conversation',
          messages: [],
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        }),
      );
    });

    it('should trim whitespace from title', async () => {
      mockStorage.addConversation.mockImplementation(conv => conv);

      const response = await request(app).post('/api/conversations').send({
        title: '  Trimmed Title  ',
      });

      expect(response.status).toBe(201);
      expect(response.body.title).toBe('Trimmed Title');

      expect(mockStorage.addConversation).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Trimmed Title',
        }),
      );
    });

    it('should return 400 when title is empty', async () => {
      const response = await request(app).post('/api/conversations').send({
        title: '',
      });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        message: 'Title is required',
        code: 'INVALID_REQUEST',
      });

      expect(mockStorage.addConversation).not.toHaveBeenCalled();
    });

    it('should return 400 when title is whitespace only', async () => {
      const response = await request(app).post('/api/conversations').send({
        title: '   \n\t   ',
      });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        message: 'Title is required',
        code: 'INVALID_REQUEST',
      });
    });

    it('should return 500 when storage throws error', async () => {
      mockStorage.addConversation.mockImplementation(() => {
        throw new Error('Storage error');
      });

      const response = await request(app).post('/api/conversations').send({
        title: 'Valid Title',
      });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        message: 'Internal server error',
        code: 'INTERNAL_ERROR',
      });
    });
  });

  describe('PUT /api/conversations/:id', () => {
    it('should update conversation title', async () => {
      const updatedConversation = {
        ...mockConversation,
        title: 'Updated Title',
        updatedAt: new Date('2023-01-02'),
      };

      mockStorage.updateConversation.mockReturnValue(updatedConversation);

      const response = await request(app)
        .put('/api/conversations/conv-123')
        .send({
          title: 'Updated Title',
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: 'conv-123',
        title: 'Updated Title',
        updatedAt: expect.any(String),
      });

      expect(mockStorage.updateConversation).toHaveBeenCalledWith(
        'conv-123',
        expect.objectContaining({
          title: 'Updated Title',
          updatedAt: expect.any(Date),
        }),
      );
    });

    it('should trim whitespace from updated title', async () => {
      const updatedConversation = {
        ...mockConversation,
        title: 'Trimmed Update',
        updatedAt: new Date('2023-01-02'),
      };

      mockStorage.updateConversation.mockReturnValue(updatedConversation);

      const response = await request(app)
        .put('/api/conversations/conv-123')
        .send({
          title: '  Trimmed Update  ',
        });

      expect(response.status).toBe(200);
      expect(response.body.title).toBe('Trimmed Update');

      expect(mockStorage.updateConversation).toHaveBeenCalledWith(
        'conv-123',
        expect.objectContaining({
          title: 'Trimmed Update',
        }),
      );
    });

    it('should return 400 when title is empty', async () => {
      const response = await request(app)
        .put('/api/conversations/conv-123')
        .send({
          title: '',
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        message: 'Title is required',
        code: 'INVALID_REQUEST',
      });

      expect(mockStorage.updateConversation).not.toHaveBeenCalled();
    });

    it('should return 404 when conversation not found', async () => {
      mockStorage.updateConversation.mockReturnValue(null);

      const response = await request(app)
        .put('/api/conversations/nonexistent')
        .send({
          title: 'Valid Title',
        });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        message: 'Conversation not found',
        code: 'CONVERSATION_NOT_FOUND',
      });
    });

    it('should return 500 when storage throws error', async () => {
      mockStorage.updateConversation.mockImplementation(() => {
        throw new Error('Storage error');
      });

      const response = await request(app)
        .put('/api/conversations/conv-123')
        .send({
          title: 'Valid Title',
        });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        message: 'Internal server error',
        code: 'INTERNAL_ERROR',
      });
    });
  });

  describe('DELETE /api/conversations/:id', () => {
    it('should delete conversation successfully', async () => {
      mockStorage.deleteConversation.mockReturnValue(true);

      const response = await request(app).delete('/api/conversations/conv-123');

      expect(response.status).toBe(204);
      expect(response.body).toEqual({});

      expect(mockStorage.deleteConversation).toHaveBeenCalledWith('conv-123');
    });

    it('should return 404 when conversation not found', async () => {
      mockStorage.deleteConversation.mockReturnValue(false);

      const response = await request(app).delete(
        '/api/conversations/nonexistent',
      );

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        message: 'Conversation not found',
        code: 'CONVERSATION_NOT_FOUND',
      });
    });

    it('should return 500 when storage throws error', async () => {
      mockStorage.deleteConversation.mockImplementation(() => {
        throw new Error('Storage error');
      });

      const response = await request(app).delete('/api/conversations/conv-123');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        message: 'Internal server error',
        code: 'INTERNAL_ERROR',
      });
    });
  });
});

import request from 'supertest';
import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import chatRouter from '../chat';
import { storage } from '../../storage/memoryStorage';
import { agentService } from '../../agents/agentService';

// Mock dependencies
jest.mock('../../storage/memoryStorage');
jest.mock('../../agents/agentService');
jest.mock('../../tracing/tracer');

const mockStorage = storage as jest.Mocked<typeof storage>;
const mockAgentService = agentService as jest.Mocked<typeof agentService>;

// Create Express app for testing
const app = express();
app.use(express.json());
app.use('/api/chat', chatRouter);

describe('Chat Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset storage mock
    mockStorage.getConversation = jest.fn();
    mockStorage.addConversation = jest.fn();
    mockStorage.getSortedConversations = jest.fn();
  });

  describe('POST /api/chat', () => {
    const mockConversation = {
      id: 'conv-123',
      title: 'Test conversation',
      messages: [],
      createdAt: new Date('2023-01-01'),
      updatedAt: new Date('2023-01-01'),
    };

    const mockAgentResponse = {
      content: 'Hello! This is a test response.',
      agentUsed: 'joke' as const,
      confidence: 0.9,
    };

    beforeEach(() => {
      mockAgentService.processMessage.mockResolvedValue(mockAgentResponse);
    });

    it('should create a new conversation and process message', async () => {
      mockStorage.getConversation.mockReturnValue(undefined);
      let capturedConversation: any;
      mockStorage.addConversation.mockImplementation((conv) => {
        // Capture a deep copy of the conversation at the time it's stored
        capturedConversation = JSON.parse(JSON.stringify(conv));
        return conv;
      });

      const response = await request(app)
        .post('/api/chat')
        .send({
          message: 'Tell me a joke',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('conversation');
      expect(response.body).toHaveProperty('agentUsed', 'joke');
      expect(response.body).toHaveProperty('confidence', 0.9);

      // Verify conversation was created with empty messages initially
      expect(capturedConversation).toMatchObject({
        id: expect.any(String),
        title: 'Tell me a joke',
        messages: [],
        createdAt: expect.any(String), // JSON.stringify converts Date to string
        updatedAt: expect.any(String), // JSON.stringify converts Date to string
      });

      // Verify storage was called to add conversation
      expect(mockStorage.addConversation).toHaveBeenCalled();

      // Verify agent service was called with empty array (no previous messages)
      expect(mockAgentService.processMessage).toHaveBeenCalledWith(
        'Tell me a joke',
        [],
        undefined
      );
    });

    it('should use existing conversation when conversationId provided', async () => {
      const existingMessages = [
        {
          id: 'msg-1',
          content: 'Previous message',
          role: 'user' as const,
          timestamp: new Date(),
          conversationId: 'conv-123',
        },
      ];

      const conversationWithMessages = {
        ...mockConversation,
        messages: [...existingMessages], // Create a copy to avoid mutation issues
      };

      mockStorage.getConversation.mockReturnValue(conversationWithMessages);

      const response = await request(app)
        .post('/api/chat')
        .send({
          message: 'Another message',
          conversationId: 'conv-123',
        });

      expect(response.status).toBe(200);
      expect(mockStorage.getConversation).toHaveBeenCalledWith('conv-123');
      expect(mockStorage.addConversation).not.toHaveBeenCalled();

      // Verify agent service was called with previous messages (the code calls slice(0, -1) to exclude the just-added user message)
      expect(mockAgentService.processMessage).toHaveBeenCalledWith(
        'Another message',
        existingMessages,
        undefined
      );
    });

    it('should handle forceAgent parameter', async () => {
      mockStorage.getConversation.mockReturnValue(undefined);
      mockStorage.addConversation.mockImplementation((conv) => conv);

      const response = await request(app)
        .post('/api/chat')
        .send({
          message: 'Tell me a joke',
          forceAgent: 'trivia',
        });

      expect(response.status).toBe(200);
      expect(mockAgentService.processMessage).toHaveBeenCalledWith(
        'Tell me a joke',
        [],
        'trivia'
      );
    });

    it('should return 400 when message is empty', async () => {
      const response = await request(app)
        .post('/api/chat')
        .send({
          message: '',
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        message: 'Message is required',
        code: 'INVALID_REQUEST',
      });

      expect(mockAgentService.processMessage).not.toHaveBeenCalled();
    });

    it('should return 400 when message is whitespace only', async () => {
      const response = await request(app)
        .post('/api/chat')
        .send({
          message: '   \n\t   ',
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        message: 'Message is required',
        code: 'INVALID_REQUEST',
      });
    });

    it('should return 404 when conversationId not found', async () => {
      mockStorage.getConversation.mockReturnValue(undefined);

      const response = await request(app)
        .post('/api/chat')
        .send({
          message: 'Hello',
          conversationId: 'nonexistent-id',
        });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        message: 'Conversation not found',
        code: 'CONVERSATION_NOT_FOUND',
      });

      expect(mockAgentService.processMessage).not.toHaveBeenCalled();
    });

    it('should return 500 when agent service throws error', async () => {
      mockStorage.getConversation.mockReturnValue(undefined);
      mockStorage.addConversation.mockImplementation((conv) => conv);
      mockAgentService.processMessage.mockRejectedValue(
        new Error('Agent service error')
      );

      const response = await request(app)
        .post('/api/chat')
        .send({
          message: 'Hello',
        });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        message: 'Internal server error',
        code: 'INTERNAL_ERROR',
      });
    });

    it('should generate proper conversation title', async () => {
      mockStorage.getConversation.mockReturnValue(undefined);
      let capturedConversation: any;
      mockStorage.addConversation.mockImplementation((conv) => {
        capturedConversation = conv;
        return conv;
      });

      // Test with short message
      await request(app)
        .post('/api/chat')
        .send({
          message: 'Hello there',
        });

      expect(capturedConversation.title).toBe('Hello there');

      // Test with long message
      await request(app)
        .post('/api/chat')
        .send({
          message: 'This is a very long message that should be truncated after six words',
        });

      expect(capturedConversation.title).toBe('This is a very long message...');
    });
  });

  describe('GET /api/chat/agents', () => {
    it('should return available agents', async () => {
      const mockAgents = [
        { id: 'joke-agent', name: 'joke', description: 'Joke agent' },
        { id: 'trivia-agent', name: 'trivia', description: 'Trivia agent' },
        { id: 'gif-agent', name: 'gif', description: 'GIF agent' },
      ];

      mockAgentService.getAvailableAgents.mockReturnValue(mockAgents);

      const response = await request(app).get('/api/chat/agents');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockAgents);
      expect(mockAgentService.getAvailableAgents).toHaveBeenCalled();
    });

    it('should return 500 when agent service throws error', async () => {
      mockAgentService.getAvailableAgents.mockImplementation(() => {
        throw new Error('Service unavailable');
      });

      const response = await request(app).get('/api/chat/agents');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        message: 'Internal server error',
        code: 'INTERNAL_ERROR',
      });
    });
  });
});

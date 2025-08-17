import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { ChatRequest, ChatResponse, Message, Conversation } from '../types';
import { storage } from '../storage/memoryStorage';
import { agentService } from '../agents/agentService';
import {
  tracer,
  createConversationSpan,
  endSpan,
  setSpanStatus,
  addSpanEvent,
} from '../tracing/tracer';

const router = express.Router();

// Helper function to generate conversation title
const generateConversationTitle = (message: string): string => {
  const words = message.split(' ').slice(0, 6);
  return (
    words.join(' ') + (words.length < message.split(' ').length ? '...' : '')
  );
};

// POST /api/chat - Send message to AI
/**
 * @openapi
 * /api/chat:
 *   post:
 *     tags: [chat]
 *     summary: Send a message to the AI and receive a response
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ChatRequest'
 *     responses:
 *       '200':
 *         description: Chat response
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ChatResponse'
 *       '400':
 *         description: Invalid request
 *       '404':
 *         description: Conversation not found
 *       '500':
 *         description: Internal server error
 */
router.post('/', async (req, res) => {
  const span = createConversationSpan('chat-new', 'process_message');

  try {
    const { message, conversationId, forceAgent }: ChatRequest = req.body;

    addSpanEvent(span, 'chat.request_received', {
      hasMessage: !!message,
      hasConversationId: !!conversationId,
      forceAgent: forceAgent,
    });

    if (!message || message.trim() === '') {
      setSpanStatus(span, false, 'Invalid request - message required');
      endSpan(span);
      return res.status(400).json({
        message: 'Message is required',
        code: 'INVALID_REQUEST',
      });
    }

    // Find or create conversation
    let conversation: Conversation;
    if (conversationId) {
      const foundConversation = storage.getConversation(conversationId);
      if (!foundConversation) {
        setSpanStatus(span, false, 'Conversation not found');
        endSpan(span);
        return res.status(404).json({
          message: 'Conversation not found',
          code: 'CONVERSATION_NOT_FOUND',
        });
      }
      conversation = foundConversation;
      addSpanEvent(span, 'conversation.found', { conversationId });
    } else {
      // Create new conversation
      conversation = {
        id: uuidv4(),
        title: generateConversationTitle(message),
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      storage.addConversation(conversation);
      addSpanEvent(span, 'conversation.created', {
        conversationId: conversation.id,
      });
    }

    span.setAttributes({
      'conversation.id': conversation.id,
      'conversation.message_count': conversation.messages.length,
      'user.message': message.substring(0, 100), // First 100 chars for debugging
    });

    // Add user message
    const userMessage: Message = {
      id: uuidv4(),
      content: message,
      role: 'user',
      timestamp: new Date(),
      conversationId: conversation.id,
    };
    conversation.messages.push(userMessage);
    addSpanEvent(span, 'user_message.added', { messageId: userMessage.id });

    // Process message with agent service
    addSpanEvent(span, 'agent.processing_start');
    const agentResponse = await agentService.processMessage(
      message,
      conversation.messages.slice(0, -1), // Exclude the user message we just added
      forceAgent,
    );
    addSpanEvent(span, 'agent.processing_complete', {
      agentUsed: agentResponse.agentUsed,
      confidence: agentResponse.confidence,
    });

    // Add AI response
    const aiMessage: Message = {
      id: uuidv4(),
      content: agentResponse.content,
      role: 'assistant',
      timestamp: new Date(),
      conversationId: conversation.id,
      agentUsed: agentResponse.agentUsed,
      confidence: agentResponse.confidence,
    };
    conversation.messages.push(aiMessage);
    conversation.updatedAt = new Date();

    const response: ChatResponse = {
      message: aiMessage,
      conversation: conversation,
      agentUsed: agentResponse.agentUsed,
      confidence: agentResponse.confidence,
    };

    span.setAttributes({
      'response.agent_used': agentResponse.agentUsed,
      'response.confidence': agentResponse.confidence,
      'response.length': agentResponse.content.length,
    });

    setSpanStatus(span, true);
    endSpan(span);
    return res.json(response);
  } catch (error) {
    console.error('Chat error:', error);
    setSpanStatus(
      span,
      false,
      error instanceof Error ? error.message : 'Unknown error',
    );
    endSpan(span);
    return res.status(500).json({
      message: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
});

// GET /api/chat/agents - Get available agents
/**
 * @openapi
 * /api/chat/agents:
 *   get:
 *     tags: [chat]
 *     summary: Get available agents
 *     responses:
 *       '200':
 *         description: List of agents
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: string
 *       '500':
 *         description: Internal server error
 */
router.get('/agents', (req, res) => {
  try {
    const agents = agentService.getAvailableAgents();
    return res.json(agents);
  } catch (error) {
    console.error('Get agents error:', error);
    return res.status(500).json({
      message: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
});

export default router;

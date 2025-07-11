import express from 'express';
import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';
import { ChatRequest, ChatResponse, Message, Conversation } from '../types';
import { storage } from '../storage/memoryStorage';

const router = express.Router();

// Initialize OpenAI client (only if API key is provided)
const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
}) : null;

// Helper function to generate conversation title
const generateConversationTitle = (message: string): string => {
  const words = message.split(' ').slice(0, 6);
  return words.join(' ') + (words.length < message.split(' ').length ? '...' : '');
};

// POST /api/chat - Send message to AI
router.post('/', async (req, res) => {
  try {
    const { message, conversationId }: ChatRequest = req.body;

    if (!message || message.trim() === '') {
      return res.status(400).json({
        message: 'Message is required',
        code: 'INVALID_REQUEST'
      });
    }

    // Find or create conversation
    let conversation: Conversation;
    if (conversationId) {
      const foundConversation = storage.getConversation(conversationId);
      if (!foundConversation) {
        return res.status(404).json({
          message: 'Conversation not found',
          code: 'CONVERSATION_NOT_FOUND'
        });
      }
      conversation = foundConversation;
    } else {
      // Create new conversation
      conversation = {
        id: uuidv4(),
        title: generateConversationTitle(message),
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };
      storage.addConversation(conversation);
    }

    // Add user message
    const userMessage: Message = {
      id: uuidv4(),
      content: message,
      role: 'user',
      timestamp: new Date(),
      conversationId: conversation.id
    };
    conversation.messages.push(userMessage);

    // Prepare messages for OpenAI
    const openAIMessages = conversation.messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    // Call OpenAI API
    let aiResponse: string;
    try {
      if (!process.env.OPENAI_API_KEY || !openai) {
        // Demo response when no API key is provided
        aiResponse = `This is a demo response to: "${message}". To get real AI responses, please set your OPENAI_API_KEY environment variable.`;
      } else {
        const completion = await openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: openAIMessages,
          max_tokens: 1000,
          temperature: 0.7,
        });

        aiResponse = completion.choices[0]?.message?.content || 'I apologize, but I could not generate a response.';
      }
    } catch (error) {
      console.error('OpenAI API error:', error);
      aiResponse = 'I apologize, but I encountered an error while processing your request. Please try again.';
    }

    // Add AI response
    const aiMessage: Message = {
      id: uuidv4(),
      content: aiResponse,
      role: 'assistant',
      timestamp: new Date(),
      conversationId: conversation.id
    };
    conversation.messages.push(aiMessage);
    conversation.updatedAt = new Date();

    const response: ChatResponse = {
      message: aiMessage,
      conversation: conversation
    };

    return res.json(response);
  } catch (error) {
    console.error('Chat error:', error);
    return res.status(500).json({
      message: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

export default router;

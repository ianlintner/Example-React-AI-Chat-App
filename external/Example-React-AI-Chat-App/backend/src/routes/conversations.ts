import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Conversation } from '../types';
import { storage } from '../storage/memoryStorage';

const router = express.Router();

// GET /api/conversations - Get all conversations
router.get('/', (req, res) => {
  try {
    const sortedConversations = storage.getSortedConversations().map(conv => ({
      ...conv,
      messages: conv.messages.slice(-1), // Only include the last message for the list view
    }));

    return res.json(sortedConversations);
  } catch (error) {
    console.error('Get conversations error:', error);
    return res.status(500).json({
      message: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
});

// GET /api/conversations/:id - Get a specific conversation
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const conversation = storage.getConversation(id);

    if (!conversation) {
      return res.status(404).json({
        message: 'Conversation not found',
        code: 'CONVERSATION_NOT_FOUND',
      });
    }

    return res.json(conversation);
  } catch (error) {
    console.error('Get conversation error:', error);
    return res.status(500).json({
      message: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
});

// POST /api/conversations - Create a new conversation
router.post('/', (req, res) => {
  try {
    const { title } = req.body;

    if (!title || title.trim() === '') {
      return res.status(400).json({
        message: 'Title is required',
        code: 'INVALID_REQUEST',
      });
    }

    const newConversation: Conversation = {
      id: uuidv4(),
      title: title.trim(),
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    storage.addConversation(newConversation);
    return res.status(201).json(newConversation);
  } catch (error) {
    console.error('Create conversation error:', error);
    return res.status(500).json({
      message: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
});

// PUT /api/conversations/:id - Update a conversation
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { title } = req.body;

    if (!title || title.trim() === '') {
      return res.status(400).json({
        message: 'Title is required',
        code: 'INVALID_REQUEST',
      });
    }

    const updatedConversation = storage.updateConversation(id, {
      title: title.trim(),
      updatedAt: new Date(),
    });

    if (!updatedConversation) {
      return res.status(404).json({
        message: 'Conversation not found',
        code: 'CONVERSATION_NOT_FOUND',
      });
    }

    return res.json(updatedConversation);
  } catch (error) {
    console.error('Update conversation error:', error);
    return res.status(500).json({
      message: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
});

// DELETE /api/conversations/:id - Delete a conversation
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const deleted = storage.deleteConversation(id);

    if (!deleted) {
      return res.status(404).json({
        message: 'Conversation not found',
        code: 'CONVERSATION_NOT_FOUND',
      });
    }

    return res.status(204).send();
  } catch (error) {
    console.error('Delete conversation error:', error);
    return res.status(500).json({
      message: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
});

export default router;

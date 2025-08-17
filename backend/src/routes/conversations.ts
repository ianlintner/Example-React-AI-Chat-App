import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Conversation } from '../types';
import { storage } from '../storage/memoryStorage';

const router = express.Router();

// GET /api/conversations - Get all conversations
/**
 * @openapi
 * /api/conversations:
 *   get:
 *     tags: [conversations]
 *     summary: Get all conversations (last message only for list view)
 *     responses:
 *       '200':
 *         description: List of conversations with last message
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Conversation'
 *       '500':
 *         description: Internal server error
 */
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
/**
 * @openapi
 * /api/conversations/{id}:
 *   get:
 *     tags: [conversations]
 *     summary: Get a conversation by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Conversation found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Conversation'
 *       '404':
 *         description: Conversation not found
 *       '500':
 *         description: Internal server error
 */
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
/**
 * @openapi
 * /api/conversations:
 *   post:
 *     tags: [conversations]
 *     summary: Create a new conversation
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *     responses:
 *       '201':
 *         description: Conversation created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Conversation'
 *       '400':
 *         description: Invalid request
 *       '500':
 *         description: Internal server error
 */
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
/**
 * @openapi
 * /api/conversations/{id}:
 *   put:
 *     tags: [conversations]
 *     summary: Update a conversation title
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *     responses:
 *       '200':
 *         description: Conversation updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Conversation'
 *       '400':
 *         description: Invalid request
 *       '404':
 *         description: Conversation not found
 *       '500':
 *         description: Internal server error
 */
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
/**
 * @openapi
 * /api/conversations/{id}:
 *   delete:
 *     tags: [conversations]
 *     summary: Delete a conversation
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '204':
 *         description: Conversation deleted
 *       '404':
 *         description: Conversation not found
 *       '500':
 *         description: Internal server error
 */
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

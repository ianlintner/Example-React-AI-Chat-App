import express from 'express';
import { getQueueService } from '../messageQueue/queueService';
import { QUEUE_NAMES } from '../messageQueue/messageQueue';

const router = express.Router();

/**
 * @swagger
 * /api/queue/stats:
 *   get:
 *     summary: Get message queue statistics
 *     description: Retrieve statistics for all queues or a specific queue
 *     tags: [Message Queue]
 *     parameters:
 *       - in: query
 *         name: queueName
 *         schema:
 *           type: string
 *         description: Optional queue name to get stats for specific queue
 *     responses:
 *       200:
 *         description: Queue statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalMessages:
 *                   type: number
 *                 pendingMessages:
 *                   type: number
 *                 processingMessages:
 *                   type: number
 *                 completedMessages:
 *                   type: number
 *                 failedMessages:
 *                   type: number
 *                 avgProcessingTime:
 *                   type: number
 *                 queues:
 *                   type: array
 *                   items:
 *                     type: string
 *       500:
 *         description: Server error
 */
router.get('/stats', async (req, res) => {
  try {
    const queueService = getQueueService();
    if (!queueService) {
      return res.status(503).json({ error: 'Queue service not initialized' });
    }

    const queueName = req.query.queueName as string;
    const stats = await queueService.getQueueStats(queueName);
    
    return res.json({
      ...stats,
      provider: queueService.getProviderType(),
      healthy: await queueService.isHealthy()
    });
  } catch (error) {
    console.error('Error getting queue stats:', error);
    return res.status(500).json({ error: 'Failed to get queue statistics' });
  }
});

/**
 * @swagger
 * /api/queue/health:
 *   get:
 *     summary: Check message queue health
 *     description: Health check endpoint for the message queue system
 *     tags: [Message Queue]
 *     responses:
 *       200:
 *         description: Queue health status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 healthy:
 *                   type: boolean
 *                 provider:
 *                   type: string
 *                 timestamp:
 *                   type: string
 *       503:
 *         description: Queue service unavailable
 */
router.get('/health', async (req, res) => {
  try {
    const queueService = getQueueService();
    if (!queueService) {
      return res.status(503).json({ 
        healthy: false, 
        error: 'Queue service not initialized',
        timestamp: new Date().toISOString()
      });
    }

    const healthy = await queueService.isHealthy();
    const statusCode = healthy ? 200 : 503;
    
    return res.status(statusCode).json({
      healthy,
      provider: queueService.getProviderType(),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error checking queue health:', error);
    return res.status(503).json({ 
      healthy: false, 
      error: 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @swagger
 * /api/queue/size/{queueName}:
 *   get:
 *     summary: Get queue size
 *     description: Get the number of pending messages in a specific queue
 *     tags: [Message Queue]
 *     parameters:
 *       - in: path
 *         name: queueName
 *         required: true
 *         schema:
 *           type: string
 *         description: Name of the queue
 *     responses:
 *       200:
 *         description: Queue size
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 queueName:
 *                   type: string
 *                 size:
 *                   type: number
 *                 timestamp:
 *                   type: string
 *       400:
 *         description: Invalid queue name
 *       500:
 *         description: Server error
 */
router.get('/size/:queueName', async (req, res) => {
  try {
    const queueService = getQueueService();
    if (!queueService) {
      return res.status(503).json({ error: 'Queue service not initialized' });
    }

    const { queueName } = req.params;
    
    // Validate queue name
    if (!Object.values(QUEUE_NAMES).includes(queueName as any)) {
      return res.status(400).json({ error: 'Invalid queue name' });
    }

    const size = await queueService.getQueueSize(queueName);
    
    return res.json({
      queueName,
      size,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting queue size:', error);
    return res.status(500).json({ error: 'Failed to get queue size' });
  }
});

/**
 * @swagger
 * /api/queue/demo:
 *   post:
 *     summary: Demonstrate queue features
 *     description: Enqueue demo messages to show queue functionality (for testing)
 *     tags: [Message Queue]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - conversationId
 *             properties:
 *               userId:
 *                 type: string
 *               conversationId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Demo messages enqueued
 *       400:
 *         description: Invalid request body
 *       500:
 *         description: Server error
 */
router.post('/demo', async (req, res) => {
  try {
    const queueService = getQueueService();
    if (!queueService) {
      return res.status(503).json({ error: 'Queue service not initialized' });
    }

    const { userId, conversationId } = req.body;

    if (!userId || !conversationId) {
      return res.status(400).json({ error: 'userId and conversationId are required' });
    }

    await queueService.demonstrateQueueFeatures(userId, conversationId);
    
    return res.json({
      message: 'Demo messages enqueued successfully',
      userId,
      conversationId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error running queue demo:', error);
    return res.status(500).json({ error: 'Failed to run queue demo' });
  }
});

/**
 * @swagger
 * /api/queue/purge/{queueName}:
 *   delete:
 *     summary: Purge queue
 *     description: Remove all messages from a specific queue (admin operation)
 *     tags: [Message Queue]
 *     parameters:
 *       - in: path
 *         name: queueName
 *         required: true
 *         schema:
 *           type: string
 *         description: Name of the queue to purge
 *     responses:
 *       200:
 *         description: Queue purged successfully
 *       400:
 *         description: Invalid queue name
 *       500:
 *         description: Server error
 */
router.delete('/purge/:queueName', async (req, res) => {
  try {
    const queueService = getQueueService();
    if (!queueService) {
      return res.status(503).json({ error: 'Queue service not initialized' });
    }

    const { queueName } = req.params;
    
    // Validate queue name
    if (!Object.values(QUEUE_NAMES).includes(queueName as any)) {
      return res.status(400).json({ error: 'Invalid queue name' });
    }

    await queueService.purgeQueue(queueName);
    
    return res.json({
      message: `Queue ${queueName} purged successfully`,
      queueName,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error purging queue:', error);
    return res.status(500).json({ error: 'Failed to purge queue' });
  }
});

/**
 * @swagger
 * /api/queue/enqueue/chat:
 *   post:
 *     summary: Enqueue chat message
 *     description: Add a chat message to the processing queue
 *     tags: [Message Queue]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - conversationId
 *               - message
 *             properties:
 *               userId:
 *                 type: string
 *               conversationId:
 *                 type: string
 *               message:
 *                 type: string
 *               forceAgent:
 *                 type: string
 *               priority:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 10
 *     responses:
 *       200:
 *         description: Message enqueued successfully
 *       400:
 *         description: Invalid request body
 *       500:
 *         description: Server error
 */
router.post('/enqueue/chat', async (req, res) => {
  try {
    const queueService = getQueueService();
    if (!queueService) {
      return res.status(503).json({ error: 'Queue service not initialized' });
    }

    const { userId, conversationId, message, forceAgent, priority } = req.body;

    if (!userId || !conversationId || !message) {
      return res.status(400).json({ error: 'userId, conversationId, and message are required' });
    }

    if (priority && (priority < 1 || priority > 10)) {
      return res.status(400).json({ error: 'Priority must be between 1 and 10' });
    }

    const messageId = await queueService.enqueueChatMessage(
      userId,
      conversationId,
      message,
      forceAgent,
      priority
    );
    
    return res.json({
      messageId,
      message: 'Chat message enqueued successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error enqueuing chat message:', error);
    return res.status(500).json({ error: 'Failed to enqueue chat message' });
  }
});

/**
 * @swagger
 * /api/queue/enqueue/proactive:
 *   post:
 *     summary: Enqueue proactive action
 *     description: Add a proactive action to the processing queue
 *     tags: [Message Queue]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - actionType
 *               - agentType
 *               - message
 *               - userId
 *               - conversationId
 *             properties:
 *               actionType:
 *                 type: string
 *               agentType:
 *                 type: string
 *               message:
 *                 type: string
 *               userId:
 *                 type: string
 *               conversationId:
 *                 type: string
 *               timing:
 *                 type: string
 *                 enum: [immediate, delayed]
 *               delayMs:
 *                 type: number
 *               priority:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 10
 *     responses:
 *       200:
 *         description: Proactive action enqueued successfully
 *       400:
 *         description: Invalid request body
 *       500:
 *         description: Server error
 */
router.post('/enqueue/proactive', async (req, res) => {
  try {
    const queueService = getQueueService();
    if (!queueService) {
      return res.status(503).json({ error: 'Queue service not initialized' });
    }

    const { 
      actionType, 
      agentType, 
      message, 
      userId, 
      conversationId, 
      timing, 
      delayMs, 
      priority 
    } = req.body;

    if (!actionType || !agentType || !message || !userId || !conversationId) {
      return res.status(400).json({ 
        error: 'actionType, agentType, message, userId, and conversationId are required' 
      });
    }

    if (timing && !['immediate', 'delayed'].includes(timing)) {
      return res.status(400).json({ error: 'Timing must be either "immediate" or "delayed"' });
    }

    if (priority && (priority < 1 || priority > 10)) {
      return res.status(400).json({ error: 'Priority must be between 1 and 10' });
    }

    const messageId = await queueService.enqueueProactiveAction(
      actionType,
      agentType,
      message,
      userId,
      conversationId,
      timing || 'immediate',
      delayMs,
      priority
    );
    
    return res.json({
      messageId,
      message: 'Proactive action enqueued successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error enqueuing proactive action:', error);
    return res.status(500).json({ error: 'Failed to enqueue proactive action' });
  }
});

export default router;

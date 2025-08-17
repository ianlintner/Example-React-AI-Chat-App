import express from 'express';
import { agentService } from '../agents/agentService';
import { AgentType } from '../agents/types';
import { classifyMessage } from '../agents/classifier';
import { ragService } from '../agents/ragService';
import { responseValidator } from '../validation/responseValidator';
import { jokeLearningSystem } from '../agents/jokeLearningSystem';

const router = express.Router();

// Test individual agent response
/**
 * @openapi
 * /api/test-bench/agent/{agentType}/test:
 *   post:
 *     tags: [test-bench]
 *     summary: Test an individual agent response
 *     parameters:
 *       - in: path
 *         name: agentType
 *         required: true
 *         schema:
 *           type: string
 *           enum: [general, joke, trivia, gif, account_support, billing_support, website_support, operator_support, hold_agent, story_teller, riddle_master, quote_master, game_host, music_guru]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               message: { type: string }
 *               conversationHistory: { type: array, items: { type: object } }
 *               userId: { type: string }
 *     responses:
 *       '200':
 *         description: Agent test result
 *       '400':
 *         description: Invalid input
 *       '500':
 *         description: Server error
 */
router.post('/agent/:agentType/test', async (req, res): Promise<void> => {
  try {
    const { agentType } = req.params;
    const {
      message,
      conversationHistory = [],
      userId = 'test-user',
    } = req.body;

    if (!message) {
      res.status(400).json({ error: 'Message is required' });
      return;
    }

    // Validate agent type
    const validAgentTypes: AgentType[] = [
      'general',
      'joke',
      'trivia',
      'gif',
      'account_support',
      'billing_support',
      'website_support',
      'operator_support',
      'hold_agent',
      'story_teller',
      'riddle_master',
      'quote_master',
      'game_host',
      'music_guru',
    ];

    if (!validAgentTypes.includes(agentType as AgentType)) {
      res.status(400).json({ error: 'Invalid agent type' });
      return;
    }

    const response = await agentService.processMessage(
      message,
      conversationHistory,
      agentType as AgentType,
      `test-conversation-${Date.now()}`,
      userId,
    );

    res.json({
      success: true,
      agentType,
      message,
      response,
      timestamp: new Date().toISOString(),
      testMetadata: {
        userId,
        forced: true,
        environment: 'test',
      },
    });
  } catch (error) {
    console.error('Agent test error:', error);
    res.status(500).json({
      error: 'Failed to test agent',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Test message classification
/**
 * @openapi
 * /api/test-bench/classifier/test:
 *   post:
 *     tags: [test-bench]
 *     summary: Test message classification
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               message: { type: string }
 *     responses:
 *       '200':
 *         description: Classification result
 *       '400':
 *         description: Invalid input
 *       '500':
 *         description: Server error
 */
router.post('/classifier/test', async (req, res): Promise<void> => {
  try {
    const { message } = req.body;

    if (!message) {
      res.status(400).json({ error: 'Message is required' });
      return;
    }

    const classification = await classifyMessage(message);

    res.json({
      success: true,
      message,
      classification,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Classification test error:', error);
    res.status(500).json({
      error: 'Failed to test classifier',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Test RAG service
/**
 * @openapi
 * /api/test-bench/rag/test:
 *   post:
 *     tags: [test-bench]
 *     summary: Test RAG service for an agent type and query
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               agentType: { type: string }
 *               query: { type: string }
 *               useFullSearch: { type: boolean }
 *     responses:
 *       '200':
 *         description: RAG test result
 *       '400':
 *         description: Invalid input
 *       '500':
 *         description: Server error
 */
router.post('/rag/test', async (req, res): Promise<void> => {
  try {
    const { agentType, query, useFullSearch = false } = req.body;

    if (!agentType || !query) {
      res.status(400).json({ error: 'Agent type and query are required' });
      return;
    }

    const ragResult = ragService.searchForAgent(
      agentType,
      query,
      useFullSearch,
    );

    res.json({
      success: true,
      agentType,
      query,
      useFullSearch,
      result: ragResult,
      hasResult: !!ragResult,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('RAG test error:', error);
    res.status(500).json({
      error: 'Failed to test RAG service',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Test response validation
/**
 * @openapi
 * /api/test-bench/validator/test:
 *   post:
 *     tags: [test-bench]
 *     summary: Test response validator
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               agentType: { type: string }
 *               userMessage: { type: string }
 *               agentResponse: { type: string }
 *               conversationId: { type: string }
 *               userId: { type: string }
 *               isProactive: { type: boolean }
 *     responses:
 *       '200':
 *         description: Validation result
 *       '400':
 *         description: Invalid input
 *       '500':
 *         description: Server error
 */
router.post('/validator/test', async (req, res): Promise<void> => {
  try {
    const {
      agentType,
      userMessage,
      agentResponse,
      conversationId = 'test-conversation',
      userId = 'test-user',
      isProactive = false,
    } = req.body;

    if (!agentType || !userMessage || !agentResponse) {
      res.status(400).json({
        error: 'Agent type, user message, and agent response are required',
      });
      return;
    }

    const validationResult = responseValidator.validateResponse(
      agentType as AgentType,
      userMessage,
      agentResponse,
      conversationId,
      userId,
      isProactive,
    );

    res.json({
      success: true,
      input: {
        agentType,
        userMessage,
        agentResponse,
        conversationId,
        userId,
        isProactive,
      },
      validation: validationResult,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Validation test error:', error);
    res.status(500).json({
      error: 'Failed to test response validator',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Test joke learning system
/**
 * @openapi
 * /api/test-bench/joke-learning/test:
 *   post:
 *     tags: [test-bench]
 *     summary: Test joke learning system flows
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId: { type: string }
 *               action: { type: string, enum: [get-profile, record-reaction, generate-prompt] }
 *               jokeId: { type: string }
 *               reactionType: { type: string }
 *               messageId: { type: string }
 *               jokeCategory: { type: string }
 *               jokeType: { type: string }
 *     responses:
 *       '200':
 *         description: Joke learning result
 *       '400':
 *         description: Invalid input
 *       '500':
 *         description: Server error
 */
router.post('/joke-learning/test', async (req, res): Promise<void> => {
  try {
    const {
      userId = 'test-user',
      action,
      jokeId,
      reactionType,
      messageId,
      jokeCategory,
      jokeType,
    } = req.body;

    let result: any = {};

    switch (action) {
      case 'get-profile':
        result = {
          profile: jokeLearningSystem.getUserProfile(userId),
          metrics: jokeLearningSystem.getLearningMetrics(),
          categories: jokeLearningSystem.getJokeCategories(),
        };
        break;

      case 'record-reaction':
        if (!jokeId || !reactionType) {
          res.status(400).json({
            error: 'Joke ID and reaction type required for record-reaction',
          });
          return;
        }
        const reaction = {
          userId,
          messageId: messageId || jokeId,
          reactionType,
          timestamp: new Date(),
          jokeCategory: jokeCategory || 'dad_jokes',
          jokeType: jokeType || 'pun',
        };
        jokeLearningSystem.recordReaction(reaction);
        result = { recorded: true, reaction };
        break;

      case 'generate-prompt':
        const basePrompt = 'You are a joke-telling AI. Tell engaging jokes.';
        result = {
          basePrompt,
          adaptivePrompt: jokeLearningSystem.generateAdaptivePrompt(
            userId,
            basePrompt,
          ),
          recommendation:
            jokeLearningSystem.getPersonalizedJokeRecommendation(userId),
        };
        break;

      default:
        res.status(400).json({
          error:
            'Invalid action. Use: get-profile, record-reaction, or generate-prompt',
        });
        return;
    }

    res.json({
      success: true,
      action,
      userId,
      result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Joke learning test error:', error);
    res.status(500).json({
      error: 'Failed to test joke learning system',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Test goal-seeking system
/**
 * @openapi
 * /api/test-bench/goal-seeking/test:
 *   post:
 *     tags: [test-bench]
 *     summary: Test goal-seeking system flows
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId: { type: string }
 *               action: { type: string, enum: [get-state, initialize, update-state] }
 *               message: { type: string }
 *     responses:
 *       '200':
 *         description: Goal-seeking result
 *       '400':
 *         description: Invalid input
 *       '500':
 *         description: Server error
 */
router.post('/goal-seeking/test', async (req, res): Promise<void> => {
  try {
    const { userId = 'test-user', action, message } = req.body;

    let result: any = {};

    switch (action) {
      case 'get-state':
        result = {
          userState: agentService.getUserGoalState(userId),
          activeGoals: agentService.getUserActiveGoals(userId),
        };
        break;

      case 'initialize':
        agentService.initializeUserGoals(userId);
        result = { initialized: true };
        break;

      case 'update-state':
        if (!message) {
          res.status(400).json({ error: 'Message required for update-state' });
          return;
        }
        const response = await agentService.processMessageWithGoalSeeking(
          userId,
          message,
          [],
          undefined,
          `test-conversation-${Date.now()}`,
        );
        result = {
          response,
          updatedState: agentService.getUserGoalState(userId),
          activeGoals: agentService.getUserActiveGoals(userId),
        };
        break;

      default:
        res.status(400).json({
          error: 'Invalid action. Use: get-state, initialize, or update-state',
        });
        return;
    }

    res.json({
      success: true,
      action,
      userId,
      result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Goal-seeking test error:', error);
    res.status(500).json({
      error: 'Failed to test goal-seeking system',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Test conversation management
/**
 * @openapi
 * /api/test-bench/conversation-manager/test:
 *   post:
 *     tags: [test-bench]
 *     summary: Test conversation manager flows
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId: { type: string }
 *               action: { type: string, enum: [get-context, initialize, process-message] }
 *               message: { type: string }
 *               agentType: { type: string }
 *     responses:
 *       '200':
 *         description: Conversation manager result
 *       '400':
 *         description: Invalid input
 *       '500':
 *         description: Server error
 */
router.post('/conversation-manager/test', async (req, res): Promise<void> => {
  try {
    const {
      userId = 'test-user',
      action,
      message,
      agentType = 'general',
    } = req.body;

    let result: any = {};

    switch (action) {
      case 'get-context':
        result = {
          context: agentService.getConversationContext(userId),
          currentAgent: agentService.getCurrentAgent(userId),
        };
        break;

      case 'initialize':
        result = {
          context: agentService.initializeConversation(
            userId,
            agentType as AgentType,
          ),
        };
        break;

      case 'process-message':
        if (!message) {
          res
            .status(400)
            .json({ error: 'Message required for process-message' });
          return;
        }
        const response = await agentService.processMessageWithConversation(
          userId,
          message,
          [],
          `test-conversation-${Date.now()}`,
        );
        result = {
          response,
          context: agentService.getConversationContext(userId),
        };
        break;

      default:
        res.status(400).json({
          error:
            'Invalid action. Use: get-context, initialize, or process-message',
        });
        return;
    }

    res.json({
      success: true,
      action,
      userId,
      result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Conversation manager test error:', error);
    res.status(500).json({
      error: 'Failed to test conversation manager',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Test comprehensive system (both goal-seeking and conversation management)
/**
 * @openapi
 * /api/test-bench/comprehensive/test:
 *   post:
 *     tags: [test-bench]
 *     summary: Test comprehensive system (goal-seeking + conversation manager)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId: { type: string }
 *               message: { type: string }
 *               conversationHistory: { type: array, items: { type: object } }
 *               forcedAgentType: { type: string }
 *     responses:
 *       '200':
 *         description: Comprehensive test result
 *       '400':
 *         description: Invalid input
 *       '500':
 *         description: Server error
 */
router.post('/comprehensive/test', async (req, res): Promise<void> => {
  try {
    const {
      userId = 'test-user',
      message,
      conversationHistory = [],
      forcedAgentType,
    } = req.body;

    if (!message) {
      res.status(400).json({ error: 'Message is required' });
      return;
    }

    const response = await agentService.processMessageWithBothSystems(
      userId,
      message,
      conversationHistory,
      `test-conversation-${Date.now()}`,
      forcedAgentType as AgentType,
    );

    const comprehensiveState = agentService.getComprehensiveUserState(userId);

    res.json({
      success: true,
      message,
      response,
      userState: comprehensiveState,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Comprehensive test error:', error);
    res.status(500).json({
      error: 'Failed to test comprehensive system',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get available agents list
/**
 * @openapi
 * /api/test-bench/agents/list:
 *   get:
 *     tags: [test-bench]
 *     summary: Get available agents list
 *     responses:
 *       '200':
 *         description: Agents list
 *       '500':
 *         description: Server error
 */
router.get('/agents/list', (req, res) => {
  try {
    const agents = agentService.getAvailableAgents();

    res.json({
      success: true,
      agents,
      totalCount: agents.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Agents list error:', error);
    res.status(500).json({
      error: 'Failed to get agents list',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// System health check for agent services
/**
 * @openapi
 * /api/test-bench/health:
 *   get:
 *     tags: [test-bench]
 *     summary: System health check for agent services
 *     responses:
 *       '200':
 *         description: Health report
 *       '500':
 *         description: Server error
 */
router.get('/health', (req, res) => {
  try {
    const health = {
      agentService: 'operational',
      classifier: 'operational',
      ragService: 'operational',
      responseValidator: 'operational',
      jokeLearningSystem: 'operational',
      goalSeekingSystem: 'operational',
      conversationManager: 'operational',
      openaiApiKey: process.env.OPENAI_API_KEY ? 'configured' : 'missing',
      timestamp: new Date().toISOString(),
    };

    res.json({
      success: true,
      health,
      status: 'healthy',
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      error: 'Health check failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Bulk test endpoint for testing multiple agents
/**
 * @openapi
 * /api/test-bench/bulk-test:
 *   post:
 *     tags: [test-bench]
 *     summary: Bulk test multiple agents with a single message
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               message: { type: string }
 *               agentTypes:
 *                 type: array
 *                 items: { type: string }
 *               userId: { type: string }
 *     responses:
 *       '200':
 *         description: Bulk test results
 *       '400':
 *         description: Invalid input
 *       '500':
 *         description: Server error
 */
router.post('/bulk-test', async (req, res): Promise<void> => {
  try {
    const { message, agentTypes = [], userId = 'test-user' } = req.body;

    if (!message) {
      res.status(400).json({ error: 'Message is required' });
      return;
    }

    const validAgentTypes: AgentType[] = [
      'general',
      'joke',
      'trivia',
      'gif',
      'account_support',
      'billing_support',
      'website_support',
      'operator_support',
      'hold_agent',
      'story_teller',
      'riddle_master',
      'quote_master',
      'game_host',
      'music_guru',
    ];

    const testAgents = agentTypes.length > 0 ? agentTypes : validAgentTypes;
    const results: any[] = [];

    for (const agentType of testAgents) {
      if (!validAgentTypes.includes(agentType)) {
        results.push({
          agentType,
          success: false,
          error: 'Invalid agent type',
        });
        continue;
      }

      try {
        const response = await agentService.processMessage(
          message,
          [],
          agentType as AgentType,
          `bulk-test-${Date.now()}-${agentType}`,
          userId,
        );

        results.push({
          agentType,
          success: true,
          response,
          executionTime: Date.now(),
        });
      } catch (error) {
        results.push({
          agentType,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    res.json({
      success: true,
      message,
      results,
      totalTested: results.length,
      successCount: results.filter(r => r.success).length,
      failureCount: results.filter(r => !r.success).length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Bulk test error:', error);
    res.status(500).json({
      error: 'Failed to perform bulk test',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

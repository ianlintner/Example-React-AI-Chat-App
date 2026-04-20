import { AgentService } from '../agentService';
import { classifyMessage } from '../classifier';
import { getAgent } from '../config';
import { ConversationManager } from '../conversationManager';
import { GoalSeekingSystem } from '../goalSeekingSystem';
import { routeMessage } from '../router';
import { AgentType } from '../types';
import { Message } from '../../types';
import {
  createAgentSpan,
  createValidationSpan,
  addSpanEvent,
  setSpanStatus,
  endSpan,
} from '../../tracing/tracer';

// Mock all dependencies
jest.mock('../classifier');
jest.mock('../config');
jest.mock('../conversationManager');
jest.mock('../goalSeekingSystem');
jest.mock('../ragService');
jest.mock('../dndService');
jest.mock('../../validation/responseValidator');
jest.mock('../jokeLearningSystem');
jest.mock('../../tracing/tracer');
jest.mock('../../tracing/contextManager');
jest.mock('../router');

// Mock OpenAI
jest.mock('openai', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn(),
      },
    },
  })),
}));

// Cast mocked functions for proper typing
const mockClassifyMessage = classifyMessage as jest.MockedFunction<
  typeof classifyMessage
>;
const mockGetAgent = getAgent as jest.MockedFunction<typeof getAgent>;
const mockRouteMessage = routeMessage as jest.MockedFunction<
  typeof routeMessage
>;
const mockCreateAgentSpan = createAgentSpan as jest.MockedFunction<
  typeof createAgentSpan
>;
const mockCreateValidationSpan = createValidationSpan as jest.MockedFunction<
  typeof createValidationSpan
>;
const mockAddSpanEvent = addSpanEvent as jest.MockedFunction<
  typeof addSpanEvent
>;
const mockSetSpanStatus = setSpanStatus as jest.MockedFunction<
  typeof setSpanStatus
>;
const mockEndSpan = endSpan as jest.MockedFunction<typeof endSpan>;

// Mock instances
const mockConversationManager = {
  getContext: jest.fn(),
  initializeContext: jest.fn(),
  updateContext: jest.fn(),
  completeHandoff: jest.fn(),
  cleanup: jest.fn(),
} as any;

const mockGoalSeekingSystem = {
  updateUserState: jest.fn(),
  activateGoals: jest.fn(),
  updateGoalProgress: jest.fn(),
  generateProactiveActions: jest.fn(),
  getUserState: jest.fn(),
  getActiveGoals: jest.fn(),
  initializeUser: jest.fn(),
  cleanupInactiveUsers: jest.fn(),
} as any;

const mockRagService = {
  searchForAgent: jest.fn(),
  getContentForAgent: jest.fn(),
} as any;

const mockDndService = {
  generateCharacter: jest.fn(),
  generateEncounter: jest.fn(),
  rollDice: jest.fn(),
  generateAdventureHook: jest.fn(),
  formatCharacter: jest.fn(),
  formatDiceRoll: jest.fn(),
  formatEncounter: jest.fn(),
} as any;

const mockResponseValidator = {
  validateResponse: jest.fn(),
} as any;

const mockJokeLearningSystem = {
  generateAdaptivePrompt: jest.fn(),
} as any;

const mockSpan = {
  setAttributes: jest.fn(),
  setAttribute: jest.fn(),
  addEvent: jest.fn(),
  setStatus: jest.fn(),
  end: jest.fn(),
} as any;

// Mock constructors
(
  ConversationManager as jest.MockedClass<typeof ConversationManager>
).mockImplementation(() => mockConversationManager);
(
  GoalSeekingSystem as jest.MockedClass<typeof GoalSeekingSystem>
).mockImplementation(() => mockGoalSeekingSystem);

// Setup module mocks
Object.defineProperty(
  require('../../validation/responseValidator'),
  'responseValidator',
  {
    value: mockResponseValidator,
    writable: true,
  },
);
Object.defineProperty(require('../ragService'), 'ragService', {
  value: mockRagService,
  writable: true,
});
Object.defineProperty(require('../dndService'), 'dndService', {
  value: mockDndService,
  writable: true,
});
Object.defineProperty(require('../jokeLearningSystem'), 'jokeLearningSystem', {
  value: mockJokeLearningSystem,
  writable: true,
});

// Helper to build a fresh ConversationContext in the NEW shape (no handoff
// flags). Test authors can override any field they care about.
function makeContext(overrides: Partial<any> = {}): any {
  return {
    userId: 'test-user',
    currentAgent: 'general' as AgentType,
    conversationTopic: 'general',
    lastMessageTime: new Date(),
    messageCount: 0,
    conversationDepth: 0,
    userSatisfaction: 0.7,
    agentPerformance: 0.7,
    ...overrides,
  };
}

describe('AgentService', () => {
  let testAgentService: AgentService;
  let mockOpenAI: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset environment
    delete process.env.OPENAI_API_KEY;

    // Create fresh instance for testing
    testAgentService = new AgentService();

    // Setup OpenAI mock
    mockOpenAI = {
      chat: {
        completions: {
          create: jest.fn(),
        },
      },
    };

    const OpenAIMock = require('openai').default;
    OpenAIMock.mockImplementation(() => mockOpenAI);

    // Setup default mocks
    mockCreateAgentSpan.mockReturnValue(mockSpan);
    mockCreateValidationSpan.mockReturnValue(mockSpan);
    mockAddSpanEvent.mockReturnValue(undefined);
    mockSetSpanStatus.mockReturnValue(undefined);
    mockEndSpan.mockReturnValue(undefined);

    mockClassifyMessage.mockResolvedValue({
      agentType: 'joke' as AgentType,
      confidence: 0.9,
      reasoning: 'User wants a joke',
    });

    mockGetAgent.mockReturnValue({
      id: 'joke',
      name: 'Adaptive Joke Master',
      type: 'joke' as AgentType,
      description: 'Comedy agent for jokes',
      systemPrompt: 'You are a joke master',
      model: 'gpt-3.5-turbo',
      maxTokens: 150,
      temperature: 0.9,
    });

    mockRagService.searchForAgent.mockReturnValue({
      content: 'Why did the chicken cross the road? To get to the other side!',
      metadata: { alt: 'Joke', description: 'Classic joke' },
    });

    mockRagService.getContentForAgent.mockReturnValue('Sample RAG content');

    mockResponseValidator.validateResponse.mockReturnValue({
      issues: [],
    });

    mockJokeLearningSystem.generateAdaptivePrompt.mockReturnValue(
      'Adaptive joke prompt',
    );

    mockConversationManager.getContext.mockReturnValue(null);
    mockConversationManager.initializeContext.mockImplementation(
      (_userId: string, agent: AgentType = 'general') =>
        makeContext({ currentAgent: agent }),
    );
    mockConversationManager.completeHandoff.mockImplementation(
      (_userId: string, agent: AgentType) =>
        makeContext({ currentAgent: agent }),
    );
    mockConversationManager.updateContext.mockImplementation(
      (_userId: string, _msg: string, _resp: string, agent: AgentType) =>
        makeContext({ currentAgent: agent }),
    );

    // Default: router stays with the current agent (sticky). Individual
    // tests override this to simulate a handoff decision.
    mockRouteMessage.mockImplementation(async (_msg, currentAgent) => ({
      selectedAgent: currentAgent,
      handoff: false,
      confidence: 0.5,
      reason: 'sticky default',
      source: 'sticky' as const,
    }));

    mockGoalSeekingSystem.generateProactiveActions.mockResolvedValue([]);
    mockGoalSeekingSystem.getUserState.mockReturnValue({});
    mockGoalSeekingSystem.getActiveGoals.mockReturnValue([]);

    // Setup D&D service mocks
    mockDndService.generateCharacter.mockReturnValue({
      name: 'Thorin Ironbeard',
      class: 'Fighter',
      level: 1,
    });
    mockDndService.generateEncounter.mockReturnValue({
      title: 'Goblin Ambush',
      difficulty: 'Easy',
    });
    mockDndService.rollDice.mockReturnValue({
      result: 15,
      rolls: [15],
      modifier: 0,
    });
    mockDndService.generateAdventureHook.mockReturnValue(
      'A mysterious letter arrives...',
    );
    mockDndService.formatCharacter.mockReturnValue(
      '**Thorin Ironbeard** (Level 1 Fighter)',
    );
    mockDndService.formatDiceRoll.mockReturnValue('🎲 **Initiative Roll**: 15');
    mockDndService.formatEncounter.mockReturnValue(
      '⚔️ **Goblin Ambush** (Easy)',
    );
  });

  describe('constructor', () => {
    it('should create AgentService instance with dependencies', () => {
      const service = new AgentService();
      expect(service).toBeInstanceOf(AgentService);
      expect(ConversationManager).toHaveBeenCalled();
      expect(GoalSeekingSystem).toHaveBeenCalledWith(service);
    });
  });

  describe('processMessage', () => {
    it('should process a simple message successfully', async () => {
      process.env.OPENAI_API_KEY = 'test-key';

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: {
              content:
                'Why did the chicken cross the road? To get to the other side!',
            },
          },
        ],
        usage: { total_tokens: 25 },
      });

      const result = await testAgentService.processMessage(
        'Tell me a joke',
        [],
      );

      expect(result).toMatchObject({
        content:
          'Why did the chicken cross the road? To get to the other side!',
        agentUsed: 'joke',
        confidence: 0.9,
      });

      expect(mockClassifyMessage).toHaveBeenCalledWith('Tell me a joke');
      expect(mockGetAgent).toHaveBeenCalledWith('joke');
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalled();
    });

    it('should handle forced agent type', async () => {
      process.env.OPENAI_API_KEY = 'test-key';

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: 'Trivia response' } }],
        usage: { total_tokens: 20 },
      });

      mockGetAgent.mockReturnValue({
        id: 'trivia',
        name: 'Trivia Master',
        type: 'trivia' as AgentType,
        description: 'Educational trivia agent',
        systemPrompt: 'You are a trivia master',
        model: 'gpt-3.5-turbo',
        maxTokens: 150,
        temperature: 0.7,
      });

      const result = await testAgentService.processMessage(
        'Tell me a joke',
        [],
        'trivia',
      );

      expect(result.agentUsed).toBe('trivia');
      expect(mockClassifyMessage).not.toHaveBeenCalled();
      expect(mockGetAgent).toHaveBeenCalledWith('trivia');
    });

    it('should generate demo response when no API key', async () => {
      delete process.env.OPENAI_API_KEY;

      const result = await testAgentService.processMessage(
        'Tell me a joke',
        [],
      );

      // The demo response uses RAG content first, then falls back to agent name
      expect(result.content).toContain('😄');
      expect(result.agentUsed).toBe('joke');
      expect(mockOpenAI.chat.completions.create).not.toHaveBeenCalled();
    });

    it('should handle OpenAI API errors gracefully', async () => {
      process.env.OPENAI_API_KEY = 'test-key';

      mockOpenAI.chat.completions.create.mockRejectedValue(
        new Error('API Error'),
      );

      const result = await testAgentService.processMessage('Test message', []);

      expect(result.content).toContain('error while processing');
      expect(result.agentUsed).toBe('joke');
    });

    it('should handle conversation history correctly', async () => {
      process.env.OPENAI_API_KEY = 'test-key';

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: 'Response with history' } }],
        usage: { total_tokens: 30 },
      });

      const history: Message[] = [
        {
          id: '1',
          role: 'user',
          content: 'Hello',
          timestamp: new Date(),
          conversationId: 'conv-123',
        },
        {
          id: '2',
          role: 'assistant',
          content: 'Hi there!',
          timestamp: new Date(),
          conversationId: 'conv-123',
        },
      ];

      await testAgentService.processMessage('Follow up', history);

      const callArgs = mockOpenAI.chat.completions.create.mock.calls[0][0];
      expect(callArgs.messages).toHaveLength(4); // system + 2 history + current
      expect(callArgs.messages[1].content).toBe('Hello');
      expect(callArgs.messages[2].content).toBe('Hi there!');
      expect(callArgs.messages[3].content).toBe('Follow up');
    });

    it('should limit conversation history to last 10 messages', async () => {
      process.env.OPENAI_API_KEY = 'test-key';

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: 'Response' } }],
        usage: { total_tokens: 30 },
      });

      // Create 15 messages
      const history: Message[] = Array.from({ length: 15 }, (_, i) => ({
        id: `${i + 1}`,
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i + 1}`,
        timestamp: new Date(),
        conversationId: 'conv-123',
      }));

      await testAgentService.processMessage('Current message', history);

      const callArgs = mockOpenAI.chat.completions.create.mock.calls[0][0];
      // Should have: 1 system + 10 history + 1 current = 12 total
      expect(callArgs.messages).toHaveLength(12);
      expect(callArgs.messages[1].content).toBe('Message 6'); // Should start from message 6
    });

    it('should use adaptive prompt for joke agent with userId', async () => {
      process.env.OPENAI_API_KEY = 'test-key';
      const userId = 'test-user-123';

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: 'Adaptive joke' } }],
        usage: { total_tokens: 25 },
      });

      await testAgentService.processMessage(
        'Tell me a joke',
        [],
        'joke',
        'conv-123',
        userId,
      );

      expect(
        mockJokeLearningSystem.generateAdaptivePrompt,
      ).toHaveBeenCalledWith(userId, 'You are a joke master');
    });

    it('should validate response when conversationId and userId provided', async () => {
      process.env.OPENAI_API_KEY = 'test-key';

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: 'Test response' } }],
        usage: { total_tokens: 20 },
      });

      await testAgentService.processMessage(
        'Test',
        [],
        undefined,
        'conv-123',
        'user-123',
      );

      expect(mockResponseValidator.validateResponse).toHaveBeenCalledWith(
        'joke',
        'Test',
        'Test response',
        'conv-123',
        'user-123',
        false,
      );
    });

    it('should handle malformed OpenAI response', async () => {
      process.env.OPENAI_API_KEY = 'test-key';

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [],
      });

      const result = await testAgentService.processMessage('Test', []);

      expect(result.content).toContain('error while processing');
    });

    it('should handle classification failure gracefully', async () => {
      mockClassifyMessage.mockRejectedValue(new Error('Classification failed'));

      const result = await testAgentService.processMessage(
        'Unclear message',
        [],
      );

      expect(result.agentUsed).toBe('general');
      expect(result.confidence).toBe(0);
      expect(result.content).toContain('error while processing');
    });
  });

  describe('getAvailableAgents', () => {
    it('should return list of available agents', () => {
      const agents = testAgentService.getAvailableAgents();

      expect(Array.isArray(agents)).toBe(true);
      expect(agents.length).toBeGreaterThan(0);

      // Check structure
      agents.forEach(agent => {
        expect(agent).toHaveProperty('id');
        expect(agent).toHaveProperty('name');
        expect(agent).toHaveProperty('description');
        expect(typeof agent.id).toBe('string');
        expect(typeof agent.name).toBe('string');
        expect(typeof agent.description).toBe('string');
      });
    });

    it('should include all expected agent types', () => {
      const agents = testAgentService.getAvailableAgents();
      const agentIds = agents.map(agent => agent.id);

      expect(agentIds).toContain('general');
      expect(agentIds).toContain('joke');
      expect(agentIds).toContain('trivia');
      expect(agentIds).toContain('gif');
      expect(agentIds).toContain('dnd_master');
      expect(agentIds).toContain('account_support');
      expect(agentIds).toContain('billing_support');
    });
  });

  describe('processMessageWithGoalSeeking', () => {
    const userId = 'test-user';
    const message = 'Help me with my goals';

    beforeEach(() => {
      process.env.OPENAI_API_KEY = 'test-key';
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: 'Goal-seeking response' } }],
        usage: { total_tokens: 30 },
      });
    });

    it('should process message with goal-seeking integration', async () => {
      mockGoalSeekingSystem.generateProactiveActions.mockResolvedValue([
        {
          type: 'entertainment_offer' as const,
          agentType: 'joke' as AgentType,
          message: 'Want a joke?',
          timing: 'immediate' as const,
        },
      ]);

      const result = await testAgentService.processMessageWithGoalSeeking(
        userId,
        message,
        [],
        undefined,
        'conv-123',
      );

      expect(mockGoalSeekingSystem.updateUserState).toHaveBeenCalledWith(
        userId,
        message,
      );
      expect(mockGoalSeekingSystem.activateGoals).toHaveBeenCalledWith(userId);
      expect(mockGoalSeekingSystem.updateGoalProgress).toHaveBeenCalledWith(
        userId,
        message,
        'Goal-seeking response',
      );
      expect(result.proactiveActions).toBeDefined();
      expect(result.proactiveActions).toHaveLength(1);
    });

    it('should filter proactive actions to single action', async () => {
      mockGoalSeekingSystem.generateProactiveActions.mockResolvedValue([
        {
          type: 'entertainment_offer' as const,
          agentType: 'joke' as AgentType,
          message: 'Want a joke?',
          timing: 'immediate' as const,
        },
        {
          type: 'technical_check' as const,
          agentType: 'general' as AgentType,
          message: 'Need technical help?',
          timing: 'immediate' as const,
        },
      ]);

      const result = await testAgentService.processMessageWithGoalSeeking(
        userId,
        message,
        [],
        undefined,
        'conv-123',
      );

      expect(result.proactiveActions).toHaveLength(1);
      expect(result.proactiveActions![0].type).toBe('technical_check'); // Higher priority (3 vs 2)
    });

    it('should handle forced agent type', async () => {
      const result = await testAgentService.processMessageWithGoalSeeking(
        userId,
        message,
        [],
        'trivia',
        'conv-123',
      );

      expect(result.agentUsed).toBe('trivia');
    });
  });

  describe('executeProactiveAction', () => {
    const userId = 'test-user';
    const action = {
      type: 'entertainment_offer' as const,
      agentType: 'joke' as AgentType,
      message: 'Want to hear a joke?',
      timing: 'immediate' as const,
    };

    beforeEach(() => {
      process.env.OPENAI_API_KEY = 'test-key';
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: 'Proactive joke response' } }],
        usage: { total_tokens: 25 },
      });
    });

    it('should execute proactive action successfully', async () => {
      const result = await testAgentService.executeProactiveAction(
        userId,
        action,
      );

      expect(result.content).toBe('Proactive joke response');
      expect(result.agentUsed).toBe('joke');
    });

    it('should throw error when agent is already active', async () => {
      // Set agent as active with current timestamp to ensure it's considered active
      const activeAgents = (testAgentService as any).activeAgents;
      activeAgents.set(userId, {
        agentType: 'joke',
        timestamp: new Date(), // Current timestamp ensures it's active
      });

      // Try to execute proactive action
      await expect(
        testAgentService.executeProactiveAction(userId, action),
      ).rejects.toThrow('Agent already active');
    });

    it('should queue action when agent is active', async () => {
      // Set agent as active with current timestamp
      const activeAgents = (testAgentService as any).activeAgents;
      activeAgents.set(userId, {
        agentType: 'joke',
        timestamp: new Date(), // Current timestamp ensures it's active
      });

      // Try to execute proactive action (should queue it)
      await expect(
        testAgentService.executeProactiveAction(userId, action),
      ).rejects.toThrow('Agent already active');

      // Verify action was queued
      const queuedActions = await testAgentService.getQueuedActions(userId);
      expect(queuedActions).toHaveLength(1);
      expect(queuedActions[0].type).toBe('entertainment_offer');
    });
  });

  describe('processMessageWithConversation', () => {
    const userId = 'test-user';

    beforeEach(() => {
      process.env.OPENAI_API_KEY = 'test-key';
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: 'Conversation response' } }],
        usage: { total_tokens: 30 },
      });
    });

    it('should initialize context for new user', async () => {
      mockConversationManager.getContext.mockReturnValue(null);

      const result = await testAgentService.processMessageWithConversation(
        userId,
        'Hello',
        [],
        'conv-123',
      );

      expect(mockConversationManager.initializeContext).toHaveBeenCalledWith(
        userId,
        'general',
      );
      expect(mockRouteMessage).toHaveBeenCalledWith('Hello', 'general', []);
      expect(mockConversationManager.updateContext).toHaveBeenCalled();
      expect(result.content).toBe('Conversation response');
    });

    it('should reuse existing context without re-initializing', async () => {
      mockConversationManager.getContext.mockReturnValue(
        makeContext({ currentAgent: 'joke', messageCount: 5 }),
      );

      const result = await testAgentService.processMessageWithConversation(
        userId,
        'Tell me another joke',
        [],
        'conv-123',
      );

      expect(mockConversationManager.initializeContext).not.toHaveBeenCalled();
      expect(mockRouteMessage).toHaveBeenCalledWith(
        'Tell me another joke',
        'joke',
        [],
      );
      expect(result.agentUsed).toBe('joke');
    });

    it('should hand off synchronously when router selects a new agent', async () => {
      // Current agent is joke; router detects billing intent.
      mockConversationManager.getContext.mockReturnValue(
        makeContext({ currentAgent: 'joke', messageCount: 3 }),
      );
      mockRouteMessage.mockResolvedValueOnce({
        selectedAgent: 'billing_support',
        handoff: true,
        confidence: 0.95,
        reason: 'keyword intent match: billing_support (1 keyword)',
        source: 'keyword',
      });

      const result = await testAgentService.processMessageWithConversation(
        userId,
        'I need help with my bill',
        [],
        'conv-123',
      );

      expect(result.agentUsed).toBe('billing_support');
      expect(result.handoffInfo).toBeDefined();
      expect(result.handoffInfo?.target).toBe('billing_support');
      expect(result.routingDecision?.source).toBe('keyword');
      expect(mockConversationManager.completeHandoff).toHaveBeenCalledWith(
        userId,
        'billing_support',
      );
    });

    it('should NOT hand off when router returns the sticky current agent', async () => {
      mockConversationManager.getContext.mockReturnValue(
        makeContext({ currentAgent: 'joke' }),
      );
      // Router default is sticky, no handoff.

      const result = await testAgentService.processMessageWithConversation(
        userId,
        'haha that was great',
        [],
        'conv-123',
      );

      expect(result.agentUsed).toBe('joke');
      expect(result.handoffInfo).toBeUndefined();
      expect(mockConversationManager.completeHandoff).not.toHaveBeenCalled();
    });

    it('should auto-handoff from hold_agent on first message', async () => {
      // First message in a hold_agent session must auto-route to one of the
      // entertainment agents even if the router stayed sticky.
      mockConversationManager.getContext.mockReturnValue(
        makeContext({ currentAgent: 'hold_agent', conversationDepth: 0 }),
      );
      mockRouteMessage.mockResolvedValueOnce({
        selectedAgent: 'hold_agent',
        handoff: false,
        confidence: 0.5,
        reason: 'sticky default',
        source: 'sticky',
      });

      const result = await testAgentService.processMessageWithConversation(
        userId,
        'hi',
        [],
        'conv-123',
      );

      const entertainmentAgents = [
        'joke',
        'trivia',
        'gif',
        'story_teller',
        'riddle_master',
        'quote_master',
        'game_host',
        'music_guru',
        'dnd_master',
      ];
      expect(entertainmentAgents).toContain(result.agentUsed);
      expect(result.handoffInfo).toBeDefined();
    });
  });

  describe('processMessageWithBothSystems', () => {
    const userId = 'test-user';

    beforeEach(() => {
      process.env.OPENAI_API_KEY = 'test-key';
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: 'Combined response' } }],
        usage: { total_tokens: 35 },
      });
    });

    it('should combine conversation and goal-seeking systems', async () => {
      mockConversationManager.getContext.mockReturnValue(
        makeContext({ currentAgent: 'general' }),
      );

      mockGoalSeekingSystem.generateProactiveActions.mockResolvedValue([]);

      const result = await testAgentService.processMessageWithBothSystems(
        userId,
        'Complex query',
        [],
        'conv-123',
      );

      expect(result.content).toBe('Combined response');
      expect(result.conversationContext).toBeDefined();
      expect(mockGoalSeekingSystem.updateUserState).toHaveBeenCalled();
      expect(mockConversationManager.updateContext).toHaveBeenCalled();
    });

    it('should prioritize goal-seeking when agent is forced', async () => {
      const contextObject = makeContext({ currentAgent: 'trivia' });

      // Mock both updateContext and getContext to return a context object
      mockConversationManager.updateContext.mockReturnValue(contextObject);
      mockConversationManager.getContext.mockReturnValue(contextObject);

      const result = await testAgentService.processMessageWithBothSystems(
        userId,
        'Test message',
        [],
        'conv-123',
        'trivia',
      );

      expect(result.agentUsed).toBe('trivia');
      expect(result.conversationContext).toBeDefined();
    });
  });

  describe('utility methods', () => {
    const userId = 'test-user';

    it('should check if user agent is active', () => {
      expect(testAgentService.isUserAgentActive(userId)).toBe(false);
    });

    it('should get active agent info', () => {
      const info = testAgentService.getActiveAgentInfo(userId);
      expect(info).toBeNull();
    });

    it('should get user goal state', () => {
      testAgentService.getUserGoalState(userId);
      expect(mockGoalSeekingSystem.getUserState).toHaveBeenCalledWith(userId);
    });

    it('should get user active goals', () => {
      testAgentService.getUserActiveGoals(userId);
      expect(mockGoalSeekingSystem.getActiveGoals).toHaveBeenCalledWith(userId);
    });

    it('should initialize user goals', () => {
      testAgentService.initializeUserGoals(userId);
      expect(mockGoalSeekingSystem.initializeUser).toHaveBeenCalledWith(userId);
    });

    it('should cleanup inactive users', () => {
      const maxInactiveTime = 60000;
      testAgentService.cleanupInactiveUsers(maxInactiveTime);

      expect(mockGoalSeekingSystem.cleanupInactiveUsers).toHaveBeenCalledWith(
        maxInactiveTime,
      );
      expect(mockConversationManager.cleanup).toHaveBeenCalledWith(
        maxInactiveTime,
      );
    });

    it('should get conversation context', () => {
      testAgentService.getConversationContext(userId);
      expect(mockConversationManager.getContext).toHaveBeenCalledWith(userId);
    });

    it('should force agent handoff synchronously by calling completeHandoff', () => {
      const context = makeContext({ currentAgent: 'general' });
      mockConversationManager.getContext.mockReturnValue(context);

      testAgentService.forceAgentHandoff(
        userId,
        'billing_support',
        'Manual override',
      );

      expect(mockConversationManager.completeHandoff).toHaveBeenCalledWith(
        userId,
        'billing_support',
      );
    });

    it('should initialize context on force handoff when no context exists', () => {
      mockConversationManager.getContext.mockReturnValue(null);

      testAgentService.forceAgentHandoff(
        userId,
        'billing_support',
        'Manual override',
      );

      expect(mockConversationManager.initializeContext).toHaveBeenCalledWith(
        userId,
        'billing_support',
      );
      expect(mockConversationManager.completeHandoff).not.toHaveBeenCalled();
    });

    it('should get current agent', () => {
      mockConversationManager.getContext.mockReturnValue(
        makeContext({ currentAgent: 'joke' }),
      );

      const currentAgent = testAgentService.getCurrentAgent(userId);
      expect(currentAgent).toBe('joke');
    });

    it('should return general agent as default', () => {
      mockConversationManager.getContext.mockReturnValue(null);

      const currentAgent = testAgentService.getCurrentAgent(userId);
      expect(currentAgent).toBe('general');
    });

    it('should initialize conversation', () => {
      testAgentService.initializeConversation(userId, 'trivia');

      expect(mockConversationManager.initializeContext).toHaveBeenCalledWith(
        userId,
        'trivia',
      );
    });
  });
});

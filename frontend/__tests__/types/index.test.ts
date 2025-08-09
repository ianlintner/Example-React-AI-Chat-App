import {
  Message,
  Conversation,
  User,
  ChatRequest,
  ChatResponse,
  StreamChunk,
  ApiError,
  Theme,
  AppSettings,
  AgentType,
  Agent,
  AgentStatus,
} from '../../types/index';

describe('Types', () => {
  describe('Message', () => {
    it('should have correct structure for a complete message', () => {
      const message: Message = {
        id: 'msg-123',
        content: 'Hello world',
        role: 'user',
        timestamp: new Date(),
        conversationId: 'conv-123',
        agentUsed: 'general',
        confidence: 0.95,
        isProactive: false,
        status: 'complete',
      };

      expect(message.id).toBe('msg-123');
      expect(message.role).toBe('user');
      expect(message.status).toBe('complete');
      expect(typeof message.confidence).toBe('number');
      expect(typeof message.isProactive).toBe('boolean');
    });

    it('should have correct structure for a minimal message', () => {
      const message: Message = {
        id: 'msg-456',
        content: 'Hi there',
        role: 'assistant',
        timestamp: new Date(),
        conversationId: 'conv-456',
      };

      expect(message.id).toBe('msg-456');
      expect(message.role).toBe('assistant');
      expect(message.agentUsed).toBeUndefined();
      expect(message.confidence).toBeUndefined();
    });
  });

  describe('Conversation', () => {
    it('should have correct structure', () => {
      const conversation: Conversation = {
        id: 'conv-789',
        title: 'Test Conversation',
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(conversation.id).toBe('conv-789');
      expect(conversation.title).toBe('Test Conversation');
      expect(Array.isArray(conversation.messages)).toBe(true);
      expect(conversation.createdAt instanceof Date).toBe(true);
    });
  });

  describe('User', () => {
    it('should have correct structure', () => {
      const user: User = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        createdAt: new Date(),
      };

      expect(user.id).toBe('user-123');
      expect(user.email).toBe('test@example.com');
      expect(user.name).toBe('Test User');
      expect(user.createdAt instanceof Date).toBe(true);
    });
  });

  describe('ChatRequest', () => {
    it('should have correct structure for complete request', () => {
      const request: ChatRequest = {
        message: 'Tell me a joke',
        conversationId: 'conv-123',
        stream: true,
        forceAgent: 'joke',
      };

      expect(request.message).toBe('Tell me a joke');
      expect(request.conversationId).toBe('conv-123');
      expect(request.stream).toBe(true);
      expect(request.forceAgent).toBe('joke');
    });

    it('should have correct structure for minimal request', () => {
      const request: ChatRequest = {
        message: 'Hello',
      };

      expect(request.message).toBe('Hello');
      expect(request.conversationId).toBeUndefined();
      expect(request.stream).toBeUndefined();
      expect(request.forceAgent).toBeUndefined();
    });
  });

  describe('ChatResponse', () => {
    it('should have correct structure', () => {
      const response: ChatResponse = {
        message: {
          id: 'msg-123',
          content: 'Here is a joke!',
          role: 'assistant',
          timestamp: new Date(),
          conversationId: 'conv-123',
        },
        conversation: {
          id: 'conv-123',
          title: 'Joke Chat',
          messages: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        agentUsed: 'joke',
        confidence: 0.98,
      };

      expect(response.agentUsed).toBe('joke');
      expect(response.confidence).toBe(0.98);
      expect(response.message.role).toBe('assistant');
    });
  });

  describe('StreamChunk', () => {
    it('should have correct structure', () => {
      const chunk: StreamChunk = {
        id: 'chunk-123',
        content: 'Partial response',
        conversationId: 'conv-123',
        messageId: 'msg-123',
        isComplete: false,
      };

      expect(chunk.id).toBe('chunk-123');
      expect(chunk.content).toBe('Partial response');
      expect(chunk.isComplete).toBe(false);
    });
  });

  describe('ApiError', () => {
    it('should have correct structure with details', () => {
      const error: ApiError = {
        message: 'Something went wrong',
        code: 'INTERNAL_ERROR',
        details: { statusCode: 500 },
      };

      expect(error.message).toBe('Something went wrong');
      expect(error.code).toBe('INTERNAL_ERROR');
      expect(error.details).toEqual({ statusCode: 500 });
    });

    it('should have correct structure without details', () => {
      const error: ApiError = {
        message: 'Bad request',
        code: 'BAD_REQUEST',
      };

      expect(error.message).toBe('Bad request');
      expect(error.code).toBe('BAD_REQUEST');
      expect(error.details).toBeUndefined();
    });
  });

  describe('Theme', () => {
    it('should support light mode', () => {
      const theme: Theme = {
        mode: 'light',
      };

      expect(theme.mode).toBe('light');
    });

    it('should support dark mode', () => {
      const theme: Theme = {
        mode: 'dark',
      };

      expect(theme.mode).toBe('dark');
    });
  });

  describe('AppSettings', () => {
    it('should have correct structure', () => {
      const settings: AppSettings = {
        theme: { mode: 'dark' },
        autoSave: true,
        modelPreference: 'gpt-4',
      };

      expect(settings.theme.mode).toBe('dark');
      expect(settings.autoSave).toBe(true);
      expect(settings.modelPreference).toBe('gpt-4');
    });
  });

  describe('AgentType', () => {
    it('should support all agent types', () => {
      const generalAgent: AgentType = 'general';
      const jokeAgent: AgentType = 'joke';
      const triviaAgent: AgentType = 'trivia';
      const gifAgent: AgentType = 'gif';
      const accountSupportAgent: AgentType = 'account_support';
      const billingSupportAgent: AgentType = 'billing_support';
      const websiteSupportAgent: AgentType = 'website_support';
      const operatorSupportAgent: AgentType = 'operator_support';
      const holdAgent: AgentType = 'hold_agent';
      const storyTellerAgent: AgentType = 'story_teller';
      const riddleMasterAgent: AgentType = 'riddle_master';
      const quoteMasterAgent: AgentType = 'quote_master';
      const gameHostAgent: AgentType = 'game_host';
      const musicGuruAgent: AgentType = 'music_guru';

      expect(generalAgent).toBe('general');
      expect(jokeAgent).toBe('joke');
      expect(triviaAgent).toBe('trivia');
      expect(gifAgent).toBe('gif');
      expect(accountSupportAgent).toBe('account_support');
      expect(billingSupportAgent).toBe('billing_support');
      expect(websiteSupportAgent).toBe('website_support');
      expect(operatorSupportAgent).toBe('operator_support');
      expect(holdAgent).toBe('hold_agent');
      expect(storyTellerAgent).toBe('story_teller');
      expect(riddleMasterAgent).toBe('riddle_master');
      expect(quoteMasterAgent).toBe('quote_master');
      expect(gameHostAgent).toBe('game_host');
      expect(musicGuruAgent).toBe('music_guru');
    });
  });

  describe('Agent', () => {
    it('should have correct structure', () => {
      const agent: Agent = {
        id: 'agent-123',
        name: 'General Assistant',
        description: 'A helpful general-purpose assistant',
      };

      expect(agent.id).toBe('agent-123');
      expect(agent.name).toBe('General Assistant');
      expect(agent.description).toBe('A helpful general-purpose assistant');
    });
  });

  describe('AgentStatus', () => {
    it('should have correct structure with all properties', () => {
      const status: AgentStatus = {
        currentAgent: 'general',
        isActive: true,
        activeAgentInfo: {
          agentType: 'general',
          timestamp: new Date(),
        },
        conversationContext: {
          currentAgent: 'general',
          conversationTopic: 'General discussion',
          conversationDepth: 5,
          userSatisfaction: 0.8,
          agentPerformance: 0.9,
          shouldHandoff: false,
          handoffTarget: 'joke',
          handoffReason: 'User wants entertainment',
        },
        goalState: {
          currentState: 'engaged',
          engagementLevel: 0.85,
          satisfactionLevel: 0.9,
          entertainmentPreference: 'humor',
          activeGoals: [
            {
              type: 'engagement',
              priority: 1,
              progress: 0.75,
            },
          ],
        },
        timestamp: new Date(),
        availableAgents: [
          {
            id: 'agent-1',
            name: 'General Agent',
            description: 'General purpose agent',
          },
        ],
      };

      expect(status.currentAgent).toBe('general');
      expect(status.isActive).toBe(true);
      expect(status.activeAgentInfo?.agentType).toBe('general');
      expect(status.conversationContext?.currentAgent).toBe('general');
      expect(status.goalState?.currentState).toBe('engaged');
      expect(Array.isArray(status.availableAgents)).toBe(true);
    });

    it('should have correct structure with minimal properties', () => {
      const status: AgentStatus = {
        currentAgent: 'general',
        isActive: false,
        activeAgentInfo: null,
        conversationContext: null,
        goalState: null,
        timestamp: new Date(),
        availableAgents: [],
      };

      expect(status.currentAgent).toBe('general');
      expect(status.isActive).toBe(false);
      expect(status.activeAgentInfo).toBe(null);
      expect(status.conversationContext).toBe(null);
      expect(status.goalState).toBe(null);
      expect(Array.isArray(status.availableAgents)).toBe(true);
    });
  });
});

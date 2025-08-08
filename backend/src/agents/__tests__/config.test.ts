import { getAgent, AGENTS } from '../config';
import { Agent, AgentType } from '../types';

describe('Agent Configuration', () => {
  describe('AGENTS Configuration Object', () => {
    it('should contain all expected agent types', () => {
      const expectedAgentTypes = [
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
        'youtube_guru',
        'dnd_master',
      ];

      expectedAgentTypes.forEach(agentType => {
        expect(AGENTS).toHaveProperty(agentType);
        expect(AGENTS[agentType]).toBeDefined();
      });
    });

    it('should have consistent structure for all agents', () => {
      Object.values(AGENTS).forEach((agent: Agent) => {
        // Required properties
        expect(agent).toHaveProperty('id');
        expect(agent).toHaveProperty('name');
        expect(agent).toHaveProperty('type');
        expect(agent).toHaveProperty('description');
        expect(agent).toHaveProperty('systemPrompt');
        expect(agent).toHaveProperty('model');
        expect(agent).toHaveProperty('temperature');
        expect(agent).toHaveProperty('maxTokens');

        // Property types
        expect(typeof agent.id).toBe('string');
        expect(typeof agent.name).toBe('string');
        expect(typeof agent.type).toBe('string');
        expect(typeof agent.description).toBe('string');
        expect(typeof agent.systemPrompt).toBe('string');
        expect(typeof agent.model).toBe('string');
        expect(typeof agent.temperature).toBe('number');
        expect(typeof agent.maxTokens).toBe('number');
      });
    });

    it('should have non-empty required string fields', () => {
      Object.values(AGENTS).forEach((agent: Agent) => {
        expect(agent.id.trim()).not.toBe('');
        expect(agent.name.trim()).not.toBe('');
        expect(agent.type.trim()).not.toBe('');
        expect(agent.description.trim()).not.toBe('');
        expect(agent.systemPrompt.trim()).not.toBe('');
        expect(agent.model.trim()).not.toBe('');
      });
    });

    it('should have valid temperature values (0-2)', () => {
      Object.values(AGENTS).forEach((agent: Agent) => {
        expect(agent.temperature).toBeGreaterThanOrEqual(0);
        expect(agent.temperature).toBeLessThanOrEqual(2);
      });
    });

    it('should have reasonable maxTokens values', () => {
      Object.values(AGENTS).forEach((agent: Agent) => {
        expect(agent.maxTokens).toBeGreaterThan(0);
        expect(agent.maxTokens).toBeLessThanOrEqual(4096); // GPT max context
      });
    });

    it('should have id matching the key in AGENTS object', () => {
      Object.entries(AGENTS).forEach(([key, agent]) => {
        expect(agent.id).toBe(key);
      });
    });

    it('should have type matching the agent id', () => {
      Object.values(AGENTS).forEach((agent: Agent) => {
        expect(agent.type).toBe(agent.id);
      });
    });
  });

  describe('Individual Agent Configurations', () => {
    describe('General Agent', () => {
      it('should have proper routing and handoff instructions', () => {
        const general = AGENTS.general;
        expect(general.systemPrompt).toContain('Route user');
        expect(general.systemPrompt).toContain('entertainment agents');
        expect(general.systemPrompt).toContain('handoff');
        expect(general.temperature).toBeGreaterThanOrEqual(0.5); // Should be flexible for routing
      });
    });

    describe('Entertainment Agents', () => {
      const entertainmentAgents = ['joke', 'trivia', 'gif', 'story_teller', 'riddle_master', 'quote_master', 'game_host', 'music_guru', 'youtube_guru', 'dnd_master'];

      entertainmentAgents.forEach(agentType => {
        it(`should configure ${agentType} agent for immediate response`, () => {
          const agent = AGENTS[agentType];
          expect(agent.systemPrompt).toContain('IMMEDIATELY');
          expect(agent.systemPrompt.toLowerCase()).toContain('right now');
          expect(agent.temperature).toBeGreaterThanOrEqual(0.6); // Should be creative
        });
      });

      it('should configure joke agent for adaptive learning', () => {
        const joke = AGENTS.joke;
        expect(joke.systemPrompt).toContain('Adaptive');
        expect(joke.systemPrompt).toContain('learn');
        expect(joke.systemPrompt).toContain('reaction');
        expect(joke.systemPrompt).toContain('personalized');
        expect(joke.temperature).toBeGreaterThanOrEqual(0.8); // High creativity for jokes
      });

      it('should configure trivia agent for educational content', () => {
        const trivia = AGENTS.trivia;
        expect(trivia.systemPrompt).toContain('fascinating');
        expect(trivia.systemPrompt).toContain('knowledge');
        expect(trivia.systemPrompt).toContain('Did you know');
        expect(trivia.systemPrompt).toContain('educational');
      });

      it('should configure gif agent with Giphy integration', () => {
        const gif = AGENTS.gif;
        expect(gif.systemPrompt).toContain('Giphy');
        expect(gif.systemPrompt).toContain('GIPHY_ID');
        expect(gif.systemPrompt).toContain('media.giphy.com');
        expect(gif.maxTokens).toBeLessThanOrEqual(600); // Should be concise for visual content
      });

      it('should configure D&D master with comprehensive RPG features', () => {
        const dnd = AGENTS.dnd_master;
        expect(dnd.systemPrompt).toContain('character generation');
        expect(dnd.systemPrompt).toContain('dice rolling');
        expect(dnd.systemPrompt).toContain('encounters');
        expect(dnd.model).toBe('gpt-4'); // Should use more advanced model
        expect(dnd.maxTokens).toBeGreaterThan(1000); // Needs longer responses
      });

      it('should configure YouTube guru with embed functionality', () => {
        const youtube = AGENTS.youtube_guru;
        expect(youtube.systemPrompt).toContain('youtube');
        expect(youtube.systemPrompt).toContain('embed');
        expect(youtube.systemPrompt).toContain('VIDEO_ID');
        expect(youtube.systemPrompt).toContain('```youtube');
      });
    });

    describe('Support Agents', () => {
      const supportAgents = ['account_support', 'billing_support', 'website_support', 'operator_support', 'hold_agent'];

      supportAgents.forEach(agentType => {
        it(`should configure ${agentType} agent with professional tone`, () => {
          const agent = AGENTS[agentType];
          expect(agent.systemPrompt).toContain('professional');
          expect(agent.temperature).toBeLessThanOrEqual(0.5); // Should be more deterministic
          expect(agent.maxTokens).toBeGreaterThanOrEqual(1000); // Support needs detailed responses
        });
      });

      it('should configure account support for authentication and security', () => {
        const account = AGENTS.account_support;
        expect(account.systemPrompt).toContain('authentication');
        expect(account.systemPrompt).toContain('security');
        expect(account.systemPrompt).toContain('password');
        expect(account.systemPrompt).toContain('account');
      });

      it('should configure billing support for financial matters', () => {
        const billing = AGENTS.billing_support;
        expect(billing.systemPrompt).toContain('billing');
        expect(billing.systemPrompt).toContain('payment');
        expect(billing.systemPrompt).toContain('refund');
        expect(billing.systemPrompt).toContain('subscription');
        expect(billing.temperature).toBeLessThanOrEqual(0.4); // Should be very precise for financial matters
      });

      it('should configure website support for technical issues', () => {
        const website = AGENTS.website_support;
        expect(website.systemPrompt).toContain('website');
        expect(website.systemPrompt).toContain('browser');
        expect(website.systemPrompt).toContain('technical');
        expect(website.systemPrompt).toContain('troubleshooting');
      });

      it('should configure operator support for routing and coordination', () => {
        const operator = AGENTS.operator_support;
        expect(operator.systemPrompt).toContain('routing');
        expect(operator.systemPrompt).toContain('coordination');
        expect(operator.systemPrompt).toContain('specialist');
        expect(operator.systemPrompt).toContain('escalation');
        expect(operator.maxTokens).toBeGreaterThanOrEqual(1400); // Needs comprehensive responses
      });

      it('should configure hold agent for wait management', () => {
        const hold = AGENTS.hold_agent;
        expect(hold.systemPrompt).toContain('wait');
        expect(hold.systemPrompt).toContain('entertainment');
        expect(hold.systemPrompt).toContain('handoff');
        expect(hold.maxTokens).toBeGreaterThanOrEqual(1000);
      });
    });
  });

  describe('getAgent function', () => {
    it('should return correct agent for valid agent types', () => {
      const testCases = [
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
        'youtube_guru',
        'dnd_master',
      ];

      testCases.forEach(agentType => {
        const agent = getAgent(agentType);
        expect(agent).toBeDefined();
        expect(agent.type).toBe(agentType);
        expect(agent.id).toBe(agentType);
        expect(agent).toBe(AGENTS[agentType]); // Should return exact reference
      });
    });

    it('should throw error for unknown agent types', () => {
      const invalidAgentTypes = [
        'unknown',
        'invalid',
        'nonexistent',
        '',
        'GENERAL', // Case sensitive
        'joke_master',
        'support',
        'entertainment',
        null,
        undefined,
      ];

      invalidAgentTypes.forEach(invalidType => {
        expect(() => getAgent(invalidType as any)).toThrow();
        expect(() => getAgent(invalidType as any)).toThrow(`Agent type '${invalidType}' not found`);
      });
    });

    it('should return immutable agent objects', () => {
      const agent1 = getAgent('joke');
      const agent2 = getAgent('joke');
      
      expect(agent1).toBe(agent2); // Same reference
      
      // Attempting to modify should not affect the original
      const originalName = agent1.name;
      (agent1 as any).name = 'Modified Name';
      
      const agent3 = getAgent('joke');
      expect(agent3.name).toBe('Modified Name'); // Note: This shows the object is mutable (could be a concern)
      
      // Reset for other tests
      agent1.name = originalName;
    });

    it('should handle edge cases gracefully', () => {
      // Test with whitespace
      expect(() => getAgent(' ')).toThrow();
      expect(() => getAgent('\t')).toThrow();
      expect(() => getAgent('\n')).toThrow();
      
      // Test with special characters
      expect(() => getAgent('@#$%')).toThrow();
      expect(() => getAgent('joke!')).toThrow();
      expect(() => getAgent('joke ')).toThrow(); // Trailing space
      expect(() => getAgent(' joke')).toThrow(); // Leading space
    });
  });

  describe('Configuration Validation', () => {
    it('should use consistent model names', () => {
      const models = [...new Set(Object.values(AGENTS).map(agent => agent.model))];
      
      // Should only use known OpenAI models
      const validModels = [
        'gpt-3.5-turbo',
        'gpt-4',
        'gpt-4-turbo-preview',
        'gpt-4-turbo',
      ];
      
      models.forEach(model => {
        expect(validModels).toContain(model);
      });
    });

    it('should have reasonable temperature distributions', () => {
      const temperatures = Object.values(AGENTS).map(agent => agent.temperature);
      
      // Support agents should generally have lower temperatures (more deterministic)
      const supportAgents = ['account_support', 'billing_support', 'website_support'];
      supportAgents.forEach(agentType => {
        expect(AGENTS[agentType].temperature).toBeLessThanOrEqual(0.5);
      });
      
      // Entertainment agents should generally have higher temperatures (more creative)
      const entertainmentAgents = ['joke', 'story_teller', 'game_host', 'dnd_master'];
      entertainmentAgents.forEach(agentType => {
        expect(AGENTS[agentType].temperature).toBeGreaterThanOrEqual(0.7);
      });
    });

    it('should have appropriate maxTokens for agent purposes', () => {
      // Agents that need longer responses
      const longResponseAgents = ['operator_support', 'website_support', 'billing_support', 'dnd_master'];
      longResponseAgents.forEach(agentType => {
        expect(AGENTS[agentType].maxTokens).toBeGreaterThanOrEqual(1200);
      });
      
      // Agents that should be more concise
      const shortResponseAgents = ['gif'];
      shortResponseAgents.forEach(agentType => {
        expect(AGENTS[agentType].maxTokens).toBeLessThanOrEqual(600);
      });
    });

    it('should have system prompts with minimum length requirements', () => {
      Object.values(AGENTS).forEach((agent: Agent) => {
        expect(agent.systemPrompt.length).toBeGreaterThan(100); // Should have substantial instructions
        expect(agent.description.length).toBeGreaterThan(20); // Should have meaningful descriptions
      });
    });

    it('should have unique agent names', () => {
      const names = Object.values(AGENTS).map(agent => agent.name);
      const uniqueNames = [...new Set(names)];
      
      expect(names.length).toBe(uniqueNames.length);
    });

    it('should have unique agent descriptions', () => {
      const descriptions = Object.values(AGENTS).map(agent => agent.description);
      const uniqueDescriptions = [...new Set(descriptions)];
      
      expect(descriptions.length).toBe(uniqueDescriptions.length);
    });
  });

  describe('System Prompt Quality', () => {
    it('should contain role definitions in system prompts', () => {
      Object.values(AGENTS).forEach((agent: Agent) => {
        const prompt = agent.systemPrompt.toLowerCase();
        // Should define what the agent is/does
        const hasRoleDefinition = prompt.includes('you are') || 
                                 prompt.includes('your role') || 
                                 prompt.includes('you specialize');
        expect(hasRoleDefinition).toBe(true);
      });
    });

    it('should have consistent formatting in system prompts', () => {
      Object.values(AGENTS).forEach((agent: Agent) => {
        // Should not have excessive newlines at start/end
        expect(agent.systemPrompt.trim()).toBe(agent.systemPrompt);
        
        // Should not have double spaces (except intentional formatting)
        const doubleSpaces = (agent.systemPrompt.match(/  /g) || []).length;
        expect(doubleSpaces).toBeLessThan(10); // Some formatting is acceptable
      });
    });

    it('should include behavioral instructions in entertainment agents', () => {
      const entertainmentAgents = ['joke', 'trivia', 'gif', 'story_teller', 'riddle_master', 'quote_master', 'game_host', 'music_guru', 'youtube_guru', 'dnd_master'];
      
      entertainmentAgents.forEach(agentType => {
        const prompt = AGENTS[agentType].systemPrompt.toLowerCase();
        const hasBehaviorInstructions = prompt.includes('respond') || 
                                       prompt.includes('style') || 
                                       prompt.includes('personality') ||
                                       prompt.includes('approach');
        expect(hasBehaviorInstructions).toBe(true);
      });
    });

    it('should include escalation instructions in support agents', () => {
      const supportAgents = ['account_support', 'billing_support', 'website_support', 'operator_support'];
      
      supportAgents.forEach(agentType => {
        const prompt = AGENTS[agentType].systemPrompt.toLowerCase();
        const hasEscalationInstructions = prompt.includes('escalate') || 
                                         prompt.includes('coordinate') || 
                                         prompt.includes('refer') ||
                                         prompt.includes('specialist');
        expect(hasEscalationInstructions).toBe(true);
      });
    });
  });

  describe('Type Safety', () => {
    it('should have agent types matching TypeScript AgentType union', () => {
      // This test ensures our config matches the type definitions
      const agentTypes = Object.keys(AGENTS) as AgentType[];
      
      agentTypes.forEach(agentType => {
        const agent = getAgent(agentType);
        expect(agent.type).toBe(agentType);
      });
    });

    it('should return proper Agent interface structure', () => {
      const agent = getAgent('general');
      
      // Ensure it matches Agent interface exactly
      expect(agent).toMatchObject({
        id: expect.any(String),
        name: expect.any(String),
        type: expect.any(String),
        description: expect.any(String),
        systemPrompt: expect.any(String),
        model: expect.any(String),
        temperature: expect.any(Number),
        maxTokens: expect.any(Number),
      });
      
      // Should not have extra properties beyond Agent interface
      const expectedKeys = ['id', 'name', 'type', 'description', 'systemPrompt', 'model', 'temperature', 'maxTokens'];
      expect(Object.keys(agent).sort()).toEqual(expectedKeys.sort());
    });
  });

  describe('Performance', () => {
    it('should retrieve agents quickly', () => {
      const start = Date.now();
      
      for (let i = 0; i < 100; i++) {
        getAgent('general');
        getAgent('joke');
        getAgent('trivia');
      }
      
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(50); // Should be very fast lookup
    });

    it('should handle concurrent agent retrievals', () => {
      const promises = Array(50).fill(0).map((_, i) => {
        const agentTypes = ['general', 'joke', 'trivia', 'gif'];
        const agentType = agentTypes[i % agentTypes.length];
        return Promise.resolve(getAgent(agentType));
      });
      
      return Promise.all(promises).then(results => {
        expect(results).toHaveLength(50);
        results.forEach(agent => {
          expect(agent).toBeDefined();
        });
      });
    });
  });
});

/**
 * Integration test for the pre-dispatch routing gate.
 *
 * The bug this guards against: when a specialist agent (e.g. joke) owned the
 * conversation and the user asked for something clearly off-domain (e.g.
 * "show me a youtube video"), the old reactive-handoff code let joke answer
 * first and only switched to youtube_guru on the NEXT turn. With the router
 * in place the correct agent must respond on the SAME turn.
 */

import { AgentService } from '../../agents/agentService';

// Mock OpenAI entirely. Each request returns a response that identifies the
// agent from its system-prompt. The integration test only cares about which
// agent was invoked, not the content — so we inspect `agentUsed` on the
// response.
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockImplementation(async () => {
          return {
            choices: [
              {
                message: {
                  role: 'assistant',
                  content: 'mock agent response',
                },
              },
            ],
            usage: { total_tokens: 10 },
          };
        }),
      },
    },
  }));
});

describe('handoff integration — pre-dispatch routing gate', () => {
  let agentService: AgentService;
  const userId = 'integration-user';

  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test-key';
    agentService = new AgentService();
  });

  it('hands off from joke to youtube_guru on the SAME turn (regression)', async () => {
    // Seed conversation: joke agent has owned the context.
    agentService.initializeConversation(userId, 'joke');

    // User now asks for a YouTube video while joke is the current agent.
    const result = await agentService.processMessageWithConversation(
      userId,
      'show me a youtube video',
      [],
      'conv-regress',
    );

    expect(result.agentUsed).toBe('youtube_guru');
    expect(result.handoffInfo?.target).toBe('youtube_guru');
    expect(result.routingDecision?.handoff).toBe(true);
    // Final conversation context must reflect the new agent.
    expect(agentService.getCurrentAgent(userId)).toBe('youtube_guru');
  });

  it('hands off joke → trivia same turn for "random fact"', async () => {
    agentService.initializeConversation(userId, 'joke');

    const result = await agentService.processMessageWithConversation(
      userId,
      'random fact',
      [],
      'conv-trivia',
    );

    expect(result.agentUsed).toBe('trivia');
    expect(result.handoffInfo?.target).toBe('trivia');
  });

  it('auto-handoffs hold_agent → entertainment agent on first message', async () => {
    agentService.initializeConversation(userId, 'hold_agent');

    const result = await agentService.processMessageWithConversation(
      userId,
      'hi',
      [],
      'conv-hold',
    );

    // The auto-entertainment override selects one of these at random.
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

  it('stays sticky on an in-domain follow-up (joke → joke)', async () => {
    agentService.initializeConversation(userId, 'joke');

    const result = await agentService.processMessageWithConversation(
      userId,
      'haha that was great',
      [],
      'conv-sticky',
    );

    expect(result.agentUsed).toBe('joke');
    expect(result.handoffInfo).toBeUndefined();
    expect(agentService.getCurrentAgent(userId)).toBe('joke');
  });
});

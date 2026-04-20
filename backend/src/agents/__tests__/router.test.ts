import { routeMessage, logRoutingDecision } from '../router';
import { classifyMessage } from '../classifier';
import { AgentType } from '../types';

jest.mock('../classifier');
jest.mock('../../tracing/tracer', () => ({
  addSpanEvent: jest.fn(),
}));

const mockClassifyMessage = classifyMessage as jest.MockedFunction<
  typeof classifyMessage
>;

describe('routeMessage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.OPENAI_API_KEY;
    // Default classifier fallback: no confident answer. Individual tests
    // override when they want classifier-path behavior.
    mockClassifyMessage.mockResolvedValue({
      agentType: 'general' as AgentType,
      confidence: 0.3,
      reasoning: 'fallback',
    });
  });

  it('routes "show me a youtube video" to youtube_guru as a handoff from joke', async () => {
    const decision = await routeMessage('show me a youtube video', 'joke');
    expect(decision.selectedAgent).toBe('youtube_guru');
    expect(decision.handoff).toBe(true);
    expect(decision.source).toBe('keyword');
  });

  it('routes "tell me a joke" to joke even from general', async () => {
    const decision = await routeMessage('tell me a joke', 'general');
    expect(decision.selectedAgent).toBe('joke');
    expect(decision.handoff).toBe(true);
    expect(decision.source).toBe('keyword');
  });

  it('routes "show me a gif" to gif from joke', async () => {
    const decision = await routeMessage('show me a gif', 'joke');
    expect(decision.selectedAgent).toBe('gif');
    expect(decision.handoff).toBe(true);
    expect(decision.source).toBe('keyword');
  });

  it('routes "random fact" to trivia', async () => {
    const decision = await routeMessage('random fact', 'general');
    expect(decision.selectedAgent).toBe('trivia');
    expect(decision.handoff).toBe(true);
    expect(decision.source).toBe('keyword');
  });

  it('routes "roll a d20" to dnd_master from joke', async () => {
    const decision = await routeMessage('roll a d20', 'joke');
    expect(decision.selectedAgent).toBe('dnd_master');
    expect(decision.handoff).toBe(true);
    expect(decision.source).toBe('keyword');
  });

  it('stays sticky on short acknowledgements with no keywords', async () => {
    const decision = await routeMessage("that's nice", 'joke');
    expect(decision.selectedAgent).toBe('joke');
    expect(decision.handoff).toBe(false);
    expect(decision.source).toBe('sticky');
  });

  it('tie-break: "funny youtube video" — youtube_guru wins over joke by priority', async () => {
    // Both buckets match ("funny" → joke, "youtube video" → youtube_guru).
    // PRIORITY order puts youtube_guru first, so it must win.
    const decision = await routeMessage('funny youtube video', 'general');
    expect(decision.selectedAgent).toBe('youtube_guru');
    expect(decision.source).toBe('keyword');
  });

  it('uses classifier result when no keyword matches and confidence is high', async () => {
    mockClassifyMessage.mockResolvedValueOnce({
      agentType: 'website_support' as AgentType,
      confidence: 0.8,
      reasoning: 'classified: support intent',
    });

    const decision = await routeMessage(
      'my dashboard looks broken after the update',
      'general',
    );

    expect(decision.selectedAgent).toBe('website_support');
    expect(decision.handoff).toBe(true);
    expect(decision.source).toBe('classifier');
  });

  it('falls through to sticky when classifier returns general', async () => {
    mockClassifyMessage.mockResolvedValueOnce({
      agentType: 'general' as AgentType,
      confidence: 0.8,
      reasoning: 'no specialist needed',
    });

    const decision = await routeMessage('just thinking out loud here', 'joke');
    expect(decision.selectedAgent).toBe('joke');
    expect(decision.handoff).toBe(false);
    expect(decision.source).toBe('sticky');
  });

  it('falls through to sticky when classifier throws', async () => {
    mockClassifyMessage.mockRejectedValueOnce(new Error('classifier exploded'));
    const decision = await routeMessage('random free-form message', 'trivia');
    expect(decision.selectedAgent).toBe('trivia');
    expect(decision.source).toBe('sticky');
  });

  it('treats empty input as a no-op sticky decision', async () => {
    const decision = await routeMessage('   ', 'joke');
    expect(decision.selectedAgent).toBe('joke');
    expect(decision.handoff).toBe(false);
    expect(decision.source).toBe('sticky');
    expect(mockClassifyMessage).not.toHaveBeenCalled();
  });

  it('never flags handoff when the keyword-selected agent equals currentAgent', async () => {
    const decision = await routeMessage('tell me a joke', 'joke');
    expect(decision.selectedAgent).toBe('joke');
    expect(decision.handoff).toBe(false);
    expect(decision.source).toBe('keyword');
  });
});

describe('logRoutingDecision', () => {
  const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);

  beforeEach(() => {
    logSpy.mockClear();
  });

  afterAll(() => {
    logSpy.mockRestore();
  });

  it('logs a handoff line when decision.handoff is true', () => {
    logRoutingDecision(
      {
        selectedAgent: 'youtube_guru' as AgentType,
        handoff: true,
        confidence: 0.9,
        reason: 'keyword match',
        source: 'keyword',
      },
      { currentAgent: 'joke' as AgentType, userId: 'u1' },
    );
    const calls = logSpy.mock.calls.flat().join('\n');
    expect(calls).toMatch(/ROUTER handoff joke → youtube_guru/);
  });

  it('logs a stick line when decision.handoff is false', () => {
    logRoutingDecision(
      {
        selectedAgent: 'joke' as AgentType,
        handoff: false,
        confidence: 0.5,
        reason: 'sticky default',
        source: 'sticky',
      },
      { currentAgent: 'joke' as AgentType, userId: 'u1' },
    );
    const calls = logSpy.mock.calls.flat().join('\n');
    expect(calls).toMatch(/ROUTER stick with joke/);
  });
});

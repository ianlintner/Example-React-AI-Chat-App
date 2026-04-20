import { AgentType } from './types';
import { Message } from '../types';
import { classifyMessage } from './classifier';
import { addSpanEvent } from '../tracing/tracer';
import type { Span } from '@opentelemetry/api';

/**
 * Pre-dispatch routing decision.
 *
 * This is produced by `routeMessage` BEFORE any agent is invoked, so the
 * correct agent handles the current turn even when the user's request does
 * not match the previously-selected agent. This fixes the classic
 * "handoff is one turn late" bug.
 */
export interface RoutingDecision {
  selectedAgent: AgentType;
  handoff: boolean;
  confidence: number;
  reason: string;
  source: 'keyword' | 'classifier' | 'sticky';
}

/**
 * Keyword tables per agent type. Ordering inside each list is irrelevant —
 * the tie-break priority below decides ordering between agents.
 *
 * Only include keywords that are strong, unambiguous intent signals. When in
 * doubt, defer to the classifier.
 */
const KEYWORDS: Record<string, string[]> = {
  youtube_guru: [
    'youtube',
    'youtube video',
    'yt video',
    'video',
    'viral video',
    'viral',
    'watch a video',
    'show me a video',
    'funny video',
    'entertaining video',
    'show me something funny',
  ],
  joke: [
    'joke',
    'jokes',
    'tell me a joke',
    'dad joke',
    'dad jokes',
    'pun',
    'puns',
    'make me laugh',
    'funny',
    'cheesy joke',
    'one-liner',
    'wordplay',
    'punchline',
  ],
  gif: [
    'gif',
    'gifs',
    'meme',
    'memes',
    'reaction gif',
    'animated image',
    'giphy',
    'tenor',
    'reaction image',
  ],
  trivia: [
    'trivia',
    'fun fact',
    'fun facts',
    'random fact',
    'random facts',
    'did you know',
    'tell me a fact',
    'share a fact',
    'interesting fact',
    'fascinating fact',
    'historical fact',
    'scientific fact',
  ],
  dnd_master: [
    'd&d',
    'dnd',
    'dungeons and dragons',
    'dungeon master',
    'rpg',
    'roll dice',
    'roll a d20',
    'roll a d6',
    'roll a d4',
    'roll a d8',
    'roll a d10',
    'roll a d12',
    'roll a d100',
    'dice roll',
    'character sheet',
    'adventure hook',
  ],
  story_teller: [
    'tell me a story',
    'story time',
    'short story',
    'bedtime story',
    'write a story',
    'tell a story',
  ],
  riddle_master: [
    'riddle',
    'riddles',
    'brain teaser',
    'brain teasers',
    'puzzle me',
    'give me a riddle',
  ],
  quote_master: [
    'quote',
    'quotes',
    'inspirational quote',
    'famous quote',
    'motivational quote',
    'share a quote',
  ],
  game_host: [
    'play a game',
    'play game',
    "let's play",
    'lets play',
    'start a game',
    'game time',
    '20 questions',
    'twenty questions',
    'word association',
    'would you rather',
    'trivia game',
    'party game',
  ],
  music_guru: [
    'music recommendation',
    'recommend music',
    'recommend a song',
    'song recommendation',
    'music suggestion',
    'playlist',
    'favorite artist',
    'band recommendation',
  ],
  account_support: [
    'login',
    'log in',
    'cannot log in',
    "can't log in",
    'password reset',
    'forgot my password',
    'account locked',
    'account security',
    'profile settings',
    'account support',
    'two-factor',
    '2fa',
  ],
  billing_support: [
    'billing',
    'invoice',
    'refund',
    'payment failed',
    'cancel subscription',
    'subscription',
    'pricing',
    'charge on my card',
    'credit card',
    'payment method',
    'billing issue',
  ],
  website_support: [
    'website broken',
    "website isn't working",
    "website won't load",
    'page not loading',
    '500 error',
    '404 error',
    'browser issue',
    'debug this code',
    'fix this code',
    'syntax error',
    'runtime error',
    'javascript error',
    'typescript error',
    'react component',
    'css bug',
    'html bug',
  ],
};

/**
 * Tie-break priority when multiple agents match keyword-wise. Agents earlier
 * in the list win. Rationale:
 *   - youtube_guru, joke, gif, trivia, dnd_master are very frequent user
 *     intents and map to dedicated entertainment agents, so we route there
 *     before falling back to more general specialists.
 *   - account/billing/website support come last; they are usually expressed
 *     with unambiguous phrases so keyword collision is unlikely.
 */
const PRIORITY: AgentType[] = [
  'youtube_guru',
  'joke',
  'gif',
  'trivia',
  'dnd_master',
  'story_teller',
  'riddle_master',
  'game_host',
  'music_guru',
  'quote_master',
  'account_support',
  'billing_support',
  'website_support',
];

function matchKeywords(lower: string): {
  agent: AgentType;
  matches: number;
} | null {
  const scores = new Map<AgentType, number>();

  for (const agent of PRIORITY) {
    const list = KEYWORDS[agent];
    if (!list) {
      continue;
    }
    let score = 0;
    for (const kw of list) {
      if (lower.includes(kw)) {
        score++;
      }
    }
    if (score > 0) {
      scores.set(agent, score);
    }
  }

  if (scores.size === 0) {
    return null;
  }

  // Priority order wins on ties; earlier in PRIORITY beats later regardless
  // of raw match count (we want youtube to beat trivia when both match,
  // even if trivia matched two keywords).
  for (const agent of PRIORITY) {
    const s = scores.get(agent);
    if (s !== undefined) {
      return { agent, matches: s };
    }
  }
  return null;
}

/**
 * Route an incoming user message to the correct agent BEFORE dispatch.
 *
 * Logic (first match wins):
 *   Step A — Explicit keyword intent.  If the message contains strong
 *            signals for a particular specialist, route there immediately.
 *   Step B — LLM intent classification.  If the classifier returns a
 *            non-`general` agent with reasonable confidence, trust it.
 *   Step C — Sticky default.  Otherwise keep the current agent.
 *
 * @param userMessage   The user's latest message text.
 * @param currentAgent  The agent currently owning the conversation.
 * @param _history      Conversation history (reserved for future scoring).
 */
// Bare greetings / acknowledgements. For these we intentionally skip the
// classifier — LLM classifiers tend to route neutral greetings to
// operator_support, which yanks users out of an ongoing entertainment flow.
const GREETING_RE =
  /^(hi+|hello+|hey+|yo|sup|howdy|hiya|greetings|good\s*(morning|afternoon|evening|day)|thanks?|thank\s*you|ok(ay)?|cool|nice|sure|yeah|yep|yup)[\s!?.…]*$/i;

export async function routeMessage(
  userMessage: string,
  currentAgent: AgentType,
  _history: Message[] = [],
): Promise<RoutingDecision> {
  const trimmed = (userMessage || '').trim();
  const lower = trimmed.toLowerCase();

  // Step 0: bare greeting / acknowledgement → always sticky with current
  // agent. Prevents generic "Hello" from being mis-classified to
  // operator_support mid-entertainment.
  if (trimmed.length > 0 && GREETING_RE.test(trimmed)) {
    return {
      selectedAgent: currentAgent,
      handoff: false,
      confidence: 0.9,
      reason: 'bare greeting/acknowledgement; staying with current agent',
      source: 'sticky',
    };
  }

  // Step A: explicit keyword intent
  const kw = matchKeywords(lower);
  if (kw) {
    return {
      selectedAgent: kw.agent,
      handoff: kw.agent !== currentAgent,
      confidence: Math.min(0.99, 0.8 + kw.matches * 0.05),
      reason: `keyword intent match: ${kw.agent} (${kw.matches} keyword${
        kw.matches === 1 ? '' : 's'
      })`,
      source: 'keyword',
    };
  }

  // Step B: classifier
  if (trimmed.length > 0) {
    try {
      const classification = await classifyMessage(trimmed);
      if (
        classification.agentType &&
        classification.agentType !== 'general' &&
        classification.confidence >= 0.6
      ) {
        return {
          selectedAgent: classification.agentType,
          handoff: classification.agentType !== currentAgent,
          confidence: classification.confidence,
          reason: `classifier: ${classification.reasoning}`,
          source: 'classifier',
        };
      }
    } catch (err) {
      // Swallow — fall through to sticky default.
      console.warn('routeMessage classifier failed:', err);
    }
  }

  // Step C: sticky default
  return {
    selectedAgent: currentAgent,
    handoff: false,
    confidence: 0.5,
    reason: 'no strong intent signal; staying with current agent',
    source: 'sticky',
  };
}

/**
 * Emit a routing decision as a tracing event and a structured console log.
 *
 * Keeping this in a single helper means every call site logs the same shape,
 * which makes post-hoc debugging of mis-routes much easier.
 */
export function logRoutingDecision(
  decision: RoutingDecision,
  ctx: {
    userId?: string;
    conversationId?: string;
    currentAgent: AgentType;
    messagePreview?: string;
  },
  span?: Span,
): void {
  const payload = {
    userId: ctx.userId,
    conversationId: ctx.conversationId,
    fromAgent: ctx.currentAgent,
    toAgent: decision.selectedAgent,
    handoff: decision.handoff,
    confidence: decision.confidence,
    reason: decision.reason,
    source: decision.source,
    messagePreview: ctx.messagePreview,
  };

  if (decision.handoff) {
    console.log(
      `🧭 ROUTER handoff ${ctx.currentAgent} → ${decision.selectedAgent} [${decision.source}] (conf=${decision.confidence.toFixed(2)}): ${decision.reason}`,
    );
  } else {
    console.log(
      `🧭 ROUTER stick with ${decision.selectedAgent} [${decision.source}] (conf=${decision.confidence.toFixed(2)}): ${decision.reason}`,
    );
  }

  if (span) {
    addSpanEvent(span, 'router.decision', {
      'router.from_agent': ctx.currentAgent,
      'router.to_agent': decision.selectedAgent,
      'router.handoff': decision.handoff,
      'router.confidence': decision.confidence,
      'router.source': decision.source,
      'router.reason': decision.reason.substring(0, 200),
    });
  }

  // Also emit a single-line JSON log for structured ingestion.
  try {
    console.log(`ROUTER_DECISION ${JSON.stringify(payload)}`);
  } catch {
    // ignore serialization issues
  }
}

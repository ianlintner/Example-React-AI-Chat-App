/**
 * The typed router: TypeSafe Jev choice → skill/tier/flags. Low margin or an
 * unavailable Jev falls back to structured LLM output. A deterministic default
 * covers `off`, tests and disasters. Shadow mode logs but never dispatches.
 */
import type { AgentUIMessage, RouteDecision, Tier } from '@agent-chat/contract';
import { classify } from './classify';
import type { RouterConfig } from './config';
import type { FallbackDecision, LlmRouter } from './fallback';
import type { JevClient, JevDecision } from './jev';
import { ROUTER_QUESTIONS, ROUTER_SKILLS } from './jev';
import type { RouteLogRow, RouteMetrics, RouteSink } from './observability';
import { noopMetrics, noopSink } from './observability';
import { redactText, sampleBucket } from './privacy';
import type { Principal, Router } from '../seams';

/** RouteDecision.mode is deliberately narrower than the feature flag. */
type DecisionMode = 'shadow' | 'live';

const SKILL_NAMES = Object.keys(ROUTER_SKILLS);
const TIER_NAMES = ['fast', 'deep', 'research'] as const;

function lastUserText(messages: AgentUIMessage[]): string {
  const last = [...messages].reverse().find(m => m.role === 'user');
  return (
    last?.parts
      .filter(
        (part): part is { type: 'text'; text: string } => part.type === 'text',
      )
      .map(part => part.text)
      .join('') ?? ''
  );
}

function id(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

/** Deterministic comparison baseline (keyword rules). Never used for `off`. */
export function baselineDecision(
  messages: AgentUIMessage[],
  mode: DecisionMode = 'shadow',
): RouteDecision {
  const outcome = classify(lastUserText(messages));
  return {
    decisionId: id('route'),
    ...outcome,
    confidence: 1,
    margin: 1,
    source: 'default',
    mode,
    rationale: 'deterministic baseline',
  };
}

/**
 * Exact pre-router dispatch: `general`/`fast`, with `deep` only above 800
 * characters. `ROUTER_MODE=off` must preserve today's cost profile.
 */
export function legacyDecision(
  messages: AgentUIMessage[],
  mode: DecisionMode = 'shadow',
): RouteDecision {
  const text = lastUserText(messages);
  return {
    decisionId: id('route'),
    skill: 'general',
    tier: text.length > 800 ? 'deep' : 'fast',
    needsResearch: false,
    needsPlan: false,
    confidence: 1,
    margin: 1,
    source: 'default',
    mode,
    rationale: 'baseline dispatch until the typed router is enabled',
  };
}

function fromJev(
  jev: JevDecision,
  mode: DecisionMode,
  config: RouterConfig,
): { decision: RouteDecision; margin: number; lowMargin: boolean } {
  const skill = SKILL_NAMES.includes(jev.skill.choice)
    ? jev.skill.choice
    : 'general';
  const tier = (TIER_NAMES as readonly string[]).includes(jev.tier.choice)
    ? (jev.tier.choice as Tier)
    : 'fast';
  const margin = Math.min(
    jev.skill.margin,
    jev.tier.margin,
    jev.research.margin,
    jev.plan.margin,
  );
  return {
    decision: {
      decisionId: id('route'),
      skill,
      tier,
      needsResearch: jev.research.choice === 'yes',
      needsPlan: jev.plan.choice === 'yes',
      confidence: Math.min(
        jev.skill.confidence,
        jev.tier.confidence,
        jev.research.confidence,
        jev.plan.confidence,
      ),
      margin,
      source: 'typed-router',
      mode,
      rationale: `Jev typed choice (${jev.model}); margin ${margin.toFixed(2)}`,
    },
    margin,
    lowMargin: margin < config.marginThreshold,
  };
}

function fromFallback(
  fallback: FallbackDecision,
  mode: DecisionMode,
): RouteDecision {
  return {
    decisionId: id('route'),
    skill: fallback.skill,
    tier: fallback.tier,
    needsResearch: fallback.needsResearch,
    needsPlan: fallback.needsPlan,
    confidence: 0.7,
    margin: 0,
    source: 'llm-fallback',
    mode,
    rationale: fallback.rationale.slice(0, 500),
  };
}

function agrees(a: RouteDecision, b: RouteDecision): boolean {
  return (
    a.skill === b.skill &&
    a.tier === b.tier &&
    a.needsResearch === b.needsResearch &&
    a.needsPlan === b.needsPlan
  );
}

export interface RouterDeps {
  config: RouterConfig;
  /** Injected in tests; built from config in production. */
  jev?: JevClient;
  llmRouter?: LlmRouter;
  sink?: RouteSink;
  metrics?: RouteMetrics;
  /** Inject a clock for deterministic latency assertions. */
  now?: () => number;
}

/**
 * A deadline that aborts in-flight network calls and rejects the proposed
 * decision. No third-party call can hold a chat turn past `timeoutMs`.
 */
interface Budget {
  signal: AbortSignal;
  timeout: Promise<never>;
  dispose(): void;
}

function budget(ms: number): Budget {
  const controller = new AbortController();
  let handle: ReturnType<typeof setTimeout> | undefined;
  let reject!: (reason: Error) => void;
  const timeout = new Promise<never>((_, rej) => {
    reject = rej;
  });
  handle = setTimeout(() => {
    controller.abort();
    reject(new Error('router_timeout'));
  }, ms);
  handle.unref?.();
  return {
    signal: controller.signal,
    timeout,
    dispose() {
      if (handle) clearTimeout(handle);
    },
  };
}

export function createRouter(deps: RouterDeps): Router {
  const {
    config,
    sink = noopSink,
    metrics = noopMetrics,
    now = () => Date.now(),
  } = deps;
  const mode = config.mode;
  // A client is created eagerly so an absent key fails at boot, not per turn.
  const jev = deps.jev;

  return {
    async decide({ principal, messages, context }) {
      const started = now();
      const text = lastUserText(messages);
      const dispatchMode: DecisionMode = mode === 'live' ? 'live' : 'shadow';

      if (mode === 'off') {
        // Preserve pre-router dispatch exactly: no keyword upgrades, no sink.
        return legacyDecision(messages, dispatchMode);
      }

      // Shadow must preserve pre-router dispatch exactly (general/fast). The
      // keyword baseline stays the logged comparison, never the dispatched
      // route, so shadow mode cannot upgrade a user to a costlier tier.
      const comparison = baselineDecision(messages, dispatchMode);
      const sampled =
        mode === 'live' ||
        sampleBucket(comparison.decisionId) < config.shadowSample;
      const shared = budget(config.timeoutMs);
      let proposed: RouteDecision | undefined;
      let fallbackReason: string | undefined;
      try {
        if (!sampled) {
          fallbackReason = 'sampled_out';
          metrics.fallback(fallbackReason);
        } else {
          const outgoing = config.redact
            ? redactText(text)
            : text.slice(0, 4000);
          try {
            if (!jev) throw new Error('jev_unavailable');
            const result = fromJev(
              await Promise.race([
                jev.classify({ text: outgoing, signal: shared.signal }),
                shared.timeout,
              ]),
              mode,
              config,
            );
            if (result.lowMargin) {
              fallbackReason = 'low_margin';
              metrics.fallback(fallbackReason);
            } else {
              proposed = result.decision;
            }
          } catch (error) {
            fallbackReason =
              (error instanceof Error && error.message === 'router_timeout') ||
              shared.signal.aborted
                ? 'router_timeout'
                : 'jev_unavailable';
            metrics.errors(fallbackReason);
            metrics.fallback(fallbackReason);
          }

          if (!proposed && deps.llmRouter) {
            try {
              // The shared deadline may already be spent; race again so a
              // stuck fallback cannot extend the request budget.
              proposed = fromFallback(
                await Promise.race([
                  deps.llmRouter.decide({
                    text: outgoing,
                    signal: shared.signal,
                  }),
                  shared.timeout,
                ]),
                mode,
              );
            } catch (error) {
              const reason =
                (error instanceof Error &&
                  error.message === 'router_timeout') ||
                shared.signal.aborted
                  ? 'router_timeout'
                  : 'llm_fallback_failed';
              metrics.errors(reason);
            }
          }
        }
      } finally {
        shared.dispose();
      }

      proposed ??= {
        ...comparison,
        source: 'default',
        rationale: fallbackReason ?? 'fallback_unavailable',
      };

      // The dispatched baseline must match the legacy route in off/shadow.
      // In live mode the typed decision is already dispatched below and the
      // keyword comparison is retained only for telemetry.
      const baseline = legacyDecision(messages, dispatchMode);
      const latencyMs = Math.max(0, now() - started);
      const agreed = agrees(proposed, comparison);
      metrics.decisions(
        {
          source: proposed.source,
          mode,
          skill: proposed.skill,
          tier: proposed.tier,
        },
        latencyMs,
        proposed.margin,
      );
      metrics.agreement(agreed);

      const decision = mode === 'live' ? proposed : baseline;
      const row: RouteLogRow = {
        decisionId: proposed.decisionId,
        threadId: context?.threadId ?? '',
        runId: context?.runId ?? '',
        ownerId: principal.userId,
        mode,
        source: proposed.source,
        skill: proposed.skill,
        tier: proposed.tier,
        needsResearch: proposed.needsResearch,
        needsPlan: proposed.needsPlan,
        confidence: proposed.confidence,
        margin: proposed.margin,
        proposed,
        baseline,
        comparison,
        agreement: agreed,
        latencyMs,
      };
      try {
        await sink.log(row);
      } catch {
        // Shadow logging must never break the user's chat.
        metrics.errors('sink_failed');
      }
      return decision;
    },
  };
}

export { ROUTER_QUESTIONS };

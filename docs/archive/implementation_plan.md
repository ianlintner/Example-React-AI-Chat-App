# Implementation Plan

[Overview]  
The goal is to make backend agents more reactive by reducing multi-turn delays when users express boredom or request entertainment, ensuring faster escalation to appropriate agents (e.g., YouTube Guru) without repetitive back-and-forth.

Currently, the system requires multiple exchanges before switching agents, leading to user frustration. The plan introduces a proactive boredom/entertainment intent evaluator within the backend agent pipeline. This evaluator will detect disengagement signals (e.g., "I am bored", "entertain me") and immediately escalate to entertainment agents. It will integrate with the existing classifier and goal-seeking system to minimize latency and improve responsiveness.

[Types]  
We will extend the backend type system to support boredom/engagement detection.

```ts
// backend/src/agents/types.ts
export interface EngagementSignal {
  type: 'boredom' | 'frustration' | 'entertainment_request';
  confidence: number; // 0-1
  triggerMessage: string;
}

export interface AgentEscalation {
  targetAgent: 'YouTubeGuru' | 'GameHost' | 'QuoteMaster' | 'GeneralAssistant';
  reason: string;
  autoEscalated: boolean;
}
```

[Files]  
We will add a new evaluator and modify existing agent orchestration.

- **New Files**:
  - `backend/src/agents/engagementEvaluator.ts` → Detects boredom/entertainment signals and produces `EngagementSignal`.
- **Modified Files**:
  - `backend/src/agents/classifier.ts` → Integrate engagement evaluator before classification fallback.
  - `backend/src/agents/agentService.ts` → Add escalation logic to switch agents immediately when engagement signals are detected.
  - `backend/src/agents/goalSeekingSystem.ts` → Update to consider engagement signals as high-priority goals.
- **No deletions**.
- **Config**:
  - Update `backend/package.json` if new NLP libraries are required (optional, may use regex + heuristics first).

[Functions]  
We will add new functions and modify existing ones.

- **New Functions**:
  - `detectEngagement(message: string): EngagementSignal | null` in `engagementEvaluator.ts`  
    → Uses regex + keyword spotting (e.g., "bored", "entertain", "show me video") with confidence scoring.
- **Modified Functions**:
  - `classifyMessage` in `classifier.ts` → Call `detectEngagement` before JSON classification. If engagement detected, short-circuit to escalation.
  - `processMessage` in `agentService.ts` → Accept `AgentEscalation` and reroute to entertainment agent immediately.
- **Removed Functions**: None.

[Classes]  
We will extend existing service classes.

- **Modified Classes**:
  - `AgentService` (`backend/src/agents/agentService.ts`) → Add method `handleEngagementEscalation(signal: EngagementSignal): AgentEscalation`.
- **New Classes**: None (functional module preferred).
- **Removed Classes**: None.

[Dependencies]  
No new dependencies required initially. Regex + heuristics suffice. Optional: add lightweight NLP (e.g., `compromise` or `natural`) if needed.

[Testing]  
We will add integration tests to ensure boredom detection triggers immediate escalation.

- **New Tests**:
  - `backend/src/agents/__tests__/engagementEvaluator.test.ts` → Unit tests for boredom/entertainment detection.
  - Extend `agentFlow.integration.test.ts` → Add scenario: user says "I am bored" → system escalates to YouTube Guru in one turn.
- **Modified Tests**:
  - Update classifier tests to ensure engagement detection bypasses JSON parse errors.

[Implementation Order]  
We will implement in the following sequence:

1. Create `engagementEvaluator.ts` with boredom/entertainment detection.
2. Integrate evaluator into `classifier.ts` before JSON classification.
3. Update `agentService.ts` to handle escalations.
4. Update `goalSeekingSystem.ts` to prioritize engagement signals.
5. Add unit tests for evaluator.
6. Add integration tests for end-to-end boredom → YouTube Guru escalation.
7. Validate with existing test suite.
8. Optimize thresholds and fallback strategies.

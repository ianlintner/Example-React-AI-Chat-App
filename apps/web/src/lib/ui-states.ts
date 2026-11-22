/**
 * Deterministic UI states for screenshot/Storybook coverage.
 * All payloads come from the frozen contract fixtures; nothing here defines
 * a new wire type. The eight states mirror RESEARCH-UI.md §3 pattern 14.
 */
import {
  approvalRequestFixture,
  artifactFixture,
  citationFixture,
  handoffFixture,
  planFixture,
  routeDecisionFixture,
  stepFixture,
} from '@agent-chat/contract/fixtures';

export const AI_STATES = [
  'empty',
  'streaming',
  'tool-running',
  'awaiting-approval',
  'plan-in-progress',
  'research-report',
  'error',
  'rate-limited',
] as const;

export type AiState = (typeof AI_STATES)[number];

export interface PreviewMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  /** Bounded, fixture-derived annotations rendered by agent panels. */
  annotations?: PreviewAnnotations;
}

export interface PreviewAnnotations {
  reasoning?: string;
  tool?: {
    name: string;
    args: string;
    status: 'running' | 'ok' | 'error';
    duration: string;
  };
  route?: typeof routeDecisionFixture;
  handoff?: typeof handoffFixture;
  plan?: typeof planFixture;
  step?: typeof stepFixture;
  approval?: typeof approvalRequestFixture;
  citation?: typeof citationFixture;
  artifact?: typeof artifactFixture;
}

export interface PreviewState {
  label: string;
  status: 'idle' | 'running' | 'attention' | 'error' | 'limited';
  messages: PreviewMessage[];
  banner?: {
    tone: 'error' | 'warn';
    title: string;
    body: string;
    action?: string;
  };
}

const userAsk: PreviewMessage = {
  id: 'msg_user',
  role: 'user',
  text: 'Compare three local vector databases and recommend one.',
};

export const previewStates: Record<AiState, PreviewState> = {
  empty: {
    label: 'Start a run',
    status: 'idle',
    messages: [],
  },
  streaming: {
    label: 'Streaming',
    status: 'running',
    messages: [
      userAsk,
      {
        id: 'msg_stream',
        role: 'assistant',
        text: 'Looking at the primary sources for pgvector, Qdrant and Weaviate…',
        annotations: { reasoning: 'Comparing index types and query latency.' },
      },
    ],
  },
  'tool-running': {
    label: 'Tool running',
    status: 'running',
    messages: [
      userAsk,
      {
        id: 'msg_tool',
        role: 'assistant',
        text: 'Reading benchmark pages.',
        annotations: {
          tool: {
            name: 'web_fetch',
            args: 'urls: 3 pages from example.com/pgvector',
            status: 'running',
            duration: '1.4s',
          },
        },
      },
    ],
  },
  'awaiting-approval': {
    label: 'Needs approval',
    status: 'attention',
    messages: [
      userAsk,
      {
        id: 'msg_approval',
        role: 'assistant',
        text: 'The next step fetches external pages. Confirm the payload below.',
        annotations: { approval: approvalRequestFixture },
      },
    ],
  },
  'plan-in-progress': {
    label: 'Plan in progress',
    status: 'running',
    messages: [
      userAsk,
      {
        id: 'msg_plan',
        role: 'assistant',
        text: 'Working through step 2 of 3.',
        annotations: {
          route: routeDecisionFixture,
          handoff: handoffFixture,
          plan: planFixture,
          step: stepFixture,
        },
      },
    ],
  },
  'research-report': {
    label: 'Research report',
    status: 'idle',
    messages: [
      userAsk,
      {
        id: 'msg_report',
        role: 'assistant',
        text: 'Use pgvector [cite_001] for this workload.',
        annotations: {
          citation: citationFixture,
          artifact: artifactFixture,
        },
      },
    ],
  },
  error: {
    label: 'Run failed',
    status: 'error',
    messages: [
      userAsk,
      {
        id: 'msg_error_assistant',
        role: 'assistant',
        text: 'I stopped before making any changes.',
      },
    ],
    banner: {
      tone: 'error',
      title: 'The run stopped at step 2.',
      body: 'Completed work is saved. No external changes were made. Retry only the failed step.',
      action: 'Retry step 2',
    },
  },
  'rate-limited': {
    label: 'Rate limited',
    status: 'limited',
    messages: [],
    banner: {
      tone: 'warn',
      title: 'Daily run limit reached.',
      body: 'Local chat still works with the fast route. The research route resets at 09:00.',
    },
  },
};

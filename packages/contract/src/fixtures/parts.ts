/**
 * Canonical example payloads for every data part. Used by contract tests,
 * Storybook stories, MSW handlers and Playwright screenshot states.
 * Deterministic: fixed ids and timestamps, no randomness.
 */
import type {
  AgentDataParts,
  DataPartName,
  MediaAttachment,
} from '../data-parts';

export const FIXED_TIME = '2026-11-21T12:00:00.000Z';

export const routeDecisionFixture: AgentDataParts['route-decision'] = {
  decisionId: 'rd_001',
  skill: 'deep-research',
  tier: 'research',
  needsResearch: true,
  needsPlan: true,
  confidence: 0.86,
  margin: 0.41,
  source: 'typed-router',
  mode: 'shadow',
  rationale: 'Asks for a sourced comparison across several vendors.',
};

export const planFixture: AgentDataParts['plan'] = {
  planId: 'plan_001',
  goal: 'Compare three local vector databases and recommend one.',
  revision: 0,
  steps: [
    {
      stepId: 'step_1',
      title: 'Collect candidate databases',
      successPredicate: 'At least 3 candidates with official docs URLs',
      status: 'succeeded',
    },
    {
      stepId: 'step_2',
      title: 'Benchmark claims from primary sources',
      successPredicate: 'Each candidate has ≥2 cited performance claims',
      status: 'running',
    },
    {
      stepId: 'step_3',
      title: 'Write recommendation report',
      successPredicate: 'Report cites every claim and names a winner',
      status: 'pending',
    },
  ],
};

export const stepFixture: AgentDataParts['step'] = {
  stepId: 'step_2',
  planId: 'plan_001',
  status: 'running',
  attempt: 1,
  startedAt: FIXED_TIME,
};

export const approvalRequestFixture: AgentDataParts['approval-request'] = {
  approvalId: 'appr_001',
  toolName: 'web_fetch',
  toolCallId: 'call_001',
  runId: 'run_001',
  risk: 'external',
  summary: 'Fetch 3 pages from pgvector.dev to read benchmark details.',
  payload: {
    urls: [
      'https://example.com/pgvector/benchmarks',
      'https://example.com/pgvector/hnsw',
      'https://example.com/pgvector/ivfflat',
    ],
  },
  status: 'pending',
  expiresAt: '2026-11-21T12:15:00.000Z',
};

export const citationFixture: AgentDataParts['citation'] = {
  citationId: 'cite_001',
  sourceId: 'src_001',
  url: 'https://example.com/pgvector/hnsw',
  title: 'HNSW indexes in pgvector',
  publisher: 'example.com',
  excerpt: 'HNSW indexes offer better query performance than IVFFlat.',
  claim: 'pgvector HNSW beats IVFFlat on query latency.',
  retrievedAt: FIXED_TIME,
};

export const artifactFixture: AgentDataParts['artifact'] = {
  artifactId: 'art_001',
  kind: 'report',
  title: 'Local vector database recommendation',
  version: 1,
  content: '# Recommendation\n\nUse **pgvector** [cite_001].\n',
};

export const mediaAttachmentsFixture: MediaAttachment[] = [
  {
    id: 'media_youtube',
    type: 'youtube',
    videoId: 'dQw4w9WgXcQ',
    title: 'Clean comedy sketch',
    channel: 'Example Channel',
    thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
    duration: '4:32',
  },
  {
    id: 'media_gif',
    type: 'gif',
    url: 'https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif',
    title: 'Celebration',
    width: 480,
    height: 270,
  },
  {
    id: 'media_audio',
    type: 'audio',
    url: 'https://example.com/preview.mp3',
    title: 'Example Track',
    artist: 'Example Artist',
    durationSec: 30,
  },
  {
    id: 'media_image',
    type: 'image',
    url: 'https://example.com/poster.png',
    alt: 'A poster',
    width: 640,
    height: 480,
  },
  {
    id: 'media_gallery',
    type: 'image_gallery',
    images: [{ url: 'https://example.com/1.png', alt: 'First' }],
  },
  {
    id: 'media_video',
    type: 'video',
    url: 'https://example.com/clip.mp4',
    title: 'A clip',
    poster: 'https://example.com/clip.png',
  },
  {
    id: 'media_dice',
    type: 'dice',
    notation: '2d6+3',
    rolls: [4, 2],
    total: 9,
    purpose: 'Attack roll',
  },
  {
    id: 'media_card',
    type: 'card',
    kind: 'character',
    title: 'Bram the Bold',
    fields: [{ label: 'Level', value: '3' }],
    accentColor: '#7c3aed',
  },
];

export const mediaArtifactFixture: AgentDataParts['artifact'] = {
  artifactId: 'art_media_001',
  kind: 'media',
  title: 'YouTube result',
  version: 1,
  attachments: mediaAttachmentsFixture.slice(0, 1),
};

export const mcpAppArtifactFixture: AgentDataParts['artifact'] = {
  artifactId: 'art_mcp_001',
  kind: 'mcp-app',
  title: 'Interactive result',
  version: 1,
  uri: 'ui://tools/dice-roller',
};

export const handoffFixture: AgentDataParts['handoff'] = {
  handoffId: 'ho_001',
  from: 'router',
  to: 'deep-research',
  reason: 'needs citations',
  contextSummary: 'User wants a sourced recommendation.',
};

export const validPartFixtures: {
  [K in DataPartName]: AgentDataParts[K];
} = {
  'route-decision': routeDecisionFixture,
  plan: planFixture,
  step: stepFixture,
  'approval-request': approvalRequestFixture,
  citation: citationFixture,
  artifact: artifactFixture,
  handoff: handoffFixture,
};

/** Payloads that MUST be rejected — one representative violation each. */
export const invalidPartFixtures: { [K in DataPartName]: unknown } = {
  'route-decision': { ...routeDecisionFixture, confidence: 1.5 },
  plan: { ...planFixture, revision: 4 },
  step: { ...stepFixture, attempt: 0 },
  'approval-request': { ...approvalRequestFixture, payload: undefined },
  citation: { ...citationFixture, url: 'javascript:alert(1)' },
  artifact: { ...artifactFixture, kind: 'mcp-app', uri: 'https://x.test' },
  handoff: { ...handoffFixture, reason: '' },
};

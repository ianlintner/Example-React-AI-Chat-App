/**
 * Custom data parts carried on the AI SDK UI message stream.
 *
 * Each schema validates the `data` payload of a `data-<name>` chunk/part.
 * Parts that describe a long-lived entity (plan, step, artifact, approval)
 * MUST be written with a stable chunk `id` equal to that entity's id, so the
 * client reconciles later writes in place instead of appending duplicates.
 *
 * Compatibility rule (see docs/adr/0002-stream-contract.md): adding an
 * optional field is a minor change; renaming, removing, narrowing an enum or
 * making a field required is a breaking change and needs a new ADR.
 */
import { z } from 'zod';

const id = z.string().min(1).max(128);
const isoDate = z.iso.datetime({ offset: true });

/** Model tier. The app never names a model; tiers map to env route names. */
export const tierSchema = z.enum(['fast', 'deep', 'research']);
export type Tier = z.infer<typeof tierSchema>;

/** Pre-dispatch routing decision ("why this agent/route"). */
export const routeDecisionSchema = z.object({
  decisionId: id,
  skill: z.string().min(1).max(64),
  tier: tierSchema,
  needsResearch: z.boolean(),
  needsPlan: z.boolean(),
  /** Calibrated probability of the chosen option, 0..1. */
  confidence: z.number().min(0).max(1),
  /** Gap between the top two options, 0..1. Low margin triggers fallback. */
  margin: z.number().min(0).max(1),
  source: z.enum(['typed-router', 'llm-fallback', 'default']),
  /** shadow: logged only, did not affect dispatch. live: drove dispatch. */
  mode: z.enum(['shadow', 'live']),
  rationale: z.string().max(500),
});
export type RouteDecision = z.infer<typeof routeDecisionSchema>;

export const stepStatusSchema = z.enum([
  'pending',
  'running',
  'succeeded',
  'failed',
  'skipped',
  'awaiting-approval',
]);
export type StepStatus = z.infer<typeof stepStatusSchema>;

/** A goal plan. Each step carries an executable success predicate. */
export const planSchema = z.object({
  planId: id,
  goal: z.string().min(1).max(2000),
  /** 0 for the first plan; incremented on each replan (budget: 3). */
  revision: z.number().int().min(0).max(3),
  steps: z
    .array(
      z.object({
        stepId: id,
        title: z.string().min(1).max(200),
        /** Human-readable form of the predicate checked after the step. */
        successPredicate: z.string().min(1).max(500),
        status: stepStatusSchema,
      }),
    )
    .min(1)
    .max(50),
});
export type Plan = z.infer<typeof planSchema>;

/** Progress of one plan step (or a standalone agent step). */
export const stepSchema = z.object({
  stepId: id,
  planId: id.optional(),
  status: stepStatusSchema,
  attempt: z.number().int().min(1),
  startedAt: isoDate.optional(),
  endedAt: isoDate.optional(),
  summary: z.string().max(2000).optional(),
  /** Result of evaluating the step's success predicate, when evaluated. */
  predicatePassed: z.boolean().optional(),
  error: z.string().max(2000).optional(),
});
export type Step = z.infer<typeof stepSchema>;

/** Human-in-the-loop approval request: always shows the real payload. */
export const approvalRequestSchema = z.object({
  approvalId: id,
  toolName: z.string().min(1).max(128),
  /** Correlates with an AI SDK tool call when the gate is a tool call. */
  toolCallId: id.optional(),
  runId: id.optional(),
  risk: z.enum(['read', 'write', 'external', 'spend']),
  /** One-line description of the consequence of approving. */
  summary: z.string().min(1).max(500),
  /** The exact arguments that will execute if approved (secrets masked). */
  payload: z.record(z.string(), z.unknown()),
  status: z.enum(['pending', 'approved', 'denied', 'expired']),
  expiresAt: isoDate.optional(),
});
export type ApprovalRequest = z.infer<typeof approvalRequestSchema>;

/** Claim-level citation pointing at a supporting source excerpt. */
export const citationSchema = z.object({
  citationId: id,
  sourceId: id,
  url: z.url({ protocol: /^https?$/ }),
  title: z.string().min(1).max(300),
  publisher: z.string().max(120).optional(),
  /** Supporting excerpt shown in the hover card. */
  excerpt: z.string().min(1).max(2000),
  /** The claim in the answer this citation supports. */
  claim: z.string().max(1000).optional(),
  retrievedAt: isoDate.optional(),
});
export type Citation = z.infer<typeof citationSchema>;

/**
 * Media attachments are the typed output of entertainment tools (card 6).
 * Ported from the legacy `MediaAttachment` union (`backend/src/types.ts:3-55`)
 * so renderers on every surface agree on the shape. URLs are always https
 * except for local dev loopback media, to keep sandboxed rendering safe.
 */
const httpsUrl = z.url({ protocol: /^https$/ });
const mediaId = z.string().min(1).max(128);

export const youtubeAttachmentSchema = z.object({
  id: mediaId,
  type: z.literal('youtube'),
  videoId: z
    .string()
    .regex(/^[A-Za-z0-9_-]{6,20}$/, 'invalid YouTube video id'),
  title: z.string().min(1).max(300),
  channel: z.string().max(200).optional(),
  thumbnail: httpsUrl,
  duration: z.string().max(20).optional(),
});

export const videoAttachmentSchema = z.object({
  id: mediaId,
  type: z.literal('video'),
  url: httpsUrl,
  title: z.string().min(1).max(300),
  poster: httpsUrl.optional(),
});

export const audioAttachmentSchema = z.object({
  id: mediaId,
  type: z.literal('audio'),
  url: httpsUrl,
  title: z.string().min(1).max(300),
  artist: z.string().max(200).optional(),
  durationSec: z.number().int().min(0).optional(),
});

export const imageAttachmentSchema = z.object({
  id: mediaId,
  type: z.literal('image'),
  url: httpsUrl,
  alt: z.string().min(1).max(300),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});

export const imageGalleryAttachmentSchema = z.object({
  id: mediaId,
  type: z.literal('image_gallery'),
  images: z
    .array(z.object({ url: httpsUrl, alt: z.string().min(1).max(300) }))
    .min(1)
    .max(20),
});

export const gifAttachmentSchema = z.object({
  id: mediaId,
  type: z.literal('gif'),
  url: httpsUrl,
  title: z.string().max(300).optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});

export const diceAttachmentSchema = z.object({
  id: mediaId,
  type: z.literal('dice'),
  notation: z.string().regex(/^\d*d\d+([+-]\d+)?$/i, 'invalid dice notation'),
  rolls: z.array(z.number().int().min(1)).min(1).max(100),
  total: z.number().int(),
  purpose: z.string().max(300).optional(),
});

export const cardAttachmentSchema = z.object({
  id: mediaId,
  type: z.literal('card'),
  kind: z.string().min(1).max(64),
  title: z.string().min(1).max(300),
  fields: z
    .array(
      z.object({
        label: z.string().min(1).max(100),
        value: z.string().max(1000),
      }),
    )
    .max(30),
  accentColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'accentColor must be a hex colour')
    .optional(),
});

export const mediaAttachmentSchema = z.discriminatedUnion('type', [
  youtubeAttachmentSchema,
  videoAttachmentSchema,
  audioAttachmentSchema,
  imageAttachmentSchema,
  imageGalleryAttachmentSchema,
  gifAttachmentSchema,
  diceAttachmentSchema,
  cardAttachmentSchema,
]);
export type MediaAttachment = z.infer<typeof mediaAttachmentSchema>;

/** Versioned artifact rendered in the canvas side panel. */
export const artifactSchema = z
  .object({
    artifactId: id,
    kind: z.enum(['report', 'markdown', 'code', 'table', 'mcp-app', 'media']),
    title: z.string().min(1).max(200),
    version: z.number().int().min(1),
    /** Inline content (markdown/code/table JSON). */
    content: z.string().max(500_000).optional(),
    /** `ui://` resource for MCP Apps, rendered in a sandboxed iframe. */
    uri: z.string().max(2000).optional(),
    language: z.string().max(40).optional(),
    /**
     * Typed media payloads for `kind: 'media'` tool results. Additive field
     * (CONTRACT_VERSION stays 1.0.0; see docs/adr/0002-stream-contract.md).
     */
    attachments: z.array(mediaAttachmentSchema).min(1).max(20).optional(),
  })
  .refine(
    a =>
      a.content !== undefined ||
      a.uri !== undefined ||
      a.attachments !== undefined,
    {
      message: 'artifact needs content, uri or attachments',
    },
  )
  .refine(a => a.kind !== 'mcp-app' || a.uri?.startsWith('ui://'), {
    message: 'mcp-app artifacts must reference a ui:// resource',
  });
export type Artifact = z.infer<typeof artifactSchema>;

/** Transfer of control between skills/sub-agents ("Research → Writer"). */
export const handoffSchema = z.object({
  handoffId: id,
  from: z.string().min(1).max(64),
  to: z.string().min(1).max(64),
  reason: z.string().min(1).max(500),
  /** What context is carried across (summary, not raw transcript). */
  contextSummary: z.string().max(2000).optional(),
});
export type Handoff = z.infer<typeof handoffSchema>;

/**
 * Map of data part name → schema. Pass to AI SDK `validateUIMessages`
 * (`dataSchemas`) on the server and `useChat`/`Chat` (`dataPartSchemas`) on
 * the client. Keys are the `<name>` in `data-<name>`.
 */
export const dataPartSchemas = {
  'route-decision': routeDecisionSchema,
  plan: planSchema,
  step: stepSchema,
  'approval-request': approvalRequestSchema,
  citation: citationSchema,
  artifact: artifactSchema,
  handoff: handoffSchema,
} as const;

export type DataPartName = keyof typeof dataPartSchemas;
export const dataPartNames = Object.keys(dataPartSchemas) as DataPartName[];

/** `data` payload types keyed by part name (AI SDK `UIDataTypes`). */
export type AgentDataParts = {
  [K in DataPartName]: z.infer<(typeof dataPartSchemas)[K]>;
};

/**
 * Router configuration. Fail closed: JEV_API_KEY has no default. A key is
 * required only when the router would actually call Jev (shadow/live with a
 * typed-router source); `off` and tests never need one.
 */
import { z } from 'zod';

/** off: baseline only. shadow: log/compare only. live: drive dispatch. */
export const routerModeSchema = z.enum(['off', 'shadow', 'live']);
export type RouterMode = z.infer<typeof routerModeSchema>;

export const routerEnvSchema = z.object({
  ROUTER_MODE: routerModeSchema.default('off'),
  /** api.typesafe.ai base URL; override only for local mocks. */
  JEV_BASE_URL: z
    .url({ protocol: /^https?$/ })
    .default('https://api.typesafe.ai'),
  /** No default secret. Required when the typed router is enabled. */
  JEV_API_KEY: z.string().min(1).optional(),
  /** Model alias from GET /v1/models. A name, never a hard-coded secret. */
  JEV_MODEL: z.string().min(1).default('jev-latest'),
  /** Below this top-two probability gap, fall back to the LLM router. */
  ROUTER_MARGIN_THRESHOLD: z.coerce.number().min(0).max(1).default(0.15),
});

export interface RouterConfig {
  mode: RouterMode;
  jevBaseUrl: string;
  jevApiKey: string | undefined;
  jevModel: string;
  marginThreshold: number;
}

/** Parse env; errors name variables, never values (no secret echo). */
export function loadRouterConfig(
  env: Record<string, string | undefined> = process.env,
): RouterConfig {
  const parsed = routerEnvSchema.safeParse(env);
  if (!parsed.success) {
    const fields = parsed.error.issues
      .map(i => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    throw new Error(`Invalid router configuration: ${fields}`);
  }
  const e = parsed.data;
  if (e.ROUTER_MODE !== 'off' && !e.JEV_API_KEY) {
    throw new Error(
      'Invalid router configuration: JEV_API_KEY: required when ROUTER_MODE is shadow or live',
    );
  }
  if (e.ROUTER_MODE !== 'off' && e.ROUTER_MARGIN_THRESHOLD <= 0) {
    // A zero threshold would silently disable the documented fallback.
    throw new Error(
      'Invalid router configuration: ROUTER_MARGIN_THRESHOLD: must be > 0 when the router is enabled',
    );
  }
  return {
    mode: e.ROUTER_MODE,
    jevBaseUrl: e.JEV_BASE_URL,
    jevApiKey: e.JEV_API_KEY,
    jevModel: e.JEV_MODEL,
    marginThreshold: e.ROUTER_MARGIN_THRESHOLD,
  };
}

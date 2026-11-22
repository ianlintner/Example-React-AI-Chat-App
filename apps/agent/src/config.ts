import { z } from 'zod';

const serverEnvSchema = z.object({
  AGENT_PORT: z.coerce.number().int().min(1).max(65535).default(8787),
  /** Loopback by default: local development only, nothing listens publicly. */
  AGENT_HOST: z.string().min(1).default('127.0.0.1'),
  /** Browser origin allowed by CORS (the web app's dev server). */
  WEB_ORIGIN: z.url().default('http://localhost:3000'),
  /**
   * Inngest dev server mode. When unset, `/api/inngest` is only mounted if
   * INNGEST_SIGNING_KEY is present — the endpoint never runs unauthenticated.
   */
  INNGEST_DEV: z.string().min(1).optional(),
  INNGEST_SIGNING_KEY: z.string().min(1).optional(),
  /** HMAC key for signed anonymous sessions. No default: fail closed. */
  SESSION_SECRET: z
    .string()
    .min(32, 'SESSION_SECRET must be at least 32 chars'),
  /**
   * Required when AGENT_HOST is not loopback: `/metrics` exposes routing
   * telemetry and must not be world-readable on a non-local listener.
   */
  METRICS_TOKEN: z.string().min(16).optional(),
  /** Postgres and Redis are optional locally; when absent, tests/offline use memory. */
  DATABASE_URL: z.string().min(1).optional(),
  REDIS_URL: z.string().min(1).optional(),
  /**
   * Opt-in trusted header for authenticated local users (e.g. `x-user-id`).
   * LOOPBACK-ONLY DEV SWITCH: any caller that can reach the server can choose
   * any user id when this is set. Never enable on a non-loopback listener.
   */
  TRUST_USER_HEADER: z.string().min(1).optional(),
});

export type ServerConfig = {
  port: number;
  host: string;
  webOrigin: string;
  inngest: { enabled: boolean; dev: boolean };
  sessionSecret: string;
  /** Set only for non-loopback listeners; undefined means open on loopback. */
  metricsToken: string | undefined;
  databaseUrl: string | undefined;
  redisUrl: string | undefined;
  trustUserHeader: string | undefined;
};

export function loadServerConfig(
  env: Record<string, string | undefined> = process.env,
): ServerConfig {
  const parsed = serverEnvSchema.safeParse(env);
  if (!parsed.success) {
    const fields = parsed.error.issues
      .map(i => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    throw new Error(`Invalid agent server configuration: ${fields}`);
  }
  const e = parsed.data;
  const loopback =
    e.AGENT_HOST === '127.0.0.1' ||
    e.AGENT_HOST === 'localhost' ||
    e.AGENT_HOST === '::1';
  if (!loopback && !e.METRICS_TOKEN) {
    throw new Error(
      'Invalid agent server configuration: METRICS_TOKEN: required when AGENT_HOST is not loopback',
    );
  }
  const dev = e.INNGEST_DEV !== undefined && e.INNGEST_DEV !== '0';
  return {
    port: e.AGENT_PORT,
    host: e.AGENT_HOST,
    webOrigin: e.WEB_ORIGIN,
    inngest: { enabled: dev || e.INNGEST_SIGNING_KEY !== undefined, dev },
    sessionSecret: e.SESSION_SECRET,
    metricsToken: loopback ? undefined : e.METRICS_TOKEN,
    databaseUrl: e.DATABASE_URL,
    redisUrl: e.REDIS_URL,
    trustUserHeader: e.TRUST_USER_HEADER,
  };
}

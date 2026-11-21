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
});

export type ServerConfig = {
  port: number;
  host: string;
  webOrigin: string;
  inngest: { enabled: boolean; dev: boolean };
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
  const dev = e.INNGEST_DEV !== undefined && e.INNGEST_DEV !== '0';
  return {
    port: e.AGENT_PORT,
    host: e.AGENT_HOST,
    webOrigin: e.WEB_ORIGIN,
    inngest: { enabled: dev || e.INNGEST_SIGNING_KEY !== undefined, dev },
  };
}

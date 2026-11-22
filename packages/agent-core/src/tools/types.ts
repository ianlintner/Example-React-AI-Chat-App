/** Shared dependencies for pure, mockable entertainment tools. */
import type { ToolsConfig } from './config';

export interface ToolDeps {
  /** Injected fetch — tests pass a fake, so no tool makes a real network call. */
  fetch: typeof globalThis.fetch;
  env: ToolsConfig;
  newId: () => string;
  now: () => number;
  /** Injectable RNG for dice so tests are deterministic. */
  random?: () => number;
}

export const defaultDeps = (
  env: ToolsConfig,
  fetch = globalThis.fetch,
): ToolDeps => ({
  fetch,
  env,
  newId: () => crypto.randomUUID(),
  now: () => Date.now(),
  random: Math.random,
});

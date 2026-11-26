/**
 * Live-mode gateway probe for `npm run eval:live`.
 *
 * Golden cases stay deterministic (they exercise seams with fakes); this probe
 * is the part that actually talks to the local OpenAI-compatible gateway. It
 * sends one minimal chat completion per configured tier route, checks that a
 * non-empty assistant reply comes back, and records only route names,
 * status and latency — never prompts, completions, model ids or API keys.
 */
import { loadLlmConfig } from '../packages/agent-core/src/config';

/** @typedef {{ ok: boolean, status: number, latencyMs: number }} RouteCheck */
/** @typedef {{ mode: 'live', gateway: string, routes: Record<string, RouteCheck>, ok: boolean }} LiveProbeResult */

const TIMEOUT_MS = 30000;

/** @param {ReturnType<typeof loadLlmConfig>} config @param {string} route @param {AbortController} controller @returns {Promise<RouteCheck>} */
async function probeRoute(config, route, controller) {
  const started = Date.now();
  const headers = { 'content-type': 'application/json' };
  if (config.apiKey) headers.authorization = `Bearer ${config.apiKey}`;
  try {
    const response = await fetch(`${config.baseURL}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: route,
        messages: [{ role: 'user', content: 'Reply with the single word: ok' }],
        max_tokens: 8,
      }),
      signal: AbortSignal.any([
        controller.signal,
        AbortSignal.timeout(TIMEOUT_MS),
      ]),
    });
    const text = await response.text();
    let hasReply = false;
    if (response.ok) {
      try {
        const body = JSON.parse(text);
        hasReply = typeof body?.choices?.[0]?.message?.content === 'string';
      } catch {
        hasReply = false;
      }
    }
    return {
      ok: response.ok && hasReply,
      status: response.status,
      latencyMs: Date.now() - started,
    };
  } catch {
    return { ok: false, status: 0, latencyMs: Date.now() - started };
  }
}

/** @param {NodeJS.ProcessEnv} [env] @returns {Promise<LiveProbeResult>} */
export async function runLiveProbe(env = process.env) {
  const config = loadLlmConfig({ ...env, LLM_PROVIDER: 'gateway' });
  const controller = new AbortController();
  const names = [...new Set(Object.values(config.routes))];
  const checks = await Promise.all(
    names.map(
      async name =>
        /** @type {const} */ ([
          name,
          await probeRoute(config, name, controller),
        ]),
    ),
  );
  const routes = Object.fromEntries(checks);
  return {
    mode: 'live',
    gateway: config.baseURL,
    routes,
    ok: checks.every(([, result]) => result.ok),
  };
}

/** @param {LiveProbeResult} result */
export function formatLiveProbe(result) {
  const lines = [`live gateway probe: ${result.gateway}`];
  for (const [name, r] of Object.entries(result.routes))
    lines.push(
      `  ${name}: ${r.ok ? 'ok' : 'FAIL'} (status ${r.status}, ${r.latencyMs}ms)`,
    );
  return lines.join('\n');
}

/**
 * Privacy guard for shadow routing: any text sent to api.typesafe.ai is
 * trimmed and redacted by default. Routing needs shape, not identities.
 */

/** Deterministic bucket in [0,1) from a decision id; stable across retries. */
export function sampleBucket(decisionId: string): number {
  let hash = 2166136261;
  for (let i = 0; i < decisionId.length; i++) {
    hash ^= decisionId.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 1_000_000) / 1_000_000;
}

/** Strip high-risk identifiers before a third-party call. */
export function redactText(text: string): string {
  return text
    .replace(/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, '[email]')
    .replace(/\bhttps?:\/\/\S+/gi, '[url]')
    .replace(/\b\d{7,}\b/g, '[number]')
    .replace(
      /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
      '[uuid]',
    )
    .slice(0, 4000);
}

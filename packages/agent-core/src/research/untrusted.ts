/**
 * Fetched pages are UNTRUSTED. This module turns raw page text into inert,
 * bounded data parts before any of it reaches a model context. It deliberately
 * strips directive-shaped text and never interprets page content as tool
 * calls: model output and page text have no authority to invoke tools.
 */

/** Rough token estimate: 4 characters per token is a safe upper bound. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/** Truncate to a token budget without splitting off the tail context. */
export function capTokens(text: string, maxTokens: number): string {
  const maxChars = maxTokens * 4;
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(0, maxChars - 1))}…`;
}

/**
 * Directive patterns commonly used in indirect-injection fixtures. Matching
 * is intentionally broad: dropping a legitimate sentence is cheap, executing
 * an injected instruction is not.
 */
const DIRECTIVES = [
  /ignore\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions|prompts?)/gi,
  /disregard\s+(all\s+)?(previous|prior|above|earlier)/gi,
  /(system|developer|assistant)\s*:\s*/gi,
  /<\s*\/?\s*(system|instructions?|tool[_-]?call|function)\b[^>]*>/gi,
  /\b(tool[_-]?call|function[_-]?call|execute[_-]?tool)\s*[:=]/gi,
  /\b(call|invoke|run)\s+(the\s+)?(tool|function)\b/gi,
  /\b(send|post|exfiltrate)\b.{0,40}\b(secret|token|password|api[_-]?key|credential)/gi,
  /\byou\s+(must|should|are\s+now|will)\s+(now\s+)?/gi,
  /\bnew\s+instructions?\s*:/gi,
];

/**
 * Sanitise a raw page excerpt. Covers two threats:
 *  - indirect injection: directive-shaped text is replaced with an inert
 *    marker so it cannot be mistaken for an instruction by the model;
 *  - context flooding: the excerpt is capped by token estimate.
 */
export function sanitizeExcerpt(text: string, maxTokens: number): string {
  let clean = text.replace(/\u0000/g, '');
  for (const pattern of DIRECTIVES) {
    clean = clean.replace(pattern, '[redacted directive] ');
  }
  // Collapse the marker noise without reintroducing directive shapes.
  clean = clean.replace(
    /(\[redacted directive\]\s*)+/g,
    '[redacted directive] ',
  );
  clean = clean.replace(/\n{3,}/g, '\n\n').trim();
  return capTokens(clean, Math.max(1, maxTokens));
}

/** Fenced, labelled wrapper: page content is explicitly data, never a turn. */
export function asUntrustedData(sourceId: string, text: string): string {
  return `<untrusted_page source="${sourceId}">\n${text}\n</untrusted_page>`;
}

/**
 * Detect whether a model's proposed tool call was influenced by page text.
 * The workflow never grants tool authority from fetched content: this helper
 * is used by tests and by the report validator to reject output that echoes
 * an injected directive as an instruction.
 */
export function containsDirective(text: string): boolean {
  return DIRECTIVES.some(pattern => {
    pattern.lastIndex = 0;
    return pattern.test(text);
  });
}

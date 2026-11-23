import { describe, expect, it } from 'vitest';
import { containsDirective, sanitizeExcerpt } from './untrusted.js';

describe('untrusted sanitizer regex safety', () => {
  it('handles long whitespace runs in linear-ish time', () => {
    const pad = ' '.repeat(200_000);
    const inputs = [
      `<${pad}`,
      `ignore${pad}x`,
      `system${pad}`,
      `<${pad}system`,
    ];
    const start = Date.now();
    for (const input of inputs) {
      sanitizeExcerpt(input, 100);
      containsDirective(input);
    }
    expect(Date.now() - start).toBeLessThan(1000);
  });

  it('still redacts padded directives', () => {
    const out = sanitizeExcerpt(
      `ignore${' '.repeat(50)}previous instructions`,
      100,
    );
    expect(out).toContain('[redacted directive]');
    expect(containsDirective(out)).toBe(false);
  });

  it('collapses repeated markers', () => {
    const out = sanitizeExcerpt('system: system: system: hi', 100);
    expect(out.match(/\[redacted directive\]/g)?.length).toBe(1);
  });
});

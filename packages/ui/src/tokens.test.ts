import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { colorTokenNames, colorTokens, type Theme } from './tokens';
import { THEME_INIT_SCRIPT, THEME_STORAGE_KEY } from './theme';

const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');

function block(selector: string): Record<string, string> {
  const re = new RegExp(`^${selector.replace('.', '\\.')} \\{([^}]*)\\}`, 'm');
  const body = re.exec(css)?.[1];
  if (!body) throw new Error(`no ${selector} block in tokens.css`);
  return Object.fromEntries(
    [...body.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{3,8})/gi)].map(m => [
      m[1]!,
      m[2]!.toUpperCase(),
    ]),
  );
}

/** WCAG relative luminance contrast ratio. */
function contrast(a: string, b: string) {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map(i => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    }) as [number, number, number];
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p) as [number, number];
  return (x + 0.05) / (y + 0.05);
}

describe('Instrument Panel tokens', () => {
  it('keeps the signature graphite and amber', () => {
    expect(colorTokens.dark.bg).toBe('#0B0D0F');
    expect(colorTokens.dark.accent).toBe('#F5A524');
  });

  it.each<[Theme, string]>([
    ['light', ':root'],
    ['dark', '.dark'],
  ])('tokens.css %s values match tokens.ts', (theme, selector) => {
    const fromCss = block(selector);
    for (const name of colorTokenNames) {
      expect(fromCss[name], `--${name}`).toBe(colorTokens[theme][name]);
    }
  });

  it.each<Theme>(['light', 'dark'])(
    '%s text pairs meet WCAG AA 4.5:1',
    theme => {
      const t = colorTokens[theme];
      for (const surface of [t.bg, t.surface, t['surface-2']]) {
        expect(contrast(t.fg, surface)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(t['fg-muted'], surface)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(t.accent, surface)).toBeGreaterThanOrEqual(4.5);
      }
      expect(contrast(t['accent-contrast'], t.accent)).toBeGreaterThanOrEqual(
        4.5,
      );
    },
  );

  it('ships a reduced-motion override', () => {
    expect(css).toMatch(/prefers-reduced-motion: reduce/);
  });

  it('theme init script is self-contained and defaults to dark', () => {
    expect(THEME_INIT_SCRIPT).toContain("'dark'");
    expect(THEME_INIT_SCRIPT).not.toMatch(/import|require/);
    expect(THEME_INIT_SCRIPT).toContain(`var k='${THEME_STORAGE_KEY}'`);
  });
});

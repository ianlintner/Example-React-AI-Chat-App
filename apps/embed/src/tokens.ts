/**
 * Tailwind v4 token re-injection for Shadow DOM.
 *
 * `packages/ui/src/tokens.css` cannot be pasted into a shadow root: it holds
 * Tailwind v4 at-rules (`@custom-variant`, `@theme inline`) that only the
 * compiler understands. Instead we re-inject the *same* values from the
 * source of truth (`tokens.ts`) as plain CSS custom properties scoped to
 * `:host`, so the component is themeable and stays in lockstep with the web
 * app's Instrument Panel palette (the tokens parity test guards both files).
 */
import {
  colorTokens,
  fontTokens,
  motionTokens,
  type Theme,
} from '@agent-chat/ui';

/** CSS custom properties for one theme, scoped to the shadow host. */
export function themeCss(theme: Theme): string {
  const vars = colorTokens[theme];
  const lines = Object.entries(vars)
    .map(([name, value]) => `  --${name}: ${value};`)
    .join('\n');
  return `:host {\n${lines}\n  --font-sans: ${fontTokens.sans};\n  --font-mono: ${fontTokens.mono};\n  --font-serif: ${fontTokens.serif};\n  --duration-hover: ${motionTokens.hover}ms;\n  --duration-panel: ${motionTokens.panel}ms;\n  --duration-canvas: ${motionTokens.canvas}ms;\n  color-scheme: ${theme};\n}`;
}

/**
 * Resolve the theme at mount time: an explicit `theme` attribute wins,
 * otherwise follow the host document's prefers-color-scheme.
 */
export function resolveTheme(explicit: string | null): Theme {
  if (explicit === 'light' || explicit === 'dark') return explicit;
  return globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

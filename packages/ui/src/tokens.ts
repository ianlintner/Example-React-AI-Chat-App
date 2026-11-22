/**
 * Instrument Panel design tokens (RESEARCH-UI.md §4, direction A).
 * Source of truth for values; `tokens.css` must match (enforced by test).
 *
 * Deviation from RESEARCH-UI §4: light `--accent` is #9A5B00 instead of
 * #B26B00, because #B26B00 on #FAFAF9 is ~4.0:1 and fails WCAG 1.4.3 for
 * body-size text. #9A5B00 is ~5.2:1.
 */
export const colorTokens = {
  dark: {
    bg: '#0B0D0F',
    surface: '#14171A',
    'surface-2': '#1C2024',
    border: '#2A2F35',
    fg: '#E8EAED',
    'fg-muted': '#9AA3AD',
    accent: '#F5A524',
    'accent-contrast': '#0B0D0F',
    ok: '#3DD68C',
    warn: '#F5A524',
    err: '#FF6B6B',
    'agent-research': '#6E9BFF',
    'agent-writer': '#C084FC',
    'agent-critic': '#34D3C0',
    'agent-router': '#9AA3AD',
  },
  light: {
    bg: '#FAFAF9',
    surface: '#FFFFFF',
    'surface-2': '#F2F2EF',
    border: '#E4E4DF',
    fg: '#17191C',
    'fg-muted': '#5C636B',
    accent: '#9A5B00',
    'accent-contrast': '#FFFFFF',
    ok: '#0E8A5F',
    warn: '#8A5A00',
    err: '#C62828',
    'agent-research': '#3A64C8',
    'agent-writer': '#8A4BC4',
    'agent-critic': '#137F73',
    'agent-router': '#5C636B',
  },
} as const;

export type ColorToken = keyof (typeof colorTokens)['dark'];
export type Theme = keyof typeof colorTokens;
export const colorTokenNames = Object.keys(colorTokens.dark) as ColorToken[];

export const fontTokens = {
  sans: '"Inter Variable", ui-sans-serif, system-ui, sans-serif',
  mono: '"JetBrains Mono", ui-monospace, monospace',
  serif: '"Iowan Old Style", "Palatino Linotype", Georgia, serif',
} as const;

/** Motion budget in ms. All collapse to ~0 under prefers-reduced-motion. */
export const motionTokens = { hover: 120, panel: 180, canvas: 260 } as const;

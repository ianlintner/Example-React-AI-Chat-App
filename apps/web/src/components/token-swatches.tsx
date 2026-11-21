import { colorTokenNames, colorTokens, type Theme } from '@agent-chat/ui';

/**
 * Renders every Instrument Panel color token for the current theme.
 * Used by the home page, Storybook and the Playwright token smoke test.
 */
export function TokenSwatches({ theme }: { theme: Theme }) {
  return (
    <ul
      aria-label='Color tokens'
      className='grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5'
    >
      {colorTokenNames.map(name => (
        <li
          key={name}
          data-token={name}
          className='flex items-center gap-2 rounded-lg border bg-surface p-2'
        >
          <span
            aria-hidden
            className='size-6 shrink-0 rounded border'
            style={{ background: `var(--${name})` }}
          />
          <span className='min-w-0'>
            <span className='block truncate text-xs font-medium'>{name}</span>
            <span className='block font-mono text-xs text-fg-muted tabular'>
              {colorTokens[theme][name]}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

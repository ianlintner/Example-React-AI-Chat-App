import { planFixture } from '@agent-chat/contract/fixtures';
import { getTheme, type Theme } from '@agent-chat/ui';
import { useEffect, useState } from 'react';
import { PlanPreview } from '@/components/plan-preview';
import { ThemeToggle } from '@/components/theme-toggle';
import { TokenSwatches } from '@/components/token-swatches';

/** Design-token showcase, kept out of the chat shell for a quiet smoke test. */
export function TokenShowcase() {
  const [theme, setThemeState] = useState<Theme>('dark');
  useEffect(() => {
    setThemeState(getTheme());
    const observer = new MutationObserver(() => setThemeState(getTheme()));
    observer.observe(document.documentElement, { attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return (
    <main className='mx-auto flex max-w-5xl flex-col gap-6 p-6'>
      <header className='flex items-center justify-between gap-4'>
        <div>
          <h1 className='text-xl font-semibold'>
            Agent Chat <span className='text-signal'>·</span> Instrument Panel
          </h1>
          <p className='text-sm text-fg-muted'>
            Phase 1: local agent chat backed by the AI SDK stream contract.
          </p>
        </div>
        <ThemeToggle />
      </header>
      <section aria-labelledby='tokens-heading' className='space-y-2'>
        <h2 id='tokens-heading' className='text-sm font-medium'>
          Design tokens ({theme})
        </h2>
        <TokenSwatches theme={theme} />
      </section>
      <section aria-labelledby='plan-heading' className='space-y-2'>
        <h2 id='plan-heading' className='text-sm font-medium'>
          Contract fixture: plan
        </h2>
        <PlanPreview plan={planFixture} />
      </section>
    </main>
  );
}

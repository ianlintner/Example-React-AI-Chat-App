import { useEffect, useId, type ReactNode } from 'react';

/**
 * Mobile bottom sheet. Sheets replace modals for tools/plan on small screens
 * (RESEARCH-UI §3 pattern 13); 44px close target and Escape support.
 */
export function MobileSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className='fixed inset-0 z-40 flex items-end bg-black/50 md:hidden'>
      <section
        role='dialog'
        aria-modal='true'
        aria-labelledby={titleId}
        className='max-h-[75dvh] w-full overflow-y-auto rounded-t-2xl border-t border-border bg-surface p-4 pb-[max(1rem,env(safe-area-inset-bottom))]'
      >
        <div
          className='mx-auto mb-3 h-1 w-10 rounded-full bg-border'
          aria-hidden
        />
        <div className='mb-3 flex items-center justify-between gap-3'>
          <h2 id={titleId} className='font-medium'>
            {title}
          </h2>
          <button
            type='button'
            aria-label='Close sheet'
            onClick={onClose}
            className='min-h-11 min-w-11 rounded border border-border hover:bg-surface-2'
          >
            ✕
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

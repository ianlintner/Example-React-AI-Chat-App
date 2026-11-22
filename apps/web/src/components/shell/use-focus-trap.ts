import { useEffect, type RefObject } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Minimal modal focus trap: focus the first control on open, keep Tab inside,
 * and restore focus to the previously active element on close. Both the ⌘K
 * palette and the mobile bottom sheets use `aria-modal`, so they need this.
 */
export function useFocusTrap(
  open: boolean,
  containerRef: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const container = containerRef.current;
    const first = container?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? container)?.focus();

    function onKey(event: KeyboardEvent) {
      if (event.key !== 'Tab') return;
      const node = containerRef.current;
      if (!node) return;
      const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) {
        event.preventDefault();
        node.focus();
        return;
      }
      const firstItem = items[0]!;
      const lastItem = items[items.length - 1]!;
      if (event.shiftKey && document.activeElement === firstItem) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault();
        firstItem.focus();
      }
    }

    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus();
    };
  }, [open, containerRef]);
}

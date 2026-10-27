import { useEffect, useRef } from 'react';

/**
 * Shared, reference-counted page scroll lock.
 * Each overlay used to save and restore body.style.overflow on its own. When two overlays overlapped
 * (or one was closed first) the second one "restored" the already-locked value 'hidden', and the page behind
 * stayed unscrollable after going Back. Now the original value is saved once, by the first lock,
 * and restored only when the last lock is released.
 */
let lockCount = 0;
let savedOverflow = '';
function lockBodyScroll() {
  if (lockCount === 0) {
    const current = document.body.style.overflow;
    // Never treat a leftover 'hidden' as the page's real value.
    savedOverflow = current === 'hidden' ? '' : current;
    document.body.style.overflow = 'hidden';
  }
  lockCount += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    lockCount = Math.max(lockCount - 1, 0);
    if (lockCount === 0) document.body.style.overflow = savedOverflow;
  };
}

/**
 * Shared behaviour for Modal / Drawer / ConfirmDialog while `open`:
 * Escape closes, page scroll is locked, focus moves into the panel and is
 * restored to the previously focused element on close.
 */
export function useOverlay<T extends HTMLElement>(open: boolean, onClose: () => void) {
  const panelRef = useRef<T>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const unlockScroll = lockBodyScroll();

    const panel = panelRef.current;
    const focusable = () =>
      panel
        ? Array.from(
            panel.querySelectorAll<HTMLElement>(
              'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
            ),
          )
        : [];
    (focusable()[0] ?? panel)?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        closeRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      // Simple focus trap: wrap around at either end.
      const items = focusable();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);

    return () => {
      document.removeEventListener('keydown', onKey);
      unlockScroll();
      previouslyFocused?.focus?.();
    };
  }, [open]);

  return panelRef;
}
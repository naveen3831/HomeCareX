import { useEffect, type RefObject } from 'react';

const INTERACTIVE = 'button, a, input, select, textarea, label, [role="button"]';

/**
 * Lets a mouse (desktop, or the browser's phone emulator) click-and-drag a horizontally
 * scrolling box. Touch screens already swipe natively, so this only matters for mouse input.
 * Checkboxes, buttons and links keep working normally.
 */
export function useDragScroll(ref: RefObject<HTMLElement>) {
  useEffect(() => {
    const scroller = ref.current;
    if (!scroller) return;

    let down = false;
    let moved = false;
    let startX = 0;
    let startLeft = 0;

    const onDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      if ((e.target as HTMLElement).closest(INTERACTIVE)) return;
      down = true;
      moved = false;
      startX = e.pageX;
      startLeft = scroller.scrollLeft;
    };
    const onMove = (e: MouseEvent) => {
      if (!down) return;
      const dx = e.pageX - startX;
      if (!moved && Math.abs(dx) > 4) {
        moved = true;
        scroller.classList.add('is-dragging');
      }
      if (moved) {
        e.preventDefault();
        scroller.scrollLeft = startLeft - dx;
      }
    };
    const onUp = () => {
      down = false;
      scroller.classList.remove('is-dragging');
    };
    // A drag must not count as a click on whatever is under the cursor on release.
    const onClick = (e: MouseEvent) => {
      if (moved) {
        e.stopPropagation();
        e.preventDefault();
        moved = false;
      }
    };

    scroller.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    scroller.addEventListener('click', onClick, true);
    return () => {
      scroller.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      scroller.removeEventListener('click', onClick, true);
    };
  }, [ref]);
}

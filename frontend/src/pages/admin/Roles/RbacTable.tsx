import React, { useEffect, useRef } from 'react';

const INTERACTIVE = 'button, a, input, select, textarea, label, [role="button"]';

/**
 * Wraps a DataTable so it behaves like the Payments table on phones:
 *  - the table is wider than the screen and scrolls sideways inside its card
 *  - touch screens swipe natively
 *  - a mouse (desktop, or the browser's phone emulator) can click-and-drag the table
 * The page itself never scrolls sideways.
 */
export const RbacTable: React.FC<{ variant: 'roles' | 'staff'; children: React.ReactNode }> = ({ variant, children }) => {
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scroller = wrap.current?.querySelector<HTMLElement>('.hcx-table-scroll');
    if (!scroller) return;

    let down = false;
    let moved = false;
    let startX = 0;
    let startLeft = 0;

    const onDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      // Let the role dropdown and the action buttons work normally.
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
    // A drag must not count as a click on whatever is under the cursor when the mouse is released.
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
  }, []);

  return (
    <>
      <div ref={wrap} className={`rbac-table rbac-table--${variant}`}>
        {children}
      </div>
      <p className="rbac-swipe-hint" aria-hidden>Swipe sideways to see every column</p>
    </>
  );
};

export default RbacTable;

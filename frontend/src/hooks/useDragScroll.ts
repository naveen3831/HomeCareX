import { useEffect, useRef } from "react";

/**
 * Lets the mouse drag-scroll a horizontally scrollable area (phones already swipe;
 * this makes it work in desktop "mobile view" too). Put the returned ref on any
 * element that is always rendered and pass a selector for the scroll area inside it
 * (it also works for areas that appear later, e.g. after data loads).
 * A drag never triggers the click of the item under the cursor.
 */
export function useDragScroll<T extends HTMLElement>(selector: string) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;

    let area: HTMLElement | null = null;
    let startX = 0;
    let startLeft = 0;
    let moved = false;

    const onDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const target = (e.target as HTMLElement).closest(selector) as HTMLElement | null;
      if (!target || target.scrollWidth <= target.clientWidth) return;
      area = target;
      startX = e.clientX;
      startLeft = target.scrollLeft;
      moved = false;
    };

    const onMove = (e: MouseEvent) => {
      if (!area) return;
      const dx = e.clientX - startX;
      if (!moved && Math.abs(dx) > 5) {
        moved = true;
        area.style.cursor = "grabbing";
        area.style.userSelect = "none";
      }
      if (moved) area.scrollLeft = startLeft - dx;
    };

    const onUp = () => {
      if (area) {
        area.style.cursor = "";
        area.style.userSelect = "";
      }
      area = null;
    };

    const onClickCapture = (e: MouseEvent) => {
      if (moved) {
        e.stopPropagation();
        e.preventDefault();
        moved = false;
      }
    };

    root.addEventListener("mousedown", onDown);
    root.addEventListener("click", onClickCapture, true);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      root.removeEventListener("mousedown", onDown);
      root.removeEventListener("click", onClickCapture, true);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [selector]);

  return ref;
}
import { useEffect, useRef } from "react";

const SKIP = "input, select, textarea, [contenteditable='true'], [data-no-drag-scroll]";
const PHONE_WIDTH = "(max-width: 1023px)";

/** Nearest ancestor (starting at `from`, stopping at `stop`) that scrolls sideways right now. */
function findHorizontalScroller(from: HTMLElement | null, stop: HTMLElement): HTMLElement | null {
  let node = from;
  while (node && node !== stop.parentElement) {
    if (node.scrollWidth > node.clientWidth + 1) {
      const overflowX = getComputedStyle(node).overflowX;
      if (overflowX === "auto" || overflowX === "scroll") return node;
    }
    node = node.parentElement;
  }
  return null;
}

/**
 * Click-and-drag sideways scrolling for any wide table or strip inside `root`, for mouse input on
 * phone-sized screens (desktop "mobile view", simulators). Real touch screens already swipe natively.
 * A drag never counts as a click on the row or button under the cursor.
 */
export function attachAutoDragScroll(root: HTMLElement): () => void {
  const phone = window.matchMedia(PHONE_WIDTH);
  let area: HTMLElement | null = null;
  let startX = 0;
  let startLeft = 0;
  let moved = false;

  const onDown = (e: MouseEvent) => {
    if (e.button !== 0 || !phone.matches) return;
    const target = e.target as HTMLElement;
    if (target.closest(SKIP)) return;
    area = findHorizontalScroller(target, root);
    if (!area) return;
    startX = e.clientX;
    startLeft = area.scrollLeft;
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
    if (moved) {
      e.preventDefault();
      area.scrollLeft = startLeft - dx;
    }
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
}

/** Put the returned ref on a page wrapper: every sideways-scrolling table inside it becomes drag-scrollable. */
export function useAutoDragScroll<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const root = ref.current;
    return root ? attachAutoDragScroll(root) : undefined;
  }, []);
  return ref;
}
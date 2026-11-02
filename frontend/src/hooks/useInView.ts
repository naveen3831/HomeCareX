import { useEffect, useState } from "react";

/**
 * True once the element has scrolled into view (and stays true). Without IntersectionObserver
 * (old browsers, tests) it reports true straight away so content is never stuck hidden.
 *
 * Returns a callback ref, not an object ref. The element is often rendered only after data has loaded
 * (a skeleton shows first), and an object ref would be empty on the one render where the effect looks
 * for it, so the observer would never attach and the content would stay in its "not seen" state.
 */
export function useInView<T extends Element>(threshold = 0.25) {
  const [el, setEl] = useState<T | null>(null);
  const [seen, setSeen] = useState(() => typeof IntersectionObserver === "undefined");

  useEffect(() => {
    if (seen || !el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [seen, el, threshold]);

  return [setEl, seen] as const;
}

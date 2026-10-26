import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { prefetchRouteChunk, prefetchServiceDetails, slugFromHref } from "@/lib/prefetch";

/** Pause before a hover counts as intent, so sweeping the mouse across a grid fetches nothing. */
const HOVER_INTENT_MS = 65;

/**
 * One delegated listener for the whole public site: when a visitor hovers, focuses or touches a link
 * to /services/:slug its details are prefetched; a link to /services warms that page's chunk.
 * Nothing is prefetched in the background, so first-load performance is untouched.
 */
export function usePrefetchOnIntent(): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    let timer: number | undefined;
    let pending: HTMLAnchorElement | null = null;

    const anchorOf = (target: EventTarget | null): HTMLAnchorElement | null =>
      target instanceof Element ? target.closest<HTMLAnchorElement>("a[href]") : null;

    const prefetch = (anchor: HTMLAnchorElement) => {
      const href = anchor.getAttribute("href") ?? "";
      const slug = slugFromHref(href);
      if (slug) prefetchServiceDetails(queryClient, slug);
      else prefetchRouteChunk(href);
    };

    const cancel = () => {
      window.clearTimeout(timer);
      pending = null;
    };

    const onPointerOver = (event: PointerEvent) => {
      const anchor = anchorOf(event.target);
      if (!anchor || anchor === pending) return;
      cancel();
      pending = anchor;
      timer = window.setTimeout(() => prefetch(anchor), HOVER_INTENT_MS);
    };

    const onPointerOut = (event: PointerEvent) => {
      if (pending && !pending.contains(event.relatedTarget as Node | null)) cancel();
    };

    // Keyboard focus and touch are already deliberate, so there is no delay.
    const onImmediate = (event: Event) => {
      const anchor = anchorOf(event.target);
      if (anchor) prefetch(anchor);
    };

    document.addEventListener("pointerover", onPointerOver, { passive: true });
    document.addEventListener("pointerout", onPointerOut, { passive: true });
    document.addEventListener("focusin", onImmediate);
    document.addEventListener("touchstart", onImmediate, { passive: true });

    return () => {
      cancel();
      document.removeEventListener("pointerover", onPointerOver);
      document.removeEventListener("pointerout", onPointerOut);
      document.removeEventListener("focusin", onImmediate);
      document.removeEventListener("touchstart", onImmediate);
    };
  }, [queryClient]);
}
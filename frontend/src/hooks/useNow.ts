import { useEffect, useState } from "react";

/** The current time in ms, refreshed on an interval, so "updated 3 min ago" keeps counting. */
export function useNow(intervalMs: number): number {
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}
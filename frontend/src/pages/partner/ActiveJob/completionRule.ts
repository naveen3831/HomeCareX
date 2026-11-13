import { useEffect, useState } from 'react';

/** The partner can complete a job only after working at least this share of the booked time. */
export const MIN_WORK_FRACTION = 0.8;

/* ============ TESTING ONLY ============
 * true  = ignore the time rule (the checklist rule still applies), so you do not wait for the time.
 * Set it back to false after testing. */
export const TEST_SKIP_TIME_CHECK = true;
/* ====================================== */

interface GateJob {
  schedule: { startedAt?: string | null };
  service: { durationMinutes: number | null };
  checklist: { done: boolean }[];
}

export interface CompletionGate {
  canComplete: boolean;
  itemsLeft: number;
  timeLeft: boolean;
  /** Why "Complete job" is locked. Empty when it is allowed. */
  message: string;
}

/** "Complete job" unlocks when every checklist item is ticked AND enough of the booked time has passed. */
export function getCompletionGate(job: GateJob, nowMs: number): CompletionGate {
  const bookedMin = job.service.durationMinutes ?? 180;
  const requiredSec = Math.ceil(bookedMin * 60 * MIN_WORK_FRACTION);
  const startedMs = job.schedule.startedAt ? new Date(job.schedule.startedAt).getTime() : NaN;

  // No usable start time (demo data): the time rule cannot be checked, so it does not block.
  const elapsedSec = Number.isNaN(startedMs) ? requiredSec : Math.max(0, Math.floor((nowMs - startedMs) / 1000));
  const timeLeft = !TEST_SKIP_TIME_CHECK && elapsedSec < requiredSec;
  const itemsLeft = job.checklist.filter((c) => !c.done).length;

  let message = '';
  if (itemsLeft > 0 && timeLeft) {
    message = `Complete all ${itemsLeft} remaining checklist ${itemsLeft === 1 ? 'item' : 'items'} and finish the service properly to complete this job.`;
  } else if (itemsLeft > 0) {
    message = `Complete all ${itemsLeft} remaining checklist ${itemsLeft === 1 ? 'item' : 'items'} to finish this job.`;
  } else if (timeLeft) {
    message = 'All checklist items are done. Please finish the service properly before completing this job.';
  }

  return { canComplete: itemsLeft === 0 && !timeLeft, itemsLeft, timeLeft, message };
}

/** Current time, refreshed every few seconds, so a locked button unlocks by itself. */
export function useNow(intervalMs = 5000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

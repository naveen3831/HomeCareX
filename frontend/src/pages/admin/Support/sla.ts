import type { AdminTicket } from '@/types/adminTicket';

export type SlaState = 'none' | 'ok' | 'at_risk' | 'breached' | 'paused' | 'met' | 'missed';

export interface SlaInfo {
  state: SlaState;
  label: string;
  /** Exact due time, for the tooltip. */
  title: string;
}

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** 1d 3h · 2h 05m · 12m · <1m */
export function formatDuration(ms: number): string {
  const abs = Math.abs(ms);
  if (abs < MIN) return '<1m';
  const d = Math.floor(abs / DAY);
  const h = Math.floor((abs % DAY) / HOUR);
  const m = Math.floor((abs % HOUR) / MIN);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  return `${m}m`;
}

const CLOSED = new Set(['RESOLVED', 'CLOSED']);
const fmt = (iso: string) => new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));

/**
 * Derives the SLA badge state from server timestamps. `now` is passed in so a
 * single page-level clock drives every row and tests stay deterministic.
 */
export function getSla(t: Pick<AdminTicket, 'status' | 'sla' | 'createdAt'>, now: number): SlaInfo {
  const due = t.sla.dueAt ? new Date(t.sla.dueAt).getTime() : NaN;
  // The backend sends no SLA once a ticket is resolved / closed: say so rather than "No SLA".
  if (Number.isNaN(due) && CLOSED.has(t.status)) return { state: 'none', label: 'Closed', title: 'The SLA clock stopped when this ticket was closed' };
  if (Number.isNaN(due)) return { state: 'none', label: 'No SLA', title: 'No SLA applies to this ticket' };
  const title = `Due ${fmt(t.sla.dueAt as string)}`;

  if (CLOSED.has(t.status)) {
    const doneAt = t.sla.resolvedAt ? new Date(t.sla.resolvedAt).getTime() : NaN;
    if (Number.isNaN(doneAt)) return { state: 'none', label: 'Closed', title };
    return doneAt <= due
      ? { state: 'met', label: 'Met', title }
      : { state: 'missed', label: 'Missed', title };
  }

  if (t.sla.pausedAt) {
    return { state: 'paused', label: 'Paused', title: `${title} (clock paused)` };
  }

  const remaining = due - now;
  if (remaining < 0) return { state: 'breached', label: `Breached ${formatDuration(remaining)} ago`, title };

  // At risk: inside the last 25% of the SLA window, but never less than 30 minutes of warning.
  const created = new Date(t.createdAt).getTime();
  const window = Number.isNaN(created) ? 0 : due - created;
  const threshold = Math.max(30 * MIN, window * 0.25);
  return remaining <= threshold
    ? { state: 'at_risk', label: `${formatDuration(remaining)} left`, title }
    : { state: 'ok', label: `${formatDuration(remaining)} left`, title };
}

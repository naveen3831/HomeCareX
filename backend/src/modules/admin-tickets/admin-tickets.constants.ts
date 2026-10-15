import type { TicketPriority } from '../tickets/tickets.constants';

/**
 * Permission for the whole admin support queue (list, assign, status, reply).
 * The `admin` role has '*' so it passes automatically; a narrower support role would be granted this explicitly.
 */
export const TICKETS_MANAGE = 'tickets:manage';

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

/** Date-only filters (YYYY-MM-DD) are interpreted in this offset (India). */
export const FILTER_UTC_OFFSET = '+05:30';

/** Requester text search ("Ananya", "9000000011") resolves to at most this many users before filtering tickets. */
export const MAX_REQUESTER_MATCHES = 500;

/** Statuses where the SLA clock is still running. Resolved/closed tickets have no SLA state. */
export const ACTIVE_STATUSES = ['open', 'in_progress'] as const;

export const REQUESTER_ROLES = ['customer', 'partner'] as const;
export type RequesterRole = (typeof REQUESTER_ROLES)[number];

/**
 * SLA is derived, not stored (the Ticket model has no SLA fields): time-to-resolution target per priority,
 * counted from `createdAt`. These are the policy numbers; change them here only.
 */
export const SLA_TARGET_HOURS: Record<TicketPriority, number> = {
  urgent: 4,
  high: 8,
  normal: 24,
  low: 72,
};

/** A ticket is "at_risk" once this share of its target has elapsed, "breached" once all of it has. */
export const SLA_AT_RISK_RATIO = 0.75;

export const SLA_STATES = ['ok', 'at_risk', 'breached'] as const;
export type SlaState = (typeof SLA_STATES)[number];

export const AUDIT_ENTITY = 'Ticket';
export const AUDIT_ACTION = {
  assigned: 'ticket.assigned',
  reassigned: 'ticket.reassigned',
  unassigned: 'ticket.unassigned',
  statusChanged: 'ticket.status_changed',
  priorityChanged: 'ticket.priority_changed',
  replied: 'ticket.replied',
  noted: 'ticket.noted',
} as const;

/** Longest reply / note an agent can send (the TicketMessage schema enforces the same cap). */
export const MAX_MESSAGE_LENGTH = 4000;
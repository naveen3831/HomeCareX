/** Same values as the backend (modules/tickets/tickets.constants.ts), upper-cased for display. */
export const TICKET_STATUSES = [
  "OPEN",
  "IN_PROGRESS",
  "WAITING",
  "RESOLVED",
  "CLOSED",
] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export interface TicketAssignee {
  id: string;
  name: string;
}

/** Mirrors GET /admin/tickets. */
export interface AdminTicket {
  id: string;
  ticketRef: string;
  subject: string;
  priority: TicketPriority;
  status: TicketStatus;
  requester: {
    type: "customer" | "partner";
    id: string;
    name: string;
    email?: string;
    phone?: string;
  } | null;
  /** payment | booking | account | safety | app_issue | other (absent on older payloads). */
  category?: string | null;
  bookingId: string | null;
  bookingRef: string | null;
  assignee: TicketAssignee | null;
  sla: {
    /** When the current SLA target expires. null = no SLA applies. */
    dueAt: string | null;
    /** Set while the clock is paused (e.g. waiting on the customer). */
    pausedAt?: string | null;
    /** Set once the ticket is resolved, so met/missed can be shown after the fact. */
    resolvedAt?: string | null;
  };
  /** Only on GET /admin/tickets/:id. Null when the ticket has no booking (or it was deleted). */
  bookingContext?: BookingContext | null;
  createdAt: string;
  updatedAt: string;
}

/** The booking a ticket is about, as shown beside the thread. */
export interface BookingContext {
  id: string;
  ref: string;
  serviceName: string;
  status: string;
  paymentStatus: string;
  scheduledAt: string | null;
  total: number | null;
  address: string | null;
  partner: { id: string; name: string | null } | null;
}

export interface AdminTicketsPage {
  items: AdminTicket[];
  meta: { page: number; limit: number; total: number; pages: number };
}

export interface AdminTicketFilters {
  status?: TicketStatus | "";
  priority?: TicketPriority | "";
  /** An agent id, or 'unassigned'. Empty = everyone. */
  assignee?: string;
  search?: string;
  page?: number;
  limit?: number;
}

/** An admin/staff user who can be given a ticket. */
export interface AssignableAgent {
  id: string;
  name: string;
}

/**
 * Raw shape of GET /admin/tickets items and PATCH /admin/tickets/:id/assign, as the backend sends it:
 * lowercase enums, a nested booking, `requester.role`, and `sla` that can be null.
 * `normalizeTicket` (services/adminTicketApi.ts) converts this to AdminTicket.
 */
export interface ApiTicket {
  id: string;
  ticketRef?: string;
  ref?: string;
  subject: string;
  priority: string;
  status: string;
  requester?: {
    role?: string;
    id: string;
    name: string;
    email?: string;
    phone?: string;
  } | null;
  category?: string;
  booking?: { id: string; ref?: string | null } | null;
  assignee?: { id: string; name: string } | null;
  /** Null for resolved / closed tickets. `state` and `targetHours` are sent too; the badge derives its own from dueAt. */
  sla?: {
    dueAt?: string | null;
    pausedAt?: string | null;
    resolvedAt?: string | null;
    state?: string;
    targetHours?: number;
  } | null;
  bookingContext?: BookingContext | null;
  createdAt: string;
  updatedAt: string;
}

/** One message in a ticket thread (GET /admin/tickets/:id/messages). */
export interface TicketMessage {
  id: string;
  ticketId: string;
  sender: {
    id: string;
    name: string | null;
    role: "customer" | "partner" | "admin";
  };
  body: string;
  attachments: {
    url: string;
    name: string;
    mimeType: string;
    sizeBytes: number;
  }[];
  /** true = agent-only note. Older payloads omit it (= a normal message). */
  internal?: boolean;
  createdAt: string;
}

/** Pushed over the socket when a ticket's status or priority changes. */
export interface TicketUpdatedEvent {
  ticketId: string;
  status: string;
  priority?: string;
  updatedAt: string;
}

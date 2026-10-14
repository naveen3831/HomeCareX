import http from '@/lib/http';
import {
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  type AdminTicket,
  type AdminTicketFilters,
  type AdminTicketsPage,
  type ApiTicket,
  type AssignableAgent,
  type TicketMessage,
  type TicketPriority,
  type TicketStatus,
} from '@/types/adminTicket';

const pick = <T extends string>(allowed: readonly T[], raw: unknown, fallback: T): T => {
  const up = String(raw ?? '').trim().toUpperCase().replace(/[\s-]+/g, '_') as T;
  return allowed.includes(up) ? up : fallback;
};

/** Backend contract -> page model. Tolerates missing booking / requester / sla. */
export function normalizeTicket(t: ApiTicket): AdminTicket {
  return {
    id: t.id,
    ticketRef: t.ticketRef ?? t.ref ?? t.id,
    subject: t.subject,
    priority: pick<TicketPriority>(TICKET_PRIORITIES, t.priority, 'NORMAL'),
    status: pick<TicketStatus>(TICKET_STATUSES, t.status, 'OPEN'),
    requester: t.requester
      ? {
          type: t.requester.role === 'partner' ? 'partner' : 'customer',
          id: t.requester.id,
          name: t.requester.name,
          email: t.requester.email,
          phone: t.requester.phone,
        }
      : null,
    ...(t.category ? { category: t.category } : {}),
    bookingId: t.booking?.id ?? null,
    bookingRef: t.booking?.ref ?? null,
    assignee: t.assignee ? { id: t.assignee.id, name: t.assignee.name } : null,
    sla: {
      dueAt: t.sla?.dueAt ?? null,
      pausedAt: t.sla?.pausedAt ?? null,
      resolvedAt: t.sla?.resolvedAt ?? null,
    },
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

/** GET /admin/tickets. Empty filters are dropped so the server sees a clean query. */
export async function fetchAdminTickets(filters: AdminTicketFilters): Promise<AdminTicketsPage> {
  const params = Object.fromEntries(
    Object.entries(filters).filter(([, v]) => v !== undefined && v !== null && v !== ''),
  );
  // The backend uses lowercase enum values.
  if (typeof params.status === 'string') params.status = params.status.toLowerCase();
  if (typeof params.priority === 'string') params.priority = params.priority.toLowerCase();
  const res = await http.get<{
    success: boolean;
    data: ApiTicket[];
    meta: AdminTicketsPage['meta'];
  }>('/admin/tickets', { params });
  return { items: res.data.data.map(normalizeTicket), meta: res.data.meta };
}

/**
 * PATCH /admin/tickets/:id/assign
 * Body: { assigneeId: string | null }. null unassigns. Used for both assign and reassign.
 * Returns the updated ticket.
 */
export async function assignTicket(id: string, assigneeId: string | null): Promise<AdminTicket> {
  const res = await http.patch<{ success: boolean; data: ApiTicket }>(
    `/admin/tickets/${encodeURIComponent(id)}/assign`,
    { assigneeId },
  );
  return normalizeTicket(res.data.data);
}

/**
 * PATCH /admin/tickets/:id/status
 * Body: { status: 'open' | 'in_progress' | 'resolved' | 'closed' } (lowercase, like the list filter).
 * Returns the updated ticket.
 */
export async function updateTicketStatus(id: string, status: TicketStatus): Promise<AdminTicket> {
  const res = await http.patch<{ success: boolean; data: ApiTicket }>(
    `/admin/tickets/${encodeURIComponent(id)}/status`,
    { status: status.toLowerCase() },
  );
  return normalizeTicket(res.data.data);
}

/**
 * GET /admin/staff?assignable=true: admin/staff users who can take tickets.
 * Backend endpoint added alongside this change; returns [{ id, name }].
 */
export async function fetchAssignableAgents(): Promise<AssignableAgent[]> {
  const res = await http.get<{ success: boolean; data: AssignableAgent[] }>('/admin/staff', {
    params: { assignable: true },
  });
  return res.data.data;
}

/** GET /admin/tickets/:id. Rejects with a 404 when the ticket does not exist. */
export async function fetchAdminTicket(id: string): Promise<AdminTicket> {
  const res = await http.get<{ success: boolean; data: ApiTicket }>(`/admin/tickets/${encodeURIComponent(id)}`);
  return normalizeTicket(res.data.data);
}

/** GET /admin/tickets/:id/messages: the thread, oldest first. */
export async function fetchTicketMessages(id: string): Promise<TicketMessage[]> {
  const res = await http.get<{ success: boolean; data: TicketMessage[] }>(`/admin/tickets/${encodeURIComponent(id)}/messages`);
  return res.data.data;
}
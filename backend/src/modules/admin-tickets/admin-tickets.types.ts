import type { TicketCategory, TicketPriority, TicketSenderRole, TicketStatus } from '../tickets/tickets.constants';
import type { RequesterRole, SlaState } from './admin-tickets.constants';

/** Already validated/normalised by `listTicketsQuerySchema`. */
export interface AdminTicketsQuery {
  status?: TicketStatus[];
  priority?: TicketPriority[];
  category?: TicketCategory[];
  /** A user id, 'me' (the calling admin) or 'unassigned'. */
  assignee?: string;
  /** A user id, or free text matched against name / email / phone. */
  requester?: string;
  requesterRole?: RequesterRole;
  /** A booking id or the "BK-1A2B3" reference shown in the UI. */
  booking?: string;
  sla?: SlaState;
  /** Free text from the search box. Matches ticket ref, subject, requester or booking ref. */
  search?: string;
  from?: string;
  to?: string;
  page: number;
  limit: number;
}

export interface TicketPersonDto {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
}

export interface TicketRequesterDto extends TicketPersonDto {
  role: RequesterRole;
}

export interface TicketSlaDto {
  state: SlaState;
  /** createdAt + the priority's target. ISO-8601. */
  dueAt: string;
  targetHours: number;
}

/** One row of the support queue. Customer and partner tickets share this shape. */
export interface AdminTicketDto {
  id: string;
  ticketRef: string;
  subject: string;
  category: TicketCategory;
  status: TicketStatus;
  priority: TicketPriority;
  /** If the user record no longer exists the id is still returned and name/email/phone are null. */
  requester: TicketRequesterDto;
  booking: { id: string; ref: string } | null;
  assignee: TicketPersonDto | null;
  /** Null for resolved / closed tickets: the clock has stopped and nothing is stored to say when. */
  sla: TicketSlaDto | null;
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminTicketsResult {
  items: AdminTicketDto[];
  meta: { page: number; limit: number; total: number; pages: number };
}

/** One entry of the assignee picker (GET /admin/staff?assignable=true). */
export interface AssignableAgentDto {
  id: string;
  name: string;
  email: string | null;
}

/** One message of a ticket thread (GET /admin/tickets/:id/messages), oldest first. */
export interface AdminTicketMessageDto {
  id: string;
  ticketId: string;
  /** name is null when the user record no longer exists. */
  sender: { id: string; name: string | null; role: TicketSenderRole };
  body: string;
  attachments: { url: string; name: string; mimeType: string; sizeBytes: number }[];
  readAt: string | null;
  createdAt: string;
}
import type { TicketStatus } from '../tickets/tickets.constants';
import { TICKET_STATUSES } from '../tickets/tickets.constants';
import * as repo from './partner-tickets.repository';
import { emitTicketMessage } from '../../sockets/ticket.socket';
import type { CreateTicketInput, TicketDto, TicketMessageDto, TicketAttachmentDto } from '../tickets/tickets.types';
import { TicketError, assertObjectId, parseCreateTicket, parseReply } from './partner-tickets.validation';

const ACTIVE: readonly TicketStatus[] = ['open', 'in_progress'];
const CLOSED: readonly TicketStatus[] = ['resolved', 'closed'];

const iso = (d: Date | undefined | null): string => (d ? new Date(d).toISOString() : new Date(0).toISOString());

type TicketRow = NonNullable<Awaited<ReturnType<typeof repo.findTicketById>>>;
type MessageRow = Awaited<ReturnType<typeof repo.findPublicMessages>>[number];

const toTicketDto = (t: TicketRow): TicketDto => ({
  id: String(t._id),
  createdBy: String(t.createdBy),
  createdByRole: t.createdByRole,
  bookingId: t.bookingId ? String(t.bookingId) : null,
  category: t.category,
  subject: t.subject,
  status: t.status,
  priority: t.priority,
  assignedTo: t.assignedTo ? String(t.assignedTo) : null,
  lastMessageAt: iso(t.lastMessageAt),
  createdAt: iso(t.createdAt),
  updatedAt: iso(t.updatedAt),
});

const toMessageDto = (m: MessageRow): TicketMessageDto => ({
  id: String(m._id),
  ticketId: String(m.ticketId),
  senderId: String(m.senderId),
  senderRole: m.senderRole,
  body: m.body,
  attachments: (m.attachments ?? []) as TicketAttachmentDto[],
  readAt: m.readAt ? iso(m.readAt) : null,
  createdAt: iso(m.createdAt),
});

/** Loads a ticket and makes sure it belongs to the caller. Other people's tickets look like "not found". */
async function loadOwnTicket(ticketId: string, userId: string): Promise<TicketRow> {
  assertObjectId(ticketId, 'ticketId');
  const ticket = await repo.findTicketById(ticketId);
  if (!ticket || String(ticket.createdBy) !== userId) throw new TicketError(404, 'Ticket not found');
  return ticket;
}

export async function createPartnerTicket(userId: string, input: unknown) {
  const data = parseCreateTicket(input);
  const ticket = await repo.createTicket({
    createdBy: userId,
    createdByRole: 'partner',
    bookingId: data.bookingId ?? null,
    category: data.category,
    subject: data.subject,
    priority: data.priority ?? 'normal',
  });
  const message = await repo.createMessage({
    ticketId: ticket._id,
    senderId: userId,
    senderRole: 'partner',
    body: data.body,
    attachments: data.attachments,
  });
  return {
    ticket: toTicketDto(ticket.toObject() as unknown as TicketRow),
    message: toMessageDto(message.toObject() as unknown as MessageRow),
  };
}

export async function listPartnerTickets(userId: string, status?: string) {
  let statuses: readonly TicketStatus[] | undefined;
  if (status && status !== 'all') {
    if (status === 'active') statuses = ACTIVE;
    else if (status === 'closed') statuses = CLOSED;
    else if ((TICKET_STATUSES as readonly string[]).includes(status)) statuses = [status as TicketStatus];
    else throw new TicketError(400, 'Invalid status filter', { status: 'Use all, active, closed or a ticket status' });
  }
  const tickets = await repo.findTicketsByOwner(userId, statuses);
  return { tickets: tickets.map((t) => toTicketDto(t as TicketRow)) };
}

export async function getPartnerTicket(userId: string, ticketId: string) {
  const ticket = await loadOwnTicket(ticketId, userId);
  const messages = await repo.findPublicMessages(ticketId);
  return { ticket: toTicketDto(ticket), messages: messages.map(toMessageDto) };
}

export async function replyToPartnerTicket(userId: string, ticketId: string, input: unknown) {
  // Validate the id and the body first so a bad request never costs a database read.
  assertObjectId(ticketId, 'ticketId');
  const data = parseReply(input);
  const ticket = await loadOwnTicket(ticketId, userId);
  if (ticket.status === 'closed') throw new TicketError(409, 'This ticket is closed. Open a new ticket instead.');
  const message = await repo.createMessage({
    ticketId,
    senderId: userId,
    senderRole: 'partner',
    body: data.body,
    attachments: data.attachments,
  });
  await repo.touchTicket(ticketId, new Date());
  const dto = toMessageDto(message.toObject() as unknown as MessageRow);
  // Live: admins watching this thread and the partner's other devices. Never throws (saved first).
  emitTicketMessage(userId, {
    id: dto.id,
    ticketId: dto.ticketId,
    sender: { id: userId, name: null, role: 'partner' },
    body: dto.body,
    attachments: dto.attachments,
    internal: false,
    createdAt: dto.createdAt,
  });
  return { message: dto };
}

export type { CreateTicketInput };
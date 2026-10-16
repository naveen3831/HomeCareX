import { Types, type FilterQuery } from 'mongoose';
import type { Ticket } from '../../models/Ticket';
import { HttpError } from '../auth/auth.types';
import type {
  TicketLean,
  TicketMessageLean,
} from '../admin-tickets/admin-tickets.repository';
import {
  ticketsRepository,
  type TicketsRepository,
} from './tickets.repository';
import type { NewTicket, TicketQuery } from './tickets.validation';
import type { TicketDto, TicketMessageDto } from './tickets.types';
import type { TicketStatus } from './tickets.constants';
import type { EvidenceFile } from './tickets.upload';
import { emitToUser, getIO, rooms } from '../../sockets';

export type TicketActor = { id: string; role: 'customer' | 'admin' };
const iso = (date: Date) => new Date(date).toISOString();
export const ticketDto = (t: TicketLean): TicketDto => ({
  id: String(t._id),
  createdBy: String(t.createdBy),
  createdByRole: t.createdByRole,
  bookingId: t.bookingId ? String(t.bookingId) : null,
  category: t.category,
  subject: t.subject,
  priority: t.priority,
  status: t.status,
  assignedTo: t.assignedTo ? String(t.assignedTo) : null,
  lastMessageAt: iso(t.lastMessageAt),
  createdAt: iso(t.createdAt),
  updatedAt: iso(t.updatedAt),
});
const messageDto = (m: TicketMessageLean): TicketMessageDto => ({
  id: String(m._id),
  ticketId: String(m.ticketId),
  senderId: String(m.senderId),
  senderRole: m.senderRole,
  body: m.body,
  attachments: m.attachments ?? [],
  readAt: m.readAt ? iso(m.readAt) : null,
  createdAt: iso(m.createdAt),
});
const notFound = () =>
  new HttpError(404, 'Ticket not found.', 'TICKET_NOT_FOUND');
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function publish(ticket: TicketLean) {
  try {
    const event = { ticketId: String(ticket._id) };
    emitToUser(String(ticket.createdBy), 'ticket:updated', event);
    getIO().to(rooms.role('admin')).emit('ticket:updated', event);
  } catch {
    /* HTTP workers may run without sockets; foreground polling refreshes threads too. */
  }
}

export function createTicketsService(
  repo: TicketsRepository,
  notify = publish,
) {
  async function owned(id: string, actor: TicketActor) {
    if (!/^[a-f\d]{24}$/i.test(id)) throw notFound();
    const filter: FilterQuery<Ticket> = {
      _id: new Types.ObjectId(id),
      ...(actor.role === 'customer'
        ? { createdBy: new Types.ObjectId(actor.id), createdByRole: 'customer' }
        : {}),
    };
    const ticket = await repo.get(filter);
    if (!ticket) throw notFound();
    return ticket;
  }
  return {
    async list(customerId: string, query: TicketQuery) {
      const filter: FilterQuery<Ticket> = {
        createdBy: new Types.ObjectId(customerId),
        createdByRole: 'customer',
        ...(query.status ? { status: query.status } : {}),
        ...(query.search
          ? { subject: { $regex: escape(query.search), $options: 'i' } }
          : {}),
      };
      const [rows, total] = await Promise.all([
        repo.list(filter, (query.page - 1) * query.limit, query.limit),
        repo.count(filter),
      ]);
      return {
        items: rows.map(ticketDto),
        meta: {
          page: query.page,
          limit: query.limit,
          total,
          pages: Math.max(1, Math.ceil(total / query.limit)),
        },
      };
    },
    async create(customerId: string, input: NewTicket, files: EvidenceFile[]) {
      if (
        input.bookingId &&
        !(await repo.ownsBooking(input.bookingId, customerId))
      ) {
        throw new HttpError(
          404,
          'Choose one of your own bookings.',
          'BOOKING_NOT_FOUND',
        );
      }
      const ticket = await repo.create(customerId, input, files);
      notify(ticket);
      return ticketDto(ticket);
    },
    async get(id: string, actor: TicketActor, before?: string) {
      const ticket = await owned(id, actor);
      const rows = await repo.messages(id, before);
      const selected = rows.slice(0, 100);
      return {
        ticket: ticketDto(ticket),
        messages: selected.reverse().map(messageDto),
        nextBefore: rows.length > 100 ? String(rows[99]._id) : null,
      };
    },
    async reply(
      id: string,
      actor: TicketActor,
      body: string,
      files: EvidenceFile[],
    ) {
      const ticket = await owned(id, actor);
      if (ticket.status === 'closed' || ticket.status === 'resolved') {
        throw new HttpError(
          409,
          'This ticket is resolved or closed. Create a new ticket for further help.',
          'TICKET_CLOSED',
        );
      }
      const message = await repo.append(ticket, actor, body, files);
      if (!message)
        throw new HttpError(
          409,
          'The ticket changed. Refresh and try again.',
          'CONFLICT',
        );
      notify(ticket);
      return messageDto(message);
    },
    async setStatus(id: string, status: TicketStatus, actor: TicketActor) {
      if (actor.role !== 'admin')
        throw new HttpError(403, 'Support permission required.', 'FORBIDDEN');
      const ticket = await owned(id, actor);
      const next = await repo.status(ticket, status);
      if (!next)
        throw new HttpError(
          409,
          'The ticket changed. Refresh and try again.',
          'CONFLICT',
        );
      notify(next);
      return ticketDto(next);
    },
    async evidence(id: string, fileId: string, actor: TicketActor) {
      await owned(id, actor);
      const file = await repo.evidence(id, fileId);
      if (!file) throw new HttpError(404, 'Attachment not found.', 'NOT_FOUND');
      return file;
    },
  };
}
export const ticketsService = createTicketsService(ticketsRepository);

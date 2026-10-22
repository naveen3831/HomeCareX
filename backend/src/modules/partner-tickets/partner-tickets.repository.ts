import type { Types } from 'mongoose';
import { TicketModel } from '../../models/Ticket';
import { TicketMessageModel } from '../tickets/TicketMessage';
import type { TicketStatus, TicketCategory, TicketPriority } from '../tickets/tickets.constants';
import type { TicketAttachmentDto } from '../tickets/tickets.types';

export const createTicket = (data: {
  createdBy: string;
  createdByRole: 'customer' | 'partner';
  bookingId: string | null;
  category: TicketCategory;
  subject: string;
  priority: TicketPriority;
}) => TicketModel.create({ ...data, lastMessageAt: new Date() });

export const createMessage = (data: {
  ticketId: Types.ObjectId | string;
  senderId: string;
  senderRole: 'customer' | 'partner' | 'admin';
  body: string;
  attachments: TicketAttachmentDto[];
}) => TicketMessageModel.create(data);

export const findTicketsByOwner = (ownerId: string, statuses?: readonly TicketStatus[]) =>
  TicketModel.find({ createdBy: ownerId, ...(statuses ? { status: { $in: statuses } } : {}) })
    .sort({ lastMessageAt: -1 })
    .lean();

export const findTicketById = (id: string) => TicketModel.findById(id).lean();

/** Internal (agent-only) notes are never returned to the person who raised the ticket. */
export const findPublicMessages = (ticketId: string) =>
  TicketMessageModel.find({ ticketId, isInternal: { $ne: true } })
    .sort({ createdAt: 1 })
    .lean();

export const touchTicket = (id: string, at: Date) =>
  TicketModel.updateOne({ _id: id }, { $set: { lastMessageAt: at } });
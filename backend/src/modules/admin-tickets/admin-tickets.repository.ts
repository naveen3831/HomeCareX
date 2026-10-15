import type { FilterQuery, Types } from 'mongoose';
import { BookingModel } from '../../models/Booking';
import PartnerModel from '../../models/Partner';
import { TicketModel, type Ticket } from '../../models/Ticket';
import { ADMIN_ROLES, UserModel } from '../../models/User';
import { TicketMessageModel } from '../tickets/TicketMessage';
import { MAX_REQUESTER_MATCHES } from './admin-tickets.constants';

export type TicketLean = Ticket & { _id: Types.ObjectId; createdAt: Date; updatedAt: Date };
export interface UserLean {
  _id: Types.ObjectId;
  name?: string;
  email?: string;
  phone?: string;
  status?: string;
}

export interface TicketMessageLean {
  _id: Types.ObjectId;
  ticketId: Types.ObjectId;
  senderId: Types.ObjectId;
  senderRole: 'customer' | 'partner' | 'admin';
  body: string;
  attachments?: { url: string; name: string; mimeType: string; sizeBytes: number }[];
  isInternal?: boolean;
  readAt?: Date | null;
  createdAt: Date;
}

/** The few booking fields the ticket page shows. */
export interface BookingLean {
  _id: Types.ObjectId;
  serviceName?: string;
  status?: string;
  paymentStatus?: string;
  scheduledAt?: Date;
  partnerId?: Types.ObjectId | null;
  address?: { line1?: string; area?: string; city?: string; pincode?: string };
  priceBreakdown?: { total?: number };
}

/** A thread longer than this is cut to its oldest messages (the queue is not a chat client). */
const MAX_THREAD_MESSAGES = 500;

export const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** All database access for the admin support queue. The service holds the rules; nothing here decides anything. */
export const adminTicketsRepository = {
  /** Newest activity first; `_id` breaks ties so pages never overlap. Uses the { status, priority, lastMessageAt } index when filtered. */
  find(filter: FilterQuery<Ticket>, skip: number, limit: number): Promise<TicketLean[]> {
    return TicketModel.find(filter).sort({ lastMessageAt: -1, _id: -1 }).skip(skip).limit(limit).lean<TicketLean[]>();
  },

  count(filter: FilterQuery<Ticket>): Promise<number> {
    return TicketModel.countDocuments(filter);
  },

  findById(id: string): Promise<TicketLean | null> {
    return TicketModel.findById(id).lean<TicketLean>();
  },

  /** The whole thread, oldest first; `_id` breaks ties so order is stable. */
  listMessages(ticketId: string): Promise<TicketMessageLean[]> {
    return TicketMessageModel.find({ ticketId }).sort({ createdAt: 1, _id: 1 }).limit(MAX_THREAD_MESSAGES).lean<TicketMessageLean[]>();
  },

  /** Requester/assignee details for a page of tickets in one query (no populate, so a deleted user keeps its id). */
  findUsersByIds(ids: Types.ObjectId[]): Promise<UserLean[]> {
    if (ids.length === 0) return Promise.resolve([]);
    return UserModel.find({ _id: { $in: ids } })
      .select('name email phone')
      .lean<UserLean[]>();
  },

  /** Free-text requester search over name / email / phone. Customers and partners alike. */
  async findUserIdsByText(text: string): Promise<Types.ObjectId[]> {
    const rx = { $regex: escapeRegex(text), $options: 'i' };
    const users = await UserModel.find({ $or: [{ name: rx }, { email: rx }, { phone: rx }] })
      .select('_id')
      .limit(MAX_REQUESTER_MATCHES)
      .lean<{ _id: Types.ObjectId }[]>();
    return users.map((u) => u._id);
  },

  /** Only an admin account can own a ticket. */
  findAdminUser(id: string): Promise<UserLean | null> {
    return UserModel.findOne({ _id: id, role: { $in: ADMIN_ROLES } })
      .select('name email phone status')
      .lean<UserLean>();
  },

  /** Admins who can own a ticket: same rule as `assign` (an admin account that is not blocked). */
  listAssignableAdmins(): Promise<(UserLean & { name: string })[]> {
    return UserModel.find({ role: { $in: ADMIN_ROLES }, status: { $ne: 'blocked' } })
      .select('name email')
      .sort({ name: 1, _id: 1 })
      .lean<(UserLean & { name: string })[]>();
  },

  /**
   * Compare-and-set: only writes if the assignee is still `from` and the ticket is not closed.
   * Null means someone else changed it between the caller's read and this write.
   */
  setAssignee(id: string, from: Types.ObjectId | null, to: string | null): Promise<TicketLean | null> {
    return TicketModel.findOneAndUpdate(
      { _id: id, assignedTo: from, status: { $ne: 'closed' } },
      { $set: { assignedTo: to } },
      { new: true },
    ).lean<TicketLean>();
  },

  /** Booking details for the ticket page. Null when the booking no longer exists. */
  findBookingSummary(id: string): Promise<BookingLean | null> {
    return BookingModel.findById(id)
      .select('serviceName status paymentStatus scheduledAt partnerId address priceBreakdown.total')
      .lean<BookingLean>();
  },

  /** Booking.partnerId is a Partner._id; the person's name lives on the User. */
  async findPartnerUser(partnerId: Types.ObjectId): Promise<{ id: string; name: string | null } | null> {
    const partner = await PartnerModel.findById(partnerId).select('userId').lean<{ userId: Types.ObjectId }>();
    if (!partner) return null;
    const user = await UserModel.findById(partner.userId).select('name').lean<UserLean>();
    return { id: String(partner.userId), name: user?.name ?? null };
  },

  /** Compare-and-set on status: null means the ticket changed (or was closed) since the caller read it. */
  setStatus(id: string, from: Ticket['status'], to: Ticket['status']): Promise<TicketLean | null> {
    return TicketModel.findOneAndUpdate({ _id: id, status: from }, { $set: { status: to } }, { new: true }).lean<TicketLean>();
  },

  /** Compare-and-set on priority, and never on a closed ticket. */
  setPriority(id: string, from: Ticket['priority'], to: Ticket['priority']): Promise<TicketLean | null> {
    return TicketModel.findOneAndUpdate(
      { _id: id, priority: from, status: { $ne: 'closed' } },
      { $set: { priority: to } },
      { new: true },
    ).lean<TicketLean>();
  },

  /** Saves one agent message. Only a customer-visible reply counts as activity, so an internal note does not reorder the queue. */
  async createMessage(input: { ticketId: string; senderId: string; body: string; internal: boolean }): Promise<TicketMessageLean> {
    const doc = await TicketMessageModel.create({
      ticketId: input.ticketId,
      senderId: input.senderId,
      senderRole: 'admin',
      body: input.body,
      isInternal: input.internal,
    });
    if (!input.internal) {
      await TicketModel.updateOne({ _id: input.ticketId }, { $set: { lastMessageAt: doc.createdAt } });
    }
    return doc.toObject() as unknown as TicketMessageLean;
  },
};
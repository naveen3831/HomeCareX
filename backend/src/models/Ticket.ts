import { Schema, model, type Types } from 'mongoose';
import {
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  type TicketCategory,
  type TicketPriority,
  type TicketStatus,
} from '../modules/tickets/tickets.constants';

/**
 * Support ticket, one queue for customers and partners (contract: modules/tickets/tickets.constants.ts).
 * SLA is deliberately NOT stored: admin-tickets derives it from `priority` + `createdAt`.
 */
export interface Ticket {
  /** User._id of whoever raised it (customers and partners are both Users). */
  createdBy: Types.ObjectId;
  createdByRole: 'customer' | 'partner';
  bookingId?: Types.ObjectId | null;
  category: TicketCategory;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  /** Admin User._id handling it. */
  assignedTo?: Types.ObjectId | null;
  lastMessageAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const TicketSchema = new Schema<Ticket>(
  {
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    createdByRole: { type: String, enum: ['customer', 'partner'], required: true },
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', default: null, index: true },
    category: { type: String, enum: TICKET_CATEGORIES, required: true },
    subject: { type: String, required: true, trim: true, maxlength: 200 },
    status: { type: String, enum: TICKET_STATUSES, default: 'open' },
    priority: { type: String, enum: TICKET_PRIORITIES, default: 'normal' },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    lastMessageAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

// Admin queue: filtered by status/priority, newest activity first.
TicketSchema.index({ status: 1, priority: 1, lastMessageAt: -1 });
TicketSchema.index({ assignedTo: 1, status: 1 });
TicketSchema.index({ createdAt: -1 });

export const TicketModel = model<Ticket>('Ticket', TicketSchema);
export default TicketModel;

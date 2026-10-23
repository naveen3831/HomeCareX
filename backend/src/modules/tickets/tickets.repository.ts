import mongoose, { Schema, Types, model, type FilterQuery } from 'mongoose';
import { BookingModel } from '../../models/Booking';
import { TicketModel, type Ticket } from '../../models/Ticket';
import { TicketMessageModel } from './TicketMessage';
import type { TicketLean, TicketMessageLean } from '../admin-tickets/admin-tickets.repository';
import type { EvidenceFile } from './tickets.upload';
import type { NewTicket } from './tickets.validation';
import type { TicketActor } from './tickets.service';
import type { TicketStatus } from './tickets.constants';

const EvidenceModel =
  mongoose.models.TicketEvidence ??
  model(
    'TicketEvidence',
    new Schema(
      {
        ticketId: { type: Schema.Types.ObjectId, ref: 'Ticket', required: true, index: true },
        fileId: { type: String, required: true, unique: true },
        name: { type: String, required: true },
        mimeType: { type: String, required: true },
        sizeBytes: { type: Number, required: true },
        data: { type: Buffer, required: true, select: false },
      },
      { timestamps: false },
    ),
  );

export interface TicketEvidence extends EvidenceFile {
  id: string;
}

export interface TicketsRepository {
  list(filter: FilterQuery<Ticket>, skip: number, limit: number): Promise<TicketLean[]>;
  count(filter: FilterQuery<Ticket>): Promise<number>;
  get(filter: FilterQuery<Ticket>): Promise<TicketLean | null>;
  ownsBooking(bookingId: string, customerId: string): Promise<boolean>;
  create(customerId: string, input: NewTicket, files: EvidenceFile[]): Promise<TicketLean>;
  messages(ticketId: string, beforeId?: string): Promise<TicketMessageLean[]>;
  append(ticket: TicketLean, actor: TicketActor, body: string, files: EvidenceFile[]): Promise<TicketMessageLean | null>;
  status(ticket: TicketLean, status: TicketStatus): Promise<TicketLean | null>;
  evidence(ticketId: string, fileId: string): Promise<TicketEvidence | null>;
}

export const ticketsRepository: TicketsRepository = {
  list(filter, skip, limit) {
    return TicketModel.find(filter)
      .sort({ lastMessageAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean<TicketLean[]>();
  },

  count(filter) {
    return TicketModel.countDocuments(filter);
  },

  get(filter) {
    return TicketModel.findOne(filter).lean<TicketLean>();
  },

  async ownsBooking(bookingId, customerId) {
    return Boolean(await BookingModel.exists({ _id: bookingId, customerId }));
  },

  async create(customerId, input, files) {
    const ticket = await TicketModel.create({
      createdBy: customerId,
      createdByRole: 'customer',
      bookingId: input.bookingId ?? null,
      category: input.category,
      subject: input.subject,
      priority: input.priority ?? 'normal',
      status: 'open',
      assignedTo: null,
      lastMessageAt: new Date(),
    });
    const lean = ticket.toObject() as TicketLean;
    await this.append(lean, { id: customerId, role: 'customer' }, input.body, files);
    return lean;
  },

  messages(ticketId, beforeId) {
    const filter: FilterQuery<InstanceType<typeof TicketMessageModel>> = { ticketId };
    if (beforeId && Types.ObjectId.isValid(beforeId)) {
      filter._id = { $lt: new Types.ObjectId(beforeId) };
    }
    return TicketMessageModel.find(filter)
      .sort({ _id: -1 })
      .limit(101)
      .lean<TicketMessageLean[]>();
  },

  async append(ticket, actor, body, files) {
    const attachments = files.map((file) => ({
      url: `/api/v1/tickets/${ticket._id}/attachments/${new Types.ObjectId()}`,
      name: file.name,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
    }));
    const fileIds = attachments.map((attachment) => attachment.url.split('/').at(-1)!);
    if (files.length) {
      await EvidenceModel.insertMany(
        files.map((file, index) => ({
          ticketId: ticket._id,
          fileId: fileIds[index],
          ...file,
        })),
      );
    }
    const message = await TicketMessageModel.create({
      ticketId: ticket._id,
      senderId: actor.id,
      senderRole: actor.role,
      body,
      attachments,
      readAt: null,
    });
    await TicketModel.updateOne(
      { _id: ticket._id },
      { $set: { lastMessageAt: message.createdAt } },
    );
    return message.toObject() as TicketMessageLean;
  },

  async status(ticket, status) {
    return TicketModel.findOneAndUpdate(
      { _id: ticket._id, status: ticket.status },
      { $set: { status } },
      { new: true },
    ).lean<TicketLean>();
  },

  async evidence(ticketId, fileId) {
    const file = await EvidenceModel.findOne({ ticketId, fileId })
      .select('+data')
      .lean<{ name: string; mimeType: string; sizeBytes: number; data: Buffer }>();
    return file ? { id: fileId, ...file } : null;
  },
};

import { Types, type FilterQuery } from "mongoose";
import { TicketModel, type Ticket } from "../../models/Ticket";
import BookingModel from "../../models/Booking";
import { TicketMessageModel } from "./TicketMessage";
import { TicketAttachmentModel } from "./TicketAttachment";
import type {
  TicketMessageLean,
  TicketLean,
} from "../admin-tickets/admin-tickets.repository";
import type { EvidenceFile } from "./tickets.upload";
import type { NewTicket } from "./tickets.validation";
import type { TicketSenderRole, TicketStatus } from "./tickets.constants";

export interface StoredEvidence extends EvidenceFile {
  id: string;
}
export interface TicketsRepository {
  list(
    filter: FilterQuery<Ticket>,
    skip: number,
    limit: number,
  ): Promise<TicketLean[]>;
  count(filter: FilterQuery<Ticket>): Promise<number>;
  get(filter: FilterQuery<Ticket>): Promise<TicketLean | null>;
  ownsBooking(bookingId: string, customerId: string): Promise<boolean>;
  create(
    customerId: string,
    input: NewTicket,
    files: EvidenceFile[],
  ): Promise<TicketLean>;
  messages(ticketId: string, before?: string): Promise<TicketMessageLean[]>;
  append(
    ticket: TicketLean,
    actor: { id: string; role: TicketSenderRole },
    body: string,
    files: EvidenceFile[],
  ): Promise<TicketMessageLean | null>;
  status(ticket: TicketLean, status: TicketStatus): Promise<TicketLean | null>;
  evidence(ticketId: string, fileId: string): Promise<StoredEvidence | null>;
}

async function writeMessage(
  ticketId: Types.ObjectId,
  actor: { id: string; role: TicketSenderRole },
  body: string,
  files: EvidenceFile[],
) {
  const messageId = new Types.ObjectId();
  const attachments = files.map((f) => ({
    ...f,
    _id: new Types.ObjectId(),
    ticketId,
    messageId,
  }));
  try {
    if (attachments.length)
      await TicketAttachmentModel.insertMany(attachments, { ordered: true });
    const message = await TicketMessageModel.create({
      _id: messageId,
      ticketId,
      senderId: actor.id,
      senderRole: actor.role,
      body,
      attachments: attachments.map((f) => ({
        name: f.name,
        mimeType: f.mimeType,
        sizeBytes: f.sizeBytes,
        url: `/api/v1/tickets/${ticketId}/attachments/${f._id}`,
      })),
    });
    return message.toObject() as TicketMessageLean;
  } catch (error) {
    await TicketAttachmentModel.deleteMany({ messageId });
    throw error;
  }
}

export const ticketsRepository: TicketsRepository = {
  list: (filter, skip, limit) =>
    TicketModel.find(filter)
      .sort({ lastMessageAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean<TicketLean[]>(),
  count: (filter) => TicketModel.countDocuments(filter),
  get: (filter) => TicketModel.findOne(filter).lean<TicketLean>(),
  ownsBooking: async (bookingId, customerId) =>
    Boolean(await BookingModel.exists({ _id: bookingId, customerId })),
  async create(customerId, input, files) {
    const ticketId = new Types.ObjectId();
    // Publish only after the initial message and evidence exist. Supports standalone MongoDB.
    try {
      const first = await writeMessage(
        ticketId,
        { id: customerId, role: "customer" },
        input.body,
        files,
      );
      const ticket = await TicketModel.create({
        _id: ticketId,
        createdBy: customerId,
        createdByRole: "customer",
        category: input.category,
        subject: input.subject,
        priority: input.priority,
        bookingId: input.bookingId ?? null,
        lastMessageAt: first.createdAt,
      });
      return ticket.toObject();
    } catch (error) {
      await TicketMessageModel.deleteMany({ ticketId });
      await TicketAttachmentModel.deleteMany({ ticketId });
      throw error;
    }
  },
  async messages(ticketId, before) {
    const filter = {
      ticketId,
      ...(before ? { _id: { $lt: new Types.ObjectId(before) } } : {}),
    };
    return TicketMessageModel.find(filter)
      .sort({ _id: -1 })
      .limit(101)
      .lean<TicketMessageLean[]>();
  },
  async append(ticket, actor, body, files) {
    // Compare-and-set linearizes the reply before any later status change.
    const updated = await TicketModel.findOneAndUpdate(
      { _id: ticket._id, status: ticket.status },
      {
        $max: { lastMessageAt: new Date() },
        ...(ticket.status === "waiting" && actor.role === "customer"
          ? { $set: { status: "in_progress" } }
          : {}),
      },
    );
    if (!updated) return null;
    return writeMessage(ticket._id, actor, body, files);
  },
  status: (ticket, status) =>
    TicketModel.findOneAndUpdate(
      { _id: ticket._id, status: ticket.status },
      { $set: { status } },
      { new: true },
    ).lean<TicketLean>(),
  async evidence(ticketId, fileId) {
    const file = await TicketAttachmentModel.findOne({
      _id: fileId,
      ticketId,
    }).select("+data");
    if (!file) return null;
    return {
      id: String(file._id),
      name: file.name,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      data: Buffer.from(file.data),
    };
  },
};

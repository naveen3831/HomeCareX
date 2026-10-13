import type { Types } from "mongoose";
import BookingModel from "../../models/Booking";
import PartnerModel from "../../models/Partner";
import ConversationModel from "../../models/Conversation";
import MessageModel, { type MessageSenderRole } from "../../models/Message";

export interface ChatBookingDoc {
  _id: Types.ObjectId;
  customerId: Types.ObjectId;
  partnerId?: Types.ObjectId | null;
  status: string;
}

export interface MessageDoc {
  _id: Types.ObjectId;
  bookingId: Types.ObjectId;
  senderId: Types.ObjectId;
  senderRole: MessageSenderRole;
  text?: string;
  attachments?: Array<{ url: string; kind?: string }>;
  createdAt: Date;
}

export interface NewMessage {
  bookingId: Types.ObjectId;
  customerId: Types.ObjectId;
  partnerId: Types.ObjectId;
  senderId: string;
  senderRole: MessageSenderRole;
  text: string;
  attachments: Array<{ url: string; kind: "image" }>;
}

export const chatRepository = {
  findBooking(bookingId: string) {
    return BookingModel.findById(bookingId)
      .select("customerId partnerId status")
      .lean<ChatBookingDoc>();
  },

  findPartnerByUserId(userId: string) {
    return PartnerModel.findOne({ userId })
      .select("_id")
      .lean<{ _id: Types.ObjectId }>();
  },

  /** Newest first. Fetches `limit + 1` so the caller can tell whether more pages exist. */
  listMessages(bookingId: string, limit: number, before?: string) {
    const filter: Record<string, unknown> = { bookingId };
    if (before) filter._id = { $lt: before };
    return MessageModel.find(filter)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .lean<MessageDoc[]>();
  },

  async createMessage(input: NewMessage): Promise<MessageDoc> {
    const preview = input.text ? input.text.slice(0, 140) : "Photo";
    const conversation = await ConversationModel.findOneAndUpdate(
      { bookingId: input.bookingId },
      {
        $setOnInsert: {
          bookingId: input.bookingId,
          customerId: input.customerId,
          partnerId: input.partnerId,
        },
        $set: { lastMessageAt: new Date(), lastMessagePreview: preview },
      },
      { upsert: true, new: true },
    );
    const created = await MessageModel.create({
      conversationId: conversation._id,
      bookingId: input.bookingId,
      senderId: input.senderId,
      senderRole: input.senderRole,
      text: input.text,
      attachments: input.attachments,
    });
    return created.toObject() as unknown as MessageDoc;
  },
};

import { Schema, model, type InferSchemaType, Types } from "mongoose";

export const MESSAGE_SENDER_ROLES = ["customer", "partner"] as const;
export type MessageSenderRole = (typeof MESSAGE_SENDER_ROLES)[number];

const AttachmentSchema = new Schema(
  {
    url: { type: String, required: true, maxlength: 220_000 },
    kind: { type: String, enum: ["image"], default: "image" },
  },
  { _id: false },
);

const MessageSchema = new Schema(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
    },
    bookingId: { type: Schema.Types.ObjectId, ref: "Booking", required: true },
    senderId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    senderRole: { type: String, enum: MESSAGE_SENDER_ROLES, required: true },
    text: { type: String, trim: true, maxlength: 1000, default: "" },
    attachments: { type: [AttachmentSchema], default: [] },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

/** Powers GET /bookings/:id/messages (newest first, cursor by _id). */
MessageSchema.index({ bookingId: 1, _id: -1 });

export type Message = InferSchemaType<typeof MessageSchema> & {
  _id: Types.ObjectId;
  createdAt: Date;
};
export const MessageModel = model("Message", MessageSchema);
export default MessageModel;

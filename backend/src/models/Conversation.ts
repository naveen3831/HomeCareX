import { Schema, model, type InferSchemaType, Types } from "mongoose";

/** One conversation per booking. Created lazily on the first message. */
const ConversationSchema = new Schema(
  {
    bookingId: {
      type: Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
      unique: true,
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    /** Partner._id (not the User id), same convention as Booking.partnerId. */
    partnerId: {
      type: Schema.Types.ObjectId,
      ref: "Partner",
      required: true,
      index: true,
    },
    lastMessageAt: { type: Date },
    lastMessagePreview: { type: String, maxlength: 140 },
  },
  { timestamps: true },
);

export type Conversation = InferSchemaType<typeof ConversationSchema> & {
  _id: Types.ObjectId;
};
export const ConversationModel = model("Conversation", ConversationSchema);
export default ConversationModel;

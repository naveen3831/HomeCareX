import {
  Schema,
  model,
  models,
  type InferSchemaType,
} from "mongoose";

const conversationSchema = new Schema(
  {
    bookingId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
      unique: true,
      ref: "Booking",
    },

    customerId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
      ref: "User",
    },

    partnerId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
      ref: "User",
    },

    lastMessageAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

conversationSchema.index(
  {
    bookingId: 1,
    customerId: 1,
    partnerId: 1,
  },
  {
    unique: true,
  }
);

export type ConversationDocument =
  InferSchemaType<typeof conversationSchema>;

export const Conversation =
  models.Conversation ||
  model("Conversation", conversationSchema);
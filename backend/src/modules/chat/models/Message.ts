import {
  Schema,
  model,
  models,
  type InferSchemaType,
} from "mongoose";

const attachmentSchema = new Schema(
  {
    url: {
      type: String,
      required: true,
    },

    name: {
      type: String,
      required: true,
      maxlength: 255,
    },

    mimeType: {
      type: String,
      required: true,
      maxlength: 100,
    },

    size: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  {
    _id: false,
  }
);

const messageSchema = new Schema(
  {
    bookingId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
      ref: "Booking",
    },

    conversationId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
      ref: "Conversation",
    },

    senderId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
      ref: "User",
    },

    senderRole: {
      type: String,
      enum: ["customer", "partner", "admin"],
      required: true,
    },

    text: {
      type: String,
      maxlength: 2000,
      default: "",
    },

    attachments: {
      type: [attachmentSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

messageSchema.index({
  bookingId: 1,
  createdAt: 1,
});

export type MessageDocument =
  InferSchemaType<typeof messageSchema>;

export const Message =
  models.Message ||
  model("Message", messageSchema);
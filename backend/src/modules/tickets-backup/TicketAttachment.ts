import { Schema, model } from 'mongoose';
import { MAX_ATTACHMENT_BYTES } from './tickets.upload';

// Private evidence is stored separately; it is never published through express.static().
const schema = new Schema(
  {
    ticketId: {
      type: Schema.Types.ObjectId,
      ref: 'Ticket',
      required: true,
      index: true,
    },
    messageId: {
      type: Schema.Types.ObjectId,
      ref: 'TicketMessage',
      required: true,
    },
    name: { type: String, required: true, maxlength: 180 },
    mimeType: { type: String, required: true },
    sizeBytes: {
      type: Number,
      required: true,
      min: 1,
      max: MAX_ATTACHMENT_BYTES,
    },
    data: { type: Buffer, required: true, select: false },
  },
  { timestamps: true },
);

export const TicketAttachmentModel = model('TicketAttachment', schema);

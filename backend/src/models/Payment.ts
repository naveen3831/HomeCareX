import { Schema, model, models, type Document, type Model, Types } from 'mongoose';

export const PAYMENT_STATUSES = ['PENDING', 'PAID', 'FAILED', 'REFUNDED'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export const REFUND_STATUSES = [
  'none',
  'requested',
  'approved',
  'processed',
  'rejected',
  'PENDING_APPROVAL',
  'APPROVED',
  'CREDITED',
  'REJECTED',
  'NOT_REQUIRED',
  'PROCESSING',
  'CREDIT_FAILED',
] as const;
export type RefundStatus = (typeof REFUND_STATUSES)[number];

/**
 * One Razorpay order per payment attempt for a booking (customer checkout, R05).
 * Admin dashboards read the refund queue from refund.status 'requested' / 'approved' / 'PENDING_APPROVAL'.
 */
export interface IPayment extends Document {
  bookingId: Types.ObjectId;
  customerId?: Types.ObjectId;
  razorpayOrderId: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  amount: number; // in INR
  currency: string;
  method?: string; // card, upi, netbanking, wallet, cod
  /** Checkout attempts made against this order (create/reuse). Capped by PAYMENT_MAX_ATTEMPTS. */
  attempts: number;
  status: PaymentStatus;
  errorReason?: string;
  paidAt?: Date;
  /**
   * Set once the service is done AND the money has been credited (online / QR: partner wallet + admin commission;
   * cash on service: admin commission deducted from the partner wallet). The admin Payments page shows
   * "Paid" only after this is set; before it a received payment still reads "Pending".
   */
  creditedAt?: Date | null;
  refund: { status: RefundStatus; amount?: number; requestedAt?: Date };
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema = new Schema<IPayment>(
  {
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    razorpayOrderId: { type: String, required: true, unique: true, trim: true },
    razorpayPaymentId: { type: String, trim: true, sparse: true, index: true },
    razorpaySignature: { type: String, trim: true },
    amount: { type: Number, required: true, min: [0, 'Payment amount must be greater than or equal to 0'] },
    currency: { type: String, default: 'INR', uppercase: true, trim: true },
    method: { type: String, trim: true },
    attempts: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: PAYMENT_STATUSES, default: 'PENDING', index: true },
    errorReason: { type: String, trim: true },
    paidAt: { type: Date },
    creditedAt: { type: Date, default: null },
    refund: {
      status: { type: String, enum: REFUND_STATUSES, default: 'none' },
      amount: { type: Number, min: 0 },
      requestedAt: { type: Date },
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: Record<string, unknown>) => {
        delete ret.__v;
        return ret;
      },
    },
  },
);

PaymentSchema.index({ bookingId: 1, status: 1 });
PaymentSchema.index({ 'refund.status': 1 });
PaymentSchema.index({ status: 1, creditedAt: 1 });

// Reuse the compiled model on hot-reload (ts-node-dev) to avoid OverwriteModelError.
export const PaymentModel: Model<IPayment> =
  (models.Payment as Model<IPayment>) || model<IPayment>('Payment', PaymentSchema);
export default PaymentModel;

import { Types } from 'mongoose';

import { BookingModel } from '../../models/Booking';
import { PaymentModel } from '../../models/Payment';
import {
  RefundModel,
  type RefundMethod,
  type RefundRequestStatus,
} from '../../models/Refund';
import { WalletModel, WalletLedgerModel } from '../../models/Wallet';
import { AppError } from '../../utils/AppError';
import { notify } from '../notifications';
import { auditService } from '../audit/audit.service';

export interface CreateRefundServiceInput {
  paymentId: string;
  amount: number;
  reason: string;
  method?: RefundMethod;
  adminId: string;
  ip: string;
}

export interface UpdateRefundServiceInput {
  refundId: string;
  action: 'approve' | 'reject';
  rejectionReason?: string;
  reason?: string;
  adminId: string;
  ip: string;
}

export interface ApproveRefundServiceInput {
  refundId: string;
  adminId: string;
  ip: string;
}

export interface RejectRefundServiceInput {
  refundId: string;
  rejectionReason: string;
  adminId: string;
  ip: string;
}

function isObjectId(value: string): boolean {
  return Types.ObjectId.isValid(value);
}

/**
 * Returns the total amount already refunded/credited successfully for the payment.
 */
async function getRefundedAmount(paymentId: Types.ObjectId): Promise<number> {
  const refunds = await RefundModel.find({
    paymentId,
    status: { $in: ['CREDITED', 'processed'] },
  })
    .select('amount')
    .lean();

  if (refunds.length > 0) {
    return refunds.reduce((total, refund) => total + (refund.amount || 0), 0);
  }

  const payment = await PaymentModel.findById(paymentId).select('refund status').lean();
  if (payment?.refund && (payment.refund.status === 'CREDITED' || payment.refund.status === 'processed')) {
    return payment.refund.amount ?? 0;
  }
  return 0;
}

/**
 * Returns amounts currently reserved by refund requests that have not yet been completed or rejected.
 */
async function getReservedRefundAmount(
  paymentId: Types.ObjectId,
  excludeRefundId?: Types.ObjectId,
): Promise<number> {
  const query: Record<string, unknown> = {
    paymentId,
    status: { $in: ['requested', 'PENDING_APPROVAL', 'approved', 'PROCESSING'] },
  };
  if (excludeRefundId) {
    query._id = { $ne: excludeRefundId };
  }

  const refunds = await RefundModel.find(query).select('amount').lean();
  return refunds.reduce((total, refund) => total + (refund.amount || 0), 0);
}

export class RefundsService {
  /**
   * Create a new refund request.
   * POST /admin/refunds
   */
  async createRefund(input: CreateRefundServiceInput) {
    const {
      paymentId,
      amount,
      reason,
      method = 'WALLET',
      adminId,
      ip,
    } = input;

    if (!isObjectId(paymentId)) {
      throw new AppError(400, 'INVALID_PAYMENT_ID', 'Invalid payment ID');
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new AppError(400, 'INVALID_REFUND_AMOUNT', 'Refund amount must be greater than zero');
    }

    if (!reason?.trim()) {
      throw new AppError(400, 'REFUND_REASON_REQUIRED', 'Refund reason is required');
    }

    if (!isObjectId(adminId)) {
      throw new AppError(400, 'INVALID_ADMIN_ID', 'Invalid admin ID');
    }

    const payment = await PaymentModel.findById(paymentId);
    if (!payment) {
      throw new AppError(404, 'PAYMENT_NOT_FOUND', 'Payment record not found');
    }

    if (payment.status !== 'PAID' && payment.status !== 'REFUNDED') {
      throw new AppError(400, 'PAYMENT_NOT_REFUNDABLE', 'Only a paid payment can be refunded');
    }

    const booking = await BookingModel.findById(payment.bookingId);
    if (!booking) {
      throw new AppError(404, 'BOOKING_NOT_FOUND', 'Booking associated with payment was not found');
    }

    const customerId = payment.customerId ?? booking.customerId;
    if (!customerId) {
      throw new AppError(400, 'CUSTOMER_NOT_FOUND', 'Customer associated with payment was not found');
    }

    const alreadyRefunded = await getRefundedAmount(payment._id);
    const reservedAmount = await getReservedRefundAmount(payment._id);
    const maxRefundable = payment.amount - alreadyRefunded - reservedAmount;

    if (amount > maxRefundable) {
      throw new AppError(
        400,
        'REFUND_EXCEEDS_PAID_AMOUNT',
        `Refund amount cannot exceed the remaining refundable amount of ₹${Math.max(maxRefundable, 0).toFixed(2)}`,
        {
          paidAmount: payment.amount,
          alreadyRefunded,
          reservedAmount,
          maxRefundable: Math.max(maxRefundable, 0),
        },
      );
    }

    const now = new Date();
    const refund = await RefundModel.create({
      paymentId: payment._id,
      bookingId: booking._id,
      customerId,
      amount,
      currency: 'INR',
      reason: reason.trim().slice(0, 500),
      method,
      status: 'PENDING_APPROVAL',
      requestedBy: new Types.ObjectId(adminId),
      requestedAt: now,
    });

    await PaymentModel.updateOne(
      { _id: payment._id },
      {
        $set: {
          'refund.status': 'PENDING_APPROVAL',
          'refund.amount': amount,
          'refund.requestedAt': now,
        },
      },
    );

    await BookingModel.updateOne(
      { _id: booking._id },
      {
        $set: {
          refundStatus: 'PENDING_APPROVAL',
          refundDetails: {
            refundId: refund._id,
            amount,
            status: 'PENDING_APPROVAL',
            destination: 'HomeCareX Wallet',
            requestedAt: now,
          },
        },
      },
    );

    await auditService.recordAudit({
      actor: adminId,
      action: 'refund.created',
      entity: 'Refund',
      entityId: String(refund._id),
      after: {
        paymentId: String(payment._id),
        bookingId: String(booking._id),
        amount,
        reason,
        method,
      },
      ip,
      result: 'Success',
    });

    return refund;
  }

  /**
   * Approve a refund and execute mandatory wallet credit to the original customer.
   * POST /admin/refunds/:id/approve
   */
  async approveRefund(input: ApproveRefundServiceInput) {
    const { refundId, adminId, ip } = input;

    if (!isObjectId(refundId)) {
      throw new AppError(400, 'INVALID_REFUND_ID', 'Invalid refund ID');
    }
    if (!isObjectId(adminId)) {
      throw new AppError(400, 'INVALID_ADMIN_ID', 'Invalid admin ID');
    }

    // 1. Atomic state transition to avoid concurrency & duplicate processing
    const refund = await RefundModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(refundId),
        status: { $in: ['PENDING_APPROVAL', 'requested', 'CREDIT_FAILED', 'PROCESSING'] },
      },
      {
        $set: {
          status: 'PROCESSING',
        },
      },
      { new: true },
    );

    if (!refund) {
      const existing = await RefundModel.findById(refundId);
      if (!existing) {
        throw new AppError(404, 'REFUND_NOT_FOUND', 'Refund request not found');
      }
      if (existing.status === 'CREDITED' || existing.status === 'processed') {
        throw new AppError(409, 'REFUND_ALREADY_PROCESSED', 'Refund has already been credited to the customer wallet');
      }
      if (existing.status === 'REJECTED' || existing.status === 'rejected') {
        throw new AppError(409, 'REFUND_ALREADY_REJECTED', 'Refund was already rejected');
      }
      throw new AppError(409, 'REFUND_ALREADY_PROCESSED', `Refund is already ${existing.status}`);
    }

    // 2. Fetch trusted server-side Booking record
    const booking = await BookingModel.findById(refund.bookingId);
    if (!booking) {
      await RefundModel.updateOne({ _id: refund._id }, { $set: { status: 'PENDING_APPROVAL' } });
      throw new AppError(404, 'BOOKING_NOT_FOUND', 'Associated booking not found');
    }

    const isCancelled = String(booking.status || '').startsWith('cancelled') || booking.status === 'no_show';
    if (!isCancelled) {
      await RefundModel.updateOne({ _id: refund._id }, { $set: { status: 'PENDING_APPROVAL' } });
      throw new AppError(400, 'BOOKING_NOT_CANCELLED', 'Only cancelled bookings are eligible for refund approval');
    }

    // 3. Fetch trusted server-side Payment record
    const payment = await PaymentModel.findById(refund.paymentId);
    if (!payment) {
      await RefundModel.updateOne({ _id: refund._id }, { $set: { status: 'PENDING_APPROVAL' } });
      throw new AppError(404, 'PAYMENT_NOT_FOUND', 'Associated payment record not found');
    }

    if (payment.status !== 'PAID' && payment.status !== 'REFUNDED') {
      await RefundModel.updateOne({ _id: refund._id }, { $set: { status: 'PENDING_APPROVAL' } });
      throw new AppError(400, 'PAYMENT_NOT_REFUNDABLE', 'Booking does not have a successfully captured payment');
    }

    // 4. Retrieve original customer ID strictly from trusted server records
    const customerId = String(booking.customerId || refund.customerId || payment.customerId);
    if (!customerId) {
      await RefundModel.updateOne({ _id: refund._id }, { $set: { status: 'PENDING_APPROVAL' } });
      throw new AppError(400, 'CUSTOMER_NOT_FOUND', 'Original customer not found on booking');
    }

    // 5. Verify refundable amount does not exceed remaining paid balance
    const alreadyCredited = await getRefundedAmount(payment._id);
    const maxRefundable = payment.amount - alreadyCredited;
    if (refund.amount > maxRefundable + 0.01) {
      await RefundModel.updateOne({ _id: refund._id }, { $set: { status: 'PENDING_APPROVAL' } });
      throw new AppError(
        400,
        'REFUND_EXCEEDS_PAID_AMOUNT',
        `Refund amount of ₹${refund.amount.toFixed(2)} exceeds remaining refundable amount of ₹${Math.max(maxRefundable, 0).toFixed(2)}`,
        {
          paidAmount: payment.amount,
          alreadyCredited,
          maxRefundable: Math.max(maxRefundable, 0),
        },
      );
    }

    // 6. Mandatory Wallet Credit using idempotency key
    const idempotencyRef = `refund_${refund._id}`;
    let finalBalance = 0;

    try {
      // Check if wallet ledger entry was already inserted (e.g. retry after network glitch)
      const existingLedger = await WalletLedgerModel.findOne({ referenceId: idempotencyRef });
      if (existingLedger) {
        finalBalance = existingLedger.balanceAfter;
      } else {
        // Increment wallet balance atomically in Rupees
        const updatedWallet = await WalletModel.findOneAndUpdate(
          { userId: customerId },
          { $inc: { balance: refund.amount }, $setOnInsert: { userId: customerId } },
          { new: true, upsert: true, setDefaultsOnInsert: true },
        );
        finalBalance = updatedWallet.balance;

        // Create corresponding wallet ledger entry
        await WalletLedgerModel.create({
          walletId: updatedWallet._id,
          userId: customerId,
          type: 'refund_credit',
          amount: refund.amount,
          balanceAfter: finalBalance,
          description: `Refund credited for cancelled booking #${String(booking._id).slice(-6).toUpperCase()}`,
          referenceId: idempotencyRef,
          bookingId: booking._id,
          refundId: refund._id,
        });
      }
    } catch (creditErr) {
      console.error('[RefundApproval] Wallet credit failed:', creditErr);
      await RefundModel.updateOne(
        { _id: refund._id },
        { $set: { status: 'CREDIT_FAILED', rejectionReason: 'Wallet credit transaction failed during processing' } },
      );
      throw new AppError(500, 'WALLET_CREDIT_FAILED', 'Wallet credit failed. The refund status is set to CREDIT_FAILED and can be safely retried.');
    }

    // 7. Update Refund document to CREDITED
    const now = new Date();
    refund.status = 'CREDITED';
    refund.approvedBy = new Types.ObjectId(adminId);
    refund.approvedAt = now;
    refund.processedAt = now;
    refund.method = 'WALLET';
    refund.walletTransactionId = idempotencyRef;
    await refund.save();

    // 8. Update Booking status to reflect completed refund
    await BookingModel.updateOne(
      { _id: booking._id },
      {
        $set: {
          paymentStatus: 'REFUNDED',
          refundStatus: 'CREDITED',
          'refundDetails.refundId': refund._id,
          'refundDetails.amount': refund.amount,
          'refundDetails.status': 'CREDITED',
          'refundDetails.destination': 'HomeCareX Wallet',
          'refundDetails.creditedAt': now,
          'refundDetails.walletTransactionRef': idempotencyRef,
        },
      },
    );

    // 9. Update Payment
    const totalRefunded = alreadyCredited + refund.amount;
    const fullyRefunded = totalRefunded >= payment.amount;
    await PaymentModel.updateOne(
      { _id: payment._id },
      {
        $set: {
          ...(fullyRefunded ? { status: 'REFUNDED' as const } : {}),
          'refund.status': 'CREDITED',
          'refund.amount': totalRefunded,
        },
      },
    );

    // 10. Customer Notification & Audit (best effort)
    try {
      await notify(customerId, 'refund.updated', {
        refundId: String(refund._id),
        bookingId: String(booking._id),
        amount: refund.amount,
        status: 'CREDITED',
        destination: 'HomeCareX Wallet',
        walletTransactionRef: idempotencyRef,
      });
    } catch (notifErr) {
      console.warn('[RefundApproval] Customer notification failed:', notifErr);
    }

    try {
      await auditService.recordAudit({
        actor: adminId,
        action: 'refund.approved',
        entity: 'Refund',
        entityId: String(refund._id),
        before: { status: 'PENDING_APPROVAL' },
        after: {
          status: 'CREDITED',
          amount: refund.amount,
          destination: 'HomeCareX Wallet',
          customerId,
          walletTransactionRef: idempotencyRef,
        },
        ip,
        result: 'Success',
      });
    } catch (auditErr) {
      console.warn('[RefundApproval] Audit record failed:', auditErr);
    }

    return refund;
  }

  /**
   * Reject a refund with an explicit reason.
   * POST /admin/refunds/:id/reject
   */
  async rejectRefund(input: RejectRefundServiceInput) {
    const { refundId, rejectionReason, adminId, ip } = input;

    if (!isObjectId(refundId)) {
      throw new AppError(400, 'INVALID_REFUND_ID', 'Invalid refund ID');
    }
    if (!isObjectId(adminId)) {
      throw new AppError(400, 'INVALID_ADMIN_ID', 'Invalid admin ID');
    }

    const cleanReason = String(rejectionReason ?? '').trim();
    if (!cleanReason || cleanReason.length < 3) {
      throw new AppError(400, 'REJECTION_REASON_REQUIRED', 'A valid rejection reason (minimum 3 characters) is required');
    }

    const refund = await RefundModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(refundId),
        status: { $in: ['PENDING_APPROVAL', 'requested', 'PROCESSING', 'CREDIT_FAILED'] },
      },
      {
        $set: {
          status: 'REJECTED',
          rejectedBy: new Types.ObjectId(adminId),
          rejectedAt: new Date(),
          rejectionReason: cleanReason,
        },
      },
      { new: true },
    );

    if (!refund) {
      const existing = await RefundModel.findById(refundId);
      if (!existing) {
        throw new AppError(404, 'REFUND_NOT_FOUND', 'Refund request not found');
      }
      if (existing.status === 'CREDITED' || existing.status === 'processed') {
        throw new AppError(409, 'REFUND_ALREADY_PROCESSED', 'Cannot reject a refund that has already been credited');
      }
      if (existing.status === 'REJECTED' || existing.status === 'rejected') {
        throw new AppError(409, 'REFUND_ALREADY_REJECTED', 'Refund was already rejected');
      }
      throw new AppError(409, 'REFUND_ALREADY_PROCESSED', `Refund is already ${existing.status}`);
    }

    const now = new Date();

    // Update Booking
    await BookingModel.updateOne(
      { _id: refund.bookingId },
      {
        $set: {
          refundStatus: 'REJECTED',
          'refundDetails.status': 'REJECTED',
          'refundDetails.rejectedAt': now,
          'refundDetails.rejectionReason': cleanReason,
        },
      },
    );

    // Update Payment
    await PaymentModel.updateOne(
      { _id: refund.paymentId },
      {
        $set: {
          'refund.status': 'REJECTED',
        },
      },
    );

    // Customer Notification & Audit (best effort)
    try {
      await notify(String(refund.customerId), 'refund.updated', {
        refundId: String(refund._id),
        bookingId: String(refund.bookingId),
        amount: refund.amount,
        status: 'REJECTED',
        reason: cleanReason,
      });
    } catch (notifErr) {
      console.warn('[RefundRejection] Customer notification failed:', notifErr);
    }

    try {
      await auditService.recordAudit({
        actor: adminId,
        action: 'refund.rejected',
        entity: 'Refund',
        entityId: String(refund._id),
        before: { status: 'PENDING_APPROVAL' },
        after: {
          status: 'REJECTED',
          rejectionReason: cleanReason,
        },
        ip,
        result: 'Success',
      });
    } catch (auditErr) {
      console.warn('[RefundRejection] Audit record failed:', auditErr);
    }

    return refund;
  }

  /**
   * Universal update method (for backward compatibility with PATCH /admin/refunds/:id).
   */
  async updateRefund(input: UpdateRefundServiceInput) {
    const { refundId, action, rejectionReason, reason, adminId, ip } = input;
    if (action === 'approve') {
      return this.approveRefund({ refundId, adminId, ip });
    }
    if (action === 'reject') {
      return this.rejectRefund({
        refundId,
        rejectionReason: rejectionReason || reason || 'Refund rejected by admin',
        adminId,
        ip,
      });
    }
    throw new AppError(400, 'INVALID_REFUND_ACTION', 'Refund action must be approve or reject');
  }

  /**
   * Get single refund details with full audit and relational data.
   * GET /admin/refunds/:id
   */
  async getRefundById(refundId: string) {
    if (!isObjectId(refundId)) {
      throw new AppError(400, 'INVALID_REFUND_ID', 'Invalid refund ID');
    }

    const refund = await RefundModel.findById(refundId)
      .populate('paymentId', 'razorpayPaymentId razorpayOrderId amount currency method status paidAt')
      .populate('bookingId', 'customerId serviceName paymentStatus status scheduledAt createdAt cancellationReason priceBreakdown priceSnapshot')
      .populate('customerId', 'name email phone')
      .populate('requestedBy', 'name email')
      .populate('approvedBy', 'name email')
      .populate('rejectedBy', 'name email')
      .lean();

    if (!refund) {
      throw new AppError(404, 'REFUND_NOT_FOUND', 'Refund request not found');
    }

    return refund;
  }

  /**
   * Get admin refund list with filtering, searching, pagination, and summary counts.
   * GET /admin/refunds
   */
  async listRefunds(query: {
    status?: string;
    paymentId?: string;
    bookingId?: string;
    customerId?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(query.page ?? 1, 1);
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);

    const filter: Record<string, unknown> = {};

    // Status filter normalization
    if (query.status && query.status !== 'all' && query.status !== 'ALL') {
      const s = query.status.trim().toUpperCase();
      if (s === 'PENDING_APPROVAL' || s === 'REQUESTED') {
        filter.status = { $in: ['PENDING_APPROVAL', 'requested'] };
      } else if (s === 'CREDITED' || s === 'PROCESSED') {
        filter.status = { $in: ['CREDITED', 'processed'] };
      } else if (s === 'REJECTED') {
        filter.status = { $in: ['REJECTED', 'rejected'] };
      } else {
        filter.status = query.status;
      }
    }

    if (query.paymentId && isObjectId(query.paymentId)) {
      filter.paymentId = new Types.ObjectId(query.paymentId);
    }
    if (query.bookingId && isObjectId(query.bookingId)) {
      filter.bookingId = new Types.ObjectId(query.bookingId);
    }
    if (query.customerId && isObjectId(query.customerId)) {
      filter.customerId = new Types.ObjectId(query.customerId);
    }

    if (query.search?.trim()) {
      const search = query.search.trim();
      if (isObjectId(search)) {
        const objectId = new Types.ObjectId(search);
        filter.$or = [
          { _id: objectId },
          { paymentId: objectId },
          { bookingId: objectId },
          { customerId: objectId },
        ];
      }
    }

    const [items, total, pendingCount, creditedCount, rejectedCount, totalCount] = await Promise.all([
      RefundModel.find(filter)
        .populate('paymentId', 'razorpayPaymentId razorpayOrderId amount currency method status paidAt')
        .populate('bookingId', 'customerId serviceName paymentStatus status scheduledAt createdAt cancellationReason priceBreakdown priceSnapshot')
        .populate('customerId', 'name email phone')
        .populate('requestedBy', 'name email')
        .populate('approvedBy', 'name email')
        .populate('rejectedBy', 'name email')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      RefundModel.countDocuments(filter),
      RefundModel.countDocuments({ status: { $in: ['PENDING_APPROVAL', 'requested'] } }),
      RefundModel.countDocuments({ status: { $in: ['CREDITED', 'processed'] } }),
      RefundModel.countDocuments({ status: { $in: ['REJECTED', 'rejected'] } }),
      RefundModel.countDocuments({}),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
      summaryCounts: {
        pendingApproval: pendingCount,
        credited: creditedCount,
        rejected: rejectedCount,
        total: totalCount,
      },
    };
  }
}

export const refundsService = new RefundsService();
export default refundsService;

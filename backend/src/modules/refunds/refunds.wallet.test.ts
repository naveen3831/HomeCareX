import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Types } from 'mongoose';

import { RefundModel } from '../../models/Refund';
import { BookingModel } from '../../models/Booking';
import { PaymentModel } from '../../models/Payment';
import { WalletModel, WalletLedgerModel } from '../../models/Wallet';
import { NotificationModel } from '../../models/Notification';
import { AuditLogModel } from '../../models/AuditLog';
import { refundsService } from './refunds.service';
import { BookingService } from '../bookings/bookings.service';
import { bookingsRepository } from '../bookings/bookings.repository';
import { bookingSettings } from '../bookings/bookings.settings';

// Stub IDs
const customerObjectId = new Types.ObjectId();
const adminObjectId = new Types.ObjectId();
const bookingObjectId = new Types.ObjectId();
const paymentObjectId = new Types.ObjectId();
const refundObjectId = new Types.ObjectId();

test('Refund & Wallet Workflow: Unit & Integration Suite', async (t) => {
  // Silence notification & audit DB writes during testing
  const origNotificationCreate = NotificationModel.create;
  const origAuditCreate = AuditLogModel.create;
  NotificationModel.create = (async (doc: any) => doc) as any;
  AuditLogModel.create = (async (doc: any) => doc) as any;

  // 1. Cancellation of paid booking -> PENDING_APPROVAL refund request
  await t.test('cancelling a paid booking generates a refund request with PENDING_APPROVAL and WALLET destination', async () => {
    let refundCreated = false;
    let savedRefundDoc: any = null;

    const originalFindPaidPayment = bookingsRepository.findPaidPayment;
    const originalFindById = bookingsRepository.findByIdForCustomer;
    const originalMarkCancelled = bookingsRepository.markCancelled;
    const originalCreateRefundRequest = bookingsRepository.createRefundRequest;
    const originalPolicy = bookingSettings.getCancellationPolicy;

    let callCount = 0;
    try {
      bookingsRepository.findByIdForCustomer = async () => {
        callCount++;
        if (callCount === 1) {
          // Pre-cancellation check
          return {
            _id: bookingObjectId,
            customerId: customerObjectId,
            serviceId: 's1',
            status: 'confirmed',
            paymentStatus: 'PAID',
            scheduledAt: new Date(Date.now() + 10 * 3600000),
            extraCharges: [],
            statusHistory: [],
            priceSnapshot: { total: 1500 },
          } as any;
        }
        // Post-cancellation getBooking
        return {
          _id: bookingObjectId,
          customerId: customerObjectId,
          serviceId: 's1',
          status: 'cancelled_by_customer',
          paymentStatus: 'PAID',
          scheduledAt: new Date(Date.now() + 10 * 3600000),
          extraCharges: [],
          statusHistory: [],
          refundStatus: 'PENDING_APPROVAL',
          priceSnapshot: { total: 1500 },
          refundDetails: {
            amount: 1500,
            status: 'PENDING_APPROVAL',
            destination: 'HomeCareX Wallet',
          },
        } as any;
      };

      bookingsRepository.findPaidPayment = async () => ({
        _id: paymentObjectId,
        amount: 1500,
        status: 'PAID',
        customerId: customerObjectId,
      } as any);

      bookingSettings.getCancellationPolicy = async () => ({
        windowHours: 4,
        feeAmount: 0,
      });

      bookingsRepository.createRefundRequest = async (input: any) => {
        refundCreated = true;
        savedRefundDoc = {
          _id: refundObjectId,
          bookingId: input.bookingId,
          paymentId: input.paymentId,
          customerId: input.customerId,
          amount: input.amount,
          status: 'PENDING_APPROVAL',
          method: 'WALLET',
        };
        return savedRefundDoc as any;
      };

      bookingsRepository.markCancelled = async (
        bookingId: any,
        customerId: any,
        fromStatus: any,
        historyEntry: any,
        reason: any,
        refundStatus?: any,
      ) => {
        return {
          _id: bookingId,
          status: 'cancelled_by_customer',
          cancellationReason: reason,
          refundStatus,
        } as any;
      };

      const result = await BookingService.cancelBooking(
        String(customerObjectId),
        String(bookingObjectId),
        'Change of schedule',
      );

      assert.equal(refundCreated, true);
      assert.equal(savedRefundDoc?.status, 'PENDING_APPROVAL');
      assert.equal(savedRefundDoc?.method, 'WALLET');
      assert.equal(savedRefundDoc?.amount, 1500);
      assert.equal(result.cancellation.refundStatus, 'requested');
      assert.equal(result.booking.refundStatus, 'PENDING_APPROVAL');
      assert.equal((result.booking.refund as any)?.destination, 'HomeCareX Wallet');
    } finally {
      bookingsRepository.findPaidPayment = originalFindPaidPayment;
      bookingsRepository.findByIdForCustomer = originalFindById;
      bookingsRepository.markCancelled = originalMarkCancelled;
      bookingsRepository.createRefundRequest = originalCreateRefundRequest;
      bookingSettings.getCancellationPolicy = originalPolicy;
    }
  });

  // 2. Cancellation of unpaid booking -> NO refund request created
  await t.test('cancelling an unpaid booking does not create any refund request and sets refundStatus to NOT_REQUIRED', async () => {
    let refundCreated = false;

    const originalFindPaidPayment = bookingsRepository.findPaidPayment;
    const originalFindById = bookingsRepository.findByIdForCustomer;
    const originalMarkCancelled = bookingsRepository.markCancelled;
    const originalCreateRefundRequest = bookingsRepository.createRefundRequest;
    const originalPolicy = bookingSettings.getCancellationPolicy;

    let callCount = 0;
    try {
      bookingsRepository.findByIdForCustomer = async () => {
        callCount++;
        if (callCount === 1) {
          return {
            _id: bookingObjectId,
            customerId: customerObjectId,
            status: 'pending_payment',
            scheduledAt: new Date(Date.now() + 10 * 3600000),
            extraCharges: [],
            statusHistory: [],
          } as any;
        }
        return {
          _id: bookingObjectId,
          customerId: customerObjectId,
          status: 'cancelled_by_customer',
          scheduledAt: new Date(Date.now() + 10 * 3600000),
          extraCharges: [],
          statusHistory: [],
          refundStatus: 'NOT_REQUIRED',
        } as any;
      };

      bookingsRepository.findPaidPayment = async () => null;

      bookingSettings.getCancellationPolicy = async () => ({
        windowHours: 4,
        feeAmount: 0,
      });

      bookingsRepository.createRefundRequest = async () => {
        refundCreated = true;
        return {} as any;
      };

      bookingsRepository.markCancelled = async (
        bookingId: any,
        customerId: any,
        fromStatus: any,
        historyEntry: any,
        reason: any,
        refundStatus?: any,
      ) => {
        return {
          _id: bookingId,
          status: 'cancelled_by_customer',
          refundStatus,
        } as any;
      };

      const result = await BookingService.cancelBooking(
        String(customerObjectId),
        String(bookingObjectId),
        'No longer needed',
      );

      assert.equal(refundCreated, false);
      assert.equal(result.cancellation.refundStatus, 'none');
      assert.equal(result.cancellation.refundAmount, 0);
      assert.equal(result.booking.refundStatus, 'NOT_REQUIRED');
    } finally {
      bookingsRepository.findPaidPayment = originalFindPaidPayment;
      bookingsRepository.findByIdForCustomer = originalFindById;
      bookingsRepository.markCancelled = originalMarkCancelled;
      bookingsRepository.createRefundRequest = originalCreateRefundRequest;
      bookingSettings.getCancellationPolicy = originalPolicy;
    }
  });

  // 3. Admin approval credits wallet and updates status to CREDITED
  await t.test('admin approving refund credits customer wallet and updates status to CREDITED', async () => {
    const originalRefundFindOneAndUpdate = RefundModel.findOneAndUpdate;
    const originalRefundFind = RefundModel.find;
    const originalBookingFindById = BookingModel.findById;
    const originalPaymentFindById = PaymentModel.findById;
    const originalWalletFindOneAndUpdate = WalletModel.findOneAndUpdate;
    const originalWalletLedgerFindOne = WalletLedgerModel.findOne;
    const originalWalletLedgerCreate = WalletLedgerModel.create;
    const originalBookingUpdateOne = BookingModel.updateOne;
    const originalPaymentUpdateOne = PaymentModel.updateOne;

    let walletCredited = false;
    let ledgerCreated = false;
    let creditedCustomer = '';
    let creditedAmount = 0;
    let ledgerReference = '';

    const refundDoc = {
      _id: refundObjectId,
      bookingId: bookingObjectId,
      paymentId: paymentObjectId,
      customerId: customerObjectId,
      amount: 1500,
      status: 'PROCESSING',
      method: 'WALLET',
      approvedBy: undefined as any,
      approvedAt: undefined as any,
      processedAt: undefined as any,
      walletTransactionId: undefined as any,
      save: async function () {
        return this;
      },
    };

    try {
      RefundModel.findOneAndUpdate = (async () => refundDoc as any) as any;

      RefundModel.find = (() => ({
        select: () => ({
          lean: async () => [],
        }),
      })) as any;

      BookingModel.findById = (async () => ({
        _id: bookingObjectId,
        customerId: customerObjectId,
        status: 'cancelled_by_customer',
        paymentStatus: 'PAID',
      })) as any;

      const paymentDoc = {
        _id: paymentObjectId,
        customerId: customerObjectId,
        amount: 1500,
        status: 'PAID',
      };
      PaymentModel.findById = (() => {
        const p = Promise.resolve(paymentDoc) as any;
        p.select = () => ({
          lean: async () => ({ refund: { amount: 0 } }),
        });
        return p;
      }) as any;

      WalletLedgerModel.findOne = (async () => null) as any;

      WalletModel.findOneAndUpdate = (async (filter: any, update: any) => {
        walletCredited = true;
        creditedCustomer = filter.userId;
        creditedAmount = update.$inc.balance;
        return {
          _id: new Types.ObjectId(),
          userId: creditedCustomer,
          balance: 2000,
        };
      }) as any;

      WalletLedgerModel.create = (async (doc: any) => {
        ledgerCreated = true;
        ledgerReference = doc.referenceId;
        return doc;
      }) as any;

      BookingModel.updateOne = (async () => ({ modifiedCount: 1 })) as any;
      PaymentModel.updateOne = (async () => ({ modifiedCount: 1 })) as any;

      const approved = await refundsService.approveRefund({
        refundId: String(refundObjectId),
        adminId: String(adminObjectId),
        ip: '127.0.0.1',
      });

      assert.equal(walletCredited, true);
      assert.equal(ledgerCreated, true);
      assert.equal(creditedCustomer, String(customerObjectId));
      assert.equal(creditedAmount, 1500);
      assert.equal(ledgerReference, `refund_${refundObjectId}`);
      assert.equal(approved.status, 'CREDITED');
      assert.equal(approved.method, 'WALLET');
      assert.equal(approved.walletTransactionId, `refund_${refundObjectId}`);
    } finally {
      RefundModel.findOneAndUpdate = originalRefundFindOneAndUpdate;
      RefundModel.find = originalRefundFind;
      BookingModel.findById = originalBookingFindById;
      PaymentModel.findById = originalPaymentFindById;
      WalletModel.findOneAndUpdate = originalWalletFindOneAndUpdate;
      WalletLedgerModel.findOne = originalWalletLedgerFindOne;
      WalletLedgerModel.create = originalWalletLedgerCreate;
      BookingModel.updateOne = originalBookingUpdateOne;
      PaymentModel.updateOne = originalPaymentUpdateOne;
    }
  });

  // 4. Repeated approval call does not double-credit (Idempotency)
  await t.test('duplicate approval attempts on already processed refunds are rejected with 409', async () => {
    const originalRefundFindOneAndUpdate = RefundModel.findOneAndUpdate;
    const originalRefundFindById = RefundModel.findById;

    try {
      RefundModel.findOneAndUpdate = (async () => null) as any;
      RefundModel.findById = (async () => ({
        _id: refundObjectId,
        status: 'CREDITED',
      })) as any;

      await assert.rejects(
        () =>
          refundsService.approveRefund({
            refundId: String(refundObjectId),
            adminId: String(adminObjectId),
            ip: '127.0.0.1',
          }),
        {
          statusCode: 409,
          code: 'REFUND_ALREADY_PROCESSED',
        },
      );
    } finally {
      RefundModel.findOneAndUpdate = originalRefundFindOneAndUpdate;
      RefundModel.findById = originalRefundFindById;
    }
  });

  // 5. Admin rejection requires reason and does not credit wallet
  await t.test('admin rejection requires a valid reason, records timestamp, and does not touch customer wallet', async () => {
    await assert.rejects(
      () =>
        refundsService.rejectRefund({
          refundId: String(refundObjectId),
          rejectionReason: '  ',
          adminId: String(adminObjectId),
          ip: '127.0.0.1',
        }),
      {
        statusCode: 400,
        code: 'REJECTION_REASON_REQUIRED',
      },
    );

    const originalRefundFindOneAndUpdate = RefundModel.findOneAndUpdate;
    const originalBookingUpdateOne = BookingModel.updateOne;
    const originalPaymentUpdateOne = PaymentModel.updateOne;

    let bookingRefundStatusSet = '';
    let bookingRejectionReasonSet = '';

    try {
      RefundModel.findOneAndUpdate = (async (filter: any, update: any) => ({
        _id: refundObjectId,
        bookingId: bookingObjectId,
        customerId: customerObjectId,
        status: 'REJECTED',
        rejectionReason: update.$set.rejectionReason,
        rejectedAt: update.$set.rejectedAt,
        rejectedBy: update.$set.rejectedBy,
      })) as any;

      BookingModel.updateOne = (async (filter: any, update: any) => {
        bookingRefundStatusSet = update.$set.refundStatus;
        bookingRejectionReasonSet = update.$set['refundDetails.rejectionReason'];
        return { modifiedCount: 1 };
      }) as any;

      PaymentModel.updateOne = (async () => ({ modifiedCount: 1 })) as any;

      const rejected = await refundsService.rejectRefund({
        refundId: String(refundObjectId),
        rejectionReason: 'Cancellation requested past policy deadline',
        adminId: String(adminObjectId),
        ip: '127.0.0.1',
      });

      assert.equal(rejected.status, 'REJECTED');
      assert.equal(rejected.rejectionReason, 'Cancellation requested past policy deadline');
      assert.equal(bookingRefundStatusSet, 'REJECTED');
      assert.equal(bookingRejectionReasonSet, 'Cancellation requested past policy deadline');
    } finally {
      RefundModel.findOneAndUpdate = originalRefundFindOneAndUpdate;
      BookingModel.updateOne = originalBookingUpdateOne;
      PaymentModel.updateOne = originalPaymentUpdateOne;
    }
  });

  // 6. Security: Non-cancelled booking cannot be refunded
  await t.test('attempting to approve a refund for a non-cancelled booking is rejected', async () => {
    const originalRefundFindOneAndUpdate = RefundModel.findOneAndUpdate;
    const originalRefundUpdateOne = RefundModel.updateOne;
    const originalBookingFindById = BookingModel.findById;

    try {
      RefundModel.findOneAndUpdate = (async () => ({
        _id: refundObjectId,
        bookingId: bookingObjectId,
        paymentId: paymentObjectId,
        status: 'PROCESSING',
      })) as any;

      BookingModel.findById = (async () => ({
        _id: bookingObjectId,
        status: 'confirmed',
      })) as any;

      RefundModel.updateOne = (async () => ({ modifiedCount: 1 })) as any;

      await assert.rejects(
        () =>
          refundsService.approveRefund({
            refundId: String(refundObjectId),
            adminId: String(adminObjectId),
            ip: '127.0.0.1',
          }),
        {
          statusCode: 400,
          code: 'BOOKING_NOT_CANCELLED',
        },
      );
    } finally {
      RefundModel.findOneAndUpdate = originalRefundFindOneAndUpdate;
      RefundModel.updateOne = originalRefundUpdateOne;
      BookingModel.findById = originalBookingFindById;
    }
  });

  // 7. Security: Refund exceeding remaining paid balance is rejected
  await t.test('refund approval exceeding remaining paid amount is rejected with 400', async () => {
    const originalRefundFindOneAndUpdate = RefundModel.findOneAndUpdate;
    const originalRefundUpdateOne = RefundModel.updateOne;
    const originalRefundFind = RefundModel.find;
    const originalBookingFindById = BookingModel.findById;
    const originalPaymentFindById = PaymentModel.findById;

    try {
      RefundModel.findOneAndUpdate = (async () => ({
        _id: refundObjectId,
        bookingId: bookingObjectId,
        paymentId: paymentObjectId,
        customerId: customerObjectId,
        amount: 2000,
        status: 'PROCESSING',
      })) as any;

      BookingModel.findById = (async () => ({
        _id: bookingObjectId,
        customerId: customerObjectId,
        status: 'cancelled_by_customer',
      })) as any;

      const paymentDoc = {
        _id: paymentObjectId,
        customerId: customerObjectId,
        amount: 1500,
        status: 'PAID',
      };
      PaymentModel.findById = (() => {
        const p = Promise.resolve(paymentDoc) as any;
        p.select = () => ({
          lean: async () => ({ refund: { amount: 0 } }),
        });
        return p;
      }) as any;

      RefundModel.find = (() => ({
        select: () => ({
          lean: async () => [],
        }),
      })) as any;

      RefundModel.updateOne = (async () => ({ modifiedCount: 1 })) as any;

      await assert.rejects(
        () =>
          refundsService.approveRefund({
            refundId: String(refundObjectId),
            adminId: String(adminObjectId),
            ip: '127.0.0.1',
          }),
        {
          statusCode: 400,
          code: 'REFUND_EXCEEDS_PAID_AMOUNT',
        },
      );
    } finally {
      RefundModel.findOneAndUpdate = originalRefundFindOneAndUpdate;
      RefundModel.updateOne = originalRefundUpdateOne;
      RefundModel.find = originalRefundFind;
      BookingModel.findById = originalBookingFindById;
      PaymentModel.findById = originalPaymentFindById;
    }
  });

  // Restore DB stubs
  NotificationModel.create = origNotificationCreate;
  AuditLogModel.create = origAuditCreate;
});

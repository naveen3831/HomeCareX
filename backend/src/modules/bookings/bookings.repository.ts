import { randomInt } from 'crypto';
import mongoose, { Types } from 'mongoose';
import { BookingModel, type IBooking } from '../../models/Booking';
import { UserModel } from '../../models/User';
import { PaymentModel, type IPayment } from '../../models/Payment';
import { RefundModel, type IRefund } from '../../models/Refund';
import { BOOKING_STATUS, EXTRA_CHARGE_DECISION_STATUSES, SLOT_HOLDING_STATUSES } from './bookings.constants';
import { buildBookingFilter, SORT_SPECS, type ListBookingsQuery } from './bookings.query';
import type { StatusHistoryEntry } from './bookings.stateMachine';

const PARTNER_POPULATE = {
  path: 'partnerId',
  select: 'userId ratingAvg ratingCount kyc city name phone rating avatar',
  populate: {
    path: 'userId',
    select: 'name phone email role',
  },
};

export class BookingsRepository {
  /** Active (slot-holding) bookings for a service/date/slot, used to compute remaining seats. */
  countActiveForSlot(serviceId: string, date: string, slot: string, now: Date = new Date()): Promise<number> {
    if (!Types.ObjectId.isValid(serviceId)) return Promise.resolve(0);

    return BookingModel.countDocuments({
      serviceId: new Types.ObjectId(serviceId),
      date,
      slot,
      status: { $in: SLOT_HOLDING_STATUSES },
      $nor: [{ status: BOOKING_STATUS.PENDING_PAYMENT, holdExpiresAt: { $lte: now } }],
    }).exec();
  }

  /** Cancels lapsed pending_payment holds for one slot so their seats are freed. */
  async releaseStaleHolds(serviceId?: string, date?: string, slot?: string, now: Date = new Date()): Promise<unknown> {
    const filter: Record<string, unknown> = {
      status: BOOKING_STATUS.PENDING_PAYMENT,
      holdExpiresAt: { $lte: now },
    };
    if (serviceId && Types.ObjectId.isValid(serviceId)) filter.serviceId = new Types.ObjectId(serviceId);
    if (date) filter.date = date;
    if (slot) filter.slot = slot;

    // Refund any wallet balance used on holds that lapsed before payment was completed
    try {
      const staleWithWallet = await BookingModel.find({
        ...filter,
        $or: [{ wallet_used: { $gt: 0 } }, { walletUsed: { $gt: 0 } }],
      }).select('_id').lean();
      if (staleWithWallet.length > 0) {
        const { referralsService } = await import('../referrals/referrals.service');
        for (const b of staleWithWallet) {
          await referralsService.refundWalletUsed(String(b._id)).catch(() => null);
        }
      }
    } catch (e) {
      console.error('[bookings] Error refunding wallet for stale holds:', e);
    }

    return BookingModel.updateMany(
      filter,
      {
        $set: { status: BOOKING_STATUS.CANCELLED_BY_CUSTOMER },
        // Free the seat so the unique (service, date, slot, seat) index lets someone else take it.
        $unset: { slotSeat: '' },
        $push: {
          statusHistory: {
            from: BOOKING_STATUS.PENDING_PAYMENT,
            to: BOOKING_STATUS.CANCELLED_BY_CUSTOMER,
            at: now,
            actorRole: 'system',
            reason: 'Payment hold expired',
          },
        },
      }
    ).exec();
  }

  findByCustomerAndIdempotencyKey(customerId: string, idempotencyKey: string): Promise<IBooking | null> {
    if (!Types.ObjectId.isValid(customerId)) return Promise.resolve(null);

    return BookingModel.findOne({
      customerId: new Types.ObjectId(customerId),
      idempotencyKey,
    }).exec();
  }

  async findFreeSeat(
    serviceId: string,
    date: string,
    slot: string,
    capacity: number = 5,
    now: Date = new Date()
  ): Promise<number | null> {
    if (!Types.ObjectId.isValid(serviceId)) return null;

    const taken = await BookingModel.find({
      serviceId: new Types.ObjectId(serviceId),
      date,
      slot,
      status: { $in: SLOT_HOLDING_STATUSES },
      $nor: [{ status: BOOKING_STATUS.PENDING_PAYMENT, holdExpiresAt: { $lte: now } }],
    })
      .select('slotSeat')
      .lean()
      .exec();

    const takenSeats = new Set(taken.map((b) => b.slotSeat));
    for (let seat = 1; seat <= capacity; seat += 1) {
      if (!takenSeats.has(seat)) return seat;
    }
    return null;
  }

  async create(doc: Partial<IBooking>, options?: { session?: mongoose.ClientSession }): Promise<IBooking> {
    if (options?.session) {
      const [created] = await BookingModel.create([doc], options);
      return created;
    }
    return BookingModel.create(doc);
  }

  findById(id: string): Promise<IBooking | null> {
    if (!Types.ObjectId.isValid(id)) return Promise.resolve(null);

    return BookingModel.findById(id)
      .populate(PARTNER_POPULATE)
      .exec();
  }

  findByIdForCustomer(id: string, customerId: string): Promise<IBooking | null> {
    if (!Types.ObjectId.isValid(id) || !Types.ObjectId.isValid(customerId)) {
      return Promise.resolve(null);
    }

    return BookingModel.findOne({
      _id: new Types.ObjectId(id),
      customerId: new Types.ObjectId(customerId),
    })
      .populate(PARTNER_POPULATE)
      .exec();
  }

  /**
   * The start OTP for a booking whose partner has arrived. Created on first read (4 digits) and then
   * stable, so the code the customer sees is the code the partner must enter. Safe under concurrent
   * reads: only one writer wins the conditional update, the other re-reads the winner's code.
   */
  async getOrCreateStartOtp(id: string): Promise<string | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    const _id = new Types.ObjectId(id);
    type WithOtp = { otpCodes?: { start?: string } } | null;

    const existing = (await BookingModel.findById(_id).select('+otpCodes.start').lean().exec()) as WithOtp;
    if (existing?.otpCodes?.start) return existing.otpCodes.start;

    const code = String(randomInt(0, 10_000)).padStart(4, '0');
    const updated = (await BookingModel.findOneAndUpdate(
      {
        _id,
        $or: [{ 'otpCodes.start': { $exists: false } }, { 'otpCodes.start': null }, { 'otpCodes.start': '' }],
      },
      { $set: { 'otpCodes.start': code } },
      { new: true },
    )
      .select('+otpCodes.start')
      .lean()
      .exec()) as WithOtp;
    if (updated?.otpCodes?.start) return updated.otpCodes.start;

    const winner = (await BookingModel.findById(_id).select('+otpCodes.start').lean().exec()) as WithOtp;
    return winner?.otpCodes?.start ?? code;
  }

  /**
   * Records the customer's decision on ONE pending extra charge, atomically.
   * The filter is the whole rule: own booking, partner on site, charge still pending. Returns null when
   * any of those is false, so a double tap or a stale screen can never decide a charge twice.
   */
  decideExtraCharge(
    bookingId: string,
    customerId: string,
    chargeId: string,
    decision: 'approved' | 'rejected',
    now: Date = new Date(),
  ): Promise<IBooking | null> {
    if (![bookingId, customerId, chargeId].every((v) => Types.ObjectId.isValid(v))) return Promise.resolve(null);
    const charge = new Types.ObjectId(chargeId);

    return BookingModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(bookingId),
        customerId: new Types.ObjectId(customerId),
        status: { $in: [...EXTRA_CHARGE_DECISION_STATUSES, 'ARRIVED', 'IN_PROGRESS'] },
        extraCharges: { $elemMatch: { _id: charge, status: 'pending' } },
      },
      { $set: { 'extraCharges.$[c].status': decision, 'extraCharges.$[c].decidedAt': now } },
      { new: true, arrayFilters: [{ 'c._id': charge, 'c.status': 'pending' }] },
    ).exec();
  }

  /** Name, email and phone of the signed-in customer, printed on their invoice. */
  async findCustomerContact(
    customerId: string,
  ): Promise<{ name?: string; email?: string; phone?: string } | null> {
    if (!Types.ObjectId.isValid(customerId)) return null;
    const user = await UserModel.findById(customerId)
      .select('name email phone')
      .lean()
      .exec();
    if (!user) return null;
    return { name: user.name, email: user.email, phone: user.phone ?? undefined };
  }

  /** The payment that actually received money for this booking (what a cancellation refunds from). */
  findPaidPayment(bookingId: string): Promise<IPayment | null> {
    if (!Types.ObjectId.isValid(bookingId)) return Promise.resolve(null);
    return PaymentModel.findOne({
      bookingId: new Types.ObjectId(bookingId),
      status: 'PAID',
    })
      .sort({ paidAt: -1, createdAt: -1 })
      .exec();
  }

  /**
   * Moves the booking to a cancelled status, atomically. The filter pins the status the decision was
   * made from, so two taps (or a partner moving the job on at the same moment) can never both win:
   * returns null when the booking is no longer in `fromStatus`. The seat is released for others.
   */
  markCancelled(
    bookingId: string,
    customerId: string,
    fromStatus: IBooking['status'],
    entry: StatusHistoryEntry,
    reason?: string,
    refundStatus?: string,
  ): Promise<IBooking | null> {
    if (![bookingId, customerId].every((v) => Types.ObjectId.isValid(v)))
      return Promise.resolve(null);
    return BookingModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(bookingId),
        customerId: new Types.ObjectId(customerId),
        status: fromStatus,
      },
      {
        $set: {
          status: entry.to,
          ...(reason ? { cancellationReason: reason } : {}),
          ...(refundStatus ? { refundStatus } : {}),
        },
        $unset: { slotSeat: '' },
        $push: { statusHistory: entry },
      },
      { new: true },
    ).exec();
  }

  /**
   * Files the refund for a cancelled booking: one Refund request (status "PENDING_APPROVAL", picked up by the
   * admin refund queue) and the matching marker on the Payment. Idempotent per booking, so a retry never
   * creates a second refund for the same cancellation.
   */
  async createRefundRequest(input: {
    payment?: IPayment | null;
    bookingId: string;
    customerId?: string;
    amount: number;
    reason?: string;
    now?: Date;
  }): Promise<IRefund> {
    const bookingId = new Types.ObjectId(input.bookingId);
    const existing = await RefundModel.findOne({
      bookingId,
      status: { $in: ['requested', 'PENDING_APPROVAL', 'approved', 'APPROVED', 'processed', 'CREDITED'] },
    }).exec();
    if (existing) return existing;

    const now = input.now ?? new Date();
    const paymentId = input.payment?._id;
    const customerId = input.customerId ? new Types.ObjectId(input.customerId) : undefined;
    const refund = await RefundModel.create({
      ...(paymentId ? { paymentId } : {}),
      bookingId,
      ...(customerId ? { customerId, requestedBy: customerId } : {}),
      amount: input.amount,
      reason: `Booking cancelled: ${input.reason ?? ''}`.slice(0, 500),
      method: 'WALLET',
      status: 'PENDING_APPROVAL',
      requestedAt: now,
    });

    if (paymentId) {
      await PaymentModel.updateOne(
        { _id: paymentId },
        {
          $set: {
            'refund.status': 'PENDING_APPROVAL',
            'refund.amount': input.amount,
            'refund.requestedAt': now,
          },
        },
      ).exec();
    }

    await BookingModel.updateOne(
      { _id: bookingId },
      {
        $set: {
          refundStatus: 'PENDING_APPROVAL',
          refundDetails: {
            refundId: refund._id,
            amount: input.amount,
            status: 'PENDING_APPROVAL',
            destination: 'HomeCareX Wallet',
            requestedAt: now,
          },
        },
      },
    ).exec();

    return refund;
  }

  /**
   * Moves a booking to a new date/slot/seat, atomically. The filter pins the status AND the old slot the
   * decision was made from; returns null when either changed in the meantime.
   */
  reschedule(
    bookingIdOrArgs:
      | string
      | {
          bookingId: string;
          customerId: string;
          to?: { date: string; slot: string; seat: number; scheduledAt?: Date };
          entry?: unknown;
          fromStatus?: string;
          fromDate?: string;
          fromSlot?: string;
        },
    customerId?: string,
    to?: { date: string; slot: string; seat: number; scheduledAt?: Date },
    historyEntry?: unknown
  ): Promise<IBooking | null> {
    const isObj = typeof bookingIdOrArgs === 'object' && bookingIdOrArgs !== null;
    const bId = isObj ? bookingIdOrArgs.bookingId : bookingIdOrArgs;
    const cId = isObj ? bookingIdOrArgs.customerId : customerId;
    const target = isObj ? bookingIdOrArgs.to : to;
    const entry = isObj ? bookingIdOrArgs.entry : historyEntry;

    if (!target || !bId || !cId || !Types.ObjectId.isValid(String(bId)) || !Types.ObjectId.isValid(String(cId)))
      return Promise.resolve(null);

    const filter: Record<string, unknown> = {
      _id: new Types.ObjectId(bId),
      customerId: new Types.ObjectId(cId),
    };
    if (isObj && bookingIdOrArgs.fromStatus) filter.status = bookingIdOrArgs.fromStatus;
    if (isObj && bookingIdOrArgs.fromDate) filter.date = bookingIdOrArgs.fromDate;
    if (isObj && bookingIdOrArgs.fromSlot) filter.slot = bookingIdOrArgs.fromSlot;

    const update: Record<string, unknown> = {
      $set: {
        date: target.date,
        slot: target.slot,
        slotSeat: target.seat,
        ...(target.scheduledAt ? { scheduledAt: target.scheduledAt } : {}),
      },
    };
    if (entry) update.$push = { statusHistory: entry };

    return BookingModel.findOneAndUpdate(filter, update, { new: true }).exec();
  }

  /** Return all bookings for a customer sorted by creation time with partner details populated */
  listForCustomer(customerId: string): Promise<IBooking[]> {
    if (!Types.ObjectId.isValid(customerId)) return Promise.resolve([]);

    return BookingModel.find({ customerId: new Types.ObjectId(customerId) })
      .populate(PARTNER_POPULATE)
      .sort({ createdAt: -1 })
      .exec();
  }

  /** One page of a customer's bookings, with the filters, sort and total the list screen needs. */
  async listPageForCustomer(
    customerId: string,
    query: ListBookingsQuery,
    now: Date = new Date()
  ): Promise<{ items: IBooking[]; total: number }> {
    if (!Types.ObjectId.isValid(customerId)) return { items: [], total: 0 };

    const filter = buildBookingFilter(customerId, query, now);
    const [items, total] = await Promise.all([
      BookingModel.find(filter)
        .populate(PARTNER_POPULATE)
        .sort(SORT_SPECS[query.sort])
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .exec(),
      BookingModel.countDocuments(filter).exec(),
    ]);
    return { items, total };
  }
}

export const bookingsRepository = new BookingsRepository();

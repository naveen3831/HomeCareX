import { Types } from 'mongoose';
import { BookingModel, type IBooking } from '../../models/Booking';
import UserModel from '../../models/User';
import { PaymentModel } from '../../models/Payment';
import { BOOKING_STATUS, SLOT_HOLDING_STATUSES } from './bookings.constants';
import { buildBookingFilter, SORT_SPECS, type ListBookingsQuery } from './bookings.query';

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
  releaseStaleHolds(serviceId?: string, date?: string, slot?: string, now: Date = new Date()): Promise<unknown> {
    const filter: Record<string, unknown> = {
      status: BOOKING_STATUS.PENDING_PAYMENT,
      holdExpiresAt: { $lte: now },
    };
    if (serviceId && Types.ObjectId.isValid(serviceId)) filter.serviceId = new Types.ObjectId(serviceId);
    if (date) filter.date = date;
    if (slot) filter.slot = slot;

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

  create(doc: Partial<IBooking>): Promise<IBooking> {
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

  async getOrCreateStartOtp(bookingId: string): Promise<string> {
    const booking = await BookingModel.findById(bookingId).select('otp').exec();
    if (booking && (booking as any).otp) return (booking as any).otp;
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    await BookingModel.updateOne({ _id: bookingId }, { $set: { otp } });
    return otp;
  }

  async decideExtraCharge(
    bookingId: string,
    customerId: string,
    chargeId: string,
    decision: string
  ): Promise<unknown> {
    return BookingModel.findOneAndUpdate(
      { _id: bookingId, customerId, 'extraCharges._id': chargeId },
      { $set: { 'extraCharges.$.status': decision, 'extraCharges.$.decidedAt': new Date() } },
      { new: true }
    ).exec();
  }

  async findCustomerContact(customerId: string): Promise<{ name?: string; email?: string; phone?: string } | null> {
    if (!Types.ObjectId.isValid(customerId)) return null;
    const user = await UserModel.findById(customerId).select('name email phone').lean().exec();
    return user ? { name: user.name, email: user.email, phone: user.phone ?? undefined } : null;
  }

  async findPaidPayment(bookingId: string): Promise<any> {
    if (!Types.ObjectId.isValid(bookingId)) return null;
    return PaymentModel.findOne({ bookingId: new Types.ObjectId(bookingId), status: 'PAID' }).lean().exec();
  }

  async markCancelled(
    bookingId: string,
    customerId: string,
    _fromStatus: string,
    historyEntry: unknown,
    reason?: string
  ): Promise<unknown> {
    return BookingModel.findOneAndUpdate(
      { _id: bookingId, customerId },
      {
        $set: { status: BOOKING_STATUS.CANCELLED_BY_CUSTOMER, cancellationReason: reason },
        $unset: { slotSeat: '' },
        $push: { statusHistory: historyEntry },
      },
      { new: true }
    ).exec();
  }

  async createRefundRequest(args: { amount: number; reason?: string; bookingId?: string; paymentId?: string }): Promise<unknown> {
    return { ...args, status: 'requested', createdAt: new Date() };
  }

  async reschedule(
    bookingIdOrArgs: any,
    customerId?: string,
    to?: { date: string; slot: string; seat: number },
    historyEntry?: unknown
  ): Promise<unknown> {
    const isObj = typeof bookingIdOrArgs === 'object' && bookingIdOrArgs !== null;
    const bId = isObj ? bookingIdOrArgs.bookingId : bookingIdOrArgs;
    const cId = isObj ? bookingIdOrArgs.customerId : customerId;
    const target = isObj ? bookingIdOrArgs.to : to;
    const entry = isObj ? bookingIdOrArgs.entry : historyEntry;

    return BookingModel.findOneAndUpdate(
      { _id: bId, customerId: cId },
      {
        $set: { date: target.date, slot: target.slot, slotSeat: target.seat },
        $push: { statusHistory: entry },
      },
      { new: true }
    ).exec();
  }
}

export const bookingsRepository = new BookingsRepository();

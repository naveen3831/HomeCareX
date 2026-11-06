import { Types } from 'mongoose';
import { UserModel } from '../../models/User';
import { AddressModel } from '../../models/Address';
import { NotificationModel } from '../../models/Notification';
import { BookingModel } from '../../models/Booking';
import { WalletLedgerModel, WalletModel } from '../../models/Wallet';
import { OPEN_BOOKING_STATUSES } from './customer-profile.constants';
import { buildBookingFilter } from '../bookings/bookings.query';
import type { ProfileDoc } from './customer-profile.types';

/** Thin Mongo layer so the service can be tested against an in-memory fake. */
export const customerProfileRepository = {
  /** Includes the avatar, which is `select: false` on the schema. */
  findById: (id: string) => UserModel.findById(id).select('+avatar').lean() as unknown as Promise<ProfileDoc | null>,
  findByEmail: (email: string) => UserModel.findOne({ email: email.toLowerCase() }).select('_id').lean() as unknown as Promise<{ _id: unknown } | null>,
  findByPhone: (phone: string) =>
    UserModel.findOne({
      $or: [{ phone }, { phone: `+91${phone}` }, { phone: `91${phone}` }],
    }).select('_id').lean() as unknown as Promise<{ _id: unknown } | null>,
  update: (id: string, upd: { $set?: Record<string, unknown>; $unset?: Record<string, ''> }) =>
    UserModel.findByIdAndUpdate(id, upd, { new: true, runValidators: true }).select('+avatar').lean() as unknown as Promise<ProfileDoc | null>,
  /** Bookings of this customer that are not finished or cancelled yet. */
  countOpenBookings: (id: string) =>
    BookingModel.countDocuments(buildBookingFilter(id, { status: ['upcoming', 'live'] })),
  /** Wallet balance in paise (0 when the customer never had a wallet). */
  walletBalance: async (id: string): Promise<number> => (await WalletModel.findOne({ userId: id }).select('balance').lean())?.balance ?? 0,
  /**
   * Removes the user and what only they use: saved addresses, notifications and the wallet with its ledger.
   * Bookings, payments, refunds, reviews and tickets stay (partners, accounting and audits depend on them).
   */
  deleteAccount: async (id: string): Promise<boolean> => {
    const oid = new Types.ObjectId(id);
    await Promise.all([
      AddressModel.deleteMany({ customerId: oid }),
      NotificationModel.deleteMany({ userId: oid }),
      WalletLedgerModel.deleteMany({ userId: id }),
      WalletModel.deleteMany({ userId: id }),
    ]);
    return Boolean(await UserModel.findOneAndDelete({ _id: oid, role: 'customer' }));
  },
};
export type CustomerProfileRepository = typeof customerProfileRepository;

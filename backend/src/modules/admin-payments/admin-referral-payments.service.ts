import { ReferralModel } from '../referrals/referrals.model';
import { ReferralProgramModel } from '../referrals/referral-programs.model';
import { UserModel } from '../../models/User';
import { bookingRefOf } from './admin-payments.service';

export type ReferralAudienceFilter = 'CUSTOMER' | 'PARTNER';

export interface ReferralMoneyQuery {
  page: number;
  limit: number;
  type?: ReferralAudienceFilter;
}

type PersonDto = { id: string; name: string; email?: string; phone?: string; role: string } | null;

/** One wallet credit created by a referral (a referral pays two: the referrer and the new friend). */
export interface ReferralCreditDto {
  id: string;
  referralId: string;
  audience: ReferralAudienceFilter;
  /** referrer = the person who shared the code, friend = the person who joined with it. */
  side: 'referrer' | 'friend';
  user: PersonDto;
  amount: number;
  /** Which wallet received it. */
  wallet: 'customer_wallet' | 'partner_wallet';
  creditedAt: string | null;
}

/** Referral discount that reduced a booking's payable amount. */
export interface ReferralDiscountDto {
  id: string;
  bookingId: string;
  bookingRef: string;
  customer: PersonDto;
  program: string | null;
  amount: number;
  usedAt: string;
}

const audienceMatch = (type?: ReferralAudienceFilter): Record<string, unknown> =>
  type === 'PARTNER' ? { audience: 'PARTNER' } : type === 'CUSTOMER' ? { audience: { $ne: 'PARTNER' } } : {};

export const adminReferralPaymentsService = {
  /** Who got referral money in their wallet, and how much referral discount was used on bookings. Read-only. */
  async overview(q: ReferralMoneyQuery) {
    // A referral shows up once any money was paid: friend bonus at signup, referrer reward at first booking/job.
    const rewarded: Record<string, unknown> = {
      $or: [{ status: 'rewarded' }, { refereeCreditedAt: { $ne: null } }],
      ...audienceMatch(q.type),
    };
    const discounted: Record<string, unknown> | null =
      q.type === 'PARTNER' ? null : { discountAmount: { $gt: 0 }, audience: { $ne: 'PARTNER' } };

    const [rows, total, creditAgg, discountRows, discountAgg] = await Promise.all([
      ReferralModel.find(rewarded as never)
        .sort({ updatedAt: -1, _id: -1 })
        .skip((q.page - 1) * q.limit)
        .limit(q.limit)
        .lean(),
      ReferralModel.countDocuments(rewarded as never),
      ReferralModel.aggregate<{ _id: string; count: number; referrerPaise: number; friendPaise: number }>([
        { $match: rewarded },
        {
          $group: {
            _id: { $ifNull: ['$audience', 'CUSTOMER'] },
            count: { $sum: 1 },
            referrerPaise: { $sum: '$rewardPaise' },
            friendPaise: { $sum: '$refereeRewardPaise' },
          },
        },
      ]),
      discounted
        ? ReferralModel.find(discounted as never).sort({ updatedAt: -1, _id: -1 }).limit(50).lean()
        : Promise.resolve([]),
      discounted
        ? ReferralModel.aggregate<{ _id: null; count: number; amount: number }>([
            { $match: discounted },
            { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: '$discountAmount' } } },
          ])
        : Promise.resolve([]),
    ]);

    const userIds = new Set<string>();
    for (const r of rows) {
      userIds.add(String(r.referrerId));
      userIds.add(String(r.refereeId));
    }
    for (const r of discountRows) userIds.add(String(r.refereeId));
    const programIds = discountRows.map((r) => r.discountProgramId).filter(Boolean);

    const [users, programs] = await Promise.all([
      userIds.size
        ? UserModel.find({ _id: { $in: [...userIds] } })
            .select('name email phone role')
            .lean<{ _id: unknown; name?: string; email?: string; phone?: string; role?: string }[]>()
        : [],
      programIds.length
        ? ReferralProgramModel.find({ _id: { $in: programIds } }).select('name').lean<{ _id: unknown; name: string }[]>()
        : [],
    ]);
    const userMap = new Map(users.map((u) => [String(u._id), u]));
    const programName = new Map(programs.map((p) => [String(p._id), p.name]));
    const person = (id: unknown): PersonDto => {
      const u = userMap.get(String(id));
      return u ? { id: String(u._id), name: u.name ?? 'Unknown', email: u.email, phone: u.phone, role: u.role ?? '' } : null;
    };

    const credits: ReferralCreditDto[] = [];
    for (const r of rows) {
      const audience: ReferralAudienceFilter = r.audience === 'PARTNER' ? 'PARTNER' : 'CUSTOMER';
      const wallet = audience === 'PARTNER' ? 'partner_wallet' : 'customer_wallet';
      const rewardedAt = r.rewardedAt ? r.rewardedAt.toISOString() : null;
      const friendAt = r.refereeCreditedAt ? r.refereeCreditedAt.toISOString() : rewardedAt;
      if ((r.status === 'rewarded' || r.referrerCreditedAt) && (r.rewardPaise ?? 0) > 0)
        credits.push({ id: `${r._id}:referrer`, referralId: String(r._id), audience, side: 'referrer', user: person(r.referrerId), amount: r.rewardPaise / 100, wallet, creditedAt: r.referrerCreditedAt ? r.referrerCreditedAt.toISOString() : rewardedAt });
      if ((r.refereeRewardPaise ?? 0) > 0)
        credits.push({ id: `${r._id}:friend`, referralId: String(r._id), audience, side: 'friend', user: person(r.refereeId), amount: r.refereeRewardPaise / 100, wallet, creditedAt: friendAt });
    }

    const discounts: ReferralDiscountDto[] = discountRows.map((r) => ({
      id: String(r._id),
      bookingId: String(r.discountBookingId ?? ''),
      bookingRef: r.discountBookingId ? bookingRefOf(r.discountBookingId) : '—',
      customer: person(r.refereeId),
      program: r.discountProgramId ? programName.get(String(r.discountProgramId)) ?? null : null,
      amount: r.discountAmount ?? 0,
      usedAt: r.updatedAt.toISOString(),
    }));

    const bucket = (audience: ReferralAudienceFilter) => {
      const a = creditAgg.find((x) => x._id === audience);
      return {
        referrals: a?.count ?? 0,
        referrerCredited: (a?.referrerPaise ?? 0) / 100,
        friendCredited: (a?.friendPaise ?? 0) / 100,
      };
    };
    const customer = bucket('CUSTOMER');
    const partner = bucket('PARTNER');

    return {
      totals: {
        customer,
        partner,
        totalCredited:
          customer.referrerCredited + customer.friendCredited + partner.referrerCredited + partner.friendCredited,
        discountUsed: { count: discountAgg[0]?.count ?? 0, amount: discountAgg[0]?.amount ?? 0 },
      },
      credits,
      discounts,
      meta: { page: q.page, limit: q.limit, total, pages: Math.max(1, Math.ceil(total / q.limit)) },
    };
  },
};

import { randomBytes } from "node:crypto";
import mongoose, { Types } from "mongoose";
import { ReferralCodeModel, ReferralModel } from "./referrals.model";
import { UserModel } from "../../models/User";
import BookingModel from "../../models/Booking";
import { WalletLedgerModel, WalletModel } from "../../models/Wallet";
import { HttpError } from "../auth/auth.types";

const duplicate = (error: unknown) =>
  (error as { code?: number } | null)?.code === 11000;
export function assertNotSelfReferral(referrerId: string, refereeId: string) {
  if (referrerId === refereeId)
    throw new HttpError(400, "You cannot refer yourself.", "SELF_REFERRAL");
}
export function configuredRewardPaise(): number {
  const amount = Number(process.env.REFERRAL_REWARD_PAISE ?? 0);
  if (!Number.isSafeInteger(amount) || amount < 0 || amount > 10_000_000)
    throw new Error(
      "REFERRAL_REWARD_PAISE must be a non-negative integer in paise.",
    );
  return amount;
}
const CODE_PREFIX = "HCX";
const MAX_NAME_LETTERS = 8;
/** "HCX" + the first name in capitals: letters only, accents stripped, at most 8 letters. */
export function referralCodeBase(name?: string | null): string {
  const first = (name ?? "").trim().split(/\s+/)[0] ?? "";
  const letters = first
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z]/g, "")
    .toUpperCase()
    .slice(0, MAX_NAME_LETTERS);
  return `${CODE_PREFIX}${letters}`;
}
/**
 * Attempt 0 = plain code, 1-4 = ...2 to ...5, later = random hex suffix.
 * A name with no letters falls back to a fully random code.
 */
export function referralCodeCandidate(
  name: string | null | undefined,
  attempt: number,
): string {
  const base = referralCodeBase(name);
  if (base === CODE_PREFIX)
    return `${CODE_PREFIX}${randomBytes(3).toString("hex").toUpperCase()}`;
  if (attempt === 0) return base;
  if (attempt <= 4) return `${base}${attempt + 1}`;
  return `${base}${randomBytes(2).toString("hex").toUpperCase()}`;
}
export const referralsService = {
  /** One code per customer: HCX + first name (e.g. HCXCHARAN); numbered/random suffix only on a clash. */
  async code(userId: string): Promise<string> {
    const existing = await ReferralCodeModel.findOne({ referrerId: userId });
    if (existing) return existing.code;
    const user = await UserModel.findById(userId)
      .select("name")
      .lean<{ name?: string | null }>();
    for (let attempt = 0; attempt < 10; attempt++) {
      try {
        const row = await ReferralCodeModel.create({
          referrerId: userId,
          code: referralCodeCandidate(user?.name, attempt),
        });
        return row.code;
      } catch (error) {
        if (!duplicate(error)) throw error;
        // Either another request created this user's code, or the wanted code belongs to someone else.
        const concurrent = await ReferralCodeModel.findOne({
          referrerId: userId,
        });
        if (concurrent) return concurrent.code;
      }
    }
    throw new HttpError(
      503,
      "Could not generate your referral code. Please retry.",
      "REFERRAL_UNAVAILABLE",
    );
  },
  async resolve(code: string): Promise<string> {
    const match = await ReferralCodeModel.findOne({
      code: code.trim().toUpperCase(),
    });
    if (
      !match ||
      !(await UserModel.exists({
        _id: match.referrerId,
        role: "customer",
        status: "active",
      }))
    ) {
      throw new HttpError(
        400,
        "This referral code is not valid.",
        "INVALID_REFERRAL",
      );
    }
    return String(match.referrerId);
  },
  async attach(refereeId: string, code: string, referrerId: string) {
    assertNotSelfReferral(referrerId, refereeId);
    try {
      await ReferralModel.create({
        refereeId,
        referrerId,
        code: code.trim().toUpperCase(),
      });
    } catch (error) {
      if (!duplicate(error)) throw error;
      const previous = await ReferralModel.findOne({ refereeId });
      if (!previous || String(previous.referrerId) !== referrerId)
        throw new HttpError(
          409,
          "A referral is already linked to this account.",
          "DUPLICATE_REFERRAL",
        );
    }
  },
  async summary(userId: string, page: number) {
    const code = await referralsService.code(userId);
    const filter = { referrerId: new Types.ObjectId(userId) };
    const [totals, entries, total] = await Promise.all([
      ReferralModel.aggregate<{
        invited: number;
        completed: number;
        rewardPaise: number;
      }>([
        { $match: filter },
        {
          $group: {
            _id: null,
            invited: { $sum: 1 },
            completed: {
              $sum: {
                $cond: [{ $in: ["$status", ["completed", "rewarded"]] }, 1, 0],
              },
            },
            rewardPaise: {
              $sum: {
                $cond: [{ $eq: ["$status", "rewarded"] }, "$rewardPaise", 0],
              },
            },
          },
        },
      ]),
      ReferralModel.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * 10)
        .limit(10)
        .lean(),
      ReferralModel.countDocuments(filter),
    ]);
    return {
      code,
      rewardPerReferralPaise: configuredRewardPaise(),
      stats: totals[0]
        ? {
            invited: totals[0].invited,
            completed: totals[0].completed,
            rewardsPaise: totals[0].rewardPaise,
          }
        : { invited: 0, completed: 0, rewardsPaise: 0 },
      entries: entries.map((row) => ({
        id: String(row._id),
        status: row.status,
        rewardPaise: row.rewardPaise,
        createdAt: row.createdAt.toISOString(),
        rewardedAt: row.rewardedAt?.toISOString() ?? null,
      })),
      meta: { page, pages: Math.max(1, Math.ceil(total / 10)), total },
    };
  },
  /** Database transaction + unique wallet reference: retries and concurrent bookings cannot double-credit. */
  async rewardForReferee(refereeId: string) {
    const referral = await ReferralModel.findOne({
      refereeId,
      status: { $ne: "rewarded" },
    });
    if (!referral) return;
    assertNotSelfReferral(String(referral.referrerId), refereeId);
    // A friend's first PAID booking qualifies (payment captured and the booking not cancelled/refunded),
    // so the reward no longer waits for a partner to mark the job completed.
    const first = await BookingModel.findOne({
      customerId: refereeId,
      paymentStatus: "PAID",
      status: {
        $nin: [
          "pending_payment",
          "cancelled_by_customer",
          "cancelled_by_partner",
          "cancelled_by_admin",
          "no_show",
        ],
      },
    })
      .sort({ "paymentDetails.paidAt": 1, createdAt: 1, _id: 1 })
      .select("_id");
    if (!first) return;
    await ReferralModel.updateOne(
      { _id: referral._id, status: "invited" },
      { $set: { status: "completed", firstBookingId: first._id } },
    );
    const rewardPaise = configuredRewardPaise();
    // Monetary policy is configured by HomeCareX; do not invent a default reward.
    if (!rewardPaise) return;
    await mongoose.connection.transaction(async (session) => {
      const claimed = await ReferralModel.findOneAndUpdate(
        { _id: referral._id, status: "completed" },
        {
          $set: {
            status: "rewarded",
            firstBookingId: first._id,
            rewardPaise,
            rewardedAt: new Date(),
          },
        },
        { new: true, session },
      );
      if (!claimed) return;
      const wallet = await WalletModel.findOneAndUpdate(
        { userId: String(claimed.referrerId) },
        { $inc: { balance: rewardPaise / 100 } },
        { new: true, upsert: true, session, setDefaultsOnInsert: true },
      );
      await WalletLedgerModel.create(
        [
          {
            walletId: wallet._id,
            userId: String(claimed.referrerId),
            type: "referral_reward",
            amount: rewardPaise / 100,
            balanceAfter: wallet.balance,
            description: "Referral reward: first completed booking",
            referenceId: `referral:${claimed._id}`,
          },
        ],
        { session },
      );
    });
  },
  async reconcile() {
    let after: Types.ObjectId | undefined;
    while (true) {
      const batch = await ReferralModel.find({
        status: { $ne: "rewarded" },
        ...(after ? { _id: { $gt: after } } : {}),
      })
        .sort({ _id: 1 })
        .limit(50)
        .select("_id refereeId");
      if (!batch.length) break;
      for (const row of batch)
        await referralsService.rewardForReferee(String(row.refereeId));
      after = batch[batch.length - 1]._id;
    }
  },
};

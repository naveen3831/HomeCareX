import { randomBytes } from "node:crypto";
import mongoose, { Types } from "mongoose";
import { ReferralCodeModel, ReferralModel, ReferralOfferCodeModel } from "./referrals.model";
import { UserModel } from "../../models/User";
import BookingModel from "../../models/Booking";
import { WalletLedgerModel, WalletModel } from "../../models/Wallet";
import { HttpError } from "../auth/auth.types";
import { referralProgramsService, programDiscount, type ProgramLike } from "./referral-programs.service";
import { ReferralProgramModel } from "./referral-programs.model";
import { CategoryModel } from "../../models/Category";
import { ServiceModel } from "../../models/Service";

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
/** Per-offer code: the customer's HCX code + the offer name, e.g. HCXVAISHNAV-WELCOME (suffix only on a clash). */
export function offerCodeCandidate(
  name: string | null | undefined,
  programName: string | null | undefined,
  attempt: number,
): string {
  let base = referralCodeBase(name);
  if (base === CODE_PREFIX) base = `${CODE_PREFIX}${randomBytes(3).toString("hex").toUpperCase()}`;
  const suffix =
    (programName ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8) || "OFFER";
  const plain = `${base}-${suffix}`;
  if (attempt === 0) return plain;
  if (attempt <= 4) return `${plain}${attempt + 1}`;
  return `${plain}${randomBytes(2).toString("hex").toUpperCase()}`;
}

/** The customer's own code for one offer; created on first use and then stable (renaming the offer keeps it). */
async function offerCodeFor(userId: string, userName: string | null | undefined, programId: string, programName: string) {
  const existing = await ReferralOfferCodeModel.findOne({ referrerId: userId, programId });
  if (existing) return existing.code;
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      const row = await ReferralOfferCodeModel.create({
        referrerId: userId,
        programId,
        code: offerCodeCandidate(userName, programName, attempt),
      });
      return row.code;
    } catch (error) {
      if (!duplicate(error)) throw error;
      const concurrent = await ReferralOfferCodeModel.findOne({ referrerId: userId, programId });
      if (concurrent) return concurrent.code;
    }
  }
  throw new HttpError(503, "Could not generate your referral code. Please retry.", "REFERRAL_UNAVAILABLE");
}

/**
 * Active, in-date referral offers (admin "Welcome friend" style programs) for the Referrals page,
 * each with THIS customer's own code for that offer.
 */
async function activeOffers(userId: string) {
  const now = new Date();
  const rows = await ReferralProgramModel.find({
    active: true,
    $and: [
      { $or: [{ startAt: null }, { startAt: { $lte: now } }] },
      { $or: [{ endAt: null }, { endAt: { $gte: now } }] },
    ],
  })
    .sort({ createdAt: -1 })
    .lean();
  if (!rows.length) return [];
  const categoryIds = rows.flatMap((r) => (r.categoryIds ?? []).map(String));
  const serviceIds = rows.flatMap((r) => (r.serviceIds ?? []).map(String));
  const [cats, svcs, user] = await Promise.all([
    categoryIds.length
      ? CategoryModel.find({ _id: { $in: categoryIds } }).select("name").lean<{ _id: Types.ObjectId; name: string }[]>()
      : [],
    serviceIds.length
      ? ServiceModel.find({ _id: { $in: serviceIds } }).select("name").lean<{ _id: Types.ObjectId; name: string }[]>()
      : [],
    UserModel.findById(userId).select("name").lean<{ name?: string | null }>(),
  ]);
  const catName = new Map(cats.map((c) => [String(c._id), c.name]));
  const svcName = new Map(svcs.map((c) => [String(c._id), c.name]));
  const out = [];
  for (const r of rows) {
    out.push({
      id: String(r._id),
      name: r.name,
      code: await offerCodeFor(userId, user?.name, String(r._id), r.name),
      scope: r.scope,
      appliesTo:
        r.scope === "ALL"
          ? []
          : (r.scope === "CATEGORY" ? r.categoryIds ?? [] : r.serviceIds ?? [])
              .map((id) => (r.scope === "CATEGORY" ? catName : svcName).get(String(id)))
              .filter((n): n is string => Boolean(n)),
      discountType: r.discountType,
      value: r.value,
      maxDiscount: r.maxDiscount ?? null,
      minOrder: r.minOrder ?? 0,
      endAt: r.endAt ? r.endAt.toISOString() : null,
    });
  }
  return out;
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
    const trimmed = code.trim().toUpperCase();
    const withHyphen = trimmed.replace(/\s+/g, "-");
    const match = await ReferralCodeModel.findOne({
      code: { $in: [trimmed, withHyphen, trimmed.replace(/[\s-]+/g, "")] },
    });
    if (match) {
      const active = await UserModel.exists({
        _id: match.referrerId,
        role: "customer",
        status: "active",
      });
      if (!active) {
        throw new HttpError(
          400,
          "This referral code is not valid.",
          "INVALID_REFERRAL",
        );
      }
      return String(match.referrerId);
    }

    const offer = await ReferralOfferCodeModel.findOne({
      code: { $in: [trimmed, withHyphen] },
    });
    if (offer) {
      const active = await UserModel.exists({
        _id: offer.referrerId,
        role: "customer",
        status: "active",
      });
      if (!active) {
        throw new HttpError(
          400,
          "This referral code is not valid.",
          "INVALID_REFERRAL",
        );
      }
      return String(offer.referrerId);
    }

    // Check if code matches <baseCode>-<suffix> for an active program
    const separatorMatch = withHyphen.match(/^([A-Z0-9]+)-([A-Z0-9]+)$/);
    if (separatorMatch) {
      const [, basePart, suffixPart] = separatorMatch;
      const baseMatch = await ReferralCodeModel.findOne({ code: basePart });
      if (baseMatch) {
        const active = await UserModel.exists({
          _id: baseMatch.referrerId,
          role: "customer",
          status: "active",
        });
        if (active) {
          const now = new Date();
          const programs = await ReferralProgramModel.find({
            active: true,
            $and: [
              { $or: [{ startAt: null }, { startAt: { $lte: now } }] },
              { $or: [{ endAt: null }, { endAt: { $gte: now } }] },
            ],
          }).lean();
          const matchingProgram = programs.find((p) => {
            const s =
              (p.name ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8) || "OFFER";
            return s === suffixPart;
          });
          if (matchingProgram) {
            return String(baseMatch.referrerId);
          }
        }
      }
    }

    throw new HttpError(
      400,
      "This referral code is not valid.",
      "INVALID_REFERRAL",
    );
  },
  /** Offers (with this customer's own code per offer) shown on the Referrals page. */
  offers(userId: string) {
    return activeOffers(userId);
  },
  /**
   * Who a sign-up code belongs to and which offer it carries. An offer code (HCXNAME-WELCOME) is tied to
   * that offer; a plain customer code has programId null (the best offer then applies at booking time).
   */
  async resolveInvite(code: string): Promise<{ referrerId: string; programId: string | null }> {
    const trimmed = code.trim().toUpperCase();
    const withHyphen = trimmed.replace(/\s+/g, "-");
    let offer = await ReferralOfferCodeModel.findOne({
      code: { $in: [trimmed, withHyphen] },
    });

    if (!offer) {
      // Check if it's an on-the-fly offer code: <baseCode>-<suffix>
      const separatorMatch = withHyphen.match(/^([A-Z0-9]+)-([A-Z0-9]+)$/);
      if (separatorMatch) {
        const [, basePart, suffixPart] = separatorMatch;
        const baseMatch = await ReferralCodeModel.findOne({ code: basePart });
        if (baseMatch) {
          const referrerOk = await UserModel.exists({
            _id: baseMatch.referrerId,
            role: "customer",
            status: "active",
          });
          if (!referrerOk) {
            throw new HttpError(400, "This referral code is not valid.", "INVALID_REFERRAL");
          }
          const now = new Date();
          const programs = await ReferralProgramModel.find({
            active: true,
            $and: [
              { $or: [{ startAt: null }, { startAt: { $lte: now } }] },
              { $or: [{ endAt: null }, { endAt: { $gte: now } }] },
            ],
          }).lean();
          const matchingProgram = programs.find((p) => {
            const s =
              (p.name ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8) || "OFFER";
            return s === suffixPart;
          });
          if (matchingProgram) {
            try {
              offer = await ReferralOfferCodeModel.create({
                referrerId: baseMatch.referrerId,
                programId: matchingProgram._id,
                code: withHyphen,
              });
            } catch {
              offer = await ReferralOfferCodeModel.findOne({ code: withHyphen });
            }
          }
        }
      }
    }

    if (!offer) return { referrerId: await referralsService.resolve(code), programId: null };
    const [referrerOk, program] = await Promise.all([
      UserModel.exists({ _id: offer.referrerId, role: "customer", status: "active" }),
      ReferralProgramModel.findById(offer.programId).lean<{
        active?: boolean;
        startAt?: Date | null;
        endAt?: Date | null;
      }>(),
    ]);
    if (!referrerOk) throw new HttpError(400, "This referral code is not valid.", "INVALID_REFERRAL");
    const now = new Date();
    if (
      !program ||
      !program.active ||
      (program.endAt && program.endAt < now) ||
      (program.startAt && program.startAt > now)
    )
      throw new HttpError(400, "This referral offer is no longer available.", "REFERRAL_OFFER_ENDED");
    return { referrerId: String(offer.referrerId), programId: String(offer.programId) };
  },
  async attach(refereeId: string, code: string, referrerId: string, programId?: string | null) {
    assertNotSelfReferral(referrerId, refereeId);
    try {
      await ReferralModel.create({
        refereeId,
        referrerId,
        code: code.trim().toUpperCase(),
        ...(programId ? { programId } : {}),
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
    try {
      await referralsService.syncRefereeReward(userId);
    } catch {
      // Non-fatal
    }

    const code = await referralsService.code(userId);
    const filter = { referrerId: new Types.ObjectId(userId) };
    const [totals, entries, total, offers, referredByDoc] = await Promise.all([
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
        .populate("refereeId", "name email phone avatar")
        .lean(),
      ReferralModel.countDocuments(filter),
      referralsService.offers(userId),
      ReferralModel.findOne({ refereeId: userId })
        .populate("referrerId", "name avatar")
        .lean(),
    ]);

    const rewardPerReferralPaise = configuredRewardPaise();

    const referrerUser =
      referredByDoc?.referrerId &&
      typeof referredByDoc.referrerId === "object" &&
      !(referredByDoc.referrerId instanceof Types.ObjectId)
        ? (referredByDoc.referrerId as any)
        : null;

    const referredBy = referredByDoc
      ? {
          code: referredByDoc.code,
          referrerName: referrerUser?.name || "a friend",
          referrerAvatar: referrerUser?.avatar || null,
          status: referredByDoc.status,
          rewardPaise: referredByDoc.rewardPaise || rewardPerReferralPaise,
          rewardedAt: referredByDoc.rewardedAt?.toISOString() ?? null,
        }
      : null;

    const referrerRewardsPaise = totals[0]?.rewardPaise ?? 0;
    const refereeWelcomeRewardPaise =
      referredByDoc && referredByDoc.status === "rewarded"
        ? (referredByDoc.rewardPaise || rewardPerReferralPaise || 5000)
        : 0;
    const totalRewardsPaise = referrerRewardsPaise + refereeWelcomeRewardPaise;

    return {
      code,
      rewardPerReferralPaise,
      referredBy,
      stats: {
        invited: totals[0]?.invited ?? 0,
        completed: totals[0]?.completed ?? 0,
        rewardsPaise: totalRewardsPaise,
      },
      entries: entries.map((row: any) => {
        const referee =
          row.refereeId && typeof row.refereeId === "object" && !(row.refereeId instanceof Types.ObjectId)
            ? row.refereeId
            : null;
        return {
          id: String(row._id),
          status: row.status,
          rewardPaise: row.rewardPaise,
          createdAt: row.createdAt.toISOString(),
          rewardedAt: row.rewardedAt?.toISOString() ?? null,
          referee: referee
            ? {
                id: String(referee._id || ""),
                name: referee.name || "Friend",
                email: referee.email || null,
                phone: referee.phone || null,
                avatar: referee.avatar || null,
              }
            : null,
          friendName: referee?.name || null,
          friendEmail: referee?.email || null,
          friendPhone: referee?.phone || null,
          friendAvatar: referee?.avatar || null,
        };
      }),
      meta: { page, pages: Math.max(1, Math.ceil(total / 10)), total },
      offers,
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
      // 1. Credit Referrer Wallet
      const referrerWallet = await WalletModel.findOneAndUpdate(
        { userId: String(claimed.referrerId) },
        { $inc: { balance: rewardPaise / 100 } },
        { new: true, upsert: true, session, setDefaultsOnInsert: true },
      );
      await WalletLedgerModel.create(
        [
          {
            walletId: referrerWallet._id,
            userId: String(claimed.referrerId),
            type: "referral_reward",
            amount: rewardPaise / 100,
            balanceAfter: referrerWallet.balance,
            description: "Referral reward: friend's first completed booking",
            referenceId: `referral:${claimed._id}:referrer`,
          },
        ],
        { session },
      );

      // 2. Credit Referee (New Customer) Wallet
      const refereeIdToCredit = claimed.refereeId ? String(claimed.refereeId) : refereeId;
      if (refereeIdToCredit) {
        const refereeWallet = await WalletModel.findOneAndUpdate(
          { userId: refereeIdToCredit },
          { $inc: { balance: rewardPaise / 100 } },
          { new: true, upsert: true, session, setDefaultsOnInsert: true },
        );
        await WalletLedgerModel.create(
          [
            {
              walletId: refereeWallet._id,
              userId: refereeIdToCredit,
              type: "referral_reward",
              amount: rewardPaise / 100,
              balanceAfter: refereeWallet.balance,
              description: "Referral welcome bonus: first completed booking",
              referenceId: `referral:${claimed._id}:referee`,
            },
          ],
          { session },
        );
      }
    });
  },
  /**
   * Discount on a referred customer's first booking where the referral offer applies.
   * null when the customer was not referred, already used their referral discount on an active booking,
   * or no active referral program covers this service.
   * Abandoned (pending_payment) and cancelled bookings do not count, so the offer is not lost.
   */
  async refereeDiscount(userId: string, serviceId: string, orderValue: number) {
    if (!Types.ObjectId.isValid(userId)) return null;
    const referral = await ReferralModel.findOne({ refereeId: userId }).select("_id discountBookingId programId").lean();
    if (!referral) return null;

    // If the referral discount was already applied to an active or completed booking, it cannot be reused.
    if (referral.discountBookingId) {
      const activeDiscountBooking = await BookingModel.exists({
        _id: referral.discountBookingId,
        status: {
          $nin: [
            "pending_payment",
            "cancelled_by_customer",
            "cancelled_by_partner",
            "cancelled_by_admin",
            "no_show",
          ],
        },
      });
      if (activeDiscountBooking) return null;
    }

    const hadBookingWithDiscount = await BookingModel.exists({
      customerId: userId,
      $or: [
        { "priceSnapshot.referralDiscount": { $gt: 0 } },
        { "pricing.referralDiscount": { $gt: 0 } },
      ],
      status: {
        $nin: [
          "pending_payment",
          "cancelled_by_customer",
          "cancelled_by_partner",
          "cancelled_by_admin",
          "no_show",
        ],
      },
    });
    if (hadBookingWithDiscount) return null;

    // Signed up with a specific offer's code: only that offer can apply. Generic code: best offer wins.
    if (referral.programId)
      return referralProgramsService.forProgram(String(referral.programId), serviceId, orderValue);
    return referralProgramsService.bestFor(serviceId, orderValue);
  },
  /** Called after the booking is created: remembers which program gave the discount. */
  async recordRefereeDiscount(
    userId: string,
    bookingId: string,
    programId: string,
    amount: number,
  ) {
    await ReferralModel.updateOne(
      { refereeId: userId },
      { $set: { discountBookingId: bookingId, discountProgramId: programId, discountAmount: amount } },
    );
    await ReferralProgramModel.updateOne({ _id: programId }, { $inc: { usedCount: 1 } });
  },
  async reconcile() {
    try {
      const unattached = await UserModel.find({
        role: "customer",
        referralCode: { $exists: true, $nin: [null, ""] },
      })
        .select("_id referralCode")
        .lean();

      for (const u of unattached) {
        if (!u.referralCode) continue;
        const exists = await ReferralModel.exists({ refereeId: u._id });
        if (!exists) {
          try {
            const invite = await referralsService.resolveInvite(u.referralCode);
            await referralsService.attach(String(u._id), u.referralCode, invite.referrerId, invite.programId);
          } catch {
            // Ignore invalid/self referrals
          }
        }
      }
    } catch (backfillErr) {
      console.warn("[referrals] Auto-backfill in reconcile caught:", backfillErr);
    }

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

    // Also reconcile rewarded referrals where either referee or referrer wallet ledger is missing
    try {
      const rewardedBatch = await ReferralModel.find({ status: "rewarded" }).lean();
      for (const ref of rewardedBatch) {
        const rewardPaise = ref.rewardPaise || configuredRewardPaise() || 5000;
        const amountRupees = rewardPaise / 100;

        // 1. Backfill Referee wallet credit if missing
        if (ref.refereeId) {
          const refereeUserId = String(ref.refereeId);
          const refereeLedgerExists = await WalletLedgerModel.exists({
            $or: [
              { referenceId: `referral:${ref._id}:referee` },
              { referenceId: `referral:${ref._id}`, userId: refereeUserId },
            ],
          });

          if (!refereeLedgerExists) {
            const refereeWallet = await WalletModel.findOneAndUpdate(
              { userId: refereeUserId },
              { $inc: { balance: amountRupees } },
              { new: true, upsert: true, setDefaultsOnInsert: true },
            );
            await WalletLedgerModel.create({
              walletId: refereeWallet._id,
              userId: refereeUserId,
              type: "referral_reward",
              amount: amountRupees,
              balanceAfter: refereeWallet.balance,
              description: "Referral welcome bonus: first completed booking",
              referenceId: `referral:${ref._id}:referee`,
            });
          }
        }

        // 2. Backfill Referrer wallet credit if missing
        if (ref.referrerId) {
          const referrerUserId = String(ref.referrerId);
          const referrerLedgerExists = await WalletLedgerModel.exists({
            $or: [
              { referenceId: `referral:${ref._id}:referrer` },
              { referenceId: `referral:${ref._id}`, userId: referrerUserId },
            ],
          });

          if (!referrerLedgerExists) {
            const referrerWallet = await WalletModel.findOneAndUpdate(
              { userId: referrerUserId },
              { $inc: { balance: amountRupees } },
              { new: true, upsert: true, setDefaultsOnInsert: true },
            );
            await WalletLedgerModel.create({
              walletId: referrerWallet._id,
              userId: referrerUserId,
              type: "referral_reward",
              amount: amountRupees,
              balanceAfter: referrerWallet.balance,
              description: "Referral reward: friend's first completed booking",
              referenceId: `referral:${ref._id}:referrer`,
            });
          }
        }
      }
    } catch (rewardedReconcileErr) {
      console.warn("[referrals] Rewarded reconcile caught:", rewardedReconcileErr);
    }
  },
  async syncRefereeReward(refereeId: string) {
    try {
      await referralsService.rewardForReferee(refereeId);
    } catch {
      // Non-fatal
    }

    try {
      const rewardedReferral = await ReferralModel.findOne({
        refereeId: new Types.ObjectId(refereeId),
        status: "rewarded",
      }).lean();

      if (!rewardedReferral) return;

      const refereeUserId = String(refereeId);
      const existingLedger = await WalletLedgerModel.exists({
        $or: [
          { referenceId: `referral:${rewardedReferral._id}:referee` },
          { referenceId: `referral:${rewardedReferral._id}`, userId: refereeUserId },
        ],
      });

      if (!existingLedger) {
        const rewardPaise =
          rewardedReferral.rewardPaise || configuredRewardPaise() || 5000;
        const amountRupees = rewardPaise / 100;
        const refereeWallet = await WalletModel.findOneAndUpdate(
          { userId: refereeUserId },
          { $inc: { balance: amountRupees } },
          { new: true, upsert: true, setDefaultsOnInsert: true },
        );
        await WalletLedgerModel.create({
          walletId: refereeWallet._id,
          userId: refereeUserId,
          type: "referral_reward",
          amount: amountRupees,
          balanceAfter: refereeWallet.balance,
          description: "Referral welcome bonus: first completed booking",
          referenceId: `referral:${rewardedReferral._id}:referee`,
        });
      }
    } catch (syncErr) {
      console.warn("[referrals] syncRefereeReward caught:", syncErr);
    }
  },
  /**
   * Checks whether the customer is eligible for a referral reward.
   * If eligible and not yet credited to wallet, credits rewardAmount to user's wallet once inside a DB transaction.
   */
  async getEligibility(userId: string, serviceId?: string, orderValue?: number) {
    if (!Types.ObjectId.isValid(userId)) {
      return { eligible: false, rewardAmount: 0, referralId: null, alreadyCredited: false, alreadyUsed: false };
    }

    const referral = await ReferralModel.findOne({ refereeId: userId });
    if (!referral) {
      return { eligible: false, rewardAmount: 0, referralId: null, alreadyCredited: false, alreadyUsed: false };
    }

    const alreadyUsed = Boolean(
      referral.referralUsed ||
      referral.usedAt ||
      referral.discountBookingId
    );

    let isExpired = false;
    let program: ProgramLike | null = null;
    if (referral.programId) {
      const row = await ReferralProgramModel.findById(referral.programId).lean();
      if (row) {
        program = row as unknown as ProgramLike;
        const now = new Date();
        if (!program.active || (program.endAt && program.endAt < now) || (program.startAt && program.startAt > now)) {
          isExpired = true;
        }
      }
    }

    let rewardAmount = referral.rewardAmount || 0;
    if (!rewardAmount) {
      if (serviceId && orderValue) {
        const offer = await referralsService.refereeDiscount(userId, serviceId, orderValue);
        rewardAmount = offer?.discount ?? (program ? programDiscount(program, orderValue) : 160);
      } else if (program) {
        rewardAmount = program.value ?? 160;
      } else {
        rewardAmount = 160;
      }
    }

    let alreadyCredited = Boolean(
      referral.creditedAt ||
      (await WalletLedgerModel.exists({ userId, referralId: referral._id, reason: "REFERRAL" }))
    );

    const eligible = !alreadyUsed && !isExpired;

    if (eligible && !alreadyCredited && rewardAmount > 0) {
      try {
        const session = await mongoose.startSession();
        try {
          await session.withTransaction(
            async () => {
              const refInTx = await ReferralModel.findById(referral._id).session(session);
              if (refInTx?.creditedAt) return;

              const ledgerExists = await WalletLedgerModel.exists({
                userId,
                referralId: referral._id,
                reason: "REFERRAL",
              }).session(session);
              if (ledgerExists) return;

              const wallet = await WalletModel.findOneAndUpdate(
                { userId },
                { $inc: { balance: rewardAmount } },
                { upsert: true, new: true, session, setDefaultsOnInsert: true }
              );

              await WalletLedgerModel.create(
                [
                  {
                    walletId: wallet._id,
                    userId,
                    referralId: referral._id,
                    type: "CREDIT",
                    reason: "REFERRAL",
                    amount: rewardAmount,
                    balanceAfter: wallet.balance,
                    description: "Referral reward credited to wallet",
                  },
                ],
                { session }
              );

              await ReferralModel.updateOne(
                { _id: referral._id },
                { $set: { rewardAmount, creditedAt: new Date() } },
                { session }
              );
            },
            {
              readPreference: "primary",
              readConcern: { level: "local" },
              writeConcern: { w: "majority" },
            }
          );
          alreadyCredited = true;
        } finally {
          await session.endSession();
        }
      } catch (err: unknown) {
        const code = (err as { code?: number })?.code;
        if (code === 11000) {
          alreadyCredited = true;
        } else {
          console.error("[referrals] Error crediting referral reward to wallet:", err);
        }
      }
    }

    return {
      eligible,
      rewardAmount,
      referralId: String(referral._id),
      alreadyCredited,
      alreadyUsed,
    };
  },
  async refundWalletUsed(bookingId: string) {
    if (!Types.ObjectId.isValid(bookingId)) return;
    const booking = await BookingModel.findById(bookingId).lean();
    if (!booking) return;
    const typedBooking = booking as { wallet_used?: number; walletUsed?: number; customerId: unknown; _id: unknown };
    const walletUsed = typedBooking.wallet_used ?? typedBooking.walletUsed ?? 0;
    if (walletUsed <= 0) return;

    const alreadyRefunded = await WalletLedgerModel.exists({
      bookingId: booking._id,
      reason: "REFUND",
    });
    if (alreadyRefunded) return;

    try {
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(
          async () => {
            const checkAgain = await WalletLedgerModel.exists({
              bookingId: booking._id,
              reason: "REFUND",
            }).session(session);
            if (checkAgain) return;

            const wallet = await WalletModel.findOneAndUpdate(
              { userId: booking.customerId },
              { $inc: { balance: walletUsed } },
              { new: true, upsert: true, session, setDefaultsOnInsert: true }
            );

            await WalletLedgerModel.create(
              [
                {
                  walletId: wallet._id,
                  userId: booking.customerId,
                  bookingId: booking._id,
                  type: "CREDIT",
                  reason: "REFUND",
                  amount: walletUsed,
                  balanceAfter: wallet.balance,
                  description: "HomeCareX Wallet refund for uncompleted booking",
                },
              ],
              { session }
            );

            await ReferralModel.updateOne(
              { refereeId: booking.customerId, discountBookingId: booking._id },
              { $set: { referralUsed: false, usedAt: null, discountBookingId: null, discountAmount: 0 } },
              { session }
            );
          },
          {
            readPreference: "primary",
            readConcern: { level: "local" },
            writeConcern: { w: "majority" },
          }
        );
      } finally {
        await session.endSession();
      }
    } catch (err) {
      console.error("[referrals] refundWalletUsed error:", err);
    }
  },
};
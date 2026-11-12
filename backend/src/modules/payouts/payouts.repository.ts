import { Types } from 'mongoose';
import PartnerModel from '../../models/Partner';
import PayoutModel from '../../models/Payout';
import PayoutBatchModel from '../../models/PayoutBatch';
import UserModel from '../../models/User';
import { AppError } from '../../utils/AppError';
import BookingModel from '../../models/Booking';
import EarningModel from '../earnings/Earning';
import { toLocalDateString, businessTzOffsetMinutes } from '../../utils/dates';
import { adminWalletLedger } from './payouts.ledger';
import { partnerWalletLedger } from '../partner-wallet/partner-wallet.ledger';
import {
  computeBatchStatus,
  groupEarningsByPartner,
  round2,
  type PayoutStatus,
} from './payouts.calc';
import type {
  BatchRecord,
  PayoutRecord,
  PayoutsRepository,
} from './payouts.types';

const isDuplicateKeyError = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  (error as { code?: number }).code === 11000;

const noEarnings = () =>
  new AppError(
    400,
    'NO_EARNINGS_TO_PAY',
    'There are no pending earnings in this period',
  );

const alreadyExists = () =>
  new AppError(
    409,
    'PAYOUT_BATCH_ALREADY_EXISTS',
    'A payout batch already exists for this period',
  );

/**
 * Confirming a payout is what puts the money in the wallets:
 *  - partner wallet: the payout's earnings move pending -> settled, then the net amount is debited (paid out to the bank)
 *  - admin wallet:   commission (+) and the partner payout (-) are recorded
 * Both steps are idempotent, so a retry after an interrupted confirm is safe.
 */
async function applyWalletsForConfirmedPayout(
  payout: {
    _id: unknown;
    partnerId?: unknown;
    batchId?: unknown;
    amount: number;
    commission?: number;
    earningIds?: unknown[];
  },
  adminId?: string,
): Promise<void> {
  let earningIds = (payout.earningIds ?? []).map(String);

  // Payouts created before earningIds existed: fall back to the batch + partner.
  if (!earningIds.length && payout.partnerId && payout.batchId) {
    const rows = await EarningModel.find({
      payoutBatchId: payout.batchId,
      partnerId: payout.partnerId,
    })
      .select('_id')
      .lean();
    earningIds = rows.map((row) => String(row._id));
  }

  await partnerWalletLedger.settleEarnings(earningIds);

  // The net amount leaves the partner wallet (it is now with the partner's bank / UPI). Idempotent per payout.
  if (payout.partnerId) {
    await partnerWalletLedger.debitPayout({
      partnerId: String(payout.partnerId),
      payoutId: String(payout._id),
      amount: payout.amount,
    });
  }

  if (payout.batchId) {
    // Earnings cleared when the job was paid (settlementChannel set) already put their commission and the partner
    // credit in the admin wallet. Record only the rest here, or the admin wallet would count them twice.
    let commission = payout.commission ?? 0;
    let net = payout.amount;
    if (earningIds.length) {
      const rows = await EarningModel.find({ _id: { $in: earningIds } })
        .select('commission net settlementChannel')
        .lean();
      const notYetRecorded = rows.filter((row) => !row.settlementChannel);
      commission = round2(notYetRecorded.reduce((sum, row) => sum + row.commission, 0));
      net = round2(notYetRecorded.reduce((sum, row) => sum + row.net, 0));
    }

    if (commission > 0 || net > 0) {
      await adminWalletLedger.recordPayoutConfirmed({
        payoutId: String(payout._id),
        batchId: String(payout.batchId),
        partnerId: payout.partnerId ? String(payout.partnerId) : undefined,
        commission,
        net,
        confirmedBy: adminId,
      });
    }
  }
}

/**
 * Older databases have a UNIQUE (periodStart, periodEnd) index, which blocks a second batch for the same
 * period (for example jobs finished later the same day). Drop it once; mongoose recreates the plain index.
 */
let legacyIndexChecked = false;
async function dropLegacyUniquePeriodIndex(): Promise<void> {
  if (legacyIndexChecked) return;
  legacyIndexChecked = true;
  try {
    const indexes = await PayoutBatchModel.collection.indexes();
    const legacy = indexes.find(
      (index) => index.unique && index.key && 'periodStart' in index.key && 'periodEnd' in index.key,
    );
    if (legacy?.name) {
      await PayoutBatchModel.collection.dropIndex(legacy.name);
      await PayoutBatchModel.syncIndexes();
    }
  } catch (error) {
    legacyIndexChecked = false;
    console.error('[payouts] Could not drop legacy unique period index', error);
  }
}

export const payoutsRepository: PayoutsRepository = {
  /**
   * Generates a batch from pending earnings in [periodStart, periodEnd).
   * Each partner receives one payout for the batch.
   */
  async generateBatch({ periodStart, periodEnd, adminId, frequency = 'custom' }) {
    await dropLegacyUniquePeriodIndex();

    const batchId = new Types.ObjectId();
    const now = new Date();

    // Two kinds of earning wait for a payout:
    //  - pending: not cleared yet (older flow)
    //  - settled with no batch: cleared the moment the job was completed and paid (online / QR). These were
    //    invisible to batches before. Cash-on-service jobs are excluded: the partner already holds that money.
    const candidates = await EarningModel.find({
      payoutBatchId: null,
      earnedAt: {
        $gte: periodStart,
        $lt: periodEnd,
      },
      $or: [
        { status: 'pending' },
        { status: 'settled', settlementChannel: { $ne: 'cod_cash' } },
      ],
    })
      .select('_id status')
      .lean();

    if (!candidates.length) {
      throw noEarnings();
    }

    const pendingIds = candidates.filter((c) => c.status === 'pending').map((c) => c._id);
    const clearedIds = candidates.filter((c) => c.status !== 'pending').map((c) => c._id);

    // Claim eligible earnings so they cannot be included in another batch.
    // Already-cleared earnings keep their original settledAt; only the batch link is added.
    await EarningModel.updateMany(
      { _id: { $in: pendingIds }, status: 'pending', payoutBatchId: null },
      { $set: { status: 'settled', settledAt: now, payoutBatchId: batchId } },
    );
    await EarningModel.updateMany(
      { _id: { $in: clearedIds }, status: 'settled', payoutBatchId: null },
      { $set: { payoutBatchId: batchId } },
    );

    const claimed = await EarningModel.find({
      payoutBatchId: batchId,
    })
      .select('partnerId gross commission net')
      .lean();

    if (!claimed.length) {
      throw noEarnings();
    }

    try {
      const groups = groupEarningsByPartner(
        claimed.map((earning) => ({
          partnerId: String(earning.partnerId),
          gross: earning.gross,
          commission: earning.commission,
          net: earning.net,
        })),
      );

      const partners = await PartnerModel.find({
        _id: { $in: groups.map((group) => group.partnerId) },
      })
        .select('bankDetails')
        .lean();

      const methodOf = (
        partnerId: string,
      ): 'upi' | 'bank_transfer' | undefined => {
        const bankDetails = partners.find(
          (partner) => String(partner._id) === partnerId,
        )?.bankDetails;

        if (bankDetails?.upiId) {
          return 'upi';
        }

        if (bankDetails?.accountLast4) {
          return 'bank_transfer';
        }

        return undefined;
      };

      const earningIdsByPartner = new Map<string, Types.ObjectId[]>();
      for (const earning of claimed) {
        const key = String(earning.partnerId);
        const list = earningIdsByPartner.get(key) ?? [];
        list.push(earning._id as Types.ObjectId);
        earningIdsByPartner.set(key, list);
      }

      const payoutDocs = groups
        .filter((group) => group.net > 0)
        .map((group) => ({
          _id: new Types.ObjectId(),
          partnerId: new Types.ObjectId(group.partnerId),
          gross: round2(group.gross),
          commission: round2(group.commission),
          amount: round2(group.net),
          earningIds: earningIdsByPartner.get(group.partnerId) ?? [],
          servicesCount: group.count,
          status: 'pending' as const,
          method: methodOf(group.partnerId),
          batchId,
        }));

      if (payoutDocs.length) {
        await PayoutModel.insertMany(payoutDocs);
      }

      const batch = await PayoutBatchModel.create({
        _id: batchId,
        periodStart,
        periodEnd,
        frequency,
        gross: round2(
          groups.reduce((sum, group) => sum + group.gross, 0),
        ),
        commission: round2(
          groups.reduce((sum, group) => sum + group.commission, 0),
        ),
        net: round2(
          groups.reduce((sum, group) => sum + group.net, 0),
        ),
        earningIds: claimed.map((earning) => earning._id),
        payoutIds: payoutDocs.map((payout) => payout._id),
        status: 'pending',
        createdBy: new Types.ObjectId(adminId),
      });

      // NOTE: partner wallet is NOT credited here any more. Earnings stay `pending` in the
      // wallet until the admin confirms the payout (see applyWalletsForConfirmedPayout).

      return batch.toObject() as unknown as BatchRecord;
    } catch (error) {
      // Best-effort rollback of the batch, payouts, wallet and earnings.
      await PayoutModel.deleteMany({ batchId }).catch(() => undefined);

      await PayoutBatchModel.deleteOne({
        _id: batchId,
      }).catch(() => undefined);

      // Only earnings that were pending go back to pending; already-cleared ones just lose the batch link.
      await partnerWalletLedger
        .unsettleEarnings(pendingIds.map(String))
        .catch(() => undefined);

      await EarningModel.updateMany(
        { _id: { $in: pendingIds }, payoutBatchId: batchId },
        { $set: { status: 'pending', settledAt: null, payoutBatchId: null } },
      ).catch(() => undefined);

      await EarningModel.updateMany(
        { _id: { $in: clearedIds }, payoutBatchId: batchId },
        { $set: { payoutBatchId: null } },
      ).catch(() => undefined);

      if (isDuplicateKeyError(error)) {
        throw alreadyExists();
      }

      throw error;
    }
  },

  /**
   * Lists payout batches with pagination and an optional status filter.
   */
  async summary() {
    const rows = await PayoutBatchModel.aggregate<{
      _id: string;
      count: number;
      gross: number;
      commission: number;
      net: number;
    }>([
      { $match: { status: { $ne: 'failed' } } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          gross: { $sum: '$gross' },
          commission: { $sum: '$commission' },
          net: { $sum: '$net' },
        },
      },
    ]);

    const sum = (pick: (row: (typeof rows)[number]) => number, only?: string[]): number =>
      round2(rows.filter((row) => !only || only.includes(row._id)).reduce((total, row) => total + pick(row), 0));

    return {
      batches: sum((row) => row.count),
      gross: sum((row) => row.gross),
      commission: sum((row) => row.commission),
      net: sum((row) => row.net),
      paid: sum((row) => row.net, ['completed']),
      awaiting: sum((row) => row.net, ['pending', 'processing']),
    };
  },

  async listBatches({ page = 1, limit = 20, status }) {
    const safePage =
      Number.isInteger(page) && page > 0 ? page : 1;
    const safeLimit =
      Number.isInteger(limit) && limit > 0 ? limit : 20;

    const match = status ? { status } : {};

    const [items, total] = await Promise.all([
      PayoutBatchModel.find(match)
        .sort({ createdAt: -1, _id: -1 })
        .skip((safePage - 1) * safeLimit)
        .limit(safeLimit)
        .lean(),

      PayoutBatchModel.countDocuments(match),
    ]);

    return {
      items: items as unknown as BatchRecord[],
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        pages: Math.ceil(total / safeLimit),
      },
    };
  },

  /**
   * Finds a batch by ID.
   */
  async findBatchById(batchId) {
    const batch = await PayoutBatchModel.findById(batchId).lean();

    return batch as unknown as BatchRecord | null;
  },

  /**
   * Lists payouts in a batch and attaches the partner's name and email.
   */
  async listPayouts(batchId) {
    if (!Types.ObjectId.isValid(batchId)) {
      throw new AppError(
        400,
        'INVALID_BATCH_ID',
        'Invalid payout batch ID',
      );
    }

    const payouts = await PayoutModel.find({
      batchId: new Types.ObjectId(batchId),
    })
      .sort({ createdAt: 1, _id: 1 })
      .lean();

    const partners = await PartnerModel.find({
      _id: { $in: payouts.map((payout) => payout.partnerId) },
    })
      .select('userId')
      .lean();

    const users = await UserModel.find({
      _id: { $in: partners.map((partner) => partner.userId) },
    })
      .select('name email')
      .lean();

    return payouts.map((payout) => {
      const partner = partners.find(
        (item) => String(item._id) === String(payout.partnerId),
      );

      const user = users.find(
        (item) => String(item._id) === String(partner?.userId),
      );

      return {
        _id: payout._id,
        partnerId: {
          _id: payout.partnerId,
          name: user?.name ?? 'Unknown partner',
          email: user?.email ?? '',
        },
        batchId: payout.batchId,
        amount: payout.amount,
        gross: payout.gross,
        commission: payout.commission,
        servicesCount: payout.servicesCount || payout.earningIds?.length || 0,
        status: payout.status as PayoutStatus,
        method: payout.method ?? null,
        transactionId: payout.transactionId ?? null,
        paidAt: payout.paidAt ?? null,
        createdAt: (
          payout as unknown as { createdAt: Date }
        ).createdAt,
      } satisfies PayoutRecord;
    });
  },

  /**
   * Marks a payout as paid, records the wallet debit,
   * and recalculates its batch status.
   */
  async markPaid({ payoutId, transactionId, adminId }) {
    if (!Types.ObjectId.isValid(payoutId)) {
      throw new AppError(
        400,
        'INVALID_PAYOUT_ID',
        'Invalid payout ID',
      );
    }

    const existing = await PayoutModel.findById(payoutId).lean();

    if (!existing) {
      throw new AppError(
        404,
        'PAYOUT_NOT_FOUND',
        'Payout not found',
      );
    }

    if (existing.status === 'paid') {
      // Reconcile the wallets if a previous confirm was interrupted.
      await applyWalletsForConfirmedPayout(existing as never, adminId);

      throw new AppError(
        409,
        'PAYOUT_ALREADY_PAID',
        'Payout is already in paid status',
      );
    }

    const updated = await PayoutModel.findOneAndUpdate(
      {
        _id: payoutId,
        status: { $in: ['pending', 'processing'] },
      },
      {
        $set: {
          status: 'paid',
          paidAt: new Date(),
          ...(transactionId ? { transactionId } : {}),
        },
      },
      { new: true },
    ).lean();

    if (!updated) {
      throw new AppError(
        409,
        'PAYOUT_STATUS_CONFLICT',
        `Cannot change payout status from ${existing.status} to paid`,
      );
    }

    await applyWalletsForConfirmedPayout(updated as never, adminId);

    if (updated.batchId) {
      const siblings = await PayoutModel.find({
        batchId: updated.batchId,
      })
        .select('status')
        .lean();

      await PayoutBatchModel.updateOne(
        { _id: updated.batchId },
        {
          $set: {
            status: computeBatchStatus(
              siblings.map(
                (sibling) => sibling.status as PayoutStatus,
              ),
            ),
          },
        },
      );
    }

    return {
      _id: updated._id,
      partnerId: updated.partnerId,
      batchId: updated.batchId,
      amount: updated.amount,
      status: updated.status as PayoutStatus,
      method: updated.method ?? null,
      transactionId: updated.transactionId ?? null,
      paidAt: updated.paidAt ?? null,
      createdAt: (
        updated as unknown as { createdAt: Date }
      ).createdAt,
    };
  },

  /**
   * Full detail for one payout: partner, totals and the services grouped by day.
   * Falls back to batch + partner for payouts created before earningIds was stored.
   */
  async getPayoutDetails(payoutId: string) {
    if (!Types.ObjectId.isValid(payoutId)) {
      throw new AppError(400, 'INVALID_PAYOUT_ID', 'Invalid payout ID');
    }

    const payout = await PayoutModel.findById(payoutId).lean();
    if (!payout) {
      throw new AppError(404, 'PAYOUT_NOT_FOUND', 'Payout not found');
    }

    const earningFilter =
      payout.earningIds && payout.earningIds.length
        ? { _id: { $in: payout.earningIds } }
        : { payoutBatchId: payout.batchId, partnerId: payout.partnerId };

    const earnings = await EarningModel.find(earningFilter).sort({ earnedAt: 1, _id: 1 }).lean();

    const bookings = earnings.length
      ? await BookingModel.find({ _id: { $in: earnings.map((e) => e.bookingId) } })
          .select('serviceName')
          .lean()
      : [];
    const serviceNames = new Map(bookings.map((b) => [String(b._id), (b as { serviceName?: string }).serviceName ?? 'Service']));

    const offset = businessTzOffsetMinutes();
    const dayMap = new Map<
      string,
      {
        date: string;
        servicesCount: number;
        gross: number;
        commission: number;
        net: number;
        services: {
          earningId: string;
          bookingId: string;
          serviceName: string;
          gross: number;
          commission: number;
          net: number;
          earnedAt: Date;
        }[];
      }
    >();

    for (const earning of earnings) {
      const date = toLocalDateString(earning.earnedAt, offset);
      const day = dayMap.get(date) ?? { date, servicesCount: 0, gross: 0, commission: 0, net: 0, services: [] };
      day.servicesCount += 1;
      day.gross = round2(day.gross + earning.gross);
      day.commission = round2(day.commission + earning.commission);
      day.net = round2(day.net + earning.net);
      day.services.push({
        earningId: String(earning._id),
        bookingId: String(earning.bookingId),
        serviceName: serviceNames.get(String(earning.bookingId)) ?? 'Service',
        gross: earning.gross,
        commission: earning.commission,
        net: earning.net,
        earnedAt: earning.earnedAt,
      });
      dayMap.set(date, day);
    }

    const days = [...dayMap.values()].sort((a, b) => a.date.localeCompare(b.date));

    const partner = await PartnerModel.findById(payout.partnerId).select('userId').lean();
    const user = partner ? await UserModel.findById(partner.userId).select('name email').lean() : null;

    return {
      payout: {
        id: String(payout._id),
        batchId: String(payout.batchId),
        status: payout.status as PayoutStatus,
        method: payout.method ?? null,
        transactionId: payout.transactionId ?? null,
        paidAt: payout.paidAt ?? null,
        createdAt: (payout as unknown as { createdAt: Date }).createdAt,
      },
      partner: {
        id: payout.partnerId ? String(payout.partnerId) : '',
        name: user?.name ?? 'Unknown partner',
        email: user?.email ?? '',
      },
      days,
      totals: {
        servicesCount: earnings.length,
        gross: payout.gross,
        commission: payout.commission,
        net: payout.amount,
      },
    };
  },

  /**
   * Confirms every unpaid payout of a batch (the weekly "pay everyone" action).
   * One failure does not stop the rest; failures are returned so the admin can retry.
   */
  async confirmBatch({ batchId, adminId }: { batchId: string; adminId: string }) {
    if (!Types.ObjectId.isValid(batchId)) {
      throw new AppError(400, 'INVALID_BATCH_ID', 'Invalid payout batch ID');
    }

    const batch = await PayoutBatchModel.findById(batchId).lean();
    if (!batch) {
      throw new AppError(404, 'PAYOUT_BATCH_NOT_FOUND', 'Payout batch not found');
    }

    const unpaid = await PayoutModel.find({
      batchId: new Types.ObjectId(batchId),
      status: { $in: ['pending', 'processing'] },
    })
      .select('_id')
      .lean();

    if (!unpaid.length) {
      throw new AppError(409, 'NOTHING_TO_CONFIRM', 'All payouts in this batch are already paid');
    }

    const confirmed: string[] = [];
    const failed: { payoutId: string; message: string }[] = [];

    for (const row of unpaid) {
      try {
        await payoutsRepository.markPaid({ payoutId: String(row._id), adminId });
        confirmed.push(String(row._id));
      } catch (error) {
        failed.push({
          payoutId: String(row._id),
          message: error instanceof Error ? error.message : 'Failed to confirm payout',
        });
      }
    }

    const updatedBatch = await PayoutBatchModel.findById(batchId).lean();
    const paid = await PayoutModel.aggregate<{ total: number }>([
      { $match: { _id: { $in: confirmed.map((id) => new Types.ObjectId(id)) } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);

    return {
      batch: updatedBatch as unknown as BatchRecord,
      confirmedCount: confirmed.length,
      confirmedAmount: round2(paid[0]?.total ?? 0),
      failed,
    };
  },
};

export default payoutsRepository;
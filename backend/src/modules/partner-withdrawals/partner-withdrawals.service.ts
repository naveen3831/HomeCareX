import { Types } from 'mongoose';
import { ERROR_CODES } from '../../constants/errorCodes';
import PartnerModel from '../../models/Partner';
import UserModel from '../../models/User';
import { Errors } from '../../utils/errors';
import { partnerWalletLedger } from '../partner-wallet/partner-wallet.ledger';
import { decryptSecret, encryptSecret } from './partner-withdrawals.crypto';
import {
  MAX_SAVED_ACCOUNTS,
  MAX_WITHDRAWAL,
  MIN_WITHDRAWAL,
  type BankAccountType,
  type WithdrawalStatus,
} from './partner-withdrawals.constants';
import {
  BankAccountModel,
  WithdrawalModel,
  type BankAccountDoc,
  type WithdrawalDoc,
} from './partner-withdrawals.models';
import type { AddBankAccountInput, AdminListQuery, CreateWithdrawalInput } from './partner-withdrawals.validation';

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;
const isDuplicateKey = (e: unknown): boolean => typeof e === 'object' && e !== null && (e as { code?: number }).code === 11000;

/* ------------------------------------------------------------------ DTOs */

type WithId<T> = T & { _id: Types.ObjectId; createdAt?: Date; updatedAt?: Date };

export interface BankAccountDto {
  id: string;
  type: BankAccountType;
  accountHolder: string;
  bankName: string | null;
  ifsc: string | null;
  accountLast4: string | null;
  upiId: string | null;
  isDefault: boolean;
  label: string;
}

export interface WithdrawalDto {
  id: string;
  amount: number;
  status: WithdrawalStatus;
  destination: { type: BankAccountType; label: string };
  rejectionReason: string | null;
  transactionId: string | null;
  createdAt: string;
  reviewedAt: string | null;
  paidAt: string | null;
}

const labelFor = (a: { type: BankAccountType; bankName?: string | null; accountLast4?: string | null; upiId?: string | null }): string =>
  a.type === 'upi' ? (a.upiId ?? 'UPI') : `${a.bankName || 'Bank account'} ••${a.accountLast4 ?? '----'}`;

const toBankDto = (a: WithId<BankAccountDoc>): BankAccountDto => ({
  id: String(a._id),
  type: a.type,
  accountHolder: a.accountHolder,
  bankName: a.bankName ?? null,
  ifsc: a.ifsc ?? null,
  accountLast4: a.accountLast4 ?? null,
  upiId: a.upiId ?? null,
  isDefault: Boolean(a.isDefault),
  label: labelFor(a),
});

const toWithdrawalDto = (w: WithId<WithdrawalDoc>): WithdrawalDto => ({
  id: String(w._id),
  amount: round2(w.amount),
  status: w.status,
  destination: { type: w.destination.type, label: labelFor(w.destination) },
  rejectionReason: w.rejectionReason ?? null,
  transactionId: w.transactionId ?? null,
  createdAt: (w.createdAt ?? new Date()).toISOString(),
  reviewedAt: w.reviewedAt ? w.reviewedAt.toISOString() : null,
  paidAt: w.paidAt ? w.paidAt.toISOString() : null,
});

/* ------------------------------------------------------------- helpers */

const requirePartner = async (userId: string): Promise<{ id: string; kycStatus: string | undefined }> => {
  const partner = await PartnerModel.findOne({ userId }).select('_id kyc.status').lean();
  if (!partner) throw Errors.notFound(ERROR_CODES.PARTNER_NOT_FOUND, 'No partner profile found for this account');
  return { id: String(partner._id), kycStatus: partner.kyc?.status };
};

/** Put the held money back. If that fails the status change is undone, so a retry is possible. */
const releaseOrRevert = async (w: WithId<WithdrawalDoc>, from: WithdrawalStatus, reason: 'rejected' | 'cancelled'): Promise<void> => {
  try {
    await partnerWalletLedger.releaseWithdrawal({
      partnerId: String(w.partnerId),
      withdrawalId: String(w._id),
      amount: w.amount,
      reason,
    });
  } catch (err) {
    await WithdrawalModel.updateOne({ _id: w._id }, { $set: { status: from }, $unset: { reviewedAt: '', rejectionReason: '' } });
    throw err;
  }
};

/* ------------------------------------------------------ partner: accounts */

export const partnerWithdrawalsService = {
  async listAccounts(userId: string): Promise<BankAccountDto[]> {
    const { id } = await requirePartner(userId);
    const rows = await BankAccountModel.find({ partnerId: id, deletedAt: { $exists: false } })
      .sort({ isDefault: -1, createdAt: -1 })
      .lean<WithId<BankAccountDoc>[]>();
    return rows.map(toBankDto);
  },

  async addAccount(userId: string, input: AddBankAccountInput): Promise<BankAccountDto> {
    const { id } = await requirePartner(userId);
    const live = { partnerId: id, deletedAt: { $exists: false } };

    const count = await BankAccountModel.countDocuments(live);
    if (count >= MAX_SAVED_ACCOUNTS) {
      throw Errors.badRequest(`You can save up to ${MAX_SAVED_ACCOUNTS} accounts. Remove one first.`);
    }

    const base =
      input.type === 'upi'
        ? { type: 'upi' as const, accountHolder: input.accountHolder, upiId: input.upiId.toLowerCase() }
        : {
            type: 'bank' as const,
            accountHolder: input.accountHolder,
            bankName: input.bankName,
            ifsc: input.ifsc,
            accountNumberEnc: encryptSecret(input.accountNumber),
            accountLast4: input.accountNumber.slice(-4),
          };

    // The same destination twice is almost always a mistake.
    const dup =
      input.type === 'upi'
        ? await BankAccountModel.exists({ ...live, upiId: base.upiId })
        : await BankAccountModel.find({ ...live, type: 'bank', ifsc: input.ifsc, accountLast4: input.accountNumber.slice(-4) })
            .select('accountNumberEnc')
            .lean()
            .then((rows) => rows.some((r) => r.accountNumberEnc && decryptSecret(r.accountNumberEnc) === input.accountNumber));
    if (dup) throw Errors.conflict(ERROR_CODES.CONFLICT, 'This account is already saved');

    const makeDefault = input.makeDefault === true || count === 0;
    if (makeDefault) await BankAccountModel.updateMany(live, { $set: { isDefault: false } });
    const created = await BankAccountModel.create({ ...base, partnerId: id, isDefault: makeDefault });
    return toBankDto(created.toObject() as WithId<BankAccountDoc>);
  },

  async setDefaultAccount(userId: string, accountId: string): Promise<BankAccountDto[]> {
    const { id } = await requirePartner(userId);
    const live = { partnerId: id, deletedAt: { $exists: false } };
    const target = await BankAccountModel.exists({ ...live, _id: accountId });
    if (!target) throw Errors.notFound(ERROR_CODES.NOT_FOUND, 'Account not found');
    await BankAccountModel.updateMany(live, { $set: { isDefault: false } });
    await BankAccountModel.updateOne({ _id: accountId }, { $set: { isDefault: true } });
    return this.listAccounts(userId);
  },

  async deleteAccount(userId: string, accountId: string): Promise<BankAccountDto[]> {
    const { id } = await requirePartner(userId);
    const live = { partnerId: id, deletedAt: { $exists: false } };
    const acc = await BankAccountModel.findOne({ ...live, _id: accountId }).lean<WithId<BankAccountDoc>>();
    if (!acc) throw Errors.notFound(ERROR_CODES.NOT_FOUND, 'Account not found');

    const inUse = await WithdrawalModel.exists({ partnerId: id, status: 'pending', 'destination.accountLast4': acc.accountLast4, 'destination.upiId': acc.upiId });
    if (inUse) throw Errors.conflict(ERROR_CODES.CONFLICT, 'This account is used by a pending withdrawal');

    await BankAccountModel.updateOne({ _id: accountId }, { $set: { deletedAt: new Date(), isDefault: false } });
    if (acc.isDefault) {
      const next = await BankAccountModel.findOne(live).sort({ createdAt: -1 }).select('_id').lean();
      if (next) await BankAccountModel.updateOne({ _id: next._id }, { $set: { isDefault: true } });
    }
    return this.listAccounts(userId);
  },

  /* -------------------------------------------------- partner: withdrawals */

  async list(userId: string) {
    const { id } = await requirePartner(userId);
    const [rows, available] = await Promise.all([
      WithdrawalModel.find({ partnerId: id }).sort({ createdAt: -1, _id: -1 }).limit(30).lean<WithId<WithdrawalDoc>[]>(),
      partnerWalletLedger.availableBalance(id),
    ]);
    const items = rows.map(toWithdrawalDto);
    return {
      currency: 'INR' as const,
      minAmount: MIN_WITHDRAWAL,
      maxAmount: MAX_WITHDRAWAL,
      available,
      pending: items.find((w) => w.status === 'pending') ?? null,
      items,
    };
  },

  async create(userId: string, input: CreateWithdrawalInput): Promise<WithdrawalDto> {
    const { id, kycStatus } = await requirePartner(userId);
    if (kycStatus === 'suspended' || kycStatus === 'rejected') {
      throw Errors.forbidden('Withdrawals are not available for your account right now. Please contact support.');
    }
    const amount = round2(input.amount);

    const account = await BankAccountModel.findOne({ _id: input.bankAccountId, partnerId: id, deletedAt: { $exists: false } }).lean<
      WithId<BankAccountDoc>
    >();
    if (!account) throw Errors.notFound(ERROR_CODES.NOT_FOUND, 'Choose one of your saved accounts');

    // 1) Claim the single "pending" slot. A second tap or a second device stops here with a 409.
    let doc;
    try {
      doc = await WithdrawalModel.create({
        partnerId: id,
        amount,
        status: 'pending',
        destination: {
          type: account.type,
          accountHolder: account.accountHolder,
          bankName: account.bankName,
          ifsc: account.ifsc,
          accountNumberEnc: account.accountNumberEnc,
          accountLast4: account.accountLast4,
          upiId: account.upiId,
        },
      });
    } catch (err) {
      if (isDuplicateKey(err)) {
        throw Errors.conflict(ERROR_CODES.CONFLICT, 'You already have a withdrawal waiting for approval');
      }
      throw err;
    }

    // 2) Check the balance and hold the money. Any failure frees the slot again.
    try {
      const available = await partnerWalletLedger.availableBalance(id);
      if (amount > available) {
        throw Errors.badRequest(`You can withdraw up to ₹${available.toLocaleString('en-IN')} right now`);
      }
      await partnerWalletLedger.holdWithdrawal({ partnerId: id, withdrawalId: String(doc._id), amount });
    } catch (err) {
      await WithdrawalModel.deleteOne({ _id: doc._id });
      throw err;
    }
    return toWithdrawalDto(doc.toObject() as WithId<WithdrawalDoc>);
  },

  async cancel(userId: string, withdrawalId: string): Promise<WithdrawalDto> {
    const { id } = await requirePartner(userId);
    const w = await WithdrawalModel.findOneAndUpdate(
      { _id: withdrawalId, partnerId: id, status: 'pending' },
      { $set: { status: 'cancelled', reviewedAt: new Date() } },
      { new: true },
    ).lean<WithId<WithdrawalDoc>>();
    if (!w) {
      const exists = await WithdrawalModel.exists({ _id: withdrawalId, partnerId: id });
      if (!exists) throw Errors.notFound(ERROR_CODES.NOT_FOUND, 'Withdrawal not found');
      throw Errors.conflict(ERROR_CODES.INVALID_STATE_TRANSITION, 'Only a request that is still waiting can be cancelled');
    }
    await releaseOrRevert(w, 'pending', 'cancelled');
    return toWithdrawalDto(w);
  },
};

/* --------------------------------------------------------------- admin */

export const adminWithdrawalsService = {
  async list(query: AdminListQuery) {
    const match = query.status ? { status: query.status } : {};
    const [rows, total, pendingCount] = await Promise.all([
      WithdrawalModel.find(match)
        .sort({ createdAt: -1, _id: -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .lean<WithId<WithdrawalDoc>[]>(),
      WithdrawalModel.countDocuments(match),
      WithdrawalModel.countDocuments({ status: 'pending' }),
    ]);

    const partners = await PartnerModel.find({ _id: { $in: rows.map((r) => r.partnerId) } })
      .select('userId')
      .lean();
    const users = await UserModel.find({ _id: { $in: partners.map((p) => p.userId) } })
      .select('name email phone')
      .lean();
    const userByPartner = new Map(partners.map((p) => [String(p._id), users.find((u) => String(u._id) === String(p.userId))]));

    return {
      currency: 'INR' as const,
      pendingCount,
      items: rows.map((r) => {
        const u = userByPartner.get(String(r.partnerId));
        return {
          ...toWithdrawalDto(r),
          partner: { id: String(r.partnerId), name: u?.name ?? 'Unknown partner', email: u?.email ?? '', phone: u?.phone ?? '' },
        };
      }),
      pagination: { page: query.page, limit: query.limit, total, pages: Math.max(1, Math.ceil(total / query.limit)) },
    };
  },

  /** Detail view: the only place the full account number is ever decrypted (for the person making the transfer). */
  async detail(withdrawalId: string) {
    const w = await WithdrawalModel.findById(withdrawalId).lean<WithId<WithdrawalDoc>>();
    if (!w) throw Errors.notFound(ERROR_CODES.NOT_FOUND, 'Withdrawal not found');
    const d = w.destination;
    return {
      ...toWithdrawalDto(w),
      destinationFull: {
        type: d.type,
        accountHolder: d.accountHolder,
        bankName: d.bankName ?? null,
        ifsc: d.ifsc ?? null,
        accountNumber: d.accountNumberEnc ? decryptSecret(d.accountNumberEnc) : null,
        upiId: d.upiId ?? null,
      },
    };
  },

  async approve(adminId: string, withdrawalId: string): Promise<WithdrawalDto> {
    const w = await WithdrawalModel.findOneAndUpdate(
      { _id: withdrawalId, status: 'pending' },
      { $set: { status: 'approved', reviewedBy: adminId, reviewedAt: new Date() } },
      { new: true },
    ).lean<WithId<WithdrawalDoc>>();
    if (!w) throw await this.notActionable(withdrawalId);
    return toWithdrawalDto(w);
  },

  async markPaid(adminId: string, withdrawalId: string, transactionId: string): Promise<WithdrawalDto> {
    const now = new Date();
    const w = await WithdrawalModel.findOneAndUpdate(
      { _id: withdrawalId, status: { $in: ['pending', 'approved'] } },
      { $set: { status: 'paid', transactionId, paidAt: now, reviewedBy: adminId, reviewedAt: now } },
      { new: true },
    ).lean<WithId<WithdrawalDoc>>();
    if (!w) throw await this.notActionable(withdrawalId);
    return toWithdrawalDto(w);
  },

  async reject(adminId: string, withdrawalId: string, reason: string): Promise<WithdrawalDto> {
    const prev = await WithdrawalModel.findOne({ _id: withdrawalId, status: { $in: ['pending', 'approved'] } }).select('status').lean();
    const w = await WithdrawalModel.findOneAndUpdate(
      { _id: withdrawalId, status: { $in: ['pending', 'approved'] } },
      { $set: { status: 'rejected', rejectionReason: reason, reviewedBy: adminId, reviewedAt: new Date() } },
      { new: true },
    ).lean<WithId<WithdrawalDoc>>();
    if (!w) throw await this.notActionable(withdrawalId);
    await releaseOrRevert(w, (prev?.status as WithdrawalStatus) ?? 'pending', 'rejected');
    return toWithdrawalDto(w);
  },

  async notActionable(withdrawalId: string) {
    const exists = await WithdrawalModel.exists({ _id: withdrawalId });
    return exists
      ? Errors.conflict(ERROR_CODES.INVALID_STATE_TRANSITION, 'This request has already been handled')
      : Errors.notFound(ERROR_CODES.NOT_FOUND, 'Withdrawal not found');
  },
};
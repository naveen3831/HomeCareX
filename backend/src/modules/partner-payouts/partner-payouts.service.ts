import { ERROR_CODES } from '../../constants/errorCodes';
import { Errors } from '../../utils/errors';
import {
  partnerPayoutsRepository,
  type PartnerPayoutsRepository,
  type PayoutRowRaw,
} from './partner-payouts.repository'
import type { PayoutDto, PayoutsListDto } from './partner-payouts.types';
import type { PayoutsQuery } from './partner-payouts.validation';

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

const toDto = (r: PayoutRowRaw): PayoutDto => ({
  id: r.id,
    amount: round2(r.amount),
  currency: 'INR',
  status: r.status,
  method: r.method,
  transactionId: r.transactionId,
  batchId: r.batchId,
  paidAt: r.paidAt ? r.paidAt.toISOString() : null,
  expectedDate: r.expectedDate ? r.expectedDate.toISOString() : null,
  createdAt: r.createdAt.toISOString(),
});

const requirePartnerId = async (userId: string, repo: PartnerPayoutsRepository): Promise<string> => {
  const partnerId = await repo.findPartnerIdByUserId(userId);
  if (!partnerId) throw Errors.notFound(ERROR_CODES.PARTNER_NOT_FOUND, 'No partner profile found for this account');
  return partnerId;
};

export const partnerPayoutsService = {
  /**
   * GET /partner/payouts
   * @param userId from the verified JWT, never from the request
   */
  async list(
    userId: string,
    query: PayoutsQuery,
    repo: PartnerPayoutsRepository = partnerPayoutsRepository,
  ): Promise<PayoutsListDto> {
    const partnerId = await requirePartnerId(userId, repo);
    const [next, history] = await Promise.all([
      repo.findNext(partnerId),
      repo.listHistory(partnerId, query.status, query.limit),
    ]);
    return { currency: 'INR', next: next ? toDto(next) : null, history: history.map(toDto) };
  },

  /**
   * GET /partner/payouts/:id
   * Someone else's payout answers 404, the same as one that does not exist.
   */
  async getById(
    userId: string,
    id: string,
    repo: PartnerPayoutsRepository = partnerPayoutsRepository,
  ): Promise<PayoutDto> {
    const partnerId = await requirePartnerId(userId, repo);
    const row = await repo.findById(partnerId, id);
    if (!row) throw Errors.notFound(ERROR_CODES.NOT_FOUND, 'Payout not found');
    return toDto(row);
  },
};
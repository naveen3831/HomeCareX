
import { PAYOUTS_CONSTANTS } from './payouts.constants';

export const payoutsValidation = {
  isObjectId(value: unknown): value is string {
    return typeof value === 'string' && /^[a-f\d]{24}$/i.test(value);
  },

  isValidDate(value: unknown): value is string {
    return (
      typeof value === 'string' &&
      value.trim().length > 0 &&
      !Number.isNaN(Date.parse(value))
    );
  },

  parsePage(value: unknown): number {
    const page = value === undefined ? PAYOUTS_CONSTANTS.DEFAULT_PAGE : Number(value);

    if (!Number.isInteger(page) || page < 1) {
      throw new Error('INVALID_PAGE');
    }

    return page;
  },

  parseLimit(value: unknown): number {
    const limit = value === undefined ? PAYOUTS_CONSTANTS.DEFAULT_LIMIT : Number(value);

    if (
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > PAYOUTS_CONSTANTS.MAX_LIMIT
    ) {
      throw new Error('INVALID_LIMIT');
    }

    return limit;
  },

  isValidBatchStatus(value: string): boolean {
    return (PAYOUTS_CONSTANTS.BATCH_STATUSES as readonly string[]).includes(value);
  },
};

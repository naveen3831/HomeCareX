import { z } from 'zod';
import {
  ACCOUNT_NUMBER_REGEX,
  IFSC_REGEX,
  MAX_WITHDRAWAL,
  MIN_WITHDRAWAL,
  UPI_REGEX,
  WITHDRAWAL_STATUSES,
} from './partner-withdrawals.constants';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const holder = z.string().trim().min(2, 'Enter the name on the account').max(80);

const bankAccount = z
  .object({
    type: z.literal('bank'),
    accountHolder: holder,
    bankName: z.string().trim().min(2, 'Enter the bank name').max(80),
    accountNumber: z.string().trim().regex(ACCOUNT_NUMBER_REGEX, 'Account number must be 9 to 18 digits'),
    confirmAccountNumber: z.string().trim(),
    ifsc: z.string().trim().toUpperCase().regex(IFSC_REGEX, 'Enter a valid IFSC code (e.g. HDFC0001234)'),
    makeDefault: z.boolean().optional(),
  })
  .strict()
  .refine((v) => v.accountNumber === v.confirmAccountNumber, {
    message: 'Account numbers do not match',
    path: ['confirmAccountNumber'],
  });

const upiAccount = z
  .object({
    type: z.literal('upi'),
    accountHolder: holder,
    upiId: z.string().trim().regex(UPI_REGEX, 'Enter a valid UPI ID (e.g. name@bank)'),
    makeDefault: z.boolean().optional(),
  })
  .strict();

/** POST /partner/bank-accounts */
export const addBankAccountSchema = z.union([bankAccount, upiAccount]);
export type AddBankAccountInput = z.infer<typeof addBankAccountSchema>;

export const idParamSchema = z.object({ id: objectId }).strict();

/** POST /partner/withdrawals */
export const createWithdrawalSchema = z
  .object({
    amount: z
      .number({ invalid_type_error: 'Enter an amount' })
      .finite()
      .min(MIN_WITHDRAWAL, `Minimum withdrawal is ₹${MIN_WITHDRAWAL}`)
      .max(MAX_WITHDRAWAL, `Maximum per request is ₹${MAX_WITHDRAWAL.toLocaleString('en-IN')}`)
      .refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6, 'At most 2 decimal places'),
    bankAccountId: objectId,
  })
  .strict();
export type CreateWithdrawalInput = z.infer<typeof createWithdrawalSchema>;

/** Admin: GET /admin/withdrawals */
export const adminListQuerySchema = z
  .object({
    status: z.enum(WITHDRAWAL_STATUSES).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();
export type AdminListQuery = z.infer<typeof adminListQuerySchema>;

export const rejectSchema = z.object({ reason: z.string().trim().min(3, 'Give a short reason').max(300) }).strict();
export const paidSchema = z.object({ transactionId: z.string().trim().min(3, 'Enter the transfer reference').max(80) }).strict();
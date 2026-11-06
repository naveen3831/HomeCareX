// Partner withdrawals: saved bank accounts / UPI IDs and withdrawal requests.
// The server decides what can be withdrawn. Nothing here is trusted for money.
import http, { type ApiResponse } from '@/lib/http';

export type AccountType = 'bank' | 'upi';
export type WithdrawalStatus = 'pending' | 'approved' | 'paid' | 'rejected' | 'cancelled';

export interface BankAccount {
  id: string;
  type: AccountType;
  accountHolder: string;
  bankName: string | null;
  ifsc: string | null;
  accountLast4: string | null;
  upiId: string | null;
  isDefault: boolean;
  label: string; // "HDFC Bank ••1234" or "name@upi"
}

export interface Withdrawal {
  id: string;
  amount: number;
  status: WithdrawalStatus;
  destination: { type: AccountType; label: string };
  rejectionReason: string | null;
  transactionId: string | null;
  createdAt: string;
  reviewedAt: string | null;
  paidAt: string | null;
}

export interface WithdrawalsOverview {
  currency: 'INR';
  minAmount: number;
  maxAmount: number;
  available: number;
  pending: Withdrawal | null;
  items: Withdrawal[];
}

export type NewAccountInput =
  | {
      type: 'bank';
      accountHolder: string;
      bankName: string;
      accountNumber: string;
      confirmAccountNumber: string;
      ifsc: string;
      makeDefault?: boolean;
    }
  | { type: 'upi'; accountHolder: string; upiId: string; makeDefault?: boolean };

/** Works for the axios-style errors thrown by lib/http and for plain Errors. */
export const errorMessage = (e: unknown, fallback = 'Something went wrong. Please try again.'): string =>
  e && typeof e === 'object' && 'message' in e && typeof (e as { message: unknown }).message === 'string'
    ? (e as { message: string }).message
    : fallback;

export const withdrawApi = {
  async overview(): Promise<WithdrawalsOverview> {
    return (await http.get<ApiResponse<WithdrawalsOverview>>('/partner/withdrawals')).data.data;
  },
  async create(amount: number, bankAccountId: string): Promise<Withdrawal> {
    return (await http.post<ApiResponse<Withdrawal>>('/partner/withdrawals', { amount, bankAccountId })).data.data;
  },
  async cancel(id: string): Promise<Withdrawal> {
    return (await http.post<ApiResponse<Withdrawal>>(`/partner/withdrawals/${id}/cancel`)).data.data;
  },
  async accounts(): Promise<BankAccount[]> {
    return (await http.get<ApiResponse<BankAccount[]>>('/partner/bank-accounts')).data.data;
  },
  async addAccount(input: NewAccountInput): Promise<BankAccount> {
    return (await http.post<ApiResponse<BankAccount>>('/partner/bank-accounts', input)).data.data;
  },
  async removeAccount(id: string): Promise<BankAccount[]> {
    return (await http.delete<ApiResponse<BankAccount[]>>(`/partner/bank-accounts/${id}`)).data.data;
  },
  async makeDefault(id: string): Promise<BankAccount[]> {
    return (await http.patch<ApiResponse<BankAccount[]>>(`/partner/bank-accounts/${id}/default`)).data.data;
  },
};

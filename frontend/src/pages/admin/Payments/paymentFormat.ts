import type { PaymentStatus, RefundStatus } from '@/types/adminPayment';

export const formatMoney = (amount: number, currency = 'INR'): string => {
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
};

export const formatDateTime = (iso?: string | null): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(d);
};

export const STATUS_LABEL: Record<PaymentStatus, string> = {
  PENDING: 'Pending',
  PAID: 'Paid',
  FAILED: 'Failed',
  REFUNDED: 'Refunded',
};

export const REFUND_LABEL: Record<RefundStatus, string> = {
  none: 'No refund',
  requested: 'Requested',
  approved: 'Approved',
  processed: 'Processed',
  rejected: 'Rejected',
};

const METHOD_LABEL: Record<string, string> = {
  card: 'Card',
  upi: 'UPI',
  netbanking: 'Net banking',
  wallet: 'Wallet',
  cod: 'Cash on delivery',
};

export const METHOD_OPTIONS = Object.entries(METHOD_LABEL).map(([value, label]) => ({ value, label }));

export const methodLabel = (method?: string | null): string => {
  if (!method) return '—';
  return METHOD_LABEL[method.toLowerCase()] ?? method.charAt(0).toUpperCase() + method.slice(1);
};
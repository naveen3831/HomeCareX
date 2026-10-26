import type { LedgerType } from '../Wallet/wallet.api';
import { apiBaseUrl } from '@/lib/apiBase';

export interface TransactionEntry {
  id: string | number;
  type: LedgerType;
  description: string;
  amount: number; // signed: positive = money in, negative = money out
  createdAt: string;
}

export interface TransactionsPage {
  items: TransactionEntry[];
  total: number;
  page: number;
  limit: number;
}

// The backend mounts every route under /api/v1.
const API_BASE = apiBaseUrl;

const getToken = (): string | null => localStorage.getItem('token');

interface RawEntry {
  id?: string | number;
  _id?: string;
  type: LedgerType;
  description?: string;
  amount: number;
  createdAt: string;
}

interface RawResponse {
  items?: RawEntry[];
  transactions?: RawEntry[];
  total?: number;
  page?: number;
  limit?: number;
  pagination?: { total?: number; page?: number; limit?: number };
  data?: RawResponse;
}

/** Accepts { items, total, page, limit } or { transactions, pagination } (optionally wrapped in data). */
function normalise(raw: RawResponse, page: number, limit: number): TransactionsPage {
  const body = raw.data ?? raw;
  const list = body.items ?? body.transactions ?? [];
  const pg = body.pagination;
  return {
    items: list.map((e) => ({
      id: e.id ?? e._id ?? `${e.createdAt}-${e.amount}`,
      type: e.type,
      description: e.description ?? '',
      amount: e.amount,
      createdAt: e.createdAt,
    })),
    total: body.total ?? pg?.total ?? list.length,
    page: body.page ?? pg?.page ?? page,
    limit: body.limit ?? pg?.limit ?? limit,
  };
}

/**
 * GET /partner/transactions
 * @param from inclusive start date, YYYY-MM-DD
 * @param to   inclusive end date, YYYY-MM-DD
 */
export async function getTransactions(
  page: number,
  limit: number,
  type?: LedgerType,
  from?: string,
  to?: string,
): Promise<TransactionsPage> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (type) params.set('type', type);
  if (from) params.set('from', from);
  if (to) params.set('to', to);

  const token = getToken();
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/partner/transactions?${params.toString()}`, {
      headers: {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  } catch {
    throw new Error('Cannot reach the server. Check your connection.');
  }

  if (!res.ok) {
    let message = 'Could not load transactions.';
    try {
      const body = (await res.json()) as { message?: string };
      if (body.message) message = body.message;
    } catch {
      /* response had no JSON body */
    }
    throw new Error(message);
  }

  return normalise((await res.json()) as RawResponse, page, limit);
}
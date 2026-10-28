
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { http } from "@/lib/http";
import "./index.css";

type RefundStatus =
  | "Pending"
  | "Approved"
  | "Rejected"
  | "Processing"
  | "Completed"
  | "Failed";

interface Refund {
  id: string;
  refundId: string;
  paymentId: string;
  bookingId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  amount: number;
  status: RefundStatus;
  method: string;
  reason: string;
  rejectionReason: string;
  failureMessage: string;
  razorpayRefundId: string;
  createdAt: string;
  updatedAt: string;
  raw: Record<string, unknown>;
}

const PAGE_SIZE = 10;

const asObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};

const firstValue = (...values: unknown[]): string => {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value);
    }
  }
  return "";
};

const normalizeStatus = (value: unknown): RefundStatus => {
  const status = String(value ?? "").toLowerCase();

  if (["requested", "pending", "initiated"].includes(status)) {
    return "Pending";
  }
  if (["approved", "accepted"].includes(status)) return "Approved";
  if (["rejected", "declined", "cancelled", "canceled"].includes(status)) {
    return "Rejected";
  }
  if (["processing", "in_progress", "created"].includes(status)) {
    return "Processing";
  }
  if (
    ["processed", "completed", "success", "successful"].includes(status)
  ) {
    return "Completed";
  }
  if (["failed", "failure", "error"].includes(status)) return "Failed";

  return "Pending";
};

const normalizeRefund = (item: unknown): Refund => {
  const raw = asObject(item);
  const payment = asObject(raw.payment ?? raw.paymentDetails);
  const booking = asObject(raw.booking);
  const customer = asObject(
    raw.customer ?? raw.user ?? booking.customer ?? booking.user,
  );
  const refundDetails = asObject(raw.refundDetails);

  const id = firstValue(
    raw._id,
    raw.id,
    raw.refundRequestId,
    raw.refund_id,
  );

  const amountValue =
    raw.refundAmount ??
    raw.amount ??
    raw.amountInPaise ??
    payment.refundAmount ??
    payment.amount ??
    0;

  const numericAmount = Number(amountValue);
  const amount =
    Number.isFinite(numericAmount) && numericAmount >= 0
      ? numericAmount
      : 0;

  return {
    id,
    refundId: firstValue(raw.refundId, raw.refund_id, raw._id, raw.id, id),
    paymentId: firstValue(
      raw.paymentId,
      payment._id,
      payment.id,
      payment.razorpayPaymentId,
      raw.razorpayPaymentId,
    ),
    bookingId: firstValue(
      raw.bookingId,
      booking.bookingId,
      booking._id,
      booking.id,
    ),
    customerName: firstValue(
      raw.customerName,
      customer.name,
      customer.fullName,
      raw.userName,
      "Customer",
    ),
    customerEmail: firstValue(raw.customerEmail, customer.email),
    customerPhone: firstValue(
      raw.customerPhone,
      customer.phone,
      customer.mobile,
    ),
    amount,
    status: normalizeStatus(
      raw.status ?? raw.refundStatus ?? payment.refundStatus,
    ),
    method: firstValue(
      raw.method,
      raw.paymentMethod,
      payment.method,
      payment.paymentMethod,
      payment.razorpayPaymentId ? "Razorpay" : "",
      "Wallet",
    ),
    reason: firstValue(
      raw.reason,
      raw.refundReason,
      raw.description,
      raw.customerReason,
      "No reason provided",
    ),
    rejectionReason: firstValue(raw.rejectionReason, raw.reviewNote),
    failureMessage: firstValue(
      raw.failureMessage,
      raw.errorMessage,
      raw.failureReason,
      payment.failureMessage,
    ),
    razorpayRefundId: firstValue(
      raw.razorpayRefundId,
      refundDetails.razorpayRefundId,
      payment.razorpayRefundId,
    ),
    createdAt: firstValue(raw.createdAt, raw.requestedAt, raw.date),
    updatedAt: firstValue(raw.updatedAt, raw.processedAt),
    raw,
  };
};

const getErrorMessage = (error: unknown): string => {
  const root = asObject(error);
  const response = asObject(root.response);
  const data = asObject(response.data);
  return firstValue(data.message, data.error, root.message, "Something went wrong. Please try again.");
};

const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);

const formatDate = (value: string): string => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const shortId = (value: string, length = 15): string => {
  if (!value || value.length <= length) return value || "—";
  return `${value.slice(0, 7)}…${value.slice(-5)}`;
};

const getInitials = (name: string): string =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "C";

const statusClass = (status: RefundStatus): string =>
  `refund-status refund-status--${status.toLowerCase()}`;

const extractRefunds = (response: unknown): Refund[] => {
  const root = asObject(response);
  const body = asObject(root.data ?? response);
  const payloadValue = body.data ?? body;
  const payload = asObject(payloadValue);
  const rows =
    payload.refunds ??
    payload.items ??
    payload.results ??
    payload.requests ??
    (Array.isArray(payloadValue) ? payloadValue : []);

  return Array.isArray(rows) ? rows.map(normalizeRefund) : [];
};

const extractTotal = (response: unknown, fallback: number): number => {
  const root = asObject(response);
  const body = asObject(root.data ?? response);
  const payload = asObject(body.data ?? body);
  const pagination = asObject(payload.pagination);
  const meta = asObject(payload.meta);
  const total = Number(
    payload.total ??
      payload.totalCount ??
      pagination.total ??
      meta.total,
  );

  return Number.isFinite(total) && total >= 0 ? total : fallback;
};

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Check, X, XCircle } from 'lucide-react';
import clsx from 'clsx';
import { PageHeader } from '@/components/admin/PageHeader';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { Pagination } from '@/components/admin/Pagination';
import { usePermissions } from '@/hooks/usePermissions';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { REFUND_STATUSES, decideRefund, fetchAdminRefunds, type AdminRefund, type AdminRefundsResult, type RefundStatus } from '@/services/adminRefundApi';
import { formatDateTime, formatMoney } from '../Payments/paymentFormat';
import '../Categories/index.css';
import './index.css';

export const PAYMENTS_REFUND = 'payments:refund';
const PAGE_SIZE = 20;
const LABEL: Record<RefundStatus, string> = { requested: 'Requested', approved: 'Approved', processed: 'Processed', rejected: 'Rejected' };
const errText = (e: unknown) => (e as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message || (e as { message?: string })?.message || 'Something went wrong. Please try again.';

type Pending = { refund: AdminRefund; action: 'approve' | 'reject' } | null;

/** /admin/refunds: review refund requests (GET /admin/refunds) and approve or reject them (PATCH /admin/refunds/:id). */
export const AdminRefundsPage: React.FC = () => {
  const { can } = usePermissions();
  const canDecide = can(PAYMENTS_REFUND);
  const online = useOnlineStatus();

  const [status, setStatus] = useState<RefundStatus | ''>('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AdminRefundsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pending, setPending] = useState<Pending>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ text: string; tone: 'success' | 'error' } | null>(null);
  const timer = useRef<number>();

  const flash = useCallback((text: string, tone: 'success' | 'error' = 'success') => {
    setToast({ text, tone });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(null), 5500);
  }, []);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  useEffect(() => {
    const t = window.setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 350);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try { setData(await fetchAdminRefunds({ status, search, page, limit: PAGE_SIZE })); }
    catch (e) { setError(errText(e)); }
    finally { setLoading(false); }
  }, [status, search, page]);
  useEffect(() => { void load(); }, [load]);

  async function confirm(reason?: string) {
    if (!pending) return;
    setBusy(true);
    try {
      await decideRefund(pending.refund._id, pending.action, reason);
      flash(pending.action === 'approve' ? 'Refund approved' : 'Refund rejected');
      setPending(null);
      await load();
    } catch (e) {
      flash(errText(e), 'error');
      setPending(null);
    } finally { setBusy(false); }
  }

  const items = data?.items ?? [];
  const meta = data?.meta;

  return (
    <div className="admin-page-container cat-page">
      <PageHeader title="Refunds" description="Customer refund requests. Approving sends the refund; rejecting needs a reason the customer can see." />

      {toast && (
        <div role="status" className={clsx('cat-toast', toast.tone === 'error' && 'is-error')}>
          {toast.tone === 'error' ? <XCircle size={16} /> : <CheckCircle2 size={16} />}<span>{toast.text}</span>
          <button type="button" aria-label="Dismiss" onClick={() => setToast(null)}><X size={14} /></button>
        </div>
      )}
      {!canDecide && <div className="cat-banner cat-banner--info" role="status">You can view refunds but need the “{PAYMENTS_REFUND}” permission to approve or reject them.</div>}

      <div className="rfd-toolbar">
        <div className="rfd-chips" role="radiogroup" aria-label="Status">
          <button type="button" role="radio" aria-checked={status === ''} className={clsx('rfd-chip', status === '' && 'is-on')} onClick={() => { setStatus(''); setPage(1); }}>All</button>
          {REFUND_STATUSES.map((s) => (
            <button key={s} type="button" role="radio" aria-checked={status === s} className={clsx('rfd-chip', status === s && 'is-on')} onClick={() => { setStatus(s); setPage(1); }}>{LABEL[s]}</button>
          ))}
        </div>
        <label className="rfd-search">
          <input type="search" aria-label="Search refunds" placeholder="Search by refund, payment, booking or customer id" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
        </label>
      </div>

      {error ? (
        <div role="alert" className="cat-alert">{error} <button type="button" className="hcx-btn" onClick={() => void load()}>Retry</button></div>
      ) : loading && !data ? (
        <div className="cat-skel" aria-label="Loading refunds">{[0, 1, 2, 3].map((n) => <span key={n} className="hcx-skeleton hcx-skeleton--block" style={{ height: 56 }} />)}</div>
      ) : items.length === 0 ? (
        <div className="cat-empty"><h3>{status || search ? 'No refunds match your filters' : 'No refund requests yet'}</h3></div>
      ) : (
        <div className="hcx-table-card" aria-busy={loading}>
          <div className="hcx-table-scroll">
            <table className="hcx-table" aria-label="Refunds">
              <thead>
                <tr>
                  <th scope="col">Customer</th>
                  <th scope="col">Booking</th>
                  <th scope="col">Payment</th>
                  <th scope="col">Amount</th>
                  <th scope="col">Method</th>
                  <th scope="col">Reason</th>
                  <th scope="col">Status</th>
                  <th scope="col">Requested</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r._id}>
                    <td>{r.customerId?.name ?? '—'}{r.customerId?.email && <small className="rfd-sub">{r.customerId.email}</small>}</td>
                    <td>{r.bookingId?.serviceName ?? '—'}<small className="rfd-sub rfd-mono">{r.bookingId?._id ?? ''}</small></td>
                    <td className="rfd-mono">{r.paymentId?.razorpayPaymentId ?? r.paymentId?._id ?? '—'}</td>
                    <td>{formatMoney(r.amount, r.currency)}</td>
                    <td>{r.method === 'WALLET' ? 'Wallet credit' : 'Original payment'}</td>
                    <td>{r.reason}{r.status === 'rejected' && r.rejectionReason && <p className="rfd-note">Rejected: {r.rejectionReason}</p>}</td>
                    <td><span className={clsx('rfd-pill', `rfd-pill--${r.status}`)}>{LABEL[r.status]}</span></td>
                    <td>{formatDateTime(r.requestedAt ?? r.createdAt)}</td>
                    <td>
                      {canDecide && r.status === 'requested' && (
                        <div className="rfd-actions">
                          <button type="button" className="hcx-btn hcx-btn--primary" disabled={!online} aria-label={`Approve refund of ${formatMoney(r.amount, r.currency)}`} onClick={() => setPending({ refund: r, action: 'approve' })}><Check size={14} /> Approve</button>
                          <button type="button" className="hcx-btn" disabled={!online} aria-label={`Reject refund of ${formatMoney(r.amount, r.currency)}`} onClick={() => setPending({ refund: r, action: 'reject' })}><X size={14} /> Reject</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {meta && <Pagination page={meta.page} pageSize={meta.limit} total={meta.total} onPageChange={setPage} />}
        </div>
      )}

      <ConfirmDialog
        open={!!pending}
        tone={pending?.action === 'reject' ? 'danger' : 'primary'}
        loading={busy}
        title={pending?.action === 'approve' ? 'Approve this refund?' : 'Reject this refund?'}
        confirmLabel={pending?.action === 'approve' ? 'Approve' : 'Reject'}
        message={pending ? <>{formatMoney(pending.refund.amount, pending.refund.currency)} to {pending.refund.customerId?.name ?? 'the customer'}. This is recorded in the audit log.</> : null}
        reason={pending?.action === 'reject' ? { label: 'Rejection reason', required: true, placeholder: 'Tell the customer why' } : undefined}
        onCancel={() => setPending(null)}
        onConfirm={(reason) => void confirm(reason)}
      />
    </div>
  );
};

export default AdminRefundsPage;

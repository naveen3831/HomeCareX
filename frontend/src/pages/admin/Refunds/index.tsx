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
      {!canDecide && <div className="cat-banner cat-banner--info" role="status">You can view refunds but need the ΓÇ£{PAYMENTS_REFUND}ΓÇ¥ permission to approve or reject them.</div>}

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
                    <td>{r.customerId?.name ?? 'ΓÇö'}{r.customerId?.email && <small className="rfd-sub">{r.customerId.email}</small>}</td>
                    <td>{r.bookingId?.serviceName ?? 'ΓÇö'}<small className="rfd-sub rfd-mono">{r.bookingId?._id ?? ''}</small></td>
                    <td className="rfd-mono">{r.paymentId?.razorpayPaymentId ?? r.paymentId?._id ?? 'ΓÇö'}</td>
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
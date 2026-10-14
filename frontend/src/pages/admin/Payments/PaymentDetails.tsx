import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertCircle, Check, Copy } from 'lucide-react';
import { PageHeader } from '@/components/admin/PageHeader';
import { fetchAdminPayment } from '@/services/adminPaymentApi';
import type { AdminPayment } from '@/types/adminPayment';
import StatusBadge from './StatusBadge';
import { REFUND_LABEL, formatDateTime, formatMoney, methodLabel } from './paymentFormat';
import './index.css';

const errorMessage = (e: unknown): string =>
  (e as { message?: string })?.message || 'Could not load this payment. Please try again.';

const initials = (name?: string): string =>
  (name ?? '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('') || '?';

/** Label + mono value + copy button, in one soft box. */
const IdBox: React.FC<{ label: string; value?: string | null }> = ({ label, value }) => {
  const [done, setDone] = useState(false);
  const copy = async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setDone(true);
      window.setTimeout(() => setDone(false), 1500);
    } catch {
      /* clipboard can be blocked; the id stays selectable */
    }
  };
  return (
    <div className="pdx-idbox">
      <span className="pdx-idbox__label">{label}</span>
      <div className="pdx-idbox__row">
        {value ? <code className="pdx-idbox__value">{value}</code> : <span className="pay-muted">Not generated yet</span>}
        {value && (
          <button type="button" className="pdx-copy" onClick={copy} aria-label={`Copy ${label}`} title={`Copy ${label}`}>
            {done ? <Check size={15} /> : <Copy size={15} />}
          </button>
        )}
      </div>
    </div>
  );
};

const Stat: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="pdx-stat">
    <span className="pdx-stat__label">{label}</span>
    <span className="pdx-stat__value">{children}</span>
  </div>
);

interface TimelineItem {
  key: string;
  title: string;
  at: string | null;
  note?: string;
  done: boolean;
}

const buildTimeline = (p: AdminPayment): TimelineItem[] => {
  const items: TimelineItem[] = [{ key: 'created', title: 'Payment created', at: p.createdAt, done: true }];

  if (p.status === 'FAILED') {
    items.push({ key: 'failed', title: 'Payment failed', at: p.updatedAt, done: true, note: p.errorReason || 'The gateway did not return a reason.' });
  } else if (p.paidAt || p.status === 'PAID' || p.status === 'REFUNDED') {
    items.push({ key: 'paid', title: 'Payment received', at: p.paidAt, done: true });
  } else {
    items.push({ key: 'await', title: 'Awaiting payment', at: null, done: false });
  }

  if (p.refund.status !== 'none') {
    items.push({
      key: 'refund',
      title: `Refund ${REFUND_LABEL[p.refund.status].toLowerCase()}`,
      at: p.refund.requestedAt,
      done: p.refund.status === 'processed',
      note: p.refund.amount != null ? formatMoney(p.refund.amount, p.currency) : undefined,
    });
  }
  return items;
};

export const AdminPaymentDetailsPage: React.FC = () => {
  const { id = '' } = useParams<{ id: string }>();
  const [payment, setPayment] = useState<AdminPayment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPayment(await fetchAdminPayment(id));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="admin-page-container pay-page">
        <PageHeader title="Payment" back="/admin/payments" />
        <div className="pdx-skeleton" />
        <div className="pdx-skeleton pdx-skeleton--tall" />
      </div>
    );
  }

  if (error || !payment) {
    return (
      <div className="admin-page-container pay-page">
        <PageHeader title="Payment" back="/admin/payments" />
        <div className="pay-card">
          <div className="pay-state pay-state--error" role="alert">
            <AlertCircle size={22} />
            <p>{error ?? 'Payment not found.'}</p>
            <div className="pay-state__actions">
              <button type="button" className="pay-btn" onClick={() => void load()}>Try again</button>
              <Link to="/admin/payments" className="pay-btn">Back to payments</Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const p = payment;
  const timeline = buildTimeline(p);

  return (
    <div className="admin-page-container pay-page">
      <PageHeader title={p.paymentRef} description={`Booking ${p.bookingRef}`} back="/admin/payments" />

      {/* Hero: the one number that matters, plus the quick facts */}
      <section className="pdx-hero" aria-label="Payment summary">
        <div className="pdx-hero__main">
          <span className="pdx-hero__label">Amount</span>
          <p className="pdx-hero__amount">{formatMoney(p.amount, p.currency)}</p>
          <StatusBadge status={p.status} />
        </div>
        <div className="pdx-hero__stats">
          <Stat label="Method">{methodLabel(p.method)}</Stat>
          <Stat label="Booking"><code className="pay-mono">{p.bookingRef}</code></Stat>
          <Stat label="Attempts">{p.attempts}</Stat>
          <Stat label="Created">{formatDateTime(p.createdAt)}</Stat>
        </div>
      </section>

      {p.status === 'FAILED' && (
        <p className="pay-alert" role="status">
          <strong>Why it failed:</strong> {p.errorReason || 'The gateway did not return a reason.'}
        </p>
      )}

      <div className="pdx-grid">
        {/* Details: one surface, sections split by hairlines */}
        <section className="pdx-panel">
          <div className="pdx-section">
            <h2 className="pdx-h">Razorpay</h2>
            <div className="pdx-ids">
              <IdBox label="Order ID" value={p.razorpayOrderId} />
              <IdBox label="Payment ID" value={p.razorpayPaymentId} />
            </div>
          </div>

          <div className="pdx-section">
            <h2 className="pdx-h">Customer</h2>
            <div className="pdx-person">
              <span className="pay-avatar pdx-person__avatar" aria-hidden>{initials(p.customer?.name)}</span>
              <div className="pdx-person__body">
                <strong>{p.customer?.name || 'Unknown customer'}</strong>
                {p.customer?.email && <span>{p.customer.email}</span>}
                {p.customer?.phone && <span>{p.customer.phone}</span>}
              </div>
            </div>
          </div>

          <div className="pdx-section">
            <h2 className="pdx-h">Refund</h2>
            {p.refund.status === 'none' ? (
              <p className="pay-muted pdx-none">No refund on this payment.</p>
            ) : (
              <div className="pdx-stats2">
                <Stat label="Status">{REFUND_LABEL[p.refund.status]}</Stat>
                {p.refund.amount != null && <Stat label="Amount">{formatMoney(p.refund.amount, p.currency)}</Stat>}
                {p.refund.requestedAt && <Stat label="Requested">{formatDateTime(p.refund.requestedAt)}</Stat>}
              </div>
            )}
          </div>
        </section>

        {/* Activity */}
        <aside className="pdx-panel" aria-label="Activity">
          <div className="pdx-section">
            <h2 className="pdx-h">Activity</h2>
            <ol className="pdx-timeline">
              {timeline.map((t) => (
                <li key={t.key} className={`pdx-tl${t.done ? ' is-done' : ''}`}>
                  <span className="pdx-tl__dot" aria-hidden />
                  <div className="pdx-tl__body">
                    <strong>{t.title}</strong>
                    {t.note && <span className="pdx-tl__note">{t.note}</span>}
                    <span className="pdx-tl__time">{t.at ? formatDateTime(t.at) : 'Not yet'}</span>
                  </div>
                </li>
              ))}
            </ol>
            <p className="pdx-updated">Last updated {formatDateTime(p.updatedAt)}</p>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default AdminPaymentDetailsPage;
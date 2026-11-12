import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, Clock3,
  Search, Undo2, X, XCircle,
} from 'lucide-react';
import { FilterButton, FilterPanel, type FilterField } from '@/components/admin/FilterPanel';
import { fetchAdminPayments } from '@/services/adminPaymentApi';
import { PAYMENT_STATUSES, type AdminPayment, type AdminPaymentsPage, type PaymentStatus } from '@/types/adminPayment';
import StatusBadge from './StatusBadge';
import ReferralMoney from './ReferralMoney';
import { METHOD_OPTIONS, STATUS_LABEL, formatDateTime, formatMoney, methodLabel } from './paymentFormat';
import './index.css';

const PAGE_SIZE = 15;

interface Filters {
  status: PaymentStatus | '';
  method: string;
  customer: string;
  booking: string;
  from: string;
  to: string;
}

const EMPTY: Filters = { status: '', method: '', customer: '', booking: '', from: '', to: '' };

const errorMessage = (e: unknown): string =>
  (e as { message?: string })?.message || 'Could not load payments. Please try again.';

const initials = (name?: string): string =>
  (name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('') || '?';

const shortDate = (v: string): string =>
  new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(new Date(`${v}T00:00:00`));

/** Chips shown under the toolbar for every applied filter (each removable). */
const describeFilters = (f: Filters): { key: keyof Filters | 'range'; label: string }[] => {
  const out: { key: keyof Filters | 'range'; label: string }[] = [];
  if (f.status) out.push({ key: 'status', label: STATUS_LABEL[f.status] });
  if (f.method) out.push({ key: 'method', label: methodLabel(f.method) });
  if (f.customer) out.push({ key: 'customer', label: `Customer: ${f.customer}` });
  if (f.booking) out.push({ key: 'booking', label: `Booking: ${f.booking}` });
  if (f.from || f.to) {
    out.push({
      key: 'range',
      label: `${f.from ? shortDate(f.from) : 'Start'} – ${f.to ? shortDate(f.to) : 'Today'}`,
    });
  }
  return out;
};

const FILTER_FIELDS: FilterField[] = [
  { key: 'status', label: 'Status', options: [{ value: '', label: 'All statuses' }, ...PAYMENT_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }))] },
  { key: 'method', label: 'Payment method', options: [{ value: '', label: 'All methods' }, ...METHOD_OPTIONS.map((m) => ({ value: m.value, label: m.label }))] },
  { key: 'from', label: 'From', type: 'date' },
  { key: 'to', label: 'To', type: 'date' },
  { key: 'customer', label: 'Customer', type: 'text', placeholder: 'Name, email, phone or ID' },
  { key: 'booking', label: 'Booking', type: 'text', placeholder: 'BK-1A2B3 or booking ID' },
];

const TOTALS = [
  { status: 'PAID', icon: CheckCircle2, label: 'Paid' },
  { status: 'PENDING', icon: Clock3, label: 'Pending' },
  { status: 'FAILED', icon: XCircle, label: 'Failed' },
  { status: 'REFUNDED', icon: Undo2, label: 'Refunded' },
] as const;

const PaymentsList: React.FC = () => {
  const [filters, setFilters] = useState<Filters>(EMPTY); // applied from the filter panel
  const [panelOpen, setPanelOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState(''); // debounced
  const [page, setPage] = useState(1);
  const [tick, setTick] = useState(0);
  const [data, setData] = useState<AdminPaymentsPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const latest = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const drag = useRef({ down: false, x: 0, left: 0, moved: false });

  // Ignore the click that follows a mouse drag-scroll so a row doesn't open by accident.
  const openPayment = (p: AdminPayment) => {
    if (drag.current.moved) return;
    navigate(`/admin/payments/${p.id}`);
  };


  useEffect(() => {
    const id = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(id);
  }, [searchInput]);

  const load = useCallback(async () => {
    const req = ++latest.current;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchAdminPayments({ ...filters, search, page, limit: PAGE_SIZE });
      if (req === latest.current) setData(result);
    } catch (e) {
      if (req === latest.current) setError(errorMessage(e));
    } finally {
      if (req === latest.current) setLoading(false);
    }
  }, [filters, search, page, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void load();
  }, [load]);

  const applied = describeFilters(filters);
  const hasAny = applied.length > 0 || !!search;
  const items = data?.items ?? [];
  const meta = data?.meta;
  const summary = meta?.summary;

  const applyPanel = (v: Record<string, string>) => {
    setFilters({
      status: (PAYMENT_STATUSES as readonly string[]).includes(v.status) ? (v.status as PaymentStatus) : '',
      method: v.method ?? '',
      customer: (v.customer ?? '').trim(),
      booking: (v.booking ?? '').trim(),
      from: v.from ?? '',
      to: v.to ?? '',
    });
    setPage(1);
  };
  const removeFilter = (key: keyof Filters | 'range') => {
    setFilters((f) => (key === 'range' ? { ...f, from: '', to: '' } : { ...f, [key]: '' }));
    setPage(1);
  };
  const clearAll = () => {
    setFilters(EMPTY);
    setSearchInput('');
    setSearch('');
    setPage(1);
  };

  // Mouse drag-to-scroll for the table (touch devices scroll natively)
  const onDragStart = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = scrollRef.current;
    if (!el) return;
    drag.current = { down: true, x: e.pageX, left: el.scrollLeft, moved: false };
  };
  const onDragMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const d = drag.current;
    const el = scrollRef.current;
    if (!d.down || !el) return;
    const dx = e.pageX - d.x;
    if (Math.abs(dx) > 5) d.moved = true;
    el.scrollLeft = d.left - dx;
  };
  const onDragEnd = () => {
    drag.current.down = false;
  };

  return (
    <div className="admin-page-container pay-page">
      <header className="pay-head">
        <div>
          <h1 className="pay-head__title">Payments</h1>
          <p className="pay-head__desc">Every customer payment. A payment shows Pending until the service is completed and the amount is credited, then it shows Paid.</p>
        </div>
      </header>

      {/* Totals for the current filters */}
      <section className="pay-totals" aria-label="Totals for current filters">
        {TOTALS.map(({ status, icon: Icon, label }) => (
          <div key={status} className={`pay-total pay-total--${status.toLowerCase()}`}>
            <span className="pay-total__icon"><Icon size={18} /></span>
            <div className="pay-total__body">
              <span className="pay-total__label">{label}</span>
              <strong className="pay-total__value">
                {summary ? (status === 'PAID' ? formatMoney(summary.PAID.amount) : summary[status].count) : '—'}
              </strong>
              <span className="pay-total__sub">
                {summary
                  ? status === 'PAID'
                    ? `${summary.PAID.count} payments`
                    : formatMoney(summary[status].amount)
                  : ' '}
              </span>
            </div>
          </div>
        ))}
      </section>

      {/* Toolbar: search + filter icon */}
      <div className="pay-toolbar">
        <label className="pay-search">
          <Search size={16} />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search Razorpay order or payment ID"
            spellCheck={false}
            aria-label="Search Razorpay IDs"
          />
          {searchInput && (
            <button type="button" className="pay-search__clear" onClick={() => setSearchInput('')} aria-label="Clear search">
              <X size={14} />
            </button>
          )}
        </label>

        <FilterButton count={applied.length} open={panelOpen} onClick={() => setPanelOpen((o) => !o)} />
      </div>

      <FilterPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        fields={FILTER_FIELDS}
        values={{ ...filters }}
        onApply={applyPanel}
      />

      {/* Applied filter chips */}
      {hasAny && (
        <div className="pay-applied" aria-label="Applied filters">
          {applied.map((a) => (
            <span key={a.key} className="pay-tag">
              {a.label}
              <button type="button" onClick={() => removeFilter(a.key)} aria-label={`Remove ${a.label}`}><X size={12} /></button>
            </span>
          ))}
          <button type="button" className="pay-linkbtn" onClick={clearAll}>Clear all</button>
        </div>
      )}

      {/* Table */}
      <section className="pay-card" aria-busy={loading}>
        {error ? (
          <div className="pay-state pay-state--error" role="alert">
            <AlertCircle size={22} />
            <p>{error}</p>
            <button type="button" className="pay-btn" onClick={() => setTick((t) => t + 1)}>Try again</button>
          </div>
        ) : (
          <>
            <div
              className="pay-scroll"
              ref={scrollRef}
              onMouseDown={onDragStart}
              onMouseMove={onDragMove}
              onMouseUp={onDragEnd}
              onMouseLeave={onDragEnd}
            >
              <table className="pay-table">
                <thead>
                  <tr>
                    <th>Payment</th>
                    <th>Customer</th>
                    <th>Booking</th>
                    <th className="pay-num">Amount</th>
                    <th>Method</th>
                    <th>Status</th>
                    <th>Razorpay IDs</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && !data
                    ? Array.from({ length: 6 }, (_, i) => (
                        <tr key={i} className="pay-skeleton">
                          {Array.from({ length: 8 }, (_, j) => (
                            <td key={j}><span /></td>
                          ))}
                        </tr>
                      ))
                    : items.map((p) => (
                        <tr
                          key={p.id}
                          className={`pay-row pay-row--${p.status.toLowerCase()}`}
                          tabIndex={0}
                          onClick={() => openPayment(p)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              openPayment(p);
                            }
                          }}
                          aria-label={`Open payment ${p.paymentRef}`}
                        >
                          <td><code className="pay-mono pay-strong">{p.paymentRef}</code></td>
                          <td>
                            <div className="pay-person">
                              <span className="pay-avatar" aria-hidden>{initials(p.customer?.name)}</span>
                              <div>
                                <span className="pay-person__name" title={p.customer?.name || undefined}>{p.customer?.name || <span className="pay-muted">Unknown</span>}</span>
                                {p.customer?.email && <span className="pay-sub">{p.customer.email}</span>}
                              </div>
                            </div>
                          </td>
                          <td><code className="pay-mono">{p.bookingRef}</code></td>
                          <td className="pay-num pay-amount">{formatMoney(p.amount, p.currency)}</td>
                          <td><span className="pay-method">{methodLabel(p.method)}</span></td>
                          <td>
                            <span title={p.customerPaid && p.status === 'PENDING' ? 'Customer has paid. Shows Paid once the service is completed and the amount is credited.' : undefined}>
                              <StatusBadge status={p.status} />
                            </span>
                          </td>
                          <td>
                            <code className="pay-mono pay-clip" title={p.razorpayOrderId}>{p.razorpayOrderId}</code>
                            <code className="pay-mono pay-clip pay-sub" title={p.razorpayPaymentId ?? ''}>
                              {p.razorpayPaymentId ?? 'no payment ID yet'}
                            </code>
                          </td>
                          <td className="pay-nowrap">{formatDateTime(p.createdAt)}</td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>

            {!loading && items.length === 0 && (
              <div className="pay-state">
                <p className="pay-state__title">{hasAny ? 'No payments match these filters' : 'No payments yet'}</p>
                <p className="pay-muted">
                  {hasAny
                    ? 'Try widening the date range or clearing a filter.'
                    : 'Payments appear here once customers start checking out.'}
                </p>
                {hasAny && <button type="button" className="pay-btn" onClick={clearAll}>Clear filters</button>}
              </div>
            )}
          </>
        )}

        {meta && meta.total > 0 && (
          <footer className="pay-pager">
            <span className="pay-muted">
              Showing {(meta.page - 1) * meta.limit + 1}–{Math.min(meta.page * meta.limit, meta.total)} of {meta.total}
            </span>
            <div className="pay-pager__btns">
              <button type="button" className="pay-btn" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft size={15} /> Prev
              </button>
              <span className="pay-muted">{meta.page} / {meta.pages}</span>
              <button type="button" className="pay-btn" disabled={page >= meta.pages || loading} onClick={() => setPage((p) => p + 1)}>
                Next <ChevronRight size={15} />
              </button>
            </div>
          </footer>
        )}
      </section>
    </div>
  );
};

/** Payments page: the payments list, plus a "Referral money" tab (who got referral credit, referral discounts used). */
export const AdminPaymentsPageView: React.FC = () => {
  const [view, setView] = useState<'payments' | 'referrals'>('payments');
  return (
    <>
      <div className="pay-tabs" role="tablist" aria-label="Payments sections">
        <button type="button" role="tab" aria-selected={view === 'payments'} className={`pay-tab${view === 'payments' ? ' is-selected' : ''}`} onClick={() => setView('payments')}>
          Payments
        </button>
        <button type="button" role="tab" aria-selected={view === 'referrals'} className={`pay-tab${view === 'referrals' ? ' is-selected' : ''}`} onClick={() => setView('referrals')}>
          Referral money
        </button>
      </div>
      {view === 'payments' ? <PaymentsList /> : <ReferralMoney />}
    </>
  );
};

export { AdminPaymentsPageView as AdminPaymentsPage };
export default AdminPaymentsPageView;
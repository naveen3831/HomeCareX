import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, Clock3, ListFilter,
  Search, Undo2, X, XCircle,
} from 'lucide-react';
import { useOverlay } from '@/hooks/useOverlay';
import { fetchAdminPayments } from '@/services/adminPaymentApi';
import { PAYMENT_STATUSES, type AdminPayment, type AdminPaymentsPage, type PaymentStatus } from '@/types/adminPayment';
import StatusBadge from './StatusBadge';
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

const TOTALS = [
  { status: 'PAID', icon: CheckCircle2, label: 'Collected' },
  { status: 'PENDING', icon: Clock3, label: 'Pending' },
  { status: 'FAILED', icon: XCircle, label: 'Failed' },
  { status: 'REFUNDED', icon: Undo2, label: 'Refunded' },
] as const;

export const AdminPaymentsPageView: React.FC = () => {
  const [filters, setFilters] = useState<Filters>(EMPTY); // applied from the filter panel
  const [panel, setPanel] = useState<Filters>(EMPTY); // draft inside the panel
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

  const closePanel = () => setPanelOpen(false);
  const sheetRef = useOverlay<HTMLDivElement>(panelOpen, closePanel); // Esc, scroll lock, focus trap

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

  const openPanel = () => {
    setPanel(filters);
    setPanelOpen(true);
  };
  const draftCount = describeFilters(panel).length;
  const apply = () => {
    setFilters(panel);
    setPage(1);
    setPanelOpen(false);
  };
  const removeFilter = (key: keyof Filters | 'range') => {
    setFilters((f) => (key === 'range' ? { ...f, from: '', to: '' } : { ...f, [key]: '' }));
    setPage(1);
  };
  const clearAll = () => {
    setFilters(EMPTY);
    setPanel(EMPTY);
    setSearchInput('');
    setSearch('');
    setPage(1);
  };
  const setP = <K extends keyof Filters>(key: K, value: Filters[K]) => setPanel((p) => ({ ...p, [key]: value }));

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
          <p className="pay-head__desc">Every Razorpay checkout attempt, read-only.</p>
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

        <button
          type="button"
          className={`pay-btn pay-btn--filter${applied.length ? ' is-active' : ''}`}
          onClick={openPanel}
          aria-expanded={panelOpen}
          aria-haspopup="dialog"
        >
          <ListFilter size={16} />
          <span>Filters</span>
          {applied.length > 0 && <span className="pay-count">{applied.length}</span>}
        </button>
      </div>

      {panelOpen &&
        createPortal(
          <div className="pay-sheet-overlay" onMouseDown={(e) => e.target === e.currentTarget && closePanel()}>
            <div ref={sheetRef} className="pay-sheet" role="dialog" aria-modal="true" aria-label="Filter payments" tabIndex={-1}>
              <header className="pay-sheet__head">
                <div>
                  <h2 className="pay-sheet__title">Filters</h2>
                  <p className="pay-sheet__sub" aria-live="polite">
                    {draftCount === 0 ? 'No filters applied' : `${draftCount} ${draftCount === 1 ? 'filter' : 'filters'} selected`}
                  </p>
                </div>
                <div className="pay-sheet__actions">
                  {draftCount > 0 && (
                    <button type="button" className="pay-sheet__clear" onClick={() => setPanel(EMPTY)}>Clear all</button>
                  )}
                  <button type="button" className="pay-sheet__close" onClick={closePanel} aria-label="Close filters">
                    <X size={20} />
                  </button>
                </div>
              </header>

              <div className="pay-sheet__body">
                <fieldset className="pay-group">
                  <legend>Status</legend>
                  <div className="pay-chips">
                    {(['', ...PAYMENT_STATUSES] as const).map((s) => (
                      <button
                        key={s || 'all'}
                        type="button"
                        className={`pay-chip${panel.status === s ? ' is-active' : ''}`}
                        aria-pressed={panel.status === s}
                        onClick={() => setP('status', s)}
                      >
                        {s ? STATUS_LABEL[s] : 'All'}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <fieldset className="pay-group">
                  <legend>Payment method</legend>
                  <div className="pay-chips">
                    <button type="button" className={`pay-chip${panel.method === '' ? ' is-active' : ''}`} aria-pressed={panel.method === ''} onClick={() => setP('method', '')}>
                      All
                    </button>
                    {METHOD_OPTIONS.map((m) => (
                      <button
                        key={m.value}
                        type="button"
                        className={`pay-chip${panel.method === m.value ? ' is-active' : ''}`}
                        aria-pressed={panel.method === m.value}
                        onClick={() => setP('method', m.value)}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <div className="pay-row2">
                  <label className="pay-field">
                    <span>From</span>
                    <input type="date" value={panel.from} max={panel.to || undefined} onChange={(e) => setP('from', e.target.value)} />
                  </label>
                  <label className="pay-field">
                    <span>To</span>
                    <input type="date" value={panel.to} min={panel.from || undefined} onChange={(e) => setP('to', e.target.value)} />
                  </label>
                </div>

                <label className="pay-field">
                  <span>Customer</span>
                  <input value={panel.customer} onChange={(e) => setP('customer', e.target.value)} placeholder="Name, email, phone or ID" />
                </label>

                <label className="pay-field">
                  <span>Booking</span>
                  <input value={panel.booking} onChange={(e) => setP('booking', e.target.value)} placeholder="BK-1A2B3 or booking ID" spellCheck={false} />
                </label>
              </div>

              <footer className="pay-sheet__foot">
                <button type="button" className="pay-sheet__cta" onClick={apply}>Apply filters</button>
              </footer>
            </div>
          </div>,
          document.body,
        )}

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
                                <span className="pay-person__name">{p.customer?.name || <span className="pay-muted">Unknown</span>}</span>
                                {p.customer?.email && <span className="pay-sub">{p.customer.email}</span>}
                              </div>
                            </div>
                          </td>
                          <td><code className="pay-mono">{p.bookingRef}</code></td>
                          <td className="pay-num pay-amount">{formatMoney(p.amount, p.currency)}</td>
                          <td><span className="pay-method">{methodLabel(p.method)}</span></td>
                          <td><StatusBadge status={p.status} /></td>
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

export { AdminPaymentsPageView as AdminPaymentsPage };
export default AdminPaymentsPageView;
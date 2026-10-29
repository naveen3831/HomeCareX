import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  BarChart3,
  CalendarCheck,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Headset,
  MapPin,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  UserCheck,
  Users,
  Wallet,
  X,
  XCircle,
} from 'lucide-react';
import {
  ALL_CITIES,
  CITIES,
  dashboardApi,
  dayDiff,
  toISO,
  type DashboardFilters,
  type FunnelStep,
  type Kpi,
  type Point,
  type SnapshotItem,
} from '@/services/dashboardApi';
import { NotificationBell } from '@/components/admin/NotificationBell';
import { adminBookingApi } from '@/services/adminBookingApi';
import type { AdminBooking, BookingFilters, BookingStatus } from '@/types/adminBooking';
import { useAuthStore } from '@/store/useAuthStore';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { BookingsChart, CategoryChart, FunnelChart, RevenueChart } from './charts';
import './dashboard.css';

// ---------- formatting ----------
const inr = (n: number) =>
  n >= 1e7 ? `₹${(n / 1e7).toFixed(2)} Cr` : n >= 1e5 ? `₹${(n / 1e5).toFixed(2)} L` : `₹${Math.round(n).toLocaleString('en-IN')}`;
/** Short form for chart axes so labels never crowd the plot on a phone. */
const inrAxis = (n: number) =>
  n >= 1e7 ? `₹${+(n / 1e7).toFixed(1)}Cr` : n >= 1e5 ? `₹${+(n / 1e5).toFixed(1)}L` : n >= 1e3 ? `₹${+(n / 1e3).toFixed(0)}k` : `₹${Math.round(n)}`;
const num = (n: number) => Math.round(n).toLocaleString('en-IN');
const numAxis = (n: number) => (n >= 1e5 ? `${+(n / 1e5).toFixed(1)}L` : n >= 1e3 ? `${+(n / 1e3).toFixed(1)}k` : `${Math.round(n)}`);
const shortDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

// ---------- widget state hook ----------
function useWidget<T>(loader: () => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<{ data: T | null; loading: boolean; error: boolean }>({
    data: null,
    loading: true,
    error: false,
  });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: false }));
    loader()
      .then((data) => alive && setState({ data, loading: false, error: false }))
      .catch(() => alive && setState({ data: null, loading: false, error: true }));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { ...state, reload: () => setTick((t) => t + 1) };
}
type WidgetState<T> = ReturnType<typeof useWidget<T>>;

// ---------- shared widget shell (loading / error / content) ----------
function Widget<T>({
  title,
  state,
  children,
  className = '',
  to,
}: {
  title: string;
  state: WidgetState<T>;
  children: (data: T) => React.ReactNode;
  className?: string;
  /** Page this card opens; shown as a chevron in the header on phones. */
  to?: string;
}) {
  return (
    <section className={`dash-card ${className}`}>
      <div className="dash-card__head">
        <h2 className="dash-card__title">{title}</h2>
        {to && (
          <Link to={to} className="dash-card__go" aria-label={`Open ${title}`}>
            <ChevronRight size={20} aria-hidden="true" />
          </Link>
        )}
      </div>
      {state.loading && !state.data ? (
        <div className="dash-skeleton" aria-busy="true" />
      ) : state.error ? (
        <div className="dash-error" role="alert">
          <AlertTriangle size={18} />
          <p>Couldn’t load {title.toLowerCase()}.</p>
          <button type="button" onClick={state.reload}>
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      ) : (
        state.data !== null && children(state.data)
      )}
    </section>
  );
}

// ---------- GMV sparkline (phone hero card) ----------
function Sparkline({ points }: { points: Point[] }) {
  if (points.length < 2) return null;
  const W = 120;
  const H = 48;
  const PAD = 4;
  const vals = points.map((p) => p.value);
  const min = Math.min(...vals);
  const range = Math.max(...vals) - min || 1;
  const xy = vals.map((v, i) => [(i / (vals.length - 1)) * W, H - PAD - ((v - min) / range) * (H - PAD * 2)]);
  let d = `M${xy[0][0]},${xy[0][1]}`;
  for (let i = 1; i < xy.length; i += 1) {
    const [x0, y0] = xy[i - 1];
    const [x1, y1] = xy[i];
    const cx = (x0 + x1) / 2;
    d += ` C${cx},${y0} ${cx},${y1} ${x1},${y1}`;
  }
  return (
    <svg className="dash-spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="dashSparkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={`${d} L${W},${H} L0,${H} Z`} fill="url(#dashSparkFill)" />
      <path d={d} className="dash-spark__line" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

// ---------- KPI card ----------
function KpiCard({
  label,
  icon: Icon,
  state,
  format,
  to,
  note,
  invertDelta,
  hero,
  tint = 'indigo',
  spark,
}: {
  label: string;
  icon: React.ElementType;
  state: WidgetState<Kpi>;
  format: (n: number) => string;
  to: string;
  note?: string;
  invertDelta?: boolean;
  hero?: boolean;
  /** Icon-tile colour on phones. */
  tint?: 'indigo' | 'blue' | 'violet' | 'green' | 'orange';
  /** Hero only: points for the sparkline drawn on phones. */
  spark?: Point[] | null;
}) {
  const cls = `dash-stat dash-stat--${tint}${hero ? ' dash-stat--hero' : ''}`;
  const body = (
    <>
      <div className="dash-stat__top">
        <span className="dash-stat__icon">
          <Icon size={16} />
        </span>
        <span className="dash-stat__label">{label}</span>
        <ChevronRight size={18} className="dash-stat__chev" aria-hidden="true" />
      </div>
      {state.error ? (
        <>
          <p className="dash-stat__value">—</p>
          <button
            type="button"
            className="dash-retry"
            onClick={(e) => {
              e.preventDefault();
              state.reload();
            }}
          >
            <RefreshCw size={12} /> Retry
          </button>
        </>
      ) : state.data ? (
        <>
          <p className="dash-stat__value">{format(state.data.value)}</p>
          {state.data.deltaPct === 0 ? (
            <p className="dash-stat__delta dash-stat__delta--muted">
              <em>No change</em>
              <span>{hero ? 'vs previous period' : 'vs previous'}</span>
            </p>
          ) : state.data.deltaPct !== null ? (
            <p
              className={`dash-stat__delta ${
                (state.data.deltaPct >= 0) !== Boolean(invertDelta) ? 'is-good' : 'is-bad'
              }`}
            >
              <b>
                {state.data.deltaPct >= 0 ? '▲' : '▼'} {Math.abs(state.data.deltaPct).toFixed(1)}%
              </b>
              <span>{hero ? 'vs previous period' : 'vs previous'}</span>
            </p>
          ) : (
            <p className="dash-stat__delta dash-stat__delta--muted">{note}</p>
          )}
        </>
      ) : (
        <div className="dash-skeleton dash-skeleton--kpi" aria-busy="true" />
      )}
    </>
  );
  return (
    <Link to={to} className={`${cls} dash-stat--link`} aria-label={`${label}: open page`}>
      {body}
      {hero && spark ? <Sparkline points={spark} /> : null}
    </Link>
  );
}

// ---------- operational snapshot ----------
const SNAP_ICONS: Record<string, React.ElementType> = {
  approvals: ShieldCheck,
  tickets: Headset,
  payouts: Wallet,
  refunds: RotateCcw,
};

function SnapshotTile({ item }: { item: SnapshotItem }) {
  const Icon = SNAP_ICONS[item.key] ?? ShieldCheck;
  const alert = item.alert && item.value > 0;
  return (
    <Link
      to={item.to}
      className={`dash-tile dash-tile--${item.key}${alert ? ' is-alert' : item.value > 0 ? ' has-count' : ''}`}
    >
      <span className="dash-tile__icon">
        <Icon size={18} />
      </span>
      <span className="dash-tile__text">
        <span className="dash-tile__label">{item.label}</span>
        {item.amount !== undefined && item.value > 0 && <small>{inr(item.amount)} waiting</small>}
      </span>
      <strong className="dash-tile__count">{item.value}</strong>
      <ChevronRight size={16} className="dash-tile__chev" aria-hidden="true" />
    </Link>
  );
}

// ---------- active bookings (first 5, inside "Needs attention") ----------
const ACTIVE_STATUSES: BookingStatus[] = [
  'created',
  'searching_for_partner',
  'assigned',
  'en_route',
  'arrived',
  'in_progress',
];
const ACTIVE_LIMIT = 5;
const NO_FILTERS: BookingFilters = {
  search: '',
  status: '',
  city: '',
  category: '',
  customer: '',
  partner: '',
  date: '',
  paymentStatus: '',
};
const STATUS_LABEL: Record<string, string> = {
  created: 'Pending',
  searching_for_partner: 'Finding partner',
  assigned: 'Assigned',
  en_route: 'En route',
  arrived: 'Arrived',
  in_progress: 'In progress',
};

type ActiveBookings = { total: number; items: AdminBooking[] };

async function loadActiveBookings(city: string): Promise<ActiveBookings> {
  const all = await adminBookingApi.getBookings({ ...NO_FILTERS, city: city === ALL_CITIES ? '' : city });
  const active = all.filter((b) => ACTIVE_STATUSES.includes(b.status));
  return { total: active.length, items: active.slice(0, ACTIVE_LIMIT) };
}

function ActiveBookingsList({ state }: { state: WidgetState<ActiveBookings> }) {
  const [open, setOpen] = useState(false);
  const count = state.error ? '—' : state.data ? String(state.data.total) : '…';

  return (
    <div className="dash-active">
      {/* One card: tap it to show the first 5 active bookings; "View all" opens the Bookings page. */}
      <div className={`dash-active__card${open ? ' is-open' : ''}`}>
        <button
          type="button"
          className="dash-active__toggle"
          aria-expanded={open}
          aria-controls="dash-active-list"
          onClick={() => setOpen((v) => !v)}
        >
          <span className="dash-tile__icon">
            <CalendarCheck size={18} />
          </span>
          <span className="dash-tile__text">
            <span className="dash-tile__label">Active bookings</span>
          </span>
          <strong className="dash-tile__count">{count}</strong>
          <ChevronDown size={16} className="dash-active__chev" aria-hidden="true" />
        </button>
        <Link to="/admin/bookings" className="dash-active__all">
          View all
        </Link>
      </div>

      {open && (
        <div id="dash-active-list" className="dash-active__panel">
          {state.loading && !state.data ? (
            <div className="dash-skeleton" aria-busy="true" />
          ) : state.error ? (
            <div className="dash-error" role="alert">
              <AlertTriangle size={18} />
              <p>Couldn’t load active bookings.</p>
              <button type="button" onClick={state.reload}>
                <RefreshCw size={14} /> Retry
              </button>
            </div>
          ) : !state.data || state.data.items.length === 0 ? (
            <p className="dash-active__empty">No active bookings right now.</p>
          ) : (
            <ul className="dash-active__list">
              {state.data.items.map((b) => (
                <li key={b.id}>
                  <Link to={`/admin/bookings?open=${encodeURIComponent(b.id)}`} className="dash-active__row">
                    <span className="dash-active__text">
                      <span className="dash-active__name">{b.customer?.name || 'Customer'}</span>
                      <small>
                        {b.service?.name || 'Service'}
                        {b.slot?.date ? ` · ${shortDate(b.slot.date.slice(0, 10))}` : ''}
                      </small>
                    </span>
                    <span className={`dash-active__status dash-active__status--${b.status}`}>
                      {STATUS_LABEL[b.status] ?? b.status}
                    </span>
                    <ChevronRight size={16} className="dash-tile__chev" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- filters ----------
type Preset = 'today' | '7d' | '30d' | '90d' | 'custom';
type Range = { from: string; to: string };
const PRESETS: { key: Preset; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: 'Last 7 days' },
  { key: '30d', label: 'Last 30 days' },
  { key: '90d', label: 'Last 90 days' },
  { key: 'custom', label: 'Custom' },
];

/** What the dashboard shows on load and after Reset. */
const DEFAULT_PRESET: Exclude<Preset, 'custom'> = 'today';

function rangeFor(preset: Exclude<Preset, 'custom'>): Range {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - ({ today: 0, '7d': 6, '30d': 29, '90d': 89 } as const)[preset]);
  return { from: toISO(from), to: toISO(to) };
}

function validateRange(preset: Preset, custom: Range): string {
  if (preset !== 'custom') return '';
  if (!custom.from || !custom.to) return 'Pick both dates.';
  if (custom.from > custom.to) return 'Start date must be before end date.';
  if (dayDiff(custom.from, custom.to) > 365) return 'Range can be at most 1 year.';
  return '';
}

/** Bottom sheet used on phones. Edits a draft; nothing changes on the dashboard until Apply. */
function FilterSheet({
  initial,
  onApply,
  onClose,
}: {
  initial: { preset: Preset; custom: Range; city: string };
  onApply: (v: { preset: Preset; custom: Range; city: string }) => void;
  onClose: () => void;
}) {
  const [preset, setPreset] = useState(initial.preset);
  const [custom, setCustom] = useState(initial.custom);
  const [city, setCity] = useState(initial.city);
  const dialogRef = useRef<HTMLDivElement>(null);
  const error = validateRange(preset, custom);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return onClose();
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const f = dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input, [tabindex="0"]');
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div className="dash-sheet-root">
      <div className="dash-sheet-backdrop" onClick={onClose} />
      <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Filters" className="dash-sheet">
        <div className="dash-sheet__grab" aria-hidden="true" />
        <div className="dash-sheet__head">
          <h2>Filters</h2>
          <button type="button" className="dash-icon-btn" onClick={onClose} aria-label="Close filters">
            <X size={18} />
          </button>
        </div>

        <div className="dash-sheet__body">
          <p className="dash-sheet__label">Date range</p>
          <div className="dash-chipgrid" role="group" aria-label="Date range">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                className={preset === p.key ? 'is-active' : ''}
                aria-pressed={preset === p.key}
                onClick={() => setPreset(p.key)}
              >
                {p.label}
              </button>
            ))}
          </div>

          {preset === 'custom' && (
            <div className="dash-sheet__dates">
              <label>
                <span>From</span>
                <input
                  type="date"
                  value={custom.from}
                  max={custom.to || undefined}
                  onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))}
                />
              </label>
              <label>
                <span>To</span>
                <input
                  type="date"
                  value={custom.to}
                  min={custom.from || undefined}
                  onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))}
                />
              </label>
              {error && (
                <p className="dash-inline-error" role="alert">
                  <XCircle size={14} /> {error}
                </p>
              )}
            </div>
          )}

          <p className="dash-sheet__label">City</p>
          <div className="dash-chipgrid" role="radiogroup" aria-label="City">
            {CITIES.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={city === c}
                className={city === c ? 'is-active' : ''}
                onClick={() => setCity(c)}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="dash-sheet__foot">
          <button
            type="button"
            className="dash-btn dash-btn--ghost"
            onClick={() => {
              setPreset(DEFAULT_PRESET);
              setCustom(rangeFor(DEFAULT_PRESET));
              setCity(ALL_CITIES);
            }}
          >
            Reset
          </button>
          <button
            type="button"
            className="dash-btn dash-btn--primary"
            disabled={Boolean(error)}
            onClick={() => onApply({ preset, custom, city })}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- page ----------
export const AdminDashboardPage: React.FC = () => {
  const [params] = useSearchParams();
  const userName = useAuthStore((s) => s.user?.name as string | undefined);
  const firstName = userName?.trim().split(/\s+/)[0] || 'Admin';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const isPhone = useMediaQuery('(max-width: 640px)');
  // Demo of partial failure: /admin?fail=revenue,funnel  (keys: gmv, bookings, cancellation, customers,
  // partners, snapshot, revenue, bookingChart, category, funnel)
  const failKey = params.get('fail') ?? '';
  const fail = useMemo(() => (failKey ? failKey.split(',') : []), [failKey]);

  const [preset, setPreset] = useState<Preset>(DEFAULT_PRESET);
  const [custom, setCustom] = useState<Range>(() => rangeFor(DEFAULT_PRESET));
  const [city, setCity] = useState(ALL_CITIES);
  const [sheetOpen, setSheetOpen] = useState(false);
  const chipRef = useRef<HTMLButtonElement>(null);

  const customError = validateRange(preset, custom);

  // Keep showing the last valid range while the custom dates are invalid.
  const lastValid = useRef(rangeFor(DEFAULT_PRESET));
  if (preset !== 'custom') lastValid.current = rangeFor(preset);
  else if (!customError) lastValid.current = custom;

  const filters: DashboardFilters = useMemo(
    () => ({ from: lastValid.current.from, to: lastValid.current.to, city }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [preset, custom.from, custom.to, customError, city],
  );
  const deps = [filters.from, filters.to, filters.city, failKey];

  const gmv = useWidget(() => dashboardApi.gmv(filters, fail), deps);
  const bookings = useWidget(() => dashboardApi.bookings(filters, fail), deps);
  const cancellation = useWidget(() => dashboardApi.cancellation(filters, fail), deps);
  const customers = useWidget(() => dashboardApi.customers(filters, fail), deps);
  const partners = useWidget(() => dashboardApi.partners(filters, fail), deps);
  const snapshot = useWidget(() => dashboardApi.snapshot(filters, fail), deps);
  const activeBookings = useWidget(() => loadActiveBookings(filters.city), [filters.city, failKey]);
  const revenue = useWidget(() => dashboardApi.revenueSeries(filters, fail), deps);
  const bookingChart = useWidget(() => dashboardApi.bookingSeries(filters, fail), deps);
  const category = useWidget(() => dashboardApi.categories(filters, fail), deps);
  const funnel = useWidget(() => dashboardApi.funnel(filters, fail), deps);

  // GMV sparkline: always the last 7 days, so a one-day range (Today) still shows a trend line.
  const sparkRange = useMemo(() => rangeFor('7d'), []);
  const spark = useWidget(
    () => dashboardApi.revenueSeries({ from: sparkRange.from, to: sparkRange.to, city }, []),
    [sparkRange.from, sparkRange.to, city],
  );

  const all = [gmv, bookings, cancellation, customers, partners, snapshot, revenue, bookingChart, category, funnel];
  const failed = all.filter((w) => w.error).length;
 

  const presetLabel = PRESETS.find((p) => p.key === preset)?.label ?? '';
  const rangeLabel =
    filters.from === filters.to ? shortDate(filters.from) : `${shortDate(filters.from)} – ${shortDate(filters.to)}`;
  const chipLabel = preset === 'custom' ? rangeLabel : presetLabel;

  const closeSheet = () => {
    setSheetOpen(false);
    chipRef.current?.focus();
  };

  return (
    <div className="admin-page-container p-6 dash">
      <div className="dash-head">
        <div className="dash-head__row">
          <h1 className="text-2xl font-bold dash-head__title">Admin Dashboard</h1>

          {/* phones and tablets: greeting + bell (the top bar is hidden on this page) */}
          <div className="dash-mhead">
            <div className="dash-mhead__text">
              <h1>Dashboard</h1>
              <p>
                {greeting}, {firstName} <span aria-hidden="true">👋</span>
              </p>
            </div>
            <div className="dash-mhead__actions">
              <NotificationBell />
            </div>
          </div>
        </div>

        {/* desktop / tablet: inline controls */}
        <div className="dash-filters dash-filters--inline">
          <div className="dash-seg" role="group" aria-label="Date range">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                className={preset === p.key ? 'is-active' : ''}
                aria-pressed={preset === p.key}
                onClick={() => setPreset(p.key)}
              >
                {p.label}
              </button>
            ))}
          </div>

          {preset === 'custom' && (
            <div className="dash-custom">
              <input
                type="date"
                aria-label="Start date"
                value={custom.from}
                max={custom.to || undefined}
                onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))}
              />
              <span>to</span>
              <input
                type="date"
                aria-label="End date"
                value={custom.to}
                min={custom.from || undefined}
                onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))}
              />
            </div>
          )}

          <select value={city} onChange={(e) => setCity(e.target.value)} aria-label="City" className="dash-city">
            {CITIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* phone: two compact chips that open the filter sheet */}
        <div className="dash-chips">
          <button
            ref={chipRef}
            type="button"
            className="dash-chip"
            onClick={() => setSheetOpen(true)}
            aria-haspopup="dialog"
            aria-label={`Date range: ${chipLabel}. Change filters`}
          >
            <CalendarDays size={16} />
            <span>{chipLabel}</span>
            <ChevronDown size={14} />
          </button>
          <button
            type="button"
            className="dash-chip"
            onClick={() => setSheetOpen(true)}
            aria-haspopup="dialog"
            aria-label={`City: ${city}. Change filters`}
          >
            <MapPin size={16} />
            <span>{city}</span>
            <ChevronDown size={14} />
          </button>
        </div>
        <p className="dash-range">
          {rangeLabel} · compared with the {dayDiff(filters.from, filters.to) + 1}-day period before
        </p>
      </div>

      {customError && (
        <p className="dash-inline-error dash-inline-error--page" role="alert">
          <XCircle size={14} /> {customError} Showing {filters.from} to {filters.to}.
        </p>
      )}
      {failed > 0 && (
        <p className="dash-banner" role="status">
          <AlertTriangle size={14} /> {failed} {failed === 1 ? 'widget' : 'widgets'} couldn’t load. The rest of the
          dashboard is still up to date.
        </p>
      )}

      <div className="dash-stats">
        <KpiCard
          hero
          tint="indigo"
          label="Payments"
          icon={BarChart3}
          state={gmv}
          format={inr}
          to="/admin/payments"
          spark={spark.data}
        />
        <KpiCard label="Bookings" tint="blue" icon={CalendarCheck} state={bookings} format={num} to="/admin/bookings" />
        <KpiCard
          label="Active customers"
          tint="violet"
          icon={Users}
          state={customers}
          format={num}
          to="/admin/customers"
          note="Not date-filtered"
        />
        <KpiCard
          label="Active partners"
          tint="green"
          icon={UserCheck}
          state={partners}
          format={num}
          to="/admin/manage-partners"
          note="Not date-filtered"
        />
        <KpiCard
          label="Cancellation rate"
          tint="orange"
          icon={XCircle}
          state={cancellation}
          format={(n) => `${n.toFixed(1)}%`}
          to="/admin/bookings"
          invertDelta
        />
      </div>

      <Widget title="Needs attention" state={snapshot} className="dash-snapshot-card">
        {(items: SnapshotItem[]) => (
          <>
            <ActiveBookingsList state={activeBookings} />
            <div className="dash-snapshot">
              {items.map((it) => (
                <SnapshotTile key={it.key} item={it} />
              ))}
            </div>
          </>
        )}
      </Widget>

      <div className="dash-charts">
        <Widget title="Revenue" state={revenue} to="/admin/reports">
          {(pts: Point[]) => <RevenueChart points={pts} fmt={inr} axisFmt={inrAxis} compact={isPhone} />}
        </Widget>
        <Widget title="Bookings" state={bookingChart} to="/admin/bookings">
          {(pts: Point[]) => <BookingsChart points={pts} fmt={num} axisFmt={numAxis} />}
        </Widget>
        <Widget title="Bookings by category" state={category}>
          {(rows: Point[]) => <CategoryChart rows={rows} fmt={num} />}
        </Widget>
        <Widget title="Booking funnel" state={funnel}>
          {(steps: FunnelStep[]) => <FunnelChart steps={steps} fmt={num} />}
        </Widget>
      </div>

      {sheetOpen && (
        <FilterSheet
          initial={{ preset, custom, city }}
          onClose={closeSheet}
          onApply={(v) => {
            setPreset(v.preset);
            setCustom(v.custom);
            setCity(v.city);
            closeSheet();
          }}
        />
      )}
    </div>
  );
};

export default AdminDashboardPage;
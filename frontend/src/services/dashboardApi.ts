import http, { type ApiResponse } from '@/lib/http';

export interface DashboardFilters {
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
  city: string;
}

export const ALL_CITIES = 'All cities';
export const CITIES = [ALL_CITIES, 'Hyderabad', 'Bengaluru', 'Mumbai', 'Delhi', 'Chennai'];

export interface Kpi {
  value: number;
  /** % change vs the previous period of equal length; null when it cannot be computed. */
  deltaPct: number | null;
}
export interface Point {
  label: string;
  value: number;
}
export interface SnapshotItem {
  key: string;
  label: string;
  value: number;
  to: string;
  /** Highlight in red when value > 0. */
  alert?: boolean;
  /** Optional ₹ amount sitting in the queue (payouts, refunds). */
  amount?: number;
}
export interface FunnelStep {
  label: string;
  value: number;
}

// ---------- helpers ----------
const pad = (n: number) => String(n).padStart(2, '0');
export const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const dayDiff = (from: string, to: string) =>
  Math.round((parse(to).getTime() - parse(from).getTime()) / 86400000);

// ---------- real endpoints ----------
// GET /admin/dashboard/summary  -> KPIs, snapshot, city list
// GET /admin/dashboard/trends   -> revenue/bookings series, category split, funnel
// The ten widgets share two requests per filter set (cached while in flight / after success).

interface ApiKpi {
  value: number;
  delta: number | null;
}
interface ApiSummary {
  kpis: { gmv: ApiKpi; bookings: ApiKpi; activeCustomers: ApiKpi; activePartners: ApiKpi; cancellationRate: ApiKpi };
  snapshot: {
    pendingApprovals: number;
    openTickets: number;
    payoutBacklog: { count: number; amount: number };
    refundQueue: { count: number; amount: number };
  };
  filters: { cities: string[] };
}
interface ApiTrends {
  range: { granularity: 'day' | 'week' };
  series: { date: string; bookings: number; gmv: number; revenue: number }[];
  categories: { name: string; bookings: number }[];
  funnel: { stage: string; label: string; count: number }[];
}

const queryFor = (f: DashboardFilters) => ({
  from: f.from,
  to: f.to,
  ...(f.city && f.city !== ALL_CITIES ? { city: f.city } : {}),
});

const keyOf = (f: DashboardFilters) => `${f.from}|${f.to}|${f.city}`;
const summaryCache = new Map<string, Promise<ApiSummary>>();
const trendsCache = new Map<string, Promise<ApiTrends>>();

export function clearDashboardCache(): void {
  summaryCache.clear();
  trendsCache.clear();
}

function cached<T>(cache: Map<string, Promise<T>>, key: string, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit) return hit;
  const p = load().catch((e) => {
    cache.delete(key); // a failed call is retried on the next load
    throw e;
  });
  cache.set(key, p);
  // Keep the cache short-lived so numbers stay fresh.
  setTimeout(() => cache.delete(key), 30_000);
  return p;
}

async function getSummary(f: DashboardFilters): Promise<ApiSummary> {
  const s = await cached(summaryCache, keyOf(f), async () =>
    (await http.get<ApiResponse<ApiSummary>>('/admin/dashboard/summary', { params: queryFor(f) })).data.data,
  );
  // The city filter lists the cities that really have bookings.
  CITIES.splice(0, CITIES.length, ALL_CITIES, ...(s.filters?.cities ?? []));
  return s;
}

const getTrends = (f: DashboardFilters): Promise<ApiTrends> =>
  cached(trendsCache, keyOf(f), async () =>
    (await http.get<ApiResponse<ApiTrends>>('/admin/dashboard/trends', { params: queryFor(f) })).data.data,
  );

const toKpi = (k: ApiKpi): Kpi => ({ value: k.value, deltaPct: k.delta });

/** `fail` still lets you force one widget to error (?fail=revenue,funnel) to check the partial-failure UI. */
async function widget<T>(key: string, fail: string[], load: () => Promise<T>): Promise<T> {
  if (fail.includes(key)) throw new Error(`${key} failed`);
  return load();
}

const dayLabel = (iso: string) =>
  parse(iso.slice(0, 10)).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

// ---------- widget loaders ----------
export const dashboardApi = {
  gmv: (f: DashboardFilters, fail: string[]) => widget('gmv', fail, async () => toKpi((await getSummary(f)).kpis.gmv)),

  bookings: (f: DashboardFilters, fail: string[]) =>
    widget('bookings', fail, async () => toKpi((await getSummary(f)).kpis.bookings)),

  cancellation: (f: DashboardFilters, fail: string[]) =>
    widget('cancellation', fail, async () => toKpi((await getSummary(f)).kpis.cancellationRate)),

  customers: (f: DashboardFilters, fail: string[]) =>
    widget('customers', fail, async () => toKpi((await getSummary(f)).kpis.activeCustomers)),

  partners: (f: DashboardFilters, fail: string[]) =>
    widget('partners', fail, async () => toKpi((await getSummary(f)).kpis.activePartners)),

  snapshot: (f: DashboardFilters, fail: string[]) =>
    widget<SnapshotItem[]>('snapshot', fail, async () => {
      const s = (await getSummary(f)).snapshot;
      return [
        { key: 'approvals', label: 'Pending approvals', value: s.pendingApprovals, to: '/admin/partners' },
        { key: 'tickets', label: 'Open tickets', value: s.openTickets, to: '/admin/support' },
        {
          key: 'payouts', label: 'Payout backlog', value: s.payoutBacklog.count, to: '/admin/payouts',
          alert: true, amount: s.payoutBacklog.amount,
        },
        {
          key: 'refunds', label: 'Refund queue', value: s.refundQueue.count, to: '/admin/refunds',
          alert: true, amount: s.refundQueue.amount,
        },
      ];
    }),

  revenueSeries: (f: DashboardFilters, fail: string[]) =>
    widget<Point[]>('revenue', fail, async () =>
      (await getTrends(f)).series.map((p) => ({ label: dayLabel(p.date), value: p.revenue })),
    ),

  bookingSeries: (f: DashboardFilters, fail: string[]) =>
    widget<Point[]>('bookingChart', fail, async () =>
      (await getTrends(f)).series.map((p) => ({ label: dayLabel(p.date), value: p.bookings })),
    ),

  categories: (f: DashboardFilters, fail: string[]) =>
    widget<Point[]>('category', fail, async () =>
      (await getTrends(f)).categories.map((c) => ({ label: c.name, value: c.bookings })),
    ),

  funnel: (f: DashboardFilters, fail: string[]) =>
    widget<FunnelStep[]>('funnel', fail, async () =>
      (await getTrends(f)).funnel.map((x) => ({ label: x.label, value: x.count })),
    ),

  clearCache: clearDashboardCache,
};

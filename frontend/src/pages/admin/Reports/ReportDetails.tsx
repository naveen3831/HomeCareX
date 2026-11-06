import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

import http from '@/lib/http';
import { adminApi } from '@/services/adminApi';
import './index.css';

type Row = Record<string, unknown>;
type ReportKind = 'bookings' | 'partners' | 'revenue';

const ENDPOINT: Record<ReportKind, string> = {
  bookings: '/admin/reports/bookings',
  partners: '/admin/reports/partners',
  revenue: '/admin/reports/revenue',
};

const TITLE: Record<ReportKind, string> = {
  bookings: 'Booking details',
  partners: 'Partner performance details',
  revenue: 'Revenue summary details',
};

const LABELS: Record<string, string> = {
  bookingId: 'Booking ID',
  customerName: 'Customer',
  categoryName: 'Category',
  createdAt: 'Created at',
  serviceName: 'Service',
  city: 'City',
  categoryId: 'Category ID',
  partnerId: 'Partner ID',
  status: 'Status',
  paymentStatus: 'Payment status',
  total: 'Booking total',
  discount: 'Discount',
  convenienceFee: 'Convenience fee',
  partnerEarning: 'Partner earning',
  partnerName: 'Partner',
  totalBookings: 'Total bookings',
  completedBookings: 'Completed bookings',
  cancelledBookings: 'Cancelled bookings',
  completionRate: 'Completion rate',
  grossEarnings: 'Gross earnings',
  commission: 'Commission',
  netEarnings: 'Net earnings',
  averageRating: 'Average rating',
  ratingCount: 'Rating count',
  grossBookingValue: 'Gross booking value',
  convenienceFees: 'Convenience fees',
  discounts: 'Discounts',
  refunds: 'Refunds',
  netRevenue: 'Net revenue',
  paidBookings: 'Paid bookings',
};

const MONEY = new Set([
  'total',
  'discount',
  'convenienceFee',
  'partnerEarning',
  'grossEarnings',
  'commission',
  'netEarnings',
  'grossBookingValue',
  'convenienceFees',
  'discounts',
  'refunds',
  'netRevenue',
]);

const inr = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(value);

function display(key: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (MONEY.has(key)) return inr(Number(value) || 0);
  if (key === 'completionRate') return `${(Number(value) || 0).toFixed(1)}%`;
  if (key === 'createdAt') {
    const date = new Date(String(value));
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('en-IN');
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function asRecord(value: unknown): Row | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Row) : null;
}

/** Report rows come back as { data: { rows|data|items, summary } } or similar; find them either way. */
function extract(payload: unknown): { rows: Row[]; summary: Row | null } {
  const root = asRecord(payload) ?? {};
  const inner = asRecord(root.data) && !('rows' in root) ? (root.data as Row) : root;
  const list = [inner.rows, inner.data, inner.items].find(Array.isArray) as Row[] | undefined;
  return { rows: list ?? [], summary: asRecord(inner.summary) };
}

const ReportDetails: React.FC = () => {
  const { report, id } = useParams<{ report: string; id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const kind: ReportKind | null =
    report === 'bookings' || report === 'partners' || report === 'revenue' ? report : null;

  // The Reports list hands over the row it was showing, so the page opens instantly.
  const passedRow = asRecord((location.state as { row?: unknown } | null)?.row);

  const [row, setRow] = useState<Row | null>(passedRow);
  const [loading, setLoading] = useState(!passedRow);
  const [error, setError] = useState('');
  const [partnerUserId, setPartnerUserId] = useState('');

  useEffect(() => {
    if (!kind || passedRow) return;
    let live = true;

    setLoading(true);
    http
      .get(ENDPOINT[kind])
      .then((response) => {
        if (!live) return;
        const { rows, summary } = extract(response.data);
        if (kind === 'revenue') {
          setRow(summary);
          if (!summary) setError('No revenue summary is available.');
          return;
        }
        const key = kind === 'bookings' ? 'bookingId' : 'partnerId';
        const match = rows.find((item) => String(item[key]) === id);
        if (match) setRow(match);
        else setError('This record is not in the current report. It may have been filtered out.');
      })
      .catch(() => live && setError('Unable to load this record. Please try again.'))
      .finally(() => live && setLoading(false));

    return () => {
      live = false;
    };
  }, [kind, id, passedRow]);

  // Partner report rows use the partner profile ID; the partner page opens by user ID.
  useEffect(() => {
    if (kind !== 'partners' || !id) return;
    let live = true;

    adminApi
      .partnerDirectory()
      .then((list) => {
        if (!live) return;
        const match = list.find((partner) => String(partner.partnerId) === id);
        if (match) setPartnerUserId(String(match.id));
      })
      .catch(() => undefined);

    return () => {
      live = false;
    };
  }, [kind, id]);

  const goBack = () => navigate('/admin/reports');

  if (!kind) {
    return (
      <main className="admin-page-container reports-page p-4 sm:p-6">
        <p role="alert">Unknown report.</p>
        <button type="button" className="report-detail__back" onClick={goBack}>
          <ArrowLeft size={16} /> Back to reports
        </button>
      </main>
    );
  }

  // Readable names first, raw ids after.
  const FIRST = ['customerName', 'categoryName', 'serviceName', 'partnerName'];
  const entries = row
    ? Object.entries(row)
        .filter(([, value]) => typeof value !== 'object' || value === null)
        .sort(([a], [b]) => {
          const rank = (key: string) => (FIRST.indexOf(key) === -1 ? FIRST.length : FIRST.indexOf(key));
          return rank(a) - rank(b);
        })
    : [];

  return (
    <main className="admin-page-container reports-page p-4 sm:p-6">
      <button type="button" className="report-detail__back" onClick={goBack}>
        <ArrowLeft size={16} /> Back to reports
      </button>

      <header className="mb-6">
        <h1 className="text-2xl font-bold">{TITLE[kind]}</h1>
        {row && kind === 'bookings' && (
          <p className="mt-1 text-sm text-gray-600 report-detail__sub">Booking {String(row.bookingId ?? id)}</p>
        )}
        {row && kind === 'partners' && (
          <p className="mt-1 text-sm text-gray-600 report-detail__sub">{String(row.partnerName ?? 'Partner')}</p>
        )}
      </header>

      {loading && (
        <div role="status" aria-live="polite" className="py-10">
          Loading details…
        </div>
      )}

      {!loading && error && (
        <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-800">
          {error}
        </div>
      )}

      {!loading && row && (
        <>
          <section className="report-detail__card" aria-label="Report fields">
            <dl className="report-detail__grid">
              {entries.map(([key, value]) => (
                <div key={key} className="report-detail__field">
                  <dt>{LABELS[key] ?? key}</dt>
                  <dd title={typeof value === 'string' ? value : undefined}>{display(key, value)}</dd>
                </div>
              ))}
            </dl>
          </section>

          <div className="report-detail__actions">
            {kind === 'bookings' && row.bookingId ? (
              <Link className="report-detail__link" to={`/admin/bookings/${encodeURIComponent(String(row.bookingId))}`}>
                Open full booking
              </Link>
            ) : null}
            {kind === 'partners' && partnerUserId ? (
              <Link className="report-detail__link" to={`/admin/partners/${encodeURIComponent(partnerUserId)}`}>
                Open partner profile
              </Link>
            ) : null}
          </div>
        </>
      )}
    </main>
  );
};

export default ReportDetails;

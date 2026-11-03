
import React, { useCallback, useEffect, useState } from 'react';
import {
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  X,
  Search,
} from 'lucide-react';
import http from '@/lib/http';
import { TablePagination, usePagination } from '@/components/tables';
import './index.css';

type ReportFilters = {
  startDate: string;
  endDate: string;
  city: string;
  category: string;
  status: string;
  paymentStatus: string;
  partner: string;
};

type ReportRow = Record<string, unknown>;
type ReportSummary = Record<string, unknown>;
type ReportSection = 'bookings' | 'revenue' | 'partners';

type ReportResult = {
  rows: ReportRow[];
  summary: ReportSummary | null;
  total: number;
};

const initialFilters: ReportFilters = {
  startDate: '',
  endDate: '',
  city: '',
  category: '',
  status: '',
  paymentStatus: '',
  partner: '',
};

const reportConfig: Record<
  ReportSection,
  {
    title: string;
    endpoint: string;
    exportEndpoint: string;
  }
> = {
  bookings: {
    title: 'Bookings Report',
    endpoint: '/admin/reports/bookings',
    exportEndpoint: '/admin/reports/bookings/export',
  },
  revenue: {
    title: 'Revenue Report',
    endpoint: '/admin/reports/revenue',
    exportEndpoint: '/admin/reports/revenue/export',
  },
  partners: {
    title: 'Partner Performance',
    endpoint: '/admin/reports/partners',
    exportEndpoint: '/admin/reports/partners/export',
  },
};

const fieldsByReport: Record<
  ReportSection,
  (keyof ReportFilters)[]
> = {
  bookings: [
    'startDate',
    'endDate',
    'city',
    'category',
    'status',
    'partner',
  ],
  revenue: [
    'startDate',
    'endDate',
    'city',
    'category',
    'paymentStatus',
  ],
  partners: [
    'startDate',
    'endDate',
    'city',
    'status',
    'partner',
  ],
};

function asRecord(value: unknown): ReportSummary | null {
  if (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value)
  ) {
    return value as ReportSummary;
  }

  return null;
}

function getPayload(payload: unknown): ReportSummary {
  const object = asRecord(payload);

  if (!object) return {};

  const nested = asRecord(object.data);

  if (
    nested &&
    !('success' in object) &&
    !('reportType' in object)
  ) {
    return nested;
  }

  return object;
}

function getRows(payload: unknown): ReportRow[] {
  if (Array.isArray(payload)) {
    return payload as ReportRow[];
  }

  const object = getPayload(payload);

  if (Array.isArray(object.data)) {
    return object.data as ReportRow[];
  }

  if (Array.isArray(object.rows)) {
    return object.rows as ReportRow[];
  }

  if (Array.isArray(object.items)) {
    return object.items as ReportRow[];
  }

  return [];
}

function getNumber(
  data: ReportSummary | null,
  keys: string[],
): number {
  if (!data) return 0;

  for (const key of keys) {
    const value = data[key];

    if (
      typeof value === 'number' &&
      Number.isFinite(value)
    ) {
      return value;
    }

    if (
      typeof value === 'string' &&
      value.trim() !== ''
    ) {
      const parsed = Number(value);

      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return 0;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 2,
  }).format(value);
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(value);
}

function formatCell(value: unknown): string {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return '—';
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
}

/**
 * Shortens IDs only for display.
 * The original ID is preserved in the API data and CSV exports.
 */
function formatIdentifier(value: unknown): string {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return '—';
  }

  const id = String(value);

  if (id.length <= 16) {
    return id;
  }

  return `${id.slice(0, 8)}…${id.slice(-6)}`;
}

/**
 * Converts frontend date names into the backend's from/to parameters.
 * Only filters relevant to the selected report are submitted.
 */
function toParams(
  filters: ReportFilters,
  report: ReportSection,
): Record<string, string> {
  const params: Record<string, string> = {};

  for (const field of fieldsByReport[report]) {
    const value = filters[field].trim();

    if (!value) continue;

    const parameterName =
      field === 'startDate'
        ? 'from'
        : field === 'endDate'
          ? 'to'
          : field;

    params[parameterName] = value;
  }

  return params;
}

/** Pages the rows of one report table (10 per page). A plain function cannot hold the page state. */
function ReportRowsPager({
  rows,
  resetKey,
  children,
}: {
  rows: ReportRow[];
  resetKey: string;
  children: (pageRows: ReportRow[]) => React.ReactNode;
}) {
  const pager = usePagination(rows, { resetKey });

  return (
    <>
      {children(pager.pageItems)}

      <TablePagination
        {...pager}
        onPageChange={pager.setPage}
        onPageSizeChange={pager.setPageSize}
        label="report rows"
      />
    </>
  );
}

const AdminReportsPage: React.FC = () => {
  const [filters, setFilters] =
    useState<ReportFilters>({ ...initialFilters });

  const [appliedFilters, setAppliedFilters] =
    useState<ReportFilters>({ ...initialFilters });

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [activeReport, setActiveReport] =
    useState<ReportSection>('bookings');

  const [reports, setReports] = useState<
    Record<ReportSection, ReportResult>
  >({
    bookings: {
      rows: [],
      summary: null,
      total: 0,
    },
    revenue: {
      rows: [],
      summary: null,
      total: 0,
    },
    partners: {
      rows: [],
      summary: null,
      total: 0,
    },
  });

  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const config = reportConfig[activeReport];

      const response = await http.get(config.endpoint, {
        params: toParams(appliedFilters, activeReport),
      });

      const payload = getPayload(response.data);

      if (payload.success === false) {
        throw new Error(
          typeof payload.message === 'string'
            ? payload.message
            : 'The server could not load this report.',
        );
      }

      const result: ReportResult = {
        rows: getRows(payload),
        summary: asRecord(payload.summary),
        total: getNumber(payload, ['total']),
      };

      setReports((previous) => ({
        ...previous,
        [activeReport]: result,
      }));
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : '';

      setError(
        message ||
          'Unable to load this report. Check your connection and try again.',
      );
    } finally {
      setLoading(false);
    }
  }, [activeReport, appliedFilters]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  const updateFilter = (
    key: keyof ReportFilters,
    value: string,
  ) => {
    setFilters((previous) => ({
      ...previous,
      [key]: value,
    }));
  };

  const applyFilters = () => {
    setAppliedFilters({ ...filters });
    setFiltersOpen(false);
    setSearchTerm('');
  };

  const resetFilters = () => {
    setFilters({ ...initialFilters });
    setAppliedFilters({ ...initialFilters });
    setFiltersOpen(false);
    setSearchTerm('');
  };

  const changeReport = (report: ReportSection) => {
    setActiveReport(report);
    setSearchTerm('');
    setError('');
  };

  const activeFilterCount = Object.keys(
    toParams(appliedFilters, activeReport),
  ).length;

  const current = reports[activeReport];
  const normalizedSearch = searchTerm.trim().toLowerCase();

  // Search the rows currently returned by the API.
  const visibleRows = current.rows.filter((row) => {
    if (!normalizedSearch) return true;

    return Object.values(row).some((value) => {
      if (value === null || value === undefined) {
        return false;
      }

      const text =
        typeof value === 'object'
          ? JSON.stringify(value)
          : String(value);

      return text.toLowerCase().includes(normalizedSearch);
    });
  });

  const exportCsv = async () => {
    setExporting(true);
    setError('');

    try {
      const config = reportConfig[activeReport];

      const response = await http.get(config.exportEndpoint, {
        params: toParams(appliedFilters, activeReport),
        responseType: 'blob',
      });

      const blob = new Blob(
        ['\uFEFF', response.data],
        {
          type: 'text/csv;charset=utf-8;',
        },
      );

      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');

      anchor.href = url;
      anchor.download =
        `homecarex-${activeReport}-report.csv`;

      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();

      window.URL.revokeObjectURL(url);
    } catch {
      setError('CSV export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  // Bookings metrics.
  const bookingSummary = reports.bookings.summary;

  const bookingCount = getNumber(
    bookingSummary,
    ['totalBookings'],
  );

  const completedCount = getNumber(
    bookingSummary,
    ['completedBookings'],
  );

  const cancelledCount = getNumber(
    bookingSummary,
    ['cancelledBookings'],
  );

  const completionRate = getNumber(
    bookingSummary,
    ['completionRate'],
  );

  const averageOrderValue = getNumber(
    bookingSummary,
    ['averageOrderValue'],
  );

  // Revenue metrics.
  const revenueSummary = reports.revenue.summary;

  const grossValue = getNumber(
    revenueSummary,
    ['grossBookingValue', 'gbv', 'grossRevenue'],
  );

  const commission = getNumber(
    revenueSummary,
    ['commission', 'totalCommission'],
  );

  const fees = getNumber(
    revenueSummary,
    ['convenienceFees', 'fees', 'totalFees'],
  );

  const discounts = getNumber(
    revenueSummary,
    ['discounts', 'totalDiscounts'],
  );

  const refunds = getNumber(
    revenueSummary,
    ['refunds', 'totalRefunds'],
  );

  const netRevenue = getNumber(
    revenueSummary,
    ['netRevenue'],
  );

  const paidBookings = getNumber(
    revenueSummary,
    ['paidBookings'],
  );

  // Partner Performance metrics.
  const partnerSummary = reports.partners.summary;

  const partnerCount = getNumber(
    partnerSummary,
    ['totalPartners'],
  );

  const partnerBookingCount = getNumber(
    partnerSummary,
    ['totalBookings'],
  );

  const partnerCompletedCount = getNumber(
    partnerSummary,
    ['completedBookings'],
  );

  const partnerCancelledCount = getNumber(
    partnerSummary,
    ['cancelledBookings'],
  );

  const partnerGrossEarnings = getNumber(
    partnerSummary,
    ['grossEarnings'],
  );

  const partnerCommission = getNumber(
    partnerSummary,
    ['commission'],
  );

  const partnerNetEarnings = getNumber(
    partnerSummary,
    ['netEarnings'],
  );

  const partnerCompletionRate =
    partnerBookingCount > 0
      ? (partnerCompletedCount / partnerBookingCount) * 100
      : 0;

  const columns: Record<ReportSection, string[]> = {
    bookings: [
      'bookingId',
      'createdAt',
      'status',
      'paymentStatus',
      'city',
      'categoryId',
      'partnerId',
      'total',
    ],
    revenue: [],
    partners: [
      'partnerName',
      'partnerId',
      'totalBookings',
      'completedBookings',
      'cancelledBookings',
      'completionRate',
      'grossEarnings',
      'commission',
      'netEarnings',
      'averageRating',
      'ratingCount',
    ],
  };

  const labels: Record<string, string> = {
    bookingId: 'Booking ID',
    createdAt: 'Created At',
    status: 'Status',
    paymentStatus: 'Payment Status',
    city: 'City',
    categoryId: 'Category ID',
    partnerId: 'Partner ID',
    total: 'Booking Total',
    partnerName: 'Partner',
    totalBookings: 'Bookings',
    completedBookings: 'Completed',
    cancelledBookings: 'Cancelled',
    completionRate: 'Completion Rate',
    grossEarnings: 'Gross Earnings',
    commission: 'Commission',
    netEarnings: 'Net Earnings',
    averageRating: 'Average Rating',
    ratingCount: 'Rating Count',
  };

  const renderTable = (
    reportType: 'bookings' | 'partners',
    rows: ReportRow[],
  ) => {
    const reportColumns = columns[reportType];

    if (rows.length === 0) {
      return (
        <div
          role="status"
          className="rounded-xl border border-gray-200 bg-white p-8 text-center text-gray-600"
        >
          {normalizedSearch
            ? 'No matching rows. Try a different search.'
            : 'No records found for the selected filters.'}
        </div>
      );
    }

    return (
      <>
        {normalizedSearch && (
          <p className="admin-search-results">
            Showing {formatNumber(rows.length)} matching{' '}
            {rows.length === 1 ? 'row' : 'rows'} out of{' '}
            {formatNumber(current.rows.length)} loaded rows.
          </p>
        )}

        <ReportRowsPager
          rows={rows}
          resetKey={`${reportType}|${normalizedSearch}|${rows.length}`}
        >
          {(pageRows) => (
        <div className="w-full overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
            <thead className="bg-gray-50">
              <tr>
                {reportColumns.map((column) => (
                  <th
                    scope="col"
                    key={column}
                    className="px-4 py-3 font-semibold"
                  >
                    {labels[column] || column}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {pageRows.map((row, index) => (
                <tr
                  key={String(
                    row.bookingId ?? row.partnerId ?? index,
                  )}
                >
                  {reportColumns.map((column) => {
                    const value = row[column];

                    const isIdentifier = [
                      'bookingId',
                      'categoryId',
                      'partnerId',
                    ].includes(column);

                    let display = isIdentifier
                      ? formatIdentifier(value)
                      : formatCell(value);

                    if (
                      [
                        'total',
                        'grossEarnings',
                        'commission',
                        'netEarnings',
                      ].includes(column)
                    ) {
                      display = formatCurrency(Number(value) || 0);
                    } else if (column === 'completionRate') {
                      display =
                        `${(Number(value) || 0).toFixed(1)}%`;
                    } else if (column === 'createdAt' && value) {
                      const date = new Date(String(value));

                      display = Number.isNaN(date.getTime())
                        ? formatCell(value)
                        : date.toLocaleString('en-IN');
                    }

                    return (
                      <td
                        key={column}
                        title={
                          isIdentifier &&
                          value !== null &&
                          value !== undefined &&
                          value !== ''
                            ? String(value)
                            : undefined
                        }
                        className={`px-4 py-3 ${
                          isIdentifier ? 'report-id-cell' : ''
                        }`}
                      >
                        {display}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
          )}
        </ReportRowsPager>
      </>
    );
  };

  return (
    <main className="admin-page-container reports-page p-4 sm:p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">
          Admin Reports
        </h1>

        <p className="mt-1 text-sm text-gray-600">
          Review bookings, revenue, and partner performance.
        </p>
      </header>

      {/* Search bar and filter button */}
      <div className="admin-filter-toolbar">
        {activeReport === 'revenue' ? (
          <div className="admin-search-note">
            Revenue overview
            <span>
              Export CSV to download booking-level details.
            </span>
          </div>
        ) : (
          <div className="admin-search-box">
            <Search size={19} aria-hidden="true" />

            <input
              type="search"
              aria-label={`Search ${reportConfig[activeReport].title}`}
              placeholder={
                activeReport === 'bookings'
                  ? 'Search by booking ID, city, status...'
                  : 'Search by partner name or ID...'
              }
              value={searchTerm}
              onChange={(event) =>
                setSearchTerm(event.target.value)
              }
            />

            {searchTerm && (
              <button
                type="button"
                className="admin-search-clear"
                aria-label="Clear search"
                onClick={() => setSearchTerm('')}
              >
                <X size={16} aria-hidden="true" />
              </button>
            )}
          </div>
        )}

        <button
          type="button"
          className="admin-filter-toggle"
          aria-expanded={filtersOpen}
          aria-controls="admin-report-filters"
          onClick={() =>
            setFiltersOpen((open) => !open)
          }
        >
          <SlidersHorizontal size={18} aria-hidden="true" />

          <span>Filters</span>

          {activeFilterCount > 0 && (
            <span className="admin-filter-count">
              {activeFilterCount}
            </span>
          )}

          {filtersOpen ? (
            <ChevronUp size={17} aria-hidden="true" />
          ) : (
            <ChevronDown size={17} aria-hidden="true" />
          )}
        </button>
      </div>

      {/* Report-specific filters */}
      {filtersOpen && (
        <section
          id="admin-report-filters"
          aria-label="Report filters"
          className="admin-filter-panel"
        >
          <div className="admin-filter-panel-header">
            <div>
              <h2>Filter reports</h2>

              <p>
                {activeReport === 'bookings'
                  ? 'Filter bookings by date, location, category, status, or partner.'
                  : activeReport === 'revenue'
                    ? 'Filter revenue by date, location, category, or payment status.'
                    : 'Filter partner performance by date, location, booking status, or partner.'}
              </p>
            </div>

            <button
              type="button"
              className="admin-filter-close"
              aria-label="Close filters"
              onClick={() => setFiltersOpen(false)}
            >
              <X size={19} aria-hidden="true" />
            </button>
          </div>

          <div className="admin-filter-grid">
            <label className="admin-filter-field">
              <span>Start date</span>
              <input
                type="date"
                value={filters.startDate}
                max={filters.endDate || undefined}
                onChange={(event) =>
                  updateFilter('startDate', event.target.value)
                }
              />
            </label>

            <label className="admin-filter-field">
              <span>End date</span>
              <input
                type="date"
                value={filters.endDate}
                min={filters.startDate || undefined}
                onChange={(event) =>
                  updateFilter('endDate', event.target.value)
                }
              />
            </label>

            <label className="admin-filter-field">
              <span>City</span>
              <input
                type="text"
                value={filters.city}
                onChange={(event) =>
                  updateFilter('city', event.target.value)
                }
                placeholder="e.g. Hyderabad"
              />
            </label>

            {(activeReport === 'bookings' ||
              activeReport === 'revenue') && (
              <label className="admin-filter-field">
                <span>Category ID</span>
                <input
                  type="text"
                  value={filters.category}
                  onChange={(event) =>
                    updateFilter('category', event.target.value)
                  }
                  placeholder="Enter category ID"
                />
              </label>
            )}

            {(activeReport === 'bookings' ||
              activeReport === 'partners') && (
              <label className="admin-filter-field">
                <span>Booking status</span>
                <select
                  value={filters.status}
                  onChange={(event) =>
                    updateFilter('status', event.target.value)
                  }
                >
                  <option value="">All statuses</option>
                  <option value="pending">Pending</option>
                  <option value="pending_payment">Pending payment</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="in_progress">In progress</option>
                  <option value="arrived">Arrived</option>
                  <option value="en_route">En route</option>
                  <option value="completed">Completed</option>
                  <option value="rated">Rated</option>
                  <option value="cancelled_by_customer">
                    Cancelled by customer
                  </option>
                  <option value="cancelled_by_partner">
                    Cancelled by partner
                  </option>
                  <option value="cancelled_by_admin">
                    Cancelled by admin
                  </option>
                </select>
              </label>
            )}

            {activeReport === 'revenue' && (
              <label className="admin-filter-field">
                <span>Payment status</span>
                <select
                  value={filters.paymentStatus}
                  onChange={(event) =>
                    updateFilter('paymentStatus', event.target.value)
                  }
                >
                  <option value="">All payment statuses</option>
                  <option value="PAID">Paid</option>
                  <option value="PENDING">Pending</option>
                  <option value="FAILED">Failed</option>
                  <option value="REFUNDED">Refunded</option>
                </select>
              </label>
            )}

            {(activeReport === 'bookings' ||
              activeReport === 'partners') && (
              <label className="admin-filter-field">
                <span>Partner ID</span>
                <input
                  type="text"
                  value={filters.partner}
                  onChange={(event) =>
                    updateFilter('partner', event.target.value)
                  }
                  placeholder="Enter partner ID"
                />
              </label>
            )}
          </div>

          <div className="admin-filter-panel-footer">
            <span className="admin-filter-hint">
              {activeFilterCount === 0
                ? 'No filters currently applied'
                : `${activeFilterCount} active filter${activeFilterCount === 1 ? '' : 's'}`}
            </span>

            <div className="admin-filter-actions">
              <button
                type="button"
                className="admin-filter-reset"
                onClick={resetFilters}
              >
                <RotateCcw size={16} aria-hidden="true" />
                Reset
              </button>

              <button
                type="button"
                className="admin-filter-apply"
                disabled={loading}
                onClick={applyFilters}
              >
                Apply Filters
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Report tabs */}
      <nav
        aria-label="Report type"
        className="mb-6 flex flex-wrap gap-2"
      >
        {(
          [
            ['bookings', 'Bookings'],
            ['revenue', 'Revenue'],
            ['partners', 'Partner Performance'],
          ] as [ReportSection, string][]
        ).map(([key, title]) => (
          <button
            type="button"
            key={key}
            onClick={() => changeReport(key)}
            aria-pressed={activeReport === key}
            className={`rounded-lg border px-4 py-2 ${
              activeReport === key
                ? 'border-blue-600 bg-blue-600 text-white'
                : 'border-gray-300 bg-white'
            }`}
          >
            {title}
          </button>
        ))}
      </nav>

      {/* Active report */}
      <section aria-labelledby="active-report-title">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2
            id="active-report-title"
            className="text-xl font-semibold"
          >
            {reportConfig[activeReport].title}
          </h2>

          <button
            type="button"
            onClick={() => void exportCsv()}
            disabled={exporting || loading}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 disabled:opacity-60"
          >
            {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-4 rounded-lg border border-red-300 bg-red-50 p-4 text-red-800"
          >
            <p>{error}</p>

            <button
              type="button"
              onClick={() => void loadReport()}
              className="mt-2 rounded border border-red-300 px-3 py-1"
            >
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <div
            role="status"
            aria-live="polite"
            className="py-10"
          >
            Loading report…
          </div>
        ) : !error && (
          <>
            {/* Bookings summary cards */}
            {activeReport === 'bookings' && (
              <>
                {bookingSummary && (
                  <div className="admin-report-metrics admin-report-metrics--bookings mb-6">
                    <Metric
                      title="Bookings"
                      value={formatNumber(bookingCount)}
                    />
                    <Metric
                      title="Completed"
                      value={formatNumber(completedCount)}
                    />
                    <Metric
                      title="Cancelled"
                      value={formatNumber(cancelledCount)}
                    />
                    <Metric
                      title="Completion rate"
                      value={`${completionRate.toFixed(1)}%`}
                    />
                    <Metric
                      title="Average order value"
                      value={formatCurrency(averageOrderValue)}
                    />
                  </div>
                )}

                {renderTable('bookings', visibleRows)}
              </>
            )}

            {/* Revenue summary cards */}
            {activeReport === 'revenue' && (
              <>
                {revenueSummary ? (
                  <>
                    <div className="admin-report-metrics admin-report-metrics--revenue mb-6">
                      <Metric
                        title="Gross booking value"
                        value={formatCurrency(grossValue)}
                      />
                      <Metric
                        title="Commission"
                        value={formatCurrency(commission)}
                      />
                      <Metric
                        title="Convenience fees"
                        value={formatCurrency(fees)}
                      />
                      <Metric
                        title="Discounts"
                        value={formatCurrency(discounts)}
                      />
                      <Metric
                        title="Refunds"
                        value={formatCurrency(refunds)}
                      />
                      <Metric
                        title="Net revenue"
                        value={formatCurrency(netRevenue)}
                      />
                      <Metric
                        title="Paid bookings"
                        value={formatNumber(paidBookings)}
                      />
                    </div>

                    {current.total === 0 ? (
                      <div
                        role="status"
                        className="rounded-xl border border-gray-200 bg-white p-8 text-center text-gray-600"
                      >
                        No bookings found for the selected filters.
                      </div>
                    ) : (
                      <div className="rounded-xl border border-gray-200 bg-white p-5 text-sm text-gray-600">
                        Revenue summary covers{' '}
                        {formatNumber(current.total)} bookings.
                        Use <strong>Export CSV</strong> to download
                        booking-level revenue details.
                      </div>
                    )}
                  </>
                ) : (
                  <div
                    role="status"
                    className="rounded-xl border border-gray-200 bg-white p-8 text-center text-gray-600"
                  >
                    No revenue summary is available for this report.
                  </div>
                )}
              </>
            )}

            {/* Partner Performance: eight evenly aligned cards */}
            {activeReport === 'partners' && (
              <>
                {partnerSummary && (
                  <div className="admin-report-metrics admin-report-metrics--partners mb-6">
                    <Metric
                      title="Partners in report"
                      value={formatNumber(partnerCount)}
                    />
                    <Metric
                      title="Bookings"
                      value={formatNumber(partnerBookingCount)}
                    />
                    <Metric
                      title="Completed"
                      value={formatNumber(partnerCompletedCount)}
                    />
                    <Metric
                      title="Cancelled"
                      value={formatNumber(partnerCancelledCount)}
                    />
                    <Metric
                      title="Completion rate"
                      value={`${partnerCompletionRate.toFixed(1)}%`}
                    />
                    <Metric
                      title="Gross earnings"
                      value={formatCurrency(partnerGrossEarnings)}
                    />
                    <Metric
                      title="Commission"
                      value={formatCurrency(partnerCommission)}
                    />
                    <Metric
                      title="Net earnings"
                      value={formatCurrency(partnerNetEarnings)}
                    />
                  </div>
                )}

                {renderTable('partners', visibleRows)}
              </>
            )}
          </>
        )}
      </section>
    </main>
  );
};

type MetricProps = {
  title: string;
  value: string;
};

const Metric: React.FC<MetricProps> = ({
  title,
  value,
}) => (
  <article className="report-metric-card">
    <p className="report-metric-card__label">{title}</p>
    <p className="report-metric-card__value">{value}</p>
  </article>
);

export default AdminReportsPage;

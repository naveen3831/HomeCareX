<<<<<<< HEAD

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import http from '@/lib/http';
import './index.css';

type PayoutStatus = 'pending' | 'processing' | 'paid' | 'failed';

interface Partner {
  _id?: string;
  id?: string;
  name?: string;
  email?: string;
  phone?: string;
}

interface Payout {
  _id: string;
  partnerId?: Partner | string | null;
  partner?: Partner | null;
  batchId?: string | { _id?: string };
  amount?: number;
  gross?: number;
  commission?: number;
  net?: number;
  status: string;
  paidAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  periodStart?: string;
  periodEnd?: string;
}

interface PayoutBatch extends Payout {
  payoutIds?: string[];
  earningIds?: string[];
  createdBy?: string;
}

interface ApiListData {
  items?: PayoutBatch[];
  payouts?: Payout[];
  batches?: PayoutBatch[];
  payout?: Payout;
  pagination?: {
    page?: number;
    limit?: number;
    total?: number;
    pages?: number;
  };
}

interface ApiResponse {
  success?: boolean;
  data?: Payout[] | PayoutBatch[] | ApiListData | Payout;
  message?: string;
  error?: string;
}

const PAYOUT_STATUSES: PayoutStatus[] = [
  'pending',
  'processing',
  'paid',
  'failed',
];

function getErrorMessage(error: unknown): string {
  const err = error as {
    response?: {
      data?: {
        message?: string;
        error?: string;
      };
    };
    message?: string;
  };

  return (
    err.response?.data?.message ??
    err.response?.data?.error ??
    err.message ??
    'Something went wrong. Please try again.'
  );
}

function normalizeStatus(status?: string): string {
  return (status ?? 'pending').toLowerCase();
}

function getPartner(payout: Payout): Partner | string | null {
  return payout.partner ?? payout.partnerId ?? null;
}

function getPartnerName(payout: Payout): string {
  const partner = getPartner(payout);

  if (typeof partner === 'string') {
    return partner.trim() || 'Partner name unavailable';
  }

  if (partner?.name?.trim()) return partner.name.trim();
  if (partner?.email?.trim()) return partner.email.trim();

  return 'Partner name unavailable';
}

function getPartnerEmail(payout: Payout): string {
  const partner = getPartner(payout);

  return typeof partner === 'object' && partner
    ? partner.email?.trim() || '—'
    : '—';
}

function getPartnerPhone(payout: Payout): string {
  const partner = getPartner(payout);

  return typeof partner === 'object' && partner
    ? partner.phone?.trim() || '—'
    : '—';
}

function getBatchId(payout: Payout): string {
  if (typeof payout.batchId === 'string') return payout.batchId;
  return payout.batchId?._id ?? '—';
}

function getPayoutAmount(payout: Payout): number {
  return payout.net ?? payout.amount ?? 0;
}

function formatCurrency(amount?: number | null): string {
  if (
    amount === undefined ||
    amount === null ||
    !Number.isFinite(amount)
  ) {
    return '—';
  }

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(value?: string | null): string {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateTime(value?: string | null): string {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function extractRecords(
  response: ApiResponse | Payout[] | PayoutBatch[],
): PayoutBatch[] {
  if (Array.isArray(response)) {
    return response as PayoutBatch[];
  }

  const data = response.data;

  if (Array.isArray(data)) return data as PayoutBatch[];
  if (!data || typeof data !== 'object') return [];

  if ('items' in data && Array.isArray(data.items)) {
    return data.items;
  }

  if ('payouts' in data && Array.isArray(data.payouts)) {
    return data.payouts as PayoutBatch[];
  }

  if ('batches' in data && Array.isArray(data.batches)) {
    return data.batches;
  }

  return [];
}

function extractSinglePayout(
  response: ApiResponse | Payout | PayoutBatch[],
): Payout | null {
  if (Array.isArray(response)) {
    return response[0] ?? null;
  }

  if (!response || typeof response !== 'object') {
    return null;
  }

  if ('_id' in response && typeof response._id === 'string') {
    return response as Payout;
  }

  if (!('data' in response)) {
    return null;
  }

  const data = response.data;

  if (Array.isArray(data)) {
    return (data[0] as Payout | undefined) ?? null;
  }

  if (!data || typeof data !== 'object') {
    return null;
  }

  if ('_id' in data && typeof data._id === 'string') {
    return data as Payout;
  }

  if ('payout' in data && data.payout) {
    return data.payout as Payout;
  }

  if ('items' in data && Array.isArray(data.items)) {
    return (data.items[0] as Payout | undefined) ?? null;
  }

  return null;
}

function isBatchRecord(record: PayoutBatch): boolean {
  return (
    Array.isArray(record.payoutIds) &&
    !record.partnerId &&
    !record.partner
  );
}

async function loadPayoutRows(): Promise<Payout[]> {
  const response = await http.get<
    ApiResponse | Payout[] | PayoutBatch[]
  >('/admin/payouts');

  const records = extractRecords(response.data);

  if (records.length === 0) return [];

  if (!records.some(isBatchRecord)) {
    return records as Payout[];
  }

  const results = await Promise.all(
    records.map(async (record): Promise<Payout[]> => {
      if (!isBatchRecord(record)) return [record];
      if (!record._id) return [];

      try {
        const payoutResponse = await http.get<
          ApiResponse | Payout[] | PayoutBatch[]
        >(
          `/admin/payouts/${encodeURIComponent(record._id)}/payouts`,
        );

        const batchPayouts = extractRecords(
          payoutResponse.data,
        ) as Payout[];

        return batchPayouts.map((payout) => ({
          ...payout,
          batchId: payout.batchId ?? record._id,
          periodStart: payout.periodStart ?? record.periodStart,
          periodEnd: payout.periodEnd ?? record.periodEnd,
          gross:
            batchPayouts.length === 1
              ? payout.gross ?? record.gross
              : payout.gross,
          commission:
            batchPayouts.length === 1
              ? payout.commission ?? record.commission
              : payout.commission,
        }));
      } catch {
        return [];
      }
    }),
  );

  return results.flat();
}

const AdminPayoutsPage: React.FC = () => {
  const navigate = useNavigate();
  const { id: payoutId } = useParams<{ id: string }>();

  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [isOffline, setIsOffline] = useState(
    typeof navigator !== 'undefined' ? !navigator.onLine : false,
  );

  const [detailPayout, setDetailPayout] = useState<Payout | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const selectedPayout = useMemo(
    () =>
      payoutId
        ? payouts.find((payout) => payout._id === payoutId) ??
          (detailPayout?._id === payoutId ? detailPayout : null)
        : null,
    [payoutId, payouts, detailPayout],
  );

  const loadPayouts = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const rows = await loadPayoutRows();
      setPayouts(rows);
      setIsOffline(false);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPayouts();

    const handleOnline = () => {
      setIsOffline(false);
      void loadPayouts();
    };

    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [loadPayouts]);

  useEffect(() => {
    if (!payoutId) {
      setDetailPayout(null);
      setDetailLoading(false);
      return;
    }

    const existingPayout = payouts.find(
      (payout) => payout._id === payoutId,
    );

    if (existingPayout) {
      setDetailPayout(existingPayout);
      setDetailLoading(false);
      return;
    }

    if (loading || isOffline) return;

    let cancelled = false;

    const loadSinglePayout = async () => {
      setDetailLoading(true);
      setError('');

      try {
        const response = await http.get<
          ApiResponse | Payout | PayoutBatch[]
        >(`/admin/payouts/${encodeURIComponent(payoutId)}`);

        const payout = extractSinglePayout(response.data);

        if (!payout) {
          throw new Error('Payout not found.');
        }

        if (payout._id !== payoutId) {
          throw new Error('The API returned a different payout.');
        }

        if (!cancelled) {
          setDetailPayout(payout);
          setPayouts((current) => {
            const alreadyExists = current.some(
              (item) => item._id === payout._id,
            );

            return alreadyExists
              ? current.map((item) =>
                  item._id === payout._id ? payout : item,
                )
              : [...current, payout];
          });
        }
      } catch (err) {
        if (!cancelled) {
          setDetailPayout(null);
          setError(getErrorMessage(err));
        }
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    };

    void loadSinglePayout();

    return () => {
      cancelled = true;
    };
  }, [payoutId, payouts, loading, isOffline]);

  const filteredPayouts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return payouts.filter((payout) => {
      const status = normalizeStatus(payout.status);
      const matchesStatus =
        statusFilter === 'all' || status === statusFilter;

      const matchesSearch =
        !query ||
        getPartnerName(payout).toLowerCase().includes(query) ||
        payout._id.toLowerCase().includes(query) ||
        getBatchId(payout).toLowerCase().includes(query) ||
        getPartnerEmail(payout).toLowerCase().includes(query);

      return matchesStatus && matchesSearch;
    });
  }, [payouts, search, statusFilter]);

  const totals = useMemo(
    () =>
      payouts.reduce(
        (result, payout) => {
          const amount = getPayoutAmount(payout);
          const status = normalizeStatus(payout.status);

          result.total += amount;

          if (status === 'paid') {
            result.paid += amount;
          } else if (status === 'failed') {
            result.failed += amount;
          } else {
            result.pending += amount;
          }

          return result;
        },
        { total: 0, paid: 0, pending: 0, failed: 0 },
      ),
    [payouts],
  );

  const updateStatus = async (
    payout: Payout,
    nextStatus: PayoutStatus,
  ) => {
    if (updatingId || isOffline) return;
    if (normalizeStatus(payout.status) === nextStatus) return;

    const confirmed = window.confirm(
      `Are you sure you want to change this payout to "${nextStatus}"?`,
    );

    if (!confirmed) return;

    setUpdatingId(payout._id);
    setError('');

    try {
      await http.patch(
        `/admin/payouts/${encodeURIComponent(payout._id)}`,
        { status: nextStatus },
      );

      await loadPayouts();

      if (payoutId) {
        try {
          const response = await http.get<
            ApiResponse | Payout | PayoutBatch[]
          >(`/admin/payouts/${encodeURIComponent(payoutId)}`);

          const refreshedPayout = extractSinglePayout(response.data);

          if (refreshedPayout) {
            setDetailPayout(refreshedPayout);
          }
        } catch {
          // Keep the refreshed payout list if the detail request fails.
        }
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setUpdatingId(null);
    }
  };

  const exportCsv = async () => {
    if (exporting || isOffline || payouts.length === 0) return;

    setExporting(true);
    setError('');

    try {
      const response = await http.get<Blob>('/admin/payouts/export', {
        responseType: 'blob',
      });

      const blob = new Blob([response.data], {
        type: 'text/csv;charset=utf-8;',
      });

      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');

      anchor.href = url;
      anchor.download = `homecarex-payouts-${new Date()
        .toISOString()
        .slice(0, 10)}.csv`;

      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('all');
  };

  const openDetails = (payout: Payout) => {
    setError('');
    navigate(`/admin/payouts/${encodeURIComponent(payout._id)}`);
  };

  const closeDetails = () => {
    setError('');
    navigate('/admin/payouts');
  };

  useEffect(() => {
    if (!payoutId) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeDetails();
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [payoutId]);

  return (
    <main className="admin-page-container payout-page">
      {!payoutId ? (
        <>
          <header className="payout-page-header">
            <div className="payout-heading">
              <h1>Payouts</h1>
              <p className="payout-subtitle">
                Review partner payouts, manage payment status, and export records.
              </p>
            </div>

            <div className="payout-header-actions">
              <button
                type="button"
                onClick={() => void loadPayouts()}
                disabled={loading}
                className="payout-button payout-button-secondary"
              >
                {loading ? 'Refreshing…' : 'Refresh'}
              </button>

              <button
                type="button"
                onClick={() => void exportCsv()}
                disabled={
                  exporting || loading || isOffline || payouts.length === 0
                }
                className="payout-button payout-button-primary"
              >
                {exporting ? 'Exporting…' : 'Export CSV'}
              </button>
            </div>
          </header>

          {isOffline && (
            <div className="payout-alert payout-alert-warning" role="status">
              You are offline. Reconnect to load or update payout records.
            </div>
          )}

          {error && (
            <div className="payout-alert payout-alert-error" role="alert">
              <span>{error}</span>
              <button
                type="button"
                onClick={() => void loadPayouts()}
                className="payout-text-button"
              >
                Try again
              </button>
            </div>
          )}

          <section className="payout-summary-grid" aria-label="Payout summary">
            <SummaryCard
              label="Total payout value"
              value={formatCurrency(totals.total)}
              variant="indigo"
            />
            <SummaryCard
              label="Paid"
              value={formatCurrency(totals.paid)}
              variant="green"
            />
            <SummaryCard
              label="Pending / processing"
              value={formatCurrency(totals.pending)}
              variant="amber"
            />
            <SummaryCard
              label="Failed"
              value={formatCurrency(totals.failed)}
              variant="red"
            />
          </section>

          <section className="payout-table-card">
            <div className="payout-filter-bar">
              <label className="payout-field payout-search-field">
                <span>Search payouts</span>
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Partner, email, payout ID, or batch ID"
                />
              </label>

              <label className="payout-field payout-status-field">
                <span>Filter by status</span>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                >
                  <option value="all">All statuses</option>
                  {PAYOUT_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {loading ? (
              <div className="payout-state" role="status">
                <span className="payout-spinner" aria-hidden="true" />
                <p>Loading payout records…</p>
              </div>
            ) : filteredPayouts.length === 0 ? (
              <div className="payout-state">
                <h2>No payouts found</h2>
                <p>
                  {payouts.length === 0
                    ? 'Payout records will appear here when available.'
                    : 'Try changing your search or status filter.'}
                </p>

                {(search || statusFilter !== 'all') && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="payout-button payout-button-secondary"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            ) : (
              <div className="payout-table-scroll">
                <table className="payout-table">
                  <thead>
                    <tr>
                      <TableHeader>Partner</TableHeader>
                      <TableHeader>Period</TableHeader>
                      <TableHeader>Gross</TableHeader>
                      <TableHeader>Commission</TableHeader>
                      <TableHeader>Net payout</TableHeader>
                      <TableHeader>Status</TableHeader>
                      <TableHeader>Batch</TableHeader>
                      <TableHeader>Paid date</TableHeader>
                      <TableHeader>Actions</TableHeader>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredPayouts.map((payout) => {
                      const status = normalizeStatus(payout.status);
                      const busy = updatingId === payout._id;

                      return (
                        <tr key={payout._id}>
                          <td className="payout-partner-cell">
                            <strong className="payout-partner-name">
                              {getPartnerName(payout)}
                            </strong>
                            <span className="payout-id" title={payout._id}>
                              {payout._id}
                            </span>
                          </td>

                          <td className="payout-period-cell">
                            <span>{formatDate(payout.periodStart)}</span>
                            <span className="payout-period-separator">to</span>
                            <span>{formatDate(payout.periodEnd)}</span>
                          </td>

                          <td className="payout-nowrap">
                            {formatCurrency(payout.gross)}
                          </td>

                          <td className="payout-nowrap">
                            {formatCurrency(payout.commission)}
                          </td>

                          <td className="payout-amount payout-nowrap">
                            {formatCurrency(getPayoutAmount(payout))}
                          </td>

                          <td>
                            <StatusBadge status={status} />
                          </td>

                          <td>
                            <span
                              className="payout-batch-id"
                              title={getBatchId(payout)}
                            >
                              {getBatchId(payout)}
                            </span>
                          </td>

                          <td className="payout-nowrap">
                            {formatDate(payout.paidAt)}
                          </td>

                          <td>
                            <div className="payout-row-actions">
                              <button
                                type="button"
                                onClick={() => openDetails(payout)}
                                className="payout-view-button"
                              >
                                View details
                              </button>

                              <label
                                className="payout-sr-only"
                                htmlFor={`status-${payout._id}`}
                              >
                                Update status for {getPartnerName(payout)}
                              </label>

                              <select
                                id={`status-${payout._id}`}
                                value={status}
                                disabled={busy || isOffline}
                                onChange={(event) => {
                                  const nextStatus = event.target.value;

                                  if (
                                    PAYOUT_STATUSES.includes(
                                      nextStatus as PayoutStatus,
                                    )
                                  ) {
                                    void updateStatus(
                                      payout,
                                      nextStatus as PayoutStatus,
                                    );
                                  }
                                }}
                                className="payout-row-status-select"
                              >
                                {PAYOUT_STATUSES.map((option) => (
                                  <option key={option} value={option}>
                                    {option.charAt(0).toUpperCase() +
                                      option.slice(1)}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {busy && (
                              <span className="payout-updating">
                                Updating…
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <footer className="payout-table-footer">
              <span>
                Showing <strong>{filteredPayouts.length}</strong> of{' '}
                <strong>{payouts.length}</strong> loaded records
              </span>
              <span>Amounts shown in INR</span>
            </footer>
          </section>
        </>
      ) : (
        <section className="payout-details-page">
          <button
            type="button"
            onClick={closeDetails}
            className="payout-back-link"
          >
            <span aria-hidden="true">←</span> Back to Payouts
          </button>

          {detailLoading && !selectedPayout ? (
            <div className="payout-state" role="status">
              <span className="payout-spinner" aria-hidden="true" />
              <p>Loading payout details…</p>
            </div>
          ) : !selectedPayout ? (
            <div className="payout-state">
              <h2>Payout not found</h2>
              <p>
                {error ||
                  'The payout could not be loaded. It may have been removed or the ID may be invalid.'}
              </p>
              <button
                type="button"
                onClick={() => {
                  setError('');
                  void loadPayouts();
                }}
                className="payout-button payout-button-secondary"
              >
                Try again
              </button>
            </div>
          ) : (
            <>
              <header className="payout-details-page-header">
                <div>
                  <h1>Payout details</h1>
                  <p className="payout-subtitle">
                    Review the partner, payout amounts, and payout status.
                  </p>
                </div>

                <StatusBadge
                  status={normalizeStatus(selectedPayout.status)}
                />
              </header>

              {error && (
                <div className="payout-alert payout-alert-error" role="alert">
                  <span>{error}</span>
                  <button
                    type="button"
                    onClick={() => void loadPayouts()}
                    className="payout-text-button"
                  >
                    Refresh list
                  </button>
                </div>
              )}

              <section
                className="payout-detail-summary-grid"
                aria-label="Payout amounts"
              >
                <DetailSummaryCard
                  label="Net payout"
                  value={formatCurrency(getPayoutAmount(selectedPayout))}
                  description="Amount payable to partner"
                  variant="indigo"
                />
                <DetailSummaryCard
                  label="Gross amount"
                  value={formatCurrency(selectedPayout.gross)}
                  description="Before commission"
                  variant="blue"
                />
                <DetailSummaryCard
                  label="Commission"
                  value={formatCurrency(selectedPayout.commission)}
                  description="Commission deducted"
                  variant="purple"
                />
              </section>

              <section className="payout-details-columns">
                <article className="payout-detail-card">
                  <div className="payout-detail-card-heading">
                    <div>
                      <h2>Partner details</h2>
                      <p>Partner associated with this payout.</p>
                    </div>
                    <span className="payout-card-icon" aria-hidden="true">
                      P
                    </span>
                  </div>

                  <div className="payout-partner-profile">
                    <div className="payout-avatar" aria-hidden="true">
                      {getPartnerName(selectedPayout)
                        .split(/\s+/)
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((part) => part.charAt(0).toUpperCase())
                        .join('') || 'P'}
                    </div>

                    <div className="payout-partner-profile-text">
                      <h3>{getPartnerName(selectedPayout)}</h3>
                      <p>{getPartnerEmail(selectedPayout)}</p>
                    </div>
                  </div>

                  <dl className="payout-info-list">
                    <InfoRow
                      label="Payout ID"
                      value={selectedPayout._id}
                    />
                    <InfoRow
                      label="Partner email"
                      value={getPartnerEmail(selectedPayout)}
                    />
                    <InfoRow
                      label="Partner phone"
                      value={getPartnerPhone(selectedPayout)}
                    />
                    <InfoRow
                      label="Batch ID"
                      value={getBatchId(selectedPayout)}
                    />
                    <InfoRow
                      label="Period start"
                      value={formatDate(selectedPayout.periodStart)}
                    />
                    <InfoRow
                      label="Period end"
                      value={formatDate(selectedPayout.periodEnd)}
                    />
                    <InfoRow
                      label="Created on"
                      value={formatDateTime(selectedPayout.createdAt)}
                    />
                    <InfoRow
                      label="Last updated"
                      value={formatDateTime(selectedPayout.updatedAt)}
                    />
                  </dl>
                </article>

                <article className="payout-detail-card">
                  <div className="payout-detail-card-heading">
                    <div>
                      <h2>Payment details</h2>
                      <p>Amounts and payment status for this payout.</p>
                    </div>
                    <span className="payout-card-icon" aria-hidden="true">
                      ₹
                    </span>
                  </div>

                  <div className="payout-payment-highlight">
                    <span>Net payout amount</span>
                    <strong>
                      {formatCurrency(getPayoutAmount(selectedPayout))}
                    </strong>
                    <StatusBadge
                      status={normalizeStatus(selectedPayout.status)}
                    />
                  </div>

                  <dl className="payout-info-list">
                    <InfoRow
                      label="Payment status"
                      value={
                        normalizeStatus(selectedPayout.status)
                          .charAt(0)
                          .toUpperCase() +
                        normalizeStatus(selectedPayout.status).slice(1)
                      }
                    />
                    <InfoRow
                      label="Gross amount"
                      value={formatCurrency(selectedPayout.gross)}
                    />
                    <InfoRow
                      label="Commission"
                      value={formatCurrency(selectedPayout.commission)}
                    />
                    <InfoRow
                      label="Net payout"
                      value={formatCurrency(getPayoutAmount(selectedPayout))}
                    />
                    <InfoRow
                      label="Paid date"
                      value={formatDateTime(selectedPayout.paidAt)}
                    />
                  </dl>

                  <div className="payout-detail-status-control">
                    <label
                      className="payout-field"
                      htmlFor="payout-detail-status"
                    >
                      <span>Update payout status</span>
                      <select
                        id="payout-detail-status"
                        value={normalizeStatus(selectedPayout.status)}
                        disabled={
                          updatingId === selectedPayout._id || isOffline
                        }
                        onChange={(event) => {
                          const nextStatus = event.target.value;

                          if (
                            PAYOUT_STATUSES.includes(
                              nextStatus as PayoutStatus,
                            )
                          ) {
                            void updateStatus(
                              selectedPayout,
                              nextStatus as PayoutStatus,
                            );
                          }
                        }}
                      >
                        {PAYOUT_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {status.charAt(0).toUpperCase() +
                              status.slice(1)}
                          </option>
                        ))}
                      </select>
                    </label>

                    {updatingId === selectedPayout._id && (
                      <span className="payout-updating" role="status">
                        Updating payout status…
                      </span>
                    )}

                    {isOffline && (
                      <p className="payout-inline-warning">
                        Reconnect to update this payout.
                      </p>
                    )}
                  </div>
                </article>
              </section>

              <footer className="payout-details-footer">
                <button
                  type="button"
                  onClick={closeDetails}
                  className="payout-button payout-button-secondary"
                >
                  Back to payouts
                </button>
                <p>HomeCareX Admin · Payout management</p>
              </footer>
            </>
          )}
        </section>
      )}
=======
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { http } from "@/lib/http";
import "./index.css";

type BatchStatus = "Pending" | "Processing" | "Completed" | "Failed";
type PayoutStatus = "Pending" | "Processing" | "Paid" | "Failed";

interface PayoutBatch {
  id: string;
  periodStart: string;
  periodEnd: string;
  gross: number;
  commission: number;
  net: number;
  status: BatchStatus;
  createdAt: string;
  updatedAt: string;
  payoutIds: string[];
  raw: Record<string, any>;
}

interface IndividualPayout {
  id: string;
  partnerId: string;
  partnerName: string;
  partnerEmail: string;
  amount: number;
  gross: number;
  commission: number;
  status: PayoutStatus;
  paidAt: string;
  createdAt: string;
  raw: Record<string, any>;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

const PAGE_SIZE = 20;

const asObject = (value: unknown): Record<string, any> =>
  value !== null && typeof value === "object"
    ? (value as Record<string, any>)
    : {};

const firstValue = (...values: unknown[]): string => {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value);
    }
  }
  return "";
};

const getErrorMessage = (error: any): string =>
  firstValue(
    error?.response?.data?.message,
    error?.response?.data?.error,
    error?.message,
    "Something went wrong. Please try again."
  );

const getPayload = (response: any): any => {
  const body = response?.data ?? response;
  return body?.data ?? body;
};

const extractArray = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value;

  const payload = asObject(value);

  for (const key of ["items", "payouts", "results", "records"]) {
    if (Array.isArray(payload[key])) return payload[key];
  }

  return [];
};

const normalizeBatchStatus = (value: unknown): BatchStatus => {
  const status = String(value ?? "").toLowerCase();

  if (["completed", "complete", "paid", "success", "successful"].includes(status)) {
    return "Completed";
  }

  if (["processing", "in_progress", "initiated"].includes(status)) {
    return "Processing";
  }

  if (["failed", "failure", "error"].includes(status)) {
    return "Failed";
  }

  return "Pending";
};

const normalizePayoutStatus = (value: unknown): PayoutStatus => {
  const status = String(value ?? "").toLowerCase();

  if (["paid", "completed", "success", "successful"].includes(status)) {
    return "Paid";
  }

  if (["processing", "in_progress", "initiated"].includes(status)) {
    return "Processing";
  }

  if (["failed", "failure", "error"].includes(status)) {
    return "Failed";
  }

  return "Pending";
};

const normalizeBatch = (item: unknown): PayoutBatch => {
  const raw = asObject(item);

  return {
    id: firstValue(raw._id, raw.id, raw.batchId),
    periodStart: firstValue(raw.periodStart, raw.startDate, raw.period?.from),
    periodEnd: firstValue(raw.periodEnd, raw.endDate, raw.period?.to),
    gross: Number(raw.gross ?? 0),
    commission: Number(raw.commission ?? 0),
    net: Number(raw.net ?? 0),
    status: normalizeBatchStatus(raw.status),
    createdAt: firstValue(raw.createdAt),
    updatedAt: firstValue(raw.updatedAt),
    payoutIds: Array.isArray(raw.payoutIds)
      ? raw.payoutIds.map((id: unknown) =>
          typeof id === "object" ? firstValue(asObject(id)._id, asObject(id).id) : String(id)
        )
      : [],
    raw,
  };
};

const normalizePayout = (item: unknown): IndividualPayout => {
  const raw = asObject(item);
  const partner = asObject(raw.partnerId ?? raw.partner ?? raw.partnerDetails);

  const amountValue = Number(
    raw.amountInPaise ??
      raw.amountPaise ??
      raw.netAmountInPaise ??
      raw.amount ??
      raw.net ??
      raw.netAmount ??
      0
  );

  const amount =
    raw.amountInPaise != null ||
    raw.amountPaise != null ||
    raw.netAmountInPaise != null
      ? amountValue / 100
      : amountValue;

  return {
    id: firstValue(raw._id, raw.id, raw.payoutId),
    partnerId: firstValue(
      typeof raw.partnerId === "object" ? partner._id : raw.partnerId,
      partner.id,
      raw.userId
    ),
    partnerName: firstValue(
      raw.partnerName,
      partner.name,
      partner.fullName,
      partner.businessName,
      "Partner"
    ),
    partnerEmail: firstValue(raw.partnerEmail, partner.email),
    amount: Number.isFinite(amount) ? amount : 0,
    gross: Number(raw.gross ?? 0),
    commission: Number(raw.commission ?? 0),
    status: normalizePayoutStatus(raw.status ?? raw.payoutStatus),
    paidAt: firstValue(raw.paidAt),
    createdAt: firstValue(raw.createdAt),
    raw,
  };
};

const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);

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

const shortId = (value: string, length = 18): string => {
  if (!value) return "—";
  if (value.length <= length) return value;
  return `${value.slice(0, 8)}…${value.slice(-5)}`;
};

const statusClass = (status: BatchStatus | PayoutStatus): string => {
  const classes: Record<string, string> = {
    Pending: "payout-status-pending",
    Processing: "payout-status-processing",
    Paid: "payout-status-paid",
    Completed: "payout-status-paid",
    Failed: "payout-status-failed",
  };

  return `payout-status-badge ${classes[status] ?? classes.Pending}`;
};


export const AdminPayoutsPage: React.FC = () => {
  const navigate = useNavigate();
  const { id: routeId } = useParams<{ id: string }>();

  const [batches, setBatches] = useState<PayoutBatch[]>([]);
  const [individualPayouts, setIndividualPayouts] = useState<IndividualPayout[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    pages: 0,
  });

  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [page, setPage] = useState(1);
  const [updatingId, setUpdatingId] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

  const loadBatches = useCallback(async () => {
    setLoading(true);
    setLoadError("");

    try {
      const response = await http.get(
        `/admin/payouts?page=${page}&limit=${PAGE_SIZE}`
      );

      const payload = getPayload(response);
      const rows = extractArray(payload).map(normalizeBatch);

      setBatches(rows);

      const serverPagination = asObject(payload?.pagination);
      setPagination({
        page: Number(serverPagination.page ?? page),
        limit: Number(serverPagination.limit ?? PAGE_SIZE),
        total: Number(serverPagination.total ?? rows.length),
        pages: Number(
          serverPagination.pages ??
            Math.ceil(Number(serverPagination.total ?? rows.length) / PAGE_SIZE)
        ),
      });
    } catch (error) {
      setLoadError(getErrorMessage(error));
      setBatches([]);
      setPagination({
        page,
        limit: PAGE_SIZE,
        total: 0,
        pages: 0,
      });
    } finally {
      setLoading(false);
    }
  }, [page]);

  const loadBatchDetails = useCallback(async (batchId: string) => {
    setDetailLoading(true);
    setLoadError("");
    setIndividualPayouts([]);

    try {
      const [batchResponse, payoutsResponse] = await Promise.all([
        http.get(`/admin/payouts/${encodeURIComponent(batchId)}`),
        http.get(`/admin/payouts/${encodeURIComponent(batchId)}/payouts`),
      ]);

      const batchPayload = getPayload(batchResponse);
      const payoutPayload = getPayload(payoutsResponse);

      const batchData =
        batchPayload?.batch ??
        batchPayload?.item ??
        batchPayload?.data ??
        batchPayload;

      const normalizedBatch = normalizeBatch(batchData);

      setBatches((current) => {
        const exists = current.some((item) => item.id === normalizedBatch.id);
        return exists
          ? current.map((item) =>
              item.id === normalizedBatch.id ? normalizedBatch : item
            )
          : [normalizedBatch, ...current];
      });

      setIndividualPayouts(
        extractArray(payoutPayload).map(normalizePayout)
      );
    } catch (error) {
      setLoadError(getErrorMessage(error));
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!routeId) {
      void loadBatches();
    }
  }, [routeId, loadBatches]);

  useEffect(() => {
    if (routeId) {
      void loadBatchDetails(routeId);
    }
  }, [routeId, loadBatchDetails]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  const filteredBatches = useMemo(() => {
    const query = search.trim().toLowerCase();

    return batches.filter((batch) => {
      const matchesSearch =
        !query ||
        [
          batch.id,
          batch.status,
          batch.periodStart,
          batch.periodEnd,
          String(batch.gross),
          String(batch.commission),
          String(batch.net),
        ].some((value) => value.toLowerCase().includes(query));

      const matchesStatus =
        statusFilter === "All" || batch.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [batches, search, statusFilter]);

  const pendingBatches = batches.filter((batch) => batch.status === "Pending");
  const processingBatches = batches.filter(
    (batch) => batch.status === "Processing"
  );
  const completedBatches = batches.filter(
    (batch) => batch.status === "Completed"
  );
  const failedBatches = batches.filter((batch) => batch.status === "Failed");

  const goBack = () => navigate("/admin/payouts");

  const openDetails = (batch: PayoutBatch) => {
    if (!batch.id) {
      setActionError("This payout batch does not have a valid ID.");
      return;
    }

    navigate(`/admin/payouts/${encodeURIComponent(batch.id)}`);
  };

  const exportBatchCsv = async (batchId?: string) => {
    setActionError("");
    setActionSuccess("");

    try {
      const endpoint = batchId
        ? `/admin/payouts/${encodeURIComponent(batchId)}/export`
        : "/admin/payouts/export";

      const response = await http.get(endpoint, {
        responseType: "blob",
      });

      const blob =
        response.data instanceof Blob
          ? response.data
          : new Blob([response.data], { type: "text/csv;charset=utf-8;" });

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = batchId
        ? `homecarex-payout-batch-${batchId}.csv`
        : "homecarex-payouts.csv";

      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      setActionError(getErrorMessage(error));
    }
  };

  const markPayoutPaid = async (payout: IndividualPayout) => {
    if (!payout.id || updatingId) return;

    if (
      payout.status === "Paid" ||
      !window.confirm(`Mark payout ${payout.id} as paid?`)
    ) {
      return;
    }

    setUpdatingId(payout.id);
    setActionError("");
    setActionSuccess("");

    try {
      await http.patch(
        `/admin/payouts/${encodeURIComponent(payout.id)}`,
        {}
      );

      setActionSuccess("Payout marked as paid.");
      if (routeId) {
        await loadBatchDetails(routeId);
      }
    } catch (error) {
      setActionError(getErrorMessage(error));
    } finally {
      setUpdatingId("");
    }
  };

  if (routeId) {
    const batch = batches.find((item) => item.id === routeId);

    return (
      <main className="admin-page-container payout-page">
        <div className="payout-details-page">
          <button
            type="button"
            className="payout-back-link"
            onClick={goBack}
          >
            ← Back to payout batches
          </button>

          <header className="payout-details-page-header">
            <div>
              <div className="payout-breadcrumb">
                Admin <span>/</span> Finance <span>/</span> Payouts{" "}
                <span>/</span> Batch details
              </div>
              <h1>Payout batch details</h1>
              <p className="payout-subtitle">
                Review batch totals and the individual payouts included in this batch.
              </p>
            </div>
            {batch && (
              <span className={statusClass(batch.status)}>
                {batch.status}
              </span>
            )}
          </header>

          {loadError && (
            <div className="payout-alert payout-alert-error" role="alert">
              {loadError}
              <button
                type="button"
                className="payout-text-button"
                onClick={() => void loadBatchDetails(routeId)}
              >
                Retry
              </button>
            </div>
          )}

          {actionError && (
            <div className="payout-alert payout-alert-error" role="alert">
              {actionError}
            </div>
          )}

          {actionSuccess && (
            <div className="payout-alert payout-alert-warning" role="status">
              {actionSuccess}
            </div>
          )}

          {detailLoading && (
            <section className="payout-state" aria-live="polite">
              <span className="payout-spinner" />
              <h2>Loading batch details</h2>
            </section>
          )}

          {!detailLoading && batch && (
            <>
              <section className="payout-detail-summary-grid">
                <article className="payout-detail-summary-card payout-detail-indigo">
                  <span className="payout-summary-label">Gross amount</span>
                  <strong>{formatCurrency(batch.gross)}</strong>
                </article>
                <article className="payout-detail-summary-card payout-detail-blue">
                  <span className="payout-summary-label">Commission</span>
                  <strong>{formatCurrency(batch.commission)}</strong>
                </article>
                <article className="payout-detail-summary-card payout-detail-purple">
                  <span className="payout-summary-label">Net payout</span>
                  <strong>{formatCurrency(batch.net)}</strong>
                </article>
              </section>

              <section className="payout-detail-card">
                <h2>Batch information</h2>
                <dl className="payout-info-list">
                  <div className="payout-info-row">
                    <dt>Batch ID</dt>
                    <dd title={batch.id}>{batch.id}</dd>
                  </div>
                  <div className="payout-info-row">
                    <dt>Period start</dt>
                    <dd>{formatDate(batch.periodStart)}</dd>
                  </div>
                  <div className="payout-info-row">
                    <dt>Period end</dt>
                    <dd>{formatDate(batch.periodEnd)}</dd>
                  </div>
                  <div className="payout-info-row">
                    <dt>Created</dt>
                    <dd>{formatDate(batch.createdAt)}</dd>
                  </div>
                  <div className="payout-info-row">
                    <dt>Last updated</dt>
                    <dd>{formatDate(batch.updatedAt)}</dd>
                  </div>
                </dl>

                <button
                  type="button"
                  className="payout-button payout-button-secondary"
                  onClick={() => void exportBatchCsv(batch.id)}
                >
                  Export batch CSV
                </button>
              </section>

              <section className="payout-table-card">
                <header className="payout-page-header">
                  <div>
                    <h2>Individual payouts</h2>
                    <p className="payout-subtitle">
                      {individualPayouts.length} payout record(s) in this batch.
                    </p>
                  </div>
                </header>

                <div className="payout-table-scroll">
                  <table className="payout-table">
                    <thead>
                      <tr>
                        <th>Payout ID</th>
                        <th>Partner</th>
                        <th>Gross</th>
                        <th>Commission</th>
                        <th>Net amount</th>
                        <th>Status</th>
                        <th>Paid at</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {individualPayouts.map((payout) => (
                        <tr key={payout.id}>
                          <td>{shortId(payout.id)}</td>
                          <td>
                            <span className="payout-partner-name">
                              {payout.partnerName}
                            </span>
                            <span className="payout-id">
                              {payout.partnerEmail || payout.partnerId || "—"}
                            </span>
                          </td>
                          <td>{formatCurrency(payout.gross)}</td>
                          <td>{formatCurrency(payout.commission)}</td>
                          <td className="payout-amount">
                            {formatCurrency(payout.amount)}
                          </td>
                          <td>
                            <span className={statusClass(payout.status)}>
                              {payout.status}
                            </span>
                          </td>
                          <td>{formatDate(payout.paidAt)}</td>
                          <td>
                            <button
                              type="button"
                              className="payout-button payout-button-primary"
                              disabled={
                                payout.status === "Paid" ||
                                Boolean(updatingId)
                              }
                              onClick={() => void markPayoutPaid(payout)}
                            >
                              {updatingId === payout.id
                                ? "Updating…"
                                : payout.status === "Paid"
                                  ? "Paid"
                                  : "Mark paid"}
                            </button>
                          </td>
                        </tr>
                      ))}

                      {!detailLoading && individualPayouts.length === 0 && (
                        <tr>
                          <td colSpan={8}>
                            <div className="payout-state">
                              <h2>No payouts in this batch</h2>
                              <p>
                                The backend returned no individual payout records for this batch.
                              </p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="admin-page-container payout-page">
      <header className="payout-page-header">
        <div className="payout-heading">
          <div className="payout-breadcrumb">
            Admin <span>/</span> Finance <span>/</span> Payouts
          </div>
          <h1>Admin Payouts</h1>
          <p className="payout-subtitle">
            Review payout batches, track settlement progress, and inspect individual payout records.
          </p>
        </div>

        <div className="payout-header-actions">
          <button
            type="button"
            className="payout-button payout-button-secondary"
            onClick={() => void loadBatches()}
            disabled={loading}
          >
            {loading ? "Refreshing…" : "↻ Refresh"}
          </button>
          <button
            type="button"
            className="payout-button payout-button-primary"
            onClick={() => void exportBatchCsv()}
          >
            Export CSV
          </button>
        </div>
      </header>

      {loadError && (
        <div className="payout-alert payout-alert-error" role="alert">
          {loadError}
          <button
            type="button"
            className="payout-text-button"
            onClick={() => void loadBatches()}
          >
            Retry
          </button>
        </div>
      )}

      {actionError && (
        <div className="payout-alert payout-alert-error" role="alert">
          {actionError}
        </div>
      )}

      {actionSuccess && (
        <div className="payout-alert payout-alert-warning" role="status">
          {actionSuccess}
        </div>
      )}

      <section className="payout-summary-grid" aria-label="Payout summary">
        <article className="payout-summary-card">
          <p>Batches on this page</p>
          <strong>{batches.length}</strong>
        </article>
        <article className="payout-summary-card">
          <p>Pending batches</p>
          <strong>{pendingBatches.length}</strong>
        </article>
        <article className="payout-summary-card">
          <p>Processing batches</p>
          <strong>{processingBatches.length}</strong>
        </article>
        <article className="payout-summary-card">
          <p>Completed / Failed</p>
          <strong>{completedBatches.length} / {failedBatches.length}</strong>
        </article>
      </section>

      <section className="payout-table-card">
        <div className="payout-filter-bar">
          <label className="payout-field">
            <span>Search payout batches</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search batch ID or period..."
              aria-label="Search payout batches"
            />
          </label>

          <label className="payout-field payout-status-field">
            <span>Filter by status</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              aria-label="Filter by batch status"
            >
              <option value="All">All statuses</option>
              <option value="Pending">Pending</option>
              <option value="Processing">Processing</option>
              <option value="Completed">Completed</option>
              <option value="Failed">Failed</option>
            </select>
          </label>
        </div>

        {loading && (
          <div className="payout-state" aria-live="polite">
            <span className="payout-spinner" />
            <p>Loading payout batches…</p>
          </div>
        )}

        {!loading && (
          <div className="payout-table-scroll">
            <table className="payout-table">
              <thead>
                <tr>
                  <th>Batch ID</th>
                  <th>Period</th>
                  <th>Gross</th>
                  <th>Commission</th>
                  <th>Net payout</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredBatches.map((batch) => (
                  <tr key={batch.id}>
                    <td>
                      <span className="payout-partner-name">
                        {shortId(batch.id, 22)}
                      </span>
                    </td>
                    <td className="payout-period-cell">
                      {formatDate(batch.periodStart)}
                      <span className="payout-period-separator">→</span>
                      {formatDate(batch.periodEnd)}
                    </td>
                    <td>{formatCurrency(batch.gross)}</td>
                    <td>{formatCurrency(batch.commission)}</td>
                    <td className="payout-amount">
                      {formatCurrency(batch.net)}
                    </td>
                    <td>
                      <span className={statusClass(batch.status)}>
                        {batch.status}
                      </span>
                    </td>
                    <td>{formatDate(batch.createdAt)}</td>
                    <td>
                      <button
                        type="button"
                        className="payout-view-button"
                        onClick={() => openDetails(batch)}
                        disabled={!batch.id}
                      >
                        View details →
                      </button>
                    </td>
                  </tr>
                ))}

                {!loadError && filteredBatches.length === 0 && (
                  <tr>
                    <td colSpan={8}>
                      <div className="payout-state">
                        <h2>
                          {batches.length === 0
                            ? "No payout batches found"
                            : "No matching payout batches"}
                        </h2>
                        <p>
                          {batches.length === 0
                            ? "The API is responding, but it has not returned any payout batches. Create a demo batch only if this environment is intended for testing."
                            : "Try changing the search text or selecting All statuses."}
                        </p>
                        {batches.length > 0 && (
                          <button
                            type="button"
                            className="payout-button payout-button-secondary"
                            onClick={() => {
                              setSearch("");
                              setStatusFilter("All");
                            }}
                          >
                            Clear filters
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <footer className="payout-table-footer">
          <span>
            Showing <strong>{batches.length}</strong> batch(es) on this page
            {" · "}
            <strong>{pagination.total}</strong> total
          </span>

          <div className="payout-header-actions">
            <button
              type="button"
              className="payout-button payout-button-secondary"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page <= 1 || loading}
            >
              Previous
            </button>
            <span>
              Page {pagination.page} of {Math.max(1, pagination.pages)}
            </span>
            <button
              type="button"
              className="payout-button payout-button-secondary"
              onClick={() =>
                setPage((current) =>
                  Math.min(Math.max(1, pagination.pages), current + 1)
                )
              }
              disabled={
                loading ||
                pagination.pages === 0 ||
                page >= pagination.pages
              }
            >
              Next
            </button>
          </div>
        </footer>
      </section>
>>>>>>> origin/develop
    </main>
  );
};

<<<<<<< HEAD
interface SummaryCardProps {
  label: string;
  value: string;
  variant: 'indigo' | 'green' | 'amber' | 'red';
}

const SummaryCard: React.FC<SummaryCardProps> = ({
  label,
  value,
  variant,
}) => (
  <article className={`payout-summary-card payout-summary-${variant}`}>
    <p>{label}</p>
    <strong>{value}</strong>
  </article>
);

interface DetailSummaryCardProps {
  label: string;
  value: string;
  description: string;
  variant: 'indigo' | 'blue' | 'purple';
}

const DetailSummaryCard: React.FC<DetailSummaryCardProps> = ({
  label,
  value,
  description,
  variant,
}) => (
  <article className={`payout-detail-summary-card payout-detail-${variant}`}>
    <p className="payout-summary-label">{label}</p>
    <strong>{value}</strong>
    <p className="payout-summary-description">{description}</p>
  </article>
);

interface TableHeaderProps {
  children: React.ReactNode;
}

const TableHeader: React.FC<TableHeaderProps> = ({ children }) => (
  <th scope="col">{children}</th>
);

interface StatusBadgeProps {
  status: string;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => (
  <span
    className={`payout-status-badge payout-status-${normalizeStatus(status)}`}
  >
    <span className="payout-status-dot" aria-hidden="true" />
    {status.charAt(0).toUpperCase() + status.slice(1)}
  </span>
);

interface InfoRowProps {
  label: string;
  value: string;
}

const InfoRow: React.FC<InfoRowProps> = ({ label, value }) => (
  <div className="payout-info-row">
    <dt>{label}</dt>
    <dd title={value}>{value}</dd>
  </div>
);

export { AdminPayoutsPage };
export default AdminPayoutsPage;
=======
export default AdminPayoutsPage;
>>>>>>> origin/develop

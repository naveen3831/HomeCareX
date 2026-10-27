
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
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

  for (const key of ["items", "payouts", "batches", "results", "records"]) {
    if (Array.isArray(payload[key])) return payload[key];
  }

  return [];
};

const normalizeBatchStatus = (value: unknown): BatchStatus => {
  const status = String(value ?? "").toLowerCase();

  if (
    ["completed", "complete", "paid", "success", "successful"].includes(status)
  ) {
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

  if (
    ["paid", "completed", "success", "successful"].includes(status)
  ) {
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
  const period = asObject(raw.period);

  return {
    id: firstValue(raw._id, raw.id, raw.batchId),
    periodStart: firstValue(
      raw.periodStart,
      raw.startDate,
      period.from,
      period.start
    ),
    periodEnd: firstValue(
      raw.periodEnd,
      raw.endDate,
      period.to,
      period.end
    ),
    gross: Number(raw.gross ?? raw.grossAmount ?? 0),
    commission: Number(raw.commission ?? raw.commissionAmount ?? 0),
    net: Number(raw.net ?? raw.netAmount ?? 0),
    status: normalizeBatchStatus(raw.status),
    createdAt: firstValue(raw.createdAt),
    updatedAt: firstValue(raw.updatedAt),
    payoutIds: Array.isArray(raw.payoutIds)
      ? raw.payoutIds.map((id: unknown) =>
          typeof id === "object" && id !== null
            ? firstValue(asObject(id)._id, asObject(id).id)
            : String(id)
        )
      : [],
    raw,
  };
};

const normalizePayout = (item: unknown): IndividualPayout => {
  const raw = asObject(item);
  const partner = asObject(
    raw.partnerId ?? raw.partner ?? raw.partnerDetails
  );

  const amountInPaise =
    raw.amountInPaise ??
    raw.amountPaise ??
    raw.netAmountInPaise;

  const amountValue = Number(
    amountInPaise ??
      raw.amount ??
      raw.net ??
      raw.netAmount ??
      0
  );

  const amount =
    amountInPaise != null ? amountValue / 100 : amountValue;

  const partnerId =
    typeof raw.partnerId === "object" && raw.partnerId !== null
      ? firstValue(partner._id, partner.id)
      : firstValue(
          raw.partnerId,
          partner._id,
          partner.id,
          raw.userId
        );

  return {
    id: firstValue(raw._id, raw.id, raw.payoutId),
    partnerId,
    partnerName: firstValue(
      raw.partnerName,
      partner.name,
      partner.fullName,
      partner.businessName,
      "Partner"
    ),
    partnerEmail: firstValue(raw.partnerEmail, partner.email),
    amount: Number.isFinite(amount) ? amount : 0,
    gross: Number(raw.gross ?? raw.grossAmount ?? 0),
    commission: Number(raw.commission ?? raw.commissionAmount ?? 0),
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

  return value.length <= length
    ? value
    : `${value.slice(0, 8)}…${value.slice(-5)}`;
};

const statusClass = (
  status: BatchStatus | PayoutStatus
): string => {
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
  const [individualPayouts, setIndividualPayouts] = useState<
    IndividualPayout[]
  >([]);

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

      const rows = extractArray(payload)
        .map(normalizeBatch)
        .filter((batch) => Boolean(batch.id));

      setBatches(rows);

      const serverPagination = asObject(payload?.pagination);
      const total = Number(serverPagination.total ?? rows.length);

      setPagination({
        page: Number(serverPagination.page ?? page),
        limit: Number(serverPagination.limit ?? PAGE_SIZE),
        total,
        pages: Number(
          serverPagination.pages ?? Math.ceil(total / PAGE_SIZE)
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

    let normalizedBatch: PayoutBatch;

    try {
      const response = await http.get(
        `/admin/payouts/${encodeURIComponent(batchId)}`
      );

      const payload = getPayload(response);

      normalizedBatch = normalizeBatch(
        payload?.batch ?? payload?.item ?? payload
      );

      if (!normalizedBatch.id) {
        throw new Error(
          "The server returned invalid payout batch details."
        );
      }

      setBatches((current) => {
        const exists = current.some(
          (item) => item.id === normalizedBatch.id
        );

        return exists
          ? current.map((item) =>
              item.id === normalizedBatch.id
                ? normalizedBatch
                : item
            )
          : [normalizedBatch, ...current];
      });
    } catch (error) {
      setLoadError(getErrorMessage(error));
      setDetailLoading(false);
      return;
    }

    try {
      const response = await http.get(
        `/admin/payouts/${encodeURIComponent(batchId)}/payouts`
      );

      const payouts = extractArray(getPayload(response))
        .map(normalizePayout)
        .filter((payout) => Boolean(payout.id));

      setIndividualPayouts(payouts);
    } catch (error) {
      setLoadError(
        `Batch loaded, but individual payouts could not be loaded: ${getErrorMessage(error)}`
      );
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
      const values = [
        batch.id,
        batch.status,
        batch.periodStart,
        batch.periodEnd,
        String(batch.gross),
        String(batch.commission),
        String(batch.net),
      ];

      const matchesSearch =
        !query ||
        values.some((value) =>
          value.toLowerCase().includes(query)
        );

      const matchesStatus =
        statusFilter === "All" ||
        batch.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [batches, search, statusFilter]);

  const pendingBatches = batches.filter(
    (batch) => batch.status === "Pending"
  );

  const processingBatches = batches.filter(
    (batch) => batch.status === "Processing"
  );

  const completedBatches = batches.filter(
    (batch) => batch.status === "Completed"
  );

  const failedBatches = batches.filter(
    (batch) => batch.status === "Failed"
  );

  const goBack = () => navigate("/admin/payouts");

  const openDetails = (batch: PayoutBatch) => {
    if (!batch.id) {
      setActionError("This payout batch does not have a valid ID.");
      return;
    }

    setActionError("");
    navigate(`/admin/payouts/${encodeURIComponent(batch.id)}`);
  };

  const exportBatchCsv = async (batchId?: string) => {
    setActionError("");
    setActionSuccess("");

    let objectUrl = "";

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
          : new Blob([response.data], {
              type: "text/csv;charset=utf-8;",
            });

      objectUrl = URL.createObjectURL(blob);

      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = batchId
        ? `homecarex-payout-batch-${batchId}.csv`
        : "homecarex-payouts.csv";

      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } catch (error) {
      setActionError(getErrorMessage(error));
    } finally {
      if (objectUrl) {
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      }
    }
  };

  const markPayoutPaid = async (payout: IndividualPayout) => {
    if (!payout.id || updatingId || payout.status === "Paid") {
      return;
    }

    if (!window.confirm(`Mark payout ${payout.id} as paid?`)) {
      return;
    }

    setUpdatingId(payout.id);
    setActionError("");
    setActionSuccess("");

    try {
      await http.patch(
        `/admin/payouts/${encodeURIComponent(payout.id)}`,
        { status: "paid" }
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

  // Batch details view
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
            <span aria-hidden="true">←</span>
            Back to payout batches
          </button>

          <header className="payout-details-page-header">
            <div className="payout-details-heading">
              <h1>Payout batch details</h1>

              <p className="payout-subtitle">
                Review batch totals, settlement status, and the payouts
                included in this batch.
              </p>
            </div>

            {batch && (
              <span className={statusClass(batch.status)}>
                {batch.status}
              </span>
            )}
          </header>

          {loadError && (
            <div
              className="payout-alert payout-alert-error"
              role="alert"
            >
              <span>{loadError}</span>

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
            <div
              className="payout-alert payout-alert-error"
              role="alert"
            >
              {actionError}
            </div>
          )}

          {actionSuccess && (
            <div
              className="payout-alert payout-alert-success"
              role="status"
            >
              {actionSuccess}
            </div>
          )}

          {detailLoading && (
            <section className="payout-state" aria-live="polite">
              <span className="payout-spinner" />
              <h2>Loading batch details</h2>
              <p>
                Please wait while the batch and payout records are retrieved.
              </p>
            </section>
          )}

          {!detailLoading && !batch && !loadError && (
            <section className="payout-state">
              <h2>Batch not found</h2>
              <p>
                This payout batch could not be found. It may have been
                removed or the ID may be invalid.
              </p>

              <button
                type="button"
                className="payout-button payout-button-secondary"
                onClick={goBack}
              >
                Back to payout batches
              </button>
            </section>
          )}

          {!detailLoading && batch && (
            <>
              <section
                className="payout-detail-summary-grid"
                aria-label="Batch totals"
              >
                <article className="payout-detail-summary-card">
                  <span className="payout-summary-label">
                    Gross amount
                  </span>
                  <strong>{formatCurrency(batch.gross)}</strong>
                </article>

                <article className="payout-detail-summary-card">
                  <span className="payout-summary-label">
                    Commission
                  </span>
                  <strong>{formatCurrency(batch.commission)}</strong>
                </article>

                <article className="payout-detail-summary-card payout-net-card">
                  <span className="payout-summary-label">
                    Net payout
                  </span>
                  <strong>{formatCurrency(batch.net)}</strong>
                </article>
              </section>

              <section className="payout-detail-card payout-batch-information">
                <div className="payout-section-heading">
                  <div>
                    <h2>Batch information</h2>
                    <p>Period and audit timestamps for this batch.</p>
                  </div>

                  <button
                    type="button"
                    className="payout-button payout-button-secondary"
                    onClick={() => void exportBatchCsv(batch.id)}
                  >
                    <span aria-hidden="true">↓</span>
                    Export batch CSV
                  </button>
                </div>

                <dl className="payout-info-list">
                  <div className="payout-info-row">
                    <dt>Batch ID</dt>
                    <dd className="payout-mono" title={batch.id}>
                      {batch.id}
                    </dd>
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
              </section>

              <section className="payout-table-card payout-individual-card">
                <header className="payout-individual-header">
                  <div>
                    <h2>Individual payouts</h2>
                    <p>
                      {individualPayouts.length} payout record
                      {individualPayouts.length === 1 ? "" : "s"} in this batch
                    </p>
                  </div>

                  <span className="payout-record-count">
                    {individualPayouts.length} records
                  </span>
                </header>

                <div className="payout-table-scroll">
                  <table className="payout-table payout-individual-table">
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
                          <td className="payout-mono">
                            {shortId(payout.id)}
                          </td>

                          <td className="payout-partner-cell">
                            <span className="payout-partner-name">
                              {payout.partnerName}
                            </span>

                            <span className="payout-id">
                              {payout.partnerEmail || payout.partnerId || "—"}
                            </span>
                          </td>

                          <td className="payout-nowrap">
                            {formatCurrency(payout.gross)}
                          </td>

                          <td className="payout-nowrap">
                            {formatCurrency(payout.commission)}
                          </td>

                          <td className="payout-amount">
                            {formatCurrency(payout.amount)}
                          </td>

                          <td>
                            <span className={statusClass(payout.status)}>
                              {payout.status}
                            </span>
                          </td>

                          <td className="payout-nowrap">
                            {formatDate(payout.paidAt)}
                          </td>

                          <td>
                            <button
                              type="button"
                              className={`payout-button payout-button-small ${
                                payout.status === "Paid"
                                  ? "payout-button-paid"
                                  : "payout-button-secondary"
                              }`}
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
                            <div className="payout-state payout-empty-table">
                              <h2>No payouts in this batch</h2>
                              <p>
                                No individual payout records were returned
                                for this batch.
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

  // Batch list view
  return (
    <main className="admin-page-container payout-page">
      <header className="payout-page-header">
        <div className="payout-heading">
          {/* Intentionally omitted: the global admin layout renders the breadcrumb. */}
          <h1>Payouts</h1>

          <p className="payout-subtitle">
            Review payout batches, track settlement progress, and inspect
            individual payout records.
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
          <span>{loadError}</span>
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
        <div className="payout-alert payout-alert-success" role="status">
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
          <strong>
            {completedBatches.length} / {failedBatches.length}
          </strong>
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
              placeholder="Search batch ID or period…"
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
            <table className="payout-table payout-batches-table">
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
                    <td className="payout-mono">
                      {shortId(batch.id, 22)}
                    </td>

                    <td className="payout-period-cell">
                      {formatDate(batch.periodStart)}
                      <span className="payout-period-separator">→</span>
                      {formatDate(batch.periodEnd)}
                    </td>

                    <td className="payout-nowrap">
                      {formatCurrency(batch.gross)}
                    </td>

                    <td className="payout-nowrap">
                      {formatCurrency(batch.commission)}
                    </td>

                    <td className="payout-amount">
                      {formatCurrency(batch.net)}
                    </td>

                    <td>
                      <span className={statusClass(batch.status)}>
                        {batch.status}
                      </span>
                    </td>

                    <td className="payout-nowrap">
                      {formatDate(batch.createdAt)}
                    </td>

                    <td>
                      <button
                        type="button"
                        className="payout-view-button"
                        onClick={() => openDetails(batch)}
                        disabled={!batch.id}
                      >
                        View details <span aria-hidden="true">→</span>
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
                            ? "The API returned no payout batches."
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
            Showing <strong>{filteredBatches.length}</strong> matching
            batch(es) on this page · <strong>{pagination.total}</strong> total
          </span>

          <div className="payout-pagination">
            <button
              type="button"
              className="payout-button payout-button-secondary payout-button-small"
              onClick={() =>
                setPage((current) => Math.max(1, current - 1))
              }
              disabled={page <= 1 || loading}
            >
              Previous
            </button>

            <span>
              Page {pagination.page} of {Math.max(1, pagination.pages)}
            </span>

            <button
              type="button"
              className="payout-button payout-button-secondary payout-button-small"
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
    </main>
  );
};

export default AdminPayoutsPage;

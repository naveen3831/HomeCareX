
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { http } from "@/lib/http";
import "./index.css";

type RefundStatus =
  | "Pending"
  | "Approved"
  | "Rejected"
  | "Processing"
  | "Completed"
  | "Failed";

interface Refund {
  id: string;
  refundId: string;
  paymentId: string;
  bookingId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  amount: number;
  status: RefundStatus;
  method: string;
  reason: string;
  rejectionReason: string;
  failureMessage: string;
  razorpayRefundId: string;
  createdAt: string;
  updatedAt: string;
  raw: Record<string, unknown>;
}

const PAGE_SIZE = 10;

const asObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const firstValue = (...values: unknown[]): string => {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value);
    }
  }
  return "";
};

const normalizeStatus = (value: unknown): RefundStatus => {
  const status = String(value ?? "").toLowerCase();

  if (["requested", "pending", "initiated"].includes(status)) {
    return "Pending";
  }
  if (["approved", "accepted"].includes(status)) return "Approved";
  if (["rejected", "declined", "cancelled", "canceled"].includes(status)) {
    return "Rejected";
  }
  if (["processing", "in_progress", "created"].includes(status)) {
    return "Processing";
  }
  if (
    ["processed", "completed", "success", "successful"].includes(status)
  ) {
    return "Completed";
  }
  if (["failed", "failure", "error"].includes(status)) return "Failed";

  return "Pending";
};

const normalizeRefund = (item: unknown): Refund => {
  const raw = asObject(item);
  const payment = asObject(raw.payment ?? raw.paymentDetails);
  const booking = asObject(raw.booking);
  const customer = asObject(
    raw.customer ?? raw.user ?? booking.customer ?? booking.user,
  );

  const id = firstValue(
    raw._id,
    raw.id,
    raw.refundRequestId,
    raw.refund_id,
  );

  const amountValue =
    raw.refundAmount ??
    raw.amount ??
    raw.amountInPaise ??
    payment.refundAmount ??
    payment.amount ??
    0;

  const numericAmount = Number(amountValue);
  const amount =
    Number.isFinite(numericAmount) && numericAmount >= 0
      ? numericAmount
      : 0;

  return {
    id,
    refundId: firstValue(raw.refundId, raw.refund_id, raw._id, raw.id, id),
    paymentId: firstValue(
      raw.paymentId,
      payment._id,
      payment.id,
      payment.razorpayPaymentId,
      raw.razorpayPaymentId,
    ),
    bookingId: firstValue(
      raw.bookingId,
      booking.bookingId,
      booking._id,
      booking.id,
    ),
    customerName: firstValue(
      raw.customerName,
      customer.name,
      customer.fullName,
      raw.userName,
      "Customer",
    ),
    customerEmail: firstValue(raw.customerEmail, customer.email),
    customerPhone: firstValue(
      raw.customerPhone,
      customer.phone,
      customer.mobile,
    ),
    amount,
    status: normalizeStatus(
      raw.status ?? raw.refundStatus ?? payment.refundStatus,
    ),
    method: firstValue(
      raw.method,
      raw.paymentMethod,
      payment.method,
      payment.paymentMethod,
      payment.razorpayPaymentId ? "Razorpay" : "",
      "Wallet",
    ),
    reason: firstValue(
      raw.reason,
      raw.refundReason,
      raw.description,
      raw.customerReason,
      "No reason provided",
    ),
    rejectionReason: firstValue(raw.rejectionReason, raw.reviewNote),
    failureMessage: firstValue(
      raw.failureMessage,
      raw.errorMessage,
      raw.failureReason,
      payment.failureMessage,
    ),
    razorpayRefundId: firstValue(
      raw.razorpayRefundId,
      asObject(raw.refundDetails).razorpayRefundId,
      payment.razorpayRefundId,
    ),
    createdAt: firstValue(raw.createdAt, raw.requestedAt, raw.date),
    updatedAt: firstValue(raw.updatedAt, raw.processedAt),
    raw,
  };
};

const getErrorMessage = (error: unknown): string => {
  const errorObject = asObject(error);
  const response = asObject(errorObject.response);
  const data = asObject(response.data);
  return firstValue(
    data.message,
    data.error,
    errorObject.message,
    "Something went wrong. Please try again.",
  );
};

const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);

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

const shortId = (value: string, length = 15): string => {
  if (!value || value.length <= length) return value || "—";
  return `${value.slice(0, 7)}…${value.slice(-5)}`;
};

const getInitials = (name: string): string =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "C";

const statusClass = (status: RefundStatus): string =>
  `refund-status refund-status--${status.toLowerCase()}`;

const extractRefunds = (response: unknown): Refund[] => {
  const responseObject = asObject(response);
  const body = responseObject.data ?? response;
  const payload = asObject(body).data ?? body;
  if (Array.isArray(payload)) return payload.map(normalizeRefund);
  const payloadObject = asObject(payload);
  const rows =
    payloadObject.refunds ??
    payloadObject.items ??
    payloadObject.results ??
    payloadObject.requests;

  return Array.isArray(rows) ? rows.map(normalizeRefund) : [];
};

const extractTotal = (response: unknown, fallback: number): number => {
  const responseObject = asObject(response);
  const body = responseObject.data ?? response;
  const payload = asObject(body).data ?? body;
  const payloadObject = asObject(payload);
  const pagination = asObject(payloadObject.pagination);
  const meta = asObject(payloadObject.meta);
  const total = Number(
    payloadObject.total ??
      payloadObject.totalCount ??
      pagination.total ??
      meta.total,
  );

  return Number.isFinite(total) && total >= 0 ? total : fallback;
};

export const AdminRefundsPage: React.FC = () => {
  const navigate = useNavigate();
  const { id: routeId } = useParams<{ id: string }>();

  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState("");
  const [noticeType, setNoticeType] = useState<"success" | "error">("success");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [methodFilter, setMethodFilter] = useState("All");
  const [page, setPage] = useState(1);
  const [serverTotal, setServerTotal] = useState(0);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  const loadRefunds = useCallback(async () => {
    setLoading(true);
    setLoadError("");

    try {
      const response = await http.get("/admin/refunds?page=1&limit=100");
      const items = extractRefunds(response);
      setRefunds(items);
      setServerTotal(extractTotal(response, items.length));
    } catch (error) {
      setLoadError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRefunds();
  }, [loadRefunds]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, methodFilter]);

  const selectedRefund = useMemo(() => {
    if (!routeId) return undefined;

    let decodedId = routeId;
    try {
      decodedId = decodeURIComponent(routeId);
    } catch {
      // Keep the original route parameter if decoding fails.
    }

    return refunds.find(
      (refund) =>
        refund.id === decodedId ||
        refund.refundId === decodedId ||
        refund.razorpayRefundId === decodedId,
    );
  }, [refunds, routeId]);

  const filteredRefunds = useMemo(() => {
    const query = search.trim().toLowerCase();

    return refunds.filter((refund) => {
      const matchesSearch =
        !query ||
        [
          refund.refundId,
          refund.id,
          refund.paymentId,
          refund.bookingId,
          refund.customerName,
          refund.customerEmail,
          refund.customerPhone,
          refund.razorpayRefundId,
        ].some((value) => value.toLowerCase().includes(query));

      const matchesStatus =
        statusFilter === "All" || refund.status === statusFilter;

      const matchesMethod =
        methodFilter === "All" ||
        refund.method.toLowerCase() === methodFilter.toLowerCase();

      return matchesSearch && matchesStatus && matchesMethod;
    });
  }, [refunds, search, statusFilter, methodFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRefunds.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

  const visibleRefunds = filteredRefunds.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  const pendingCount = refunds.filter((r) => r.status === "Pending").length;
  const completedCount = refunds.filter(
    (r) => r.status === "Completed",
  ).length;
  const failedCount = refunds.filter((r) => r.status === "Failed").length;
  const pendingAmount = refunds
    .filter((r) => r.status === "Pending")
    .reduce((sum, r) => sum + r.amount, 0);
  const completedAmount = refunds
    .filter((r) => r.status === "Completed")
    .reduce((sum, r) => sum + r.amount, 0);

  const showNotice = (
    message: string,
    type: "success" | "error" = "success",
  ) => {
    setNotice(message);
    setNoticeType(type);
  };

  const openDetails = (refund: Refund) => {
    if (!refund.id) {
      showNotice("This refund does not have a valid ID.", "error");
      return;
    }

    navigate(`/admin/refunds/${encodeURIComponent(refund.id)}`);
  };

  const performAction = async (action: "approve" | "reject") => {
    if (!selectedRefund?.id || actionLoading) return;

    if (
      action === "reject" &&
      !rejectionReason.trim()
    ) {
      showNotice("Please enter a reason before rejecting this refund.", "error");
      return;
    }

    const message =
      action === "approve"
        ? "Approve this refund? If it uses Razorpay, this may initiate a real refund."
        : "Reject this refund request?";

    if (!window.confirm(message)) return;

    setActionLoading(true);
    setNotice("");

    try {
      await http.patch(
        `/admin/refunds/${encodeURIComponent(selectedRefund.id)}`,
        {
          action,
          ...(action === "reject"
            ? { rejectionReason: rejectionReason.trim() }
            : {}),
        },
      );

      showNotice(
        action === "approve"
          ? "Refund approval submitted successfully."
          : "Refund request rejected successfully.",
      );
      setRejectionReason("");
      await loadRefunds();
    } catch (error) {
      showNotice(getErrorMessage(error), "error");
    } finally {
      setActionLoading(false);
    }
  };

  const goBack = () => navigate("/admin/refunds");

  const renderStatus = (status: RefundStatus) => (
    <span className={statusClass(status)}>
      <span className="refund-status__dot" />
      {status}
    </span>
  );

  const renderHeader = (detail = false) => (
    <>
      {detail && (
        <button className="refunds-back-link" onClick={goBack} type="button">
          <span aria-hidden="true">←</span> Back to refunds
        </button>
      )}

      <header className="refunds-page__header">
        <div className="refunds-page__heading-copy">
          <h1 className="refunds-page__title">
            {detail ? "Refund details" : "Refunds"}
          </h1>
          <p className="refunds-page__subtitle">
            {detail
              ? "Review the refund request, payment information, and processing status."
              : "Review customer refund requests and track their payment status."}
          </p>
        </div>
      </header>
    </>
  );

  if (loading && refunds.length === 0) {
    return (
      <main className="refunds-page">
        {renderHeader()}
        <section className="refunds-panel refunds-loading" aria-live="polite">
          <span className="refunds-loading__spinner" />
          <span>Loading refund requests…</span>
        </section>
      </main>
    );
  }

  if (routeId) {
    if (loadError && refunds.length === 0) {
      return (
        <main className="refunds-page refunds-page--detail">
          {renderHeader(true)}
          <section className="refunds-panel refunds-error-state">
            <strong>Unable to load refund details</strong>
            <p>{loadError}</p>
            <button
              className="refunds-button refunds-button--primary"
              onClick={() => void loadRefunds()}
              type="button"
            >
              Try again
            </button>
          </section>
        </main>
      );
    }

    if (!selectedRefund && !loading) {
      return (
        <main className="refunds-page refunds-page--detail">
          {renderHeader(true)}
          <section className="refunds-panel refunds-not-found">
            <div className="refunds-empty-icon">?</div>
            <h1>Refund not found</h1>
            <p>
              This refund may have been removed or its identifier may be
              invalid. Return to the refunds list to select another request.
            </p>
            <button
              className="refunds-button refunds-button--primary"
              onClick={goBack}
              type="button"
            >
              Back to refunds
            </button>
          </section>
        </main>
      );
    }

    if (!selectedRefund) {
      return (
        <main className="refunds-page refunds-page--detail">
          {renderHeader(true)}
          <section className="refunds-panel refunds-loading">
            <span className="refunds-loading__spinner" />
            <span>Loading refund details…</span>
          </section>
        </main>
      );
    }

    const refund = selectedRefund;
    const canReview = refund.status === "Pending";

    return (
      <main className="refunds-page refunds-page--detail">
        {renderHeader(true)}

        {notice && (
          <div
            className={`refunds-alert refunds-alert--${noticeType}`}
            role="status"
          >
            <span>{notice}</span>
            <button
              type="button"
              className="refunds-button refunds-button--text"
              onClick={() => setNotice("")}
              aria-label="Dismiss notification"
            >
              Dismiss
            </button>
          </div>
        )}

        {loadError && (
          <div className="refunds-alert refunds-alert--error" role="alert">
            {loadError}
          </div>
        )}

        <section className="refunds-detail-summary">
          <article className="refunds-detail-amount-card refunds-detail-amount-card--highlight">
            <span>Refund amount</span>
            <strong>{formatCurrency(refund.amount)}</strong>
            <small>Requested refund value</small>
          </article>
          <article className="refunds-detail-amount-card">
            <span>Request status</span>
            <strong>{renderStatus(refund.status)}</strong>
            <small>Last updated {formatDate(refund.updatedAt || refund.createdAt)}</small>
          </article>
          <article className="refunds-detail-amount-card">
            <span>Refund reference</span>
            <strong className="refunds-mono refunds-reference" title={refund.refundId}>
              {shortId(refund.refundId, 22)}
            </strong>
            <small>Request identifier</small>
          </article>
        </section>

        <section className="refunds-detail-grid">
          <article className="refunds-panel refunds-detail-panel">
            <div className="refunds-panel__heading">
              <div>
                <h2>Customer information</h2>
                <p>Customer and booking details for this request.</p>
              </div>
            </div>
            <div className="refunds-detail-body">
              <div className="refunds-detail-customer">
                <span className="refunds-avatar refunds-avatar--large">
                  {getInitials(refund.customerName)}
                </span>
                <div>
                  <strong>{refund.customerName}</strong>
                  <p>{refund.customerEmail || "No email provided"}</p>
                </div>
              </div>
              <div className="refunds-detail-row">
                <span>Phone</span>
                <strong>{refund.customerPhone || "—"}</strong>
              </div>
              <div className="refunds-detail-row">
                <span>Booking ID</span>
                <strong className="refunds-mono" title={refund.bookingId}>
                  {shortId(refund.bookingId, 22)}
                </strong>
              </div>
              <div className="refunds-detail-row">
                <span>Requested on</span>
                <strong>{formatDate(refund.createdAt)}</strong>
              </div>
              <div className="refunds-detail-row">
                <span>Payment method</span>
                <strong>{refund.method}</strong>
              </div>
            </div>
          </article>

          <article className="refunds-panel refunds-detail-panel">
            <div className="refunds-panel__heading">
              <div>
                <h2>Payment information</h2>
                <p>References and gateway processing details.</p>
              </div>
            </div>
            <div className="refunds-detail-body">
              <div className="refunds-detail-row">
                <span>Payment ID</span>
                <strong className="refunds-mono" title={refund.paymentId}>
                  {shortId(refund.paymentId, 22)}
                </strong>
              </div>
              <div className="refunds-detail-row">
                <span>Razorpay refund ID</span>
                <strong className="refunds-mono" title={refund.razorpayRefundId}>
                  {shortId(refund.razorpayRefundId, 22) || "—"}
                </strong>
              </div>
              <div className="refunds-detail-row">
                <span>Created</span>
                <strong>{formatDate(refund.createdAt)}</strong>
              </div>
              <div className="refunds-detail-row">
                <span>Updated</span>
                <strong>{formatDate(refund.updatedAt)}</strong>
              </div>

              {refund.failureMessage && (
                <div className="refunds-review-note refunds-review-note--error">
                  <strong>Refund processing issue</strong>
                  <p>{refund.failureMessage}</p>
                </div>
              )}
              {refund.rejectionReason && (
                <div className="refunds-review-note">
                  <strong>Review note</strong>
                  <p>{refund.rejectionReason}</p>
                </div>
              )}
            </div>
          </article>

          <article className="refunds-panel refunds-detail-panel">
            <div className="refunds-panel__heading">
              <div>
                <h2>Reason for refund</h2>
                <p>Reason supplied with the customer request.</p>
              </div>
            </div>
            <div className="refunds-detail-body">
              <p className="refunds-reason">{refund.reason}</p>
            </div>
          </article>

          <article className="refunds-panel refunds-detail-panel">
            <div className="refunds-panel__heading">
              <div>
                <h2>Review request</h2>
                <p>
                  {canReview
                    ? "Approve the request or reject it with a reason."
                    : "This request is no longer awaiting review."}
                </p>
              </div>
            </div>
            <div className="refunds-detail-body">
              {canReview ? (
                <div className="refunds-review-form">
                  <label htmlFor="refund-rejection-reason">
                    Rejection reason
                  </label>
                  <textarea
                    id="refund-rejection-reason"
                    value={rejectionReason}
                    onChange={(event) => setRejectionReason(event.target.value)}
                    placeholder="Explain why this refund request should be rejected…"
                    maxLength={1000}
                    disabled={actionLoading}
                  />
                  <small>{rejectionReason.length}/1000 characters</small>

                  <p className="refunds-action-warning">
                    Approving a Razorpay refund may initiate a real payment
                    refund. Confirm the request before proceeding.
                  </p>

                  <div className="refunds-detail-actions">
                    <button
                      type="button"
                      className="refunds-button refunds-button--primary"
                      onClick={() => void performAction("approve")}
                      disabled={actionLoading}
                    >
                      {actionLoading ? "Processing…" : "Approve refund"}
                    </button>
                    <button
                      type="button"
                      className="refunds-button refunds-button--danger"
                      onClick={() => void performAction("reject")}
                      disabled={actionLoading || !rejectionReason.trim()}
                    >
                      {actionLoading ? "Processing…" : "Reject request"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="refunds-review-note">
                  <strong>Current status: {refund.status}</strong>
                  <p>
                    Approve and reject actions are available only for pending
                    requests.
                  </p>
                </div>
              )}
            </div>
          </article>
        </section>
      </main>
    );
  }

  return (
    <main className="refunds-page">
      {renderHeader()}

      {notice && (
        <div
          className={`refunds-alert refunds-alert--${noticeType}`}
          role="status"
        >
          <span>{notice}</span>
          <button
            type="button"
            className="refunds-button refunds-button--text"
            onClick={() => setNotice("")}
            aria-label="Dismiss notification"
          >
            Dismiss
          </button>
        </div>
      )}

      {loadError && (
        <div className="refunds-alert refunds-alert--error" role="alert">
          <span>{loadError}</span>
          <button
            type="button"
            className="refunds-button refunds-button--secondary"
            onClick={() => void loadRefunds()}
          >
            Try again
          </button>
        </div>
      )}

      <section className="refunds-stats" aria-label="Refund summary">
        <article className="refunds-stat-card">
          <div className="refunds-stat-card__top">
            <span className="refunds-stat-card__label">Total requests</span>
            <span className="refunds-stat-card__icon">↗</span>
          </div>
          <div className="refunds-stat-card__value">{serverTotal}</div>
          <div className="refunds-stat-card__hint">Refund requests returned by the API</div>
        </article>

        <article className="refunds-stat-card refunds-stat-card--pending">
          <div className="refunds-stat-card__top">
            <span className="refunds-stat-card__label">Pending review</span>
            <span className="refunds-stat-card__icon">◷</span>
          </div>
          <div className="refunds-stat-card__value">{pendingCount}</div>
          <div className="refunds-stat-card__hint">
            {formatCurrency(pendingAmount)} awaiting review
          </div>
        </article>

        <article className="refunds-stat-card refunds-stat-card--completed">
          <div className="refunds-stat-card__top">
            <span className="refunds-stat-card__label">Completed</span>
            <span className="refunds-stat-card__icon">✓</span>
          </div>
          <div className="refunds-stat-card__value">{completedCount}</div>
          <div className="refunds-stat-card__hint">
            {formatCurrency(completedAmount)} completed
          </div>
        </article>

        <article className="refunds-stat-card refunds-stat-card--failed">
          <div className="refunds-stat-card__top">
            <span className="refunds-stat-card__label">Failed</span>
            <span className="refunds-stat-card__icon">!</span>
          </div>
          <div className="refunds-stat-card__value">{failedCount}</div>
          <div className="refunds-stat-card__hint">Requests with processing failures</div>
        </article>
      </section>

      <section className="refunds-panel">
        <div className="refunds-panel__heading">
          <div>
            <h2>Refund requests</h2>
            <p>Search, filter, and review refund activity.</p>
          </div>
          <span className="refunds-result-count">
            {filteredRefunds.length} result{filteredRefunds.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className="refunds-filters">
          <label className="refunds-search">
            <span aria-hidden="true">⌕</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search refund, booking, payment or customer"
              aria-label="Search refund requests"
            />
          </label>

          <label className="refunds-filter">
            <span>Status</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              aria-label="Filter by status"
            >
              <option value="All">All statuses</option>
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
              <option value="Processing">Processing</option>
              <option value="Completed">Completed</option>
              <option value="Failed">Failed</option>
            </select>
          </label>

          <label className="refunds-filter">
            <span>Method</span>
            <select
              value={methodFilter}
              onChange={(event) => setMethodFilter(event.target.value)}
              aria-label="Filter by payment method"
            >
              <option value="All">All methods</option>
              <option value="Razorpay">Razorpay</option>
              <option value="Wallet">Wallet</option>
            </select>
          </label>

          {(search || statusFilter !== "All" || methodFilter !== "All") && (
            <button
              type="button"
              className="refunds-button refunds-button--text"
              onClick={() => {
                setSearch("");
                setStatusFilter("All");
                setMethodFilter("All");
              }}
            >
              Clear filters
            </button>
          )}
        </div>

        {loading && refunds.length > 0 && (
          <div className="refunds-inline-loading" aria-live="polite">
            Updating refund requests…
          </div>
        )}

        <div className="refunds-table-wrap">
          <table className="refunds-table">
            <thead>
              <tr>
                <th>Refund ID</th>
                <th>Customer</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Requested</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {visibleRefunds.map((refund) => (
                <tr key={refund.id || refund.refundId}>
                  <td>
                    <span
                      className="refunds-id"
                      title={refund.refundId}
                    >
                      {shortId(refund.refundId)}
                    </span>
                    <span className="refunds-secondary-text" title={refund.bookingId}>
                      Booking: {shortId(refund.bookingId, 18)}
                    </span>
                  </td>
                  <td>
                    <div className="refunds-customer">
                      <span className="refunds-avatar">
                        {getInitials(refund.customerName)}
                      </span>
                      <span className="refunds-customer__info">
                        <strong>{refund.customerName}</strong>
                        <span className="refunds-secondary-text">
                          {refund.customerEmail || refund.customerPhone || "Customer"}
                        </span>
                      </span>
                    </div>
                  </td>
                  <td>
                    <strong className="refunds-amount">
                      {formatCurrency(refund.amount)}
                    </strong>
                  </td>
                  <td>{refund.method}</td>
                  <td className="refunds-date">{formatDate(refund.createdAt)}</td>
                  <td>{renderStatus(refund.status)}</td>
                  <td>
                    <button
                      type="button"
                      className="refunds-review-button"
                      onClick={() => openDetails(refund)}
                      disabled={!refund.id}
                    >
                      Review <span aria-hidden="true">→</span>
                    </button>
                  </td>
                </tr>
              ))}

              {!loading && visibleRefunds.length === 0 && (
                <tr>
                  <td colSpan={7}>
                    <div className="refunds-empty">
                      <div className="refunds-empty-icon">⌕</div>
                      <h3>
                        {refunds.length === 0
                          ? "No refund requests yet"
                          : "No matching refunds"}
                      </h3>
                      <p>
                        {refunds.length === 0
                          ? "Refund requests will appear here when available from the backend."
                          : "Try changing your search text or clearing one or more filters."}
                      </p>
                      {refunds.length > 0 && (
                        <button
                          type="button"
                          className="refunds-button refunds-button--secondary"
                          onClick={() => {
                            setSearch("");
                            setStatusFilter("All");
                            setMethodFilter("All");
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

        <footer className="refunds-pagination">
          <span>
            {filteredRefunds.length === 0
              ? "Showing 0 results"
              : `Showing ${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(
                  currentPage * PAGE_SIZE,
                  filteredRefunds.length,
                )} of ${filteredRefunds.length}`}
          </span>

          <div className="refunds-pagination__actions">
            <button
              type="button"
              className="refunds-button refunds-button--secondary"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={currentPage <= 1}
            >
              Previous
            </button>
            <span>
              Page {currentPage} of {totalPages}
            </span>
            <button
              type="button"
              className="refunds-button refunds-button--secondary"
              onClick={() =>
                setPage((current) => Math.min(totalPages, current + 1))
              }
              disabled={currentPage >= totalPages}
            >
              Next
            </button>
          </div>
        </footer>
      </section>
    </main>
  );
};

export default AdminRefundsPage;

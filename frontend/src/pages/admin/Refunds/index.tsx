import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Search,
  Clock3,
  CheckCircle2,
  XCircle,
  ReceiptText,
  Eye,
  RefreshCw,
  Wallet,
  CreditCard,
  ArrowLeft,
  CalendarDays,
  UserRound,
  ClipboardList,
  CircleDollarSign,
  Check,
  Ban,
  Copy,
} from "lucide-react";
import clsx from "clsx";

import { PageHeader } from "@/components/admin/PageHeader";
import {
  fetchAdminRefundList,
  fetchAdminRefund,
  approveAdminRefund,
  rejectAdminRefund,
  type AdminRefundItem,
  type AdminRefundSummaryCounts,
} from "@/services/adminRefundApi";

import "./index.css";

type FilterStatus =
  | "all"
  | "PENDING_APPROVAL"
  | "CREDITED"
  | "REJECTED";

const EMPTY_COUNTS: AdminRefundSummaryCounts = {
  pendingApproval: 0,
  credited: 0,
  rejected: 0,
  total: 0,
};

function getCustomer(refund: AdminRefundItem) {
  const customer = refund.customerId;

  if (typeof customer === "object" && customer !== null) {
    return {
      id: customer._id || "",
      name: customer.name || "Unknown customer",
      email: customer.email || "",
      phone: customer.phone || "",
    };
  }

  return {
    id: "",
    name: "Unknown customer",
    email: "",
    phone: "",
  };
}

function getBooking(refund: AdminRefundItem) {
  const booking = refund.bookingId;

  if (typeof booking === "object" && booking !== null) {
    return {
      id: booking._id || "",
      number: booking.bookingNumber || booking._id || "—",
      service: booking.serviceName || "Home service",
      status: booking.status || "—",
      paymentStatus: booking.paymentStatus || "—",
      cancellationReason: booking.cancellationReason || "",
      scheduledAt: booking.scheduledAt,
    };
  }

  return {
    id: typeof booking === "string" ? booking : "",
    number: typeof booking === "string" ? booking : "—",
    service: "Home service",
    status: "—",
    paymentStatus: "—",
    cancellationReason: "",
    scheduledAt: undefined,
  };
}

function getPayment(refund: AdminRefundItem) {
  const payment = refund.paymentId;

  if (typeof payment === "object" && payment !== null) {
    return {
      id: payment._id || "",
      reference: payment.razorpayPaymentId || payment._id || "—",
      orderId: payment.razorpayOrderId || "",
      amount: payment.amount,
      currency: payment.currency || refund.currency || "INR",
      status: payment.status || "—",
      method: payment.method || refund.method || "",
      paidAt: payment.paidAt,
    };
  }

  return {
    id: typeof payment === "string" ? payment : "",
    reference: typeof payment === "string" ? payment : "—",
    orderId: "",
    amount: undefined,
    currency: refund.currency || "INR",
    status: "—",
    method: refund.method || "",
    paidAt: undefined,
  };
}

function getPersonName(
  person:
    | AdminRefundItem["requestedBy"]
    | AdminRefundItem["approvedBy"]
    | AdminRefundItem["rejectedBy"],
) {
  if (typeof person === "object" && person !== null) {
    return person.name || person.email || "—";
  }

  return "—";
}

function getStatus(refund: AdminRefundItem): {
  label: string;
  className: string;
} {
  const status = String(refund.status).toUpperCase();

  if (["CREDITED", "PROCESSED"].includes(status)) {
    return {
      label: "Credited",
      className: "refund-status--credited",
    };
  }

  if (status === "REJECTED") {
    return {
      label: "Rejected",
      className: "refund-status--rejected",
    };
  }

  if (status === "PROCESSING") {
    return {
      label: "Processing",
      className: "refund-status--processing",
    };
  }

  if (status === "CREDIT_FAILED") {
    return {
      label: "Credit failed",
      className: "refund-status--failed",
    };
  }

  if (status === "APPROVED") {
    return {
      label: "Approved",
      className: "refund-status--approved",
    };
  }

  return {
    label: "Pending approval",
    className: "refund-status--pending",
  };
}

function canReviewRefund(refund: AdminRefundItem) {
  return ["PENDING_APPROVAL", "REQUESTED"].includes(
    String(refund.status).toUpperCase(),
  );
}

function formatAmount(amount: number, currency = "INR") {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency || "INR",
      maximumFractionDigits: 2,
    }).format(Number(amount) || 0);
  } catch {
    return `₹${(Number(amount) || 0).toLocaleString("en-IN")}`;
  }
}

function formatDate(value?: string) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatDateTime(value?: string) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;

  return "Unable to complete the request. Please try again.";
}

function DetailField({
  label,
  value,
  copyable = false,
}: {
  label: string;
  value?: string | number | null;
  copyable?: boolean;
}) {
  const displayValue =
    value === undefined || value === null || value === ""
      ? "—"
      : String(value);

  return (
    <div className="refunds-detail-field">
      <span className="refunds-detail-field__label">{label}</span>

      <div className="refunds-detail-field__value">
        <span>{displayValue}</span>

        {copyable && displayValue !== "—" && (
          <button
            type="button"
            className="refunds-copy-button"
            title={`Copy ${label}`}
            aria-label={`Copy ${label}`}
            onClick={() => {
              void navigator.clipboard
                ?.writeText(displayValue)
                .catch(() => {
                  // Clipboard access may be unavailable in some browsers.
                });
            }}
          >
            <Copy size={13} />
          </button>
        )}
      </div>
    </div>
  );
}

export const AdminRefundsPage: React.FC = () => {
  const navigate = useNavigate();
  const openRefund = (id: string) =>
    navigate(`/admin/refunds/${encodeURIComponent(id)}`);
  const { id: routeId } = useParams<{ id: string }>();

  // Safely decode the selected refund ID from the URL.
  let refundId = "";

  if (routeId) {
    try {
      refundId = decodeURIComponent(routeId);
    } catch {
      refundId = routeId;
    }
  }

  const [items, setItems] = useState<AdminRefundItem[]>([]);
  const [counts, setCounts] =
    useState<AdminRefundSummaryCounts>(EMPTY_COUNTS);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<FilterStatus>("all");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedRefund, setSelectedRefund] =
    useState<AdminRefundItem | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  const loadRefunds = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result = await fetchAdminRefundList({
        status,
        search,
        page,
        limit: 10,
      });

      setItems(result.items);
      setCounts(result.summaryCounts);
      setTotal(result.pagination?.total ?? result.items.length);
      setPages(Math.max(1, result.pagination?.pages ?? 1));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [status, search, page]);

  const loadRefundDetails = useCallback(async () => {
    if (!refundId) return;

    setDetailLoading(true);
    setDetailError("");
    setActionError("");
    setActionMessage("");

    try {
      const result = await fetchAdminRefund(refundId);
      setSelectedRefund(result);
    } catch (err) {
      setSelectedRefund(null);
      setDetailError(getErrorMessage(err));
    } finally {
      setDetailLoading(false);
    }
  }, [refundId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (!refundId) {
      void loadRefunds();
    }
  }, [refundId, loadRefunds]);

  useEffect(() => {
    if (refundId) {
      setSelectedRefund(null);
      setShowRejectForm(false);
      setRejectionReason("");
      void loadRefundDetails();
    }
  }, [refundId, loadRefundDetails]);

  const handleApprove = async () => {
    if (!selectedRefund || !canReviewRefund(selectedRefund)) return;

    const confirmed = window.confirm(
      "Approve this refund request? This will initiate the refund workflow.",
    );

    if (!confirmed) return;

    setActionLoading(true);
    setActionError("");
    setActionMessage("");

    try {
      const updated = await approveAdminRefund(selectedRefund._id);

      setSelectedRefund(updated);
      setActionMessage("Refund approved successfully.");
      setShowRejectForm(false);
    } catch (err) {
      setActionError(getErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedRefund || !canReviewRefund(selectedRefund)) return;

    const reason = rejectionReason.trim();

    if (!reason) {
      setActionError("Please enter a reason for rejecting this refund.");
      return;
    }

    setActionLoading(true);
    setActionError("");
    setActionMessage("");

    try {
      const updated = await rejectAdminRefund(
        selectedRefund._id,
        reason,
      );

      setSelectedRefund(updated);
      setActionMessage("Refund rejected successfully.");
      setShowRejectForm(false);
      setRejectionReason("");
    } catch (err) {
      setActionError(getErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  const filterOptions: {
    value: FilterStatus;
    label: string;
  }[] = [
    { value: "all", label: "All statuses" },
    { value: "PENDING_APPROVAL", label: "Pending approval" },
    { value: "CREDITED", label: "Credited" },
    { value: "REJECTED", label: "Rejected" },
  ];

  // ------------------------ REFUND DETAILS ------------------------
  if (refundId) {
    const refund = selectedRefund;
    const customer = refund ? getCustomer(refund) : null;
    const booking = refund ? getBooking(refund) : null;
    const payment = refund ? getPayment(refund) : null;
    const refundStatus = refund ? getStatus(refund) : null;

    return (
      <main className="refunds-page refunds-detail-page">
        <div className="refunds-page__header">
          <div>
            <PageHeader
              title="Refund Details"
              description="Review the refund request, booking, customer, payment, and processing history."
            />
          </div>

          <div className="refunds-detail-header-actions">
            <button
              type="button"
              className="refunds-button refunds-button--secondary"
              onClick={() => navigate("/admin/refunds")}
            >
              <ArrowLeft size={15} />
              Back to refunds
            </button>

            <button
              type="button"
              className="refunds-button refunds-button--secondary"
              onClick={() => void loadRefundDetails()}
              disabled={detailLoading}
            >
              <RefreshCw
                size={15}
                className={detailLoading ? "refunds-spin" : ""}
              />
              Refresh
            </button>
          </div>
        </div>

        {detailLoading && (
          <div className="refunds-inline-loading" role="status">
            <span className="refunds-loading__spinner" />
            Loading refund details...
          </div>
        )}

        {detailError && (
          <div className="refunds-alert refunds-alert--error" role="alert">
            <span>{detailError}</span>
            <button
              type="button"
              className="refunds-button refunds-button--secondary"
              onClick={() => void loadRefundDetails()}
              disabled={detailLoading}
            >
              Try again
            </button>
          </div>
        )}

        {refund && customer && booking && payment && refundStatus && (
          <>
            <section className="refunds-detail-hero">
              <div className="refunds-detail-hero__main">
                <span className="refunds-detail-hero__icon">
                  <ReceiptText size={23} />
                </span>

                <div className="refunds-detail-hero__content">
                  <span className="refunds-detail-eyebrow">
                    Refund request
                  </span>

                  <h2
                    className="refunds-detail-id"
                    title={refund._id}
                  >
                    {refund._id}
                  </h2>

                  <p>
                    Requested on{" "}
                    {formatDateTime(
                      refund.requestedAt || refund.createdAt,
                    )}
                  </p>
                </div>
              </div>

              <span
                className={clsx(
                  "refund-status",
                  refundStatus.className,
                )}
              >
                <span className="refund-status__dot" />
                {refundStatus.label}
              </span>
            </section>

            {actionMessage && (
              <div
                className="refunds-alert refunds-alert--success"
                role="status"
              >
                <Check size={17} />
                {actionMessage}
              </div>
            )}

            {actionError && (
              <div
                className="refunds-alert refunds-alert--error"
                role="alert"
              >
                {actionError}
              </div>
            )}

            <section className="refunds-detail-summary">
              <article className="refunds-detail-amount-card">
                <span className="refunds-detail-amount-card__icon">
                  <CircleDollarSign size={21} />
                </span>

                <span className="refunds-detail-eyebrow">
                  Refund amount
                </span>

                <strong>
                  {formatAmount(refund.amount, refund.currency)}
                </strong>

                <span className="refunds-detail-muted">
                  {String(refund.method || "").toUpperCase() === "WALLET"
                    ? "Wallet credit"
                    : "Original payment method"}
                </span>
              </article>

              <article className="refunds-detail-summary-card">
                <span className="refunds-detail-eyebrow">
                  Booking reference
                </span>

                <strong className="refunds-detail-summary-card__value">
                  {booking.number}
                </strong>

                <span className="refunds-detail-muted">
                  {booking.service}
                </span>
              </article>

              <article className="refunds-detail-summary-card">
                <span className="refunds-detail-eyebrow">
                  Payment reference
                </span>

                <strong
                  className="refunds-detail-summary-card__value"
                  title={payment.reference}
                >
                  {payment.reference}
                </strong>

                <span className="refunds-detail-muted">
                  {payment.status}
                </span>
              </article>
            </section>

            <div className="refunds-detail-grid">
              <section className="refunds-detail-card">
                <div className="refunds-detail-card__heading">
                  <span className="refunds-detail-card__heading-icon">
                    <UserRound size={18} />
                  </span>

                  <div>
                    <h2>Customer details</h2>
                    <p>Customer associated with this refund</p>
                  </div>
                </div>

                <div className="refunds-detail-fields">
                  <DetailField
                    label="Customer name"
                    value={customer.name}
                  />
                  <DetailField
                    label="Email address"
                    value={customer.email}
                  />
                  <DetailField
                    label="Phone number"
                    value={customer.phone}
                  />
                  <DetailField
                    label="Customer ID"
                    value={customer.id}
                    copyable
                  />
                </div>
              </section>

              <section className="refunds-detail-card">
                <div className="refunds-detail-card__heading">
                  <span className="refunds-detail-card__heading-icon">
                    <ClipboardList size={18} />
                  </span>

                  <div>
                    <h2>Booking details</h2>
                    <p>Original booking and cancellation information</p>
                  </div>
                </div>

                <div className="refunds-detail-fields">
                  <DetailField
                    label="Booking reference"
                    value={booking.number}
                    copyable
                  />
                  <DetailField
                    label="Service"
                    value={booking.service}
                  />
                  <DetailField
                    label="Booking status"
                    value={booking.status}
                  />
                  <DetailField
                    label="Payment status"
                    value={booking.paymentStatus}
                  />
                  <DetailField
                    label="Scheduled date"
                    value={formatDateTime(booking.scheduledAt)}
                  />
                  <DetailField
                    label="Cancellation reason"
                    value={booking.cancellationReason || "Not provided"}
                  />
                </div>
              </section>

              <section className="refunds-detail-card">
                <div className="refunds-detail-card__heading">
                  <span className="refunds-detail-card__heading-icon">
                    <CreditCard size={18} />
                  </span>

                  <div>
                    <h2>Payment details</h2>
                    <p>Payment transaction associated with the refund</p>
                  </div>
                </div>

                <div className="refunds-detail-fields">
                  <DetailField
                    label="Payment reference"
                    value={payment.reference}
                    copyable
                  />
                  <DetailField
                    label="Payment order ID"
                    value={payment.orderId}
                    copyable
                  />
                  <DetailField
                    label="Original payment amount"
                    value={
                      payment.amount !== undefined
                        ? formatAmount(
                            payment.amount,
                            payment.currency,
                          )
                        : undefined
                    }
                  />
                  <DetailField
                    label="Payment method"
                    value={payment.method}
                  />
                  <DetailField
                    label="Payment status"
                    value={payment.status}
                  />
                  <DetailField
                    label="Payment date"
                    value={formatDateTime(payment.paidAt)}
                  />
                </div>
              </section>

              <section className="refunds-detail-card">
                <div className="refunds-detail-card__heading">
                  <span className="refunds-detail-card__heading-icon">
                    <CalendarDays size={18} />
                  </span>

                  <div>
                    <h2>Refund timeline</h2>
                    <p>Request and processing activity</p>
                  </div>
                </div>

                <div className="refunds-timeline">
                  <div className="refunds-timeline__item">
                    <span className="refunds-timeline__marker refunds-timeline__marker--blue" />

                    <div>
                      <strong>Refund requested</strong>
                      <p>
                        {formatDateTime(
                          refund.requestedAt || refund.createdAt,
                        )}
                      </p>
                      <span>
                        Requested by{" "}
                        {getPersonName(refund.requestedBy)}
                      </span>
                    </div>
                  </div>

                  {refund.approvedAt && (
                    <div className="refunds-timeline__item">
                      <span className="refunds-timeline__marker refunds-timeline__marker--green" />

                      <div>
                        <strong>Refund approved</strong>
                        <p>{formatDateTime(refund.approvedAt)}</p>
                        <span>
                          Approved by{" "}
                          {getPersonName(refund.approvedBy)}
                        </span>
                      </div>
                    </div>
                  )}

                  {refund.processedAt && (
                    <div className="refunds-timeline__item">
                      <span className="refunds-timeline__marker refunds-timeline__marker--green" />

                      <div>
                        <strong>Refund processed</strong>
                        <p>{formatDateTime(refund.processedAt)}</p>
                      </div>
                    </div>
                  )}

                  {refund.rejectedAt && (
                    <div className="refunds-timeline__item">
                      <span className="refunds-timeline__marker refunds-timeline__marker--red" />

                      <div>
                        <strong>Refund rejected</strong>
                        <p>{formatDateTime(refund.rejectedAt)}</p>
                        <span>
                          Rejected by{" "}
                          {getPersonName(refund.rejectedBy)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </section>

              <section className="refunds-detail-card refunds-detail-card--full">
                <div className="refunds-detail-card__heading">
                  <span className="refunds-detail-card__heading-icon">
                    <ReceiptText size={18} />
                  </span>

                  <div>
                    <h2>Refund information</h2>
                    <p>
                      Request reason and refund transaction identifiers
                    </p>
                  </div>
                </div>

                <div className="refunds-detail-fields refunds-detail-fields--two">
                  <DetailField
                    label="Refund ID"
                    value={refund._id}
                    copyable
                  />
                  <DetailField
                    label="Refund status"
                    value={refundStatus.label}
                  />
                  <DetailField
                    label="Refund method"
                    value={refund.method}
                  />
                  <DetailField
                    label="Razorpay refund ID"
                    value={refund.id || undefined}
                    copyable
                  />
                  <DetailField
                    label="Wallet transaction ID"
                    value={refund.walletTransactionId}
                    copyable
                  />
                  <DetailField
                    label="Created date"
                    value={formatDateTime(refund.createdAt)}
                  />
                  <DetailField
                    label="Last updated"
                    value={formatDateTime(refund.updatedAt)}
                  />
                </div>

                <div className="refunds-detail-reason">
                  <span className="refunds-detail-field__label">
                    Customer refund reason
                  </span>
                  <p>{refund.reason || "No reason was provided."}</p>
                </div>

                {refund.rejectionReason && (
                  <div className="refunds-detail-reason refunds-detail-reason--rejected">
                    <span className="refunds-detail-field__label">
                      Rejection reason
                    </span>
                    <p>{refund.rejectionReason}</p>
                  </div>
                )}
              </section>
            </div>

            {canReviewRefund(refund) && (
              <section className="refunds-detail-actions">
                <div>
                  <h2>Review refund request</h2>
                  <p>
                    Approving initiates the refund workflow. Rejection
                    requires a reason.
                  </p>
                </div>

                {!showRejectForm ? (
                  <div className="refunds-detail-actions__buttons">
                    <button
                      type="button"
                      className="refunds-button refunds-button--danger"
                      onClick={() => {
                        setShowRejectForm(true);
                        setActionError("");
                      }}
                      disabled={actionLoading}
                    >
                      <Ban size={16} />
                      Reject refund
                    </button>

                    <button
                      type="button"
                      className="refunds-button refunds-button--primary"
                      onClick={() => void handleApprove()}
                      disabled={actionLoading}
                    >
                      <Check size={16} />
                      {actionLoading
                        ? "Processing..."
                        : "Approve refund"}
                    </button>
                  </div>
                ) : (
                  <div className="refunds-reject-form">
                    <label htmlFor="refund-rejection-reason">
                      Reason for rejection
                    </label>

                    <textarea
                      id="refund-rejection-reason"
                      value={rejectionReason}
                      onChange={(event) =>
                        setRejectionReason(event.target.value)
                      }
                      placeholder="Enter the reason visible to the customer..."
                      rows={3}
                      maxLength={1000}
                    />

                    <div className="refunds-reject-form__actions">
                      <button
                        type="button"
                        className="refunds-button refunds-button--secondary"
                        onClick={() => {
                          setShowRejectForm(false);
                          setRejectionReason("");
                          setActionError("");
                        }}
                        disabled={actionLoading}
                      >
                        Cancel
                      </button>

                      <button
                        type="button"
                        className="refunds-button refunds-button--danger"
                        onClick={() => void handleReject()}
                        disabled={
                          actionLoading || !rejectionReason.trim()
                        }
                      >
                        <XCircle size={16} />
                        {actionLoading
                          ? "Rejecting..."
                          : "Confirm rejection"}
                      </button>
                    </div>
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </main>
    );
  }

  // -------------------------- REFUND LIST --------------------------
  return (
    <main className="refunds-page">
      <div className="refunds-page__header">
        <PageHeader
          title="Refund Requests"
          description="Review cancelled-booking refund requests, track their progress, and inspect individual refund details."
        />

        <button
          type="button"
          className="refunds-button refunds-button--secondary"
          onClick={() => void loadRefunds()}
          disabled={loading}
        >
          <RefreshCw
            size={15}
            className={loading ? "refunds-spin" : ""}
          />
          Refresh
        </button>
      </div>

      {error && (
        <div className="refunds-alert refunds-alert--error" role="alert">
          <span>{error}</span>
          <button
            type="button"
            className="refunds-button refunds-button--secondary"
            onClick={() => void loadRefunds()}
            disabled={loading}
          >
            Try again
          </button>
        </div>
      )}

      <section className="refunds-stats" aria-label="Refund summary">
        <article className="refunds-stat-card refunds-stat-card--pending">
          <div className="refunds-stat-card__top">
            <span className="refunds-stat-card__label">
              Pending approval
            </span>
            <span className="refunds-stat-card__icon">
              <Clock3 size={19} />
            </span>
          </div>

          <div className="refunds-stat-card__value">
            {counts.pendingApproval}
          </div>
          <p className="refunds-stat-card__hint">
            Requests awaiting review
          </p>
        </article>

        <article className="refunds-stat-card refunds-stat-card--completed">
          <div className="refunds-stat-card__top">
            <span className="refunds-stat-card__label">
              Wallet credited
            </span>
            <span className="refunds-stat-card__icon">
              <CheckCircle2 size={19} />
            </span>
          </div>

          <div className="refunds-stat-card__value">
            {counts.credited}
          </div>
          <p className="refunds-stat-card__hint">
            Refunds successfully credited
          </p>
        </article>

        <article className="refunds-stat-card refunds-stat-card--failed">
          <div className="refunds-stat-card__top">
            <span className="refunds-stat-card__label">Rejected</span>
            <span className="refunds-stat-card__icon">
              <XCircle size={19} />
            </span>
          </div>

          <div className="refunds-stat-card__value">
            {counts.rejected}
          </div>
          <p className="refunds-stat-card__hint">
            Requests declined with a reason
          </p>
        </article>

        <article className="refunds-stat-card">
          <div className="refunds-stat-card__top">
            <span className="refunds-stat-card__label">
              Total requests
            </span>
            <span className="refunds-stat-card__icon">
              <ReceiptText size={19} />
            </span>
          </div>

          <div className="refunds-stat-card__value">
            {counts.total}
          </div>
          <p className="refunds-stat-card__hint">
            Refund requests recorded
          </p>
        </article>
      </section>

      <section className="refunds-panel">
        <div className="refunds-panel__heading">
          <div>
            <h2>Refund history &amp; queue</h2>
            <p>
              Search requests and open a refund to review its full details.
            </p>
          </div>

          <span className="refunds-result-count">
            {total} {total === 1 ? "request" : "requests"}
          </span>
        </div>

        <div className="refunds-filters">
          <label className="refunds-search">
            <Search size={18} aria-hidden="true" />
            <span className="sr-only">Search refund requests</span>
            <input
              type="search"
              placeholder="Search booking, customer, payment ID..."
              value={searchInput}
              onChange={(event) =>
                setSearchInput(event.target.value)
              }
            />
          </label>

          <label className="refunds-filter">
            <span>Status</span>
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as FilterStatus);
                setPage(1);
              }}
            >
              {filterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {loading && (
          <div className="refunds-inline-loading" role="status">
            <span className="refunds-loading__spinner" />
            Loading refund requests...
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="refunds-empty">
            <span className="refunds-empty-icon">
              <ReceiptText size={23} />
            </span>

            <h3>No refund requests found</h3>
            <p>
              Try another search term or change the status filter.
            </p>

            {(search || status !== "all") && (
              <button
                type="button"
                className="refunds-button refunds-button--secondary"
                onClick={() => {
                  setSearchInput("");
                  setSearch("");
                  setStatus("all");
                  setPage(1);
                }}
              >
                Clear filters
              </button>
            )}
          </div>
        )}

        {!loading && items.length > 0 && (
          <>
            <div className="refunds-table-wrap">
              <table className="refunds-table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Service</th>
                    <th>Payment reference</th>
                    <th>Refund amount</th>
                    <th>Method</th>
                    <th>Status</th>
                    <th>Request date</th>
                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {items.map((refund) => {
                    const customer = getCustomer(refund);
                    const booking = getBooking(refund);
                    const refundStatus = getStatus(refund);

                    return (
                      <tr
                        key={refund._id}
                        className="is-clickable"
                        tabIndex={0}
                        onClick={() => openRefund(refund._id)}
                        onKeyDown={(event) => {
                          if (event.target !== event.currentTarget) return;
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            openRefund(refund._id);
                          }
                        }}
                      >
                        <td>
                          <div className="refunds-customer">
                            <span className="refunds-avatar">
                              {customer.name
                                .split(/\s+/)
                                .filter(Boolean)
                                .slice(0, 2)
                                .map((part) => part[0])
                                .join("")
                                .toUpperCase() || "?"}
                            </span>

                            <div className="refunds-customer__info">
                              <strong>{customer.name}</strong>

                              {customer.email && (
                                <span className="refunds-secondary-text">
                                  {customer.email}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        <td>{booking.service}</td>

                        <td>
                          <span
                            className="refunds-id"
                            title={paymentReference(refund)}
                          >
                            {paymentReference(refund)}
                          </span>
                        </td>

                        <td>
                          <strong className="refunds-amount">
                            {formatAmount(
                              refund.amount,
                              refund.currency,
                            )}
                          </strong>
                        </td>

                        <td>
                          <span className="refunds-method">
                            {String(refund.method).toUpperCase() ===
                            "WALLET" ? (
                              <Wallet size={15} />
                            ) : (
                              <CreditCard size={15} />
                            )}

                            {String(refund.method).toUpperCase() ===
                            "WALLET"
                              ? "Wallet credit"
                              : "Original payment"}
                          </span>
                        </td>

                        <td>
                          <span
                            className={clsx(
                              "refund-status",
                              refundStatus.className,
                            )}
                          >
                            <span className="refund-status__dot" />
                            {refundStatus.label}
                          </span>
                        </td>

                        <td>
                          <span className="refunds-date">
                            {formatDate(
                              refund.requestedAt || refund.createdAt,
                            )}
                          </span>
                        </td>

                        <td>
                          <button
                            type="button"
                            className="refunds-review-button"
                            onClick={(event) => {
                              event.stopPropagation();
                              openRefund(refund._id);
                            }}
                          >
                            <Eye size={14} />
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="refunds-pagination">
              <span>
                Page {page} of {pages} · {total} total requests
              </span>

              <div className="refunds-pagination__actions">
                <button
                  type="button"
                  className="refunds-button refunds-button--secondary"
                  disabled={page <= 1 || loading}
                  onClick={() =>
                    setPage((current) => current - 1)
                  }
                >
                  Previous
                </button>

                <span className="refunds-pagination__current">
                  {page}
                </span>

                <button
                  type="button"
                  className="refunds-button refunds-button--secondary"
                  disabled={page >= pages || loading}
                  onClick={() =>
                    setPage((current) => current + 1)
                  }
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </main>
  );
};

function paymentReference(refund: AdminRefundItem) {
  const payment = refund.paymentId;

  if (typeof payment === "object" && payment !== null) {
    return payment.razorpayPaymentId || payment._id || "—";
  }

  return payment || "—";
}

export default AdminRefundsPage;
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Check, X, XCircle } from 'lucide-react';
import clsx from 'clsx';
import { PageHeader } from '@/components/admin/PageHeader';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { Pagination } from '@/components/admin/Pagination';
import { usePermissions } from '@/hooks/usePermissions';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { REFUND_STATUSES, decideRefund, fetchAdminRefunds, type AdminRefund, type AdminRefundsResult, type RefundStatus } from '@/services/adminRefundApi';
import { formatDateTime, formatMoney } from '../Payments/paymentFormat';
import '../Categories/index.css';
import './index.css';

export const PAYMENTS_REFUND = 'payments:refund';
const PAGE_SIZE = 20;
const LABEL: Record<RefundStatus, string> = { requested: 'Requested', approved: 'Approved', processed: 'Processed', rejected: 'Rejected' };
const errText = (e: unknown) => (e as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message || (e as { message?: string })?.message || 'Something went wrong. Please try again.';

type Pending = { refund: AdminRefund; action: 'approve' | 'reject' } | null;

/** /admin/refunds: review refund requests (GET /admin/refunds) and approve or reject them (PATCH /admin/refunds/:id). */
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
      {!canDecide && <div className="cat-banner cat-banner--info" role="status">You can view refunds but need the ΓÇ£{PAYMENTS_REFUND}ΓÇ¥ permission to approve or reject them.</div>}

      <div className="rfd-toolbar">
        <div className="rfd-chips" role="radiogroup" aria-label="Status">
          <button type="button" role="radio" aria-checked={status === ''} className={clsx('rfd-chip', status === '' && 'is-on')} onClick={() => { setStatus(''); setPage(1); }}>All</button>
          {REFUND_STATUSES.map((s) => (
            <button key={s} type="button" role="radio" aria-checked={status === s} className={clsx('rfd-chip', status === s && 'is-on')} onClick={() => { setStatus(s); setPage(1); }}>{LABEL[s]}</button>
          ))}
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
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r._id}>
                    <td>{r.customerId?.name ?? 'ΓÇö'}{r.customerId?.email && <small className="rfd-sub">{r.customerId.email}</small>}</td>
                    <td>{r.bookingId?.serviceName ?? 'ΓÇö'}<small className="rfd-sub rfd-mono">{r.bookingId?._id ?? ''}</small></td>
                    <td className="rfd-mono">{r.paymentId?.razorpayPaymentId ?? r.paymentId?._id ?? 'ΓÇö'}</td>
                    <td>{formatMoney(r.amount, r.currency)}</td>
                    <td>{r.method === 'WALLET' ? 'Wallet credit' : 'Original payment'}</td>
                    <td>{r.reason}{r.status === 'rejected' && r.rejectionReason && <p className="rfd-note">Rejected: {r.rejectionReason}</p>}</td>
                    <td><span className={clsx('rfd-pill', `rfd-pill--${r.status}`)}>{LABEL[r.status]}</span></td>
                    <td>{formatDateTime(r.requestedAt ?? r.createdAt)}</td>
                    <td>
                      {canDecide && r.status === 'requested' && (
                        <div className="rfd-actions">
                          <button type="button" className="hcx-btn hcx-btn--primary" disabled={!online} aria-label={`Approve refund of ${formatMoney(r.amount, r.currency)}`} onClick={() => setPending({ refund: r, action: 'approve' })}><Check size={14} /> Approve</button>
                          <button type="button" className="hcx-btn" disabled={!online} aria-label={`Reject refund of ${formatMoney(r.amount, r.currency)}`} onClick={() => setPending({ refund: r, action: 'reject' })}><X size={14} /> Reject</button>
                        </div>
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

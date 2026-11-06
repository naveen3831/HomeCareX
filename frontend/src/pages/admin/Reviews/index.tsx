
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Check,
  Eye,
  EyeOff,
  X,
  XCircle,
  Star,
  MessageSquare,
  Clock3,
  Search,
  RefreshCw,
  WifiOff,
} from "lucide-react";
import clsx from "clsx";

import { PageHeader } from "@/components/admin/PageHeader";
import { Pagination } from "@/components/admin/Pagination";
import { usePermissions } from "@/hooks/usePermissions";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

import {
  fetchAdminReviews,
  setReviewStatus,
  setReviewVisibility,
  type AdminReview,
  type AdminReviewsResult,
  type ReviewStatus,
} from "@/services/adminReviewApi";

import { formatDateTime } from "../Payments/paymentFormat";
import "../Categories/index.css";
import "./index.css";

export const REVIEWS_MODERATE = "reviews:moderate";

const PAGE_SIZE = 20;

const STATUSES: ReviewStatus[] = [
  "pending",
  "approved",
  "rejected",
];

const LABEL: Record<ReviewStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};

const stars = (rating: number) =>
  "★".repeat(Math.max(0, Math.min(5, rating))) +
  "☆".repeat(Math.max(0, 5 - Math.max(0, Math.min(5, rating))));

const errText = (error: unknown) =>
  (
    error as {
      response?: { data?: { message?: string } };
      message?: string;
    }
  )?.response?.data?.message ||
  (error as { message?: string })?.message ||
  "Something went wrong. Please try again.";

export const AdminReviewsPage: React.FC = () => {
  const { can } = usePermissions();
  const canHide = can(REVIEWS_MODERATE);
  const online = useOnlineStatus();

  const [status, setStatus] = useState<ReviewStatus | "">("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [data, setData] = useState<AdminReviewsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const [toast, setToast] = useState<{
    text: string;
    tone: "success" | "error";
  } | null>(null);

  const timer = useRef<number | undefined>(undefined);

  const flash = useCallback(
    (text: string, tone: "success" | "error" = "success") => {
      setToast({ text, tone });

      window.clearTimeout(timer.current);

      timer.current = window.setTimeout(() => {
        setToast(null);
      }, 4500);
    },
    [],
  );

  useEffect(() => {
    return () => window.clearTimeout(timer.current);
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result = await fetchAdminReviews({
        status,
        search,
        page,
        limit: PAGE_SIZE,
      });

      setData(result);
    } catch (error) {
      setError(errText(error));
    } finally {
      setLoading(false);
    }
  }, [status, search, page]);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(
    review: AdminReview,
    job: () => Promise<void>,
    successMessage: string,
  ) {
    setBusyId(review._id);

    try {
      await job();
      flash(successMessage);
      await load();
    } catch (error) {
      flash(errText(error), "error");
    } finally {
      setBusyId(null);
    }
  }

  const reviews = data?.reviews ?? [];
  const meta = data?.pagination;
  const stats = data?.stats;

  const countOf = (selectedStatus: ReviewStatus | "") => {
    if (!stats) return 0;

    return selectedStatus === ""
      ? stats.total
      : stats[selectedStatus];
  };

  const averageRating =
    reviews.length > 0
      ? (
          reviews.reduce(
            (total, review) => total + review.rating,
            0,
          ) / reviews.length
        ).toFixed(1)
      : "—";

  const pendingCount = countOf("pending");
  const approvedCount = countOf("approved");
  const totalCount = countOf("");

  return (
    <div className="admin-page-container cat-page rvw-page">
      <PageHeader
        title="Reviews"
        description="Manage customer feedback, moderate reviews, and control what appears on your website."
      />

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={clsx(
            "rvw-toast",
            toast.tone === "error" && "rvw-toast--error",
          )}
        >
          {toast.tone === "error" ? (
            <XCircle size={18} />
          ) : (
            <CheckCircle2 size={18} />
          )}

          <span>{toast.text}</span>

          <button
            type="button"
            aria-label="Dismiss notification"
            onClick={() => setToast(null)}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {!online && (
        <div className="rvw-offline" role="status">
          <WifiOff size={17} />
          <span>
            You are offline. Review actions are disabled until you reconnect.
          </span>
        </div>
      )}

      <section
        className="rvw-stats"
        aria-label="Review summary"
      >
        <article className="rvw-stat-card">
          <div className="rvw-stat-top">
            <span className="rvw-stat-label">Total reviews</span>
            <span className="rvw-stat-icon rvw-stat-icon--blue">
              <MessageSquare size={20} />
            </span>
          </div>

          <div className="rvw-stat-value">
            {stats ? totalCount.toLocaleString() : "—"}
          </div>

          <div className="rvw-stat-foot">
            All customer feedback
          </div>
        </article>

        <article className="rvw-stat-card">
          <div className="rvw-stat-top">
            <span className="rvw-stat-label">Pending reviews</span>
            <span className="rvw-stat-icon rvw-stat-icon--amber">
              <Clock3 size={20} />
            </span>
          </div>

          <div className="rvw-stat-value">
            {stats ? pendingCount.toLocaleString() : "—"}
          </div>

          <div className="rvw-stat-foot">
            Awaiting moderation
          </div>
        </article>

        <article className="rvw-stat-card">
          <div className="rvw-stat-top">
            <span className="rvw-stat-label">Approved reviews</span>
            <span className="rvw-stat-icon rvw-stat-icon--green">
              <CheckCircle2 size={20} />
            </span>
          </div>

          <div className="rvw-stat-value">
            {stats ? approvedCount.toLocaleString() : "—"}
          </div>

          <div className="rvw-stat-foot">
            Approved customer feedback
          </div>
        </article>

        <article className="rvw-stat-card">
          <div className="rvw-stat-top">
            <span className="rvw-stat-label">Average rating</span>
            <span className="rvw-stat-icon rvw-stat-icon--purple">
              <Star size={20} />
            </span>
          </div>

          <div className="rvw-stat-value rvw-rating-value">
            {averageRating}
            {averageRating !== "—" && (
              <span className="rvw-rating-out-of">/ 5</span>
            )}
          </div>

          <div className="rvw-stat-foot">
            Based on reviews on this page
          </div>
        </article>
      </section>

      <section className="rvw-content">
        <div className="rvw-section-heading">
          <div>
            <h2>Customer feedback</h2>
            <p>Review, moderate, and manage published feedback.</p>
          </div>

          <button
            type="button"
            className="rvw-refresh"
            onClick={() => void load()}
            disabled={loading}
            aria-label="Refresh reviews"
          >
            <RefreshCw
              size={16}
              className={loading ? "rvw-spinning" : ""}
            />
            Refresh
          </button>
        </div>

        <div className="rvw-toolbar">
          <div
            className="rvw-chips"
            role="radiogroup"
            aria-label="Filter reviews by status"
          >
            {(["", ...STATUSES] as const).map((selectedStatus) => (
              <button
                key={selectedStatus || "all"}
                type="button"
                role="radio"
                aria-checked={status === selectedStatus}
                className={clsx(
                  "rvw-chip",
                  status === selectedStatus && "is-on",
                )}
                onClick={() => {
                  setStatus(selectedStatus);
                  setPage(1);
                }}
              >
                {selectedStatus
                  ? LABEL[selectedStatus]
                  : "All reviews"}

                <span>{countOf(selectedStatus)}</span>
              </button>
            ))}
          </div>

          <label className="rvw-search">
            <Search size={18} aria-hidden="true" />

            <input
              type="search"
              aria-label="Search reviews"
              placeholder="Search by customer name or email..."
              value={searchInput}
              onChange={(event) =>
                setSearchInput(event.target.value)
              }
            />

            {searchInput && (
              <button
                type="button"
                className="rvw-clear-search"
                aria-label="Clear search"
                onClick={() => setSearchInput("")}
              >
                <X size={15} />
              </button>
            )}
          </label>
        </div>

        {error ? (
          <div role="alert" className="rvw-error">
            <div className="rvw-error-icon">
              <XCircle size={22} />
            </div>

            <div className="rvw-error-content">
              <h3>Unable to load reviews</h3>
              <p>{error}</p>

              <button
                type="button"
                className="rvw-btn rvw-btn--primary"
                onClick={() => void load()}
              >
                <RefreshCw size={15} />
                Try again
              </button>
            </div>
          </div>
        ) : loading && !data ? (
          <div
            className="rvw-loading"
            aria-label="Loading reviews"
            aria-busy="true"
          >
            {[0, 1, 2, 3, 4].map((item) => (
              <div key={item} className="rvw-skeleton-row">
                <span />
                <span />
                <span />
                <span />
              </div>
            ))}
          </div>
        ) : reviews.length === 0 ? (
          <div className="rvw-empty">
            <div className="rvw-empty-icon">
              <MessageSquare size={27} />
            </div>

            <h3>
              {status || search
                ? "No reviews found"
                : "No reviews yet"}
            </h3>

            <p>
              {status || search
                ? "Try changing your filters or search term."
                : "Customer reviews will appear here when available."}
            </p>

            {(status || search) && (
              <button
                type="button"
                className="rvw-btn rvw-btn--secondary"
                onClick={() => {
                  setStatus("");
                  setSearchInput("");
                  setSearch("");
                  setPage(1);
                }}
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div
            className="rvw-table-card"
            aria-busy={loading}
          >
            {loading && (
              <div className="rvw-table-loading">
                Updating reviews…
              </div>
            )}

            <div className="rvw-table-scroll">
              <table
                className="rvw-table"
                aria-label="Customer reviews"
              >
                <thead>
                  <tr>
                    <th scope="col">Customer</th>
                    <th scope="col">Rating</th>
                    <th scope="col">Review</th>
                    <th scope="col">Partner</th>
                    <th scope="col">Status</th>
                    <th scope="col">Posted</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {reviews.map((review) => {
                    const hidden = review.visible === false;
                    const busy = busyId === review._id;

                    return (
                      <tr
                        key={review._id}
                        className={clsx(
                          hidden && "is-hidden-review",
                        )}
                      >
                        <td>
                          <div className="rvw-customer">
                            <div className="rvw-avatar">
                              {(review.customerName || "C")
                                .trim()
                                .charAt(0)
                                .toUpperCase()}
                            </div>

                            <div className="rvw-customer-info">
                              <span
                                className="rvw-customer-name"
                                title={review.customerName || undefined}
                              >
                                {review.customerName || "Unknown customer"}
                              </span>

                              {review.customerEmail && (
                                <span className="rvw-sub">
                                  {review.customerEmail}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        <td>
                          <div
                            className="rvw-rating"
                            aria-label={`${review.rating} out of 5 stars`}
                          >
                            <span className="rvw-stars">
                              {stars(review.rating)}
                            </span>

                            <span className="rvw-rating-number">
                              {review.rating}/5
                            </span>
                          </div>
                        </td>

                        <td>
                          <div className="rvw-review-cell">
                            <div className="rvw-msg">
                              {review.message || (
                                <em>No comment provided</em>
                              )}
                            </div>

                            {!!review.tags?.length && (
                              <div className="rvw-tags">
                                {review.tags.map((tag) => (
                                  <span
                                    key={tag}
                                    className="rvw-tag"
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>

                        <td>
                          <span className="rvw-partner">
                            {review.partnerName || "—"}
                          </span>
                        </td>

                        <td>
                          <div className="rvw-status-group">
                            <span
                              className={clsx(
                                "rvw-pill",
                                `rvw-pill--${review.status}`,
                              )}
                            >
                              <span className="rvw-status-dot" />
                              {LABEL[review.status]}
                            </span>

                            {hidden && (
                              <span className="rvw-pill rvw-pill--hidden">
                                <EyeOff size={12} />
                                Hidden
                              </span>
                            )}
                          </div>
                        </td>

                        <td>
                          <time
                            className="rvw-date"
                            dateTime={review.createdAt}
                          >
                            {formatDateTime(review.createdAt)}
                          </time>
                        </td>

                        <td>
                          <div className="rvw-actions">
                            {review.status !== "approved" && (
                              <button
                                type="button"
                                className="rvw-btn rvw-btn--approve"
                                disabled={!online || busy}
                                aria-label={`Approve review by ${review.customerName}`}
                                onClick={() =>
                                  void run(
                                    review,
                                    () =>
                                      setReviewStatus(
                                        review._id,
                                        "approved",
                                      ),
                                    "Review approved",
                                  )
                                }
                              >
                                <Check size={15} />
                                Approve
                              </button>
                            )}

                            {review.status !== "rejected" && (
                              <button
                                type="button"
                                className="rvw-btn rvw-btn--reject"
                                disabled={!online || busy}
                                aria-label={`Reject review by ${review.customerName}`}
                                onClick={() =>
                                  void run(
                                    review,
                                    () =>
                                      setReviewStatus(
                                        review._id,
                                        "rejected",
                                      ),
                                    "Review rejected",
                                  )
                                }
                              >
                                <X size={15} />
                                Reject
                              </button>
                            )}

                            {canHide && (
                              <button
                                type="button"
                                className={clsx(
                                  "rvw-btn",
                                  hidden
                                    ? "rvw-btn--restore"
                                    : "rvw-btn--hide",
                                )}
                                disabled={!online || busy}
                                aria-label={`${hidden ? "Restore" : "Hide"} review by ${review.customerName}`}
                                onClick={() =>
                                  void run(
                                    review,
                                    () =>
                                      setReviewVisibility(
                                        review._id,
                                        hidden,
                                      ),
                                    hidden
                                      ? "Review restored"
                                      : "Review hidden",
                                  )
                                }
                              >
                                {hidden ? (
                                  <Eye size={15} />
                                ) : (
                                  <EyeOff size={15} />
                                )}

                                {hidden ? "Restore" : "Hide"}
                              </button>
                            )}

                            {busy && (
                              <span
                                className="rvw-action-progress"
                                role="status"
                              >
                                Saving…
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {meta && (
              <div className="rvw-pagination">
                <span className="rvw-pagination-info">
                  Showing{" "}
                  {meta.total === 0
                    ? 0
                    : (meta.page - 1) * meta.limit + 1}
                  {"–"}
                  {Math.min(
                    meta.page * meta.limit,
                    meta.total,
                  )}{" "}
                  of {meta.total} reviews
                </span>

                <Pagination
                  page={meta.page}
                  pageSize={meta.limit}
                  total={meta.total}
                  onPageChange={setPage}
                />
              </div>
            )}
          </div>
        )}

        <div className="rvw-footer-note">
          <span className="rvw-footer-dot" />
          Changes to review status and visibility are saved through the admin API.
        </div>
      </section>
    </div>
  );
};

export default AdminReviewsPage;

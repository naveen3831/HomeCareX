import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  MapPin,
  CalendarDays,
  Clock3,
  IndianRupee,
  Check,
  X,
  RefreshCw,
} from "lucide-react";

import { useJobs } from "@/hooks/useJobs";
import { partnerApi } from "@/services/partnerApi";
import type { JobTab, PartnerJob } from "@/types/partner";

import "./index.css";

const PAGE_SIZE = 10;

const TABS: { key: JobTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "requests", label: "Requests" },
  { key: "upcoming", label: "Upcoming" },
  { key: "active", label: "Active" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
];

const EMPTY_LABELS: Record<JobTab, string> = {
  all: "No jobs found",
  requests: "No requested jobs found",
  upcoming: "No upcoming jobs found",
  active: "No active jobs found",
  completed: "No completed jobs found",
  cancelled: "No cancelled jobs found",
};

const STATUS_LABELS: Record<PartnerJob["status"], string> = {
  requested: "Requested",
  upcoming: "Upcoming",
  active: "Active",
  completed: "Completed",
  cancelled: "Cancelled",
};

function getInitialTab(pathname: string, search: string): JobTab {
  if (pathname.endsWith("/requests")) {
    return "requests";
  }

  const tab = new URLSearchParams(search).get("tab");

  if (
    tab === "requests" ||
    tab === "upcoming" ||
    tab === "active" ||
    tab === "completed" ||
    tab === "cancelled"
  ) {
    return tab;
  }

  return "all";
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatAmount(value: number): string {
  return `₹${value.toLocaleString("en-IN")}`;
}

function getCountdown(expiresAt?: string): number {
  if (!expiresAt) {
    return 0;
  }

  const expiry = new Date(expiresAt).getTime();

  if (Number.isNaN(expiry)) {
    return 0;
  }

  return Math.max(0, Math.ceil((expiry - Date.now()) / 1000));
}

function formatCountdown(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

/* Re-renders every second until the offer expires. */
function useCountdown(expiresAt?: string): number {
  const [seconds, setSeconds] = useState(() => getCountdown(expiresAt));

  useEffect(() => {
    setSeconds(getCountdown(expiresAt));

    if (!expiresAt) {
      return;
    }

    const timer = window.setInterval(() => {
      const next = getCountdown(expiresAt);

      setSeconds(next);

      if (next <= 0) {
        window.clearInterval(timer);
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [expiresAt]);

  return seconds;
}

function JobStatusBadge({ status }: { status: PartnerJob["status"] }) {
  return (
    <span className={`partner-job-status partner-job-status-${status}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

function RequestCountdown({ expiresAt }: { expiresAt?: string }) {
  const seconds = useCountdown(expiresAt);

  if (!expiresAt || seconds <= 0) {
    return <span className="partner-job-countdown expired">Expired</span>;
  }

  return (
    <span className="partner-job-countdown">
      <Clock3 size={14} aria-hidden="true" />
      {formatCountdown(seconds)}
    </span>
  );
}

interface JobActionProps {
  job: PartnerJob;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  accepting: boolean;
  rejecting: boolean;
}

function JobActions({
  job,
  onAccept,
  onReject,
  accepting,
  rejecting,
}: JobActionProps) {
  /* Hook must run before any early return. */
  const seconds = useCountdown(job.expiresAt);

  if (job.status !== "requested") {
    return <span className="partner-job-no-action">—</span>;
  }

  const expired = seconds <= 0;
  const busy = accepting || rejecting;

  return (
    <div className="partner-job-actions">
      <button
        type="button"
        className="partner-job-action partner-job-action-reject"
        onClick={() => onReject(job.id)}
        disabled={busy}
        aria-label={`Reject ${job.service}`}
      >
        <X size={15} aria-hidden="true" />
        Reject
      </button>

      <button
        type="button"
        className="partner-job-action partner-job-action-accept"
        onClick={() => onAccept(job.id)}
        disabled={expired || busy}
        aria-label={`Accept ${job.service}`}
      >
        <Check size={15} aria-hidden="true" />
        Accept
      </button>
    </div>
  );
}

function JobCard({
  job,
  onAccept,
  onReject,
  accepting,
  rejecting,
}: JobActionProps) {
  return (
    <article className="partner-job-card">
      <div className="partner-job-card-header">
        <div>
          <p className="partner-job-service">{job.service}</p>
          <p className="partner-job-booking">Booking ID: {job.bookingId}</p>
        </div>

        <JobStatusBadge status={job.status} />
      </div>

      {job.status === "requested" && (
        <div className="partner-job-request-time">
          <span>Response time</span>
          <RequestCountdown expiresAt={job.expiresAt} />
        </div>
      )}

      <div className="partner-job-card-details">
        <div className="partner-job-detail">
          <span className="partner-job-detail-icon">
            <span aria-hidden="true">●</span>
          </span>

          <div>
            <span className="partner-job-detail-label">Customer</span>
            <strong>{job.customer}</strong>
          </div>
        </div>

        <div className="partner-job-detail">
          <MapPin size={17} aria-hidden="true" />

          <div>
            <span className="partner-job-detail-label">Location</span>
            <strong>{job.location}</strong>
            <small>{job.distance.toFixed(1)} km away</small>
          </div>
        </div>

        <div className="partner-job-detail">
          <CalendarDays size={17} aria-hidden="true" />

          <div>
            <span className="partner-job-detail-label">Date</span>
            <strong>{formatDate(job.scheduledAt)}</strong>
          </div>
        </div>

        <div className="partner-job-detail">
          <Clock3 size={17} aria-hidden="true" />

          <div>
            <span className="partner-job-detail-label">Time</span>
            <strong>{formatTime(job.scheduledAt)}</strong>
          </div>
        </div>

        <div className="partner-job-detail">
          <IndianRupee size={17} aria-hidden="true" />

          <div>
            <span className="partner-job-detail-label">Amount</span>
            <strong>{formatAmount(job.amount)}</strong>
          </div>
        </div>
      </div>

      {job.instructions && (
        <div className="partner-job-instructions">
          <span>Instructions</span>
          <p>{job.instructions}</p>
        </div>
      )}

      <div className="partner-job-card-footer">
        <JobActions
          job={job}
          onAccept={onAccept}
          onReject={onReject}
          accepting={accepting}
          rejecting={rejecting}
        />
      </div>
    </article>
  );
}

export const PartnerJobsPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  /* The URL is the single source of truth for the active tab. */
  const activeTab = useMemo(
    () => getInitialTab(location.pathname, location.search),
    [location.pathname, location.search],
  );

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [activeTab]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [search]);

  const jobsQuery = useJobs(activeTab, debouncedSearch, page);

  const invalidateJobs = () =>
    queryClient.invalidateQueries({ queryKey: ["partner", "jobs"] });

  const acceptMutation = useMutation({
    mutationFn: (id: string) => partnerApi.acceptJob(id),
    onSettled: () => {
      void invalidateJobs();
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => partnerApi.rejectJob(id),
    onSettled: () => {
      void invalidateJobs();
    },
  });

  const jobs = jobsQuery.data?.jobs ?? [];
  const total = jobsQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  /* If the result set shrinks (e.g. after accepting), don't stay on a page that no longer exists. */
  useEffect(() => {
    if (jobsQuery.data && page > totalPages) {
      setPage(totalPages);
    }
  }, [jobsQuery.data, page, totalPages]);

  const handleTabChange = (tab: JobTab) => {
    if (tab === "requests") {
      navigate("/partner/jobs/requests");
    } else if (tab === "all") {
      navigate("/partner/jobs");
    } else {
      navigate(`/partner/jobs?tab=${tab}`);
    }
  };

  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSearch(event.target.value);
  };

  const handleAccept = (id: string) => {
    acceptMutation.mutate(id);
  };

  const handleReject = (id: string) => {
    rejectMutation.mutate(id);
  };

  const handleRetry = () => {
    void jobsQuery.refetch();
  };

  /* Only the row being acted on is locked, not the whole list. */
  const isAccepting = (id: string) =>
    acceptMutation.isPending && acceptMutation.variables === id;

  const isRejecting = (id: string) =>
    rejectMutation.isPending && rejectMutation.variables === id;

  return (
    <main className="partner-jobs-page">
      <div className="partner-jobs-container">
        {/* Page header */}
        <header className="partner-jobs-header">
          <div>
            <h1>My Jobs</h1>
            <p>Manage job requests and your scheduled jobs.</p>
          </div>

          <button
            type="button"
            className="partner-jobs-refresh"
            onClick={handleRetry}
            disabled={jobsQuery.isFetching}
          >
            <RefreshCw
              size={17}
              className={jobsQuery.isFetching ? "partner-spin" : ""}
              aria-hidden="true"
            />
            Refresh
          </button>
        </header>

        {/* Tabs */}
        <nav className="partner-jobs-tabs" aria-label="Job status">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={
                activeTab === tab.key
                  ? "partner-job-tab active"
                  : "partner-job-tab"
              }
              onClick={() => handleTabChange(tab.key)}
              aria-current={activeTab === tab.key ? "page" : undefined}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Search */}
        <section className="partner-jobs-toolbar">
          <div className="partner-jobs-search">
            <Search size={18} aria-hidden="true" />

            <label htmlFor="partner-job-search" className="sr-only">
              Search jobs
            </label>

            <input
              id="partner-job-search"
              type="search"
              value={search}
              onChange={handleSearchChange}
              placeholder="Search by booking ID, service or customer..."
              autoComplete="off"
            />
          </div>

          <div className="partner-jobs-count">
            {total} {total === 1 ? "job" : "jobs"}
          </div>
        </section>

        {/* Mutation error */}
        {(acceptMutation.isError || rejectMutation.isError) && (
          <div className="partner-jobs-alert" role="alert">
            <strong>Action could not be completed.</strong>
            <span>Please refresh the list and try again.</span>
          </div>
        )}

        {/* Loading */}
        {jobsQuery.isLoading && (
          <div
            className="partner-jobs-loading"
            role="status"
            aria-live="polite"
          >
            <div className="partner-jobs-spinner" />
            <p>Loading jobs...</p>
          </div>
        )}

        {/* Error */}
        {jobsQuery.isError && !jobsQuery.isLoading && (
          <div className="partner-jobs-error" role="alert">
            <h2>Unable to load jobs</h2>

            <p>
              Something went wrong while loading your jobs. Please try again.
            </p>

            <button
              type="button"
              onClick={handleRetry}
              className="partner-jobs-primary-button"
            >
              <RefreshCw size={16} aria-hidden="true" />
              Try again
            </button>
          </div>
        )}

        {/* Empty */}
        {!jobsQuery.isLoading && !jobsQuery.isError && jobs.length === 0 && (
          <div className="partner-jobs-empty" role="status">
            <div className="partner-jobs-empty-icon">
              <CalendarDays size={28} aria-hidden="true" />
            </div>

            <h2>{EMPTY_LABELS[activeTab]}</h2>

            <p>
              {search
                ? "Try changing your search or clearing the search field."
                : activeTab === "requests"
                  ? "New job requests will appear here when they are available."
                  : "There are no jobs in this category yet."}
            </p>

            {search && (
              <button
                type="button"
                className="partner-jobs-secondary-button"
                onClick={() => setSearch("")}
              >
                Clear search
              </button>
            )}
          </div>
        )}

        {/* Results */}
        {!jobsQuery.isLoading && !jobsQuery.isError && jobs.length > 0 && (
          <>
            {/* Desktop table */}
            <section className="partner-jobs-table-section">
              <div className="partner-jobs-table-wrapper">
                <table className="partner-jobs-table">
                  <thead>
                    <tr>
                      <th scope="col">Booking</th>
                      <th scope="col">Service</th>
                      <th scope="col">Customer</th>
                      <th scope="col">Location</th>
                      <th scope="col">Date &amp; Time</th>
                      <th scope="col">Amount</th>
                      <th scope="col">Status</th>
                      <th scope="col">Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {jobs.map((job) => (
                      <tr key={job.id}>
                        <td>
                          <span className="partner-job-id">
                            {job.bookingId}
                          </span>
                        </td>

                        <td>
                          <div className="partner-job-service-cell">
                            <strong>{job.service}</strong>
                            {job.instructions && (
                              <small>{job.instructions}</small>
                            )}
                          </div>
                        </td>

                        <td>{job.customer}</td>

                        <td>
                          <div className="partner-job-location-cell">
                            <span>{job.location}</span>
                            <small>{job.distance.toFixed(1)} km</small>
                          </div>
                        </td>

                        <td>
                          <div className="partner-job-datetime">
                            <span>{formatDate(job.scheduledAt)}</span>
                            <small>{formatTime(job.scheduledAt)}</small>
                          </div>
                        </td>

                        <td>
                          <strong>{formatAmount(job.amount)}</strong>
                        </td>

                        <td>
                          <div className="partner-job-status-cell">
                            <JobStatusBadge status={job.status} />

                            {job.status === "requested" && (
                              <RequestCountdown expiresAt={job.expiresAt} />
                            )}
                          </div>
                        </td>

                        <td>
                          <JobActions
                            job={job}
                            onAccept={handleAccept}
                            onReject={handleReject}
                            accepting={isAccepting(job.id)}
                            rejecting={isRejecting(job.id)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Mobile cards */}
            <section className="partner-jobs-cards" aria-label="Jobs list">
              {jobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  onAccept={handleAccept}
                  onReject={handleReject}
                  accepting={isAccepting(job.id)}
                  rejecting={isRejecting(job.id)}
                />
              ))}
            </section>

            {/* Pagination */}
            <div className="partner-jobs-pagination">
              <span>
                Page {Math.min(page, totalPages)} of {totalPages}
              </span>

              <div className="partner-jobs-pagination-buttons">
                <button
                  type="button"
                  disabled={page <= 1 || jobsQuery.isFetching}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  Previous
                </button>

                <button
                  type="button"
                  disabled={page >= totalPages || jobsQuery.isFetching}
                  onClick={() =>
                    setPage((current) => Math.min(totalPages, current + 1))
                  }
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
};

export default PartnerJobsPage;
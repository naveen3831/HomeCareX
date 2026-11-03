import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Filter,
  MapPin,
  RefreshCw,
  Search,
  User,
  X,
} from "lucide-react";

import {
  ServiceThumb,
  formatClock,
  formatInr,
  useCountdown,
  whenLabel,
} from "@/components/partner/jobs/jobUi";
import RejectReasonDialog from "@/components/partner/RejectReasonDialog";
import { useJobs } from "@/hooks/useJobs";
import { partnerApi } from "@/services/partnerApi";
import type { JobTab, PartnerJob } from "@/types/partner";

import "./index.css";

const PAGE_SIZE = 10;

const TABS: { key: JobTab; label: string }[] = [
  { key: "requests", label: "Requests" },
  { key: "upcoming", label: "Upcoming" },
  { key: "active", label: "Active" },
  { key: "completed", label: "Completed" },
];

/* Not in the 4-tab design, so they live behind the filter icon. */
const FILTER_OPTIONS: { key: JobTab; label: string }[] = [
  { key: "all", label: "All jobs" },
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
  requested: "New Request",
  upcoming: "Upcoming",
  active: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

/* Default landing tab is Upcoming (design step 4).  */
function getInitialTab(pathname: string, search: string): JobTab {
  if (pathname.endsWith("/requests")) {
    return "requests";
  }

  const tab = new URLSearchParams(search).get("tab");

  if (
    tab === "all" ||
    tab === "requests" ||
    tab === "upcoming" ||
    tab === "active" ||
    tab === "completed" ||
    tab === "cancelled"
  ) {
    return tab;
  }

  return "upcoming";
}

/* =========================================================
   Card
========================================================= */

interface CardProps {
  job: PartnerJob;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  accepting: boolean;
  rejecting: boolean;
}

function JobCard({ job, onAccept, onReject, accepting, rejecting }: CardProps) {
  const navigate = useNavigate();
  const seconds = useCountdown(job.expiresAt);

  const isRequest = job.status === "requested";
  const expired = isRequest && seconds <= 0;
  const busy = accepting || rejecting;
  const detailsPath = `/partner/jobs/${job.id}`;

  return (
    <article className={`pj-card pj-card-${job.status}`}>
      {isRequest && (
        <div className="pj-request-head">
          <span className="pj-request-title">
            <span className="pj-request-icon" aria-hidden="true">
              <X size={12} strokeWidth={3} />
            </span>
            New Job Request
          </span>

          <span
            className={expired ? "pj-timer pj-timer-expired" : "pj-timer"}
            role="timer"
          >
            {expired ? "Expired" : formatClock(seconds)}
          </span>
        </div>
      )}

      {/* Whole row opens the job, except the action buttons below. */}
      <Link
        to={detailsPath}
        className="pj-row"
        aria-label={`${job.service}, ${STATUS_LABELS[job.status]}`}
      >
        <ServiceThumb service={job.service} image={job.image} />

        <div className="pj-info">
          <div className="pj-top">
            <strong className="pj-service">{job.service}</strong>
            <strong className="pj-price">{formatInr(job.amount)}</strong>
          </div>

          <p className="pj-meta">
            <CalendarDays size={13} aria-hidden="true" />
            {whenLabel(job.scheduledAt)}
          </p>
          <p className="pj-meta">
            <MapPin size={13} aria-hidden="true" />
            {job.location}
          </p>
          <p className="pj-meta">
            <User size={13} aria-hidden="true" />
            {job.customer}
          </p>
        </div>
      </Link>

      {!isRequest && (
        <div className="pj-footer">
          <span className={`pj-status pj-status-${job.status}`}>
            {STATUS_LABELS[job.status]}
          </span>

          <Link
            to={detailsPath}
            className="pj-chevron"
            aria-label={`Open ${job.service}`}
            tabIndex={-1}
          >
            <ChevronRight size={18} aria-hidden="true" />
          </Link>
        </div>
      )}

      {isRequest && (
        <div className="pj-actions">
          <button
            type="button"
            className="pj-btn pj-btn-reject"
            onClick={() => onReject(job.id)}
            disabled={busy}
            aria-label={`Reject ${job.service}`}
          >
            Reject
          </button>
          <button
            type="button"
            className="pj-btn pj-btn-primary"
            onClick={() => onAccept(job.id)}
            disabled={busy || expired}
            aria-label={`Accept ${job.service}`}
          >
            Accept
          </button>
        </div>
      )}

      {job.status === "active" && (
        <div className="pj-actions">
          <button
            type="button"
            className="pj-btn pj-btn-outline"
            onClick={() => navigate(detailsPath)}
          >
            View Details
          </button>
          <button
            type="button"
            className="pj-btn pj-btn-primary"
            onClick={() => navigate(`${detailsPath}/navigation`)}
          >
            Start Job
          </button>
        </div>
      )}
    </article>
  );
}

/* =========================================================
   Page
========================================================= */

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
  const [showSearch, setShowSearch] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [page, setPage] = useState(1);
  const [acceptedId, setAcceptedId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<PartnerJob | null>(null);

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
    onSuccess: (_res, id) => setAcceptedId(id),
    onSettled: () => {
      void invalidateJobs();
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      partnerApi.rejectJob(id, reason),
    onSuccess: () => setRejectTarget(null),
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
    setAcceptedId(null);

    setShowFilter(false);

    if (tab === "requests") {
      navigate("/partner/jobs/requests");
    } else {
      navigate(`/partner/jobs?tab=${tab}`);
    }
  };

  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSearch(event.target.value);
  };

  const handleRetry = () => {
    void jobsQuery.refetch();
  };

  const toggleSearch = () => {
    if (showSearch) {
      setSearch("");
    }

    setShowSearch((v) => !v);
  };

  /* Only the card being acted on is locked, not the whole list. */
  const isAccepting = (id: string) =>
    acceptMutation.isPending && acceptMutation.variables === id;

  const isRejecting = (id: string) =>
    rejectMutation.isPending && rejectMutation.variables?.id === id;

  return (
    <main className="pj-page">
      <div className="pj-container">
        {/* Header */}
        <header className="pj-header">
          <h1>My Jobs</h1>

          <div className="pj-header-actions">
            <button
              type="button"
              className="pj-icon-btn"
              onClick={toggleSearch}
              aria-label={showSearch ? "Close search" : "Search jobs"}
              aria-expanded={showSearch}
            >
              {showSearch ? (
                <X size={18} aria-hidden="true" />
              ) : (
                <Search size={18} aria-hidden="true" />
              )}
            </button>

            <div className="pj-filter-wrap">
              <button
                type="button"
                className="pj-icon-btn"
                onClick={() => setShowFilter((v) => !v)}
                aria-label="Filter jobs"
                aria-haspopup="menu"
                aria-expanded={showFilter}
              >
                <Filter size={18} aria-hidden="true" />
              </button>

              {showFilter && (
                <div className="pj-menu" role="menu">
                  {FILTER_OPTIONS.map((o) => (
                    <button
                      key={o.key}
                      type="button"
                      role="menuitem"
                      className={
                        activeTab === o.key
                          ? "pj-menu-item pj-menu-item-active"
                          : "pj-menu-item"
                      }
                      onClick={() => handleTabChange(o.key)}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Search */}
        {showSearch && (
          <div className="pj-search">
            <Search size={16} aria-hidden="true" />

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
              autoFocus
            />
          </div>
        )}

        {/* Tabs */}
        <nav className="pj-tabs" aria-label="Job status">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={
                activeTab === tab.key ? "pj-tab pj-tab-active" : "pj-tab"
              }
              onClick={() => handleTabChange(tab.key)}
              aria-current={activeTab === tab.key ? "page" : undefined}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {(activeTab === "all" || activeTab === "cancelled") && (
          <div className="pj-filter-chip">
            Showing: {activeTab === "all" ? "All jobs" : "Cancelled jobs"}
            <button
              type="button"
              onClick={() => handleTabChange("upcoming")}
              aria-label="Clear filter"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        )}

        {/* Accepted banner */}
        {acceptedId && (
          <div className="pj-success" role="status">
            <CheckCircle2 size={20} aria-hidden="true" />
            <div>
              <strong>Job accepted successfully!</strong>
              <p>The job has been added to your upcoming jobs.</p>
            </div>
            <button
              type="button"
              className="pj-success-link"
              onClick={() => handleTabChange("upcoming")}
            >
              View
            </button>
          </div>
        )}

        {/* Mutation error */}
        {(acceptMutation.isError || rejectMutation.isError) && (
          <div className="pj-alert" role="alert">
            <strong>Action could not be completed.</strong>
            <span>
              {acceptMutation.error instanceof Error
                ? acceptMutation.error.message
                : "Please refresh the list and try again."}
            </span>
          </div>
        )}

        {/* Loading */}
        {jobsQuery.isLoading && (
          <div className="pj-state" role="status" aria-live="polite">
            <div className="pj-spinner" />
            <p>Loading jobs...</p>
          </div>
        )}

        {/* Error */}
        {jobsQuery.isError && !jobsQuery.isLoading && (
          <div className="pj-state" role="alert">
            <h2>Unable to load jobs</h2>
            <p>Something went wrong while loading your jobs. Please try again.</p>

            <button
              type="button"
              onClick={handleRetry}
              className="pj-btn pj-btn-primary"
            >
              <RefreshCw size={16} aria-hidden="true" />
              Try again
            </button>
          </div>
        )}

        {/* Empty */}
        {!jobsQuery.isLoading && !jobsQuery.isError && jobs.length === 0 && (
          <div className="pj-state" role="status">
            <div className="pj-empty-icon">
              <Clock3 size={26} aria-hidden="true" />
            </div>

            <h2>{EMPTY_LABELS[activeTab]}</h2>

            <p>
              {debouncedSearch
                ? "Try changing your search or clearing the search field."
                : activeTab === "requests"
                  ? "New job requests will appear here when they are available."
                  : "There are no jobs in this category yet."}
            </p>

            {search && (
              <button
                type="button"
                className="pj-btn pj-btn-outline"
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
            <section className="pj-list" aria-label="Jobs list">
              {jobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  onAccept={(id) => acceptMutation.mutate(id)}
                  onReject={(id) => {
                    rejectMutation.reset();
                    setRejectTarget(jobs.find((j) => j.id === id) ?? null);
                  }}
                  accepting={isAccepting(job.id)}
                  rejecting={isRejecting(job.id)}
                />
              ))}
            </section>

            {totalPages > 1 && (
              <div className="pj-pagination">
                <span>
                  Page {Math.min(page, totalPages)} of {totalPages}
                </span>

                <div className="pj-pagination-buttons">
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
            )}
          </>
        )}
      </div>

      <RejectReasonDialog
        open={rejectTarget !== null}
        jobLabel={rejectTarget?.service}
        busy={rejectMutation.isPending}
        error={
          rejectMutation.isError
            ? rejectMutation.error instanceof Error
              ? rejectMutation.error.message
              : "Couldn't reject this job. Please try again."
            : null
        }
        onCancel={() => {
          rejectMutation.reset();
          setRejectTarget(null);
        }}
        onConfirm={(reason) => {
          if (rejectTarget) rejectMutation.mutate({ id: rejectTarget.id, reason });
        }}
      />
    </main>
  );
};

export default PartnerJobsPage;
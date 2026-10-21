import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  CalendarClock,
  Clock,
  ExternalLink,
  ListChecks,
  MapPin,
  NotebookPen,
  Receipt,
  User,
  Wallet,
  Wrench,
} from 'lucide-react';
import {
  acceptAssignedService,
  declineAssignedService,
  fetchAssignedServices,
  fetchJob,
  getErrorMessage,
  getHttpStatus,
  IS_MOCK_JOBS,
  persistChecklistItem,
  resetAllAssignedServices,
  resetMockPartnerJob,
  updateBookingStatus,
} from './jobDetails.api';
import type { JobDetails } from './jobDetails.types';
import { LIFECYCLE, STATUS_LABEL, type JobStatus } from './jobStatus';
import '@/styles/partnerJobs.css';
import './jobDetails.css';

type LoadState = 'loading' | 'ready' | 'error' | 'notfound';

const money = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleDateString('en-IN', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'Asia/Kolkata',
      });
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });
}

function formatDuration(minutes: number | null | undefined): string {
  if (!minutes || minutes <= 0) return '3 hrs';
  if (minutes % 60 === 0) {
    const hrs = minutes / 60;
    return `${hrs} ${hrs === 1 ? 'hr' : 'hrs'}`;
  }
  return `${minutes} mins`;
}

function mapsUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

function useOnline(): boolean {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);
  return online;
}

type FilterTab = 'all' | 'accept' | 'confirmed' | 'declined' | 'completed';

export default function JobDetailsPage() {
  const { id: rawId, jobId } = useParams<{ id?: string; jobId?: string }>();
  const id = rawId || jobId;
  const navigate = useNavigate();
  const location = useLocation();
  const online = useOnline();

  // /partner/jobs/:id  -> that job's details.
  // /partner/assigned (no :id) -> the Assigned Services list. The URL decides, so Back/refresh/deep links all work.
  const showList = !id;
  const [filterTab, setFilterTab] = useState<FilterTab>('accept');
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [assignedServices, setAssignedServices] = useState<JobDetails[]>([]);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [justAcceptedBanner, setJustAcceptedBanner] = useState<boolean>(
    Boolean((location.state as { justAccepted?: boolean } | null)?.justAccepted),
  );
  const [listError, setListError] = useState<string | null>(null);

  const [job, setJob] = useState<JobDetails | null>(null);
  const [state, setState] = useState<LoadState>('loading');
  const [message, setMessage] = useState('');

  // Starting needs the customer's code and a start photo; that lives on the active-job screen.
  const [startHint, setStartHint] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  const load = useCallback(async () => {
    setState('loading');
    setListError(null);
    try {
      let loadedJob: JobDetails | null = null;
      let catalog: JobDetails[];
      if (id) {
        const [fetchedJob, fetchedCatalog] = await Promise.all([
          fetchJob(id),
          fetchAssignedServices().catch(() => [] as JobDetails[]),
        ]);
        loadedJob = fetchedJob;
        catalog = fetchedCatalog;
      } else {
        // The list screen needs only what is assigned to this partner. It must never load a demo job.
        catalog = await fetchAssignedServices();
      }
      setJob(loadedJob);
      setAssignedServices(catalog);
      // At first show 'accept' as default; if there is no data in accept, show 'all' as default
      const pendingAssignedCount = catalog.filter((s) => s.status === 'assigned').length;
      setFilterTab(pendingAssignedCount > 0 ? 'accept' : 'all');
      setState('ready');
    } catch (err) {
      const code = getHttpStatus(err);
      if (code === 404 || code === 403) {
        setState('notfound');
      } else {
        setMessage(getErrorMessage(err, id ? 'Could not load this job.' : 'Could not load your assigned services.'));
        setState('error');
      }
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  // If currently on 'accept' filter but there are no items in 'accept', fall back to 'all'
  useEffect(() => {
    if (assignedServices.length > 0) {
      const pendingAssignedCount = assignedServices.filter((s) => s.status === 'assigned').length;
      if (pendingAssignedCount === 0 && filterTab === 'accept') {
        setFilterTab('all');
      }
    }
  }, [assignedServices, filterTab]);

  const handleAcceptServiceCard = async (serviceId: string) => {
    if (acceptingId || !online) return;
    setAcceptingId(serviceId);
    try {
      const accepted = await acceptAssignedService(serviceId);
      const updatedCatalog = await fetchAssignedServices();
      setAssignedServices(updatedCatalog);
      setJob(accepted);
      setStartHint(null);
      setJustAcceptedBanner(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      navigate(`/partner/jobs/${serviceId}`, { state: { justAccepted: true } });
    } catch (err) {
      setListError(getErrorMessage(err, 'Could not open this service. Try again.'));
    } finally {
      setAcceptingId(null);
    }
  };

  const handleDeclineServiceCard = async (serviceId: string) => {
    if (!online) return;
    setListError(null);
    try {
      const remaining = await declineAssignedService(serviceId);
      setAssignedServices(remaining);
    } catch (err) {
      setListError(getErrorMessage(err, 'Could not decline this service. Try again.'));
    }
  };

  const handleToggleChecklist = async (itemId: string, currentDone: boolean) => {
    if (!job || !online) return;
    try {
      const updatedList = await persistChecklistItem(job.id, itemId, !currentDone);
      const nextChecklist =
        updatedList.length > 0
          ? updatedList
          : job.checklist.map((c) => (c.id === itemId ? { ...c, done: !currentDone } : c));
      const updatedJob = { ...job, checklist: nextChecklist };
      setJob(updatedJob);
      setAssignedServices((prev) =>
        prev.map((item) => (item.id === updatedJob.id ? updatedJob : item)),
      );
    } catch {
      /* keep current state */
    }
  };

  const handleStatusChange = async (nextStatus: JobStatus) => {
    if (!job || actionBusy || !online) return;
    setActionBusy(true);
    try {
      const updated = await updateBookingStatus(job.id, nextStatus as 'en_route' | 'arrived');
      setJob(updated);
      setAssignedServices((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item)),
      );
    } catch (err) {
      setStartHint(getErrorMessage(err, 'Could not update status.'));
    } finally {
      setActionBusy(false);
    }
  };

  const handlePrimaryStartClick = () => {
    if (!job) return;
    if (job.status === 'in_progress' || job.status === 'arrived') {
      navigate(`/partner/jobs/${job.id}/active`);
      return;
    }
    setStartHint('Mark yourself as arrived first. The customer code is needed once you are at the location.');
  };

  const handleResetDemo = () => {
    if (!IS_MOCK_JOBS) return;
    const fresh = resetMockPartnerJob(job?.id || id || 'BK-20418');
    const freshCatalog = resetAllAssignedServices();
    setAssignedServices(freshCatalog);
    setJob(fresh);
    setStartHint(null);
    setJustAcceptedBanner(false);
  };

  if (state === 'loading') {
    return (
      <div className="jd-ref-page" aria-busy="true">
        <div className="jd-ref-container">
          <div className="jd-skel jd-skel-tall" />
          <div className="jd-skel" />
          <div className="jd-skel" />
        </div>
      </div>
    );
  }

  if (state === 'notfound') {
    return (
      <div className="jd-ref-page">
        <div className="jd-ref-container">
          <div className="jd-emptycard">
            <p className="jd-empty-title">Job not found</p>
            <p className="jd-empty">This job was not found, or it is not assigned to you.</p>
          </div>
        </div>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="jd-ref-page">
        <div className="jd-ref-container">
          <div className="jd-emptycard">
            <p className="jd-error" role="alert">
              {message || 'Could not load this job.'}
            </p>
            <button type="button" className="jd-ref-primary-btn" onClick={() => void load()}>
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // STEP 1: ASSIGNED SERVICE CARDS VIEW (shown first on /partner/work)
  // ============================================================================
  if (showList) {
    const acceptCount = assignedServices.filter((s) => s.status === 'assigned').length;
    const declinedCount = assignedServices.filter(
      (s) => s.status === 'cancelled_by_partner' || s.status.startsWith('cancelled')
    ).length;
    const confirmedCount = assignedServices.filter(
      (s) =>
        s.status === 'confirmed' ||
        s.status === 'en_route' ||
        s.status === 'arrived' ||
        s.status === 'in_progress'
    ).length;
    const completedCount = assignedServices.filter(
      (s) => s.status === 'completed' || s.status === 'rated'
    ).length;

    const filteredServices = assignedServices.filter((item) => {
      if (filterTab === 'accept') return item.status === 'assigned';
      if (filterTab === 'declined') {
        return item.status === 'cancelled_by_partner' || item.status.startsWith('cancelled');
      }
      if (filterTab === 'confirmed') {
        return (
          item.status === 'confirmed' ||
          item.status === 'en_route' ||
          item.status === 'arrived' ||
          item.status === 'in_progress'
        );
      }
      if (filterTab === 'completed') {
        return item.status === 'completed' || item.status === 'rated';
      }
      return true;
    });

    return (
      <div className="jd-ref-page">
        {!online && (
          <p className="jd-offline" role="status">
            You are offline. Reconnect to accept assigned services.
          </p>
        )}

        <div className="jd-assigned-shell">
          <header className="jd-assigned-header">
            <div>
              <p className="jd-ref-eyebrow">Work queue</p>
              <h2 className="jd-ref-booking-code">Assigned Services</h2>
              <p className="jd-assigned-subtitle">
                Select and accept an assigned service below to unlock full booking details and start the job.
              </p>
            </div>
            <div className="jd-assigned-header-actions">
              <span className="jd-assigned-count-pill">
                {filteredServices.length} {filteredServices.length === 1 ? 'Service' : 'Services'}
              </span>
              <button
                type="button"
                onClick={() => setShowFilters((prev) => !prev)}
                className={`jd-filter-toggle-btn ${showFilters ? 'jd-filter-toggle-btn-active' : ''}`}
                aria-expanded={showFilters}
                aria-controls="jd-filter-tabs-panel"
                aria-label="Filter"
                title="Filter services"
              >
                {/* Sliders filter icon matching user uploaded image */}
                <svg
                  className="jd-filter-slider-icon"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <line x1="2" y1="5" x2="13" y2="5" />
                  <line x1="19" y1="5" x2="22" y2="5" />
                  <circle cx="16" cy="5" r="3" fill="none" />

                  <line x1="2" y1="12" x2="5" y2="12" />
                  <line x1="11" y1="12" x2="22" y2="12" />
                  <circle cx="8" cy="12" r="3" fill="none" />

                  <line x1="2" y1="19" x2="12" y2="19" />
                  <line x1="18" y1="19" x2="22" y2="19" />
                  <circle cx="15" cy="19" r="3" fill="none" />
                </svg>
                <span>Filter</span>
              </button>
            </div>
          </header>

          {/* Filter Bar: Shown directly on web, toggleable on mobile */}
          <div
            className={`jd-filter-section ${showFilters ? 'jd-filter-mobile-open' : 'jd-filter-mobile-closed'}`}
            id="jd-filter-tabs-panel"
          >
            <div className="jd-filter-tabs-row" role="tablist" aria-label="Filter assigned services">
              {/* 1. Accept */}
              <button
                type="button"
                role="tab"
                aria-selected={filterTab === 'accept'}
                onClick={() => setFilterTab('accept')}
                className={`jd-filter-tab ${filterTab === 'accept' ? 'jd-filter-tab-active' : ''}`}
              >
                <span>Accept</span>
                <span className="jd-filter-count">{acceptCount}</span>
              </button>

              {/* 2. Decline */}
              <button
                type="button"
                role="tab"
                aria-selected={filterTab === 'declined'}
                onClick={() => setFilterTab('declined')}
                className={`jd-filter-tab ${filterTab === 'declined' ? 'jd-filter-tab-active' : ''}`}
              >
                <span>Decline</span>
                <span className="jd-filter-count">{declinedCount}</span>
              </button>

              {/* 3. Confirmed */}
              <button
                type="button"
                role="tab"
                aria-selected={filterTab === 'confirmed'}
                onClick={() => setFilterTab('confirmed')}
                className={`jd-filter-tab ${filterTab === 'confirmed' ? 'jd-filter-tab-active' : ''}`}
              >
                <span>Confirmed</span>
                <span className="jd-filter-count">{confirmedCount}</span>
              </button>

              {/* 4. Completed */}
              <button
                type="button"
                role="tab"
                aria-selected={filterTab === 'completed'}
                onClick={() => setFilterTab('completed')}
                className={`jd-filter-tab ${filterTab === 'completed' ? 'jd-filter-tab-active' : ''}`}
              >
                <span>Completed</span>
                <span className="jd-filter-count">{completedCount}</span>
              </button>

              {/* 5. All */}
              <button
                type="button"
                role="tab"
                aria-selected={filterTab === 'all'}
                onClick={() => setFilterTab('all')}
                className={`jd-filter-tab ${filterTab === 'all' ? 'jd-filter-tab-active' : ''}`}
              >
                <span>All</span>
                <span className="jd-filter-count">{assignedServices.length}</span>
              </button>
            </div>
          </div>

          {listError && (
            <p className="jd-error" role="alert">
              {listError}
            </p>
          )}

          {assignedServices.length === 0 ? (
            <div className="jd-emptycard">
              <p className="jd-empty-title">No services assigned to you yet</p>
              <p className="jd-empty">
                When admin assigns you a booking it will appear here. Nothing here is sample data.
              </p>
            </div>
          ) : filteredServices.length === 0 ? (
            <div className="jd-emptycard">
              <p className="jd-empty-title">No services in this filter</p>
              <p className="jd-empty">Switch filters above to view other assigned, confirmed, declined, or completed services.</p>
              {filterTab !== 'all' && (
                <button
                  type="button"
                  onClick={() => setFilterTab('all')}
                  className="jd-ref-secondary-btn"
                >
                  Show All Services
                </button>
              )}
            </div>
          ) : (
            <div className="jd-assigned-grid" role="list" aria-label="Assigned service cards">
              {filteredServices.map((item) => {
                const isPendingAssigned = item.status === 'assigned';
                const isDeclined =
                  item.status === 'cancelled_by_partner' || item.status.startsWith('cancelled');
                const isInProgress = item.status === 'in_progress';
                const isCompleted = item.status === 'completed' || item.status === 'rated';
                const itemAddress = [
                  item.location.address,
                  item.location.city
                    ? `${item.location.city}${item.location.pincode ? ` ${item.location.pincode}` : ''}`
                    : item.location.pincode,
                ]
                  .filter(Boolean)
                  .join(', ');

                return (
                  <article
                    key={item.id}
                    role="listitem"
                    className={`jd-service-card ${!isPendingAssigned ? 'jd-service-card-accepted' : ''}`}
                  >
                    {/* Card Top: Booking ID + Status Pill */}
                    <div className="jd-service-card-top">
                      <Link
                        to={`/partner/jobs/${item.id}`}
                        className="jd-ref-card-label"
                        style={{ marginBottom: 0, textDecoration: 'none' }}
                      >
                        {item.bookingCode}
                      </Link>
                      <span className={`jd-ref-status-pill jd-ref-status-${item.status}`}>
                        {isPendingAssigned
                          ? 'Assigned to you'
                          : isDeclined
                            ? 'Declined'
                            : isInProgress
                              ? 'In progress'
                              : isCompleted
                                ? 'Completed'
                                : 'Confirmed'}
                      </span>
                    </div>

                    {/* Service Title & Duration */}
                    <div className="jd-service-card-hero">
                      <div className="jd-ref-row-between">
                        <h3 className="jd-service-card-title">
                          <Link
                            to={`/partner/jobs/${item.id}`}
                            style={{ color: 'inherit', textDecoration: 'none' }}
                          >
                            {item.service.name}
                          </Link>
                        </h3>
                        <span className="jd-service-duration-badge">
                          <Clock size={13} aria-hidden="true" />
                          {formatDuration(item.service.durationMinutes)}
                        </span>
                      </div>
                      {item.service.description && (
                        <p className="jd-ref-card-sub">{item.service.description}</p>
                      )}
                    </div>

                    {/* Details Grid Inside Card */}
                    <div className="jd-service-card-meta">
                      <div className="jd-service-meta-box">
                        <span className="jd-service-meta-label">
                          <CalendarClock aria-hidden="true" />
                          Schedule
                        </span>
                        <strong className="jd-service-meta-value">
                          {item.schedule.dateLabel ?? formatDate(item.schedule.scheduledAt)}
                        </strong>
                        <span className="jd-service-meta-sub">{item.schedule.slot}</span>
                      </div>

                      <div className="jd-service-meta-box">
                        <span className="jd-service-meta-label">
                          <User aria-hidden="true" />
                          Customer
                        </span>
                        <strong className="jd-service-meta-value">{item.customer.name}</strong>
                        <span className="jd-service-meta-sub">{item.customer.phoneMasked}</span>
                      </div>
                    </div>

                    {/* Location */}
                    <div className="jd-service-location-box">
                      <span className="jd-service-meta-label">
                        <MapPin aria-hidden="true" />
                        Location
                      </span>
                      <p className="jd-service-location-text">{itemAddress}</p>
                      {item.location.hint && (
                        <p className="jd-ref-location-hint">{item.location.hint}</p>
                      )}
                      {itemAddress && (
                        <a
                          className="jd-maps-link"
                          href={mapsUrl(itemAddress)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open in Maps <ExternalLink aria-hidden="true" />
                        </a>
                      )}
                    </div>

                    {/* Add-ons & Payout Summary */}
                    <div className="jd-service-payout-row">
                      <div>
                        <span className="jd-service-meta-label">Total booking</span>
                        <p className="jd-service-total-amt">
                          {money.format(item.price.total)}
                          {item.addOns.length > 0 && (
                            <span className="jd-service-addon-tag">
                              +{item.addOns.length} {item.addOns.length === 1 ? 'add-on' : 'add-ons'}
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="jd-service-payout-right">
                        <span className="jd-service-meta-label">Your payout</span>
                        <strong className="jd-service-payout-amt">
                          {money.format(item.price.partnerEarning)}
                        </strong>
                      </div>
                    </div>

                    {/* Card Action Buttons */}
                    <div className="jd-service-card-actions">
                      {isPendingAssigned ? (
                        <>
                          <button
                            type="button"
                            disabled={!online || acceptingId === item.id}
                            onClick={() => void handleAcceptServiceCard(item.id)}
                            className="jd-service-accept-btn"
                          >
                            {acceptingId === item.id ? 'Accepting…' : 'Accept Service'}
                          </button>
                          <Link
                            to={`/partner/jobs/${item.id}`}
                            className="jd-service-decline-btn"
                            style={{
                              textAlign: 'center',
                              textDecoration: 'none',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            View details
                          </Link>
                          <button
                            type="button"
                            disabled={!online || acceptingId === item.id}
                            onClick={() => void handleDeclineServiceCard(item.id)}
                            className="jd-service-decline-btn"
                          >
                            Decline
                          </button>
                        </>
                      ) : isDeclined ? (
                        <button
                          type="button"
                          disabled
                          className="jd-service-declined-state-btn"
                        >
                          Service Declined
                        </button>
                      ) : (
                        <>
                          <Link
                            to={`/partner/jobs/${item.id}`}
                            className="jd-service-accept-btn"
                            style={{
                              textAlign: 'center',
                              textDecoration: 'none',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            View Total Booked Details →
                          </Link>
                          {isInProgress && (
                            <button
                              type="button"
                              onClick={() => navigate(`/partner/jobs/${item.id}/active`)}
                              className="jd-service-active-btn"
                            >
                              Active Job
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ============================================================================
  // STEP 2: TOTAL BOOKED DETAILS VIEW (shown after Partner accepts a service card)
  // ============================================================================
  if (!job) {
    return (
      <div className="jd-ref-page">
        <div className="jd-ref-container">
          <div className="jd-emptycard">
            <p className="jd-error" role="alert">
              Could not load this job.
            </p>
            <button type="button" className="jd-ref-primary-btn" onClick={() => void load()}>
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  const time = formatTime(job.schedule.scheduledAt);
  const fullAddress = [
    job.location.address,
    job.location.city
      ? `${job.location.city}${job.location.pincode ? ` ${job.location.pincode}` : ''}`
      : job.location.pincode,
  ]
    .filter(Boolean)
    .join(', ');

  const addOnsTotal = job.addOns.reduce((sum, a) => sum + a.amount, 0);
  const baseServicePrice =
    job.price.basePrice ?? Math.max(0, job.price.total - addOnsTotal);

  const isDefaultConfirmedDemo =
    job.bookingCode === '#BK-20418' && job.status === 'confirmed';
  const displayedChecklist = isDefaultConfirmedDemo
    ? job.checklist
        .filter((item) => !item.label.includes('(add-on)'))
        .map((item) => ({ ...item, done: false }))
    : job.checklist;

  return (
    <div className="jd-ref-page">
      {!online && (
        <p className="jd-offline" role="status">
          You are offline. Status changes will not work until you reconnect.
        </p>
      )}

      <div className="jd-ref-container">
        {/* Back navigation lives in the top bar (PartnerLayout) */}
        {justAcceptedBanner && (
          <div className="jd-back-bar">
            <span className="jd-accepted-toast" role="status">
              ✓ Service accepted — Total booked details unlocked
            </span>
          </div>
        )}

        {/* Header: BOOKING #BK-20418 | Confirmed */}
        <header className="jd-ref-header">
          <div>
            <p className="jd-ref-eyebrow">Booking</p>
            <h2 className="jd-ref-booking-code">{job.bookingCode}</h2>
          </div>
          <span className={`jd-ref-status-pill jd-ref-status-${job.status}`}>
            {STATUS_LABEL[job.status] ?? 'Confirmed'}
          </span>
        </header>

        {/* Where this visit stands. Cancelled / no-show / disputed sit outside the lifecycle. */}
        {LIFECYCLE.includes(job.status) || job.status === 'confirmed' ? (
          <ol className="jd-track" aria-label="Visit progress">
            {LIFECYCLE.map((step, i) => {
              const current = Math.max(0, LIFECYCLE.indexOf(job.status));
              const state = i < current ? 'is-done' : i === current ? 'is-current' : '';
              return (
                <li key={step} className={state} aria-current={i === current ? 'step' : undefined}>
                  {STATUS_LABEL[step]}
                </li>
              );
            })}
          </ol>
        ) : null}

        {/* Card 1: SERVICE */}
        <section className="jd-ref-card jd-card-service" aria-label="Service">
          <p className="jd-ref-card-label">
            <Wrench aria-hidden="true" />
            Service
          </p>
          <div className="jd-ref-row-between">
            <h3 className="jd-ref-card-title">{job.service.name}</h3>
            <span className="jd-ref-card-right">
              {formatDuration(job.service.durationMinutes)}
            </span>
          </div>
          {job.service.description && (
            <p className="jd-ref-card-sub">{job.service.description}</p>
          )}
        </section>

        {/* Card 2: CUSTOMER (MASKED) */}
        <section className="jd-ref-card jd-card-customer" aria-label="Customer">
          <p className="jd-ref-card-label">
            <User aria-hidden="true" />
            Customer
          </p>
          <div className="jd-ref-row-between">
            <p className="jd-ref-card-title">{job.customer.name}</p>
            <span className="jd-ref-card-right">{job.customer.phoneMasked}</span>
          </div>
          <p className="jd-ref-card-sub">
            {job.customer.subtitle ?? 'Calls are routed through the app'}
          </p>
        </section>

        {/* Card 3: LOCATION */}
        <section className="jd-ref-card jd-card-location" aria-label="Location">
          <p className="jd-ref-card-label">
            <MapPin aria-hidden="true" />
            Location
          </p>
          <p className="jd-ref-body-text">{fullAddress}</p>
          {job.location.hint && <p className="jd-ref-location-hint">{job.location.hint}</p>}
          {fullAddress && (
            <a className="jd-maps-link" href={mapsUrl(fullAddress)} target="_blank" rel="noreferrer">
              Open in Maps <ExternalLink aria-hidden="true" />
            </a>
          )}
        </section>

        {/* Card 4: SCHEDULE */}
        <section className="jd-ref-card jd-card-schedule" aria-label="Schedule">
          <p className="jd-ref-card-label">
            <CalendarClock aria-hidden="true" />
            Schedule
          </p>
          <div className="jd-ref-row-between">
            <p className="jd-ref-card-title">
              {job.schedule.dateLabel ?? formatDate(job.schedule.scheduledAt)}
            </p>
            <span className="jd-ref-card-right">
              {job.schedule.slot ?? (time || '—')}
            </span>
          </div>
        </section>

        {/* Card 5: PRICE & ADD-ONS */}
        <section className="jd-ref-card jd-card-price" aria-label="Price and add-ons">
          <p className="jd-ref-card-label">
            <Receipt aria-hidden="true" />
            Price &amp; add-ons
          </p>
          <div className="jd-ref-price-list">
            <div className="jd-ref-price-row">
              <span>Base service</span>
              <strong>{money.format(baseServicePrice)}</strong>
            </div>
            {job.addOns.map((addon) => (
              <div className="jd-ref-price-row" key={addon.id}>
                <span>
                  {addon.name}
                  {addon.quantity > 1 ? ` × ${addon.quantity}` : ''}
                </span>
                <strong>{money.format(addon.amount)}</strong>
              </div>
            ))}
            <div className="jd-ref-price-divider" />
            <div className="jd-ref-price-row jd-ref-price-total">
              <span>Total</span>
              <strong>{money.format(job.price.total)}</strong>
            </div>
          </div>
        </section>

        {/* Card 6: INSTRUCTIONS */}
        <section className="jd-ref-card jd-card-instructions" aria-label="Instructions">
          <p className="jd-ref-card-label">
            <NotebookPen aria-hidden="true" />
            Instructions
          </p>
          <p className="jd-ref-body-text">
            {job.instructions ?? 'No special instructions.'}
          </p>
        </section>

        {/* Card 7: CHECKLIST */}
        <section className="jd-ref-card jd-card-checklist" aria-label="Checklist">
          <p className="jd-ref-card-label">
            <ListChecks aria-hidden="true" />
            Checklist
          </p>
          {!IS_MOCK_JOBS && job.status !== 'in_progress' && displayedChecklist.length > 0 && (
            <p className="jd-ref-location-hint">You can tick items once the job has started.</p>
          )}
          {displayedChecklist.length === 0 ? (
            <p className="jd-ref-body-text">No checklist for this job.</p>
          ) : (
            <ul className="jd-ref-checklist">
              {displayedChecklist.map((item) => (
                <li key={item.id} className="jd-ref-check-item">
                  <label className="jd-ref-check-label">
                    <input
                      type="checkbox"
                      checked={item.done}
                      disabled={!IS_MOCK_JOBS && job.status !== 'in_progress'}
                      onChange={() => void handleToggleChecklist(item.id, item.done)}
                      className="jd-ref-checkbox"
                    />
                    <span>{item.label}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Card: EXTRA CHARGES */}
        {((job.extraCharges && job.extraCharges.length > 0) || job.status === 'in_progress') && (
          <section className="jd-ref-card jd-card-extra-charges" aria-label="Extra Charges">
            <div className="flex items-center justify-between mb-2">
              <p className="jd-ref-card-label" style={{ marginBottom: 0 }}>
                <Receipt aria-hidden="true" />
                Extra Charges
              </p>
              {job.status === 'in_progress' && (
                <Link
                  to={`/partner/jobs/${job.id}/active`}
                  className="text-xs font-semibold text-[#4338ca] hover:underline"
                >
                  Manage on Active Job →
                </Link>
              )}
            </div>
            {(!job.extraCharges || job.extraCharges.length === 0) ? (
              <p className="jd-ref-body-text">No extra charges requested yet.</p>
            ) : (
              <div className="space-y-2 mt-2">
                {job.extraCharges.map((charge) => {
                  const statusColor =
                    charge.status === 'approved'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : charge.status === 'rejected'
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200';
                  return (
                    <div
                      key={charge.id}
                      className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 bg-slate-50 text-xs"
                    >
                      <div>
                        <p className="font-semibold text-slate-800">{charge.title}</p>
                        <p className="text-slate-500">
                          Qty: {charge.quantity} × ₹{charge.amount} = ₹{charge.quantity * charge.amount}
                        </p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full border text-[11px] font-semibold uppercase ${statusColor}`}>
                        {charge.status}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* Card 8: PAYMENT */}
        <section className="jd-ref-card jd-card-payment" aria-label="Payment">
          <p className="jd-ref-card-label">
            <Wallet aria-hidden="true" />
            Payment
          </p>
          <div className="jd-ref-price-list">
            <div className="jd-ref-price-row">
              <span>Method</span>
              <strong>{job.payment.method ?? 'Pay after service (UPI / cash)'}</strong>
            </div>
            <div className="jd-ref-price-row">
              <span>Your payout</span>
              <strong>{money.format(job.price.partnerEarning)}</strong>
            </div>
          </div>
        </section>

        {/* Primary Bottom Button: Start job */}
        <div className="jd-ref-cta-wrap">
          <button
            type="button"
            className="jd-ref-primary-btn"
            disabled={!online || actionBusy}
            onClick={handlePrimaryStartClick}
          >
            {job.status === 'in_progress' ? 'Continue active job' : 'Start job'}
          </button>
          {startHint && (
            <p className="jd-ref-otp-error" role="status">
              {startHint}
            </p>
          )}

          {/* Subtle navigation & demo controls */}
          <div className="jd-ref-demo-footer">
            <Link
              to={`/partner/jobs/${job.id}/active`}
              className="jd-ref-demo-link"
            >
              Open Active Job Screen →
            </Link>
            {job.status !== 'en_route' && job.status !== 'arrived' && job.status !== 'in_progress' && (
              <button
                type="button"
                onClick={() => void handleStatusChange('en_route')}
                className="jd-ref-demo-link-btn"
              >
                Mark En Route
              </button>
            )}
            {job.status === 'en_route' && (
              <button
                type="button"
                onClick={() => void handleStatusChange('arrived')}
                className="jd-ref-demo-link-btn"
              >
                Mark Arrived
              </button>
            )}
            {IS_MOCK_JOBS && (
              <button
                type="button"
                onClick={handleResetDemo}
                className="jd-ref-demo-link-btn"
              >
                Reset demo
              </button>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
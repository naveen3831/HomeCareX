import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowRight,
  CalendarDays,
  ChevronRight,
  Clock3,
  MapPin,
  StickyNote,
  Timer,
  Wallet,
} from 'lucide-react';
import {
  acceptAssignedService,
  declineAssignedService,
  fetchAssignedServices,
  fetchJob,
  getErrorMessage,
  getHttpStatus,
  verifyStart,
} from './jobDetails.api';
import ServiceHeroImage from './ServiceHeroImage';
import PaymentPanel from '@/components/partner/PaymentPanel';
import type { JobDetails } from './jobDetails.types';
import { STATUS_LABEL } from './jobStatus';
import './jobDetails.css';
import './jobDetailsModern.css';
import './jobDetailsWeb.css';

type LoadState = 'loading' | 'ready' | 'error' | 'notfound';
type ViewMode = 'list' | 'details';

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
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const online = useOnline();

  // /partner/jobs/:id  -> that job's details.
  // /partner/assigned (no :id) -> the Assigned Services list. The URL decides, so Back/refresh/deep links all work.
  // If route has an explicit :id (/partner/jobs/:id), open details directly;
  // If on /partner/work (no :id), first show Assigned Service Cards.
  const [viewMode, setViewMode] = useState<ViewMode>(() => (id ? 'details' : 'list'));
  const [filterTab, setFilterTab] = useState<FilterTab>('accept');
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [assignedServices, setAssignedServices] = useState<JobDetails[]>([]);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [justAcceptedBanner, setJustAcceptedBanner] = useState<boolean>(false);

  const [job, setJob] = useState<JobDetails | null>(null);
  const [state, setState] = useState<LoadState>('loading');
  const [message, setMessage] = useState('');

  // OTP & Start Job flow state
  const [otpModalOpen, setOtpModalOpen] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  const load = useCallback(async () => {
    setState('loading');
    try {
      const targetId = id || 'BK-20418';
      const [loadedJob, catalog] = await Promise.all([
        fetchJob(targetId),
        fetchAssignedServices().catch(() => [] as JobDetails[]),
      ]);
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
        setMessage(getErrorMessage(err, 'Could not load this job.'));
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

  // Keep viewMode synced if route param changes
  useEffect(() => {
    if (id) {
      setViewMode('details');
    }
  }, [id]);

  const handleAcceptServiceCard = async (serviceId: string) => {
    if (acceptingId || !online) return;
    setAcceptingId(serviceId);
    try {
      const accepted = await acceptAssignedService(serviceId);
      const updatedCatalog = await fetchAssignedServices();
      setAssignedServices(updatedCatalog);
      setJob(accepted);
      setOtpCode('');
      setOtpError(null);
      setJustAcceptedBanner(true);
      setViewMode('details');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setAcceptingId(null);
    }
  };

  const handleDeclineServiceCard = async (serviceId: string) => {
    if (!online) return;
    const remaining = await declineAssignedService(serviceId);
    setAssignedServices(remaining);
  };

  const handlePrimaryStartClick = () => {
    if (!job) return;
    if (job.status === 'in_progress') {
      navigate(`/partner/jobs/${job.id}/active`);
      return;
    }
    // Every step before the job starts (on the way, arrived, start code + photos/video) lives on the
    // Navigation page: map, call, chat, help and the start form.
    navigate(`/partner/jobs/${job.id}/navigation`);
  };

  // One call does both: POST /partner/jobs/:id/verify-start checks the customer's code and starts the job.
  const handleStartJob = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!job || actionBusy) return;
    if (!online) {
      setOtpError('You are offline. Reconnect and try again.');
      return;
    }
    const code = otpCode.trim();
    if (!/^\d{4,6}$/.test(code)) {
      setOtpError('Please enter the 4-digit code from the customer.');
      return;
    }

    setActionBusy(true);
    setOtpError(null);
    try {
      const updated = await verifyStart(job.id, code);
      setJob(updated);
      setOtpModalOpen(false);
      navigate(`/partner/jobs/${updated.id}/active`);
    } catch (err) {
      setOtpError(getErrorMessage(err, 'Could not start job.'));
    } finally {
      setActionBusy(false);
    }
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

  if (state === 'error' || !job) {
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
  if (viewMode === 'list') {
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
              <p className="jd-ref-eyebrow">PARTNER WORK QUEUE</p>
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

          {filteredServices.length === 0 ? (
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
                      <span className="jd-ref-card-label" style={{ marginBottom: 0 }}>
                        {item.bookingCode}
                      </span>
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
                        <h3 className="jd-service-card-title">{item.service.name}</h3>
                        <span className="jd-service-duration-badge">
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
                        <span className="jd-service-meta-label">SCHEDULE</span>
                        <strong className="jd-service-meta-value">
                          {item.schedule.dateLabel ?? formatDate(item.schedule.scheduledAt)}
                        </strong>
                        <span className="jd-service-meta-sub">{item.schedule.slot}</span>
                      </div>

                      <div className="jd-service-meta-box">
                        <span className="jd-service-meta-label">CUSTOMER (MASKED)</span>
                        <strong className="jd-service-meta-value">{item.customer.name}</strong>
                        <span className="jd-service-meta-sub">{item.customer.phoneMasked}</span>
                      </div>
                    </div>

                    {/* Location */}
                    <div className="jd-service-location-box">
                      <span className="jd-service-meta-label">LOCATION</span>
                      <p className="jd-service-location-text">{itemAddress}</p>
                      {item.location.hint && (
                        <p className="jd-ref-location-hint">{item.location.hint}</p>
                      )}
                    </div>

                    {/* Add-ons & Payout Summary */}
                    <div className="jd-service-payout-row">
                      <div>
                        <span className="jd-service-meta-label">TOTAL BOOKING</span>
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
                        <span className="jd-service-meta-label">YOUR PAYOUT</span>
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
                          <button
                            type="button"
                            onClick={() => void handleAcceptServiceCard(item.id)}
                            className="jd-service-accept-btn"
                          >
                            View Total Booked Details →
                          </button>
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
  const time = formatTime(job.schedule.scheduledAt);
  const fullAddress = [
    job.location.address,
    job.location.city
      ? `${job.location.city}${job.location.pincode ? ` ${job.location.pincode}` : ''}`
      : job.location.pincode,
  ]
    .filter(Boolean)
    .join(', ');

  // The backend sends the status in capitals ("PAID"), so compare ignoring case.
  const isPaid = job.payment.phase === 'paid';
  const paymentLabel = isPaid
    ? 'Payment completed'
    : (job.payment.method ?? 'Pay after service is completed');

  const initials =
    job.customer.name
      .replace(/[^A-Za-z ]/g, '')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase() || 'C';

  const isFinishedJob = job.status === 'completed' || job.status === 'rated';
  const canStart =
    !isFinishedJob &&
    !job.status.startsWith('cancelled') &&
    job.status !== 'no_show' &&
    job.status !== 'disputed';

  return (
    <div className="jdw-page">
      {!online && (
        <p className="jd-offline" role="status">
          You are offline. Status changes will not work until you reconnect.
        </p>
      )}

      <div className="jdw-container">
        <nav className="jdw-crumbs" aria-label="Breadcrumb">
          <button type="button" className="jdw-crumb-link" onClick={() => navigate('/partner/jobs')}>
            My Jobs
          </button>
          <ChevronRight size={14} aria-hidden="true" />
          <span className="jdw-crumb-current" aria-current="page">
            {job.service.name}
          </span>
        </nav>

        {justAcceptedBanner && (
          <p className="jdw-toast" role="status">
            Service accepted. Full booking details are now unlocked.
          </p>
        )}

        <div className="jdw-grid">
          {/* ---------- left: everything about the job ---------- */}
          <div className="jdw-main">
            <ServiceHeroImage serviceName={job.service.name} />

            <section className="jdw-card" aria-label="Service">
              <h1 className="jdw-title">{job.service.name}</h1>
              {job.service.description && <p className="jdw-lead">{job.service.description}</p>}

              <dl className="jdw-facts">
                <div className="jdw-fact">
                  <span className="jdw-fact-icon" aria-hidden="true">
                    <CalendarDays size={18} />
                  </span>
                  <div>
                    <dt>Date</dt>
                    <dd>{job.schedule.dateLabel ?? formatDate(job.schedule.scheduledAt)}</dd>
                  </div>
                </div>
                <div className="jdw-fact">
                  <span className="jdw-fact-icon" aria-hidden="true">
                    <Clock3 size={18} />
                  </span>
                  <div>
                    <dt>Time</dt>
                    <dd>{job.schedule.slot ?? (time || '—')}</dd>
                  </div>
                </div>
                <div className="jdw-fact">
                  <span className="jdw-fact-icon" aria-hidden="true">
                    <Timer size={18} />
                  </span>
                  <div>
                    <dt>Duration</dt>
                    <dd>{formatDuration(job.service.durationMinutes)}</dd>
                  </div>
                </div>
              </dl>
            </section>

            <section className="jdw-card jdw-card-flush" aria-label="Customer and address">
              <div className="jdw-row">
                <span className="jdw-avatar" aria-hidden="true">
                  {initials}
                </span>
                <div className="jdw-row-body">
                  <span className="jdw-label">Customer</span>
                  <strong>{job.customer.name}</strong>
                  {job.customer.subtitle && <small>{job.customer.subtitle}</small>}
                </div>
              </div>
              <div className="jdw-row">
                <span className="jdw-tile" aria-hidden="true">
                  <MapPin size={18} />
                </span>
                <div className="jdw-row-body">
                  <span className="jdw-label">Service address</span>
                  <strong>{fullAddress}</strong>
                  {job.location.hint && <small>{job.location.hint}</small>}
                </div>
              </div>
            </section>

            <section className="jdw-note" aria-label="Instructions">
              <StickyNote size={20} aria-hidden="true" />
              <div>
                <strong>Instructions from the customer</strong>
                <p>{job.instructions?.trim() || 'No special instructions.'}</p>
              </div>
            </section>

            {isFinishedJob && <PaymentPanel job={job} onJobChange={setJob} online={online} />}
          </div>

          {/* ---------- right: booking summary + action (sticky on desktop) ---------- */}
          <aside className="jdw-aside" aria-label="Booking summary">
            <div className="jdw-summary">
              <div className="jdw-summary-head">
                <span className={`jdw-status jdw-status-${job.status}`}>
                  <span className="jdw-status-dot" aria-hidden="true" />
                  {STATUS_LABEL[job.status] ?? 'Confirmed'}
                </span>
                <div className="jdw-code">
                  <span>Booking</span>
                  <strong>{job.bookingCode}</strong>
                </div>
              </div>

              <div className="jdw-pay">
                <span className="jdw-pay-icon" aria-hidden="true">
                  <Wallet size={18} />
                </span>
                <div>
                  <span className="jdw-label">{isPaid ? 'Payment' : 'Customer will pay'}</span>
                  <strong>{paymentLabel}</strong>
                </div>
              </div>

              <div className="jdw-total">
                <span>Total</span>
                <strong>{money.format(job.price.total)}</strong>
              </div>

              {isFinishedJob && (
                <button type="button" className="jdw-cta" onClick={() => navigate('/partner/jobs')}>
                  Back to my jobs
                  <ArrowRight size={18} aria-hidden="true" />
                </button>
              )}
              {canStart && (
                <button
                  type="button"
                  className="jdw-cta"
                  disabled={!online || actionBusy}
                  onClick={handlePrimaryStartClick}
                >
                  {job.status === 'in_progress' ? 'Continue active job' : 'Start job'}
                  <ArrowRight size={18} aria-hidden="true" />
                </button>
              )}
            </div>
          </aside>
        </div>
      </div>

      {/* Start Job Customer OTP Verification Modal */}
      {otpModalOpen && (
        <div
          className="jd-ref-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="jd-otp-modal-title"
        >
          <div className="jd-ref-modal">
            <div className="jd-ref-modal-header">
              <h3 id="jd-otp-modal-title" className="jd-ref-modal-title">
                Start Job: Customer OTP
              </h3>
            </div>

            <p className="jd-ref-modal-desc">
              Ask <strong>{job.customer.name}</strong> ({job.customer.phoneMasked}) for the start code
              to unlock the full address and begin <strong>{job.service.name}</strong>.
            </p>

            <form onSubmit={(e) => void handleStartJob(e)} className="jd-ref-otp-form">
              <label htmlFor="jd-start-otp-input" className="jd-ref-otp-label">
                Enter 4-Digit Start OTP
              </label>
              <div className="jd-ref-otp-input-row">
                <input
                  id="jd-start-otp-input"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => {
                    setOtpCode(e.target.value);
                    if (otpError) setOtpError(null);
                  }}
                  placeholder="Enter start OTP"
                  className="jd-ref-otp-input"
                />
              </div>
            </form>

            {otpError && (
              <p className="jd-ref-otp-error" role="alert">
                {otpError}
              </p>
            )}

            <div className="jd-ref-modal-actions">
              <button
                type="button"
                onClick={() => setOtpModalOpen(false)}
                className="jd-ref-modal-cancel"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!/^\d{4,6}$/.test(otpCode.trim()) || actionBusy}
                onClick={() => void handleStartJob()}
                className="jd-ref-modal-confirm"
              >
                {actionBusy ? 'Starting…' : 'Start job'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
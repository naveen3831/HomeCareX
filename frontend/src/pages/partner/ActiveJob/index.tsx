import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Home,
  ChevronRight,
  Clock,
  Hourglass,
  ListChecks,
  MapPin,
  Navigation,
  Package,
  Plus,
  StickyNote,
  User,
  Wallet,
} from 'lucide-react';
import {
  fetchJob,
  completeJob,
  verifyStart,
  getErrorMessage,
  getHttpStatus,
} from '@/pages/partner/JobDetails/jobDetails.api';
import type { JobDetails } from '@/pages/partner/JobDetails/jobDetails.types';
import { STATUS_LABEL } from '@/pages/partner/JobDetails/jobStatus';
import JobTimer from '@/components/partner/JobTimer';
import Checklist from '@/components/partner/Checklist';
import SosButton from '@/components/partner/SosButton';
import AddItemDialog from '@/components/partner/AddItemDialog';
import PaymentPanel from '@/components/partner/PaymentPanel';
import { getCompletionGate, useNow } from './completionRule';
import './activeJob.css';

type LoadState = 'loading' | 'ready' | 'notfound' | 'error';

function formatBookedDuration(minutes: number | null | undefined): string {
  if (!minutes || minutes <= 0) return '3 hrs';
  if (minutes % 60 === 0) {
    const hrs = minutes / 60;
    return `${hrs} ${hrs === 1 ? 'hr' : 'hrs'}`;
  }
  return `${minutes} mins`;
}

function formatMinutes(totalMinutes: number): string {
  const m = Math.max(0, totalMinutes);
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r} min`;
  return r === 0 ? `${h} hr` : `${h} hr ${r} min`;
}

function formatStartedTime(
  startedAt: string | null | undefined,
  startedTimeLabel?: string,
): string {
  if (startedTimeLabel) return startedTimeLabel;
  if (!startedAt) return '10:02 AM';
  const d = new Date(startedAt);
  if (Number.isNaN(d.getTime())) return '10:02 AM';
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export const ActiveJobPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const effectiveId = id || 'BK-20418';

  const [job, setJob] = useState<JobDetails | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [online, setOnline] = useState<boolean>(navigator.onLine);

  // Re-renders the page every 15s so "remaining time" and the progress bar stay fresh.
  // (The big HH:MM:SS clock is driven by <JobTimer /> itself.)
  const [tick, setTick] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setTick(Date.now()), 15000);
    return () => window.clearInterval(id);
  }, []);

  // Complete Job action state
  const [completing, setCompleting] = useState<boolean>(false);
  const [completeError, setCompleteError] = useState<string | null>(null);
  const [showCompleteConfirm, setShowCompleteConfirm] = useState<boolean>(false);

  // Add Item dialog state
  const [addItemOpen, setAddItemOpen] = useState<boolean>(false);

  // Start flow (if navigated here while status is 'arrived'): one call, POST /partner/jobs/:id/verify-start
  const nowMs = useNow(5000); // re-checks the completion rule so the button unlocks by itself
  const [otpInput, setOtpInput] = useState<string>('');
  const [starting, setStarting] = useState<boolean>(false);
  const [startError, setStartError] = useState<string | null>(null);

  // Online / offline detector
  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Fetch job from local mock store / API module
  const load = useCallback(async () => {
    setLoadState('loading');
    setErrorMsg('');
    try {
      const data = await fetchJob(effectiveId);
      setJob(data);
      setLoadState('ready');
    } catch (err) {
      const status = getHttpStatus(err);
      if (status === 404 || status === 403) {
        setLoadState('notfound');
      } else {
        setErrorMsg(getErrorMessage(err, 'Failed to load active job details.'));
        setLoadState('error');
      }
    }
  }, [effectiveId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Handle Complete Job
  const handleComplete = async () => {
    if (!job || completing) return;
    if (!online) {
      setCompleteError('You are offline. Reconnect before completing the job.');
      return;
    }

    setCompleting(true);
    setCompleteError(null);

    try {
      const updated = await completeJob(job.id);
      setJob(updated);
      setShowCompleteConfirm(false);
      // Stay here: the finished screen below shows the payment QR for the customer.
    } catch (err) {
      setCompleteError(getErrorMessage(err, 'Could not complete the job. Try again.'));
    } finally {
      setCompleting(false);
    }
  };

  // Start Job: the server checks the customer's code and starts the job in the same call.
  const handleStartJob = async () => {
    const code = otpInput.trim();
    if (!job || starting) return;
    if (!/^\d{4,6}$/.test(code)) {
      setStartError('Enter the 4-digit code from the customer.');
      return;
    }
    setStarting(true);
    setStartError(null);
    try {
      const updated = await verifyStart(job.id, code);
      setJob(updated);
    } catch (err) {
      setStartError(getErrorMessage(err, 'Could not start job. Please try again.'));
    } finally {
      setStarting(false);
    }
  };

  if (loadState === 'loading') {
    return (
      <div className="aj-ref-page" aria-busy="true">
        <div className="aj-ref-container aj-single">
          <div className="aj-skel" style={{ height: 40, width: '60%' }} />
          <div className="aj-skel" style={{ height: 140 }} />
          <div className="aj-skel" style={{ height: 80 }} />
          <div className="aj-skel" style={{ height: 220 }} />
        </div>
      </div>
    );
  }

  if (loadState === 'notfound') {
    return (
      <div className="aj-ref-page">
        <div className="aj-ref-container aj-single">
          <div className="aj-error-box">
            <AlertCircle className="mx-auto h-12 w-12 text-slate-400 mb-2" aria-hidden="true" />
            <h1 className="text-xl font-bold text-slate-800">Job Not Found</h1>
            <p className="mt-1 text-sm text-slate-600">
              This job could not be found, or it is not assigned to your partner account.
            </p>
            <Link
              to="/partner/jobs"
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#4338ca] px-4 py-2 text-sm font-semibold text-white hover:bg-[#3730a3]"
            >
              <ArrowLeft className="h-4 w-4" /> Back to My Jobs
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (loadState === 'error' || !job) {
    return (
      <div className="aj-ref-page">
        <div className="aj-ref-container aj-single">
          <div className="aj-error-box">
            <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-2" aria-hidden="true" />
            <h1 className="text-xl font-bold text-slate-800">Error Loading Job</h1>
            <p className="mt-1 text-sm text-red-600" role="alert">
              {errorMsg || 'Could not load active job.'}
            </p>
            <button
              type="button"
              onClick={() => void load()}
              className="mt-4 inline-flex items-center rounded-xl bg-[#4338ca] px-4 py-2 text-sm font-semibold text-white hover:bg-[#3730a3]"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Handle arrived status with OTP entry
  if (job.status === 'arrived') {
    return (
      <div className="aj-ref-page">
        {!online && (
          <div className="aj-offline" role="status">
            You are offline. Actions will fail until your internet connection is restored.
          </div>
        )}

        <div className="aj-ref-container aj-single">
          <header className="aj-ref-header">
            <div>
              <p className="aj-ref-eyebrow">ARRIVED AT LOCATION</p>
              <h1 className="aj-ref-title">{job.service.name}</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Booking {job.bookingCode} · Start Verification Required
              </p>
            </div>
            <span className="aj-badge">Arrived at location</span>
          </header>

          <div className="aj-ref-card">
            <h2 className="text-lg font-bold text-slate-900 mb-2">Customer OTP Verification</h2>
            <p className="text-sm text-slate-600 mb-4">
              Ask customer {job.customer.name} ({job.customer.phoneMasked}) for the start OTP.
            </p>

            <div className="space-y-4">
              <div>
                <label htmlFor="otp-input-box" className="block text-xs font-semibold text-slate-700 mb-1">
                  Enter Customer OTP
                </label>
                <input
                  id="otp-input-box"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={otpInput}
                  onChange={(e) => {
                    setOtpInput(e.target.value);
                    setStartError(null);
                  }}
                  placeholder="Enter code"
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-base tracking-widest font-mono text-center font-bold focus:border-[#4338ca] focus:ring-1 focus:ring-[#4338ca]"
                />
                <p className="mt-1 text-xs text-slate-500">The code is checked when you tap Start Job.</p>
              </div>

              {startError && (
                <p className="text-xs font-semibold text-red-600" role="alert">
                  {startError}
                </p>
              )}

              <div className="pt-2 flex gap-3">
                <Link
                  to={`/partner/jobs/${job.id}`}
                  className="flex-1 text-center rounded-xl border border-slate-300 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Job Details
                </Link>
                <button
                  type="button"
                  onClick={() => void handleStartJob()}
                  disabled={!/^\d{4,6}$/.test(otpInput.trim()) || starting || !online}
                  aria-busy={starting}
                  className="flex-1 rounded-xl bg-[#4338ca] py-2.5 text-sm font-bold text-white hover:bg-[#3730a3] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {starting ? 'Starting…' : 'Start Job'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Handle completed or cancelled statuses
  const isFinishedOrCancelled =
    job.status === 'completed' ||
    job.status === 'rated' ||
    job.status.startsWith('cancelled') ||
    job.status === 'no_show' ||
    job.status === 'disputed';

  if (isFinishedOrCancelled) {
    const isDone = job.status === 'completed' || job.status === 'rated';
    return (
      <div className="aj-ref-page">
        {!online && (
          <div className="aj-offline" role="status">
            You are offline. Payment updates will appear once you reconnect.
          </div>
        )}
        <div className="aj-ref-container aj-single aj-pay">
          <header className="aj-ref-header">
            <div>
              <p className="aj-ref-eyebrow">BOOKING {job.bookingCode}</p>
              <h1 className="aj-ref-title">{job.service.name}</h1>
            </div>
            <span className={`aj-badge aj-badge-${job.status}`}>{STATUS_LABEL[job.status]}</span>
          </header>

          {isDone && <PaymentPanel job={job} onJobChange={setJob} online={online} />}

          {isDone && job.payment.phase !== 'paid' && job.payment.phase !== 'refunded' ? null : isDone ? (
            <Link
              to="/partner"
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#4338ca] px-5 py-3 text-sm font-semibold text-white hover:bg-[#3730a3]"
            >
              <Home className="h-4 w-4" /> Back to Home
            </Link>
          ) : (
            <div className="aj-ref-card text-center py-8">
              <h2 className="text-lg font-bold text-slate-900">Job Not In Progress</h2>
              <p className="mt-2 text-sm text-slate-600">
                Current status: <span className="font-semibold">{STATUS_LABEL[job.status]}</span>.
              </p>
              <div className="mt-6 flex items-center justify-center gap-3">
                <Link
                  to="/partner"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#4338ca] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#3730a3]"
                >
                  <Home className="h-4 w-4" /> Back to Home
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  const doneCount = job.checklist.filter((c) => c.done).length;
  const totalCount = job.checklist.length;
  const remainingItems = job.checklist.filter((c) => !c.done);
  const allDone = totalCount > 0 && doneCount === totalCount;
  const checklistPct = totalCount === 0 ? 0 : Math.round((doneCount / totalCount) * 100);
  const gate = getCompletionGate(job, nowMs);

  // Elapsed vs booked time
  const bookedSeconds = (job.service.durationMinutes ?? 180) * 60;
  const startedMs = job.schedule.startedAt ? new Date(job.schedule.startedAt).getTime() : NaN;
  const elapsedSec = Number.isNaN(startedMs)
    ? 84 * 60 + 36
    : Math.max(0, Math.floor((tick - startedMs) / 1000));
  const overtime = elapsedSec > bookedSeconds;
  const timerProgressPct = Math.min(100, Math.max(4, Math.round((elapsedSec / bookedSeconds) * 100)));
  const remainingLabel = overtime
    ? `+${formatMinutes(Math.ceil((elapsedSec - bookedSeconds) / 60))} over`
    : formatMinutes(Math.ceil((bookedSeconds - elapsedSec) / 60));

  const mapsHref = job.location.coordinates
    ? `https://www.google.com/maps/search/?api=1&query=${job.location.coordinates.lat},${job.location.coordinates.lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        [job.location.address, job.location.city, job.location.pincode].filter(Boolean).join(', '),
      )}`;

  const customerInitial = job.customer.name.trim().charAt(0).toUpperCase() || '?';

  // IN_PROGRESS: website-style execution console
  return (
    <div className="aj-ref-page aj-ws-page">
      {!online && (
        <div className="aj-offline" role="status">
          You are offline. Checklist changes and job actions will not save until reconnected.
        </div>
      )}

      <div className="aj-ws">
        {/* ───────── Page header ───────── */}
        <header className="aj-ws-top">
          <nav className="aj-ws-crumbs" aria-label="Breadcrumb">
            <Link to="/partner/jobs">My Jobs</Link>
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            <span aria-current="page">Active job</span>
          </nav>

          <div className="aj-ws-titlebar">
            <div className="aj-ws-titleblock">
              <div className="aj-ws-chips">
                <span className="aj-ws-status">
                  <span className="aj-ws-pulse" aria-hidden="true" />
                  In progress
                </span>
                <span className="aj-ws-code">Booking {job.bookingCode}</span>
              </div>
              <h1 className="aj-ws-title">{job.service.name}</h1>
              <p className="aj-ws-sub">
                <MapPin className="h-4 w-4" aria-hidden="true" />
                {job.location.city}
                {job.schedule.slot ? <> · Slot {job.schedule.slot}</> : null}
              </p>
            </div>
            <SosButton bookingId={job.id} coordinates={null} />
          </div>
        </header>

        {/* ───────── Main column ───────── */}
        <div className="aj-ws-main">
          {/* Hero timer */}
          <section
            className={`aj-ws-hero${overtime ? ' is-overtime' : ''}`}
            aria-label="Time on job"
          >
            <div className="aj-ws-hero-top">
              <div>
                <p className="aj-ws-hero-label">
                  <Clock className="h-3.5 w-3.5" aria-hidden="true" /> Time on job
                </p>
                <div className="aj-ws-hero-clock">
                  <JobTimer
                    startedAt={job.schedule.startedAt}
                    isCompleted={false}
                    className="aj-ref-timer-component"
                  />
                </div>
                <p className="aj-ws-hero-note">
                  Started {formatStartedTime(job.schedule.startedAt, job.schedule.startedTimeLabel)} · Booked{' '}
                  {formatBookedDuration(job.service.durationMinutes)}
                </p>
              </div>

              <dl className="aj-ws-stats">
                <div className="aj-ws-stat">
                  <dt>
                    <Hourglass className="h-3.5 w-3.5" aria-hidden="true" />
                    {overtime ? 'Overtime' : 'Time left'}
                  </dt>
                  <dd>{remainingLabel}</dd>
                </div>
                <div className="aj-ws-stat">
                  <dt>
                    <ListChecks className="h-3.5 w-3.5" aria-hidden="true" />
                    Tasks done
                  </dt>
                  <dd>{checklistPct}%</dd>
                </div>
                <div className="aj-ws-stat">
                  <dt>
                    <Wallet className="h-3.5 w-3.5" aria-hidden="true" />
                    Your earning
                  </dt>
                  <dd>₹{job.price.partnerEarning.toLocaleString('en-IN')}</dd>
                </div>
              </dl>
            </div>

            <div
              className="aj-ws-hero-track"
              role="progressbar"
              aria-label="Booked time used"
              aria-valuenow={timerProgressPct}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className="aj-ws-hero-fill" style={{ width: `${timerProgressPct}%` }} />
            </div>
          </section>

          {/* Checklist */}
          <section className="aj-ws-card aj-ws-checklist" aria-labelledby="checklist-title">
            <div className="aj-ws-card-head">
              <div>
                <h2 id="checklist-title" className="aj-ws-card-title">
                  <ListChecks className="h-4 w-4" aria-hidden="true" /> Service checklist
                </h2>
                <p className="aj-ws-card-hint">Tick each task as you finish it. Changes save automatically.</p>
              </div>
              <span className={`aj-ws-count${allDone ? ' is-done' : ''}`}>
                {doneCount} of {totalCount} done
              </span>
            </div>

            <div
              className="aj-ws-bar"
              role="progressbar"
              aria-label="Checklist progress"
              aria-valuenow={checklistPct}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className="aj-ws-bar-fill" style={{ width: `${checklistPct}%` }} />
            </div>

            <Checklist
              jobId={job.id}
              items={job.checklist}
              onItemsUpdated={(updated) => {
                setJob((prev) => (prev ? { ...prev, checklist: updated } : prev));
              }}
            />

            <button
              type="button"
              onClick={() => setAddItemOpen(true)}
              disabled={!online}
              className="aj-ref-add-item-btn aj-ws-add"
            >
              <Plus className="h-4 w-4" aria-hidden="true" /> Add item
            </button>
          </section>
        </div>

        {/* ───────── Side rail ───────── */}
        <aside className="aj-ws-aside" aria-label="Job summary and actions">
          {/* Actions */}
          <section className="aj-ws-card aj-ws-actions">
            <p className="aj-ws-card-title">Finish this job</p>
            <p className="aj-ws-card-hint">
              {allDone
                ? 'All tasks are done. You can complete the job now.'
                : `${remainingItems.length} checklist ${remainingItems.length === 1 ? 'item is' : 'items are'} still open.`}
            </p>

            {completeError && (
              <p className="aj-ws-error" role="alert">
                {completeError}
              </p>
            )}

        {/* Bottom Primary Button: Complete job */}
        <div className="aj-ref-cta-wrap">
          <button
            type="button"
            onClick={() => {
              setCompleteError(null);
              setShowCompleteConfirm(true);
            }}
            disabled={completing || !online || !gate.canComplete}
            className="aj-ref-complete-btn disabled:cursor-not-allowed disabled:opacity-50"
          >
            Complete job
          </button>
          {!gate.canComplete && (
            <p className="mt-2 px-1 text-center text-xs font-semibold text-amber-700" role="status">
              {gate.message}
            </p>
          )}
        </div>

            <Link to={`/partner/jobs/${job.id}`} className="aj-ws-secondary">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" /> View job details
            </Link>
          </section>

          {/* Customer */}
          <section className="aj-ws-card" aria-label="Customer">
            <p className="aj-ws-card-title">
              <User className="h-4 w-4" aria-hidden="true" /> Customer (masked)
            </p>
            <div className="aj-ws-customer">
              <span className="aj-ws-avatar" aria-hidden="true">
                {customerInitial}
              </span>
              <div className="aj-ws-customer-text">
                <p className="aj-ws-customer-name">{job.customer.name}</p>
                <p className="aj-ws-customer-phone">{job.customer.phoneMasked}</p>
              </div>
            </div>
          </section>

          {/* Location */}
          <section className="aj-ws-card" aria-label="Job location">
            <p className="aj-ws-card-title">
              <MapPin className="h-4 w-4" aria-hidden="true" /> Location
            </p>
            <p className="aj-ws-address">
              {job.location.address}
              <br />
              {job.location.city}
              {job.location.pincode ? ` – ${job.location.pincode}` : ''}
            </p>
            <a className="aj-ws-secondary" href={mapsHref} target="_blank" rel="noreferrer">
              <Navigation className="h-4 w-4" aria-hidden="true" /> Open in Maps
            </a>
          </section>

          {/* Instructions */}
          {job.instructions && (
            <section className="aj-ws-card aj-ws-note" aria-label="Customer instructions">
              <p className="aj-ws-card-title">
                <StickyNote className="h-4 w-4" aria-hidden="true" /> Customer note
              </p>
              <p className="aj-ws-note-text">{job.instructions}</p>
            </section>
          )}

          {/* Add-ons */}
          {job.addOns.length > 0 && (
            <section className="aj-ws-card" aria-label="Add-ons">
              <p className="aj-ws-card-title">
                <Package className="h-4 w-4" aria-hidden="true" /> Add-ons
              </p>
              <ul className="aj-ws-addons">
                {job.addOns.map((a) => (
                  <li key={a.id}>
                    <span>
                      {a.name}
                      {a.quantity > 1 ? ` × ${a.quantity}` : ''}
                    </span>
                    <span>₹{a.amount.toLocaleString('en-IN')}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>

      {/* Confirmation Modal for Complete Job */}
      {showCompleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="complete-confirm-title"
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#eeecfb] text-[#4338ca]">
              <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
            </div>
            <h2 id="complete-confirm-title" className="text-lg font-bold text-slate-900">
              Confirm Service Completion?
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Are you sure all tasks have been performed? This will complete the job.
            </p>

            {remainingItems.length > 0 && (
              <p className="mt-2 rounded-lg bg-[#fff3ea] p-2.5 text-xs font-medium text-[#e0600f]">
                Note: {remainingItems.length} checklist {remainingItems.length === 1 ? 'item is' : 'items are'} still unchecked.
              </p>
            )}

            {completeError && (
              <p className="mt-2 text-xs font-semibold text-red-600" role="alert">
                {completeError}
              </p>
            )}

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setShowCompleteConfirm(false)}
                disabled={completing}
                className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Go Back
              </button>
              <button
                type="button"
                onClick={() => void handleComplete()}
                disabled={completing || !online}
                aria-busy={completing}
                className="flex-1 rounded-xl bg-[#4338ca] py-2.5 text-sm font-semibold text-white hover:bg-[#3730a3] disabled:opacity-50"
              >
                {completing ? 'Completing…' : 'Yes, Complete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Item Dialog */}
      <AddItemDialog
        bookingId={job.id}
        isOpen={addItemOpen}
        onClose={() => setAddItemOpen(false)}
        onItemAdded={(item) => {
          const customId = `custom-${Date.now()}`;
          setJob((prev) =>
            prev
              ? {
                  ...prev,
                  addOns: [
                    ...prev.addOns,
                    {
                      id: customId,
                      name: item.title,
                      quantity: 1,
                      amount: item.amount,
                    },
                  ],
                  checklist: [
                    ...prev.checklist,
                    {
                      id: `chk-${customId}`,
                      label: `${item.title} (add-on)`,
                      done: false,
                    },
                  ],
                }
              : prev,
          );
        }}
      />
    </div>
  );
};

export default ActiveJobPage;
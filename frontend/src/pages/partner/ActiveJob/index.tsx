import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarClock, CheckCircle2, AlertCircle, Info, MapPin, Plus, RotateCw, User } from 'lucide-react';
import {
  fetchJob,
  fetchExtraCharges,
  fetchAssignedServices,
  IS_MOCK_JOBS,
  resetMockPartnerJob,
  getErrorMessage,
  getHttpStatus,
} from '@/pages/partner/JobDetails/jobDetails.api';
import type { ExtraChargeItem, JobDetails, StartVerification } from '@/pages/partner/JobDetails/jobDetails.types';
import { STATUS_LABEL } from '@/pages/partner/JobDetails/jobStatus';
import JobTimer from '@/components/partner/JobTimer';
import Checklist from '@/components/partner/Checklist';
import SosButton from '@/components/partner/SosButton';
import AddItemDialog from '@/components/partner/AddItemDialog';
import ExtraChargeForm from '@/components/partner/ExtraChargeForm';
import CompletionChecklist from '@/components/partner/CompletionChecklist';
import StartVerificationForm from './StartVerificationForm';
import '@/styles/partnerJobs.css';
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

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

function formatElapsedLabel(startedAt: string | null | undefined, completedAt: string | null | undefined): string | null {
  if (!startedAt || !completedAt) return null;
  const ms = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const mins = Math.round(ms / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h} hr${m ? ` ${m} min` : ''}` : `${m} min`;
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
  const [resolvedId, setResolvedId] = useState<string | null>(id ?? null);
  const effectiveId = resolvedId || id || (IS_MOCK_JOBS ? 'BK-20418' : '');
  const navigate = useNavigate();

  const [job, setJob] = useState<JobDetails | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [online, setOnline] = useState<boolean>(navigator.onLine);

  const [completeError, setCompleteError] = useState<string | null>(null);
  const [showCompletionModal, setShowCompletionModal] = useState<boolean>(false);

  // Extra Charges state
  const [extraCharges, setExtraCharges] = useState<ExtraChargeItem[]>([]);
  const [extraChargesLoading, setExtraChargesLoading] = useState<boolean>(false);
  const [extraChargesError, setExtraChargesError] = useState<string | null>(null);
  const [showExtraChargeModal, setShowExtraChargeModal] = useState<boolean>(false);

  // Add Item dialog state
  const [addItemOpen, setAddItemOpen] = useState<boolean>(false);

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

  const loadExtraCharges = useCallback(async (jobIdToLoad?: string) => {
    const target = jobIdToLoad || effectiveId;
    if (!target) return;
    setExtraChargesLoading(true);
    setExtraChargesError(null);
    try {
      const items = await fetchExtraCharges(target);
      setExtraCharges(items);
    } catch (err) {
      setExtraChargesError(getErrorMessage(err, 'Failed to load extra charges.'));
    } finally {
      setExtraChargesLoading(false);
    }
  }, [effectiveId]);

  // Fetch job from local mock store / API module
  const load = useCallback(async () => {
    setLoadState('loading');
    setErrorMsg('');
    try {
      let targetId = id;
      if (!targetId) {
        if (!IS_MOCK_JOBS) {
          const list = await fetchAssignedServices();
          const active =
            list.find((j) => ['in_progress', 'arrived'].includes(j.status)) ||
            list.find((j) => ['en_route', 'assigned'].includes(j.status)) ||
            list[0];
          if (active) {
            targetId = active.id;
          }
        } else {
          targetId = 'BK-20418';
        }
      }

      if (!targetId) {
        setLoadState('notfound');
        return;
      }

      setResolvedId(targetId);
      const data = await fetchJob(targetId);
      setJob(data);
      setLoadState('ready');
      void loadExtraCharges(targetId);
    } catch (err) {
      const status = getHttpStatus(err);
      if (status === 404 || status === 403) {
        setLoadState('notfound');
      } else {
        setErrorMsg(getErrorMessage(err, 'Failed to load active job details.'));
        setLoadState('error');
      }
    }
  }, [id, loadExtraCharges]);

  useEffect(() => {
    void load();
  }, [load]);

  // Handle job completion from modal
  const handleJobCompleted = (updated: JobDetails) => {
    setJob(updated);
    setShowCompletionModal(false);
    navigate(`/partner/jobs/${updated.id}`);
  };

  const handleExtraChargeCreated = (charge: ExtraChargeItem) => {
    setExtraCharges((prev) => [...prev, charge]);
  };

  // Start verification: keep the OTP state the server reported (attempts left, locked, expired).
  const patchVerification = useCallback((patch: Partial<StartVerification>) => {
    setJob((current) =>
      current && current.startVerification ? { ...current, startVerification: { ...current.startVerification, ...patch } }
        : current,
    );
  }, []);

  /** Reload without the skeleton, so an inline message on the page is not wiped. */
  const refreshQuietly = useCallback(async () => {
    try {
      setJob(await fetchJob(effectiveId));
    } catch {
      /* keep what is on screen; the partner can reload */
    }
  }, [effectiveId]);

  const handleResetDemo = () => {
    const fresh = resetMockPartnerJob(effectiveId);
    setJob(fresh);
    setCompleteError(null);
    setShowCompletionModal(false);
  };

  if (loadState === 'loading') {
    return (
      <div className="aj-ref-page" aria-busy="true">
        <div className="aj-ref-container">
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
        <div className="aj-ref-container">
          <div className="aj-error-box">
            <AlertCircle className="mx-auto h-12 w-12 text-slate-400 mb-2" aria-hidden="true" />
            <h1 className="text-xl font-bold text-slate-800">
              {!id ? 'No Active Job' : 'Job Not Found'}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              {!id
                ? 'You do not currently have any job in progress or awaiting verification.'
                : 'This job could not be found, or it is not assigned to your partner account.'}
            </p>
            <Link
              to={!id ? '/partner/work/requests' : '/partner/jobs'}
              className="aj-btn-primary" style={{ marginTop: 16 }}
            >
              <ArrowLeft className="h-4 w-4" /> {!id ? 'View Job Requests' : 'Back to My Jobs'}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (loadState === 'error' || !job) {
    return (
      <div className="aj-ref-page">
        <div className="aj-ref-container">
          <div className="aj-error-box">
            <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-2" aria-hidden="true" />
            <h1 className="text-xl font-bold text-slate-800">Error Loading Job</h1>
            <p className="mt-1 text-sm text-red-600" role="alert">
              {errorMsg || 'Could not load active job.'}
            </p>
            <button
              type="button"
              onClick={() => void load()}
              className="aj-btn-primary" style={{ marginTop: 16 }}
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Arrived: the job can only start with the customer's code AND a start photo.
  if (job.status === 'arrived') {
    const address = [job.location.address, job.location.city].filter(Boolean).join(', ');
    return (
      <div className="aj-ref-page">
        <div className="aj-ref-container">
          <div className="sv-wrap">
            <header className="aj-ref-header" style={{ marginBottom: 14 }}>
              <div>
                <p className="aj-ref-eyebrow">Booking {job.bookingCode}</p>
                <h1 className="aj-ref-title">Start the job</h1>
                <p className="aj-ref-sub">Confirm the customer's code and take a photo before you begin.</p>
              </div>
              <span className="aj-badge">Arrived</span>
            </header>

            <ol className="sv-progress" aria-label="Job progress">
              <li className="is-done">Arrived</li>
              <li className="is-current" aria-current="step">
                Verify customer
              </li>
              <li>Start work</li>
            </ol>

            <div className="sv-layout">
              <aside className="sv-summary" aria-label="Visit summary">
                <div>
                  <p className="sv-summary-title">You are here for</p>
                  <p className="sv-summary-service">{job.service.name}</p>
                </div>
                <ul className="sv-summary-list">
                  <li>
                    <User aria-hidden="true" />
                    <span>
                      {job.customer.name}
                      <small>{job.customer.phoneMasked}</small>
                    </span>
                  </li>
                  {address && (
                    <li>
                      <MapPin aria-hidden="true" />
                      <span>
                        {address}
                        {job.location.hint && <small>{job.location.hint}</small>}
                      </span>
                    </li>
                  )}
                  <li>
                    <CalendarClock aria-hidden="true" />
                    <span>
                      {job.schedule.dateLabel ?? 'Today'}
                      {job.schedule.slot && <small>{job.schedule.slot}</small>}
                    </span>
                  </li>
                </ul>
              </aside>

              <div>
                <StartVerificationForm
                  job={job}
                  onStarted={setJob}
                  onVerificationChange={patchVerification}
                  onStale={() => void refreshQuietly()}
                />

                <p className="sv-back">
                  <Link to={`/partner/jobs/${job.id}`}>
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Job details
                  </Link>
                </p>
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
    const timeOnJob =
      formatElapsedLabel(job.schedule.startedAt, job.schedule.completedAt) ??
      formatBookedDuration(job.service.durationMinutes);
    return (
      <div className="aj-ref-page">
        <div className="aj-ref-container">
          <div className="aj-wide">
            <header className="aj-ref-header" style={{ marginBottom: 14 }}>
              <div>
                <p className="aj-ref-eyebrow">Booking {job.bookingCode}</p>
                <h1 className="aj-ref-title">{job.service.name}</h1>
              </div>
              <span className={`aj-badge aj-badge-${job.status}`}>{STATUS_LABEL[job.status]}</span>
            </header>

            <section className="aj-done" aria-labelledby="aj-done-title">
              <div className={`aj-done-top${isDone ? '' : ' aj-done-top-muted'}`}>
                <div className={`aj-done-badge${isDone ? '' : ' aj-done-badge-muted'}`}>
                  {isDone ? (
                    <CheckCircle2 className="h-8 w-8" aria-hidden="true" />
                  ) : (
                    <Info className="h-8 w-8" aria-hidden="true" />
                  )}
                </div>
                <h2 id="aj-done-title" className="aj-done-title">
                  {isDone ? 'Job completed' : 'Job Not In Progress'}
                </h2>
                <p className="aj-done-text">
                  Current status: <strong>{STATUS_LABEL[job.status]}</strong>.{' '}
                  {isDone
                    ? 'Nice work. The checklist is locked and your payout is on its way to your wallet.'
                    : 'There is nothing left to do on this screen.'}
                </p>
              </div>

              <div className="aj-done-tear" aria-hidden="true" />

              <dl className="aj-done-stats">
                <div className="aj-done-stat">
                  <dt>Customer</dt>
                  <dd>{job.customer.name}</dd>
                </div>
                {isDone ? (
                  <>
                    <div className="aj-done-stat">
                      <dt>Time on job</dt>
                      <dd>{timeOnJob}</dd>
                    </div>
                    <div className="aj-done-stat aj-done-stat-pay">
                      <dt>Your payout</dt>
                      <dd>{inr.format(job.price.partnerEarning)}</dd>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="aj-done-stat">
                      <dt>Scheduled</dt>
                      <dd>{job.schedule.dateLabel ?? job.schedule.slot ?? '—'}</dd>
                    </div>
                    <div className="aj-done-stat">
                      <dt>Booking</dt>
                      <dd>{job.bookingCode}</dd>
                    </div>
                  </>
                )}
              </dl>

              <div className="aj-done-actions">
                <Link to={`/partner/jobs/${job.id}`} className="aj-btn-primary">
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" /> View Job Details
                </Link>
                <Link to="/partner/assigned" className="aj-btn-ghost">
                  Assigned services
                </Link>
                {IS_MOCK_JOBS && (
                  <button type="button" onClick={handleResetDemo} className="aj-btn-ghost">
                    Reset demo
                  </button>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    );
  }

  // Only a started job gets the live screen. Before that, the only way in is the code + photo step above.
  if (job.status !== 'in_progress') {
    return (
      <div className="aj-ref-page">
        <div className="aj-ref-container">
          <div className="aj-wide">
            <header className="aj-ref-header" style={{ marginBottom: 14 }}>
              <div>
                <p className="aj-ref-eyebrow">Booking {job.bookingCode}</p>
                <h1 className="aj-ref-title">{job.service.name}</h1>
              </div>
              <span className={`aj-badge aj-badge-${job.status}`}>{STATUS_LABEL[job.status]}</span>
            </header>

            <section className="aj-done" aria-labelledby="aj-not-started-title">
              <div className="aj-done-top aj-done-top-muted">
                <div className="aj-done-badge aj-done-badge-muted">
                  <Info className="h-8 w-8" aria-hidden="true" />
                </div>
                <h2 id="aj-not-started-title" className="aj-done-title">
                  Job not started yet
                </h2>
                <p className="aj-done-text">
                  Current status: <strong>{STATUS_LABEL[job.status]}</strong>. Mark yourself as arrived first.
                  Starting needs the customer&apos;s code and a start photo at the location.
                </p>
              </div>
              <div className="aj-done-actions">
                <Link to={`/partner/jobs/${job.id}`} className="aj-btn-primary">
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" /> View Job Details
                </Link>
              </div>
            </section>
          </div>
        </div>
      </div>
    );
  }

  const doneCount = job.checklist.filter((c) => c.done).length;
  const totalCount = job.checklist.length;

  // Compute progress bar percentage from elapsed time vs booked duration
  const bookedSeconds = (job.service.durationMinutes ?? 180) * 60;
  const startedMs = job.schedule.startedAt ? new Date(job.schedule.startedAt).getTime() : NaN;
  const elapsedSec = Number.isNaN(startedMs)
    ? 84 * 60 + 36
    : Math.max(0, Math.floor((Date.now() - startedMs) / 1000));
  const timerProgressPct = Math.min(100, Math.max(8, Math.round((elapsedSec / bookedSeconds) * 100)));

  // IN_PROGRESS: The Active Service Execution Screen matching the Reference Image
  return (
    <div className="aj-ref-page">
      {!online && (
        <div className="aj-offline" role="status">
          You are offline. Checklist changes and job actions will not save until reconnected.
        </div>
      )}

      <div className="aj-ref-container">
        {/* Top Header: IN PROGRESS / Deep home cleaning | SOS */}
        <header className="aj-ref-header">
          <div>
            <p className="aj-ref-eyebrow">
              <span className="aj-live-dot" aria-hidden="true" />
              In progress <span className="sr-only">Booking {job.bookingCode}</span>
            </p>
            <h1 className="aj-ref-title">{job.service.name}</h1>
          </div>
          <SosButton bookingId={job.id} coordinates={null} />
        </header>

        {/* Dark Teal Hero Timer Card: TIME ON JOB */}
        <section className="aj-ref-timer-hero" aria-label="Time on job">
          <p className="aj-ref-timer-eyebrow">Time on job</p>
          <div className="aj-ref-timer-value">
            <JobTimer
              startedAt={job.schedule.startedAt}
              isCompleted={false}
              className="aj-ref-timer-component"
            />
          </div>
          <div className="aj-ref-progress-track" role="progressbar" aria-valuenow={timerProgressPct} aria-valuemin={0} aria-valuemax={100}>
            <div
              className="aj-ref-progress-fill"
              style={{ width: `${timerProgressPct}%` }}
            />
          </div>
          <div className="aj-ref-timer-meta">
            <span>
              Started {formatStartedTime(job.schedule.startedAt, job.schedule.startedTimeLabel)}
            </span>
            <span>Booked {formatBookedDuration(job.service.durationMinutes)}</span>
          </div>
        </section>

        {/* CUSTOMER (MASKED) Card */}
        <section className="aj-ref-card aj-card-customer" aria-label="Customer">
          <p className="aj-ref-card-label">Customer</p>
          <div className="aj-customer">
            <span className="aj-avatar" aria-hidden="true">
              {job.customer.name.trim().charAt(0).toUpperCase() || '?'}
            </span>
            <div className="aj-customer-body">
              <p className="aj-ref-customer-name">{job.customer.name}</p>
              <span className="aj-ref-customer-phone">{job.customer.phoneMasked}</span>
            </div>
            <span className="aj-masked-note">Number hidden</span>
          </div>
        </section>

        {/* CHECKLIST Card */}
        <section className="aj-ref-card aj-card-checklist" aria-labelledby="checklist-title">
          <div className="aj-ref-checklist-header">
            <h2 id="checklist-title" className="aj-ref-card-label">
              Checklist
            </h2>
            <span className="aj-ref-checklist-count">
              {doneCount} of {totalCount} done
            </span>
          </div>

          <div className="aj-check-meter" aria-hidden="true">
            <span style={{ width: `${totalCount ? Math.round((doneCount / totalCount) * 100) : 0}%` }} />
          </div>

          <Checklist
            jobId={job.id}
            items={job.checklist}
            onItemsUpdated={(updated) => {
              setJob((prev) => (prev ? { ...prev, checklist: updated } : prev));
            }}
          />
        </section>

        {/* EXTRA CHARGES Section */}
        <section className="aj-ref-card aj-card-extra-charges" aria-labelledby="extra-charges-title">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 id="extra-charges-title" className="aj-ref-card-label">
                Extra Charges
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Additional on-site work approved by the customer
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void loadExtraCharges()}
                title="Refresh extra charges"
                aria-label="Refresh extra charges"
                className="text-xs text-slate-500 hover:text-slate-800 p-1 rounded-md hover:bg-slate-100 transition-colors"
              >
                <RotateCw className={`h-3.5 w-3.5 ${extraChargesLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setShowExtraChargeModal(true)}
                disabled={!online}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#4338ca] bg-[#eef0ff] hover:bg-[#e0e3ff] px-2.5 py-1.5 rounded-lg transition-colors"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Request charge
              </button>
            </div>
          </div>

          {extraChargesError && (
            <div className="rounded-lg bg-red-50 p-2.5 text-xs text-red-700 mb-3" role="alert">
              {extraChargesError}
            </div>
          )}

          {extraCharges.length === 0 ? (
            <p className="text-xs text-slate-500 py-3 text-center border border-dashed border-slate-200 rounded-xl">
              No extra charges requested for this job.
            </p>
          ) : (
            <div className="space-y-2">
              {extraCharges.map((charge) => {
                const statusColor =
                  charge.status === 'approved'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : charge.status === 'rejected'
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200';
                return (
                  <div
                    key={charge.id}
                    className="flex items-start justify-between p-3 rounded-xl border border-slate-100 bg-slate-50 text-xs"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">{charge.title}</p>
                      <p className="text-slate-500">
                        Qty: {charge.quantity} × ₹{charge.amount} = <span className="font-semibold text-slate-700">₹{charge.quantity * charge.amount}</span>
                      </p>
                      {charge.reason && <p className="text-slate-400 text-[11px] mt-0.5">{charge.reason}</p>}
                    </div>
                    <span className={`px-2 py-0.5 rounded-full border text-[11px] font-semibold uppercase ${statusColor}`}>
                      {charge.status}
                    </span>
                  </div>
                );
              })}

              <div className="flex justify-between items-center pt-2 border-t border-slate-200 text-xs">
                <span className="font-medium text-slate-600">Approved extra total:</span>
                <span className="font-bold text-slate-900">
                  ₹{extraCharges
                    .filter((c) => c.status === 'approved')
                    .reduce((sum, c) => sum + c.quantity * c.amount, 0)
                    .toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          )}
        </section>

        {completeError && (
          <p className="aj-error-line" role="alert">
            {completeError}
          </p>
        )}

        {/* Bottom Primary Button: Complete job */}
        <div className="aj-ref-cta-wrap">
          <button
            type="button"
            onClick={() => {
              setCompleteError(null);
              setShowCompletionModal(true);
            }}
            disabled={!online}
            className="aj-ref-complete-btn"
          >
            Complete job
          </button>

          <div className="aj-ref-demo-footer">
            <Link to={`/partner/jobs/${job.id}`} className="aj-ref-demo-link">
              ← View Job Details
            </Link>
            {IS_MOCK_JOBS && (
              <button
                type="button"
                onClick={handleResetDemo}
                className="aj-ref-demo-link-btn"
              >
                Reset demo
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Completion Checklist & Verification Modal */}
      <CompletionChecklist
        job={job}
        extraCharges={extraCharges.length > 0 ? extraCharges : (job.extraCharges ?? [])}
        isOpen={showCompletionModal}
        onClose={() => setShowCompletionModal(false)}
        onCompleted={handleJobCompleted}
      />

      {/* Request Extra Charge Form Modal */}
      <ExtraChargeForm
        bookingId={job.id}
        isOpen={showExtraChargeModal}
        onClose={() => setShowExtraChargeModal(false)}
        onChargeCreated={handleExtraChargeCreated}
      />

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

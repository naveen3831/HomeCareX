import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, AlertCircle, Home } from 'lucide-react';
import {
  fetchJob,
  completeJob,
  startJob,
  verifyJobOtp,
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

  // Complete Job action state
  const [completing, setCompleting] = useState<boolean>(false);
  const [completeError, setCompleteError] = useState<string | null>(null);
  const [showCompleteConfirm, setShowCompleteConfirm] = useState<boolean>(false);

  // Add Item dialog state
  const [addItemOpen, setAddItemOpen] = useState<boolean>(false);

  // OTP start flow (if navigated here while status is 'arrived')
  const [otpInput, setOtpInput] = useState<string>('');
  const [otpVerified, setOtpVerified] = useState<boolean>(false);
  const [otpVerifying, setOtpVerifying] = useState<boolean>(false);
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

  // OTP Verification
  const handleVerifyOtp = async () => {
    if (!job || otpVerifying || !otpInput.trim()) return;
    setOtpVerifying(true);
    setStartError(null);
    try {
      const res = await verifyJobOtp(job.id, otpInput.trim());
      if (res.verified) {
        setOtpVerified(true);
      } else {
        setStartError(res.message || 'OTP verification failed. Check code with customer.');
      }
    } catch (err) {
      setStartError(getErrorMessage(err, 'OTP verification request failed.'));
    } finally {
      setOtpVerifying(false);
    }
  };

  // Start Job (only possible after OTP verified)
  const handleStartJob = async () => {
    if (!job || starting || !otpVerified) return;
    setStarting(true);
    setStartError(null);
    try {
      const updated = await startJob(job.id, otpInput.trim());
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

        <div className="aj-ref-container">
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
                <div className="flex gap-2">
                  <input
                    id="otp-input-box"
                    type="text"
                    maxLength={6}
                    value={otpInput}
                    onChange={(e) => {
                      setOtpInput(e.target.value);
                      setOtpVerified(false);
                    }}
                    placeholder="Enter code"
                    className="flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-base tracking-widest font-mono text-center font-bold focus:border-[#4338ca] focus:ring-1 focus:ring-[#4338ca]"
                  />
                  <button
                    type="button"
                    onClick={() => void handleVerifyOtp()}
                    disabled={otpVerifying || !otpInput.trim() || !online}
                    aria-busy={otpVerifying}
                    className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100 disabled:opacity-50"
                  >
                    {otpVerifying ? 'Verifying…' : 'Verify OTP'}
                  </button>
                </div>
              </div>

              {otpVerified && (
                <div className="flex items-center gap-2 rounded-lg bg-[#eeecfb] p-3 text-xs font-semibold text-[#4338ca]">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>OTP verified successfully! You may now begin the job.</span>
                </div>
              )}

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
                  disabled={!otpVerified || starting || !online}
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
        <div className="aj-ref-container">
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
              IN PROGRESS <span className="sr-only">Booking {job.bookingCode}</span>
            </p>
            <h1 className="aj-ref-title">{job.service.name}</h1>
          </div>
          <SosButton bookingId={job.id} coordinates={null} />
        </header>

        {/* Dark Teal Hero Timer Card: TIME ON JOB */}
        <section className="aj-ref-timer-hero" aria-label="Time on job">
          <p className="aj-ref-timer-eyebrow">TIME ON JOB</p>
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
          <p className="aj-ref-card-label">CUSTOMER (MASKED)</p>
          <div className="aj-ref-row-between">
            <p className="aj-ref-customer-name">{job.customer.name}</p>
            <span className="aj-ref-customer-phone">{job.customer.phoneMasked}</span>
          </div>
        </section>

        {/* CHECKLIST Card */}
        <section className="aj-ref-card aj-card-checklist" aria-labelledby="checklist-title">
          <div className="aj-ref-checklist-header">
            <h2 id="checklist-title" className="aj-ref-card-label mb-0">
              CHECKLIST
            </h2>
            <span className="aj-ref-checklist-count">
              {doneCount} of {totalCount} done
            </span>
          </div>

          <Checklist
            jobId={job.id}
            items={job.checklist}
            onItemsUpdated={(updated) => {
              setJob((prev) => (prev ? { ...prev, checklist: updated } : prev));
            }}
          />
        </section>

        {/* Dashed Button: + Add item */}
        <button
          type="button"
          onClick={() => setAddItemOpen(true)}
          disabled={!online}
          className="aj-ref-add-item-btn"
        >
          + Add item
        </button>

        {completeError && (
          <p className="text-xs font-semibold text-red-600 px-1" role="alert">
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
            disabled={completing || !online}
            className="aj-ref-complete-btn"
          >
            Complete job
          </button>

          <div className="aj-ref-demo-footer">
            <Link to={`/partner/jobs/${job.id}`} className="aj-ref-demo-link">
              ← View Job Details
            </Link>
          </div>
        </div>
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
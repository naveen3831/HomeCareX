import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  getErrorMessage,
  getHttpStatus,
  updateBookingStatus,
  verifyStart,
} from './jobDetails.api';
import type { JobDetails } from './jobDetails.types';
import { isCancelled, isFinished } from './jobStatus';

interface Props {
  job: Pick<JobDetails, 'id' | 'status' | 'actions' | 'otpRequired'>;
  onChanged: (job: JobDetails) => void;
  /** Called when the server says our view is out of date (422), so the page can reload quietly. */
  onStale: () => void;
}

/** The customer's start code is 4 to 6 digits. The server does the real check. */
const OTP_FORMAT = /^\d{4,6}$/;

export default function JobStatusActions({ job, onChanged, onStale }: Props) {
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Start flow: the code is checked and the job started by ONE call (POST /partner/jobs/:id/verify-start).
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [otp, setOtp] = useState('');
  const [startingJob, setStartingJob] = useState(false);

  const handleClick = async (next: (typeof job.actions)[number]['status']) => {
    if (pending) return; // blocks duplicate taps
    if (!navigator.onLine) {
      setError('You are offline. Reconnect and try again.');
      return;
    }
    setPending(true);
    setError(null);
    try {
      onChanged(await updateBookingStatus(job.id, next));
    } catch (err) {
      if (getHttpStatus(err) === 422) {
        setError('This job was already updated. Showing the latest status.');
        onStale();
      } else {
        setError(getErrorMessage(err, 'Could not update the status. Try again.'));
      }
    } finally {
      setPending(false);
    }
  };

  const handleStartJob = async () => {
    const code = otp.trim();
    if (startingJob) return;
    if (!OTP_FORMAT.test(code)) {
      setError('Enter the 4-digit code from the customer.');
      return;
    }
    if (!navigator.onLine) {
      setError('You are offline. Reconnect and try again.');
      return;
    }
    setStartingJob(true);
    setError(null);
    try {
      const updated = await verifyStart(job.id, code);
      onChanged(updated);
      navigate(`/partner/jobs/${job.id}/active`);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not start the job. Please try again.'));
    } finally {
      setStartingJob(false);
    }
  };

  return (
    <div className="jd-actions">
      {job.actions.map((action) => (
        <button
          key={action.status}
          type="button"
          className="jd-btn"
          onClick={() => void handleClick(action.status)}
          disabled={pending}
          aria-busy={pending}
        >
          {pending ? 'Updating…' : action.label}
        </button>
      ))}

      {job.otpRequired && !showOtpInput && (
        <button
          type="button"
          className="jd-btn jd-btn-primary"
          onClick={() => setShowOtpInput(true)}
        >
          Verify OTP & Start Job
        </button>
      )}

      {job.otpRequired && showOtpInput && (
        <div className="jd-otp-box mt-3 p-4 rounded-xl border border-line bg-slate-50 w-full max-w-md">
          <label htmlFor="jd-otp-field" className="block text-xs font-bold text-slate-700 mb-1">
            Customer Start OTP
          </label>
          <input
            id="jd-otp-field"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={otp}
            onChange={(e) => {
              setOtp(e.target.value);
              setError(null);
            }}
            placeholder="4-digit code"
            className="w-full rounded-lg border border-line px-3 py-2 text-sm font-mono tracking-widest text-center font-bold"
          />
          <p className="mt-1 text-[11px] text-slate-500">
            The code is checked when you tap Start Job.
          </p>

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => void handleStartJob()}
              disabled={!OTP_FORMAT.test(otp.trim()) || startingJob}
              aria-busy={startingJob}
              className="flex-1 rounded-lg bg-brand py-2 text-xs font-bold text-white hover:bg-brand-deep disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {startingJob ? 'Starting…' : 'Start Job'}
            </button>
            <Link
              to={`/partner/jobs/${job.id}/active`}
              className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 text-center"
            >
              Go to Active Screen
            </Link>
          </div>
        </div>
      )}

      {job.status === 'in_progress' && (
        <Link className="jd-btn jd-btn-link" to={`/partner/jobs/${job.id}/active`}>
          Open active job
        </Link>
      )}

      {isFinished(job.status) && <p className="jd-hint">This job is completed.</p>}
      {isCancelled(job.status) && <p className="jd-hint">This job was cancelled.</p>}

      {error && (
        <p className="jd-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

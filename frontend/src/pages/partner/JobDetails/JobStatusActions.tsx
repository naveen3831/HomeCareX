import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import {
  getErrorMessage,
  getHttpStatus,
  updateBookingStatus,
  verifyJobOtp,
  startJob,
} from './jobDetails.api';
import type { JobDetails } from './jobDetails.types';
import { isCancelled, isFinished } from './jobStatus';

interface Props {
  job: Pick<JobDetails, 'id' | 'status' | 'actions' | 'otpRequired'>;
  onChanged: (job: JobDetails) => void;
  /** Called when the server says our view is out of date (422), so the page can reload quietly. */
  onStale: () => void;
}

export default function JobStatusActions({ job, onChanged, onStale }: Props) {
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // OTP gated start flow
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpVerified, setOtpVerified] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
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

  const handleVerifyOtp = async () => {
    if (verifyingOtp || !otp.trim()) return;
    if (!navigator.onLine) {
      setError('You are offline. Reconnect and try again.');
      return;
    }
    setVerifyingOtp(true);
    setError(null);
    try {
      const res = await verifyJobOtp(job.id, otp.trim());
      if (res.verified) {
        setOtpVerified(true);
      } else {
        setError(res.message || 'OTP verification failed. Please check the code with the customer.');
      }
    } catch (err) {
      setError(getErrorMessage(err, 'OTP verification request failed.'));
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleStartJob = async () => {
    if (!otpVerified || startingJob) return;
    if (!navigator.onLine) {
      setError('You are offline. Reconnect and try again.');
      return;
    }
    setStartingJob(true);
    setError(null);
    try {
      const updated = await startJob(job.id, otp.trim());
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
          <div className="flex gap-2">
            <input
              id="jd-otp-field"
              type="text"
              maxLength={6}
              value={otp}
              onChange={(e) => {
                setOtp(e.target.value);
                setOtpVerified(false);
              }}
              placeholder="4-digit code"
              className="flex-1 rounded-lg border border-line px-3 py-2 text-sm font-mono tracking-widest text-center font-bold"
            />
            <button
              type="button"
              onClick={() => void handleVerifyOtp()}
              disabled={verifyingOtp || !otp.trim()}
              aria-busy={verifyingOtp}
              className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            >
              {verifyingOtp ? 'Verifying…' : 'Verify'}
            </button>
          </div>

          {otpVerified && (
            <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
              <span>OTP verified! Click Start Job to begin.</span>
            </div>
          )}

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => void handleStartJob()}
              disabled={!otpVerified || startingJob}
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
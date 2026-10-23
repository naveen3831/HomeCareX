import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import OtpEntry from '@/components/partner/OtpEntry';
import type { OtpEntryHandle } from '@/components/partner/OtpEntry';
import PhotoCapture from '@/components/partner/PhotoCapture';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import {
  DEMO_START_OTP,
  IS_MOCK_JOBS,
  getAttemptsRemaining,
  getErrorCode,
  getErrorMessage,
  getHttpStatus,
  isNetworkError,
  verifyStart,
} from '@/pages/partner/JobDetails/jobDetails.api';
import type { JobDetails, StartVerification } from '@/pages/partner/JobDetails/jobDetails.types';
import './startVerification.css';

const OTP_LENGTH = 4;

interface Props {
  job: JobDetails;
  /** The job after a successful start (status is now in_progress). */
  onStarted: (job: JobDetails) => void;
  /** Update what the server told us about the OTP without reloading the page. */
  onVerificationChange: (patch: Partial<StartVerification>) => void;
  /** The server says our view of the job is out of date, so the page should reload it quietly. */
  onStale: () => void;
}

const timeFormat = new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });

export default function StartVerificationForm({ job, onStarted, onVerificationChange, onStale }: Props) {
  const online = useOnlineStatus();
  const otpRef = useRef<OtpEntryHandle>(null);
  const inFlight = useRef(false); // blocks double taps before React re-renders
  const [otp, setOtp] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [otpInvalid, setOtpInvalid] = useState(false);

  const v = job.startVerification ?? null;
  const locked = v?.locked ?? false;
  const expired = v?.expired ?? false;
  const blocked = locked || expired;
  const canSubmit = otp.length === OTP_LENGTH && photo !== null && online && !submitting && !blocked;

  const handleError = (err: unknown): void => {
    const status = getHttpStatus(err);
    const code = getErrorCode(err);

    if (code === 'INVALID_OTP') {
      const left = getAttemptsRemaining(err) ?? Math.max(0, (v?.attemptsRemaining ?? 1) - 1);
      onVerificationChange({ attemptsRemaining: left });
      setOtp('');
      setOtpInvalid(true);
      setFormError(getErrorMessage(err, 'That code is not correct.'));
      requestAnimationFrame(() => otpRef.current?.focus());
    } else if (code === 'OTP_LOCKED' || status === 423) {
      onVerificationChange({ locked: true, attemptsRemaining: 0 });
      setOtp('');
    } else if (code === 'OTP_EXPIRED' || status === 410) {
      onVerificationChange({ expired: true });
    } else if (code === 'INVALID_FILE' || status === 413) {
      setPhoto(null);
      setPhotoError(getErrorMessage(err, 'This photo cannot be used. Please take it again.'));
    } else if (status === 409 || code === 'INVALID_STATE_TRANSITION') {
      setFormError('This job was already updated. Showing the latest status.');
      onStale();
    } else if (status === 403 || status === 404) {
      setFormError('This job is not available to you.');
    } else if (isNetworkError(err)) {
      setFormError('Could not reach the server. Your code and photo are still here, so you can try again.');
    } else {
      setFormError(getErrorMessage(err, 'Could not verify the code. Please try again.'));
    }
  };

  const submit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    if (!canSubmit || !photo || inFlight.current) return;
    inFlight.current = true;
    setSubmitting(true);
    setFormError(null);
    setPhotoError(null);
    setOtpInvalid(false);
    try {
      onStarted(await verifyStart(job.id, otp, photo));
    } catch (err) {
      handleError(err);
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  return (
    <form className="sv-form" onSubmit={(e) => void submit(e)} noValidate aria-busy={submitting}>
      {!online && (
        <p className="aj-offline" role="status">
          You are offline. You can prepare the photo, but starting the job needs a connection.
        </p>
      )}

      {locked && (
        <div className="sv-alert" role="alert">
          <p className="sv-strong">This job is locked</p>
          <p className="sv-text">Too many incorrect codes were entered. Please contact support to continue.</p>
          <Link className="sv-link-btn" to="/partner/support">
            Contact support
          </Link>
        </div>
      )}

      {!locked && expired && (
        <div className="sv-alert" role="alert">
          <p className="sv-strong">The start code has expired</p>
          <p className="sv-text">Please contact support so a new code can be arranged.</p>
          <Link className="sv-link-btn" to="/partner/support">
            Contact support
          </Link>
        </div>
      )}

      <section
        className={`aj-ref-card sv-step${otp.length === OTP_LENGTH ? ' sv-step-done' : ''}`}
        aria-labelledby="sv-otp-title"
      >
        <div className="sv-step-head">
          <span className="sv-step-num" aria-hidden="true">
            1
          </span>
          <h2 className="sv-title" id="sv-otp-title">
            Customer code
          </h2>
        </div>
        <p className="sv-text" id="sv-otp-hint">
          Ask {job.customer.name} for the {OTP_LENGTH}-digit code shown in their app.
          {IS_MOCK_JOBS && (
            <>
              <br />
              <span className="sv-demo">Demo mode: the code is {DEMO_START_OTP}.</span>
            </>
          )}
        </p>
        <OtpEntry
          ref={otpRef}
          value={otp}
          onChange={(next) => {
            setOtp(next);
            if (otpInvalid) setOtpInvalid(false);
          }}
          length={OTP_LENGTH}
          disabled={blocked || submitting}
          invalid={otpInvalid}
          describedBy="sv-otp-hint sv-otp-status"
        />
        <div id="sv-otp-status" role="status" aria-live="polite">
          {v && !blocked && (
            <p className="sv-hint">
              {v.attemptsRemaining} of {v.maxAttempts} attempts left
              {v.expiresAt ? ` · valid until ${timeFormat.format(new Date(v.expiresAt))}` : ''}
            </p>
          )}
        </div>
        {formError && (
          <p className="sv-error" role="alert">
            {formError}
          </p>
        )}
      </section>

      <section
        className={`aj-ref-card sv-step${photo ? ' sv-step-done' : ''}`}
        aria-labelledby="sv-photo-title"
      >
        <div className="sv-step-head">
          <span className="sv-step-num" aria-hidden="true">
            2
          </span>
          <h2 className="sv-title" id="sv-photo-title">
            Start photo
          </h2>
        </div>
        <p className="sv-text" id="sv-photo-hint">
          Take a clear photo of the item or area before you begin work.
        </p>
        <PhotoCapture
          file={photo}
          onChange={(f) => {
            setPhoto(f);
            if (f) setPhotoError(null);
          }}
          disabled={blocked || submitting}
          error={photoError}
          describedBy="sv-photo-hint"
        />
      </section>

      <div className="sv-submit">
        <button type="submit" className="sv-submit-btn" disabled={!canSubmit} aria-busy={submitting}>
          {submitting ? 'Verifying…' : 'Verify and start job'}
        </button>
        {!canSubmit && !submitting && !blocked && (
          <p className="sv-hint">
            {otp.length < OTP_LENGTH
              ? `Enter the ${OTP_LENGTH}-digit code`
              : !photo
                ? 'Add the start photo'
                : 'Reconnect to continue'}
          </p>
        )}
      </div>
    </form>
  );
}

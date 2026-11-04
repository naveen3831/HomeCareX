import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Camera, CheckCircle2, ClipboardList, Heart, Loader2, PlayCircle } from 'lucide-react';
import JobTimer from '@/components/partner/JobTimer';
import PaymentPanel from '@/components/partner/PaymentPanel';
import {
  completeJob,
  getAttemptsRemaining,
  getErrorCode,
  getErrorMessage,
  verifyStart,
} from '../../JobDetails/jobDetails.api';
import { mapJob } from '../../JobDetails/jobDetails.mapper';
import type { ApiJob, JobDetails } from '../../JobDetails/jobDetails.types';

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const PHOTO_TYPES = ['image/jpeg', 'image/png'];

interface Props {
  job: ApiJob;
  online: boolean;
  /** Ask the page to reload the job after a step succeeded. */
  onChanged: () => void;
}

/** What to show under the map once the partner has arrived: start, complete, then payment + thank you. */
export default function JobStepPanel({ job, online, onChanged }: Props) {
  // Latest job from the payment poll. Only trusted while it was built from the same `job` object.
  const base = useMemo(() => mapJob(job), [job]);
  const [fresh, setFresh] = useState<{ from: JobDetails; job: JobDetails } | null>(null);
  const view = fresh && fresh.from === base ? fresh.job : base;

  if (job.status === 'arrived') return <StartStep job={job} online={online} onChanged={onChanged} />;
  if (job.status === 'in_progress') return <CompleteStep job={view} online={online} onChanged={onChanged} />;
  if (job.status === 'completed' || job.status === 'rated') {
    return (
      <>
        <section className="nv-card nv-card-thanks" role="status" aria-label="Job completed">
          <Heart size={28} aria-hidden="true" className="nv-thanks-icon" />
          <div>
            <strong className="nv-card-title">Thank you! Job completed.</strong>
            <p className="nv-card-text">Great work. Collect the payment below, then you can take your next job.</p>
          </div>
        </section>
        <PaymentPanel job={view} online={online} onJobChange={(j) => setFresh({ from: base, job: j })} />
        <Link className="nv-step" to="/partner/jobs">
          Back to my jobs
        </Link>
      </>
    );
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Arrived: customer's code + start photo                              */
/* ------------------------------------------------------------------ */

function StartStep({ job, online, onChanged }: { job: ApiJob; online: boolean; onChanged: () => void }) {
  const sv = job.startVerification ?? null;
  const [otp, setOtp] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);
  const [lockedLocal, setLockedLocal] = useState(false);
  const [expiredLocal, setExpiredLocal] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const locked = Boolean(sv?.locked) || lockedLocal;
  const expired = Boolean(sv?.expired) || expiredLocal;
  const remaining = attemptsLeft ?? sv?.attemptsRemaining ?? null;
  const blocked = locked || expired;
  const otpOk = /^\d{4,6}$/.test(otp);
  const canSubmit = online && !busy && !blocked && otpOk && photo !== null && !photoError;

  const pickPhoto = (file: File | undefined) => {
    setError(null);
    if (!file) {
      setPhoto(null);
      setPhotoError(null);
      return;
    }
    if (!PHOTO_TYPES.includes(file.type)) {
      setPhoto(null);
      setPhotoError('Use a JPG or PNG photo.');
    } else if (file.size > MAX_PHOTO_BYTES) {
      setPhoto(null);
      setPhotoError('The photo is over 5 MB. Take it again at a lower quality.');
    } else {
      setPhoto(file);
      setPhotoError(null);
    }
  };

  const submit = async () => {
    if (!canSubmit || !photo) return;
    setBusy(true);
    setError(null);
    try {
      await verifyStart(job.id, otp, photo);
      onChanged();
    } catch (err) {
      const code = getErrorCode(err);
      if (code === 'INVALID_OTP') {
        const left = getAttemptsRemaining(err);
        setAttemptsLeft(left);
        setError(left === null ? 'Wrong code. Ask the customer again.' : `Wrong code. ${left} ${left === 1 ? 'attempt' : 'attempts'} left.`);
        setOtp('');
      } else if (code === 'OTP_LOCKED') {
        setLockedLocal(true);
      } else if (code === 'OTP_EXPIRED') {
        setExpiredLocal(true);
      } else if (code === 'CONFLICT') {
        setError('This job was already updated. Refreshing…');
        onChanged();
      } else {
        setError(getErrorMessage(err, 'Could not start the job. Try again.'));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="nv-card" aria-label="Start the job">
      <header className="nv-card-head">
        <PlayCircle size={22} aria-hidden="true" />
        <strong className="nv-card-title">You have arrived. Start the job</strong>
      </header>

      {locked ? (
        <p className="nav-alert" role="alert">
          Too many wrong codes, so starting is locked. Contact support or admin to unlock this job.
        </p>
      ) : expired ? (
        <p className="nav-alert" role="alert">
          The start code has expired. Contact support to get a new one.
        </p>
      ) : (
        <>
          <p className="nv-card-text">Ask {job.customer.name} for the start code, then take a photo of the place before you begin.</p>

          <label className="nv-label" htmlFor="nv-otp">
            Customer start code
          </label>
          <input
            id="nv-otp"
            className="nv-otp"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={otp}
            onChange={(e) => {
              setOtp(e.target.value.replace(/\D/g, ''));
              setError(null);
            }}
            placeholder="0000"
          />
          {remaining !== null && remaining < (sv?.maxAttempts ?? 5) && (
            <p className="nav-hint" role="status">
              {remaining} {remaining === 1 ? 'attempt' : 'attempts'} left
            </p>
          )}

          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png"
            capture="environment"
            className="nav-sr"
            id="nv-photo"
            onChange={(e) => pickPhoto(e.target.files?.[0])}
          />
          <button type="button" className="nv-step" onClick={() => fileRef.current?.click()}>
            <Camera size={20} aria-hidden="true" />
            {photo ? 'Retake start photo' : 'Take start photo'}
          </button>
          {photo && (
            <p className="nv-ok" role="status">
              <CheckCircle2 size={16} aria-hidden="true" /> {photo.name}
            </p>
          )}
          {photoError && (
            <p className="nav-alert" role="alert">
              {photoError}
            </p>
          )}

          {error && (
            <p className="nav-alert" role="alert">
              {error}
            </p>
          )}

          <button type="button" className="nv-go" onClick={() => void submit()} disabled={!canSubmit} aria-busy={busy}>
            {busy ? <Loader2 size={20} className="nv-spin" aria-hidden="true" /> : <PlayCircle size={20} aria-hidden="true" />}
            {busy ? 'Starting…' : 'Verify and start job'}
          </button>
          {!online && <p className="nav-hint">You are offline. Reconnect to start the job.</p>}
        </>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* In progress: timer, checklist link, complete                        */
/* ------------------------------------------------------------------ */

function CompleteStep({ job, online, onChanged }: { job: JobDetails; online: boolean; onChanged: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const left = job.checklist.filter((c) => !c.done).length;

  const complete = async () => {
    if (busy || !online) return;
    setBusy(true);
    setError(null);
    try {
      await completeJob(job.id);
      setConfirming(false);
      onChanged();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not complete the job. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="nv-card" aria-label="Job in progress">
      <header className="nv-card-head">
        <ClipboardList size={22} aria-hidden="true" />
        <strong className="nv-card-title">Job in progress</strong>
      </header>

      <div className="nv-timer" aria-label="Time on job">
        <JobTimer startedAt={job.schedule.startedAt} isCompleted={false} />
      </div>

      <Link className="nv-step" to={`/partner/jobs/${job.id}/active`}>
        <ClipboardList size={20} aria-hidden="true" />
        Open checklist{job.checklist.length > 0 ? ` (${left} left)` : ''}
      </Link>

      {!confirming ? (
        <button type="button" className="nv-go" onClick={() => setConfirming(true)} disabled={!online}>
          <CheckCircle2 size={20} aria-hidden="true" />
          Complete job
        </button>
      ) : (
        <div className="nv-confirm" role="alertdialog" aria-label="Confirm completion">
          <p className="nv-card-text">
            Is the work finished?
            {left > 0 ? ` ${left} checklist ${left === 1 ? 'item is' : 'items are'} still not ticked.` : ''}
          </p>
          <div className="nv-confirm-row">
            <button type="button" className="nv-step" onClick={() => setConfirming(false)} disabled={busy}>
              Not yet
            </button>
            <button type="button" className="nv-go" onClick={() => void complete()} disabled={busy || !online} aria-busy={busy}>
              {busy ? 'Completing…' : 'Yes, complete'}
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="nav-alert" role="alert">
          {error}
        </p>
      )}
      {!online && <p className="nav-hint">You are offline. Reconnect to complete the job.</p>}
    </section>
  );
}
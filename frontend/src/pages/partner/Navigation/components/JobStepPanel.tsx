import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Camera, CheckCircle2, ClipboardList, Heart, Loader2, PlayCircle, Video, X } from 'lucide-react';
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
const MAX_PHOTOS = 6;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];

/** A picked file plus a temporary browser URL so the partner can see it before sending. */
interface Picked {
  file: File;
  url: string;
}

const sameFile = (a: File, b: File) => a.name === b.name && a.size === b.size && a.lastModified === b.lastModified;
const mb = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

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
  const [photos, setPhotos] = useState<Picked[]>([]);
  const [video, setVideo] = useState<Picked | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);
  const [lockedLocal, setLockedLocal] = useState(false);
  const [expiredLocal, setExpiredLocal] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  // Free the preview URLs when the step goes away.
  const live = useRef<{ photos: Picked[]; video: Picked | null }>({ photos: [], video: null });
  live.current = { photos, video };
  useEffect(
    () => () => {
      live.current.photos.forEach((p) => URL.revokeObjectURL(p.url));
      if (live.current.video) URL.revokeObjectURL(live.current.video.url);
    },
    [],
  );

  const locked = Boolean(sv?.locked) || lockedLocal;
  const expired = Boolean(sv?.expired) || expiredLocal;
  const remaining = attemptsLeft ?? sv?.attemptsRemaining ?? null;
  const blocked = locked || expired;
  const otpOk = /^\d{4,6}$/.test(otp);
  const canSubmit = online && !busy && !blocked && otpOk && photos.length > 0 && !photoError;

  const addPhotos = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);
    setPhotoError(null);
    const next = [...photos];
    let problem: string | null = null;
    for (const file of Array.from(files)) {
      if (next.some((p) => sameFile(p.file, file))) continue;
      if (!PHOTO_TYPES.includes(file.type)) {
        problem = 'Use JPG or PNG photos.';
      } else if (file.size > MAX_PHOTO_BYTES) {
        problem = `${file.name} is over 5 MB. Take it again at a lower quality.`;
      } else if (next.length >= MAX_PHOTOS) {
        problem = `You can add up to ${MAX_PHOTOS} photos.`;
      } else {
        next.push({ file, url: URL.createObjectURL(file) });
      }
    }
    setPhotos(next);
    setPhotoError(problem);
  };

  const removePhoto = (index: number) => {
    const gone = photos[index];
    if (gone) URL.revokeObjectURL(gone.url);
    setPhotos(photos.filter((_, i) => i !== index));
    setPhotoError(null);
  };

  const pickVideo = (file: File | undefined) => {
    if (!file) return;
    setError(null);
    if (!VIDEO_TYPES.includes(file.type)) {
      setVideoError('Use an MP4, WebM or MOV video.');
    } else if (file.size > MAX_VIDEO_BYTES) {
      setVideoError(`The video is ${mb(file.size)}. The limit is 50 MB, so record a shorter one.`);
    } else {
      if (video) URL.revokeObjectURL(video.url);
      setVideo({ file, url: URL.createObjectURL(file) });
      setVideoError(null);
    }
  };

  const removeVideo = () => {
    if (video) URL.revokeObjectURL(video.url);
    setVideo(null);
    setVideoError(null);
  };

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await verifyStart(job.id, otp, photos.map((p) => p.file), video?.file ?? null);
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
          <p className="nv-card-text">Ask {job.customer.name} for the start code, then add photos (and a video if you like) of the place before you begin.</p>

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
            ref={photoRef}
            type="file"
            accept="image/jpeg,image/png"
            multiple
            className="nav-sr"
            id="nv-photo"
            onChange={(e) => {
              addPhotos(e.target.files);
              e.target.value = '';
            }}
          />
          <input
            ref={videoRef}
            type="file"
            accept="video/mp4,video/webm,video/quicktime"
            className="nav-sr"
            id="nv-video"
            onChange={(e) => {
              pickVideo(e.target.files?.[0]);
              e.target.value = '';
            }}
          />

          <div className="nv-media">
            <div className="nv-media-head">
              <strong className="nv-label">Photos of the place</strong>
              <span className="nv-media-count">
                {photos.length}/{MAX_PHOTOS}
              </span>
            </div>
            <ul className="nv-thumbs">
              {photos.map((p, i) => (
                <li key={p.url} className="nv-thumb">
                  <img src={p.url} alt={`Start photo ${i + 1}`} />
                  <button
                    type="button"
                    className="nv-thumb-remove"
                    aria-label={`Remove photo ${i + 1}`}
                    onClick={() => removePhoto(i)}
                    disabled={busy}
                  >
                    <X size={14} aria-hidden="true" />
                  </button>
                </li>
              ))}
              {photos.length < MAX_PHOTOS && (
                <li>
                  <button type="button" className="nv-thumb nv-thumb-add" onClick={() => photoRef.current?.click()} disabled={busy}>
                    <Camera size={20} aria-hidden="true" />
                    <span>{photos.length === 0 ? 'Add photos' : 'Add more'}</span>
                  </button>
                </li>
              )}
            </ul>
            {photos.length === 0 && <p className="nav-hint">Add at least one photo to start. You can pick several at once.</p>}
            {photoError && (
              <p className="nav-alert" role="alert">
                {photoError}
              </p>
            )}
          </div>

          <div className="nv-media">
            <div className="nv-media-head">
              <strong className="nv-label">Video (optional)</strong>
              <span className="nv-media-count">MP4, WebM or MOV, up to 50 MB</span>
            </div>
            {video ? (
              <div className="nv-video">
                <video src={video.url} controls playsInline preload="metadata" aria-label="Start video preview" />
                <div className="nv-video-bar">
                  <span className="nv-ok">
                    <CheckCircle2 size={16} aria-hidden="true" /> {video.file.name} ({mb(video.file.size)})
                  </span>
                  <button type="button" className="nv-video-remove" onClick={removeVideo} disabled={busy}>
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" className="nv-thumb-add nv-video-add" onClick={() => videoRef.current?.click()} disabled={busy}>
                <Video size={20} aria-hidden="true" />
                <span>Add a video</span>
              </button>
            )}
            {videoError && (
              <p className="nav-alert" role="alert">
                {videoError}
              </p>
            )}
          </div>

          {error && (
            <p className="nav-alert" role="alert">
              {error}
            </p>
          )}

          <button type="button" className="nv-go" onClick={() => void submit()} disabled={!canSubmit} aria-busy={busy}>
            {busy ? <Loader2 size={20} className="nv-spin" aria-hidden="true" /> : <PlayCircle size={20} aria-hidden="true" />}
            {busy ? (video ? 'Uploading and starting…' : 'Starting…') : 'Verify and start job'}
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
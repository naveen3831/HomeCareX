import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Camera, CheckCircle2, ClipboardList, Heart, Loader2, ChevronLeft, ChevronRight, PlayCircle, Plus, X } from 'lucide-react';
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
import { getCompletionGate, useNow } from '../../ActiveJob/completionRule';
import type { ApiJob, JobDetails } from '../../JobDetails/jobDetails.types';

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const PHOTO_TYPES = ['image/jpeg', 'image/png'];
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];
const MAX_MEDIA = 5;

interface MediaItem {
  id: string;
  file: File;
  url: string;
  kind: 'image' | 'video';
}

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
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);
  const [lockedLocal, setLockedLocal] = useState(false);
  const [expiredLocal, setExpiredLocal] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const addRef = useRef<HTMLInputElement>(null);
  const mediaRef = useRef<MediaItem[]>([]);
  // Index of the photo / video open in the full-screen viewer (null = closed).
  const [viewIndex, setViewIndex] = useState<number | null>(null);
  const touchX = useRef<number | null>(null);
  mediaRef.current = media;

  // Free the preview URLs when the step goes away.
  useEffect(() => () => mediaRef.current.forEach((m) => URL.revokeObjectURL(m.url)), []);

  const locked = Boolean(sv?.locked) || lockedLocal;
  const expired = Boolean(sv?.expired) || expiredLocal;
  const remaining = attemptsLeft ?? sv?.attemptsRemaining ?? null;
  const blocked = locked || expired;
  const otpOk = /^\d{4,6}$/.test(otp);
  const canSubmit = online && !busy && !blocked && otpOk && media.length > 0;

  /** Adds the chosen photos / videos. `replace` = Retake: the old ones are dropped first. */
  const addMedia = (files: FileList | null, replace = false) => {
    setError(null);
    setPhotoError(null);
    const picked = Array.from(files ?? []);
    if (picked.length === 0) return;

    const kept = replace ? [] : media;
    if (replace) media.forEach((m) => URL.revokeObjectURL(m.url));

    const next: MediaItem[] = [...kept];
    let problem: string | null = null;
    for (const file of picked) {
      if (next.length >= MAX_MEDIA) {
        problem = `You can add up to ${MAX_MEDIA} photos or videos.`;
        break;
      }
      const isImage = PHOTO_TYPES.includes(file.type);
      const isVideo = VIDEO_TYPES.includes(file.type);
      if (!isImage && !isVideo) {
        problem = 'Use a JPG or PNG photo, or an MP4 video.';
      } else if (isImage && file.size > MAX_PHOTO_BYTES) {
        problem = 'A photo is over 5 MB. Take it again at a lower quality.';
      } else if (isVideo && file.size > MAX_VIDEO_BYTES) {
        problem = 'A video is over 50 MB. Record a shorter one.';
      } else {
        next.push({
          id: `${file.name}-${file.size}-${file.lastModified}-${next.length}`,
          file,
          url: URL.createObjectURL(file),
          kind: isImage ? 'image' : 'video',
        });
      }
    }
    setMedia(next);
    setPhotoError(problem);
  };

  const showPrev = () => setViewIndex((i) => (i === null ? i : (i - 1 + media.length) % media.length));
  const showNext = () => setViewIndex((i) => (i === null ? i : (i + 1) % media.length));

  // Viewer: arrow keys slide, Esc closes, and the page behind does not scroll.
  useEffect(() => {
    if (viewIndex === null) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setViewIndex(null);
      else if (e.key === 'ArrowLeft') setViewIndex((i) => (i === null ? i : (i - 1 + mediaRef.current.length) % mediaRef.current.length));
      else if (e.key === 'ArrowRight') setViewIndex((i) => (i === null ? i : (i + 1) % mediaRef.current.length));
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [viewIndex === null]); // eslint-disable-line react-hooks/exhaustive-deps

  const removeMedia = (id: string) => {
    setError(null);
    setPhotoError(null);
    setMedia((list) => {
      const gone = list.find((m) => m.id === id);
      if (gone) URL.revokeObjectURL(gone.url);
      return list.filter((m) => m.id !== id);
    });
  };

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      // All photos and videos are uploaded; admins can see them on the booking.
      await verifyStart(job.id, otp, media.map((m) => m.file));
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

          {/* Camera: first photo and Retake */}
          <input
            ref={cameraRef}
            type="file"
            accept="image/jpeg,image/png"
            capture="environment"
            className="nav-sr"
            id="nv-photo"
            onChange={(e) => {
              addMedia(e.target.files, media.length > 0);
              e.target.value = '';
            }}
          />
          {/* Add more: photos or a video, from the camera roll or the camera */}
          <input
            ref={addRef}
            type="file"
            accept="image/jpeg,image/png,video/mp4,video/quicktime,video/webm"
            multiple
            className="nav-sr"
            id="nv-photo-more"
            onChange={(e) => {
              addMedia(e.target.files);
              e.target.value = '';
            }}
          />

          {media.length === 0 ? (
            <button type="button" className="nv-step" onClick={() => cameraRef.current?.click()}>
              <Camera size={20} aria-hidden="true" />
              Take start photo
            </button>
          ) : (
            <>
              <div className="nv-media" aria-label="Start photos and videos">
                {media.map((m, i) => (
                  <div className="nv-media-item" key={m.id}>
                    <button
                      type="button"
                      className="nv-media-open"
                      onClick={() => setViewIndex(i)}
                      aria-label={`Open ${m.kind === 'image' ? 'photo' : 'video'} ${i + 1}`}
                    >
                      {m.kind === 'image' ? (
                        <img src={m.url} alt="" />
                      ) : (
                        <video src={m.url} muted playsInline preload="metadata" />
                      )}
                    </button>
                    <button
                      type="button"
                      className="nv-media-x"
                      onClick={() => removeMedia(m.id)}
                      aria-label={`Remove item ${i + 1}`}
                    >
                      <X size={14} aria-hidden="true" />
                    </button>
                  </div>
                ))}
                {media.length < MAX_MEDIA && (
                  <button
                    type="button"
                    className="nv-media-add"
                    onClick={() => addRef.current?.click()}
                    aria-label="Add more photos or a video"
                  >
                    <Plus size={26} aria-hidden="true" />
                  </button>
                )}
              </div>
              <button type="button" className="nv-step" onClick={() => cameraRef.current?.click()}>
                <Camera size={20} aria-hidden="true" />
                Retake photo
              </button>
            </>
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

      {viewIndex !== null && media[viewIndex] && (
        <div
          className="nv-viewer"
          role="dialog"
          aria-modal="true"
          aria-label="Photo viewer"
          onClick={() => setViewIndex(null)}
          onTouchStart={(e) => {
            touchX.current = e.touches[0].clientX;
          }}
          onTouchEnd={(e) => {
            if (touchX.current === null || media.length < 2) return;
            const dx = e.changedTouches[0].clientX - touchX.current;
            touchX.current = null;
            if (dx > 50) showPrev();
            else if (dx < -50) showNext();
          }}
        >
          <div className="nv-viewer-bar" onClick={(e) => e.stopPropagation()}>
            <span>
              {viewIndex + 1} / {media.length}
            </span>
            <button type="button" className="nv-viewer-btn" onClick={() => setViewIndex(null)} aria-label="Close viewer">
              <X size={22} aria-hidden="true" />
            </button>
          </div>

          <div className="nv-viewer-stage" onClick={(e) => e.stopPropagation()}>
            {media[viewIndex].kind === 'image' ? (
              <img key={media[viewIndex].id} src={media[viewIndex].url} alt={`Start photo ${viewIndex + 1}`} />
            ) : (
              <video key={media[viewIndex].id} src={media[viewIndex].url} controls playsInline autoPlay />
            )}
          </div>

          {media.length > 1 && (
            <>
              <button
                type="button"
                className="nv-viewer-btn nv-viewer-prev"
                onClick={(e) => {
                  e.stopPropagation();
                  showPrev();
                }}
                aria-label="Previous"
              >
                <ChevronLeft size={26} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="nv-viewer-btn nv-viewer-next"
                onClick={(e) => {
                  e.stopPropagation();
                  showNext();
                }}
                aria-label="Next"
              >
                <ChevronRight size={26} aria-hidden="true" />
              </button>
            </>
          )}
        </div>
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
  const gate = getCompletionGate(job, useNow(5000));

  const complete = async () => {
    if (busy || !online || !gate.canComplete) return;
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
        <>
          <button type="button" className="nv-go" onClick={() => setConfirming(true)} disabled={!online || !gate.canComplete}>
            <CheckCircle2 size={20} aria-hidden="true" />
            Complete job
          </button>
          {!gate.canComplete && (
            <p className="nav-hint" role="status">
              {gate.message}
            </p>
          )}
        </>
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
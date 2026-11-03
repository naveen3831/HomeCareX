import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { CheckCircle2, Image as ImageIcon, Loader2, PlayCircle, Square, Volume2, X } from 'lucide-react';
import {
  completeOnboardingStep,
  fetchOnboarding,
  onboardingErrorMessage,
  type OnboardingStatus,
} from './onboarding.api';
import { DEMO_STEPS } from './onboarding.content';

/** Video that cannot be skipped forward: the partner can pause and replay, but not jump ahead. */
function StepVideo({ src, onDone }: { src: string; onDone: () => void }) {
  const furthest = useRef(0);
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    furthest.current = 0;
    setBroken(false);
  }, [src]);

  if (broken) return null;
  return (
    <video
      key={src}
      src={src}
      controls
      controlsList="nodownload noplaybackrate"
      disablePictureInPicture
      playsInline
      preload="metadata"
      className="aspect-video w-full rounded-xl bg-black"
      onError={() => setBroken(true)}
      onTimeUpdate={(e) => {
        const t = e.currentTarget.currentTime;
        if (t > furthest.current && t - furthest.current < 1.5) furthest.current = t;
      }}
      onSeeking={(e) => {
        const v = e.currentTarget;
        if (v.currentTime > furthest.current + 0.5) v.currentTime = furthest.current; // no jumping ahead
      }}
      onEnded={onDone}
    />
  );
}

/** Reads the step aloud with the browser's built-in voice (no audio files needed). */
function ListenButton({ text }: { text: string }) {
  const [speaking, setSpeaking] = useState(false);
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  useEffect(() => {
    if (!supported) return;
    return () => window.speechSynthesis.cancel(); // stop when the step changes or the page closes
  }, [supported, text]);

  if (!supported) return null;
  const toggle = () => {
    const synth = window.speechSynthesis;
    if (speaking) {
      synth.cancel();
      setSpeaking(false);
      return;
    }
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-IN';
    u.rate = 0.95;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    setSpeaking(true);
    synth.speak(u);
  };
  return (
    <button type="button" onClick={toggle} aria-pressed={speaking} className="inline-flex items-center gap-2 self-start rounded-lg border border-line px-3 py-1.5 text-sm font-semibold text-ink">
      {speaking ? <Square className="h-4 w-4" aria-hidden="true" /> : <Volume2 className="h-4 w-4" aria-hidden="true" />}
      {speaking ? 'Stop' : 'Listen'}
    </button>
  );
}

function Photo({ src, caption }: { src: string; caption: string }) {
  const [broken, setBroken] = useState(false);
  return (
    <figure className="overflow-hidden rounded-xl border border-line bg-panel">
      {broken ? (
        <div className="flex aspect-[4/3] items-center justify-center bg-canvas text-muted" aria-hidden="true">
          <ImageIcon className="h-10 w-10" />
        </div>
      ) : (
        <img src={src} alt={caption} loading="lazy" className="aspect-[4/3] w-full object-cover" onError={() => setBroken(true)} />
      )}
      <figcaption className="px-3 py-2 text-xs font-medium text-ink">{caption}</figcaption>
    </figure>
  );
}

export default function PartnerOnboardingPage() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [leaving, setLeaving] = useState(false);
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [videoDone, setVideoDone] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [hasVideo, setHasVideo] = useState(true);

  const load = useCallback(async () => {
    setLoadError('');
    try {
      setStatus(await fetchOnboarding());
    } catch (err) {
      setLoadError(onboardingErrorMessage(err, 'Could not load the demo. Check your connection and try again.'));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const step = status?.currentStep ?? null;
  const content = step ? DEMO_STEPS[step - 1] : undefined;

  // Every new step starts locked again.
  useEffect(() => {
    setVideoDone(false);
    setHasVideo(true);
    setError('');
    setSecondsLeft(content?.readSeconds ?? 0);
  }, [step, content]);

  // Without a playable video the partner reads for a few seconds instead.
  useEffect(() => {
    if (hasVideo || secondsLeft <= 0) return;
    const t = window.setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [hasVideo, secondsLeft]);

  // Detect a missing video file so the timer takes over.
  useEffect(() => {
    if (!content) return;
    let live = true;
    fetch(content.video, { method: 'HEAD' })
      .then((r) => live && setHasVideo(r.ok && (r.headers.get('content-type') ?? '').startsWith('video')))
      .catch(() => live && setHasVideo(false));
    return () => { live = false; };
  }, [content]);

  const unlocked = hasVideo ? videoDone : secondsLeft <= 0;

  const next = async () => {
    if (!step || !unlocked || busy) return;
    setBusy(true);
    setError('');
    try {
      setStatus(await completeOnboardingStep(step));
    } catch (err) {
      setError(onboardingErrorMessage(err, 'Could not save your progress. Try again.'));
      void load(); // the server may be on a different step
    } finally {
      setBusy(false);
    }
  };

  // Cancel and "Log out" both sign the partner out. Progress is already saved on the server,
  // so the next login lands on this demo again, at the same step.
  const leave = async () => {
    if (leaving) return;
    setLeaving(true);
    try {
      await logout();
    } finally {
      navigate('/login', { replace: true });
    }
  };

  // While waiting for the admin, look again every 20 seconds.
  const waiting = status?.stage === 'awaiting_approval';
  useEffect(() => {
    if (!waiting) return;
    const t = window.setInterval(() => void load(), 20000);
    return () => window.clearInterval(t);
  }, [waiting, load]);

  if (loadError) {
    return (
      <main className="mx-auto max-w-md p-6 text-center">
        <p role="alert" className="text-sm text-red-600">{loadError}</p>
        <button type="button" onClick={() => void load()} className="mt-4 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white">Try again</button>
      </main>
    );
  }
  if (!status) return <main aria-busy="true" className="p-8 text-center text-sm text-muted"><Loader2 className="mx-auto h-6 w-6 animate-spin" aria-hidden="true" /></main>;

  if (!status.eligible) {
    return (
      <main className="mx-auto max-w-md p-6 text-center">
        <h1 className="text-lg font-bold text-ink">Demo opens after approval</h1>
        <p className="mt-2 text-sm text-muted">Once the admin approves your account, you will see how HomeCareX works here.</p>
        <Link to="/partner" className="mt-4 inline-block rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white">Back to home</Link>
      </main>
    );
  }

  if (status.stage === 'awaiting_approval') {
    return (
      <main className="mx-auto max-w-md p-6 text-center">
        <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-600" aria-hidden="true" />
        <h1 className="mt-3 text-xl font-bold text-ink">Training complete</h1>
        <p className="mt-2 text-sm text-muted">You finished all {status.totalSteps} steps. An admin will check and approve your account. You can use the app after that.</p>
        <div className="mt-5 flex justify-center gap-3">
          <button type="button" onClick={() => void load()} className="rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-ink">Check again</button>
          <button type="button" onClick={() => void leave()} disabled={leaving} className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Log out</button>
        </div>
      </main>
    );
  }

  if (status.completed || !content || !step) {
    return (
      <main className="mx-auto max-w-md p-6 text-center">
        <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-600" aria-hidden="true" />
        <h1 className="mt-3 text-xl font-bold text-ink">You are ready to start</h1>
        <p className="mt-2 text-sm text-muted">You finished all {status.totalSteps} steps. New job requests will appear on your home screen.</p>
        <Link to="/partner" replace className="mt-5 inline-block rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white">Go to home</Link>
      </main>
    );
  }

  const isLast = step === status.totalSteps;
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-5 p-4 sm:p-6">
      <header className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand">How HomeCareX works</p>
          <p className="text-sm text-muted" aria-live="polite">Step {step} of {status.totalSteps}</p>
        </div>
        <button type="button" onClick={() => setConfirmCancel(true)} className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-1.5 text-sm font-semibold text-ink">
          <X className="h-4 w-4" aria-hidden="true" /> Cancel
        </button>
      </header>

      {/* Progress only: the bars are not buttons, so steps cannot be skipped or jumped to. */}
      <ol className="flex gap-1.5" aria-label="Progress">
        {DEMO_STEPS.map((_, i) => (
          <li key={i} aria-current={i + 1 === step ? 'step' : undefined} className={`h-2 flex-1 rounded-full ${i + 1 < step ? 'bg-emerald-500' : i + 1 === step ? 'bg-brand' : 'bg-line'}`} />
        ))}
      </ol>

      <section aria-labelledby="demo-title" className="flex flex-col gap-4">
        <div>
          <h1 id="demo-title" className="text-xl font-bold text-ink">{content.title}</h1>
          <p className="mt-1 text-sm text-muted">{content.summary}</p>
        </div>

        {hasVideo ? (
          <StepVideo src={content.video} onDone={() => setVideoDone(true)} />
        ) : (
          <div className="flex aspect-video w-full items-center justify-center rounded-xl bg-canvas text-muted">
            <PlayCircle className="h-12 w-12" aria-hidden="true" />
          </div>
        )}

        <ListenButton text={`${content.title}. ${content.summary} ${content.points.join('. ')}.`} />

        <ul className="list-disc space-y-1 pl-5 text-sm text-ink">
          {content.points.map((p) => <li key={p}>{p}</li>)}
        </ul>

        {/* The two photos appear only after the video has finished (or the read timer ends without a video). */}
        {unlocked && (
          <div>
            <h2 className="mb-2 text-sm font-semibold text-ink">What it looks like</h2>
            <div className="grid grid-cols-2 gap-3">
              {content.photos.map((p) => <Photo key={p.src} {...p} />)}
            </div>
          </div>
        )}
      </section>

      {error && <p role="alert" className="text-sm font-semibold text-red-600">{error}</p>}

      <div className="sticky bottom-0 -mx-4 mt-auto border-t border-line bg-panel p-4 sm:-mx-6 sm:px-6">
        <button
          type="button"
          onClick={() => void next()}
          disabled={!unlocked || busy}
          aria-busy={busy}
          className="w-full rounded-xl bg-brand py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? 'Saving…' : isLast ? 'Finish demo' : 'Next step'}
        </button>
        {!unlocked && (
          <p className="mt-2 text-center text-xs text-muted">
            {hasVideo ? 'Watch the video to the end to continue.' : `Read this step to continue (${secondsLeft}s).`}
          </p>
        )}
      </div>

      {confirmCancel && (
        <div role="dialog" aria-modal="true" aria-labelledby="cancel-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl">
            <h2 id="cancel-title" className="text-lg font-bold text-ink">Leave the demo?</h2>
            <p className="mt-2 text-sm text-muted">You will be logged out. Your progress is saved, so when you log in again you continue from step {step}.</p>
            <div className="mt-5 flex gap-3">
              <button type="button" onClick={() => setConfirmCancel(false)} className="flex-1 rounded-xl border border-line py-2.5 text-sm font-semibold text-ink">Keep going</button>
              <button type="button" onClick={() => void leave()} disabled={leaving} className="flex-1 rounded-xl bg-brand py-2.5 text-sm font-semibold text-white disabled:opacity-50">{leaving ? 'Logging out…' : 'Log out'}</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
import { useCallback, useEffect, useState } from 'react';
import http, { type ApiResponse } from '@/lib/http';
import { DEMO_STEPS } from '@/pages/partner/Onboarding/onboarding.content';

interface TrainingStatus {
  eligible: boolean;
  totalSteps: number;
  completedSteps: number;
  completed: boolean;
  stage: 'not_eligible' | 'training' | 'awaiting_approval' | 'approved';
  approved: boolean;
  completedAt: string | null;
  approvedAt: string | null;
}

const base = (partnerId: string) => `/admin/partners/${partnerId}/training`;

const messageOf = (err: unknown, fallback: string): string => {
  const m = (err as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
  return typeof m === 'string' && m ? m : fallback;
};

const formatDate = (iso: string | null): string =>
  iso
    ? new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
    : '—';

const STAGE_META: Record<TrainingStatus['stage'], { label: string; tone: string; text: (s: TrainingStatus) => string }> = {
  not_eligible: {
    label: 'Locked',
    tone: 'is-muted',
    text: () => 'Training unlocks after the partner’s KYC is approved.',
  },
  training: {
    label: 'In progress',
    tone: 'is-warn',
    text: (s) => `The partner has finished ${s.completedSteps} of ${s.totalSteps} demo steps.`,
  },
  awaiting_approval: {
    label: 'Ready for review',
    tone: 'is-warn',
    text: () => 'All steps are done. Approve to let the partner start taking jobs.',
  },
  approved: {
    label: 'Approved',
    tone: 'is-good',
    text: () => 'The partner has full access to the app.',
  },
};

/**
 * Admin view of a partner’s training (the in-app demo): progress, each step, and the two decisions.
 * A partner who finished every step stays locked out until an admin approves.
 */
export default function TrainingPanel({
  partnerId,
  canApprove,
  onChanged,
}: {
  partnerId: string;
  canApprove: boolean;
  onChanged?: () => void;
}) {
  const [status, setStatus] = useState<TrainingStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await http.get<ApiResponse<TrainingStatus>>(base(partnerId));
      setStatus(res.data.data);
      setError('');
    } catch (err) {
      setError(messageOf(err, 'Could not load the training status.'));
    }
  }, [partnerId]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (action: 'approve' | 'reset') => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await http.post<ApiResponse<TrainingStatus>>(`${base(partnerId)}/${action}`);
      setStatus(res.data.data);
      setNotice(res.data.message ?? 'Done.');
      setConfirmReset(false);
      onChanged?.();
    } catch (err) {
      setError(messageOf(err, 'Could not save. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  if (!status) {
    return (
      <section className="tp" aria-busy={!error}>
        {error ? <p role="alert" className="tp-error">{error}</p> : <p className="tp-loading">Loading training…</p>}
      </section>
    );
  }

  const meta = STAGE_META[status.stage];
  const total = status.totalSteps;
  const done = status.completedSteps;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const canResetNow = canApprove && status.eligible && done > 0;

  return (
    <section className="tp" aria-label="Partner training">
      <header className="tp-head">
        <div>
          <h2>Training</h2>
          <p>{meta.text(status)}</p>
        </div>
        <span className={`pd-badge ${meta.tone}`}>{meta.label}</span>
      </header>

      <div className="tp-progress">
        <div className="tp-progress__figure">
          <strong>{pct}%</strong>
          <span>{done} of {total} steps</span>
        </div>
        <div
          className="tp-bar"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={done}
          aria-label="Training progress"
        >
          <div className={`tp-bar__fill ${status.stage === 'approved' ? 'is-good' : ''}`} style={{ width: `${pct}%` }} />
        </div>
      </div>

      <ol className="tp-steps">
        {Array.from({ length: total }, (_, i) => {
          const state = i < done ? 'is-done' : i === done && !status.completed && status.eligible ? 'is-current' : 'is-todo';
          const caption = state === 'is-done' ? 'Completed' : state === 'is-current' ? 'Currently on this step' : 'Not started';
          return (
            <li key={i} className={`tp-step ${state}`}>
              <span className="tp-step__marker" aria-hidden="true">{state === 'is-done' ? '✓' : i + 1}</span>
              <div>
                <strong>{DEMO_STEPS[i]?.title ?? `Step ${i + 1}`}</strong>
                <small>{caption}</small>
              </div>
            </li>
          );
        })}
      </ol>

      <dl className="tp-meta">
        <div>
          <dt>Finished all steps</dt>
          <dd>{formatDate(status.completedAt)}</dd>
        </div>
        <div>
          <dt>Approved by admin</dt>
          <dd>{formatDate(status.approvedAt)}</dd>
        </div>
      </dl>

      {notice && <p role="status" className="tp-notice">{notice}</p>}
      {error && <p role="alert" className="tp-error">{error}</p>}
      {!canApprove && (
        <p className="permission-warning">
          You need the <code>kyc:approve</code> permission to approve or reset training.
        </p>
      )}

      <footer className="tp-actions">
        {confirmReset ? (
          <div className="tp-confirm" role="alertdialog" aria-label="Confirm reset">
            <p>Send this partner back to step 1? They lose access until they finish again and you approve.</p>
            <div>
              <button type="button" className="partner-secondary-btn" disabled={busy} onClick={() => setConfirmReset(false)}>
                Keep progress
              </button>
              <button type="button" className="partner-danger-btn" disabled={busy} onClick={() => void act('reset')}>
                {busy ? 'Resetting…' : 'Yes, reset'}
              </button>
            </div>
          </div>
        ) : (
          <>
            <button
              type="button"
              className="partner-primary-btn"
              disabled={busy || !canApprove || status.stage !== 'awaiting_approval'}
              onClick={() => void act('approve')}
            >
              {busy ? 'Processing…' : status.approved ? 'Approved' : 'Approve training'}
            </button>
            <button
              type="button"
              className="partner-secondary-btn"
              disabled={busy || !canResetNow}
              onClick={() => setConfirmReset(true)}
            >
              Send back to step 1
            </button>
          </>
        )}
      </footer>
    </section>
  );
}

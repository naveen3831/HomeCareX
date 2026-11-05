import { useCallback, useEffect, useState } from 'react';
import http, { type ApiResponse } from '@/lib/http';

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

/**
 * Admin review of the partner training (demo). A partner who finished all steps stays locked out
 * until an admin presses "Approve training". "Send back to step 1" removes access and restarts it.
 */
export default function TrainingApprovalCard({ partnerId, canApprove, onChanged }: { partnerId: string; canApprove: boolean; onChanged?: () => void }) {
  const [status, setStatus] = useState<TrainingStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await http.get<ApiResponse<TrainingStatus>>(base(partnerId));
      setStatus(res.data.data);
    } catch (err) {
      setError(messageOf(err, 'Could not load the training status.'));
    }
  }, [partnerId]);
  useEffect(() => { void load(); }, [load]);

  const act = async (action: 'approve' | 'reset') => {
    if (action === 'reset' && !window.confirm('Send this partner back to step 1? They lose access until they finish and you approve again.')) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await http.post<ApiResponse<TrainingStatus>>(`${base(partnerId)}/${action}`);
      const next = res.data.data;
      setStatus(next);
      const ok = action === 'approve' ? next.stage === 'approved' : next.completedSteps === 0;
      if (ok) { setNotice(res.data.message ?? 'Done.'); onChanged?.(); }
      else setError('The server did not save the change. Please try again.');
    } catch (err) {
      setError(messageOf(err, 'Could not save. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  if (!status) return error ? <p role="alert" className="detail-card" style={{ color: '#b91c1c' }}>{error}</p> : null;

  const label =
    status.stage === 'not_eligible' ? 'Waiting for KYC approval'
    : status.stage === 'training' ? `In training: ${status.completedSteps} of ${status.totalSteps} steps done`
    : status.stage === 'awaiting_approval' ? 'Finished all steps: waiting for your approval'
    : 'Approved: partner can use the app';

  return (
    <section className="detail-card" aria-label="Partner training">
      <div className="detail-card-header">
        <div>
          <h2>Training (demo)</h2>
          <p>{label}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="partner-primary-btn"
            disabled={busy || !canApprove || status.stage !== 'awaiting_approval'}
            onClick={() => void act('approve')}
          >
            {busy ? 'Processing...' : 'Approve training'}
          </button>
          <button
            type="button"
            className="partner-danger-btn"
            disabled={busy || !canApprove || !status.eligible || status.completedSteps === 0}
            onClick={() => void act('reset')}
          >
            Send back to step 1
          </button>
        </div>
      </div>
      {notice && <p role="status">{notice}</p>}
      {error && <p role="alert" style={{ color: '#b91c1c' }}>{error}</p>}
    </section>
  );
}

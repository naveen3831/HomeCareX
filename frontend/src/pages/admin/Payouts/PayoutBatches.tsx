import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { PermissionGate } from '@/components/admin/PermissionGate';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import {
  confirmPayoutBatch,
  downloadBatchCsv,
  fetchPayoutBatches,
  fetchPayoutSummary,
  generatePayoutBatch,
} from '@/services/payoutBatchApi';
import type { BatchFrequency, PayoutBatch, PayoutSummary } from '@/types/payoutBatches';
import { apiError, canConfirm, day, FREQUENCY_LABEL, money, periodText } from './payoutFormat';
import './batches.css';

// No pager on this page: one request returns up to this many batches, newest first.
const PAGE_SIZE = 50;

/** Local calendar day as YYYY-MM-DD. */
const ymd = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const parseYmd = (v: string): Date => {
  const [y, m, d] = v.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const addDays = (v: string, n: number): string => {
  const d = parseYmd(v);
  d.setDate(d.getDate() + n);
  return ymd(d);
};

type Preset = Exclude<BatchFrequency, 'custom'>;

/** From / To (both inclusive) that a Daily, Weekly (Mon–Sun) or Monthly batch covers around `anchor`. */
const presetRange = (frequency: Preset, anchor: string): { from: string; to: string } => {
  const d = parseYmd(anchor);
  if (frequency === 'daily') return { from: anchor, to: anchor };
  if (frequency === 'weekly') {
    const monday = addDays(anchor, -((d.getDay() + 6) % 7));
    return { from: monday, to: addDays(monday, 6) };
  }
  return { from: ymd(new Date(d.getFullYear(), d.getMonth(), 1)), to: ymd(new Date(d.getFullYear(), d.getMonth() + 1, 0)) };
};

/** Business time is IST. The server treats the end of a custom range as exclusive, so "To" becomes the next midnight. */
const IST = '+05:30';
const startOfDayIst = (v: string): string => `${v}T00:00:00${IST}`;
const endOfDayIst = (v: string): string => `${addDays(v, 1)}T00:00:00${IST}`;

const today = (): string => ymd(new Date());

/** Payout batches: generate from a date range, view details, export CSV, confirm payout. */
/** `pendingWithdrawals` comes from the page, which also shows the withdrawal requests below this table. */
export const PayoutBatches: React.FC<{ pendingWithdrawals?: number }> = ({ pendingWithdrawals = 0 }) => {
  const [batches, setBatches] = useState<PayoutBatch[]>([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState<PayoutSummary | null>(null);
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);

  const [frequency, setFrequency] = useState<BatchFrequency>('weekly');
  const [from, setFrom] = useState(() => presetRange('weekly', today()).from);
  const [to, setTo] = useState(() => presetRange('weekly', today()).to);
  const [generating, setGenerating] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  const [confirmBatch, setConfirmBatch] = useState<PayoutBatch | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [exportingId, setExportingId] = useState('');
  const latest = useRef(0);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  const load = useCallback(async () => {
    const ticket = ++latest.current;
    setLoading(true);
    setError('');
    // The cards are a bonus: if they fail to load the batch table still works.
    fetchPayoutSummary()
      .then((data) => ticket === latest.current && setSummary(data))
      .catch(() => undefined);
    try {
      const res = await fetchPayoutBatches({ page: 1, limit: PAGE_SIZE, status });
      if (ticket !== latest.current) return;
      setBatches(res.items);
    } catch (e) {
      if (ticket === latest.current) setError(apiError(e).message);
    } finally {
      if (ticket === latest.current) setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  const onFrequency = (next: BatchFrequency) => {
    setFrequency(next);
    if (next !== 'custom') {
      const range = presetRange(next, from || today());
      setFrom(range.from);
      setTo(range.to);
    }
  };

  // Editing a date by hand turns the period into a custom range, so what you see is what is sent.
  const onFromChange = (v: string) => {
    setFrom(v);
    if (to && v > to) setTo(v);
    setFrequency('custom');
  };
  const onToChange = (v: string) => {
    setTo(v);
    if (from && v < from) setFrom(v);
    setFrequency('custom');
  };

  const onGenerate = async (ev: React.SyntheticEvent) => {
    ev.preventDefault();
    setNotice(null);
    if (!from || !to) return setNotice({ tone: 'err', text: 'Choose both a start and an end date.' });
    if (from > to) return setNotice({ tone: 'err', text: 'The start date must be before the end date.' });
    setGenerating(true);
    try {
      await generatePayoutBatch(
        frequency === 'custom'
          ? { frequency, periodStart: startOfDayIst(from), periodEnd: endOfDayIst(to) }
          : { frequency, date: from },
      );
      setNotice({ tone: 'ok', text: `Payout batch created for ${day(from)} – ${day(to)}.` });
      await load();
    } catch (e) {
      const { status: code, message } = apiError(e);
      setNotice({
        tone: 'err',
        text:
          code === 409
            ? 'A batch already exists for these earnings, or they are already reserved. Open the existing batch below.'
            : message,
      });
    } finally {
      setGenerating(false);
    }
  };

  const onConfirm = async () => {
    if (!confirmBatch) return;
    setConfirming(true);
    try {
      const res = await confirmPayoutBatch(confirmBatch._id);
      setNotice(
        res.failed.length
          ? { tone: 'err', text: `${res.confirmedCount} paid, ${res.failed.length} failed. Open the batch to retry the failed ones.` }
          : { tone: 'ok', text: `Paid ${money(res.confirmedAmount)} to ${res.confirmedCount} partner${res.confirmedCount === 1 ? '' : 's'}.` },
      );
      setConfirmBatch(null);
      void load();
    } catch (e) {
      setNotice({ tone: 'err', text: apiError(e).message });
      setConfirmBatch(null);
    } finally {
      setConfirming(false);
    }
  };

  const onExport = async (batchId: string) => {
    setExportingId(batchId);
    try {
      await downloadBatchCsv(batchId);
    } catch (e) {
      setNotice({ tone: 'err', text: apiError(e).message });
    } finally {
      setExportingId('');
    }
  };

  return (
    <section className="pb" aria-labelledby="pb-title">
      <div className="pb-head">
        <h2 id="pb-title">Payout batches</h2>
        <label className="pb-field">
          <span>Status</span>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
                    }}
          >
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </select>
        </label>
      </div>

      {!online && (
        <p className="pb-banner pb-banner--warn" role="status">
          You are offline. Changes will not be saved until the connection is back.
        </p>
      )}
      {notice && (
        <p className={`pb-banner pb-banner--${notice.tone}`} role={notice.tone === 'err' ? 'alert' : 'status'}>
          {notice.text}
        </p>
      )}

      <dl className="pb-cards" aria-label="Payout overview">
        <div className="pb-card"><dt>Total gross</dt><dd>{summary ? money(summary.gross) : '—'}</dd></div>
        <div className="pb-card"><dt>Commission</dt><dd>{summary ? money(summary.commission) : '—'}</dd></div>
        <div className="pb-card"><dt>Net to partners</dt><dd>{summary ? money(summary.net) : '—'}</dd></div>
        <div className="pb-card pb-card--green"><dt>Paid out</dt><dd>{summary ? money(summary.paid) : '—'}</dd></div>
        <div className="pb-card pb-card--amber"><dt>Awaiting payout</dt><dd>{summary ? money(summary.awaiting) : '—'}</dd></div>
        <a className={`pb-card pb-card--link${pendingWithdrawals > 0 ? ' pb-card--amber' : ''}`} href="#withdrawal-requests">
          <dt>Withdrawal requests</dt>
          <dd>{pendingWithdrawals} pending</dd>
        </a>
      </dl>

      <PermissionGate permission="payouts:approve">
        <form className="pb-gen" onSubmit={onGenerate} aria-label="Generate payout batch">
          <label className="pb-field">
            <span>Period</span>
            <select value={frequency} onChange={(e) => onFrequency(e.target.value as BatchFrequency)}>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly (Mon–Sun)</option>
              <option value="monthly">Monthly</option>
              <option value="custom">Custom range</option>
            </select>
          </label>
          <label className="pb-field">
            <span>From</span>
            <input type="date" value={from} max={to || undefined} onChange={(e) => onFromChange(e.target.value)} required />
          </label>
          <label className="pb-field">
            <span>To</span>
            <input type="date" value={to} min={from || undefined} onChange={(e) => onToChange(e.target.value)} required />
          </label>
          <button type="submit" className="pb-btn pb-btn--primary" disabled={generating || !online}>
            {generating ? 'Generating…' : 'Generate batch'}
          </button>
          <p className="pb-hint">
            Only settled earnings from {from ? day(from) : '…'} to {to ? day(to) : '…'} are included. Earnings already in
            a batch are skipped, so the same period cannot be paid twice.
          </p>
        </form>
      </PermissionGate>

      {loading && batches.length === 0 ? (
        <p className="pb-state" role="status">Loading payout batches…</p>
      ) : error ? (
        <div className="pb-state pb-state--err" role="alert">
          <p>{error}</p>
          <button type="button" className="pb-btn" onClick={() => void load()}>Try again</button>
        </div>
      ) : batches.length === 0 ? (
        <p className="pb-state">No payout batches yet. Pick a period above and generate one from settled earnings.</p>
      ) : (
        <>
          <div className="pb-scroll" tabIndex={0} aria-label="Payout batches table">
            <table className="pb-table">
              <thead>
                <tr>
                  <th>Batch</th>
                  <th>Period</th>
                  <th className="pb-num">Gross</th>
                  <th className="pb-num">Commission</th>
                  <th className="pb-num">Net</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => (
                  <tr key={b._id}>
                    <td className="pb-mono" title={b._id}>…{b._id.slice(-6)}</td>
                    <td>{FREQUENCY_LABEL[b.frequency ?? 'custom']} · {periodText(b)}</td>
                    <td className="pb-num">{money(b.gross)}</td>
                    <td className="pb-num">{money(b.commission)}</td>
                    <td className="pb-num">{money(b.net)}</td>
                    <td><StatusBadge status={b.status} /></td>
                    <td className="pb-actions">
                      <Link className="pb-btn pb-btn--link" to={`/admin/payouts/${encodeURIComponent(b._id)}`}>
                        View details
                      </Link>
                      <PermissionGate permission="payouts:export">
                        <button
                          type="button"
                          className="pb-btn"
                          disabled={exportingId === b._id}
                          onClick={() => void onExport(b._id)}
                        >
                          {exportingId === b._id ? 'Exporting…' : 'Export CSV'}
                        </button>
                      </PermissionGate>
                      <PermissionGate permission="payouts:approve">
                        {canConfirm(b) ? (
                          <button
                            type="button"
                            className="pb-btn pb-btn--primary"
                            disabled={!online}
                            onClick={() => setConfirmBatch(b)}
                          >
                            Confirm payout
                          </button>
                        ) : (
                          <span className="pb-muted">Paid</span>
                        )}
                      </PermissionGate>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <ConfirmDialog
        open={confirmBatch !== null}
        title="Confirm payout"
        message={
          confirmBatch
            ? `Pay ${money(confirmBatch.net)} for ${periodText(confirmBatch)}? Every unpaid partner in this batch is marked Paid and their payout amount is deducted from their wallet. This is recorded in the audit log.`
            : ''
        }
        confirmLabel="Confirm payout"
        loading={confirming}
        onConfirm={() => void onConfirm()}
        onCancel={() => setConfirmBatch(null)}
      />
    </section>
  );
};

export default PayoutBatches;
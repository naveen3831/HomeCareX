import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PermissionGate } from '@/components/admin/PermissionGate';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import {
  confirmPayoutBatch,
  downloadBatchCsv,
  fetchBatchPayouts,
  fetchPayoutBatch,
  fetchPayoutDetails,
  markPayoutPaid,
} from '@/services/payoutBatchApi';
import type { PayoutBatch, PayoutDetails, PayoutRow } from '@/types/payoutBatches';
import { apiError, canConfirm, day, FREQUENCY_LABEL, money, partnerName, periodText } from './payoutFormat';
import './batches.css';

interface PartnerBlock {
  row: PayoutRow;
  details: PayoutDetails | null;
  error: string;
}

const time = (iso: string): string =>
  new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

/** One batch: totals, every partner's payout, and the services behind each payout grouped by day. */
export const PayoutBatchDetails: React.FC = () => {
  const { id = '' } = useParams<{ id: string }>();
  const [batch, setBatch] = useState<PayoutBatch | null>(null);
  const [blocks, setBlocks] = useState<PartnerBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);

  const [confirmAll, setConfirmAll] = useState(false);
  const [confirmRow, setConfirmRow] = useState<PayoutRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
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
    try {
      const [b, rows] = await Promise.all([fetchPayoutBatch(id), fetchBatchPayouts(id)]);
      // One partner's details failing must not hide the rest of the batch.
      const settled = await Promise.all(
        rows.map(async (row): Promise<PartnerBlock> => {
          try {
            return { row, details: await fetchPayoutDetails(row._id), error: '' };
          } catch (e) {
            return { row, details: null, error: apiError(e).message };
          }
        }),
      );
      if (ticket !== latest.current) return;
      setBatch(b);
      setBlocks(settled);
    } catch (e) {
      if (ticket === latest.current) setError(apiError(e).message);
    } finally {
      if (ticket === latest.current) setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const onConfirmBatch = async () => {
    setBusy(true);
    try {
      const res = await confirmPayoutBatch(id);
      setNotice(
        res.failed.length
          ? { tone: 'err', text: `${res.confirmedCount} paid, ${res.failed.length} failed. Retry the failed ones below.` }
          : { tone: 'ok', text: `Paid ${money(res.confirmedAmount)} to ${res.confirmedCount} partner${res.confirmedCount === 1 ? '' : 's'}.` },
      );
      setConfirmAll(false);
      await load();
    } catch (e) {
      setNotice({ tone: 'err', text: apiError(e).message });
      setConfirmAll(false);
    } finally {
      setBusy(false);
    }
  };

  const onMarkPaid = async () => {
    if (!confirmRow) return;
    setBusy(true);
    try {
      await markPayoutPaid(confirmRow._id);
      setNotice({ tone: 'ok', text: `Paid ${money(confirmRow.amount)} to ${partnerName(confirmRow.partnerId)}.` });
      setConfirmRow(null);
      await load();
    } catch (e) {
      setNotice({ tone: 'err', text: apiError(e).message });
      setConfirmRow(null);
    } finally {
      setBusy(false);
    }
  };

  const onExport = async () => {
    setExporting(true);
    try {
      await downloadBatchCsv(id);
    } catch (e) {
      setNotice({ tone: 'err', text: apiError(e).message });
    } finally {
      setExporting(false);
    }
  };

  const back = (
    <Link className="pbd-back" to="/admin/payouts">
      Back to payouts
    </Link>
  );

  if (loading && !batch) {
    return (
      <section className="pb">
        {back}
        <p className="pb-state" role="status">Loading batch…</p>
      </section>
    );
  }

  if (error || !batch) {
    return (
      <section className="pb">
        {back}
        <div className="pb-state pb-state--err" role="alert">
          <p>{error || 'This payout batch was not found.'}</p>
          <button type="button" className="pb-btn" onClick={() => void load()}>Try again</button>
        </div>
      </section>
    );
  }

  const unpaid = blocks.filter((b) => b.row.status !== 'paid').length;

  return (
    <section className="pb" aria-labelledby="pbd-title">
      {back}

      <div className="pbd-title">
        <div>
          <h2 id="pbd-title">{FREQUENCY_LABEL[batch.frequency ?? 'custom']} batch · {periodText(batch)}</h2>
          <p>
            Batch <span className="pb-mono">…{batch._id.slice(-6)}</span> · <StatusBadge status={batch.status} />
          </p>
        </div>
        <div className="pbd-actions">
          <PermissionGate permission="payouts:export">
            <button type="button" className="pb-btn" disabled={exporting} onClick={() => void onExport()}>
              {exporting ? 'Exporting…' : 'Export CSV'}
            </button>
          </PermissionGate>
          <PermissionGate permission="payouts:approve">
            {canConfirm(batch) && unpaid > 0 && (
              <button
                type="button"
                className="pb-btn pb-btn--primary"
                disabled={!online}
                onClick={() => setConfirmAll(true)}
              >
                Processing payout
              </button>
            )}
          </PermissionGate>
        </div>
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

      <dl className="pbd-totals">
        <div><dt>Gross</dt><dd>{money(batch.gross)}</dd></div>
        <div><dt>Commission</dt><dd>{money(batch.commission)}</dd></div>
        <div><dt>Net to partners</dt><dd>{money(batch.net)}</dd></div>
        <div><dt>Partners</dt><dd>{blocks.length}</dd></div>
      </dl>

      <h3 className="pbd-h3">Partner payouts</h3>
      {blocks.length === 0 ? (
        <p className="pb-state">This batch has no payouts.</p>
      ) : (
        <div className="pb-scroll" tabIndex={0} aria-label="Partner payouts in this batch">
          <table className="pb-table pb-table--inner">
            <thead>
              <tr>
                <th>Partner</th>
                <th>Period</th>
                <th className="pb-num">Gross</th>
                <th className="pb-num">Commission</th>
                <th className="pb-num">Net</th>
                <th>Status</th>
                <th>Batch</th>
                <th>Paid date</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {blocks.map(({ row }) => (
                <tr key={row._id}>
                  <td>{partnerName(row.partnerId)}</td>
                  <td>{periodText(batch)}</td>
                  <td className="pb-num">{money(row.gross)}</td>
                  <td className="pb-num">{money(row.commission)}</td>
                  <td className="pb-num">{money(row.amount)}</td>
                  <td><StatusBadge status={row.status} /></td>
                  <td className="pb-mono">…{batch._id.slice(-6)}</td>
                  <td>{day(row.paidAt)}</td>
                  <td>
                    <PermissionGate permission="payouts:approve">
                      {row.status === 'paid' ? (
                        <span className="pb-muted">Paid</span>
                      ) : (
                        <button
                          type="button"
                          className="pb-btn"
                          disabled={!online}
                          onClick={() => setConfirmRow(row)}
                        >
                          Process payout
                        </button>
                      )}
                    </PermissionGate>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3 className="pbd-h3">Services by partner</h3>
      {blocks.map(({ row, details, error: detailError }) => (
        <article key={row._id} className="pbd-partner" aria-label={`Services for ${partnerName(row.partnerId)}`}>
          <div className="pbd-partner-head">
            <div>
              <h4>{partnerName(row.partnerId)}</h4>
              {details?.partner.email && <p>{details.partner.email}</p>}
            </div>
            <span>
              {details ? `${details.totals.servicesCount} service${details.totals.servicesCount === 1 ? '' : 's'} · ` : ''}
              Net {money(row.amount)}
            </span>
          </div>

          {detailError ? (
            <p className="pb-banner pb-banner--err" role="alert">{detailError}</p>
          ) : !details || details.days.length === 0 ? (
            <p className="pb-state">No service lines were saved for this payout.</p>
          ) : (
            details.days.map((d) => (
              <div key={d.date}>
                <p className="pbd-day">
                  {day(`${d.date}T00:00:00`)} · {d.servicesCount} service{d.servicesCount === 1 ? '' : 's'} · Net {money(d.net)}
                </p>
                <div className="pb-scroll" tabIndex={0} aria-label={`Services on ${d.date}`}>
                  <table className="pb-table">
                    <thead>
                      <tr>
                        <th>Service</th>
                        <th>Booking</th>
                        <th>Time</th>
                        <th className="pb-num">Gross</th>
                        <th className="pb-num">Commission</th>
                        <th className="pb-num">Net</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.services.map((s) => (
                        <tr key={s.earningId}>
                          <td>{s.serviceName}</td>
                          <td className="pb-mono">…{s.bookingId.slice(-6)}</td>
                          <td>{time(s.earnedAt)}</td>
                          <td className="pb-num">{money(s.gross)}</td>
                          <td className="pb-num">{money(s.commission)}</td>
                          <td className="pb-num">{money(s.net)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </article>
      ))}

      <ConfirmDialog
        open={confirmAll}
        title="Processing payout"
        message={`Pay ${money(batch.net)} for ${periodText(batch)}? Every unpaid partner in this batch is marked Paid and their payout amount is deducted from their wallet. This is recorded in the audit log.`}
        confirmLabel="Processing payout"
        loading={busy}
        onConfirm={() => void onConfirmBatch()}
        onCancel={() => setConfirmAll(false)}
      />
      <ConfirmDialog
        open={confirmRow !== null}
        title="Process payout"
        message={
          confirmRow
            ? `Pay ${money(confirmRow.amount)} to ${partnerName(confirmRow.partnerId)}? They will see it as Paid and the amount is deducted from their wallet. This is recorded in the audit log.`
            : ''
        }
        confirmLabel="Process payout"
        loading={busy}
        onConfirm={() => void onMarkPaid()}
        onCancel={() => setConfirmRow(null)}
      />
    </section>
  );
};

export default PayoutBatchDetails;
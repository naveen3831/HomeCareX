import React, { useCallback, useEffect, useRef, useState } from 'react';
import { fetchPayoutLedger, fetchPayoutLedgerLines } from '@/services/payoutLedgerApi';
import type {
  LedgerChannel,
  LedgerFrequency,
  LedgerLine,
  LedgerPeriod,
  LedgerReport,
} from '@/types/payoutLedger';
import './ledger.css';

const LINES_PAGE = 50;

const money = (n: number): string =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(
    Number.isFinite(n) ? n : 0,
  );

/** +₹120.00 / −₹30.00 / ₹0.00 */
const signed = (n: number): string => {
  if (!n) return money(0);
  return `${n > 0 ? '+' : '−'}${money(Math.abs(n))}`;
};

const dayDate = (ymd: string): Date => new Date(`${ymd}T00:00:00`);

const fmtDay = (ymd: string, opts: Intl.DateTimeFormatOptions): string =>
  dayDate(ymd).toLocaleDateString('en-IN', opts);

const periodLabel = (p: LedgerPeriod, frequency: LedgerFrequency): { title: string; sub: string } => {
  if (frequency === 'daily') {
    return {
      title: fmtDay(p.periodStart, { day: '2-digit', month: 'short', year: 'numeric' }),
      sub: fmtDay(p.periodStart, { weekday: 'long' }),
    };
  }
  return {
    title: `${fmtDay(p.periodStart, { day: '2-digit', month: 'short' })} – ${fmtDay(p.periodEnd, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })}`,
    sub: 'Monday to Sunday',
  };
};

const fmtTime = (iso: string): string =>
  new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

const CHANNEL: Record<LedgerChannel, { label: string; hint: string }> = {
  online: { label: 'Online', hint: 'Paid online: partner share credited, admin kept the commission' },
  upi_qr: { label: 'QR / UPI', hint: 'Customer paid the platform UPI by QR: same as an online payment' },
  cod_cash: { label: 'Cash', hint: 'Partner took the cash: admin commission was cut from the partner wallet' },
};

const errorMessage = (e: unknown): string =>
  (e as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ||
  (e as { message?: string })?.message ||
  'Something went wrong. Please try again.';

interface LinesState {
  items: LedgerLine[];
  page: number;
  pages: number;
  loading: boolean;
  error: string;
}

const keyOf = (p: LedgerPeriod): string => `${p.periodStart}_${p.periodEnd}`;

/** Credit / debit report: per day or week, what the admin received and what moved in and out of partner wallets. */
export const PayoutLedger: React.FC = () => {
  const [frequency, setFrequency] = useState<LedgerFrequency>('daily');
  const [report, setReport] = useState<LedgerReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openKey, setOpenKey] = useState('');
  const [lines, setLines] = useState<Record<string, LinesState>>({});
  const latest = useRef(0);

  const openKeyRef = useRef('');
  openKeyRef.current = openKey;

  /** `silent` = background refresh: keeps the open row and its services, only updates the numbers. */
  const load = useCallback(async (silent = false) => {
    const req = ++latest.current;
    if (!silent) {
      setLoading(true);
      setError('');
    }
    try {
      const data = await fetchPayoutLedger({ frequency });
      if (req !== latest.current) return;
      setReport(data);
      setError('');
      if (!silent) {
        setOpenKey('');
        setLines({});
      } else if (openKeyRef.current) {
        const open = data.periods.find((p) => keyOf(p) === openKeyRef.current);
        if (open) void loadLines(open, 1);
      }
    } catch (e) {
      if (req === latest.current && !silent) setError(errorMessage(e));
    } finally {
      if (req === latest.current && !silent) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frequency]);

  useEffect(() => {
    void load();
  }, [load]);

  // Live numbers without a Refresh button: update every 30 s and when the tab is opened again.
  useEffect(() => {
    const tick = () => { if (document.visibilityState === 'visible') void load(true); };
    const timer = window.setInterval(tick, 30_000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [load]);

  const loadLines = async (p: LedgerPeriod, page: number) => {
    const key = keyOf(p);
    setLines((cur) => ({
      ...cur,
      [key]: { items: cur[key]?.items ?? [], page, pages: cur[key]?.pages ?? 1, loading: true, error: '' },
    }));
    try {
      const res = await fetchPayoutLedgerLines({ from: p.periodStart, to: p.periodEnd, page, limit: LINES_PAGE });
      setLines((cur) => ({
        ...cur,
        [key]: {
          items: page === 1 ? res.items : [...(cur[key]?.items ?? []), ...res.items],
          page: res.pagination.page,
          pages: res.pagination.pages,
          loading: false,
          error: '',
        },
      }));
    } catch (e) {
      setLines((cur) => ({
        ...cur,
        [key]: { items: cur[key]?.items ?? [], page, pages: cur[key]?.pages ?? 1, loading: false, error: errorMessage(e) },
      }));
    }
  };

  const toggle = (p: LedgerPeriod) => {
    const key = keyOf(p);
    if (openKey === key) {
      setOpenKey('');
      return;
    }
    setOpenKey(key);
    if (!lines[key] || lines[key].error) void loadLines(p, 1);
  };

  const periods = report?.periods ?? [];
  // Cards show the opened day / week when a row is open, otherwise the whole report.
  const selected = periods.find((p) => keyOf(p) === openKey);
  const totals = selected ?? report?.totals;
  const scopeLabel = selected ? periodLabel(selected, frequency).title : '';
  const noun = frequency === 'daily' ? 'day' : 'week';

  return (
    <section className="pl" aria-label="Credit and debit report">
      <div className="pl-bar">
        <div className="po-tabs" role="tablist" aria-label="Report period">
          {(['daily', 'weekly'] as const).map((f) => (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={frequency === f}
              className={frequency === f ? 'is-active' : undefined}
              onClick={() => setFrequency(f)}
            >
              {f === 'daily' ? 'Daily' : 'Weekly'}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="po-alert is-error" role="alert">
          <span>{error}</span>
          <button type="button" className="po-link" onClick={() => void load()}>Retry</button>
        </div>
      )}

      <div className="pl-scope" aria-live="polite">
        {selected ? (
          <>
            Showing <b>{scopeLabel}</b> only ·{' '}
            <button type="button" className="po-link" onClick={() => setOpenKey('')}>Show overall total</button>
          </>
        ) : (
          <>Showing overall total · press a {noun} to see that {noun} only</>
        )}
      </div>

      <div className="po-strip pl-strip" aria-label={selected ? `Totals for ${scopeLabel}` : 'Totals for this report'}>
        <div>
          <span>Admin received</span>
          <strong className="pl-in">{totals ? signed(totals.adminReceived) : '—'}</strong>
          <small>Commission on {totals?.jobs ?? 0} settled service{totals?.jobs === 1 ? '' : 's'}</small>
        </div>
        <div>
          <span>Credited to partner wallets</span>
          <strong className="pl-in">{totals ? signed(totals.partnerCredited) : '—'}</strong>
          <small>Online + QR payments</small>
        </div>
        <div>
          <span>Debited from partner wallets</span>
          <strong className="pl-out">{totals ? signed(-totals.partnerDebited) : '—'}</strong>
          <small>Admin commission on cash jobs</small>
        </div>
        <div>
          <span>Partner wallets, net</span>
          <strong className={totals && totals.partnerNet < 0 ? 'pl-out' : 'pl-in'}>
            {totals ? signed(totals.partnerNet) : '—'}
          </strong>
          <small>
            {totals ? `${totals.onlineJobs} online · ${totals.qrJobs} QR · ${totals.cashJobs} cash` : ' '}
          </small>
        </div>
      </div>

      <section className="po-card" aria-busy={loading}>
        <header className="po-card-head">
          <div>
            <h2>{frequency === 'daily' ? 'Day-wise' : 'Week-wise'} credit and debit</h2>
            <p>Open a {noun} to see every service with its admin and partner amounts.</p>
          </div>
        </header>

        <div className="po-scroll">
          <table className="po-table pl-table">
            <thead>
              <tr>
                <th>{frequency === 'daily' ? 'Day' : 'Week'}</th>
                <th>Services</th>
                <th className="is-num">Admin received</th>
                <th className="is-num">Partner credited</th>
                <th className="is-num">Partner debited</th>
                <th className="is-num">Partner net</th>
              </tr>
            </thead>
            <tbody>
              {loading && !report && (
                <tr>
                  <td colSpan={6}>
                    <div className="po-state is-inline" aria-live="polite">
                      <span className="po-spinner" />
                      <p>Loading report…</p>
                    </div>
                  </td>
                </tr>
              )}

              {periods.map((p) => {
                const key = keyOf(p);
                const open = openKey === key;
                const label = periodLabel(p, frequency);
                const state = lines[key];
                return (
                  <React.Fragment key={key}>
                    <tr className={`is-clickable${open ? ' is-open' : ''}`} onClick={() => toggle(p)}>
                      <td>
                        <button
                          type="button"
                          className="pl-open"
                          aria-expanded={open}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggle(p);
                          }}
                        >
                          <span aria-hidden="true">{open ? '▾' : '▸'}</span>
                          <span className="po-week">
                            <b>{label.title}</b>
                            <small>{label.sub}</small>
                          </span>
                        </button>
                      </td>
                      <td>
                        <span className="pl-count">{p.jobs}</span>
                        <small className="pl-mix">
                          {p.onlineJobs} online · {p.qrJobs} QR · {p.cashJobs} cash
                        </small>
                      </td>
                      <td className="is-num pl-in">{signed(p.adminReceived)}</td>
                      <td className="is-num pl-in">{p.partnerCredited ? signed(p.partnerCredited) : money(0)}</td>
                      <td className="is-num pl-out">{p.partnerDebited ? signed(-p.partnerDebited) : money(0)}</td>
                      <td className={`is-num is-strong ${p.partnerNet < 0 ? 'pl-out' : 'pl-in'}`}>
                        {signed(p.partnerNet)}
                      </td>
                    </tr>

                    {open && (
                      <tr className="po-expand">
                        <td colSpan={6}>
                          {!state || (state.loading && state.items.length === 0) ? (
                            <p className="po-note">Loading services…</p>
                          ) : state.error && state.items.length === 0 ? (
                            <p className="po-note is-error" role="alert">
                              {state.error}{' '}
                              <button type="button" className="po-link" onClick={() => void loadLines(p, 1)}>Retry</button>
                            </p>
                          ) : state.items.length === 0 ? (
                            <p className="po-note">No services were settled in this {noun}.</p>
                          ) : (
                            <div className="pl-lines">
                              <table className="pl-linetable">
                                <thead>
                                  <tr>
                                    <th>Service</th>
                                    <th>Partner</th>
                                    <th>Paid by</th>
                                    <th className="is-num">Customer paid</th>
                                    <th className="is-num">Admin</th>
                                    <th className="is-num">Partner wallet</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {state.items.map((l) => (
                                    <tr key={l.earningId}>
                                      <td>
                                        <b>{l.serviceName}</b>
                                        <small>{l.bookingRef} · {fmtTime(l.settledAt)}</small>
                                      </td>
                                      <td>{l.partnerName}</td>
                                      <td>
                                        <span className={`pl-chan is-${l.channel}`} title={CHANNEL[l.channel].hint}>
                                          {CHANNEL[l.channel].label}
                                        </span>
                                      </td>
                                      <td className="is-num is-muted">{money(l.gross)}</td>
                                      <td className="is-num pl-in">{signed(l.adminAmount)}</td>
                                      <td className={`is-num ${l.partnerAmount < 0 ? 'pl-out' : 'pl-in'}`}>
                                        {signed(l.partnerAmount)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>

                              {state.error && <p className="po-note is-error" role="alert">{state.error}</p>}
                              {state.page < state.pages && (
                                <button
                                  type="button"
                                  className="po-btn is-small"
                                  disabled={state.loading}
                                  onClick={() => void loadLines(p, state.page + 1)}
                                >
                                  {state.loading ? 'Loading…' : 'Load more'}
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}

              {!loading && !error && report && periods.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    <div className="po-state is-inline">
                      <h2>Nothing settled in this range</h2>
                      <p>Services appear here after they are completed and paid, either online, by QR or in cash.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {report && (
          <footer className="po-foot">
            <span>
              {fmtDay(report.from, { day: '2-digit', month: 'short', year: 'numeric' })} –{' '}
              {fmtDay(report.to, { day: '2-digit', month: 'short', year: 'numeric' })} · {periods.length}{' '}
              {noun}
              {periods.length === 1 ? '' : 's'} with activity
            </span>
          </footer>
        )}
      </section>
    </section>
  );
};

export default PayoutLedger;

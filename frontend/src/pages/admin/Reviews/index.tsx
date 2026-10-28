import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Check, Eye, EyeOff, X, XCircle } from 'lucide-react';
import clsx from 'clsx';
import { PageHeader } from '@/components/admin/PageHeader';
import { Pagination } from '@/components/admin/Pagination';
import { usePermissions } from '@/hooks/usePermissions';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import {
  fetchAdminReviews, setReviewStatus, setReviewVisibility,
  type AdminReview, type AdminReviewsResult, type ReviewStatus,
} from '@/services/adminReviewApi';
import { formatDateTime } from '../Payments/paymentFormat';
import '../Categories/index.css';
import './index.css';

export const REVIEWS_MODERATE = 'reviews:moderate';
const PAGE_SIZE = 20;
const STATUSES: ReviewStatus[] = ['pending', 'approved', 'rejected'];
const LABEL: Record<ReviewStatus, string> = { pending: 'Pending', approved: 'Approved', rejected: 'Rejected' };
const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(Math.max(0, 5 - n));
const errText = (e: unknown) => (e as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message || (e as { message?: string })?.message || 'Something went wrong. Please try again.';

/** /admin/reviews: moderate customer reviews. Status (approve / reject) and visibility (hide / restore) are separate actions. */
export const AdminReviewsPage: React.FC = () => {
  const { can } = usePermissions();
  const canHide = can(REVIEWS_MODERATE);
  const online = useOnlineStatus();

  const [status, setStatus] = useState<ReviewStatus | ''>('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AdminReviewsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; tone: 'success' | 'error' } | null>(null);
  const timer = useRef<number>();

  const flash = useCallback((text: string, tone: 'success' | 'error' = 'success') => {
    setToast({ text, tone });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(null), 5500);
  }, []);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  useEffect(() => {
    const t = window.setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 350);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try { setData(await fetchAdminReviews({ status, search, page, limit: PAGE_SIZE })); }
    catch (e) { setError(errText(e)); }
    finally { setLoading(false); }
  }, [status, search, page]);
  useEffect(() => { void load(); }, [load]);

  async function run(r: AdminReview, job: () => Promise<void>, done: string) {
    setBusyId(r._id);
    try { await job(); flash(done); await load(); }
    catch (e) { flash(errText(e), 'error'); }
    finally { setBusyId(null); }
  }

  const reviews = data?.reviews ?? [];
  const meta = data?.pagination;
  const stats = data?.stats;
  const countOf = (s: ReviewStatus | '') => (!stats ? 0 : s === '' ? stats.total : stats[s]);

  return (
    <div className="admin-page-container cat-page">
      <PageHeader title="Reviews" description="Approve or reject customer reviews, and hide or restore them on the site." />

      {toast && (
        <div role="status" className={clsx('cat-toast', toast.tone === 'error' && 'is-error')}>
          {toast.tone === 'error' ? <XCircle size={16} /> : <CheckCircle2 size={16} />}<span>{toast.text}</span>
          <button type="button" aria-label="Dismiss" onClick={() => setToast(null)}><X size={14} /></button>
        </div>
      )}

      <div className="rvw-toolbar">
        <div className="rvw-chips" role="radiogroup" aria-label="Status">
          {(['', ...STATUSES] as const).map((s) => (
            <button key={s || 'all'} type="button" role="radio" aria-checked={status === s} className={clsx('rvw-chip', status === s && 'is-on')} onClick={() => { setStatus(s); setPage(1); }}>
              {s ? LABEL[s] : 'All'}<span>{countOf(s)}</span>
            </button>
          ))}
        </div>
        <label className="rvw-search">
          <input type="search" aria-label="Search reviews" placeholder="Search by customer name or email" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
        </label>
      </div>

      {error ? (
        <div role="alert" className="cat-alert">{error} <button type="button" className="hcx-btn" onClick={() => void load()}>Retry</button></div>
      ) : loading && !data ? (
        <div className="cat-skel" aria-label="Loading reviews">{[0, 1, 2, 3].map((n) => <span key={n} className="hcx-skeleton hcx-skeleton--block" style={{ height: 56 }} />)}</div>
      ) : reviews.length === 0 ? (
        <div className="cat-empty"><h3>{status || search ? 'No reviews match your filters' : 'No reviews yet'}</h3></div>
      ) : (
        <div className="hcx-table-card" aria-busy={loading}>
          <div className="hcx-table-scroll">
            <table className="hcx-table" aria-label="Reviews">
              <thead>
                <tr>
                  <th scope="col">Customer</th>
                  <th scope="col">Rating</th>
                  <th scope="col">Review</th>
                  <th scope="col">Partner</th>
                  <th scope="col">Status</th>
                  <th scope="col">Posted</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {reviews.map((r) => {
                  const hidden = r.visible === false;
                  const busy = busyId === r._id;
                  return (
                    <tr key={r._id} className={clsx(hidden && 'is-hidden-review')}>
                      <td>{r.customerName}{r.customerEmail && <small className="rvw-sub">{r.customerEmail}</small>}</td>
                      <td><span className="rvw-stars" aria-label={`${r.rating} out of 5`}>{stars(r.rating)}</span></td>
                      <td>
                        <div className="rvw-msg">{r.message || <em>No comment</em>}</div>
                        {!!r.tags?.length && <div className="rvw-tags">{r.tags.map((t) => <span key={t} className="rvw-tag">{t}</span>)}</div>}
                      </td>
                      <td>{r.partnerName ?? '—'}</td>
                      <td>
                        <span className={clsx('rvw-pill', `rvw-pill--${r.status}`)}>{LABEL[r.status]}</span>
                        {hidden && <> <span className="rvw-pill rvw-pill--hidden">Hidden</span></>}
                      </td>
                      <td>{formatDateTime(r.createdAt)}</td>
                      <td>
                        <div className="rvw-actions">
                          {r.status !== 'approved' && (
                            <button type="button" className="hcx-btn hcx-btn--primary" disabled={!online || busy} aria-label={`Approve review by ${r.customerName}`} onClick={() => void run(r, () => setReviewStatus(r._id, 'approved'), 'Review approved')}><Check size={14} /> Approve</button>
                          )}
                          {r.status !== 'rejected' && (
                            <button type="button" className="hcx-btn" disabled={!online || busy} aria-label={`Reject review by ${r.customerName}`} onClick={() => void run(r, () => setReviewStatus(r._id, 'rejected'), 'Review rejected')}><X size={14} /> Reject</button>
                          )}
                          {canHide && (
                            <button type="button" className="hcx-btn" disabled={!online || busy} aria-label={`${hidden ? 'Restore' : 'Hide'} review by ${r.customerName}`} onClick={() => void run(r, () => setReviewVisibility(r._id, hidden), hidden ? 'Review restored' : 'Review hidden')}>
                              {hidden ? <Eye size={14} /> : <EyeOff size={14} />} {hidden ? 'Restore' : 'Hide'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {meta && <Pagination page={meta.page} pageSize={meta.limit} total={meta.total} onPageChange={setPage} />}
        </div>
      )}
    </div>
  );
};

export default AdminReviewsPage;

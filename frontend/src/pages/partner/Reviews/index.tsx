import { useCallback, useEffect, useRef, useState } from 'react';
import RatingSummary from './RatingSummary';
import ReviewCard from './ReviewCard';
import { ReviewsApiError, fetchReviewSummary, fetchReviews } from './reviews.api';
import type { ReviewSummary, ReviewsPage } from './reviews.types';
import './reviews.css';

const PAGE_SIZE = 10;

type Load<T> = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; data: T };

const LOADING = { status: 'loading' } as const;

function errorMessage(err: unknown): string {
  if (err instanceof ReviewsApiError) {
    if (err.status === 401) return 'Your session has expired. Please sign in again.';
    if (err.status === 403) return 'You do not have access to reviews.';
    return err.message;
  }
  return 'Something went wrong while loading your reviews.';
}

const isAbort = (err: unknown): boolean => err instanceof DOMException && err.name === 'AbortError';

function useOnline(onBackOnline: () => void): boolean {
  const [online, setOnline] = useState<boolean>(() => navigator.onLine);
  useEffect(() => {
    const up = () => {
      setOnline(true);
      onBackOnline();
    };
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, [onBackOnline]);
  return online;
}

function Skeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="rv-card rv-skeleton" aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <span key={i} className="rv-skeleton-line" />
      ))}
    </div>
  );
}

function ErrorBox({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rv-card rv-state" role="alert">
      <p className="rv-state-title">Could not load reviews</p>
      <p className="rv-muted">{message}</p>
      <button type="button" className="rv-btn rv-btn-primary" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}

export default function PartnerReviewsPage() {
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [summary, setSummary] = useState<Load<ReviewSummary>>(LOADING);
  const [list, setList] = useState<Load<ReviewsPage>>(LOADING);
  const listTop = useRef<HTMLDivElement>(null);

  const reload = useCallback(() => {
    setSummary(LOADING);
    setList(LOADING);
    setReloadKey((k) => k + 1);
  }, []);

  // When the connection comes back, retry automatically instead of leaving the error on screen.
  const online = useOnline(reload);

  useEffect(() => {
    const ctrl = new AbortController();
    fetchReviewSummary(ctrl.signal).then(
      (data) => setSummary({ status: 'ready', data }),
      (err: unknown) => {
        if (!isAbort(err)) setSummary({ status: 'error', message: errorMessage(err) });
      },
    );
    return () => ctrl.abort();
  }, [reloadKey]);

  useEffect(() => {
    const ctrl = new AbortController();
    fetchReviews(page, PAGE_SIZE, ctrl.signal).then(
      (data) => setList({ status: 'ready', data }),
      (err: unknown) => {
        if (!isAbort(err)) setList({ status: 'error', message: errorMessage(err) });
      },
    );
    return () => ctrl.abort();
  }, [page, reloadKey]);

  const goTo = (next: number) => {
    setList(LOADING);
    setPage(next);
    listTop.current?.scrollIntoView({ block: 'start' });
  };

  const hasNoReviews = summary.status === 'ready' && summary.data.count === 0 && list.status === 'ready' && list.data.meta.total === 0;
  const meta = list.status === 'ready' ? list.data.meta : null;

  return (
    <div className="rv-root">
      {!online ? (
        <p className="rv-offline" role="status">
          You are offline. Reviews will refresh when you are back online.
        </p>
      ) : null}

      {hasNoReviews ? (
        <div className="rv-card rv-state">
          <p className="rv-state-title">No reviews yet</p>
          <p className="rv-muted">When customers rate your completed jobs, their reviews and your overall rating will appear here.</p>
        </div>
      ) : (
        <div className="rv-layout" aria-busy={summary.status === 'loading' || list.status === 'loading'}>
          <div className="rv-side">
            {summary.status === 'loading' ? <Skeleton lines={5} /> : null}
            {summary.status === 'error' ? <ErrorBox message={summary.message} onRetry={reload} /> : null}
            {summary.status === 'ready' ? <RatingSummary summary={summary.data} /> : null}
          </div>

          <section className="rv-main" aria-labelledby="rv-list-title">
            <div ref={listTop} className="rv-list-head">
              <h2 id="rv-list-title" className="rv-eyebrow">
                Customer reviews{meta ? ` (${meta.total})` : ''}
              </h2>
            </div>

            {list.status === 'loading' ? (
              <>
                <Skeleton />
                <Skeleton />
                <Skeleton />
              </>
            ) : null}
            {list.status === 'error' ? <ErrorBox message={list.message} onRetry={reload} /> : null}
            {list.status === 'ready' ? (
              <>
                <div className="rv-list">
                  {list.data.reviews.map((r) => (
                    <ReviewCard key={r.id} review={r} />
                  ))}
                </div>
                {list.data.meta.totalPages > 1 ? (
                  <nav className="rv-pager" aria-label="Reviews pages">
                    <button type="button" className="rv-btn" disabled={page <= 1} onClick={() => goTo(page - 1)}>
                      Previous
                    </button>
                    <span className="rv-muted" aria-live="polite">
                      Page {list.data.meta.page} of {list.data.meta.totalPages}
                    </span>
                    <button type="button" className="rv-btn" disabled={page >= list.data.meta.totalPages} onClick={() => goTo(page + 1)}>
                      Next
                    </button>
                  </nav>
                ) : null}
              </>
            ) : null}
          </section>
        </div>
      )}
    </div>
  );
}
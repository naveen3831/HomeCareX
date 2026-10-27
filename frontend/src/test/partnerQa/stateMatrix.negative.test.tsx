import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import * as wallet from '@/pages/partner/Wallet/wallet.api';
import * as tx from '@/pages/partner/Transactions/transactions.api';
import * as rv from '@/pages/partner/Reviews/reviews.api';
import * as sup from '@/pages/partner/Support/support.api';
import * as perf from '@/pages/partner/Performance/performance.api';
import * as avail from '@/pages/partner/Availability/availability.api';
import * as sched from '@/pages/partner/Schedule/schedule.api';
import * as bo from '@/pages/partner/BlackoutDates/blackout.api';
import { incentivesApi } from '@/services/incentivesApi';
import { payoutsApi } from '@/services/payoutsApi';
import { settingsApi } from '@/pages/partner/Settings/settings.api';
import Wallet from '@/pages/partner/Wallet';
import Transactions from '@/pages/partner/Transactions';
import Reviews from '@/pages/partner/Reviews';
import Support from '@/pages/partner/Support';
import Performance from '@/pages/partner/Performance';
import Incentives from '@/pages/partner/Incentives';
import Payouts from '@/pages/partner/Payouts';
import Availability from '@/pages/partner/Availability';
import Schedule from '@/pages/partner/Schedule';
import BlackoutDates from '@/pages/partner/BlackoutDates';
import WorkingHours from '@/pages/partner/WorkingHours';
import Settings from '@/pages/partner/Settings';
import { Route, Routes } from 'react-router-dom';
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'p1', name: 'Test Partner', role: 'partner' }, logout: vi.fn() }) }));
import { networkError, pending, renderPage, serverError, setOnline } from './helpers';

type Spy = ReturnType<typeof vi.spyOn>;
interface PageCase {
  name: string;
  el: () => ReactElement;
  /** Make the page's data call(s) behave as given; returns the spy that should be called again on retry. */
  mock: (impl: 'reject-server' | 'reject-network' | 'pending' | 'empty') => Spy;
  emptyText?: RegExp;
  /** Pages with no retry button on error (they show the message only). */
  noRetry?: boolean;
}

const rej = (kind: string) => (kind === 'reject-network' ? networkError() : serverError());

const PAGES: PageCase[] = [
  {
    name: 'Wallet',
    el: () => <Wallet />,
    emptyText: /no transactions yet/i,
    mock: (k) => {
      const s = vi.spyOn(wallet, 'getWalletSummary');
      if (k === 'pending') s.mockReturnValue(pending());
      else if (k === 'empty') s.mockResolvedValue({ available: 0, pending: 0, currency: 'INR', recent: [] });
      else s.mockRejectedValue(rej(k));
      return s;
    },
  },
  {
    name: 'Transactions',
    el: () => <Transactions />,
    emptyText: /no transactions yet/i,
    mock: (k) => {
      const s = vi.spyOn(tx, 'getTransactions');
      if (k === 'pending') s.mockReturnValue(pending());
      else if (k === 'empty') s.mockResolvedValue({ items: [], total: 0, page: 1, limit: 8 });
      else s.mockRejectedValue(rej(k));
      return s;
    },
  },
  {
    name: 'Reviews',
    el: () => <Reviews />,
    emptyText: /no reviews yet/i,
    mock: (k) => {
      const a = vi.spyOn(rv, 'fetchReviewSummary');
      const b = vi.spyOn(rv, 'fetchReviews');
      if (k === 'pending') { a.mockReturnValue(pending()); b.mockReturnValue(pending()); }
      else if (k === 'empty') {
        a.mockResolvedValue({ average: 0, count: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } } as never);
        b.mockResolvedValue({ reviews: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0 } } as never);
      } else { a.mockRejectedValue(rej(k)); b.mockRejectedValue(rej(k)); }
      return b;
    },
  },
  {
    name: 'Support',
    el: () => <Support />,
    emptyText: /no tickets yet/i,
    mock: (k) => {
      const s = vi.spyOn(sup, 'listTickets');
      if (k === 'pending') s.mockReturnValue(pending());
      else if (k === 'empty') s.mockResolvedValue([]);
      else s.mockRejectedValue(rej(k));
      return s;
    },
  },
  {
    name: 'Performance',
    el: () => <Performance />,
    mock: (k) => {
      const a = vi.spyOn(perf, 'fetchPerformance');
      const b = vi.spyOn(perf, 'fetchTrends');
      if (k === 'pending') { a.mockReturnValue(pending()); b.mockReturnValue(pending()); }
      else { a.mockRejectedValue(rej(k)); b.mockRejectedValue(rej(k)); }
      return a;
    },
  },
  {
    name: 'Incentives',
    el: () => <Incentives />,
    mock: (k) => {
      const s = vi.spyOn(incentivesApi, 'getList');
      if (k === 'pending') s.mockReturnValue(pending());
      else if (k === 'empty')
        s.mockResolvedValue({ currency: 'INR', active: [], upcoming: [], completed: [], expired: [], summary: { totalEarned: 0, activeCount: 0, potential: 0 } } as never);
      else s.mockRejectedValue(rej(k));
      return s;
    },
  },
  {
    name: 'Payouts',
    el: () => <Payouts />,
    emptyText: /no payouts yet/i,
    mock: (k) => {
      const s = vi.spyOn(payoutsApi, 'list');
      if (k === 'pending') s.mockReturnValue(pending());
      else if (k === 'empty') s.mockResolvedValue({ currency: 'INR', next: null, history: [] });
      else s.mockRejectedValue(rej(k));
      return s;
    },
  },
  {
    name: 'Availability',
    el: () => <Availability />,
    mock: (k) => {
      vi.spyOn(sched, 'getSchedule').mockRejectedValue(rej(k));
      const s = vi.spyOn(avail, 'getAvailability');
      if (k === 'pending') s.mockReturnValue(pending());
      else s.mockRejectedValue(rej(k));
      return s;
    },
  },
  {
    name: 'WorkingHours',
    el: () => <WorkingHours />,
    mock: (k) => {
      const s = vi.spyOn(avail, 'getAvailability');
      if (k === 'pending') s.mockReturnValue(pending());
      else s.mockRejectedValue(rej(k));
      return s;
    },
  },
  {
    name: 'Schedule',
    el: () => <Schedule />,
    mock: (k) => {
      const s = vi.spyOn(sched, 'getSchedule');
      if (k === 'pending') s.mockReturnValue(pending());
      else s.mockRejectedValue(rej(k));
      return s;
    },
  },
  {
    name: 'BlackoutDates',
    el: () => <BlackoutDates />,
    emptyText: /nothing blocked off yet/i,
    mock: (k) => {
      const s = vi.spyOn(bo, 'listBlackouts');
      if (k === 'pending') s.mockReturnValue(pending() as never);
      else if (k === 'empty') s.mockResolvedValue([] as never);
      else s.mockRejectedValue(rej(k));
      return s;
    },
  },
  {
    name: 'Settings',
    el: () => <Routes><Route path="/partner/settings/:section" element={<Settings />} /></Routes>,
    mock: (k) => {
      const s = vi.spyOn(settingsApi, 'get');
      if (k === 'pending') s.mockReturnValue(pending());
      else s.mockRejectedValue(rej(k));
      return s;
    },
  },
];

beforeEach(() => setOnline(true));
afterEach(() => { vi.restoreAllMocks(); setOnline(true); });

describe.each(PAGES)('$name states', (p) => {
  it('shows a loading state, not an error or crash, while the request is pending', () => {
    p.mock('pending');
    renderPage(p.el(), p.name === 'Settings' ? '/partner/settings/notifications' : '/');
    expect(screen.queryByText(/try again/i)).toBeNull();
    expect(document.body.textContent).not.toMatch(/Request failed|Network Error/);
  });

  it('shows a readable error with a working retry on a 500', async () => {
    const spy = p.mock('reject-server');
    renderPage(p.el(), p.name === 'Settings' ? '/partner/settings/notifications' : '/');
    const retry = await screen.findAllByRole('button', { name: /try again|retry/i });
    expect(document.body.textContent).not.toMatch(/at .*\.tsx?:\d+|stack|TypeError|undefined/i);
    const calls = spy.mock.calls.length;
    await userEvent.click(retry[0]);
    await waitFor(() => expect(spy.mock.calls.length).toBeGreaterThan(calls));
  });

  it('does not leave a blank screen when the network is down and the browser is offline', async () => {
    setOnline(false);
    p.mock('reject-network');
    renderPage(p.el(), p.name === 'Settings' ? '/partner/settings/notifications' : '/');
    await waitFor(() => expect(screen.queryAllByText(/offline|connection|internet|try again|couldn.t|could not/i).length).toBeGreaterThan(0));
  });

  if (p.emptyText) {
    it('shows an empty state for an empty response', async () => {
      p.mock('empty');
      renderPage(p.el(), p.name === 'Settings' ? '/partner/settings/notifications' : '/');
      expect((await screen.findAllByText(p.emptyText!)).length).toBeGreaterThan(0);
    });
  }
});

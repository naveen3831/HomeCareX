import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as wallet from '@/pages/partner/Wallet/wallet.api';
import * as tx from '@/pages/partner/Transactions/transactions.api';
import * as rv from '@/pages/partner/Reviews/reviews.api';
import * as sup from '@/pages/partner/Support/support.api';
import { payoutsApi } from '@/services/payoutsApi';
import Wallet from '@/pages/partner/Wallet';
import Transactions from '@/pages/partner/Transactions';
import Reviews from '@/pages/partner/Reviews';
import Support from '@/pages/partner/Support';
import Payouts from '@/pages/partner/Payouts';
import { renderPage } from './helpers';

/** jsdom has no layout, so a width is simulated through matchMedia (min/max-width) and innerWidth. */
function setViewport(width: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  window.matchMedia = ((query: string) => {
    const min = /min-width:\s*(\d+)px/.exec(query);
    const max = /max-width:\s*(\d+)px/.exec(query);
    const matches = (!min || width >= +min[1]) && (!max || width <= +max[1]);
    return { matches, media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false } as unknown as MediaQueryList;
  }) as typeof window.matchMedia;
}

const pages = [
  { name: 'Wallet', el: <Wallet />, mock: () => vi.spyOn(wallet, 'getWalletSummary').mockResolvedValue({ available: 0, pending: 0, currency: 'INR', recent: [] }), ready: /no transactions yet/i },
  { name: 'Transactions', el: <Transactions />, mock: () => vi.spyOn(tx, 'getTransactions').mockResolvedValue({ items: [], total: 0, page: 1, limit: 8 }), ready: /no transactions yet/i },
  { name: 'Reviews', el: <Reviews />, mock: () => { vi.spyOn(rv, 'fetchReviewSummary').mockResolvedValue({ average: 0, count: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } } as never); vi.spyOn(rv, 'fetchReviews').mockResolvedValue({ reviews: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0 } } as never); }, ready: /no reviews yet/i },
  { name: 'Support', el: <Support />, mock: () => vi.spyOn(sup, 'listTickets').mockResolvedValue([]), ready: /no tickets yet/i },
  { name: 'Payouts', el: <Payouts />, mock: () => vi.spyOn(payoutsApi, 'list').mockResolvedValue({ currency: 'INR', next: null, history: [] }), ready: /no payouts yet/i },
];

afterEach(() => vi.restoreAllMocks());

describe.each([360, 768, 1280])('viewport %ipx', (width) => {
  describe.each(pages)('$name', (p) => {
    it('renders its empty state and is reachable by keyboard', async () => {
      setViewport(width);
      p.mock();
      const { container } = renderPage(p.el);
      expect((await screen.findAllByText(p.ready)).length).toBeGreaterThan(0);
      // An empty state with nothing interactive has nothing to focus, which is fine.
      if (!container.querySelector('a[href], button:not([disabled]), input:not([disabled]), select, textarea')) return;
      await userEvent.tab();
      const active = document.activeElement as HTMLElement;
      expect(active).not.toBe(document.body);
      // Focused control must be nameable for screen readers.
      const name = active.getAttribute('aria-label') || active.textContent || active.getAttribute('title') || (active as HTMLInputElement).placeholder;
      expect((name ?? '').trim().length).toBeGreaterThan(0);
    });
  });
});

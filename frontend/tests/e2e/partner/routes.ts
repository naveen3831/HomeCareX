/** Every partner page in scope for Day 18, with text that proves the real page (not an error page) rendered. */
export interface PartnerRoute {
  path: string;
  name: string;
  group: 'ops' | 'finance' | 'support' | 'settings';
  /** Any one of these must be visible once the page has loaded. */
  expects: RegExp;
}

export const PARTNER_ROUTES: PartnerRoute[] = [
  { path: '/partner/availability', name: 'Availability', group: 'ops', expects: /availability|online|offline/i },
  { path: '/partner/working-hours', name: 'Working hours', group: 'ops', expects: /working hours/i },
  { path: '/partner/blackout-dates', name: 'Blackout dates', group: 'ops', expects: /blackout dates/i },
  { path: '/partner/schedule', name: 'Schedule', group: 'ops', expects: /schedule|calendar/i },
  { path: '/partner/earnings', name: 'Earnings', group: 'finance', expects: /earnings/i },
  { path: '/partner/incentives', name: 'Incentives', group: 'finance', expects: /incentives/i },
  { path: '/partner/payouts', name: 'Payouts', group: 'finance', expects: /payout/i },
  { path: '/partner/wallet', name: 'Wallet', group: 'finance', expects: /wallet|balance/i },
  { path: '/partner/transactions', name: 'Transactions', group: 'finance', expects: /transaction/i },
  { path: '/partner/performance', name: 'Performance', group: 'ops', expects: /performance|rating/i },
  { path: '/partner/reviews', name: 'Reviews', group: 'ops', expects: /reviews/i },
  { path: '/partner/support', name: 'Support', group: 'support', expects: /support|tickets/i },
  { path: '/partner/help', name: 'Help', group: 'support', expects: /help/i },
  { path: '/partner/safety', name: 'Safety', group: 'support', expects: /safety|emergency/i },
  { path: '/partner/settings', name: 'Settings', group: 'settings', expects: /settings|notifications|account/i },
];

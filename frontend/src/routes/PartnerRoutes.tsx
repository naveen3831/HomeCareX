import React, { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';

import PartnerLayout from '../layouts/PartnerLayout';
import PageLoader from '@/components/common/PageLoader';

import '../styles/calm-overrides.css';
import '../styles/mobile-plain.css';

// Lazy-load partner pages
const PartnerDashboard = lazy(() => import('../pages/partner/Dashboard'));
const PartnerJobsPage = lazy(() => import('../pages/partner/Jobs'));
const PartnerAvailabilityPage = lazy(() => import('../pages/partner/Availability'));
const PartnerWorkingHoursPage = lazy(() => import('../pages/partner/WorkingHours'));
const PartnerBlackoutDatesPage = lazy(() => import('../pages/partner/BlackoutDates'));
const PartnerSchedulePage = lazy(() => import('../pages/partner/Schedule'));
const PartnerEarningsPage = lazy(() => import('../pages/partner/Earnings'));
const PartnerIncentivesPage = lazy(() => import('../pages/partner/Incentives'));
const PartnerPayoutsPage = lazy(() => import('../pages/partner/Payouts'));
const PartnerWalletPage = lazy(() => import('../pages/partner/Wallet'));
const PartnerTransactionsPage = lazy(() => import('../pages/partner/Transactions'));
const ProfileMenu = lazy(() => import('../components/partner/ProfileMenu'));

const Placeholder: React.FC<{ title: string }> = ({ title }) => (
  <div className="rounded border border-dashed border-line bg-panel p-8 text-center">
    <h2 className="text-lg font-semibold text-brand">{title}</h2>
    <p className="mt-1 text-sm text-muted">This page is coming soon.</p>
  </div>
);

export const PARTNER_PAGES: { path: string; title: string }[] = [
  { path: 'work', title: 'Work' },
  { path: 'work/requests', title: 'Job requests' },
  { path: 'work/active', title: 'Active job' },
  { path: 'work/today', title: "Today's jobs" },
  { path: 'work/completed', title: 'Completed jobs' },
  { path: 'work/cancelled', title: 'Cancelled jobs' },
  { path: 'work/:jobId', title: 'Job details' },

  { path: 'services', title: 'Services' },
  { path: 'services/categories', title: 'My categories' },
  { path: 'services/radius', title: 'Service radius' },
  { path: 'services/training', title: 'Training & certifications' },

  { path: 'earnings/payouts', title: 'Payout history' },
  { path: 'earnings/statements', title: 'Earnings statements' },
  { path: 'earnings/bank-details', title: 'Bank / UPI details' },

  { path: 'performance', title: 'Performance' },
  { path: 'performance/reviews', title: 'Customer reviews' },
  { path: 'performance/improvement', title: 'Improvement tips' },

  { path: 'profile', title: 'Profile' },
  { path: 'profile/edit', title: 'Edit profile' },
  { path: 'profile/documents', title: 'Documents' },
  { path: 'profile/verification', title: 'Verification status' },
  { path: 'profile/preferences', title: 'Preferences' },

  { path: 'support', title: 'Support' },
  { path: 'support/tickets', title: 'My tickets' },
  { path: 'support/tickets/new', title: 'Raise a ticket' },
  { path: 'support/tickets/:ticketId', title: 'Ticket details' },
  { path: 'support/safety', title: 'Safety & SOS' },

  { path: 'system', title: 'System settings' },
  { path: 'system/notifications', title: 'Notification settings' },
];

export default function PartnerRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route element={<PartnerLayout />}>
          <Route index element={<PartnerDashboard />} />

          {/* Availability */}
          <Route path="availability" element={<PartnerAvailabilityPage />} />
          <Route path="working-hours" element={<PartnerWorkingHoursPage />} />
          <Route path="availability/hours" element={<PartnerWorkingHoursPage />} />
          <Route path="blackout-dates" element={<PartnerBlackoutDatesPage />} />
          <Route path="availability/blackout-dates" element={<PartnerBlackoutDatesPage />} />
          <Route path="schedule" element={<PartnerSchedulePage />} />

          {/* Earnings */}
          <Route path="earnings" element={<PartnerEarningsPage />} />
          <Route path="incentives" element={<PartnerIncentivesPage />} />
          <Route path="earnings/incentives" element={<PartnerIncentivesPage />} />
          <Route path="payouts" element={<PartnerPayoutsPage />} />
          <Route path="earnings/payouts" element={<PartnerPayoutsPage />} />

          {/* Wallet and transactions */}
          <Route path="wallet" element={<PartnerWalletPage />} />
          <Route path="transactions" element={<PartnerTransactionsPage />} />

          {/* Jobs */}
          <Route path="jobs" element={<PartnerJobsPage />} />
          <Route path="jobs/requests" element={<PartnerJobsPage />} />

          {/* Placeholder pages */}
          {PARTNER_PAGES
            .filter(({ path }) => path !== 'earnings/payouts')
            .map(({ path, title }) => (
              <Route
                key={path}
                path={path}
                element={
                  path === 'profile' ? (
                    <ProfileMenu />
                  ) : (
                    <Placeholder title={title} />
                  )
                }
              />
            ))}

          <Route
            path="*"
            element={<Placeholder title="Page not found" />}
          />
        </Route>
      </Routes>
    </Suspense>
  );
}
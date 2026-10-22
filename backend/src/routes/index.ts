import { Router } from 'express';

import paymentRoutes from '../modules/payments/payments.routes';
import walletRoutes from '../modules/wallet/wallet.routes';

import { authRoutes } from '../modules/auth/auth.routes';
import { auditRoutes } from '../modules/audit/audit.routes';
import { adminRoutes } from '../modules/admin/admin.routes';
import { partnersRoutes } from '../modules/partners/partners.routes';
import { availabilityRoutes } from '../modules/availability/availability.routes';
import { blackoutRoutes } from '../modules/availability/blackout.routes';
import { scheduleRoutes } from '../modules/availability/schedule.routes';
import { partnerDashboardRoutes } from '../modules/partners/partner-dashboard.routes';
import { earningsRoutes } from '../modules/earnings/earnings.routes';
import { adminDashboardRoutes } from '../modules/admin-dashboard/admin-dashboard.routes';
import { settingsRoutes } from '../modules/settings/settings.routes';
import { designationsRoutes } from '../modules/designations/designations.routes';
import { notificationsRoutes } from '../modules/notifications/notifications.routes';
import { categoriesRoutes } from '../modules/categories/categories.routes';
import { servicesRoutes } from '../modules/services/services.routes';
import { catalogRoutes } from '../modules/catalog/catalog.routes';
import { incentivesRoutes } from '../modules/incentives/incentives.routes';
import { adminCustomersRoutes } from '../modules/admin-customers/admin-customers.routes';
import leadsRoutes from '../modules/leads/leads.routes';
import { bookingsRoutes } from '../modules/bookings/bookings.routes';
import customerDashboardRoutes from '../modules/customer-dashboard/customer-dashboard.routes';
import { addressesRoutes } from '../modules/addresses/addresses.routes';
import { reviewsRoutes } from '../modules/reviews/reviews.routes';


import {
  couponsRoutes,
  couponCustomerRoutes,
} from '../modules/coupons/coupons.routes';

import {
  marketingRoutes,
  publicMarketingRoutes,
} from '../modules/marketing/marketing.routes';

import refundsRoutes from '../modules/refunds/refunds.routes';
import partnerWalletRoutes, { partnerWalletSummaryRoutes } from '../modules/partner-wallet/partner-wallet.routes';

export const rootRouter = Router();

// Routes are registered under /api/v1.
// Add new modules here; don't replace the list.

rootRouter.use('/auth', authRoutes);

rootRouter.use(
  '/admin/dashboard',
  adminDashboardRoutes,
); // GET /admin/dashboard/summary, /trends

rootRouter.use(
  '/admin/settings',
  settingsRoutes,
); // GET /admin/settings, PUT /admin/settings/:key

rootRouter.use(
  '/admin/designations',
  designationsRoutes,
); // GET, POST, PATCH /:id, DELETE /:id

rootRouter.use(
  '/admin/categories',
  categoriesRoutes,
); // GET, POST, PATCH /:id, DELETE /:id

rootRouter.use(
  '/admin/services',
  servicesRoutes,
); // GET, GET /:id, POST, PATCH /:id, DELETE /:id

rootRouter.use(
  catalogRoutes,
); // PUBLIC: GET /categories, GET /services?q&category&rating&minPrice&maxPrice&duration&availability&sort&page&limit, GET /services/:idOrSlug

rootRouter.use(
  '/notifications',
  notificationsRoutes,
); // GET /notifications, PATCH /:id/read, PATCH /read-all

rootRouter.use(
  '/admin',
  auditRoutes,
); // GET /admin/audit-logs

rootRouter.use(
  '/admin',
  adminRoutes,
); // GET /admin/bookings

rootRouter.use(
  '/admin/partners',
  partnersRoutes,
); // GET /admin/partners, GET /admin/partners/stats, POST /admin/partners

// =========================================================
// Refunds
// =========================================================

// GET    /api/v1/admin/refunds
// POST   /api/v1/admin/refunds
// PATCH  /api/v1/admin/refunds/:id

rootRouter.use(
  '/admin',
  refundsRoutes,
);

rootRouter.use(
  '/partner/dashboard',
  partnerDashboardRoutes,
);

rootRouter.use(
  '/customer/dashboard',
  customerDashboardRoutes,
); // GET /customer/dashboard

rootRouter.use(
  '/partner/availability',
  availabilityRoutes,
);

rootRouter.use(
  '/partner/blackout-dates',
  blackoutRoutes,
); // GET, POST, PATCH, DELETE /partner/blackout-dates

rootRouter.use(
  '/partner/schedule',
  scheduleRoutes,
); // GET /partner/schedule

rootRouter.use(
  leadsRoutes,
); // POST /public/leads

rootRouter.use(
  bookingsRoutes,
); // GET /services/:id/slots, POST /bookings/check-slot, POST /bookings, GET /bookings/:id

rootRouter.use(
  '/partner/earnings',
  earningsRoutes,
); // GET /partner/earnings/summary

rootRouter.use(
  '/partner/transactions',
  partnerWalletRoutes,
); // GET /partner/transactions ?type&from&to&page&limit

rootRouter.use(
  '/partner/wallet',
  partnerWalletSummaryRoutes,
} from "../modules/partner-wallet/partner-wallet.routes";
import { partnerPerformanceRoutes } from "../modules/partner-performance/partner-performance.routes";
import { partnerReviewsRoutes } from "../modules/partner-reviews/partner-reviews.routes";
import { partnerTicketsRoutes } from "../modules/partner-tickets/partner-tickets.routes";
import { partnerSettingsRoutes } from "../modules/partner-settings/partner-settings.routes";
import {
  partnerServiceAreaRoutes,
  partnerServicesRoutes,
} from "../modules/partner-services/partner-services.routes";
import paymentRoutes from "../modules/payments/payments.routes";
import {
  adminPricingRoutes,
  pricingRoutes,
} from "../modules/pricing/pricing.routes";
import payoutsRoutes from "../modules/payouts/payouts.routes";
import { reportsRoutes } from "../modules/reports/reports.routes";
import refundsRoutes from "../modules/refunds/refunds.routes";
import { reviewsRoutes } from "../modules/reviews/reviews.routes";
import { servicesRoutes } from "../modules/services/services.routes";
import { settingsRoutes } from "../modules/settings/settings.routes";
import { ticketsRoutes } from "../modules/tickets/tickets.routes";
import { referralsRoutes } from "../modules/referrals/referrals.routes";
import walletRoutes from "../modules/wallet/wallet.routes";

rootRouter.use(
  '/addresses',
  addressesRoutes,
); // GET/POST /addresses, GET /addresses/serviceability

rootRouter.use(
  '/payments',
  paymentRoutes,
); // GET /payments, POST /payments/order, /cod, /verify, /attempt, /webhook (public, HMAC)

rootRouter.use(
  '/wallet',
  walletRoutes,
); // GET /wallet

rootRouter.use("/auth", authRoutes);

rootRouter.use("/admin/dashboard", adminDashboardRoutes);
rootRouter.use("/admin/settings", settingsRoutes);
rootRouter.use("/admin/designations", designationsRoutes);
rootRouter.use("/admin/categories", categoriesRoutes);
rootRouter.use("/admin/services", servicesRoutes);
rootRouter.use("/admin/customers", adminCustomersRoutes);
rootRouter.use("/admin/payments", adminPaymentsRoutes);
rootRouter.use("/admin/tickets", adminTicketsRoutes);
rootRouter.use("/admin/ticket-assignees", adminStaffRoutes);
rootRouter.use("/admin/partners", partnersRoutes);
rootRouter.use("/admin/coupons", couponsRoutes);
rootRouter.use("/admin/banners", marketingRoutes);
rootRouter.use("/admin/pricing", adminPricingRoutes);
rootRouter.use("/admin/incentives", incentivesRoutes);

rootRouter.use("/admin", payoutsRoutes);
rootRouter.use("/admin", refundsRoutes);
rootRouter.use("/admin", auditRoutes);
rootRouter.use("/admin", adminRoutes);

// Admin reports and CSV exports.
rootRouter.use("/admin/reports", reportsRoutes);

rootRouter.use(catalogRoutes);
rootRouter.use("/notifications", notificationsRoutes);
rootRouter.use("/partner/notifications", notificationsRoutes);
rootRouter.use("/customer/notifications", customerNotificationsRoutes);
rootRouter.use("/banners", publicMarketingRoutes);
rootRouter.use("/serviceability", serviceabilityRoutes);
rootRouter.use("/pricing", pricingRoutes);
rootRouter.use(leadsRoutes);

rootRouter.use("/customer/dashboard", customerDashboardRoutes);
rootRouter.use("/customer/profile", customerProfileRoutes);
rootRouter.use("/customer/preferences", customerPreferencesRoutes);
rootRouter.use("/addresses", addressesRoutes);
rootRouter.use("/payments", paymentRoutes);
rootRouter.use("/wallet", walletRoutes);
rootRouter.use("/tickets", ticketsRoutes);
rootRouter.use("/referrals", referralsRoutes);
rootRouter.use("/coupons", couponCustomerRoutes);

rootRouter.use("/partner/dashboard", partnerDashboardRoutes);
rootRouter.use("/partner/availability", availabilityRoutes);
rootRouter.use("/partner/blackout-dates", blackoutRoutes);
rootRouter.use("/partner/schedule", scheduleRoutes);
rootRouter.use("/partner/earnings", earningsRoutes);
rootRouter.use("/partner/transactions", partnerWalletRoutes);
rootRouter.use("/partner/wallet", partnerWalletSummaryRoutes);
rootRouter.use("/partner/incentives", incentivesRoutes);
rootRouter.use("/partner/services", partnerServicesRoutes);
rootRouter.use("/partner/service-area", partnerServiceAreaRoutes);
rootRouter.use("/partner/performance", partnerPerformanceRoutes);
rootRouter.use("/partner/reviews", partnerReviewsRoutes);
rootRouter.use("/partner/support/tickets", partnerTicketsRoutes);
rootRouter.use("/partner/settings", partnerSettingsRoutes);
rootRouter.use("/partner/jobs", partnerJobsRoutes);
rootRouter.use("/partner/job-requests", partnerJobRequestsRoutes);
rootRouter.use("/partner/jobs", maskedCallRoutes);
rootRouter.use("/partner/jobs", partnerLocationRoutes);

rootRouter.use(bookingsRoutes);
rootRouter.use("/bookings", bookingStatusRoutes);
rootRouter.use("/bookings", chatRoutes);
rootRouter.use(reviewsRoutes);

export default rootRouter;

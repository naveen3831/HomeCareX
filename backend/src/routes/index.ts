import { Router } from "express";


import paymentRoutes from "../modules/payments/payments.routes";
import walletRoutes from "../modules/wallet/wallet.routes";

import {
  customerPreferencesRoutes,
  customerProfileRoutes,
} from "../modules/customer-profile/customer-profile.routes";

import {
  partnerWalletRoutes,
  partnerWalletSummaryRoutes,
} from '../modules/partner-wallet/partner-wallet.routes';
import { pricingRoutes, adminPricingRoutes } from '../modules/pricing/pricing.routes';
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
import customerNotificationsRoutes from '../modules/notifications/customer-notifications.routes';
import { categoriesRoutes } from '../modules/categories/categories.routes';
import { servicesRoutes } from '../modules/services/services.routes';
import { catalogRoutes } from '../modules/catalog/catalog.routes';
import { incentivesRoutes } from '../modules/incentives/incentives.routes';
import { adminCustomersRoutes } from '../modules/admin-customers/admin-customers.routes';
import { adminPaymentsRoutes } from '../modules/admin-payments/admin-payments.routes';
import {
  adminStaffRoutes,
  adminTicketsRoutes,
} from '../modules/admin-tickets/admin-tickets.routes';
import leadsRoutes from '../modules/leads/leads.routes';
import { bookingsRoutes } from '../modules/bookings/bookings.routes';
import customerDashboardRoutes from '../modules/customer-dashboard/customer-dashboard.routes';
import {
  addressesRoutes,
  serviceabilityRoutes,
} from '../modules/addresses/addresses.routes';
import {
  partnerJobsRoutes,
  partnerJobRequestsRoutes,
  bookingStatusRoutes,
} from "../modules/partner-jobs/partner-jobs.routes";

import { maskedCallRoutes } from "../modules/masked-call/masked-call.routes";
import { partnerLocationRoutes } from "../modules/partner-location/partner-location.routes";

import {
  couponsRoutes,
  couponCustomerRoutes,
} from "../modules/coupons/coupons.routes";

import {
  marketingRoutes,
  publicMarketingRoutes,
} from "../modules/marketing/marketing.routes";

import {
  pricingRoutes,
  adminPricingRoutes,
} from "../modules/pricing/pricing.routes";

import refundsRoutes from "../modules/refunds/refunds.routes";
import reviewsRoutes from "../modules/reviews/reviews.routes";
// TODO: chatRoutes import add cheyyandi (mee branch lo path), e.g.
// import chatRoutes from "../modules/chat/chat.routes";

import {partnerReviewsRoutes} from "../modules/partner-reviews/partner-reviews.routes";
export const rootRouter = Router();

// Routes are registered under /api/v1.
// Add new modules here; don't replace the list.

// Authentication
rootRouter.use("/auth", authRoutes);

// Admin dashboard, settings, designations
rootRouter.use("/admin/dashboard", adminDashboardRoutes);
rootRouter.use("/admin/settings", settingsRoutes);
rootRouter.use("/admin/designations", designationsRoutes);

rootRouter.use(catalogRoutes);

// Notifications
rootRouter.use("/notifications", notificationsRoutes);
rootRouter.use("/partner/notifications", notificationsRoutes);
// Customer notifications page (customers only, own rows only)
rootRouter.use("/customer/notifications", customerNotificationsRoutes);

// Admin support queue (GET /admin/tickets, PATCH /admin/tickets/:id/assign)
rootRouter.use("/admin/tickets", adminTicketsRoutes);
// Assignee picker (GET /admin/staff?assignable=true). Must sit before the generic /admin mounts.
rootRouter.use("/admin/staff", adminStaffRoutes);

// Admin partners
rootRouter.use("/admin/partners", partnersRoutes);

// Admin finance and marketing
rootRouter.use("/admin/coupons", couponsRoutes);
rootRouter.use("/admin/banners", marketingRoutes);
rootRouter.use("/admin/pricing", adminPricingRoutes);
rootRouter.use("/admin/incentives", incentivesRoutes);

// Refunds
rootRouter.use("/admin", refundsRoutes);

// Admin audit logs and general admin routes
rootRouter.use("/admin", auditRoutes);
rootRouter.use("/admin", adminRoutes);

// Public routes
rootRouter.use(leadsRoutes);
rootRouter.use("/banners", publicMarketingRoutes);
rootRouter.use("/serviceability", serviceabilityRoutes);

// Pricing quote API (POST /api/v1/pricing/quote)
rootRouter.use("/pricing", pricingRoutes);

// Customer dashboard, profile, preferences
rootRouter.use("/customer/dashboard", customerDashboardRoutes);
rootRouter.use("/customer/profile", customerProfileRoutes);
rootRouter.use("/customer/preferences", customerPreferencesRoutes);

// Customer addresses, wallet, coupons, payments
rootRouter.use("/addresses", addressesRoutes);
rootRouter.use("/wallet", walletRoutes);
rootRouter.use("/coupons", couponCustomerRoutes);
rootRouter.use("/payments", paymentRoutes);

// Bookings
rootRouter.use(bookingsRoutes);

// Partner dashboard and availability
rootRouter.use("/partner/dashboard", partnerDashboardRoutes);
rootRouter.use("/partner/availability", availabilityRoutes);
rootRouter.use("/partner/blackout-dates", blackoutRoutes);
rootRouter.use("/partner/schedule", scheduleRoutes);

// Partner earnings and wallets
rootRouter.use("/partner/earnings", earningsRoutes);
rootRouter.use("/partner/transactions", partnerWalletRoutes);
rootRouter.use("/partner/wallet", partnerWalletSummaryRoutes);

// Partner jobs, masked calls, location
rootRouter.use("/partner/jobs", partnerJobsRoutes);
rootRouter.use("/partner/job-requests", partnerJobRequestsRoutes);
rootRouter.use("/partner/jobs", maskedCallRoutes);
rootRouter.use("/partner/jobs", partnerLocationRoutes);

// Booking status routes
rootRouter.use("/bookings", bookingStatusRoutes);

// Booking chat (customer <-> assigned partner)
// rootRouter.use("/bookings", chatRoutes);

// Reviews. The router carries its own full paths (/bookings/:id/review, /reviews, /reviews/pending,
// /services/:id/reviews, /admin/reviews), so it is mounted at the root.
rootRouter.use(reviewsRoutes);

export default rootRouter;

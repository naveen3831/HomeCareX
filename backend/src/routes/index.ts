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
} from "../modules/partner-wallet/partner-wallet.routes";

import { authRoutes } from "../modules/auth/auth.routes";
import { auditRoutes } from "../modules/audit/audit.routes";
import { adminRoutes } from "../modules/admin/admin.routes";
import { partnersRoutes } from "../modules/partners/partners.routes";
import { availabilityRoutes } from "../modules/availability/availability.routes";
import { blackoutRoutes } from "../modules/availability/blackout.routes";
import { scheduleRoutes } from "../modules/availability/schedule.routes";
import { partnerDashboardRoutes } from "../modules/partners/partner-dashboard.routes";
import { earningsRoutes } from "../modules/earnings/earnings.routes";
import { adminDashboardRoutes } from "../modules/admin-dashboard/admin-dashboard.routes";
import { settingsRoutes } from "../modules/settings/settings.routes";
import { designationsRoutes } from "../modules/designations/designations.routes";
import { notificationsRoutes } from "../modules/notifications/notifications.routes";
import customerNotificationsRoutes from "../modules/notifications/customer-notifications.routes";
import { categoriesRoutes } from "../modules/categories/categories.routes";
import { servicesRoutes } from "../modules/services/services.routes";
import { catalogRoutes } from "../modules/catalog/catalog.routes";
import { incentivesRoutes } from "../modules/incentives/incentives.routes";
import { adminCustomersRoutes } from "../modules/admin-customers/admin-customers.routes";
import { adminPaymentsRoutes } from "../modules/admin-payments/admin-payments.routes";
import { adminStaffRoutes, adminTicketsRoutes } from "../modules/admin-tickets/admin-tickets.routes";

import leadsRoutes from "../modules/leads/leads.routes";
import { bookingsRoutes } from "../modules/bookings/bookings.routes";
import customerDashboardRoutes from "../modules/customer-dashboard/customer-dashboard.routes";

import {
  addressesRoutes,
  serviceabilityRoutes,
} from "../modules/addresses/addresses.routes";

import {
  partnerJobsRoutes,
  partnerJobRequestsRoutes,
  bookingStatusRoutes,
} from "../modules/partner-jobs/partner-jobs.routes";

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
import {
  customerProfileRoutes,
  customerPreferencesRoutes,
} from "../modules/customer-profile/customer-profile.routes";
import reviewsRoutes from "../modules/reviews/reviews.routes";

export const rootRouter = Router();

// Routes are registered under /api/v1.
// Add new modules here; don't replace the list.

rootRouter.use("/auth", authRoutes);

// Admin dashboard
rootRouter.use("/admin/dashboard", adminDashboardRoutes);

// Admin settings
rootRouter.use("/admin/settings", settingsRoutes);

// Admin designations
rootRouter.use("/admin/designations", designationsRoutes);

// Admin categories
rootRouter.use("/admin/categories", categoriesRoutes);

// Admin services
rootRouter.use("/admin/services", servicesRoutes);

// Public catalog routes
rootRouter.use(catalogRoutes);

// Notifications
rootRouter.use("/notifications", notificationsRoutes);
// Customer notifications page: GET / PATCH /:id/read / PATCH /read-all (customers only, own rows only)
rootRouter.use("/customer/notifications", customerNotificationsRoutes);

// Admin support queue (GET /admin/tickets, PATCH /admin/tickets/:id/assign)
rootRouter.use("/admin/tickets", adminTicketsRoutes);

// Assignee picker for the support queue (GET /admin/staff?assignable=true). Must sit before the generic /admin mounts.
rootRouter.use("/admin/staff", adminStaffRoutes);

// Admin audit logs
rootRouter.use("/admin", auditRoutes);

// Admin routes
rootRouter.use("/admin", adminRoutes);

// Admin partners
rootRouter.use("/admin/partners", partnersRoutes);

// Refunds
rootRouter.use("/admin", refundsRoutes);

// Partner dashboard
rootRouter.use("/partner/dashboard", partnerDashboardRoutes);

// Customer dashboard
rootRouter.use("/customer/dashboard", customerDashboardRoutes);
rootRouter.use("/customer/profile", customerProfileRoutes);

// Customer preferences: GET/PATCH /customer/preferences
rootRouter.use("/customer/preferences", customerPreferencesRoutes);
// Serviceability
rootRouter.use("/serviceability", serviceabilityRoutes);

// Partner availability
rootRouter.use("/partner/availability", availabilityRoutes);

// Partner blackout dates
rootRouter.use("/partner/blackout-dates", blackoutRoutes);

// Partner schedule
rootRouter.use("/partner/schedule", scheduleRoutes);

// Public leads
rootRouter.use(leadsRoutes);

// Booking and service-slot routes
rootRouter.use(bookingsRoutes);

// Partner earnings
rootRouter.use("/partner/earnings", earningsRoutes);

// Partner transactions
rootRouter.use("/partner/transactions", partnerWalletRoutes);

// Partner wallet summary
rootRouter.use("/partner/wallet", partnerWalletSummaryRoutes);

// Customer addresses
rootRouter.use("/addresses", addressesRoutes);

// Payment APIs and webhooks
rootRouter.use("/payments", paymentRoutes);

// =========================================================
// Pricing
// =========================================================

// GET / PUT / DELETE /api/v1/admin/pricing (admin + pricing:manage)
rootRouter.use(
  '/admin/pricing',
  adminPricingRoutes,
);

// POST /api/v1/pricing/quote
rootRouter.use(
  '/pricing',
  pricingRoutes,
);

// =========================================================
// Coupons
// =========================================================

// Admin coupon CRUD
rootRouter.use("/admin/coupons", couponsRoutes);

// Customer coupon APIs
rootRouter.use("/coupons", couponCustomerRoutes);

// Admin banner CRUD
rootRouter.use("/admin/banners", marketingRoutes);

// Public banners
rootRouter.use("/banners", publicMarketingRoutes);

// Pricing
rootRouter.use("/pricing", pricingRoutes);
rootRouter.use("/admin/pricing", adminPricingRoutes);

// Partner jobs
rootRouter.use("/partner/jobs", partnerJobsRoutes);
rootRouter.use("/partner/job-requests", partnerJobRequestsRoutes);
rootRouter.use("/partner/jobs", maskedCallRoutes);
rootRouter.use("/partner/jobs", partnerLocationRoutes);
rootRouter.use("/partner/job-requests", partnerJobRequestsRoutes);
rootRouter.use("/partner/notifications", notificationsRoutes);

// Booking status routes
rootRouter.use("/bookings", bookingStatusRoutes);
// Reviews. The router carries its own full paths (/bookings/:id/review, /reviews, /reviews/pending,
// /services/:id/reviews, /admin/reviews), so it is mounted at the root, like the booking and leads routers.
rootRouter.use(reviewsRoutes);

export default rootRouter;
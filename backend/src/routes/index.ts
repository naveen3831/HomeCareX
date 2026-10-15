
import { Router } from "express";

import paymentRoutes from "../modules/payments/payments.routes";

import {
  customerPreferencesRoutes,
  customerProfileRoutes,
} from "../modules/customer-profile/customer-profile.routes";

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

import {
  adminStaffRoutes,
  adminTicketsRoutes,
} from "../modules/admin-tickets/admin-tickets.routes";

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

// Authentication
// Routes are registered under /api/v1.
// Add new modules here; don't replace the list.

rootRouter.use("/auth", authRoutes);

// Admin dashboard and settings
rootRouter.use("/admin/dashboard", adminDashboardRoutes);
rootRouter.use("/admin/settings", settingsRoutes);
rootRouter.use("/admin/designations", designationsRoutes);

// Admin catalog
rootRouter.use("/admin/categories", categoriesRoutes);
rootRouter.use("/admin/services", servicesRoutes);
rootRouter.use("/admin/customers", adminCustomersRoutes);
rootRouter.use("/admin/payments", adminPaymentsRoutes);

// Public catalog routes
rootRouter.use(catalogRoutes);

// Notifications
rootRouter.use("/notifications", notificationsRoutes);
// Customer notifications page: GET / PATCH /:id/read / PATCH /read-all (customers only, own rows only)
rootRouter.use("/customer/notifications", customerNotificationsRoutes);

// Admin support
rootRouter.use("/admin/tickets", adminTicketsRoutes);
rootRouter.use("/admin/staff", adminStaffRoutes);
rootRouter.use("/admin/partners", partnersRoutes);

// Admin finance and marketing
rootRouter.use("/admin/coupons", couponsRoutes);
rootRouter.use("/admin/banners", marketingRoutes);
rootRouter.use("/admin/pricing", adminPricingRoutes);
rootRouter.use("/admin", refundsRoutes);

// Admin audit and general endpoints
rootRouter.use("/admin", auditRoutes);
rootRouter.use("/admin", adminRoutes);

// Public catalog
rootRouter.use(catalogRoutes);

// Pricing quote API
rootRouter.use("/pricing", pricingRoutes);
rootRouter.use("/admin/pricing", adminPricingRoutes);

// Notifications
rootRouter.use("/notifications", notificationsRoutes);
rootRouter.use("/partner/notifications", notificationsRoutes);
// Admin partners
rootRouter.use("/admin/partners", partnersRoutes);

// Refunds
rootRouter.use("/admin", refundsRoutes);

// Public routes
rootRouter.use(leadsRoutes);
rootRouter.use("/banners", publicMarketingRoutes);
rootRouter.use("/pricing", pricingRoutes);
rootRouter.use("/serviceability", serviceabilityRoutes);

// Customer dashboard and profile
rootRouter.use("/customer/dashboard", customerDashboardRoutes);
rootRouter.use("/customer/profile", customerProfileRoutes);
rootRouter.use("/customer/preferences", customerPreferencesRoutes);

// Customer addresses, wallet, coupons and payments
rootRouter.use("/addresses", addressesRoutes);
rootRouter.use("/wallet", walletRoutes);
rootRouter.use("/coupons", couponCustomerRoutes);
rootRouter.use("/payments", paymentRoutes);

// Customer preferences: GET/PATCH /customer/preferences
rootRouter.use("/customer/preferences", customerPreferencesRoutes);
// Serviceability
rootRouter.use("/serviceability", serviceabilityRoutes);

// Bookings and reviews
rootRouter.use(bookingsRoutes);
rootRouter.use("/bookings", bookingStatusRoutes);
rootRouter.use(reviewsRoutes);

// Partner dashboard and availability
rootRouter.use("/partner/dashboard", partnerDashboardRoutes);
rootRouter.use("/partner/availability", availabilityRoutes);
rootRouter.use("/partner/blackout-dates", blackoutRoutes);
rootRouter.use("/partner/schedule", scheduleRoutes);

// Partner earnings and wallets
rootRouter.use("/partner/earnings", earningsRoutes);
rootRouter.use("/partner/transactions", partnerWalletRoutes);
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

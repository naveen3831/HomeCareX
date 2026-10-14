import { Router } from "express";

import paymentRoutes from "../modules/payments/payments.routes";

import {
  partnerWalletRoutes,
  partnerWalletSummaryRoutes,
} from "../modules/partner-wallet/partner-wallet.routes";

import {
  pricingRoutes,
  adminPricingRoutes,
} from "../modules/pricing/pricing.routes";

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
import { categoriesRoutes } from "../modules/categories/categories.routes";
import { servicesRoutes } from "../modules/services/services.routes";
import { catalogRoutes } from "../modules/catalog/catalog.routes";
import { incentivesRoutes } from "../modules/incentives/incentives.routes";
import { adminCustomersRoutes } from "../modules/admin-customers/admin-customers.routes";
import { adminPaymentsRoutes } from "../modules/admin-payments/admin-payments.routes";

import leadsRoutes from "../modules/leads/leads.routes";
import { bookingsRoutes } from "../modules/bookings/bookings.routes";
import customerDashboardRoutes from "../modules/customer-dashboard/customer-dashboard.routes";

import {
  addressesRoutes,
  serviceabilityRoutes,
} from "../modules/addresses/addresses.routes";

import { reviewsRoutes } from "../modules/reviews/reviews.routes";

import {
  partnerJobsRoutes,
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

import refundsRoutes from "../modules/refunds/refunds.routes";
import { chatRoutes } from "../modules/chat/chat.routes";
import { partnerLocationRoutes } from "../modules/partner-location/partner-location.routes";
import { maskedCallRoutes } from "../modules/masked-call/masked-call.routes";

export const rootRouter = Router();

// Routes are registered under /api/v1.
// Add new modules here; don't replace the list.

// Authentication
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

// Public catalog
rootRouter.use(catalogRoutes);

// Notifications
rootRouter.use("/notifications", notificationsRoutes);

// Admin customers (GET /admin/customers, GET /admin/customers/:id ...)
rootRouter.use("/admin/customers", adminCustomersRoutes);

// Admin payments (read-only: GET /admin/payments)
rootRouter.use("/admin/payments", adminPaymentsRoutes);

// Admin audit logs
rootRouter.use("/admin", auditRoutes);

// Admin routes
rootRouter.use("/admin", adminRoutes);

// Admin partners
rootRouter.use("/admin/partners", partnersRoutes);

// =========================================================
// Refunds
// =========================================================

// GET   /api/v1/admin/refunds
// POST  /api/v1/admin/refunds
// PATCH /api/v1/admin/refunds/:id
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

// Partner incentives
rootRouter.use("/partner/incentives", incentivesRoutes);

// Customer addresses
rootRouter.use("/addresses", addressesRoutes);

// Payments and webhooks
rootRouter.use("/payments", paymentRoutes);

// Customer wallet
rootRouter.use("/wallet", walletRoutes);

// Reviews
rootRouter.use(reviewsRoutes);

// Partner incentives
rootRouter.use("/partner/incentives", incentivesRoutes);

// Admin customers
rootRouter.use("/admin/customers", adminCustomersRoutes);

// =========================================================
// Coupons
// =========================================================

// Admin coupon CRUD
rootRouter.use("/admin/coupons", couponsRoutes);

// Customer coupon APIs
rootRouter.use("/coupons", couponCustomerRoutes);

// =========================================================
// Marketing & Banners
// =========================================================

// Admin banner CRUD
rootRouter.use("/admin/banners", marketingRoutes);

// Public banners
rootRouter.use("/banners", publicMarketingRoutes);

// Partner jobs
rootRouter.use("/partner/jobs", partnerJobsRoutes);
rootRouter.use("/partner/jobs", maskedCallRoutes);
rootRouter.use("/partner/jobs", partnerLocationRoutes);

// Booking status
rootRouter.use("/bookings", bookingStatusRoutes);

// Booking chat (customer <-> assigned partner)
rootRouter.use("/bookings", chatRoutes);

export default rootRouter;

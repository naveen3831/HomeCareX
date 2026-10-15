import { Router } from "express";
 
import paymentRoutes from "../modules/payments/payments.routes";
<<<<<<< Updated upstream
import walletRoutes from "../modules/wallet/wallet.routes";

=======
 
import {
  customerPreferencesRoutes,
  customerProfileRoutes,
} from "../modules/customer-profile/customer-profile.routes";
 
>>>>>>> Stashed changes
import {
  partnerWalletRoutes,
  partnerWalletSummaryRoutes,
} from "../modules/partner-wallet/partner-wallet.routes";
<<<<<<< Updated upstream

import {
  pricingRoutes,
  adminPricingRoutes,
} from "../modules/pricing/pricing.routes";

=======
 
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
import { incentivesRoutes } from "../modules/incentives/incentives.routes";
import { adminCustomersRoutes } from "../modules/admin-customers/admin-customers.routes";
import { adminPaymentsRoutes } from "../modules/admin-payments/admin-payments.routes";
import { adminStaffRoutes, adminTicketsRoutes } from "../modules/admin-tickets/admin-tickets.routes";

=======
 
import { adminStaffRoutes, adminTicketsRoutes } from "../modules/admin-tickets/admin-tickets.routes";
 
>>>>>>> Stashed changes
import leadsRoutes from "../modules/leads/leads.routes";
import { bookingsRoutes } from "../modules/bookings/bookings.routes";
import customerDashboardRoutes from "../modules/customer-dashboard/customer-dashboard.routes";
 
import {
  addressesRoutes,
  serviceabilityRoutes,
} from "../modules/addresses/addresses.routes";
<<<<<<< Updated upstream

import { reviewsRoutes } from "../modules/reviews/reviews.routes";

=======
 
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream

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

// =========================================================
=======
 
import {
  pricingRoutes,
  adminPricingRoutes,
} from "../modules/pricing/pricing.routes";
 
import refundsRoutes from "../modules/refunds/refunds.routes";
 
import reviewsRoutes from "../modules/reviews/reviews.routes";
import partnerLocationRoutes from "../modules/partner-location/partner-location.routes";
import maskedCallRoutes from "../modules/masked-call/masked-call.routes";
 
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
 
>>>>>>> Stashed changes
// Refunds
// =========================================================

// GET   /api/v1/admin/refunds
// POST  /api/v1/admin/refunds
// PATCH /api/v1/admin/refunds/:id
rootRouter.use("/admin", refundsRoutes);
<<<<<<< Updated upstream

// Partner dashboard
rootRouter.use("/partner/dashboard", partnerDashboardRoutes);

// Customer dashboard
rootRouter.use("/customer/dashboard", customerDashboardRoutes);

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

=======
 
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
 
>>>>>>> Stashed changes
// =========================================================
// Coupons
// =========================================================
 
// Admin coupon CRUD
rootRouter.use("/admin/coupons", couponsRoutes);
 
// Customer coupon APIs
rootRouter.use("/coupons", couponCustomerRoutes);
<<<<<<< Updated upstream

// =========================================================
// Marketing & Banners
// =========================================================

=======
 
>>>>>>> Stashed changes
// Admin banner CRUD
rootRouter.use("/admin/banners", marketingRoutes);
 
// Public banners
rootRouter.use("/banners", publicMarketingRoutes);
<<<<<<< Updated upstream

=======
 
// Pricing
rootRouter.use("/pricing", pricingRoutes);
rootRouter.use("/admin/pricing", adminPricingRoutes);
 
>>>>>>> Stashed changes
// Partner jobs
rootRouter.use("/partner/jobs", partnerJobsRoutes);
rootRouter.use("/partner/jobs", maskedCallRoutes);
rootRouter.use("/partner/jobs", partnerLocationRoutes);
<<<<<<< Updated upstream

// Booking status
rootRouter.use("/bookings", bookingStatusRoutes);

// Booking chat (customer <-> assigned partner)
rootRouter.use("/bookings", chatRoutes);

=======
rootRouter.use("/partner/job-requests", partnerJobRequestsRoutes);
rootRouter.use("/partner/notifications", notificationsRoutes);
 
// Booking status routes
rootRouter.use("/bookings", bookingStatusRoutes);
// Reviews. The router carries its own full paths (/bookings/:id/review, /reviews, /reviews/pending,
// /services/:id/reviews, /admin/reviews), so it is mounted at the root, like the booking and leads routers.
rootRouter.use(reviewsRoutes);
 
>>>>>>> Stashed changes
export default rootRouter;
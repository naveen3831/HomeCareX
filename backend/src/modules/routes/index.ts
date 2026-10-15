import { Router } from "express";

import paymentRoutes from "../payments/payments.routes";
import walletRoutes from "../wallet/wallet.routes";

import {
  partnerWalletRoutes,
  partnerWalletSummaryRoutes,
} from "../partner-wallet/partner-wallet.routes";

import {
  pricingRoutes,
  adminPricingRoutes,
} from "../pricing/pricing.routes";

import { authRoutes } from "../auth/auth.routes";
import { auditRoutes } from "../audit/audit.routes";
import { adminRoutes } from "../admin/admin.routes";
import { partnersRoutes } from "../partners/partners.routes";
import { availabilityRoutes } from "../availability/availability.routes";
import { blackoutRoutes } from "../availability/blackout.routes";
import { scheduleRoutes } from "../availability/schedule.routes";
import { partnerDashboardRoutes } from "../partners/partner-dashboard.routes";
import { earningsRoutes } from "../earnings/earnings.routes";
import { adminDashboardRoutes } from "../admin-dashboard/admin-dashboard.routes";
import { settingsRoutes } from "../settings/settings.routes";
import { designationsRoutes } from "../designations/designations.routes";
import { notificationsRoutes } from "../notifications/notifications.routes";
import { categoriesRoutes } from "../categories/categories.routes";
import { servicesRoutes } from "../services/services.routes";
import { catalogRoutes } from "../catalog/catalog.routes";
import { incentivesRoutes } from "../incentives/incentives.routes";
import { adminCustomersRoutes } from "../admin-customers/admin-customers.routes";
import { adminPaymentsRoutes } from "../admin-payments/admin-payments.routes";
import {
  adminStaffRoutes,
  adminTicketsRoutes,
} from "../admin-tickets/admin-tickets.routes";

import leadsRoutes from "../leads/leads.routes";
import { bookingsRoutes } from "../bookings/bookings.routes";
import customerDashboardRoutes from "../customer-dashboard/customer-dashboard.routes";

import {
  addressesRoutes,
  serviceabilityRoutes,
} from "../addresses/addresses.routes";

import { reviewsRoutes } from "../reviews/reviews.routes";

import {
  partnerJobsRoutes,
  bookingStatusRoutes,
} from "../partner-jobs/partner-jobs.routes";

import {
  couponsRoutes,
  couponCustomerRoutes,
} from "../coupons/coupons.routes";

import {
  marketingRoutes,
  publicMarketingRoutes,
} from "../marketing/marketing.routes";

import refundsRoutes from "../refunds/refunds.routes";
import { chatRoutes } from "../chat/chat.routes";
import { partnerLocationRoutes } from "../partner-location/partner-location.routes";
import { maskedCallRoutes } from "../masked-call/masked-call.routes";

// B06 - Admin payouts
import payoutsRoutes from "../payouts/payouts.routes";

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

// Admin customers
rootRouter.use("/admin/customers", adminCustomersRoutes);

// Admin payments
rootRouter.use("/admin/payments", adminPaymentsRoutes);

// Admin support queue
rootRouter.use("/admin/tickets", adminTicketsRoutes);

// Assignee picker for the support queue.
// Keep this before generic /admin mounts.
rootRouter.use("/admin/staff", adminStaffRoutes);

// Admin audit logs
rootRouter.use("/admin", auditRoutes);

// Admin payouts (B06)
// Provides /api/v1/admin/payouts
rootRouter.use("/admin", payoutsRoutes);

// Admin routes
rootRouter.use("/admin", adminRoutes);

// Admin partners
rootRouter.use("/admin/partners", partnersRoutes);

// Refunds
// GET   /api/v1/admin/refunds
// POST  /api/v1/admin/refunds
// PATCH /api/v1/admin/refunds/:id
rootRouter.use("/admin", refundsRoutes);

// Pricing routes
rootRouter.use("/pricing", pricingRoutes);
rootRouter.use("/admin/pricing", adminPricingRoutes);

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

// Coupons
rootRouter.use("/admin/coupons", couponsRoutes);
rootRouter.use("/coupons", couponCustomerRoutes);

// Marketing and banners
rootRouter.use("/admin/banners", marketingRoutes);
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
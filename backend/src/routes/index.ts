import { Router } from "express";

// Payments and wallet
import paymentRoutes from "../modules/payments/payments.routes";
import walletRoutes from "../modules/wallet/wallet.routes";

// Customer profile
import {
  customerPreferencesRoutes,
  customerProfileRoutes,
} from "../modules/customer-profile/customer-profile.routes";

// Partner wallet
import {
  partnerWalletRoutes,
  partnerWalletSummaryRoutes,
} from "../modules/partner-wallet/partner-wallet.routes";

// Authentication, audit and administration
import { authRoutes } from "../modules/auth/auth.routes";
import { auditRoutes } from "../modules/audit/audit.routes";
import { adminRoutes } from "../modules/admin/admin.routes";
import { adminDashboardRoutes } from "../modules/admin-dashboard/admin-dashboard.routes";
import { adminCustomersRoutes } from "../modules/admin-customers/admin-customers.routes";
import { adminPaymentsRoutes } from "../modules/admin-payments/admin-payments.routes";
import {
  adminStaffRoutes,
  adminTicketsRoutes,
} from "../modules/admin-tickets/admin-tickets.routes";

// Partners
import { partnersRoutes } from "../modules/partners/partners.routes";
import { partnerDashboardRoutes } from "../modules/partners/partner-dashboard.routes";
import { partnerLocationRoutes } from "../modules/partner-location/partner-location.routes";
import { partnerJobsRoutes, partnerJobRequestsRoutes } from "../modules/partner-jobs/partner-jobs.routes";
import { maskedCallRoutes } from "../modules/masked-call/masked-call.routes";

// Availability and scheduling
import { availabilityRoutes } from "../modules/availability/availability.routes";
import { blackoutRoutes } from "../modules/availability/blackout.routes";
import { scheduleRoutes } from "../modules/availability/schedule.routes";

// Earnings and payouts
import { earningsRoutes } from "../modules/earnings/earnings.routes";
import payoutsRoutes from "../modules/payouts/payouts.routes";

// Settings and designations
import { settingsRoutes } from "../modules/settings/settings.routes";
import { designationsRoutes } from "../modules/designations/designations.routes";

// Notifications
import { notificationsRoutes } from "../modules/notifications/notifications.routes";
import customerNotificationsRoutes from "../modules/notifications/customer-notifications.routes";

// Catalog and services
import { categoriesRoutes } from "../modules/categories/categories.routes";
import { servicesRoutes } from "../modules/services/services.routes";
import { catalogRoutes } from "../modules/catalog/catalog.routes";

// Incentives
import { incentivesRoutes } from "../modules/incentives/incentives.routes";

// Leads and bookings
import leadsRoutes from "../modules/leads/leads.routes";
import { bookingsRoutes } from "../modules/bookings/bookings.routes";
import customerDashboardRoutes from "../modules/customer-dashboard/customer-dashboard.routes";
import { bookingStatusRoutes } from "../modules/partner-jobs/partner-jobs.routes";

// Addresses
import {
  addressesRoutes,
  serviceabilityRoutes,
} from "../modules/addresses/addresses.routes";

// Coupons
import {
  couponsRoutes,
  couponCustomerRoutes,
} from "../modules/coupons/coupons.routes";

// Marketing
import {
  marketingRoutes,
  publicMarketingRoutes,
} from "../modules/marketing/marketing.routes";

// Pricing
import {
  pricingRoutes,
  adminPricingRoutes,
} from "../modules/pricing/pricing.routes";

// Refunds and reviews
import refundsRoutes from "../modules/refunds/refunds.routes";
import reviewsRoutes from "../modules/reviews/reviews.routes";

export const rootRouter = Router();

// =========================================================
// Authentication
// =========================================================

rootRouter.use("/auth", authRoutes);

// =========================================================
// Admin dashboard, settings and designations
// =========================================================

rootRouter.use("/admin/dashboard", adminDashboardRoutes);
rootRouter.use("/admin/settings", settingsRoutes);
rootRouter.use("/admin/designations", designationsRoutes);

// =========================================================
// Admin management
// =========================================================

rootRouter.use("/admin", adminRoutes);
rootRouter.use("/admin", auditRoutes);
rootRouter.use("/admin/partners", partnersRoutes);
rootRouter.use("/admin/customers", adminCustomersRoutes);
rootRouter.use("/admin/payments", adminPaymentsRoutes);
rootRouter.use("/admin/tickets", adminTicketsRoutes);
rootRouter.use("/admin/staff", adminStaffRoutes);

// =========================================================
// Admin catalog, pricing and marketing
// =========================================================

rootRouter.use("/admin/categories", categoriesRoutes);
rootRouter.use("/admin/services", servicesRoutes);
rootRouter.use("/admin/pricing", adminPricingRoutes);
rootRouter.use("/admin/coupons", couponsRoutes);
rootRouter.use("/admin/banners", marketingRoutes);
rootRouter.use("/admin/incentives", incentivesRoutes);

// =========================================================
// Admin refunds and payouts
// =========================================================

rootRouter.use("/admin", refundsRoutes);
rootRouter.use("/admin", payoutsRoutes);

// =========================================================
// Public catalog and marketing
// =========================================================

rootRouter.use(catalogRoutes);
rootRouter.use("/banners", publicMarketingRoutes);
rootRouter.use("/pricing", pricingRoutes);
rootRouter.use("/serviceability", serviceabilityRoutes);
rootRouter.use(leadsRoutes);

// =========================================================
// Notifications
// =========================================================

rootRouter.use("/notifications", notificationsRoutes);
rootRouter.use("/customer/notifications", customerNotificationsRoutes);
rootRouter.use("/partner/notifications", notificationsRoutes);

// =========================================================
// Customer dashboard and profile
// =========================================================

rootRouter.use("/customer/dashboard", customerDashboardRoutes);
rootRouter.use("/customer/profile", customerProfileRoutes);
rootRouter.use("/customer/preferences", customerPreferencesRoutes);

// =========================================================
// Customer addresses, wallet, coupons and payments
// =========================================================

rootRouter.use("/addresses", addressesRoutes);
rootRouter.use("/wallet", walletRoutes);
rootRouter.use("/coupons", couponCustomerRoutes);
rootRouter.use("/payments", paymentRoutes);

// =========================================================
// Bookings and reviews
// =========================================================

rootRouter.use(bookingsRoutes);
rootRouter.use("/bookings", bookingStatusRoutes);
rootRouter.use(reviewsRoutes);

// =========================================================
// Partner dashboard and availability
// =========================================================

rootRouter.use("/partner/dashboard", partnerDashboardRoutes);
rootRouter.use("/partner/availability", availabilityRoutes);
rootRouter.use("/partner/blackout-dates", blackoutRoutes);
rootRouter.use("/partner/schedule", scheduleRoutes);

// =========================================================
// Partner earnings and wallet
// =========================================================

rootRouter.use("/partner/earnings", earningsRoutes);
rootRouter.use("/partner/transactions", partnerWalletRoutes);
rootRouter.use("/partner/wallet", partnerWalletSummaryRoutes);

// =========================================================
// Partner jobs, masked calls and location
// =========================================================

rootRouter.use("/partner/jobs", partnerJobsRoutes);
rootRouter.use("/partner/job-requests", partnerJobRequestsRoutes);
rootRouter.use("/partner/jobs", maskedCallRoutes);
rootRouter.use("/partner/jobs", partnerLocationRoutes);

export default rootRouter;

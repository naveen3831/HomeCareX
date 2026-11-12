
import { Router } from "express";

import { authMiddleware } from "../middleware/auth.middleware";
import { requireTrainingApproved } from "../modules/partner-onboarding/partner-onboarding.middleware";
import { requireAdmin } from "../middleware/role.middleware";
import { requirePermission, requireResourceAccess } from "../middleware/permission.middleware";

import { authRoutes } from "../modules/auth/auth.routes";
import { adminRoutes } from "../modules/admin/admin.routes";
import { adminCustomersRoutes } from "../modules/admin-customers/admin-customers.routes";
import { adminDashboardRoutes } from "../modules/admin-dashboard/admin-dashboard.routes";
import { adminPaymentsRoutes } from "../modules/admin-payments/admin-payments.routes";
import {
  adminStaffRoutes,
  adminTicketsRoutes,
} from "../modules/admin-tickets/admin-tickets.routes";
import { auditRoutes } from "../modules/audit/audit.routes";
import { categoriesRoutes } from "../modules/categories/categories.routes";
import {
  couponCustomerRoutes,
  couponsRoutes,
} from "../modules/coupons/coupons.routes";
import { designationsRoutes } from "../modules/designations/designations.routes";
import { incentivesRoutes } from "../modules/incentives/incentives.routes";

import {
  marketingRoutes,
  publicMarketingRoutes,
} from "../modules/marketing/marketing.routes";
import { partnersRoutes } from "../modules/partners/partners.routes";
import { payoutsRoutes } from "../modules/payouts/payouts.routes";
import {
  adminWithdrawalsRoutes,
  partnerWithdrawalsRoutes,
} from "../modules/partner-withdrawals/partner-withdrawals.routes";
import {
  adminPricingRoutes,
  pricingRoutes,
} from "../modules/pricing/pricing.routes";
import refundsRoutes from "../modules/refunds/refunds.routes";
import { reportsRoutes } from "../modules/reports/reports.routes";
import { servicesRoutes } from "../modules/services/services.routes";
import { settingsRoutes } from "../modules/settings/settings.routes";
import { publicSettingsRoutes } from "../modules/settings/settings.public.routes";
import { catalogRoutes } from "../modules/catalog/catalog.routes";
import leadsRoutes from "../modules/leads/leads.routes";
import { adminLeadsRoutes } from "../modules/leads/admin-leads.routes";
import {
  addressesRoutes,
  serviceabilityRoutes,
} from "../modules/addresses/addresses.routes";
import { bookingsRoutes } from "../modules/bookings/bookings.routes";
import { chatRoutes } from "../modules/chat/chat.routes";
import paymentRoutes from "../modules/payments/payments.routes";
import { reviewsRoutes } from "../modules/reviews/reviews.routes";
import walletRoutes from "../modules/wallet/wallet.routes";
import customerNotificationsRoutes from "../modules/notifications/customer-notifications.routes";
import { notificationsRoutes } from "../modules/notifications/notifications.routes";
import customerDashboardRoutes from "../modules/customer-dashboard/customer-dashboard.routes";
import {
  customerPreferencesRoutes,
  customerProfileRoutes,
} from "../modules/customer-profile/customer-profile.routes";
import { referralsRoutes } from "../modules/referrals/referrals.routes";
import { referralProgramsRoutes } from "../modules/referrals/referral-programs.routes";
import { ticketsRoutes } from "../modules/tickets/tickets.routes";
import { availabilityRoutes } from "../modules/availability/availability.routes";
import { blackoutRoutes } from "../modules/availability/blackout.routes";
import { scheduleRoutes } from "../modules/availability/schedule.routes";
import { earningsRoutes } from "../modules/earnings/earnings.routes";
import { maskedCallRoutes } from "../modules/masked-call/masked-call.routes";
import {
  bookingStatusRoutes,
  partnerJobRequestsRoutes,
  partnerJobsRoutes,
} from "../modules/partner-jobs/partner-jobs.routes";
import { partnerDashboardRoutes } from "../modules/partners/partner-dashboard.routes";
import { partnerOnboardingRoutes } from "../modules/partner-onboarding/partner-onboarding.routes";
import { partnerLocationRoutes } from "../modules/partner-location/partner-location.routes";
import {
  adminWithdrawalsRoutes,
  partnerBankAccountsRoutes,
  partnerWithdrawalsRoutes,
} from "../modules/partner-withdrawals/partner-withdrawals.routes";
import { partnerPayoutsRoutes } from "../modules/partner-payouts/partner-payouts.routes";
import { partnerPerformanceRoutes } from "../modules/partner-performance/partner-performance.routes";
import { partnerReviewsRoutes } from "../modules/partner-reviews/partner-reviews.routes";
import {
  partnerServiceAreaRoutes,
  partnerServicesRoutes,
} from "../modules/partner-services/partner-services.routes";
import { partnerSettingsRoutes } from "../modules/partner-settings/partner-settings.routes";
import { partnerTicketsRoutes } from "../modules/partner-tickets/partner-tickets.routes";
import {
  partnerWalletRoutes,
  partnerWalletSummaryRoutes,
} from "../modules/partner-wallet/partner-wallet.routes";
import { sosRoutes } from "../modules/sos/sos.routes";
import { partnerKycRoutes } from "../modules/partners/partner-kyc.routes";
import { adminSkillRequestsRoutes, partnerSkillsRoutes } from "../modules/partner-skills/partner-skills.routes";
import { partnerDocumentsRoutes } from "../modules/partner-documents/partner-documents.routes";
import { partnerProfileRoutes } from "../modules/partner-profile/partner-profile.routes";

export const rootRouter = Router();

rootRouter.use("/auth", authRoutes);

// ---- Admin ----
// Keep specific admin mounts before the general /admin router.
rootRouter.use("/admin/dashboard", adminDashboardRoutes);
rootRouter.use("/admin/settings", settingsRoutes);
rootRouter.use("/admin/designations", designationsRoutes);

rootRouter.use(
  "/admin/categories",
  authMiddleware,
  requireAdmin,
  requireResourceAccess("catalog"),
  categoriesRoutes,
);

rootRouter.use(
  "/admin/services",
  authMiddleware,
  requireAdmin,
  requireResourceAccess("catalog"),
  servicesRoutes,
);

rootRouter.use(
  "/admin/skill-requests",
  authMiddleware,
  requireAdmin,
  requireResourceAccess("partners"),
  adminSkillRequestsRoutes,
);

rootRouter.use(
  "/admin/leads",
  authMiddleware,
  requireAdmin,
  requireResourceAccess("leads"),
  adminLeadsRoutes,
);

rootRouter.use(
  "/admin/customers",
  authMiddleware,
  requireAdmin,
  requireResourceAccess("customers"),
  adminCustomersRoutes,
);

rootRouter.use("/admin/payments", adminPaymentsRoutes);
rootRouter.use("/admin/withdrawals", adminWithdrawalsRoutes);
rootRouter.use("/admin/tickets", adminTicketsRoutes);
rootRouter.use("/admin/ticket-assignees", adminStaffRoutes);

rootRouter.use(
  "/admin/partners",
  authMiddleware,
  requireAdmin,
  requireResourceAccess("partners"),
  partnersRoutes,
);

rootRouter.use(
  "/admin/coupons",
  authMiddleware,
  requireAdmin,
  requireResourceAccess("coupons"),
  couponsRoutes,
);

rootRouter.use(
  "/admin/referral-programs",
  authMiddleware,
  requireAdmin,
  requireResourceAccess("coupons"),
  referralProgramsRoutes,
);

rootRouter.use(
  "/admin/banners",
  authMiddleware,
  requireAdmin,
  requireResourceAccess("marketing"),
  marketingRoutes,
);

rootRouter.use("/admin/pricing", adminPricingRoutes);
rootRouter.use("/admin/incentives", incentivesRoutes);

// B08: Reports & CSV exports.
rootRouter.use(
  "/admin/reports",
  authMiddleware,
  requireAdmin,
  requireResourceAccess("reports"),
  reportsRoutes,
);

// B05: Refunds and payouts; B09: read-only audit logs.
rootRouter.use("/admin/withdrawals", adminWithdrawalsRoutes);
rootRouter.use("/admin", payoutsRoutes);
rootRouter.use("/admin", refundsRoutes);
rootRouter.use("/admin", auditRoutes);

// General admin routes should be mounted after specific /admin routes.
rootRouter.use("/admin", adminRoutes);

// ---- Catalog & Public ----
rootRouter.use(catalogRoutes);
rootRouter.use("/banners", publicMarketingRoutes);
rootRouter.use("/site-settings", publicSettingsRoutes);
rootRouter.use("/serviceability", serviceabilityRoutes);
rootRouter.use("/pricing", pricingRoutes);
rootRouter.use(leadsRoutes);

// ---- Notifications ----
rootRouter.use("/notifications", notificationsRoutes);
rootRouter.use("/partner/notifications", notificationsRoutes);
rootRouter.use("/customer/notifications", customerNotificationsRoutes);

// ---- Customer ----
rootRouter.use("/customer/dashboard", customerDashboardRoutes);
rootRouter.use("/customer/profile", customerProfileRoutes);
rootRouter.use("/customer/preferences", customerPreferencesRoutes);
rootRouter.use("/addresses", addressesRoutes);
rootRouter.use("/payments", paymentRoutes);
rootRouter.use("/wallet", walletRoutes);
rootRouter.use("/tickets", ticketsRoutes);
rootRouter.use("/support/tickets", ticketsRoutes);
rootRouter.use("/referrals", referralsRoutes);
rootRouter.use("/coupons", couponCustomerRoutes);

// ---- Partner ----
// Pages that need the finished + admin-approved training go through requireTrainingApproved.
// Open on purpose: onboarding, kyc, notifications, support tickets, settings, safety (SOS).
rootRouter.use("/partner/dashboard", authMiddleware, requireTrainingApproved, partnerDashboardRoutes);
rootRouter.use("/partner/onboarding", partnerOnboardingRoutes);
// KYC documents are not behind the training gate: they are part of KYC, not of the work area.
rootRouter.use("/partner/kyc", partnerKycRoutes);
rootRouter.use("/partner/documents", partnerDocumentsRoutes);
rootRouter.use("/partner/availability", authMiddleware, requireTrainingApproved, availabilityRoutes);
rootRouter.use("/partner/blackout-dates", authMiddleware, requireTrainingApproved, blackoutRoutes);
rootRouter.use("/partner/schedule", authMiddleware, requireTrainingApproved, scheduleRoutes);
rootRouter.use("/partner/earnings", authMiddleware, requireTrainingApproved, earningsRoutes);
rootRouter.use("/partner/transactions", authMiddleware, requireTrainingApproved, partnerWalletRoutes);
rootRouter.use("/partner/wallet", authMiddleware, requireTrainingApproved, partnerWalletSummaryRoutes);
rootRouter.use("/partner/payouts", authMiddleware, requireTrainingApproved, partnerPayoutsRoutes);
rootRouter.use("/partner/bank-accounts", authMiddleware, requireTrainingApproved, partnerBankAccountsRoutes);
rootRouter.use("/partner/withdrawals", authMiddleware, requireTrainingApproved, partnerWithdrawalsRoutes);
rootRouter.use("/partner/incentives", authMiddleware, requireTrainingApproved, incentivesRoutes);
rootRouter.use("/partner/skills", authMiddleware, requireTrainingApproved, partnerSkillsRoutes);
rootRouter.use("/partner/services", authMiddleware, requireTrainingApproved, partnerServicesRoutes);
rootRouter.use("/partner/service-area", authMiddleware, requireTrainingApproved, partnerServiceAreaRoutes);
rootRouter.use("/partner/performance", authMiddleware, requireTrainingApproved, partnerPerformanceRoutes);
rootRouter.use("/partner/reviews", authMiddleware, requireTrainingApproved, partnerReviewsRoutes);
rootRouter.use("/partner/support/tickets", partnerTicketsRoutes);
rootRouter.use("/partner/settings", partnerSettingsRoutes);
// Profile (name + phone + what the partner gave at joining). Like settings, it is not behind the training gate.
// The router applies authenticate + requireRole("partner") + permissions itself.
rootRouter.use("/partner/profile", partnerProfileRoutes);
rootRouter.use("/partner/safety", sosRoutes);
rootRouter.use("/partner/jobs", authMiddleware, requireTrainingApproved, partnerJobsRoutes);
rootRouter.use("/partner/job-requests", authMiddleware, requireTrainingApproved, partnerJobRequestsRoutes);
rootRouter.use("/partner/jobs", authMiddleware, requireTrainingApproved, maskedCallRoutes);
rootRouter.use("/partner/jobs", authMiddleware, requireTrainingApproved, partnerLocationRoutes);

// ---- Bookings, chat & reviews ----
rootRouter.use(bookingsRoutes);
rootRouter.use("/bookings", bookingStatusRoutes);
rootRouter.use("/bookings", chatRoutes);
rootRouter.use(reviewsRoutes);

export default rootRouter;

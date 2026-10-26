import { Router } from 'express';

// Core & Auth
import { authRoutes } from '../modules/auth/auth.routes';

// Admin modules
import { adminRoutes } from '../modules/admin/admin.routes';
import { adminDashboardRoutes } from '../modules/admin-dashboard/admin-dashboard.routes';
import { adminCustomersRoutes } from '../modules/admin-customers/admin-customers.routes';
import { adminPaymentsRoutes } from '../modules/admin-payments/admin-payments.routes';
import { adminTicketsRoutes, adminStaffRoutes } from '../modules/admin-tickets/admin-tickets.routes';
import { auditRoutes } from '../modules/audit/audit.routes';
import { categoriesRoutes } from '../modules/categories/categories.routes';
import { designationsRoutes } from '../modules/designations/designations.routes';
import { reportsRoutes } from '../modules/reports/reports.routes';
import { servicesRoutes } from '../modules/services/services.routes';
import { settingsRoutes } from '../modules/settings/settings.routes';
import { partnersRoutes } from '../modules/partners/partners.routes';
import { payoutsRoutes } from '../modules/payouts/payouts.routes';
import refundsRoutes from '../modules/refunds/refunds.routes';
import { couponsRoutes, couponCustomerRoutes } from '../modules/coupons/coupons.routes';
import { marketingRoutes, publicMarketingRoutes } from '../modules/marketing/marketing.routes';
import { incentivesRoutes } from '../modules/incentives/incentives.routes';

// Catalog & Public
import { catalogRoutes } from '../modules/catalog/catalog.routes';
import leadsRoutes from '../modules/leads/leads.routes';
import { adminPricingRoutes, pricingRoutes } from '../modules/pricing/pricing.routes';

// Bookings & Payments
import { bookingsRoutes } from '../modules/bookings/bookings.routes';
import paymentRoutes from '../modules/payments/payments.routes';
import walletRoutes from '../modules/wallet/wallet.routes';
import { addressesRoutes, serviceabilityRoutes } from '../modules/addresses/addresses.routes';
import { reviewsRoutes } from '../modules/reviews/reviews.routes';
import { chatRoutes } from '../modules/chat/chat.routes';

// Notifications
import { notificationsRoutes } from '../modules/notifications/notifications.routes';
import customerNotificationsRoutes from '../modules/notifications/customer-notifications.routes';

// Customer
import customerDashboardRoutes from '../modules/customer-dashboard/customer-dashboard.routes';
import { customerProfileRoutes, customerPreferencesRoutes } from '../modules/customer-profile/customer-profile.routes';
import { referralsRoutes } from '../modules/referrals/referrals.routes';
import { ticketsRoutes } from '../modules/tickets/tickets.routes';

// Partner
import { partnerDashboardRoutes } from '../modules/partners/partner-dashboard.routes';
import { partnerKycRoutes } from '../modules/partners/partner-kyc.routes';
import { availabilityRoutes } from '../modules/availability/availability.routes';
import { blackoutRoutes } from '../modules/availability/blackout.routes';
import { scheduleRoutes } from '../modules/availability/schedule.routes';
import { earningsRoutes } from '../modules/earnings/earnings.routes';
import partnerWalletRoutes, { partnerWalletSummaryRoutes } from '../modules/partner-wallet/partner-wallet.routes';
import { partnerPayoutsRoutes } from '../modules/partner-payouts/partner-payouts.routes';
import { partnerPerformanceRoutes } from '../modules/partner-performance/partner-performance.routes';
import { partnerReviewsRoutes } from '../modules/partner-reviews/partner-reviews.routes';
import { partnerTicketsRoutes } from '../modules/partner-tickets/partner-tickets.routes';
import { partnerServiceAreaRoutes, partnerServicesRoutes } from '../modules/partner-services/partner-services.routes';
import { partnerSettingsRoutes } from '../modules/partner-settings/partner-settings.routes';
import { partnerJobsRoutes, partnerJobRequestsRoutes, bookingStatusRoutes } from '../modules/partner-jobs/partner-jobs.routes';
import { maskedCallRoutes } from '../modules/masked-call/masked-call.routes';
import { partnerLocationRoutes } from '../modules/partner-location/partner-location.routes';
import { sosRoutes } from '../modules/sos/sos.routes';

export const rootRouter = Router();

// Routes are registered under /api/v1.

// Auth
rootRouter.use('/auth', authRoutes);

// Admin
rootRouter.use('/admin/dashboard', adminDashboardRoutes);
rootRouter.use('/admin/settings', settingsRoutes);
rootRouter.use('/admin/designations', designationsRoutes);
rootRouter.use('/admin/categories', categoriesRoutes);
rootRouter.use('/admin/services', servicesRoutes);
rootRouter.use('/admin/customers', adminCustomersRoutes);
rootRouter.use('/admin/payments', adminPaymentsRoutes);
rootRouter.use('/admin/tickets', adminTicketsRoutes);
rootRouter.use('/admin/ticket-assignees', adminStaffRoutes);
rootRouter.use('/admin/partners', partnersRoutes);
rootRouter.use('/admin/coupons', couponsRoutes);
rootRouter.use('/admin/banners', marketingRoutes);
rootRouter.use('/admin/incentives', incentivesRoutes);
rootRouter.use('/admin/pricing', adminPricingRoutes);
rootRouter.use('/admin/reports', reportsRoutes);
rootRouter.use('/admin', payoutsRoutes);
rootRouter.use('/admin', refundsRoutes);
rootRouter.use('/admin', auditRoutes);
rootRouter.use('/admin', adminRoutes);

// Catalog & Public
rootRouter.use(catalogRoutes);
rootRouter.use('/banners', publicMarketingRoutes);
rootRouter.use('/serviceability', serviceabilityRoutes);
rootRouter.use('/pricing', pricingRoutes);
rootRouter.use(leadsRoutes);

// Notifications
rootRouter.use('/notifications', notificationsRoutes);
rootRouter.use('/customer/notifications', customerNotificationsRoutes);

// Customer
rootRouter.use('/customer/dashboard', customerDashboardRoutes);
rootRouter.use('/customer/profile', customerProfileRoutes);
rootRouter.use('/customer/preferences', customerPreferencesRoutes);
rootRouter.use('/addresses', addressesRoutes);
rootRouter.use('/payments', paymentRoutes);
rootRouter.use('/wallet', walletRoutes);
rootRouter.use('/tickets', ticketsRoutes);
rootRouter.use('/support/tickets', ticketsRoutes);
rootRouter.use('/referrals', referralsRoutes);
rootRouter.use('/coupons', couponCustomerRoutes);

// Partner
rootRouter.use('/partner/kyc', partnerKycRoutes);
rootRouter.use('/partner/dashboard', partnerDashboardRoutes);
rootRouter.use('/partner/availability', availabilityRoutes);
rootRouter.use('/partner/blackout-dates', blackoutRoutes);
rootRouter.use('/partner/schedule', scheduleRoutes);
rootRouter.use('/partner/earnings', earningsRoutes);
rootRouter.use('/partner/transactions', partnerWalletRoutes);
rootRouter.use('/partner/wallet', partnerWalletSummaryRoutes);
rootRouter.use('/partner/payouts', partnerPayoutsRoutes);
rootRouter.use('/partner/incentives', incentivesRoutes);
rootRouter.use('/partner/services', partnerServicesRoutes);
rootRouter.use('/partner/service-area', partnerServiceAreaRoutes);
rootRouter.use('/partner/performance', partnerPerformanceRoutes);
rootRouter.use('/partner/reviews', partnerReviewsRoutes);
rootRouter.use('/partner/support/tickets', partnerTicketsRoutes);
rootRouter.use('/partner/settings', partnerSettingsRoutes);
rootRouter.use('/partner/safety', sosRoutes);
rootRouter.use('/partner/jobs', partnerJobsRoutes);
rootRouter.use('/partner/job-requests', partnerJobRequestsRoutes);
rootRouter.use('/partner/jobs', maskedCallRoutes);
rootRouter.use('/partner/jobs', partnerLocationRoutes);
rootRouter.use('/partner/notifications', notificationsRoutes);

// Bookings & Chat & Reviews
rootRouter.use('/bookings', bookingStatusRoutes);
rootRouter.use('/bookings', chatRoutes);
rootRouter.use(bookingsRoutes);
rootRouter.use(reviewsRoutes);

export default rootRouter;

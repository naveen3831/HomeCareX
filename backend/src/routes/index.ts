
import { Router } from 'express';

// Authentication and administration
import { authRoutes } from '../modules/auth/auth.routes';
import { auditRoutes } from '../modules/audit/audit.routes';
import { adminRoutes } from '../modules/admin/admin.routes';
import { adminDashboardRoutes } from '../modules/admin-dashboard/admin-dashboard.routes';
import { adminCustomersRoutes } from '../modules/admin-customers/admin-customers.routes';
import { settingsRoutes } from '../modules/settings/settings.routes';
import { designationsRoutes } from '../modules/designations/designations.routes';

// Partners
import { partnersRoutes } from '../modules/partners/partners.routes';
import { partnerDashboardRoutes } from '../modules/partners/partner-dashboard.routes';
import { availabilityRoutes } from '../modules/availability/availability.routes';
import { blackoutRoutes } from '../modules/availability/blackout.routes';
import { scheduleRoutes } from '../modules/availability/schedule.routes';
import { earningsRoutes } from '../modules/earnings/earnings.routes';
import partnerWalletRoutes, {
  partnerWalletSummaryRoutes,
} from '../modules/partner-wallet/partner-wallet.routes';
import { partnerPerformanceRoutes } from '../modules/partner-performance/partner-performance.routes';
import { partnerReviewsRoutes } from '../modules/partner-reviews/partner-reviews.routes';
import { partnerTicketsRoutes } from '../modules/partner-tickets/partner-tickets.routes';
import {
  partnerServiceAreaRoutes,
  partnerServicesRoutes,
} from '../modules/partner-services/partner-services.routes';

// Catalog and services
import { categoriesRoutes } from '../modules/categories/categories.routes';
import { servicesRoutes } from '../modules/services/services.routes';
import { catalogRoutes } from '../modules/catalog/catalog.routes';
import { incentivesRoutes } from '../modules/incentives/incentives.routes';
import {
  addressesRoutes,
  serviceabilityRoutes,
} from '../modules/addresses/addresses.routes';
import { reviewsRoutes } from '../modules/reviews/reviews.routes';

// Customers and bookings
import customerDashboardRoutes from '../modules/customer-dashboard/customer-dashboard.routes';
import { bookingsRoutes } from '../modules/bookings/bookings.routes';
import {
  couponsRoutes,
  couponCustomerRoutes,
} from '../modules/coupons/coupons.routes';
import { notificationsRoutes } from '../modules/notifications/notifications.routes';

// Payments and refunds
import paymentRoutes from '../modules/payments/payments.routes';
import walletRoutes from '../modules/wallet/wallet.routes';
import refundsRoutes from '../modules/refunds/refunds.routes';
import { payoutsRoutes } from '../modules/payouts/payouts.routes';

// Reports, marketing, leads and other modules
import { reportsRoutes } from '../modules/reports/reports.routes';
import {
  marketingRoutes,
  publicMarketingRoutes,
} from '../modules/marketing/marketing.routes';
import leadsRoutes from '../modules/leads/leads.routes';
import { ticketsRoutes } from '../modules/tickets/tickets.routes';
import { referralsRoutes } from '../modules/referrals/referrals.routes';
import { pricingRoutes } from '../modules/pricing/pricing.routes';
import { maskedCallRoutes } from '../modules/masked-call/masked-call.routes';

export const rootRouter = Router();

// Authentication
rootRouter.use('/auth', authRoutes);

// Admin dashboard and configuration
rootRouter.use('/admin/dashboard', adminDashboardRoutes);
rootRouter.use('/admin/settings', settingsRoutes);
rootRouter.use('/admin/designations', designationsRoutes);
rootRouter.use('/admin/categories', categoriesRoutes);
rootRouter.use('/admin/services', servicesRoutes);
rootRouter.use('/admin/customers', adminCustomersRoutes);

// Admin coupon management
rootRouter.use('/admin/coupons', couponsRoutes);

// Admin management
rootRouter.use('/admin', auditRoutes);
rootRouter.use('/admin', adminRoutes);
rootRouter.use('/admin/partners', partnersRoutes);
rootRouter.use('/admin/incentives', incentivesRoutes);
rootRouter.use('/admin', payoutsRoutes);
rootRouter.use('/admin', refundsRoutes);
rootRouter.use('/admin/reports', reportsRoutes);

// Catalog and public services
rootRouter.use(catalogRoutes);
rootRouter.use('/serviceability', serviceabilityRoutes);
rootRouter.use('/pricing', pricingRoutes);

// Notifications
rootRouter.use('/notifications', notificationsRoutes);
rootRouter.use('/partner/notifications', notificationsRoutes);
rootRouter.use('/customer/notifications', notificationsRoutes);

// Marketing
rootRouter.use('/admin/banners', marketingRoutes);
rootRouter.use('/banners', publicMarketingRoutes);

// Leads
rootRouter.use(leadsRoutes);

// Customer routes
rootRouter.use('/customer/dashboard', customerDashboardRoutes);
rootRouter.use('/addresses', addressesRoutes);
rootRouter.use('/payments', paymentRoutes);
rootRouter.use('/wallet', walletRoutes);
rootRouter.use('/tickets', ticketsRoutes);
rootRouter.use('/referrals', referralsRoutes);
rootRouter.use('/coupons', couponCustomerRoutes);

// Partner routes
rootRouter.use('/partner/dashboard', partnerDashboardRoutes);
rootRouter.use('/partner/availability', availabilityRoutes);
rootRouter.use('/partner/blackout-dates', blackoutRoutes);
rootRouter.use('/partner/schedule', scheduleRoutes);
rootRouter.use('/partner/earnings', earningsRoutes);
rootRouter.use('/partner/transactions', partnerWalletRoutes);
rootRouter.use('/partner/wallet', partnerWalletSummaryRoutes);
rootRouter.use('/partner/incentives', incentivesRoutes);
rootRouter.use('/partner/services', partnerServicesRoutes);
rootRouter.use('/partner/service-area', partnerServiceAreaRoutes);
rootRouter.use('/partner/performance', partnerPerformanceRoutes);
rootRouter.use('/partner/reviews', partnerReviewsRoutes);
rootRouter.use('/partner/support/tickets', partnerTicketsRoutes);
rootRouter.use('/partner/jobs', maskedCallRoutes);

// Booking and review routes
rootRouter.use(bookingsRoutes);
rootRouter.use(reviewsRoutes);

export default rootRouter;


import { Router } from 'express';

import paymentRoutes from '../modules/payments/payments.routes';
import walletRoutes from '../modules/wallet/wallet.routes';
import {
  customerPreferencesRoutes,
  customerProfileRoutes,
} from '../modules/customer-profile/customer-profile.routes';
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
} from '../modules/partner-jobs/partner-jobs.routes';
import { couponsRoutes, couponCustomerRoutes } from '../modules/coupons/coupons.routes';
import { marketingRoutes, publicMarketingRoutes } from '../modules/marketing/marketing.routes';
import refundsRoutes from '../modules/refunds/refunds.routes';
import reviewsRoutes from '../modules/reviews/reviews.routes';
import { chatRoutes } from '../modules/chat/chat.routes';
import { partnerLocationRoutes } from '../modules/partner-location/partner-location.routes';
import { partnerServicesRoutes, partnerServiceAreaRoutes } from '../modules/partner-services/partner-services.routes';
import { maskedCallRoutes } from '../modules/masked-call/masked-call.routes';

export const rootRouter = Router();

rootRouter.use('/auth', authRoutes);
rootRouter.use('/admin/dashboard', adminDashboardRoutes);
rootRouter.use('/admin/settings', settingsRoutes);
rootRouter.use('/admin/designations', designationsRoutes);
rootRouter.use('/admin/categories', categoriesRoutes);
rootRouter.use('/admin/services', servicesRoutes);
rootRouter.use('/admin/customers', adminCustomersRoutes);
rootRouter.use('/admin/payments', adminPaymentsRoutes);
rootRouter.use('/admin/tickets', adminTicketsRoutes);
rootRouter.use('/admin/staff', adminStaffRoutes);
rootRouter.use('/admin/partners', partnersRoutes);
rootRouter.use('/admin/coupons', couponsRoutes);
rootRouter.use('/admin/banners', marketingRoutes);
rootRouter.use('/admin/pricing', adminPricingRoutes);
rootRouter.use('/admin', refundsRoutes);
rootRouter.use('/admin', auditRoutes);
rootRouter.use('/admin', adminRoutes);

rootRouter.use(catalogRoutes);
rootRouter.use('/notifications', notificationsRoutes);
rootRouter.use('/customer/notifications', customerNotificationsRoutes);
rootRouter.use('/banners', publicMarketingRoutes);
rootRouter.use(leadsRoutes);
rootRouter.use('/pricing', pricingRoutes);
rootRouter.use('/serviceability', serviceabilityRoutes);

rootRouter.use('/customer/dashboard', customerDashboardRoutes);
rootRouter.use('/customer/profile', customerProfileRoutes);
rootRouter.use('/customer/preferences', customerPreferencesRoutes);
rootRouter.use('/addresses', addressesRoutes);
rootRouter.use('/wallet', walletRoutes);
rootRouter.use('/coupons', couponCustomerRoutes);
rootRouter.use('/payments', paymentRoutes);

rootRouter.use(bookingsRoutes);
rootRouter.use('/bookings', bookingStatusRoutes);
rootRouter.use('/bookings', chatRoutes);
rootRouter.use(reviewsRoutes);

rootRouter.use('/partner/dashboard', partnerDashboardRoutes);
rootRouter.use('/partner/availability', availabilityRoutes);
rootRouter.use('/partner/blackout-dates', blackoutRoutes);
rootRouter.use('/partner/schedule', scheduleRoutes);
rootRouter.use('/partner/earnings', earningsRoutes);
rootRouter.use('/partner/transactions', partnerWalletRoutes);
rootRouter.use('/partner/wallet', partnerWalletSummaryRoutes);
rootRouter.use('/partner/jobs', partnerJobsRoutes);
rootRouter.use('/partner/job-requests', partnerJobRequestsRoutes);
rootRouter.use('/partner/jobs', maskedCallRoutes);
rootRouter.use('/partner/jobs', partnerLocationRoutes);
rootRouter.use('/partner/incentives', incentivesRoutes);
rootRouter.use('/partner/services', partnerServicesRoutes);
rootRouter.use('/partner/service-area', partnerServiceAreaRoutes);

export default rootRouter;

import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';

import CustomerLayout from '../layouts/CustomerLayout';
import PageLoader from '@/components/common/PageLoader';

// Lazy-load customer pages
const Dashboard = lazy(() => import('../pages/customer/Dashboard'));
const Addresses = lazy(() => import('../pages/customer/Addresses'));
const SetupAddress = lazy(() => import('../pages/customer/SetupAddress'));
const Bookings = lazy(() => import('../pages/customer/Bookings'));
const BookingDetails = lazy(
  () => import('../pages/customer/BookingDetails'),
);
const Categories = lazy(() => import('../pages/customer/Categories'));
const Notifications = lazy(() => import('../pages/customer/Notifications'));
const Payments = lazy(() => import('../pages/customer/Payments'));
const Profile = lazy(() => import('../pages/customer/Profile'));
const Referrals = lazy(() => import('../pages/customer/Referrals'));
const Reviews = lazy(() => import('../pages/customer/Reviews'));
const Services = lazy(() => import('../pages/customer/Services'));
const ServiceDetails = lazy(() => import('../pages/customer/ServiceDetails'));
const Support = lazy(() => import('../pages/customer/Support'));
const Tickets = lazy(() => import('@/pages/customer/Tickets'));
const Tracking = lazy(() => import('../pages/customer/Tracking'));
const TrackingRedirect = lazy(
  () => import('../pages/customer/Tracking/TrackingRedirect'),
);
const Wallet = lazy(() => import('../pages/customer/Wallet'));

const BookServiceShell = lazy(() => import('../pages/customer/Book'));
const EditProfile = lazy(() => import('@/pages/customer/Profile/EditProfilePage'));
const AccountSecurityPage = lazy(() => import('@/pages/shared/AccountSecurity'));

const BookingSuccess = lazy(() => import('../pages/customer/BookingSuccess'));
const BookingFailed = lazy(() => import('../pages/customer/BookingFailed'));
const ServiceBooked = lazy(
  () => import('../pages/customer/BookingSuccess/ServiceBooked'),
);

/**
 * CustomerRoutes — every route the Customer Dashboard serves,
 * nested inside CustomerLayout.
 */
export default function CustomerRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* First-login map setup: outside the dashboard layout */}
        <Route path="/setup-address" element={<SetupAddress />} />

        <Route element={<CustomerLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/addresses" element={<Addresses />} />
          <Route path="/bookings" element={<Bookings />} />

          <Route path="/bookings/:id" element={<BookingDetails />} />
          <Route path="/bookings/:id/track" element={<Tracking />} />

          <Route path="/book/:serviceSlug" element={<BookServiceShell />} />
          <Route path="/categories" element={<Categories />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/payments" element={<Payments />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/profile/delete" element={<Profile defaultDeleteOpen />} />
          <Route path="/account/delete" element={<Profile defaultDeleteOpen />} />
          <Route path="/delete-account" element={<Profile defaultDeleteOpen />} />
          <Route path="/profile/edit" element={<EditProfile />} />
          <Route path="/security" element={<AccountSecurityPage />} />
          <Route path="/profile/security" element={<AccountSecurityPage />} />
          <Route path="/account/security" element={<AccountSecurityPage />} />

          <Route path="/referrals" element={<Referrals />} />
          <Route path="/reviews" element={<Reviews />} />
          <Route path="/services" element={<Services />} />
          <Route path="/services/:slug" element={<ServiceDetails />} />
          <Route path="/support" element={<Support />} />
          <Route path="/support/tickets" element={<Tickets />} />
          <Route path="/support/tickets/:ticketId" element={<Tickets />} />
          <Route path="/tracking" element={<TrackingRedirect />} />
          <Route path="/wallet" element={<Wallet />} />

          <Route path="/booking/success/:id" element={<BookingSuccess />} />
          <Route path="/booking/failed/:id" element={<BookingFailed />} />
          <Route path="/booking/booked/:id" element={<ServiceBooked />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

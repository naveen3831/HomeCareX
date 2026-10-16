import { Routes, Route } from "react-router-dom";

import CustomerLayout from "../layouts/CustomerLayout";

import Dashboard from "../pages/customer/Dashboard";
import Addresses from "../pages/customer/Addresses";
import SetupAddress from "../pages/customer/SetupAddress";
import Bookings from "../pages/customer/Bookings";
import Categories from "../pages/customer/Categories";
import Notifications from "../pages/customer/Notifications";
import Payments from "../pages/customer/Payments";
import Profile from "../pages/customer/Profile";
import EditProfilePage from "../pages/customer/Profile/EditProfilePage";
import ChangePasswordPage from "../pages/customer/Profile/ChangePasswordPage";
import NotificationsPage from "../pages/customer/Profile/NotificationsPage";
import TermsPage from "../pages/customer/Profile/TermsPage";
import PrivacyPage from "../pages/customer/Profile/PrivacyPage";
import Referrals from "../pages/customer/Referrals";
import Reviews from "../pages/customer/Reviews";
import Services from "../pages/customer/Services";
import ServiceDetails from "../pages/customer/ServiceDetails";
import Support from "../pages/customer/Support";
import Tracking from "../pages/customer/Tracking";
import TrackingRedirect from "../pages/customer/Tracking/TrackingRedirect";
import Wallet from "../pages/customer/Wallet";

import Tickets from "@/pages/customer/Tickets";
import BookServiceShell from "../pages/customer/Book";

import BookingSuccess from "../pages/customer/BookingSuccess";
import BookingFailed from "../pages/customer/BookingFailed";
import ServiceBooked from "../pages/customer/BookingSuccess/ServiceBooked";
import BookingDetails from "@/pages/customer/BookingDetails";

/**
 * CustomerRoutes — every route the Customer Dashboard serves,
 * nested inside CustomerLayout.
 */
export default function CustomerRoutes() {
  return (
    <Routes>
      {/* First-login map setup: full screen, outside the dashboard layout */}
      <Route path="/setup-address" element={<SetupAddress />} />

      <Route element={<CustomerLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/addresses" element={<Addresses />} />
        <Route path="/bookings" element={<Bookings />} />

        {/* ✅ View Details route with :id matching useParams in BookingDetails */}
        <Route path="/bookings/:id" element={<BookingDetails />} />
        <Route path="/bookings/:id/track" element={<Tracking />} />

        <Route path="/book/:serviceSlug" element={<BookServiceShell />} />
        <Route path="/categories" element={<Categories />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/payments" element={<Payments />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/profile/edit" element={<EditProfilePage />} />
        <Route path="/profile/password" element={<ChangePasswordPage />} />
        <Route path="/profile/notifications" element={<NotificationsPage />} />
        <Route path="/profile/terms" element={<TermsPage />} />
        <Route path="/profile/privacy" element={<PrivacyPage />} />

        <Route path="/referrals" element={<Referrals />} />
        <Route path="/reviews" element={<Reviews />} />
        <Route path="/services" element={<Services />} />
        <Route path="/services/:slug" element={<ServiceDetails />} />
        <Route path="/support" element={<Support />} />
        <Route path="/support/tickets" element={<Tickets />} />
        <Route path="/support/tickets/:ticketId" element={<Support />} />
        <Route path="/tracking" element={<TrackingRedirect />} />
        <Route path="/wallet" element={<Wallet />} />

        <Route path="/booking/success/:id" element={<BookingSuccess />} />
        <Route path="/booking/failed/:id" element={<BookingFailed />} />
        <Route path="/booking/booked/:id" element={<ServiceBooked />} />
      </Route>
    </Routes>
  );
}

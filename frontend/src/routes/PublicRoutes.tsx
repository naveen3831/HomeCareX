import React, { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import PublicLayout from "../layouts/PublicLayout";
import PageLoader from "../components/common/PageLoader";
import { ROUTES } from "../constants/routes";

// Home is imported directly so the hero loads without an extra round trip.
// All other pages stay lazy-loaded.
import Home from "../pages/public/Home/Home";

const Services = lazy(
  () => import("../pages/public/Services/index")
);

const ServiceDetails = lazy(
  () => import("../pages/public/ServiceDetails")
);

const About = lazy(
  () => import("../pages/public/About/About")
);

const FAQ = lazy(
  () => import("../pages/public/FAQ")
);

const Contact = lazy(
  () => import("../pages/public/Contact/Contact")
);

const Reviews = lazy(
  () => import("../pages/public/Reviews")
);

const Terms = lazy(
  () => import("../pages/public/Terms")
);

const Privacy = lazy(
  () => import("../pages/public/Privacy")
);

const Cookies = lazy(
  () => import("../pages/public/Cookies")
);

const Careers = lazy(
  () => import("../pages/public/Careers")
);

const NotFound = lazy(
  () => import("../pages/public/NotFound")
);

const PublicRoutes: React.FC = () => {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>

        <Route element={<PublicLayout />}>

          {/* Home */}
          <Route
            path={ROUTES.HOME}
            element={<Home />}
          />

          {/* Services */}
          <Route
            path={ROUTES.SERVICES}
            element={<Services />}
          />

          {/* Service Details */}
          <Route
            path="/services/:slug"
            element={<ServiceDetails />}
          />

          {/* About */}
          <Route
            path={ROUTES.ABOUT}
            element={<About />}
          />

          {/* FAQ */}
          <Route
            path={ROUTES.FAQ}
            element={<FAQ />}
          />

          {/* Contact */}
          <Route
            path={ROUTES.CONTACT}
            element={<Contact />}
          />

          {/* Support alias -> Contact */}
          <Route
            path="/support"
            element={<Navigate to={ROUTES.CONTACT} replace />}
          />

          {/* Customer Reviews & Stories (Full Page) */}
          <Route
            path={ROUTES.REVIEWS}
            element={<Reviews />}
          />

          {/* Terms */}
          <Route
            path={ROUTES.TERMS}
            element={<Terms />}
          />

          {/* Privacy */}
          <Route
            path={ROUTES.PRIVACY}
            element={<Privacy />}
          />

          {/* Cookie Policy */}
          <Route
            path={ROUTES.COOKIES}
            element={<Cookies />}
          />

          {/* Careers */}
          <Route
            path={ROUTES.CAREERS}
            element={<Careers />}
          />

          {/* 404 */}
          <Route
            path="*"
            element={<NotFound />}
          />

        </Route>

      </Routes>
    </Suspense>
  );
};

export default PublicRoutes;
import React, { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";

import PublicLayout from "../layouts/PublicLayout";
import PageLoader from "../components/common/PageLoader";
import { ROUTES } from "../constants/routes";
import { loadServiceDetailsPage, loadServicesPage } from "../lib/prefetch";

// Home is imported directly so the hero loads without an extra round trip.
// All other pages stay lazy-loaded.
import Home from "../pages/public/Home/Home";

// These two loaders are shared with lib/prefetch.ts, so a hover prefetch and the real navigation
// download the same chunk once.
const Services = lazy(loadServicesPage);

const ServiceDetails = lazy(loadServiceDetailsPage);

const About = lazy(
  () => import("../pages/public/About/About")
);

const FAQ = lazy(
  () => import("../pages/public/FAQ")
);

const Contact = lazy(
  () => import("../pages/public/Contact/Contact")
);

const Terms = lazy(
  () => import("../pages/public/Terms")
);

const Privacy = lazy(
  () => import("../pages/public/Privacy")
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
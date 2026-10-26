import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";

import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import ErrorBoundary from "./components/common/ErrorBoundary";
import { registerServiceWorker } from "./registerServiceWorker";
// CHANGED 1 of 2: also import prefetchServicesData
import {
  prefetchHomeData,
  prefetchServicesData,
  prefetchServiceDetails,
  slugFromHref,
} from "./lib/prefetch";

import "./index.css";

// Register the service worker in production builds only.
// Deferred: the service worker is not needed for the first paint, so wait until
// the page has fully loaded and the browser is idle.
if (import.meta.env.PROD) {
  const start = () => {
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(() => registerServiceWorker());
    } else {
      setTimeout(registerServiceWorker, 3000);
    }
  };
  if (document.readyState === "complete") start();
  else window.addEventListener("load", start, { once: true });
}

// Configure React Query defaults.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Home waterfall fix: start the banners request and the BannerSlider chunk now, in parallel,
// instead of waiting for Home to render and the lazy chunk to finish loading.
if (window.location.pathname === "/") {
  prefetchHomeData(queryClient);
}

// CHANGED 2 of 2: Services waterfall fix. Start the services API request and the
// Services page chunk now, in parallel, instead of after React has rendered.
// Only matches /services and /services/ (not /services/some-slug).
if (/^\/services\/?$/.test(window.location.pathname)) {
  prefetchServicesData(queryClient);
}

// Service details waterfall fix: for /services/<slug>, start the service request and the
// details chunk now, in parallel, instead of after React has rendered.
const detailsSlug = slugFromHref(window.location.pathname);
if (detailsSlug) {
  prefetchServiceDetails(queryClient, detailsSlug);
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HelmetProvider>
      <BrowserRouter>
        <ErrorBoundary>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <App />
            </AuthProvider>
          </QueryClientProvider>
        </ErrorBoundary>
      </BrowserRouter>
    </HelmetProvider>
  </React.StrictMode>,
);
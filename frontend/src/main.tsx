import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";

import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { LanguageProvider } from "./i18n/LanguageContext";
import ErrorBoundary from "./components/common/ErrorBoundary";
import { registerServiceWorker } from "./registerServiceWorker";

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

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HelmetProvider>
      <BrowserRouter>
        <ErrorBoundary>
          <QueryClientProvider client={queryClient}>
            <LanguageProvider>
              <AuthProvider>
                <App />
              </AuthProvider>
            </LanguageProvider>
          </QueryClientProvider>
        </ErrorBoundary>
      </BrowserRouter>
    </HelmetProvider>
  </React.StrictMode>,
);
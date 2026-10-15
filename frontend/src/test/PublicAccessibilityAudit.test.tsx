import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render } from "@testing-library/react";
import React from "react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import axe from "axe-core";

import PublicLayout from "../layouts/PublicLayout";
import AuthLayout from "../layouts/AuthLayout";
import Home from "../pages/public/Home/Home";
import Services from "../pages/public/Services";
import ServiceDetails from "../pages/public/ServiceDetails";
import About from "../pages/public/About/About";
import FAQ from "../pages/public/FAQ";
import Contact from "../pages/public/Contact/Contact";
import Terms from "../pages/public/Terms";
import Privacy from "../pages/public/Privacy";
import NotFound from "../pages/public/NotFound";
import LoginPage from "../pages/public/Login";
import RegisterPage from "../pages/public/Register";
import ForgotPasswordPage from "../pages/public/ForgotPassword";
import VerifyOtpPage from "../pages/public/VerifyOtp";
import ResetPasswordPage from "../pages/public/ResetPassword";
import UnauthorizedPage from "../pages/public/Unauthorized";
import { resetStateStore } from "../features/auth/resetStateStore";

// Mock Leaflet
vi.mock("leaflet", () => ({
  default: {
    map: () => ({
      setView: () => {},
      remove: () => {},
    }),
    tileLayer: () => ({
      addTo: () => {},
    }),
    marker: () => ({
      addTo: () => ({
        bindPopup: () => ({
          openPopup: () => {},
        }),
      }),
    }),
    icon: () => ({}),
  },
}));

import { AuthProvider } from "../context/AuthContext";

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

const runAxe = async (container: HTMLElement) => {
  return await axe.run(container, {
    runOnly: {
      type: "tag",
      values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
    },
    rules: {
      // In jsdom, color-contrast cannot be reliably computed because stylesheets and layout aren't fully rendered by jsdom
      "color-contrast": { enabled: false },
    },
  });
};

describe("Public Routes WCAG 2.1 AA Accessibility Audit with axe-core", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    resetStateStore.clear();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async (
          _input: RequestInfo | URL,
          _init?: RequestInit,
        ): Promise<Response> =>
          new Response("[]", {
            status: 404,
            headers: { "Content-Type": "application/json" },
          }),
      ) as typeof fetch,
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const renderRoute = (initialPath: string, ui: React.ReactNode) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter initialEntries={[initialPath]}>{ui}</MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>,
    );
  };

  it("1. Home (/) passes axe checks", async () => {
    const { container } = renderRoute(
      "/",
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Home />} />
        </Route>
      </Routes>,
    );
    const results = await runAxe(container);
    if (results.violations.length > 0) {
      console.log(
        "Home violations:",
        JSON.stringify(results.violations, null, 2),
      );
    }
    expect(results.violations).toEqual([]);
  });

  it("2. Services (/services) passes axe checks", async () => {
    const { container } = renderRoute(
      "/services",
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/services" element={<Services />} />
        </Route>
      </Routes>,
    );
    const results = await runAxe(container);
    if (results.violations.length > 0) {
      console.log(
        "Services violations:",
        JSON.stringify(results.violations, null, 2),
      );
    }
    expect(results.violations).toEqual([]);
  });

  it("3. Service Details (/services/:id) passes axe checks", async () => {
    const { container } = renderRoute(
      "/services/home-cleaning",
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/services/:id" element={<ServiceDetails />} />
        </Route>
      </Routes>,
    );
    const results = await runAxe(container);
    if (results.violations.length > 0) {
      console.log(
        "ServiceDetails violations:",
        JSON.stringify(results.violations, null, 2),
      );
    }
    expect(results.violations).toEqual([]);
  });

  it("4. About (/about) passes axe checks", async () => {
    const { container } = renderRoute(
      "/about",
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/about" element={<About />} />
        </Route>
      </Routes>,
    );
    const results = await runAxe(container);
    if (results.violations.length > 0) {
      console.log(
        "About violations:",
        JSON.stringify(results.violations, null, 2),
      );
    }
    expect(results.violations).toEqual([]);
  });

  it("5. FAQ (/faq) passes axe checks", async () => {
    const { container } = renderRoute(
      "/faq",
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/faq" element={<FAQ />} />
        </Route>
      </Routes>,
    );
    const results = await runAxe(container);
    if (results.violations.length > 0) {
      console.log(
        "FAQ violations:",
        JSON.stringify(results.violations, null, 2),
      );
    }
    expect(results.violations).toEqual([]);
  });

  it("6. Contact (/contact) passes axe checks", async () => {
    const { container } = renderRoute(
      "/contact",
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/contact" element={<Contact />} />
        </Route>
      </Routes>,
    );
    const results = await runAxe(container);
    if (results.violations.length > 0) {
      console.log(
        "Contact violations:",
        JSON.stringify(results.violations, null, 2),
      );
    }
    expect(results.violations).toEqual([]);
  });

  it("7. Terms (/terms) passes axe checks", async () => {
    const { container } = renderRoute(
      "/terms",
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/terms" element={<Terms />} />
        </Route>
      </Routes>,
    );
    const results = await runAxe(container);
    if (results.violations.length > 0) {
      console.log(
        "Terms violations:",
        JSON.stringify(results.violations, null, 2),
      );
    }
    expect(results.violations).toEqual([]);
  });

  it("8. Privacy (/privacy) passes axe checks", async () => {
    const { container } = renderRoute(
      "/privacy",
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/privacy" element={<Privacy />} />
        </Route>
      </Routes>,
    );
    const results = await runAxe(container);
    if (results.violations.length > 0) {
      console.log(
        "Privacy violations:",
        JSON.stringify(results.violations, null, 2),
      );
    }
    expect(results.violations).toEqual([]);
  });

  it("9. NotFound (*) passes axe checks", async () => {
    const { container } = renderRoute(
      "/not-found-page",
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>,
    );
    const results = await runAxe(container);
    if (results.violations.length > 0) {
      console.log(
        "NotFound violations:",
        JSON.stringify(results.violations, null, 2),
      );
    }
    expect(results.violations).toEqual([]);
  });

  it("10. Login (/login) passes axe checks", async () => {
    const { container } = renderRoute(
      "/login",
      <Routes>
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
        </Route>
      </Routes>,
    );
    const results = await runAxe(container);
    if (results.violations.length > 0) {
      console.log(
        "Login violations:",
        JSON.stringify(results.violations, null, 2),
      );
    }
    expect(results.violations).toEqual([]);
  });

  it("11. Register (/register) passes axe checks", async () => {
    const { container } = renderRoute(
      "/register",
      <Routes>
        <Route element={<AuthLayout />}>
          <Route path="/register" element={<RegisterPage />} />
        </Route>
      </Routes>,
    );
    const results = await runAxe(container);
    if (results.violations.length > 0) {
      console.log(
        "Register violations:",
        JSON.stringify(results.violations, null, 2),
      );
    }
    expect(results.violations).toEqual([]);
  });

  it("12. Forgot Password (/forgot-password) passes axe checks", async () => {
    const { container } = renderRoute(
      "/forgot-password",
      <Routes>
        <Route element={<AuthLayout />}>
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        </Route>
      </Routes>,
    );
    const results = await runAxe(container);
    if (results.violations.length > 0) {
      console.log(
        "ForgotPassword violations:",
        JSON.stringify(results.violations, null, 2),
      );
    }
    expect(results.violations).toEqual([]);
  });

  it("13. Verify OTP (/verify-otp) passes axe checks", async () => {
    resetStateStore.setEmail("test@example.com");
    const { container } = renderRoute(
      "/verify-otp",
      <Routes>
        <Route element={<AuthLayout />}>
          <Route path="/verify-otp" element={<VerifyOtpPage />} />
        </Route>
      </Routes>,
    );
    const results = await runAxe(container);
    if (results.violations.length > 0) {
      console.log(
        "VerifyOtp violations:",
        JSON.stringify(results.violations, null, 2),
      );
    }
    expect(results.violations).toEqual([]);
  });

  it("14. Reset Password (/reset-password) passes axe checks", async () => {
    resetStateStore.setResetToken("test-reset-token");
    const { container } = renderRoute(
      "/reset-password",
      <Routes>
        <Route element={<AuthLayout />}>
          <Route path="/reset-password" element={<ResetPasswordPage />} />
        </Route>
      </Routes>,
    );
    const results = await runAxe(container);
    if (results.violations.length > 0) {
      console.log(
        "ResetPassword violations:",
        JSON.stringify(results.violations, null, 2),
      );
    }
    expect(results.violations).toEqual([]);
  });

  it("15. Unauthorized (/unauthorized) passes axe checks", async () => {
    const { container } = renderRoute(
      "/unauthorized",
      <Routes>
        <Route path="/unauthorized" element={<UnauthorizedPage />} />
      </Routes>,
    );
    const results = await runAxe(container);
    if (results.violations.length > 0) {
      console.log(
        "Unauthorized violations:",
        JSON.stringify(results.violations, null, 2),
      );
    }
    expect(results.violations).toEqual([]);
  });
});

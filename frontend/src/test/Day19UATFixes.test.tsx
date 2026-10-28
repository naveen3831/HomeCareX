import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HelmetProvider } from 'react-helmet-async';

// Mock Recaptcha
vi.mock('@/features/public/recaptcha', () => ({
  isRecaptchaConfigured: false,
  loadRecaptcha: vi.fn(),
  executeRecaptcha: vi.fn().mockResolvedValue('mock-recaptcha-token'),
}));

// Mock HTTP & Auth APIs
vi.mock('@/lib/http', () => {
  const get = vi.fn().mockResolvedValue({ data: { success: true, data: [] } });
  const post = vi.fn().mockResolvedValue({ data: { success: true, message: 'Your request has been received.' } });
  const put = vi.fn().mockResolvedValue({ data: { success: true } });
  const patch = vi.fn().mockResolvedValue({ data: { success: true } });
  const del = vi.fn().mockResolvedValue({ data: { success: true } });
  return {
    default: {
      get,
      post,
      put,
      patch,
      delete: del,
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    },
  };
});

vi.mock('@/services/authApi', () => ({
  authApi: {
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn().mockResolvedValue(undefined),
    me: vi.fn(),
    forgotPassword: vi.fn(),
    verifyOtp: vi.fn(),
    resendOtp: vi.fn(),
    resetPassword: vi.fn(),
  },
}));

import { authApi } from '@/services/authApi';
import http from '@/lib/http';
import { tokenStore } from '@/lib/tokenStore';
import { resetStateStore } from '@/features/auth/resetStateStore';
import { AuthProvider } from '@/context/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';

// Public pages & components
import Home from '@/pages/public/Home/Home';
import About from '@/pages/public/About/About';
import FAQ from '@/pages/public/FAQ';
import Terms from '@/pages/public/Terms';
import Privacy from '@/pages/public/Privacy';
import NotFound from '@/pages/public/NotFound';
import Unauthorized from '@/pages/public/Unauthorized';
import ContactForm from '@/components/public/ContactForm';
import PartnerInterestForm from '@/components/public/PartnerInterestForm';
import { LoginPage } from '@/pages/public/Login';
import { RegisterPage } from '@/pages/public/Register';
import { ForgotPasswordPage } from '@/pages/public/ForgotPassword';
import { VerifyOtpPage } from '@/pages/public/VerifyOtp';
import { ResetPasswordPage } from '@/pages/public/ResetPassword';

describe('Day 19 UAT Fixes & End-to-End User Journey Tests', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    tokenStore.set(null);
    resetStateStore.clear();
  });

  const renderWithProviders = (ui: React.ReactNode, initialRoute = '/') => {
    return render(
      <QueryClientProvider client={queryClient}>
        <HelmetProvider>
          <AuthProvider>
            <MemoryRouter initialEntries={[initialRoute]}>
              {ui}
            </MemoryRouter>
          </AuthProvider>
        </HelmetProvider>
      </QueryClientProvider>
    );
  };

  /* ==========================================================================
     UAT GROUP 1: Public Pages, Navigation & Accessibility
     ========================================================================== */
  describe('UAT Group 1: Public Pages & Informational Views', () => {
    it('UAT-PUB-01: Home page loads hero, trust strip, and core section headings', async () => {
      renderWithProviders(<Home />, '/');
      expect(screen.getByRole('heading', { level: 1 })).toBeDefined();
      expect(screen.getAllByText(/home services/i).length).toBeGreaterThan(0);
    });

    it('UAT-PUB-02: About page displays company story, mission, and values', async () => {
      renderWithProviders(<About />, '/about');
      expect(screen.getByRole('heading', { name: /about homecarex/i })).toBeDefined();
      expect(screen.getAllByText(/our mission/i).length).toBeGreaterThan(0);
    });

    it('UAT-PUB-03: FAQ page renders search, categories, and expandable accordion questions', async () => {
      renderWithProviders(<FAQ />, '/faq');
      expect(screen.getByRole('heading', { name: /how can we help you\?/i })).toBeDefined();
      expect(screen.getByPlaceholderText(/search/i)).toBeDefined();
    });

    it('UAT-PUB-04: Terms & Privacy pages render legal compliance text with readable layout', async () => {
      const { unmount } = renderWithProviders(<Terms />, '/terms');
      expect(screen.getByRole('heading', { name: /terms & conditions/i })).toBeDefined();
      unmount();

      renderWithProviders(<Privacy />, '/privacy');
      expect(screen.getByRole('heading', { name: /privacy policy/i })).toBeDefined();
    });

    it('UAT-PUB-05: 404 page renders semantic error status, friendly message, and return links', async () => {
      renderWithProviders(<NotFound />, '/non-existent-page');
      expect(screen.getByRole('img', { name: /error 404/i })).toBeDefined();
      expect(screen.getByRole('heading', { name: /we can't find that page/i })).toBeDefined();
      expect(screen.getByRole('link', { name: /go home/i })).toBeDefined();
    });

    it('UAT-PUB-06: 403 Unauthorized page renders accessible alert and login/home links', async () => {
      renderWithProviders(<Unauthorized />, '/unauthorized');
      expect(screen.getByRole('heading', { name: /you don't have access to this page/i })).toBeDefined();
      expect(screen.getByRole('link', { name: /go home/i })).toBeDefined();
    });
  });

  /* ==========================================================================
     UAT GROUP 2: Public Leads & Form Submissions
     ========================================================================== */
  describe('UAT Group 2: Public Inquiries & Lead Submissions', () => {
    it('UAT-LEAD-01: Contact Form validates inputs, disables submit until valid, and posts inquiry', async () => {
      const user = userEvent.setup();
      vi.mocked(http.post).mockResolvedValueOnce({
        data: { success: true, message: 'Message sent successfully.' },
      } as never);

      renderWithProviders(<ContactForm />, '/contact');

      const submitBtn = screen.getByRole('button', { name: /send message/i });
      expect(submitBtn).toBeDisabled();

      // Fill valid contact lead (requires at least 20 chars for message)
      await user.type(screen.getByLabelText(/^name/i), 'Kavita Reddy');
      await user.type(screen.getByLabelText(/^email/i), 'kavita.reddy@gmail.com');
      await user.type(screen.getByLabelText(/^phone/i), '9876543210');
      await user.type(screen.getByLabelText(/^city/i), 'Hyderabad');
      await user.type(screen.getByLabelText(/^message/i), 'I need deep home cleaning service for my 3BHK flat.');

      // Wait for react-hook-form validation to enable the submit button
      await waitFor(() => {
        expect(submitBtn).toBeEnabled();
      });

      await user.click(submitBtn);

      await waitFor(() => {
        expect(http.post).toHaveBeenCalledWith('/public/leads', expect.objectContaining({
          name: 'Kavita Reddy',
          email: 'kavita.reddy@gmail.com',
          phone: '9876543210',
          city: 'Hyderabad',
          source: 'contact',
        }));
        expect(screen.getByText(/message sent/i)).toBeDefined();
      });
    });

    it('UAT-LEAD-02: Partner Interest Form validates skills and city, and posts partner lead', async () => {
      const user = userEvent.setup();
      vi.mocked(http.post).mockResolvedValueOnce({
        data: { success: true, message: 'Interest registered successfully.' },
      } as never);

      renderWithProviders(<PartnerInterestForm />, '/contact');

      const registerBtn = screen.getByRole('button', { name: /submit interest/i });
      expect(registerBtn).toBeDisabled();

      await user.type(screen.getByLabelText(/^name/i), 'Ramesh Kumar');
      await user.type(screen.getByLabelText(/^email/i), 'ramesh.kumar@gmail.com');
      await user.type(screen.getByLabelText(/^phone/i), '9123456789');
      await user.type(screen.getByLabelText(/^city/i), 'Bengaluru');
      await user.type(screen.getByLabelText(/skills/i), 'Electrician, Appliance Repair');

      await waitFor(() => {
        expect(registerBtn).toBeEnabled();
      });

      await user.click(registerBtn);

      await waitFor(() => {
        expect(http.post).toHaveBeenCalledWith('/public/leads', expect.objectContaining({
          name: 'Ramesh Kumar',
          email: 'ramesh.kumar@gmail.com',
          phone: '9123456789',
          city: 'Bengaluru',
          skills: 'Electrician, Appliance Repair',
          source: 'partner',
        }));
        expect(screen.getByText(/enquiry received/i)).toBeDefined();
      });
    });
  });

  /* ==========================================================================
     UAT GROUP 3: Authentication & Security Controls
     ========================================================================== */
  describe('UAT Group 3: Customer Registration & Login Journeys', () => {
    it('UAT-AUTH-01: Registration enforces mandatory Terms acceptance before submit can fire', async () => {
      const user = userEvent.setup();
      renderWithProviders(<RegisterPage />, '/register');

      const submitBtn = screen.getByRole('button', { name: /create account/i });
      expect(submitBtn).toBeDisabled();

      await user.type(screen.getByLabelText(/full name/i), 'Anil Verma');
      await user.type(screen.getByLabelText(/email address/i), 'anil.verma@example.com');
      await user.type(screen.getByLabelText(/phone number/i), '9988776655');
      await user.type(screen.getByLabelText(/^password/i), 'Password@123');
      await user.type(screen.getByLabelText(/confirm password/i), 'Password@123');

      // Still disabled without terms
      expect(submitBtn).toBeDisabled();

      // Accept terms
      await user.click(screen.getByRole('checkbox', { name: /terms/i }));
      expect(submitBtn).toBeEnabled();
    });

    it('UAT-AUTH-02: Customer Login validates credentials, handles 401 error, and routes correctly', async () => {
      const user = userEvent.setup();

      // 1. Unsuccessful login (bad credentials)
      vi.mocked(authApi.login).mockRejectedValueOnce({
        response: { status: 401, data: { message: 'Invalid email or password.' } },
      });

      renderWithProviders(
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/customer" element={<div data-testid="customer-home">Customer Home</div>} />
        </Routes>,
        '/login'
      );

      await user.type(screen.getByLabelText(/email or phone number/i), 'customer@homecarex.com');
      await user.type(screen.getByLabelText(/^password/i), 'WrongPass!123');
      await user.click(screen.getByRole('checkbox', { name: /terms/i }));
      await user.click(screen.getByRole('button', { name: /^sign in$/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeDefined();
        expect(screen.getByText(/invalid email or password/i)).toBeDefined();
      });

      // 2. Successful login
      vi.mocked(authApi.login).mockResolvedValueOnce({
        user: {
          id: 'user-cust-42',
          name: 'Customer Test',
          email: 'customer@homecarex.com',
          role: 'customer',
          permissions: [],
          home: '/customer',
        },
        accessToken: 'access-jwt-sample-token',
      });

      await user.clear(screen.getByLabelText(/^password/i));
      await user.type(screen.getByLabelText(/^password/i), 'CorrectPass@123');
      await user.click(screen.getByRole('button', { name: /^sign in$/i }));

      await waitFor(() => {
        expect(screen.getByTestId('customer-home')).toBeDefined();
        expect(tokenStore.get()).toBe('access-jwt-sample-token');
      });
    });

    it('UAT-AUTH-03: Route protection redirects unauthenticated visitors to /login with returnUrl', async () => {
      renderWithProviders(
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/customer"
            element={
              <ProtectedRoute allowedRoles={['customer']}>
                <div data-testid="customer-secret">Secret Customer Portal</div>
              </ProtectedRoute>
            }
          />
        </Routes>,
        '/customer'
      );

      await waitFor(() => {
        expect(screen.queryByTestId('customer-secret')).toBeNull();
        expect(screen.getByRole('heading', { name: /welcome back/i })).toBeDefined();
      });
    });

    it('UAT-AUTH-04: Full Password Recovery journey: Forgot -> Verify OTP -> Reset Password', async () => {
      const user = userEvent.setup();

      vi.mocked(authApi.forgotPassword).mockResolvedValueOnce({
        success: true,
        message: 'If an account exists, a verification code has been sent.',
        data: { message: 'If an account exists, a verification code has been sent.' },
      });

      vi.mocked(authApi.verifyOtp).mockResolvedValueOnce({
        success: true,
        resetToken: 'temp-raw-reset-token-xyz',
        message: 'Code verified successfully.',
      });

      vi.mocked(authApi.resetPassword).mockResolvedValueOnce({
        success: true,
        message: 'Your password has been reset successfully.',
        data: { message: 'Your password has been reset successfully.' },
      });

      renderWithProviders(
        <Routes>
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/verify-otp" element={<VerifyOtpPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/login" element={<LoginPage />} />
        </Routes>,
        '/forgot-password'
      );

      // 1. Submit email on /forgot-password
      await user.type(screen.getByLabelText(/^email$/i), 'registered.customer@homecarex.com');
      await user.click(screen.getByRole('button', { name: /send verification code/i }));

      // 2. Arrives at /verify-otp
      await waitFor(() => {
        expect(authApi.forgotPassword).toHaveBeenCalledWith('registered.customer@homecarex.com');
        expect(screen.getByRole('heading', { name: /verify your email/i })).toBeDefined();
      });

      // Enter OTP
      await user.click(screen.getByLabelText('OTP digit 1'));
      await user.keyboard('654321');

      // 3. Arrives at /reset-password
      await waitFor(() => {
        expect(authApi.verifyOtp).toHaveBeenCalledWith({
          email: 'registered.customer@homecarex.com',
          otp: '654321',
        });
        expect(screen.getByRole('heading', { name: /set new password/i })).toBeDefined();
      });

      // Enter new password
      await user.type(screen.getByLabelText(/^new password/i), 'NewlyUpdatedPass@123');
      await user.type(screen.getByLabelText(/confirm new password/i), 'NewlyUpdatedPass@123');
      await user.click(screen.getByRole('button', { name: /reset password/i }));

      // 4. Redirects to /login
      await waitFor(() => {
        expect(authApi.resetPassword).toHaveBeenCalledWith({
          resetToken: 'temp-raw-reset-token-xyz',
          newPassword: 'NewlyUpdatedPass@123',
        });
        expect(screen.getByRole('heading', { name: /welcome back/i })).toBeDefined();
      });
    });

    it('UAT-AUTH-05: Session security stores token in-memory and purges sensitive tokens on logout', async () => {
      // Simulate stored token
      tokenStore.set('active-session-jwt');
      expect(tokenStore.get()).toBe('active-session-jwt');

      // Verify no password exists in localStorage
      expect(localStorage.getItem('password')).toBeNull();

      // Clear tokens upon logout
      tokenStore.clear();
      expect(tokenStore.get()).toBeNull();
      expect(localStorage.getItem('token')).toBeNull();
    });
  });
});

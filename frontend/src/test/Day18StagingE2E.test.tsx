import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HelmetProvider } from 'react-helmet-async';

import { tokenStore } from '@/lib/tokenStore';
import { resetStateStore } from '@/features/auth/resetStateStore';
import { authApi } from '@/services/authApi';
import { AuthProvider } from '@/context/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';

import { LoginPage } from '@/pages/public/Login';
import { RegisterPage } from '@/pages/public/Register';
import { ForgotPasswordPage } from '@/pages/public/ForgotPassword';
import { VerifyOtpPage } from '@/pages/public/VerifyOtp';
import { ResetPasswordPage } from '@/pages/public/ResetPassword';

// Mock authApi
vi.mock('@/services/authApi', () => ({
  authApi: {
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    forgotPassword: vi.fn(),
    verifyOtp: vi.fn(),
    resendOtp: vi.fn(),
    resetPassword: vi.fn(),
    me: vi.fn(),
  },
}));

// Mock recaptcha
vi.mock('@/features/public/recaptcha', () => ({
  isRecaptchaConfigured: false,
  loadRecaptcha: vi.fn(),
}));

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

const renderWithProviders = (initialRoute = '/') => {
  const queryClient = createTestQueryClient();
  return render(
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter initialEntries={[initialRoute]}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/verify-otp" element={<VerifyOtpPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/unauthorized" element={<div data-testid="unauthorized-page">Unauthorized Access</div>} />
              
              {/* Protected Dashboards */}
              <Route
                path="/customer"
                element={
                  <ProtectedRoute allowedRoles={['customer']}>
                    <div data-testid="customer-dashboard">Customer Dashboard</div>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/partner"
                element={
                  <ProtectedRoute allowedRoles={['partner']}>
                    <div data-testid="partner-dashboard">Partner Dashboard</div>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <div data-testid="admin-dashboard">Admin Dashboard</div>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    </HelmetProvider>
  );
};

describe('Day 18 Staging E2E — Visitor Journey, Authentication & Security', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    tokenStore.set(null);
    resetStateStore.clear();
  });

  /* ==========================================================================
     PHASE 3A: Registration (/register)
     ========================================================================== */
  describe('Phase 3A: Visitor Registration Journey', () => {
    it('REG-01: Valid registration submits correct payload and redirects to /customer', async () => {
      const user = userEvent.setup();
      vi.mocked(authApi.register).mockResolvedValueOnce({
        user: {
          id: 'cust-new-1',
          name: 'Priya Sharma',
          email: 'priya.sharma@example.com',
          phone: '9876543210',
          role: 'customer',
          home: '/customer',
        },
        accessToken: 'access-token-test-123',
      });

      renderWithProviders('/register');

      // Fill in valid registration details
      await user.type(screen.getByLabelText(/full name/i), 'Priya Sharma');
      await user.type(screen.getByLabelText(/email address/i), 'priya.sharma@example.com');
      await user.type(screen.getByLabelText(/phone number/i), '9876543210');
      await user.type(screen.getByLabelText(/^password/i), 'SecurePass@123');
      await user.type(screen.getByLabelText(/confirm password/i), 'SecurePass@123');
      
      // Accept terms
      await user.click(screen.getByRole('checkbox', { name: /terms/i }));

      // Submit
      await user.click(screen.getByRole('button', { name: /create account/i }));

      await waitFor(() => {
        expect(authApi.register).toHaveBeenCalledWith({
          name: 'Priya Sharma',
          email: 'priya.sharma@example.com',
          phone: '9876543210',
          password: 'SecurePass@123',
          confirmPassword: 'SecurePass@123',
          referralCode: undefined,
          role: 'customer',
        });
        expect(screen.getByTestId('customer-dashboard')).toBeDefined();
      });
    });

    it('REG-02: Disables submit button until Terms & Conditions checkbox is accepted', async () => {
      const user = userEvent.setup();
      renderWithProviders('/register');

      await user.type(screen.getByLabelText(/full name/i), 'Priya Sharma');
      await user.type(screen.getByLabelText(/email address/i), 'priya.sharma@example.com');
      await user.type(screen.getByLabelText(/phone number/i), '9876543210');
      await user.type(screen.getByLabelText(/^password/i), 'SecurePass@123');
      await user.type(screen.getByLabelText(/confirm password/i), 'SecurePass@123');

      const submitBtn = screen.getByRole('button', { name: /create account/i });
      expect(submitBtn).toBeDisabled();
      expect(authApi.register).not.toHaveBeenCalled();

      // Check terms enables button
      await user.click(screen.getByRole('checkbox', { name: /terms/i }));
      expect(submitBtn).not.toBeDisabled();
    });

    it('REG-03: Rejects invalid email and malformed non-Indian phone number', async () => {
      const user = userEvent.setup();
      renderWithProviders('/register');

      await user.type(screen.getByLabelText(/full name/i), 'Priya Sharma');
      await user.type(screen.getByLabelText(/email address/i), 'invalid-email');
      await user.type(screen.getByLabelText(/phone number/i), '12345');
      await user.type(screen.getByLabelText(/^password/i), 'SecurePass@123');
      await user.type(screen.getByLabelText(/confirm password/i), 'SecurePass@123');
      await user.click(screen.getByRole('checkbox', { name: /terms/i }));

      await user.click(screen.getByRole('button', { name: /create account/i }));

      expect(authApi.register).not.toHaveBeenCalled();
      expect(screen.getByText(/Please enter a valid email address/i)).toBeDefined();
      expect(screen.getByText(/Please enter a valid 10-digit Indian mobile number/i)).toBeDefined();
    });

    it('REG-04: Rejects mismatched password confirmation', async () => {
      const user = userEvent.setup();
      renderWithProviders('/register');

      await user.type(screen.getByLabelText(/full name/i), 'Priya Sharma');
      await user.type(screen.getByLabelText(/email address/i), 'priya.sharma@example.com');
      await user.type(screen.getByLabelText(/phone number/i), '9876543210');
      await user.type(screen.getByLabelText(/^password/i), 'SecurePass@123');
      await user.type(screen.getByLabelText(/confirm password/i), 'DifferentPass@456');
      await user.click(screen.getByRole('checkbox', { name: /terms/i }));

      await user.click(screen.getByRole('button', { name: /create account/i }));

      expect(authApi.register).not.toHaveBeenCalled();
      expect(screen.getByText(/Passwords do not match/i)).toBeDefined();
    });
  });

  /* ==========================================================================
     PHASE 3B: Login Journey (/login)
     ========================================================================== */
  describe('Phase 3B: Login Journey & Role Redirects', () => {
    it('LOG-01: Successful Customer login redirects to /customer dashboard', async () => {
      const user = userEvent.setup();
      vi.mocked(authApi.login).mockResolvedValueOnce({
        user: {
          id: 'cust-1',
          name: 'Test Customer',
          email: 'customer@homecarex.com',
          role: 'customer',
          home: '/customer',
        },
        accessToken: 'access-customer-token',
      });

      renderWithProviders('/login');

      await user.type(screen.getByLabelText(/email or phone number/i), 'customer@homecarex.com');
      await user.type(screen.getByLabelText(/^password/i), 'Admin@123');
      await user.click(screen.getByRole('checkbox', { name: /terms/i }));
      await user.click(screen.getByRole('button', { name: /^sign in$/i }));

      await waitFor(() => {
        expect(authApi.login).toHaveBeenCalledWith({
          email: 'customer@homecarex.com',
          password: 'Admin@123',
        });
        expect(screen.getByTestId('customer-dashboard')).toBeDefined();
      });
    });

    it('LOG-02: Successful Partner login redirects to /partner dashboard', async () => {
      const user = userEvent.setup();
      vi.mocked(authApi.login).mockResolvedValueOnce({
        user: {
          id: 'partner-1',
          name: 'Test Partner',
          email: 'partner@homecarex.com',
          role: 'partner',
          home: '/partner',
        },
        accessToken: 'access-partner-token',
      });

      renderWithProviders('/login');

      await user.type(screen.getByLabelText(/email or phone number/i), 'partner@homecarex.com');
      await user.type(screen.getByLabelText(/^password/i), 'Admin@123');
      await user.click(screen.getByRole('checkbox', { name: /terms/i }));
      await user.click(screen.getByRole('button', { name: /^sign in$/i }));

      await waitFor(() => {
        expect(screen.getByTestId('partner-dashboard')).toBeDefined();
      });
    });

    it('LOG-03: Displays error alert when credentials are invalid', async () => {
      const user = userEvent.setup();
      vi.mocked(authApi.login).mockRejectedValueOnce({
        response: {
          status: 401,
          data: { success: false, message: 'Invalid email or password. Please try again.' },
        },
      });

      renderWithProviders('/login');

      await user.type(screen.getByLabelText(/email or phone number/i), 'customer@homecarex.com');
      await user.type(screen.getByLabelText(/^password/i), 'WrongPass!123');
      await user.click(screen.getByRole('checkbox', { name: /terms/i }));
      await user.click(screen.getByRole('button', { name: /^sign in$/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/Invalid email or password/i);
      });
    });

    it('LOG-04: Password visibility toggle toggles between password and text input types', async () => {
      const user = userEvent.setup();
      renderWithProviders('/login');

      const passwordInput = screen.getByLabelText(/^password/i) as HTMLInputElement;
      expect(passwordInput.type).toBe('password');

      const toggleButton = screen.getByRole('button', { name: /show password/i });
      await user.click(toggleButton);

      expect(passwordInput.type).toBe('text');

      const hideButton = screen.getByRole('button', { name: /hide password/i });
      await user.click(hideButton);

      expect(passwordInput.type).toBe('password');
    });
  });

  /* ==========================================================================
     PHASE 3C: Session & Security Standards
     ========================================================================== */
  describe('Phase 3C: Session & Cookie Security Standards', () => {
    it('SEC-01: Passwords and access credentials are never stored insecurely in localStorage', async () => {
      const user = userEvent.setup();
      vi.mocked(authApi.login).mockResolvedValueOnce({
        user: {
          id: 'cust-1',
          name: 'Test Customer',
          email: 'customer@homecarex.com',
          role: 'customer',
          home: '/customer',
        },
        accessToken: 'super-secret-jwt-token-xyz',
      });

      renderWithProviders('/login');

      await user.type(screen.getByLabelText(/email or phone number/i), 'customer@homecarex.com');
      await user.type(screen.getByLabelText(/^password/i), 'Admin@123');
      await user.click(screen.getByRole('checkbox', { name: /remember me/i }));
      await user.click(screen.getByRole('checkbox', { name: /terms/i }));
      await user.click(screen.getByRole('button', { name: /^sign in$/i }));

      await waitFor(() => {
        expect(screen.getByTestId('customer-dashboard')).toBeDefined();
      });

      // Storage security audits:
      // Cleartext/base64 passwords must NEVER be saved in localStorage
      expect(localStorage.getItem('homecarex_remembered_credentials')).toBeNull();
      expect(localStorage.getItem('homecarex_remembered_password')).toBeNull();
      expect(sessionStorage.getItem('password')).toBeNull();

      // Only non-sensitive identifier (email/phone) is remembered:
      expect(localStorage.getItem('homecarex_remembered_identifier')).toBe('customer@homecarex.com');
      // Token is tracked via tokenStore:
      expect(tokenStore.get()).toBe('super-secret-jwt-token-xyz');
    });

    it('SEC-02: Unauthenticated access to protected route redirects to /login', async () => {
      tokenStore.set(null);
      renderWithProviders('/customer');

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /welcome back/i })).toBeDefined();
      });
    });
  });

  /* ==========================================================================
     PHASE 4: Password Recovery Flow End-to-End
     ========================================================================== */
  describe('Phase 4: Password Recovery Flow End-to-End', () => {
    it('REC-01: Full recovery journey from Forgot Password to OTP Verification to Reset Password', async () => {
      const user = userEvent.setup();

      // 1. Forgot Password Step
      vi.mocked(authApi.forgotPassword).mockResolvedValueOnce({
        success: true,
        message: 'If an account exists, a verification code has been sent.',
      });

      renderWithProviders('/forgot-password');

      await user.type(screen.getByLabelText(/^email$/i), 'customer@homecarex.com');
      await user.click(screen.getByRole('button', { name: /send verification code/i }));

      await waitFor(() => {
        expect(authApi.forgotPassword).toHaveBeenCalledWith('customer@homecarex.com');
        expect(resetStateStore.getEmail()).toBe('customer@homecarex.com');
        expect(screen.getByRole('heading', { name: /verify your email/i })).toBeDefined();
      });

      // 2. OTP Verification Step
      vi.mocked(authApi.verifyOtp).mockResolvedValueOnce({
        success: true,
        resetToken: 'temp-raw-reset-token-789',
        message: 'Code verified successfully.',
      });

      // Enter 6-digit OTP
      const box1 = screen.getByLabelText('OTP digit 1');
      await user.click(box1);
      await user.keyboard('123456');

      // The OtpInput automatically triggers onComplete
      await waitFor(() => {
        expect(authApi.verifyOtp).toHaveBeenCalledWith({
          email: 'customer@homecarex.com',
          otp: '123456',
        });
        expect(resetStateStore.getResetToken()).toBe('temp-raw-reset-token-789');
        expect(screen.getByRole('heading', { name: /set new password/i })).toBeDefined();
      });

      // 3. Reset Password Step
      vi.mocked(authApi.resetPassword).mockResolvedValueOnce({
        success: true,
        message: 'Your password has been reset successfully.',
      });

      await user.type(screen.getByLabelText(/^new password/i), 'BrandNewPass@999');
      await user.type(screen.getByLabelText(/confirm new password/i), 'BrandNewPass@999');
      await user.click(screen.getByRole('button', { name: /reset password/i }));

      await waitFor(() => {
        expect(authApi.resetPassword).toHaveBeenCalledWith({
          resetToken: 'temp-raw-reset-token-789',
          newPassword: 'BrandNewPass@999',
        });
        // Secret reset token cleared immediately from runtime memory
        expect(resetStateStore.getResetToken()).toBeNull();
        // Redirected back to login
        expect(screen.getByRole('heading', { name: /welcome back/i })).toBeDefined();
      });
    });

    it('REC-02: OTP verification keeps button disabled when fewer than 6 digits are entered', async () => {
      const user = userEvent.setup();
      resetStateStore.setEmail('customer@homecarex.com');

      renderWithProviders('/verify-otp');

      const box1 = screen.getByLabelText('OTP digit 1');
      await user.click(box1);
      await user.keyboard('123'); // only 3 digits

      const verifyBtn = screen.getByRole('button', { name: /verify code/i });
      expect(verifyBtn).toBeDisabled();
      expect(authApi.verifyOtp).not.toHaveBeenCalled();
    });
  });
});

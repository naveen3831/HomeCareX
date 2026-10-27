import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HelmetProvider } from 'react-helmet-async';
import { LoginPage } from '../pages/public/Login';
import { AuthProvider } from '../context/AuthContext';
import { authApi } from '@/services/authApi';

vi.mock('@/services/authApi', () => ({
  authApi: {
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    me: vi.fn(),
    refresh: vi.fn(),
    forgotPassword: vi.fn(),
    verifyOtp: vi.fn(),
    resetPassword: vi.fn(),
    resendOtp: vi.fn(),
  },
}));

vi.mock('@/features/public/recaptcha', () => ({
  isRecaptchaConfigured: false,
  loadRecaptcha: vi.fn(),
}));

describe('Remember Me Verification Suite — LoginPage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  const renderLoginPage = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <HelmetProvider>
          <AuthProvider>
            <MemoryRouter initialEntries={['/login']}>
              <LoginPage />
            </MemoryRouter>
          </AuthProvider>
        </HelmetProvider>
      </QueryClientProvider>
    );
  };

  it('1. Pre-fills identifier and checks "Remember me" checkbox when saved in localStorage', () => {
    localStorage.setItem('homecarex_remembered_identifier', 'saved.customer@homecarex.com');

    renderLoginPage();

    const identifierInput = screen.getByLabelText(/email or phone number/i) as HTMLInputElement;
    const passwordInput = screen.getByLabelText(/^password/i) as HTMLInputElement;
    const rememberCheckbox = screen.getByRole('checkbox', { name: /remember me/i }) as HTMLInputElement;

    // Verify identifier is pre-filled:
    expect(identifierInput.value).toBe('saved.customer@homecarex.com');
    // Verify password is blank (NEVER pre-filled):
    expect(passwordInput.value).toBe('');
    // Verify "Remember me" is checked by default when saved:
    expect(rememberCheckbox.checked).toBe(true);
  });

  it('2. Saves identifier to localStorage when "Remember me" is checked during successful login', async () => {
    const user = userEvent.setup();
    vi.mocked(authApi.login).mockResolvedValueOnce({
      user: {
        id: 'cust-101',
        name: 'Saved User',
        email: 'user@homecarex.com',
        role: 'customer',
        permissions: [],
        home: '/customer',
      },
      accessToken: 'dummy-token',
    });

    renderLoginPage();

    const identifierInput = screen.getByLabelText(/email or phone number/i);
    const passwordInput = screen.getByLabelText(/^password/i);
    const rememberCheckbox = screen.getByRole('checkbox', { name: /remember me/i });
    const termsCheckbox = screen.getByRole('checkbox', { name: /terms/i });

    await user.type(identifierInput, 'user@homecarex.com');
    await user.type(passwordInput, 'ValidPass@123');
    await user.click(rememberCheckbox); // check Remember me
    await user.click(termsCheckbox);

    const submitBtn = screen.getByRole('button', { name: /sign in/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(authApi.login).toHaveBeenCalledWith({
        email: 'user@homecarex.com',
        password: 'ValidPass@123',
      });
      // Verifies storage has saved identifier:
      expect(localStorage.getItem('homecarex_remembered_identifier')).toBe('user@homecarex.com');
      // Verifies password is NEVER stored:
      expect(localStorage.getItem('homecarex_remembered_credentials')).toBeNull();
      expect(localStorage.getItem('password')).toBeNull();
    });
  });

  it('3. Clears identifier from localStorage when "Remember me" is UNCHECKED during login', async () => {
    const user = userEvent.setup();
    // Simulate previously saved identifier
    localStorage.setItem('homecarex_remembered_identifier', 'old.user@homecarex.com');

    vi.mocked(authApi.login).mockResolvedValueOnce({
      user: {
        id: 'cust-102',
        name: 'Another User',
        email: 'old.user@homecarex.com',
        role: 'customer',
        permissions: [],
        home: '/customer',
      },
      accessToken: 'dummy-token',
    });

    renderLoginPage();

    const rememberCheckbox = screen.getByRole('checkbox', { name: /remember me/i }) as HTMLInputElement;
    expect(rememberCheckbox.checked).toBe(true);

    // Uncheck "Remember me"
    await user.click(rememberCheckbox);
    expect(rememberCheckbox.checked).toBe(false);

    const passwordInput = screen.getByLabelText(/^password/i);
    const termsCheckbox = screen.getByRole('checkbox', { name: /terms/i });

    await user.type(passwordInput, 'ValidPass@123');
    await user.click(termsCheckbox);

    const submitBtn = screen.getByRole('button', { name: /sign in/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(authApi.login).toHaveBeenCalled();
      // Verifies identifier was cleared from localStorage:
      expect(localStorage.getItem('homecarex_remembered_identifier')).toBeNull();
    });
  });

  it('4. Sanitizes legacy insecure credentials upon page load', () => {
    // Simulate legacy app version storing raw password
    localStorage.setItem(
      'homecarex_remembered_credentials',
      JSON.stringify({ identifier: 'victim@homecarex.com', password: 'plain_password_leak' })
    );

    renderLoginPage();

    // Must be purged immediately on load
    expect(localStorage.getItem('homecarex_remembered_credentials')).toBeNull();
  });
});

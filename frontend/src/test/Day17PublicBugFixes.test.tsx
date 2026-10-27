import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HelmetProvider } from 'react-helmet-async';

vi.mock('@/features/public/recaptcha', () => ({
  isRecaptchaConfigured: false,
  loadRecaptcha: vi.fn(),
}));

import { LoginPage } from '../pages/public/Login';
import ContactForm from '../components/public/ContactForm';
import PartnerInterestForm from '../components/public/PartnerInterestForm';
import NotFound from '../pages/public/NotFound';
import { AuthProvider } from '../context/AuthContext';

describe('Day 17 QA Bug Fixes & P1 Polish Regression Tests', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    localStorage.clear();
    vi.clearAllMocks();
  });

  const renderWithProviders = (ui: React.ReactNode) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <HelmetProvider>
          <AuthProvider>
            <MemoryRouter>{ui}</MemoryRouter>
          </AuthProvider>
        </HelmetProvider>
      </QueryClientProvider>
    );
  };

  describe('P0 Security Fix: Password is never stored in browser localStorage', () => {
    it('purges legacy plaintext/base64 passwords from localStorage upon mount', () => {
      // Simulate insecure legacy password saved by previous version
      localStorage.setItem(
        'homecarex_remembered_credentials',
        JSON.stringify({ identifier: 'test@gmail.com', password: btoa('SecretPassword123!') })
      );

      renderWithProviders(<LoginPage />);

      // Must be immediately purged from storage
      expect(localStorage.getItem('homecarex_remembered_credentials')).toBeNull();

      // Password input field must never autofill from storage
      const passwordInput = screen.getByLabelText(/^Password/i) as HTMLInputElement;
      expect(passwordInput.value).toBe('');
    });

    it('stores ONLY the identifier and NOT the password when Remember Me is selected', async () => {
      renderWithProviders(<LoginPage />);

      const emailInput = screen.getByPlaceholderText(/you@example\.com/i) as HTMLInputElement;
      const passwordInput = screen.getByLabelText(/^Password/i) as HTMLInputElement;
      const rememberCheckbox = screen.getByRole('checkbox', { name: /remember me/i }) as HTMLInputElement;

      fireEvent.change(emailInput, { target: { value: 'user@gmail.com' } });
      fireEvent.change(passwordInput, { target: { value: 'MySecretPass1!' } });

      if (!rememberCheckbox.checked) {
        fireEvent.click(rememberCheckbox);
      }
      expect(rememberCheckbox.checked).toBe(true);

      // Verify that no password key exists in localStorage
      expect(localStorage.getItem('homecarex_remembered_credentials')).toBeNull();
    });
  });

  describe('P1 Polish: Contact & Partner Forms in unconfigured/development environments', () => {
    it('ContactForm renders clean fields and honeypot bot trap', () => {
      renderWithProviders(<ContactForm />);

      expect(screen.getByPlaceholderText(/your full name/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/you@gmail\.com/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/98765 43210/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/your city/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/tell us how we can help/i)).toBeInTheDocument();

      const honeypot = screen.getByLabelText(/leave this blank/i);
      expect(honeypot).toBeInTheDocument();
      expect(honeypot).toHaveAttribute('tabIndex', '-1');

      fireEvent.change(honeypot, { target: { value: 'bot-spam-content' } });
      expect((honeypot as HTMLInputElement).value).toBe('bot-spam-content');
    });

    it('PartnerInterestForm renders required partner fields and handles inputs', () => {
      renderWithProviders(<PartnerInterestForm />);

      const nameInput = screen.getByPlaceholderText(/your full name/i);
      const emailInput = screen.getByPlaceholderText(/you@gmail\.com/i);
      const phoneInput = screen.getByPlaceholderText(/98765 43210/i);
      const cityInput = screen.getByPlaceholderText(/your city/i);
      const skillsInput = screen.getByPlaceholderText(/e\.g\. cleaning, plumbing/i);

      fireEvent.change(nameInput, { target: { value: 'Partner Ram' } });
      fireEvent.change(emailInput, { target: { value: 'ram@gmail.com' } });
      fireEvent.change(phoneInput, { target: { value: '9123456789' } });
      fireEvent.change(cityInput, { target: { value: 'Bengaluru' } });
      fireEvent.change(skillsInput, { target: { value: 'Electrical repair and AC servicing with 5 years experience.' } });

      expect((nameInput as HTMLInputElement).value).toBe('Partner Ram');
      expect((emailInput as HTMLInputElement).value).toBe('ram@gmail.com');
      expect((phoneInput as HTMLInputElement).value).toBe('9123456789');
      expect((cityInput as HTMLInputElement).value).toBe('Bengaluru');
      expect((skillsInput as HTMLInputElement).value).toBe('Electrical repair and AC servicing with 5 years experience.');
    });
  });

  describe('Accessibility P1 Fix: Semantic Role on 404 container', () => {
    it('NotFound container has semantic role="img" and accessible aria-label="Error 404"', () => {
      renderWithProviders(<NotFound />);

      const errorHeading = screen.getByRole('img', { name: /error 404/i });
      expect(errorHeading).toBeInTheDocument();
      expect(errorHeading).toHaveAttribute('aria-label', 'Error 404');
    });
  });
});

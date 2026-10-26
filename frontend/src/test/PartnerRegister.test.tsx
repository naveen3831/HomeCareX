import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PartnerRegisterPage from '../pages/public/PartnerRegister';
import Contact from '../pages/public/Contact/Contact';
import LoginPage from '../pages/public/Login';
import { AuthContext } from '../context/AuthContext';
import { HelmetProvider } from 'react-helmet-async';
import type { AuthContextValue, AuthUser } from '../types/auth';

// Mock window.scrollTo
window.scrollTo = vi.fn();

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock catalogApi
vi.mock('../services/catalogApi', () => ({
  fetchCategories: vi.fn().mockResolvedValue([
    { id: 'cat-1', name: 'Cleaning & Pest Control', slug: 'cleaning' },
    { id: 'cat-2', name: 'Appliance Repair', slug: 'appliances' },
  ]),
}));

function createMockAuthContext(overrides?: Partial<AuthContextValue>): AuthContextValue {
  return {
    user: null,
    status: 'unauthenticated',
    isAuthenticated: false,
    login: vi.fn(),
    register: vi.fn().mockResolvedValue({
      id: 'partner-123',
      name: 'Ramesh Kumar',
      email: 'ramesh@example.com',
      role: 'partner',
      permissions: ['partner:dashboard'],
      home: '/partner',
    } as AuthUser),
    logout: vi.fn().mockResolvedValue(undefined),
    updateProfile: vi.fn(),
    ...overrides,
  };
}

function renderWithAuth(
  ui: React.ReactElement,
  authOverrides?: Partial<AuthContextValue>,
  initialRoute = '/register/partner'
) {
  const authValue = createMockAuthContext(authOverrides);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return {
    authValue,
    ...render(
      <HelmetProvider>
        <QueryClientProvider client={queryClient}>
          <AuthContext.Provider value={authValue}>
            <MemoryRouter initialEntries={[initialRoute]}>
              <Routes>
                <Route path="/register/partner" element={ui} />
                <Route path="/contact" element={<Contact />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/partner" element={<div>Partner Dashboard</div>} />
                <Route path="/customer" element={<div>Customer Dashboard</div>} />
              </Routes>
            </MemoryRouter>
          </AuthContext.Provider>
        </QueryClientProvider>
      </HelmetProvider>
    ),
  };
}

describe('Partner Registration Flow Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 1. Contact Page "Become a Partner" Button
  it('Contact page "Become a Partner" links to /register/partner', () => {
    renderWithAuth(<Contact />, undefined, '/contact');
    const partnerLinks = screen.getAllByRole('link', { name: /become a partner/i });
    expect(partnerLinks.length).toBeGreaterThan(0);
    expect(partnerLinks[0]).toHaveAttribute('href', '/register/partner');
  });

  // 2. Partner Registration renders with step indicator and Section A
  it('renders Step 1 (Personal Information) with required fields', () => {
    renderWithAuth(<PartnerRegisterPage />);
    expect(screen.getByText(/become a/i)).toBeInTheDocument();
    expect(screen.getByText(/partner registration/i)).toBeInTheDocument();
    expect(screen.getByText(/section a: personal information/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/gender/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/date of birth/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/mobile number/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^create password/i)).toBeInTheDocument();
  });

  // 3. Step 1 Validation: Rejects empty or invalid inputs
  it('validates required fields on Step 1 before continuing', async () => {
    const user = userEvent.setup();
    renderWithAuth(<PartnerRegisterPage />);

    const continueBtn = screen.getByRole('button', { name: /continue to step 2/i });
    await user.click(continueBtn);

    expect(screen.getByText(/full name is required/i)).toBeInTheDocument();
    expect(screen.getByText(/please select your gender/i)).toBeInTheDocument();
    expect(screen.getByText(/date of birth is required/i)).toBeInTheDocument();
    expect(screen.getByText(/mobile number is required/i)).toBeInTheDocument();
    expect(screen.getByText(/email address is required/i)).toBeInTheDocument();
    expect(screen.getByText(/password is required/i)).toBeInTheDocument();
  });

  // 4. DOB Validation: Rejects future date and under 18
  it('rejects future date and under 18 years old in DOB', async () => {
    const user = userEvent.setup();
    renderWithAuth(<PartnerRegisterPage />);

    const dobInput = screen.getByLabelText(/date of birth/i);
    const continueBtn = screen.getByRole('button', { name: /continue to step 2/i });

    // Set future date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 2);
    fireEvent.change(dobInput, { target: { value: tomorrow.toISOString().split('T')[0] } });
    await user.click(continueBtn);
    expect(screen.getByText(/date of birth cannot be in the future/i)).toBeInTheDocument();

    // Set under 18 (e.g. 5 years ago)
    const fiveYearsAgo = new Date();
    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
    fireEvent.change(dobInput, { target: { value: fiveYearsAgo.toISOString().split('T')[0] } });
    await user.click(continueBtn);
    expect(screen.getByText(/partner must be at least 18 years old/i)).toBeInTheDocument();
  });

  // 5. Phone & Email format validation
  it('rejects invalid mobile number and email format', async () => {
    const user = userEvent.setup();
    renderWithAuth(<PartnerRegisterPage />);

    const phoneInput = screen.getByLabelText(/mobile number/i);
    const emailInput = screen.getByLabelText(/email address/i);
    const continueBtn = screen.getByRole('button', { name: /continue to step 2/i });

    await user.type(phoneInput, '12345');
    await user.type(emailInput, 'notanemail');
    await user.click(continueBtn);

    expect(screen.getByText(/valid 10-digit indian mobile number/i)).toBeInTheDocument();
    expect(screen.getByText(/valid email address/i)).toBeInTheDocument();
  });

  // 6. Step transition: Step 1 -> Step 2
  it('transitions to Step 2 when Step 1 is valid, and allows Back button to preserve data', async () => {
    const user = userEvent.setup();
    renderWithAuth(<PartnerRegisterPage />);

    await user.type(screen.getByLabelText(/full name/i), 'Ramesh Kumar');
    fireEvent.change(screen.getByLabelText(/gender/i), { target: { value: 'male' } });
    fireEvent.change(screen.getByLabelText(/date of birth/i), { target: { value: '1990-05-15' } });
    await user.type(screen.getByLabelText(/mobile number/i), '9876543210');
    await user.type(screen.getByLabelText(/email address/i), 'ramesh@example.com');
    await user.type(screen.getByLabelText(/^create password/i), 'Secret123!');
    await user.type(screen.getByLabelText(/confirm password/i), 'Secret123!');

    await user.click(screen.getByRole('button', { name: /continue to step 2/i }));

    // Now in Step 2: Identity Proof
    expect(screen.getByText(/section b: identity proof/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/id proof type/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/id proof number/i)).toBeInTheDocument();

    // Click Back to ensure values were preserved
    await user.click(screen.getByRole('button', { name: /back/i }));
    expect(screen.getByText(/section a: personal information/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/full name/i)).toHaveValue('Ramesh Kumar');
    expect(screen.getByLabelText(/gender/i)).toHaveValue('male');
    expect(screen.getByLabelText(/mobile number/i)).toHaveValue('9876543210');
  });

  // 7. Identity Proof Validation (Step 2)
  it('validates Step 2 ID proof number and document attachment', async () => {
    const user = userEvent.setup();
    renderWithAuth(<PartnerRegisterPage />);

    // Fast-forward to Step 2
    await user.type(screen.getByLabelText(/full name/i), 'Ramesh Kumar');
    fireEvent.change(screen.getByLabelText(/gender/i), { target: { value: 'male' } });
    fireEvent.change(screen.getByLabelText(/date of birth/i), { target: { value: '1990-05-15' } });
    await user.type(screen.getByLabelText(/mobile number/i), '9876543210');
    await user.type(screen.getByLabelText(/email address/i), 'ramesh@example.com');
    await user.type(screen.getByLabelText(/^create password/i), 'Secret123!');
    await user.type(screen.getByLabelText(/confirm password/i), 'Secret123!');
    await user.click(screen.getByRole('button', { name: /continue to step 2/i }));

    // Click continue on Step 2 with empty fields
    await user.click(screen.getByRole('button', { name: /continue to step 3/i }));
    expect(screen.getByText(/id proof number is required/i)).toBeInTheDocument();
    expect(screen.getByText(/upload a photo or pdf of your id proof/i)).toBeInTheDocument();

    // Aadhaar format check
    await user.type(screen.getByLabelText(/id proof number/i), '1234');
    await user.click(screen.getByRole('button', { name: /continue to step 3/i }));
    expect(screen.getByText(/aadhaar must be a 12-digit number/i)).toBeInTheDocument();
  });

  // 8. Full Submission flow through Step 5
  it('completes all steps, registers partner, clears session, and redirects to /login with verification notice', async () => {
    const user = userEvent.setup();
    const { authValue } = renderWithAuth(<PartnerRegisterPage />);

    // Step 1
    await user.type(screen.getByLabelText(/full name/i), 'Ramesh Kumar');
    fireEvent.change(screen.getByLabelText(/gender/i), { target: { value: 'male' } });
    fireEvent.change(screen.getByLabelText(/date of birth/i), { target: { value: '1990-05-15' } });
    await user.type(screen.getByLabelText(/mobile number/i), '9876543210');
    await user.type(screen.getByLabelText(/email address/i), 'ramesh@example.com');
    await user.type(screen.getByLabelText(/^create password/i), 'Secret123!');
    await user.type(screen.getByLabelText(/confirm password/i), 'Secret123!');
    await user.click(screen.getByRole('button', { name: /continue to step 2/i }));

    // Step 2
    await user.type(screen.getByLabelText(/id proof number/i), '123456789012');
    // Simulate attaching file
    const fakeFile = new File(['fake id content'], 'aadhaar_card.pdf', { type: 'application/pdf' });
    const idFileInput = screen.getByLabelText(/upload id proof document/i);
    fireEvent.change(idFileInput, { target: { files: [fakeFile] } });
    expect(screen.getByText('aadhaar_card.pdf')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /continue to step 3/i }));

    // Step 3
    expect(screen.getByText(/section c: address proof/i)).toBeInTheDocument();
    await user.type(screen.getByLabelText(/street address/i), 'Plot 42, Hitech City Main Road');
    await user.type(screen.getByLabelText(/pincode/i), '500081');
    const fakeAddrFile = new File(['fake addr content'], 'electricity_bill.pdf', { type: 'application/pdf' });
    const addrFileInput = screen.getByLabelText(/upload address proof document/i);
    fireEvent.change(addrFileInput, { target: { files: [fakeAddrFile] } });
    expect(screen.getByText('electricity_bill.pdf')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /continue to step 4/i }));

    // Step 4
    expect(screen.getByText(/section d: professional details/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /continue to step 5/i }));

    // Step 5: Bank details
    expect(screen.getByText(/section e: bank & payout details/i)).toBeInTheDocument();
    expect(screen.getByText(/instant access/i)).toBeInTheDocument();

    await user.type(screen.getByLabelText(/account holder name/i), 'Ramesh Kumar');
    await user.type(screen.getByLabelText(/bank account number/i), '1234567890123');
    await user.type(screen.getByLabelText(/ifsc code/i), 'SBIN0001234');

    // Consent checkbox
    const consent = screen.getByLabelText(/i agree to the homecarex/i);
    await user.click(consent);

    // Submit
    const submitBtn = screen.getByRole('button', { name: /register as partner/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(authValue.register).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Ramesh Kumar',
          email: 'ramesh@example.com',
          phone: '9876543210',
          role: 'partner',
          gender: 'male',
          accountHolder: 'Ramesh Kumar',
          accountNumber: '1234567890123',
          ifsc: 'SBIN0001234',
        })
      );
      expect(authValue.logout).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith(
        '/login?registered=partner',
        expect.objectContaining({
          replace: true,
          state: expect.objectContaining({
            registeredEmail: 'ramesh@example.com',
            registeredMessage: expect.stringContaining('Registration successful!'),
          }),
        })
      );
    });
  });

  // 9. Error state: Displays server conflict message (409)
  it('displays API 409 conflict error without clearing form', async () => {
    const user = userEvent.setup();
    const rejectError = new Error('Duplicate account');
    (rejectError as any).status = 409;
    (rejectError as any).response = { status: 409, data: { message: 'Account already exists' } };

    renderWithAuth(<PartnerRegisterPage />, {
      register: vi.fn().mockRejectedValueOnce(rejectError),
    });

    // Step 1
    await user.type(screen.getByLabelText(/full name/i), 'Ramesh Kumar');
    fireEvent.change(screen.getByLabelText(/gender/i), { target: { value: 'male' } });
    fireEvent.change(screen.getByLabelText(/date of birth/i), { target: { value: '1990-05-15' } });
    await user.type(screen.getByLabelText(/mobile number/i), '9876543210');
    await user.type(screen.getByLabelText(/email address/i), 'ramesh@example.com');
    await user.type(screen.getByLabelText(/^create password/i), 'Secret123!');
    await user.type(screen.getByLabelText(/confirm password/i), 'Secret123!');
    await user.click(screen.getByRole('button', { name: /continue to step 2/i }));

    // Step 2
    await user.type(screen.getByLabelText(/id proof number/i), '123456789012');
    const fakeFile = new File(['fake id'], 'id.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByLabelText(/upload id proof document/i), { target: { files: [fakeFile] } });
    await user.click(screen.getByRole('button', { name: /continue to step 3/i }));

    // Step 3
    await user.type(screen.getByLabelText(/street address/i), 'Plot 42, Hitech City');
    await user.type(screen.getByLabelText(/pincode/i), '500081');
    const fakeAddrFile = new File(['fake addr'], 'addr.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByLabelText(/upload address proof document/i), { target: { files: [fakeAddrFile] } });
    await user.click(screen.getByRole('button', { name: /continue to step 4/i }));

    // Step 4
    await user.click(screen.getByRole('button', { name: /continue to step 5/i }));

    // Step 5
    await user.type(screen.getByLabelText(/account holder name/i), 'Ramesh Kumar');
    await user.type(screen.getByLabelText(/bank account number/i), '1234567890123');
    await user.type(screen.getByLabelText(/ifsc code/i), 'SBIN0001234');
    await user.click(screen.getByLabelText(/i agree to the homecarex/i));

    await user.click(screen.getByRole('button', { name: /register as partner/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/already exists/i)).toBeInTheDocument();
    });
  });

  // 10. Already authenticated user state (Partner)
  it('shows account active state for signed-in partner', () => {
    renderWithAuth(<PartnerRegisterPage />, {
      isAuthenticated: true,
      user: {
        id: 'p-1',
        name: 'Sunita Sharma',
        role: 'partner',
        permissions: ['partner:dashboard'],
        home: '/partner',
      },
    });

    expect(screen.getByText(/account already active/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /go to dashboard/i })).toHaveAttribute('href', '/partner');
  });

  // 11. Already authenticated user state (Customer)
  it('shows account active state for signed-in customer with link to dashboard', () => {
    renderWithAuth(<PartnerRegisterPage />, {
      isAuthenticated: true,
      user: {
        id: 'c-1',
        name: 'Amit Patel',
        role: 'customer',
        permissions: ['customer:dashboard'],
        home: '/customer',
      },
    });

    expect(screen.getByText(/account already active/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /go to dashboard/i })).toHaveAttribute('href', '/customer');
  });

  // 12. Login Page shows direct login message when redirected with ?registered=partner
  it('displays partner direct login banner on LoginPage when arriving with ?registered=partner', () => {
    renderWithAuth(<LoginPage />, { isAuthenticated: false, user: null }, '/login?registered=partner');

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(
      screen.getByText(/registration successful! you can now log in with your credentials/i)
    ).toBeInTheDocument();
  });
});

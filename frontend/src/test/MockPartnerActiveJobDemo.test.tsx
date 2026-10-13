import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import MockPartnerActiveJobDemo from '@/demo/partnerActiveJobMock/MockPartnerActiveJobDemo';
import {
  DEMO_OTP_CODE,
  createInitialMockJobData,
} from '@/demo/partnerActiveJobMock/mockPartnerActiveJobData';

const TEST_STORAGE_KEY = 'homecarex_mock_active_job_test_v1';

describe('MockPartnerActiveJobDemo — Isolated Mock Data Prototype', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('renders Job Details with masked customer PII, service info, pricing, and initial ASSIGNED status', () => {
    render(<MockPartnerActiveJobDemo storageKey={TEST_STORAGE_KEY} />);

    expect(screen.getByTestId('mock-details-booking-id')).toHaveTextContent('bk_mock_90421');
    expect(screen.getByTestId('mock-lifecycle-status-badge')).toHaveTextContent('Assigned');
    expect(screen.getByTestId('mock-masked-customer-name')).toHaveTextContent('Ananya S.');
    expect(screen.getByTestId('mock-masked-customer-phone')).toHaveTextContent('******4829');
    expect(screen.getByText('Split AC Foam & Jet Deep Service')).toBeInTheDocument();
  });

  it('follows lifecycle ASSIGNED -> ACCEPTED -> EN_ROUTE -> ARRIVED -> OTP_VERIFIED -> IN_PROGRESS and blocks Start before OTP', () => {
    render(<MockPartnerActiveJobDemo storageKey={TEST_STORAGE_KEY} />);

    // 1. ASSIGNED -> ACCEPTED
    fireEvent.click(screen.getByTestId('mock-btn-accept-job'));
    expect(screen.getByTestId('mock-lifecycle-status-badge')).toHaveTextContent('Accepted');

    // 2. ACCEPTED -> EN_ROUTE
    fireEvent.click(screen.getByTestId('mock-btn-en-route'));
    expect(screen.getByTestId('mock-lifecycle-status-badge')).toHaveTextContent('En Route');

    // 3. EN_ROUTE -> ARRIVED
    fireEvent.click(screen.getByTestId('mock-btn-arrived'));
    expect(screen.getByTestId('mock-lifecycle-status-badge')).toHaveTextContent('Arrived at Location');

    // Start button must be disabled before OTP verification
    const startBtn = screen.getByTestId('mock-start-job-btn');
    expect(startBtn).toBeDisabled();

    // 4. Rejects incorrect OTP with accessible error
    const otpInput = screen.getByTestId('mock-otp-input');
    fireEvent.change(otpInput, { target: { value: '999999' } });
    fireEvent.click(screen.getByTestId('mock-verify-otp-btn'));

    expect(screen.getByTestId('mock-otp-error')).toHaveTextContent(/Incorrect OTP/i);
    expect(startBtn).toBeDisabled();

    // 5. Accepts valid Demo OTP (123456) and enables Start Job
    fireEvent.change(otpInput, { target: { value: DEMO_OTP_CODE } });
    fireEvent.click(screen.getByTestId('mock-verify-otp-btn'));

    expect(screen.getByTestId('mock-lifecycle-status-badge')).toHaveTextContent('OTP Verified');
    expect(startBtn).not.toBeDisabled();

    // 6. Start Job transitions to IN_PROGRESS and switches to Active Job view
    fireEvent.click(startBtn);
    expect(screen.getByTestId('mock-active-job-view')).toBeInTheDocument();
    expect(screen.getByTestId('mock-active-status-badge')).toHaveTextContent('In Progress');
  });

  it('persists checklist toggles and custom checklist items across simulated page refresh (remount)', () => {
    const { unmount } = render(<MockPartnerActiveJobDemo storageKey={TEST_STORAGE_KEY} />);

    expect(screen.getByTestId('mock-checklist-counts')).toHaveTextContent('0 completed · 5 remaining');

    // Toggle first checklist item
    const firstCheckbox = screen.getByLabelText(
      /Inspect AC cooling performance and pre-service airflow temperature/i,
    );
    fireEvent.click(firstCheckbox);
    expect(screen.getByTestId('mock-checklist-counts')).toHaveTextContent('1 completed · 4 remaining');

    // Add a custom checklist item
    const customInput = screen.getByPlaceholderText(/Add custom checklist step/i);
    fireEvent.change(customInput, { target: { value: 'Verify remote batteries' } });
    fireEvent.click(screen.getByRole('button', { name: /\+ Add Task/i }));

    expect(screen.getByText('Verify remote batteries')).toBeInTheDocument();
    expect(screen.getByTestId('mock-checklist-counts')).toHaveTextContent('1 completed · 5 remaining');

    // Unmount and remount to simulate browser refresh
    unmount();
    render(<MockPartnerActiveJobDemo storageKey={TEST_STORAGE_KEY} />);

    expect(screen.getByTestId('mock-checklist-counts')).toHaveTextContent('1 completed · 5 remaining');
    expect(screen.getByText('Verify remote batteries')).toBeInTheDocument();
  });

  it('restores active timer from persisted startedAt timestamp without restarting from zero after refresh', () => {
    // Seed state started 24 minutes and 18 seconds ago
    const started24m18sAgo = new Date(Date.now() - (24 * 60 + 18) * 1000).toISOString();
    const seeded = {
      ...createInitialMockJobData(),
      status: 'IN_PROGRESS' as const,
      otpVerified: true,
      schedule: {
        ...createInitialMockJobData().schedule,
        startedAt: started24m18sAgo,
      },
    };
    window.localStorage.setItem(TEST_STORAGE_KEY, JSON.stringify(seeded));

    const { unmount } = render(
      <MockPartnerActiveJobDemo initialPage="active" storageKey={TEST_STORAGE_KEY} />,
    );

    const timerDisplay = screen.getByTestId('mock-timer-display').textContent ?? '';
    expect(timerDisplay).toMatch(/^00:24:1[89]$/);

    // Remount to verify it does not reset to 00:00:00
    unmount();
    render(<MockPartnerActiveJobDemo initialPage="active" storageKey={TEST_STORAGE_KEY} />);
    const restoredDisplay = screen.getByTestId('mock-timer-display').textContent ?? '';
    expect(restoredDisplay).toMatch(/^00:24:1[89]$/);
  });

  it('validates and persists added extra service items separately from original booking price', () => {
    const seeded = {
      ...createInitialMockJobData(),
      status: 'IN_PROGRESS' as const,
      otpVerified: true,
      schedule: {
        ...createInitialMockJobData().schedule,
        startedAt: new Date().toISOString(),
      },
    };
    window.localStorage.setItem(TEST_STORAGE_KEY, JSON.stringify(seeded));

    render(<MockPartnerActiveJobDemo initialPage="active" storageKey={TEST_STORAGE_KEY} />);

    fireEvent.click(screen.getByTestId('mock-open-add-item-btn'));
    const dialog = screen.getByTestId('mock-add-item-dialog');

    // Submit empty -> validation error
    fireEvent.click(within(dialog).getByRole('button', { name: /^Add Item$/i }));
    expect(screen.getByTestId('mock-add-item-error')).toHaveTextContent(/Item name is required/i);

    // Fill valid item
    fireEvent.change(within(dialog).getByLabelText(/Item Name/i), {
      target: { value: 'Copper Drain Pipe Extension' },
    });
    fireEvent.change(within(dialog).getByLabelText(/Mock Estimate Price/i), {
      target: { value: '250' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: /^Add Item$/i }));

    expect(screen.getByTestId('mock-extra-items-list')).toHaveTextContent(
      'Copper Drain Pipe Extension',
    );
    expect(screen.getByTestId('mock-extra-items-list')).toHaveTextContent('₹250');
  });

  it('enforces mandatory checklist items before Complete Job, then completes and prevents duplicate completion', () => {
    const base = createInitialMockJobData();
    const seeded = {
      ...base,
      status: 'IN_PROGRESS' as const,
      otpVerified: true,
      schedule: {
        ...base.schedule,
        startedAt: new Date(Date.now() - 120_000).toISOString(),
      },
    };
    window.localStorage.setItem(TEST_STORAGE_KEY, JSON.stringify(seeded));

    render(<MockPartnerActiveJobDemo initialPage="active" storageKey={TEST_STORAGE_KEY} />);

    // Attempt Complete Job while mandatory items are incomplete
    fireEvent.click(screen.getByTestId('mock-complete-job-btn'));
    expect(screen.getByTestId('mock-complete-error-alert')).toHaveTextContent(
      /Please complete all 4 required checklist item\(s\) before finishing the job/i,
    );
    expect(screen.getByTestId('mock-missing-mandatory-list')).toBeInTheDocument();

    // Mark all 4 mandatory checklist items complete
    fireEvent.click(
      screen.getByLabelText(/Inspect AC cooling performance and pre-service airflow temperature/i),
    );
    fireEvent.click(
      screen.getByLabelText(/Install waterproof service jacket and protect surrounding wall\/floor/i),
    );
    fireEvent.click(
      screen.getByLabelText(/Clean air filters, evaporator fins, and blower wheel with foam jet/i),
    );
    fireEvent.click(
      screen.getByLabelText(/Flush drainage tray and verify zero water leakage/i),
    );

    // Now click Complete Job -> Confirmation modal opens
    fireEvent.click(screen.getByTestId('mock-complete-job-btn'));
    expect(screen.getByTestId('mock-complete-confirm-dialog')).toBeInTheDocument();

    // Confirm completion
    fireEvent.click(screen.getByTestId('mock-confirm-complete-btn'));

    // Completion summary appears and Complete button is disabled to prevent duplicates
    expect(screen.getByTestId('mock-completion-summary')).toBeInTheDocument();
    expect(screen.getByTestId('mock-complete-job-btn')).toBeDisabled();
  });

  it('supports SOS confirmation, cancellation, activation, and blocks duplicate SOS triggers', () => {
    render(<MockPartnerActiveJobDemo initialPage="active" storageKey={TEST_STORAGE_KEY} />);

    // Open SOS dialog and cancel
    fireEvent.click(screen.getByTestId('mock-sos-trigger-btn'));
    expect(screen.getByTestId('mock-sos-confirm-dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('mock-sos-cancel-btn'));
    expect(screen.queryByTestId('mock-sos-confirm-dialog')).not.toBeInTheDocument();

    // Open SOS dialog and confirm
    fireEvent.click(screen.getByTestId('mock-sos-trigger-btn'));
    fireEvent.click(screen.getByTestId('mock-sos-confirm-btn'));

    expect(screen.getByTestId('mock-sos-confirmation-banner')).toBeInTheDocument();
    expect(screen.getByTestId('mock-sos-trigger-btn')).toBeDisabled();
  });

  it('handles corrupted localStorage state gracefully and resets demo cleanly', () => {
    window.localStorage.setItem(TEST_STORAGE_KEY, '{bad_json');

    render(<MockPartnerActiveJobDemo storageKey={TEST_STORAGE_KEY} />);

    // Shows corrupted state alert banner without crashing
    expect(screen.getByTestId('mock-corrupted-state-banner')).toBeInTheDocument();

    // Clicking Reset Demo restores clean initial state
    fireEvent.click(screen.getByTestId('mock-reset-demo-btn'));
    expect(screen.queryByTestId('mock-corrupted-state-banner')).not.toBeInTheDocument();
    expect(screen.getByTestId('mock-lifecycle-status-badge')).toHaveTextContent('Assigned');
  });
});

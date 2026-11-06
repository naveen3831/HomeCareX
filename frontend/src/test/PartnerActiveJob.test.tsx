import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import JobTimer, { formatElapsed } from '@/components/partner/JobTimer';
import Checklist from '@/components/partner/Checklist';
import SosButton from '@/components/partner/SosButton';
import AddItemDialog from '@/components/partner/AddItemDialog';
import JobStatusActions from '@/pages/partner/JobDetails/JobStatusActions';
import ActiveJobPage from '@/pages/partner/ActiveJob';
import JobDetailsPage from '@/pages/partner/JobDetails';
import * as apiModule from '@/pages/partner/JobDetails/jobDetails.api';
import type { JobDetails } from '@/pages/partner/JobDetails/jobDetails.types';

const mockBooking: JobDetails = {
  id: '65f1a2b3c4d5e6f7a8b9c0d1',
  bookingCode: '#B9C0D1',
  status: 'in_progress',
  customer: { name: 'Rahul K.', phoneMasked: '******3210' },
  service: { name: 'AC Service & Gas Refill', description: 'Complete AC deep cleaning and gas top-up', quantity: 1, durationMinutes: 90 },
  location: { address: '12 MG Road, Madhapur', city: 'Hyderabad', pincode: '500081' },
  schedule: { scheduledAt: '2026-10-12T04:30:00.000Z', slot: '10:00-12:00', startedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString() },
  price: { total: 599, partnerEarning: 450 },
  addOns: [{ id: 'addon-1', name: 'Eco chemicals', quantity: 1, amount: 50 }],
  instructions: 'Ring the doorbell twice',
  checklist: [
    { id: 'inc-1', label: 'Filter cleaning', done: false },
    { id: 'inc-2', label: 'Gas pressure check', done: true },
  ],
  payment: { status: 'PAID', phase: 'paid', amount: 599, upi: null },
  actions: [],
  otpRequired: false,
  history: [{ status: 'in_progress', at: '2026-10-12T04:30:00.000Z', actor: 'Partner' }],
};

describe('JobTimer Component', () => {
  it('formats elapsed duration into HH:MM:SS format', () => {
    expect(formatElapsed(0)).toBe('00:00:00');
    expect(formatElapsed(65)).toBe('00:01:05');
    expect(formatElapsed(3665)).toBe('01:01:05');
    expect(formatElapsed(-10)).toBe('00:00:00');
  });

  it('derives elapsed duration from start timestamp', () => {
    // 20 minutes ago
    const twentyMinsAgo = new Date(Date.now() - 20 * 60 * 1000).toISOString();
    render(<JobTimer startedAt={twentyMinsAgo} />);
    const timerEl = screen.getByRole('timer');
    expect(timerEl).toBeInTheDocument();
    // Should show ~ 00:20:00
    expect(timerEl.textContent).toMatch(/00:20:0\d/);
  });

  it('handles missing or invalid start timestamp gracefully', () => {
    const { rerender } = render(<JobTimer startedAt={null} />);
    expect(screen.getByText('--:--:--')).toBeInTheDocument();
    expect(screen.getByText('Not started')).toBeInTheDocument();

    rerender(<JobTimer startedAt="invalid-date-string" />);
    expect(screen.getByText('--:--:--')).toBeInTheDocument();
    expect(screen.getByText('Invalid time')).toBeInTheDocument();
  });

  it('continues correctly after simulated page remount or refresh', () => {
    const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { unmount } = render(<JobTimer startedAt={tenMinsAgo} />);
    expect(screen.getByRole('timer').textContent).toMatch(/00:10:0\d/);

    unmount();

    // Remount with same persisted start timestamp
    render(<JobTimer startedAt={tenMinsAgo} />);
    expect(screen.getByRole('timer').textContent).toMatch(/00:10:0\d/);
  });
});

describe('Checklist Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders service-template items with labels and checkboxes', () => {
    render(
      <Checklist
        jobId="job-123"
        items={[
          { id: 'item-1', label: 'Inspect filters', done: false },
          { id: 'item-2', label: 'Clean blower', done: true },
        ]}
      />,
    );

    expect(screen.getByLabelText('Inspect filters')).not.toBeChecked();
    expect(screen.getByLabelText('Clean blower')).toBeChecked();
    expect(screen.getByText(/Progress: 1 \/ 2 completed/)).toBeInTheDocument();
  });

  it('persists item updates through the API on toggle', async () => {
    const persistSpy = vi
      .spyOn(apiModule, 'persistChecklistItem')
      .mockResolvedValueOnce([
        { id: 'item-1', label: 'Inspect filters', done: true },
        { id: 'item-2', label: 'Clean blower', done: true },
      ]);

    const onUpdate = vi.fn();
    render(
      <Checklist
        jobId="job-123"
        items={[
          { id: 'item-1', label: 'Inspect filters', done: false },
          { id: 'item-2', label: 'Clean blower', done: true },
        ]}
        onItemsUpdated={onUpdate}
      />,
    );

    const checkbox = screen.getByLabelText('Inspect filters');
    fireEvent.click(checkbox);

    expect(persistSpy).toHaveBeenCalledWith('job-123', 'item-1', true);
    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalled();
    });
  });

  it('shows errors and does not falsely mark done when save fails', async () => {
    vi.spyOn(apiModule, 'persistChecklistItem').mockRejectedValueOnce(new Error('Network failure'));

    render(
      <Checklist
        jobId="job-123"
        items={[{ id: 'item-1', label: 'Inspect filters', done: false }]}
      />,
    );

    const checkbox = screen.getByLabelText('Inspect filters');
    fireEvent.click(checkbox);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    // Checkbox must not falsely show checked
    expect(screen.getByLabelText('Inspect filters')).not.toBeChecked();
  });

  it('handles empty checklist gracefully', () => {
    render(<Checklist jobId="job-123" items={[]} />);
    expect(screen.getByText('No checklist items for this service.')).toBeInTheDocument();
  });
});

describe('SosButton Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders with an accessible name and opens confirmation modal', () => {
    render(<SosButton bookingId="job-123" />);
    const btn = screen.getByRole('button', { name: /Emergency SOS/i });
    expect(btn).toBeInTheDocument();

    fireEvent.click(btn);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Trigger Emergency SOS\?/i)).toBeInTheDocument();
  });

  it('triggers SOS and prevents duplicate triggering while pending', async () => {
    let resolvePromise: (val: any) => void;
    const pendingPromise = new Promise((resolve) => {
      resolvePromise = resolve;
    });

    const sosSpy = vi.spyOn(apiModule, 'triggerSos').mockImplementation(() => pendingPromise as any);

    render(<SosButton bookingId="job-123" />);
    fireEvent.click(screen.getByRole('button', { name: /Emergency SOS/i }));

    const confirmBtn = screen.getByRole('button', { name: /Confirm SOS/i });
    fireEvent.click(confirmBtn);

    expect(sosSpy).toHaveBeenCalledTimes(1);
    // Button is now in pending state
    expect(confirmBtn).toBeDisabled();

    // Second click ignored
    fireEvent.click(confirmBtn);
    expect(sosSpy).toHaveBeenCalledTimes(1);

    resolvePromise!({ success: true, message: 'SOS alert sent' });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});

describe('AddItemDialog Component', () => {
  it('validates required fields and shows error when empty', async () => {
    const user = userEvent.setup();
    render(<AddItemDialog bookingId="job-123" isOpen={true} onClose={vi.fn()} />);

    const submitBtn = screen.getByRole('button', { name: /Add Item/i });
    await user.click(submitBtn);

    // Form validation prevents submitting empty title/amount
    expect(screen.getByLabelText(/Item or material title \*/i)).toBeInTheDocument();
  });

  it('submits valid item details and calls api', async () => {
    const addSpy = vi.spyOn(apiModule, 'addJobItem').mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onAdded = vi.fn();

    render(
      <AddItemDialog
        bookingId="job-123"
        isOpen={true}
        onClose={onClose}
        onItemAdded={onAdded}
      />,
    );

    await user.type(screen.getByLabelText(/Item or material title \*/i), 'Freon Gas Canister');
    await user.type(screen.getByLabelText(/Amount \(₹\) \*/i), '450');
    await user.click(screen.getByRole('button', { name: /Add Item/i }));

    expect(addSpy).toHaveBeenCalledWith('job-123', {
      title: 'Freon Gas Canister',
      amount: 450,
      reason: undefined,
    });
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
      expect(onAdded).toHaveBeenCalledWith({
        title: 'Freon Gas Canister',
        amount: 450,
        reason: undefined,
      });
    });
  });
});

describe('JobStatusActions OTP Start Flow', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('blocks Start Job before OTP verification', () => {
    const arrivedJob: JobDetails = {
      ...mockBooking,
      status: 'arrived',
      otpRequired: true,
      actions: [],
    };

    render(
      <MemoryRouter>
        <JobStatusActions job={arrivedJob} onChanged={vi.fn()} onStale={vi.fn()} />
      </MemoryRouter>,
    );

    const openOtpBtn = screen.getByRole('button', { name: /Verify OTP & Start Job/i });
    fireEvent.click(openOtpBtn);

    // Start Job button is in document but DISABLED because OTP not verified
    const startJobBtn = screen.getByRole('button', { name: /Start Job/i });
    expect(startJobBtn).toBeDisabled();
  });

  it('Start Job stays disabled until a valid code is typed, then starts via verify-start and blocks duplicate clicks', async () => {
    const arrivedJob: JobDetails = {
      ...mockBooking,
      status: 'arrived',
      otpRequired: true,
      actions: [],
    };

    let resolveStart: (val: any) => void;
    const startPromise = new Promise((resolve) => {
      resolveStart = resolve;
    });
    const startSpy = vi.spyOn(apiModule, 'verifyStart').mockImplementation(() => startPromise as any);

    const onChanged = vi.fn();
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <JobStatusActions job={arrivedJob} onChanged={onChanged} onStale={vi.fn()} />
      </MemoryRouter>,
    );

    // Open OTP input
    await user.click(screen.getByRole('button', { name: /Verify OTP & Start Job/i }));

    const startJobBtn = screen.getByRole('button', { name: /Start Job/i });
    expect(startJobBtn).toBeDisabled();

    const otpInput = screen.getByPlaceholderText(/4-digit code/i);
    await user.type(otpInput, '12');
    expect(startJobBtn).toBeDisabled(); // too short

    await user.type(otpInput, '34');
    expect(startJobBtn).toBeEnabled();

    // Click Start Job: exactly one call to verify-start, with just the code
    await user.click(startJobBtn);
    expect(startSpy).toHaveBeenCalledTimes(1);
    expect(startSpy).toHaveBeenCalledWith(arrivedJob.id, '1234');

    // While in flight, button is disabled (duplicate prevention)
    expect(startJobBtn).toBeDisabled();

    resolveStart!({ ...arrivedJob, status: 'in_progress', otpRequired: false });
    await waitFor(() => {
      expect(onChanged).toHaveBeenCalled();
    });
  });

  it('shows the server message when the code is wrong and does not call onChanged', async () => {
    const arrivedJob: JobDetails = { ...mockBooking, status: 'arrived', otpRequired: true, actions: [] };
    vi.spyOn(apiModule, 'verifyStart').mockRejectedValue({
      response: { status: 422, data: { code: 'INVALID_OTP', message: 'Incorrect code. 4 attempts left' } },
    });
    const onChanged = vi.fn();
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <JobStatusActions job={arrivedJob} onChanged={onChanged} onStale={vi.fn()} />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: /Verify OTP & Start Job/i }));
    await user.type(screen.getByPlaceholderText(/4-digit code/i), '0000');
    await user.click(screen.getByRole('button', { name: /Start Job/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/incorrect code/i);
    expect(onChanged).not.toHaveBeenCalled();
  });
});

describe('Starting a job only uses the verify-start route', () => {
  it('the removed endpoints are gone from the API module', () => {
    expect((apiModule as Record<string, unknown>).startJob).toBeUndefined();
    expect((apiModule as Record<string, unknown>).verifyJobOtp).toBeUndefined();
  });
});

describe('ActiveJobPage Integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders loading skeleton then active job data from API', async () => {
    vi.spyOn(apiModule, 'fetchJob').mockResolvedValueOnce(mockBooking);

    render(
      <MemoryRouter initialEntries={['/partner/jobs/65f1a2b3c4d5e6f7a8b9c0d1/active']}>
        <Routes>
          <Route path="/partner/jobs/:id/active" element={<ActiveJobPage />} />
        </Routes>
      </MemoryRouter>,
    );

    // Initial loading
    expect(document.querySelector('.aj-skel')).toBeInTheDocument();

    // Loaded
    await waitFor(() => {
      expect(screen.getByText('AC Service & Gas Refill')).toBeInTheDocument();
    });
    expect(screen.getByText(/#B9C0D1/)).toBeInTheDocument();
    expect(screen.getByText('Rahul K.')).toBeInTheDocument();
    expect(screen.getByText('******3210')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Complete Job/i })).toBeInTheDocument();
  });

  it('displays not found state for 404 responses', async () => {
    vi.spyOn(apiModule, 'fetchJob').mockRejectedValueOnce({ response: { status: 404 } });

    render(
      <MemoryRouter initialEntries={['/partner/jobs/unknown-id/active']}>
        <Routes>
          <Route path="/partner/jobs/:id/active" element={<ActiveJobPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Job Not Found')).toBeInTheDocument();
    });
  });

  it('displays error message with retry button on server errors', async () => {
    vi.spyOn(apiModule, 'fetchJob').mockRejectedValueOnce(new Error('Server error 500'));

    render(
      <MemoryRouter initialEntries={['/partner/jobs/error-id/active']}>
        <Routes>
          <Route path="/partner/jobs/:id/active" element={<ActiveJobPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Error Loading Job')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Try Again/i })).toBeInTheDocument();
    });
  });

  it('handles arrived job status by prompting for OTP verification', async () => {
    const arrivedBooking: JobDetails = {
      ...mockBooking,
      status: 'arrived',
      otpRequired: true,
    };
    vi.spyOn(apiModule, 'fetchJob').mockResolvedValueOnce(arrivedBooking);

    render(
      <MemoryRouter initialEntries={['/partner/jobs/arrived-id/active']}>
        <Routes>
          <Route path="/partner/jobs/:id/active" element={<ActiveJobPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Customer OTP Verification')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Start Job/i })).toBeDisabled();
      expect(screen.queryByRole('button', { name: /Complete Job/i })).not.toBeInTheDocument();
    });
  });

  it('handles completed status appropriately', async () => {
    const completedBooking: JobDetails = {
      ...mockBooking,
      status: 'completed',
    };
    vi.spyOn(apiModule, 'fetchJob').mockResolvedValueOnce(completedBooking);

    render(
      <MemoryRouter initialEntries={['/partner/jobs/completed-id/active']}>
        <Routes>
          <Route path="/partner/jobs/:id/active" element={<ActiveJobPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Job completed')).toBeInTheDocument();
      expect(screen.getByText('Payment received')).toBeInTheDocument();
      expect(screen.getByText(/View Job Details/i)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Complete Job/i })).not.toBeInTheDocument();
    });
  });

  it('shows the payment QR panel when a completed job is still unpaid', async () => {
    const unpaid: JobDetails = {
      ...mockBooking,
      status: 'completed',
      payment: {
        status: 'PENDING',
        phase: 'pending',
        amount: 599,
        upi: { payeeId: 'homecarex@bank', payeeName: 'HomeCareX', amount: 599, note: 'n', uri: 'upi://pay?pa=homecarex%40bank' },
      },
    };
    vi.spyOn(apiModule, 'fetchJob').mockResolvedValue(unpaid);

    render(
      <MemoryRouter initialEntries={['/partner/jobs/unpaid-id/active']}>
        <Routes>
          <Route path="/partner/jobs/:id/active" element={<ActiveJobPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('COLLECT PAYMENT')).toBeInTheDocument();
      expect(screen.getByText('homecarex@bank')).toBeInTheDocument();
    });
  });

  it('handles Complete Job confirmation and displays API errors if completion fails', async () => {
    vi.spyOn(apiModule, 'fetchJob').mockResolvedValueOnce(mockBooking);
    const completeSpy = vi
      .spyOn(apiModule, 'completeJob')
      .mockRejectedValueOnce({ response: { status: 422, data: { message: 'A partner cannot set a job to completed from this screen' } } });

    render(
      <MemoryRouter initialEntries={['/partner/jobs/65f1a2b3c4d5e6f7a8b9c0d1/active']}>
        <Routes>
          <Route path="/partner/jobs/:id/active" element={<ActiveJobPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Complete Job/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Complete Job/i }));
    expect(screen.getByText('Confirm Service Completion?')).toBeInTheDocument();

    const yesBtn = screen.getByRole('button', { name: /Yes, Complete/i });
    fireEvent.click(yesBtn);

    expect(completeSpy).toHaveBeenCalledWith(mockBooking.id);
    await waitFor(() => {
      const alerts = screen.getAllByRole('alert');
      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0].textContent).toContain('A partner cannot set a job to completed from this screen');
    });
  });
});

describe('JobDetailsPage Integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders full job details including service description, checklist, price and earning', async () => {
    vi.spyOn(apiModule, 'fetchJob').mockResolvedValueOnce(mockBooking);

    render(
      <MemoryRouter initialEntries={['/partner/jobs/65f1a2b3c4d5e6f7a8b9c0d1']}>
        <Routes>
          <Route path="/partner/jobs/:id" element={<JobDetailsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('AC Service & Gas Refill')).toBeInTheDocument();
    });
    expect(screen.getByText('Complete AC deep cleaning and gas top-up')).toBeInTheDocument();
    expect(screen.getByText('Rahul K.')).toBeInTheDocument();
    expect(screen.getAllByText(/12 MG Road, Madhapur/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Eco chemicals/)).toBeInTheDocument();
    expect(screen.getByText('Filter cleaning')).toBeInTheDocument();
    expect(screen.getByText('Gas pressure check')).toBeInTheDocument();
  });

  it('renders not found state when API returns 404', async () => {
    vi.spyOn(apiModule, 'fetchJob').mockRejectedValueOnce({ response: { status: 404 } });

    render(
      <MemoryRouter initialEntries={['/partner/jobs/unknown-id']}>
        <Routes>
          <Route path="/partner/jobs/:id" element={<JobDetailsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Job not found')).toBeInTheDocument();
    });
  });

  it('loads default #BK-20418 Deep home cleaning mock data from localStorage on existing routes', async () => {
    window.localStorage.clear();

    const { unmount } = render(
      <MemoryRouter initialEntries={['/partner/jobs/BK-20418']}>
        <Routes>
          <Route path="/partner/jobs/:id" element={<JobDetailsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('#BK-20418')).toBeInTheDocument();
    });
    expect(screen.getByText('Deep home cleaning')).toBeInTheDocument();
    expect(screen.getByText('Rohan K.')).toBeInTheDocument();
    expect(screen.getByText('+91 ••••• ••214')).toBeInTheDocument();
    expect(screen.getByText('Fridge cleaning')).toBeInTheDocument();
    expect(screen.getByText('Balcony wash')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Start job/i })).toBeInTheDocument();

    unmount();

    render(
      <MemoryRouter initialEntries={['/partner/jobs/BK-20418/active']}>
        <Routes>
          <Route path="/partner/jobs/:id/active" element={<ActiveJobPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('TIME ON JOB')).toBeInTheDocument();
    });
    expect(screen.getByText('Deep home cleaning')).toBeInTheDocument();
    expect(screen.getByText('3 of 6 done')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /\+ Add item/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Complete job/i })).toBeInTheDocument();
  });

  it('first shows assigned service cards on /partner/work and unlocks total booked details when accepted', async () => {
    window.localStorage.clear();

    render(
      <MemoryRouter initialEntries={['/partner/work']}>
        <Routes>
          <Route path="/partner/work" element={<JobDetailsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Assigned Services')).toBeInTheDocument();
    });

    // Verify multiple assigned service cards are rendered
    expect(screen.getByText('Deep home cleaning')).toBeInTheDocument();
    expect(screen.getByText('Bathroom & kitchen sanitization')).toBeInTheDocument();
    expect(screen.getByText('AC foam-jet service & gas check')).toBeInTheDocument();

    const acceptButtons = screen.getAllByRole('button', { name: /Accept Service/i });
    expect(acceptButtons.length).toBeGreaterThanOrEqual(6);

    // Click Accept Service on the first card (#BK-20418 Deep home cleaning)
    fireEvent.click(acceptButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('PRICE & ADD-ONS')).toBeInTheDocument();
    });

    expect(screen.getByText('#BK-20418')).toBeInTheDocument();
    expect(screen.getByText('Fridge cleaning')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Start job/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Back to Assigned Services/i })).toBeInTheDocument();
  });

  it('filters assigned services with Accept as default, correct tab order, filter icon, and fallback to All', async () => {
    window.localStorage.clear();

    render(
      <MemoryRouter initialEntries={['/partner/work']}>
        <Routes>
          <Route path="/partner/work" element={<JobDetailsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Assigned Services')).toBeInTheDocument();
    });

    // Reset all button should not be present
    expect(screen.queryByRole('button', { name: /Reset all/i })).not.toBeInTheDocument();

    // Verify filter button featuring slider icon is present (for mobile view)
    const filterBtn = screen.getByRole('button', { name: /Filter/i });
    expect(filterBtn).toBeInTheDocument();
    expect(document.querySelector('.jd-filter-slider-icon')).toBeInTheDocument();

    // On web resolution, filters are shown directly in the DOM
    expect(screen.getByRole('tablist')).toBeInTheDocument();

    // Verify filter tabs are rendered in exact requested order:
    // Accept, Decline, Confirmed, Completed, then All
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(5);
    expect(tabs[0]).toHaveTextContent(/Accept/i);
    expect(tabs[1]).toHaveTextContent(/Decline/i);
    expect(tabs[2]).toHaveTextContent(/Confirmed/i);
    expect(tabs[3]).toHaveTextContent(/Completed/i);
    expect(tabs[4]).toHaveTextContent(/All/i);

    // Accept is the default filter when assigned data exists
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Deep home cleaning')).toBeInTheDocument();

    // Switch to Confirmed filter
    fireEvent.click(tabs[2]);
    expect(screen.getByText('Kitchen chimney & hob deep cleaning')).toBeInTheDocument();
    expect(screen.queryByText('Deep home cleaning')).not.toBeInTheDocument();

    // Switch to Decline filter
    fireEvent.click(tabs[1]);
    expect(screen.getByText('Terrace water tank cleaning')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Service Declined/i })).toBeDisabled();

    // Switch to Completed filter
    fireEvent.click(tabs[3]);
    expect(screen.getByText('Full bathroom steam sanitization')).toBeInTheDocument();

    // Switch to All filter
    fireEvent.click(tabs[4]);
    expect(screen.getByText('Deep home cleaning')).toBeInTheDocument();
    expect(screen.getByText('Kitchen chimney & hob deep cleaning')).toBeInTheDocument();

    // Mobile filter toggle toggles mobile open state
    fireEvent.click(filterBtn);
    expect(document.querySelector('.jd-filter-mobile-open')).toBeInTheDocument();
  });

  it('falls back to All filter as default when there are no items in Accept', async () => {
    // Seed localStorage with only completed and confirmed items (0 assigned items)
    const mockList = [
      {
        id: 'completed-1',
        bookingCode: '#BK-999',
        status: 'completed',
        customer: { name: 'Pooja S.', phoneMasked: '******1234' },
        service: { name: 'Sofa cleaning', durationMinutes: 60, quantity: 1 },
        location: { address: 'Plot 4, Jubilee Hills', city: 'Hyderabad', pincode: '500033' },
        schedule: { scheduledAt: '2026-10-12T04:30:00.000Z', slot: '10:00 AM' },
        price: { total: 499, partnerEarning: 400 },
        addOns: [],
        instructions: '',
        checklist: [],
        payment: { status: 'PAID', amount: 499 },
        actions: [],
        history: [],
      },
    ];
    window.localStorage.setItem('homecarex_partner_assigned_services_v2', JSON.stringify(mockList));

    render(
      <MemoryRouter initialEntries={['/partner/work']}>
        <Routes>
          <Route path="/partner/work" element={<JobDetailsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Assigned Services')).toBeInTheDocument();
    });

    const filterBtn = screen.getByRole('button', { name: /Filter/i });
    expect(filterBtn).toBeInTheDocument();

    // Click filter button to view tabs
    fireEvent.click(filterBtn);

    const allTab = screen.getByRole('tab', { name: /All/i });
    // Since accept has 0 items, it automatically defaults to 'all'
    await waitFor(() => {
      expect(allTab).toHaveAttribute('aria-selected', 'true');
    });
    expect(screen.getByText('Sofa cleaning')).toBeInTheDocument();
  });
});
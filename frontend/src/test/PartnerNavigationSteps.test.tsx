import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import JobStepPanel from '@/pages/partner/Navigation/components/JobStepPanel';
import * as apiModule from '@/pages/partner/JobDetails/jobDetails.api';
import type { ApiJob } from '@/pages/partner/JobDetails/jobDetails.types';

vi.mock('qrcode', () => ({
  default: { toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,AAAA') },
}));

function makeApiJob(status: ApiJob['status'], extra: Partial<ApiJob> = {}): ApiJob {
  return {
    id: '65f1a2b3c4d5e6f7a8b9c0d1',
    status,
    customer: { name: 'Asha', phone: '98xxxxxx10' },
    service: { name: 'AC service', quantity: 1, durationMinutes: 60 },
    location: { line1: 'x', area: null, city: 'Hyderabad', pincode: null, coordinates: null },
    schedule: { scheduledAt: '2026-10-30T05:00:00.000Z', date: null, slot: null, startedAt: '2026-10-30T05:10:00.000Z' },
    price: { currency: 'INR', total: 1200, partnerEarning: 900 },
    addOns: [],
    instructions: null,
    checklist: [{ id: 'c1', label: 'Clean filter', done: false }],
    payment: {
      status: 'PENDING',
      paidAt: null,
      upi: { payeeId: 'homecarex@bank', payeeName: 'HomeCareX' },
    },
    actions: [],
    otpRequired: true,
    statusHistory: [],
    ...extra,
  };
}

function setup(job: ApiJob, onChanged = vi.fn(), online = true) {
  render(
    <MemoryRouter>
      <JobStepPanel job={job} online={online} onChanged={onChanged} />
    </MemoryRouter>,
  );
  return onChanged;
}

const photo = () => new File(['x'], 'start.jpg', { type: 'image/jpeg' });

describe('JobStepPanel', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('shows nothing for statuses that have their own buttons', () => {
    const { container } = render(
      <MemoryRouter>
        <JobStepPanel job={makeApiJob('en_route')} online onChanged={vi.fn()} />
      </MemoryRouter>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  describe('arrived', () => {
    it('keeps the start button disabled until code and photo are given', () => {
      setup(makeApiJob('arrived'));
      const start = screen.getByRole('button', { name: /Verify and start job/i });
      expect(start).toBeDisabled();
      fireEvent.change(screen.getByLabelText(/start code/i), { target: { value: '1234' } });
      expect(start).toBeDisabled();
      fireEvent.change(document.getElementById('nv-photo') as HTMLInputElement, { target: { files: [photo()] } });
      expect(start).toBeEnabled();
    });

    it('rejects a non-image photo', () => {
      setup(makeApiJob('arrived'));
      const bad = new File(['x'], 'a.pdf', { type: 'application/pdf' });
      fireEvent.change(document.getElementById('nv-photo') as HTMLInputElement, { target: { files: [bad] } });
      expect(screen.getByRole('alert')).toHaveTextContent(/JPG or PNG/i);
    });

    it('starts the job and asks the page to reload', async () => {
      const spy = vi.spyOn(apiModule, 'verifyStart').mockResolvedValue({} as never);
      const onChanged = setup(makeApiJob('arrived'));
      fireEvent.change(screen.getByLabelText(/start code/i), { target: { value: '1234' } });
      const file = photo();
      fireEvent.change(document.getElementById('nv-photo') as HTMLInputElement, { target: { files: [file] } });
      fireEvent.click(screen.getByRole('button', { name: /Verify and start job/i }));
      await waitFor(() => expect(onChanged).toHaveBeenCalled());
      expect(spy).toHaveBeenCalledWith('65f1a2b3c4d5e6f7a8b9c0d1', '1234', file);
    });

    it('shows attempts left after a wrong code', async () => {
      vi.spyOn(apiModule, 'verifyStart').mockRejectedValue({
        response: {
          status: 422,
          data: { code: 'INVALID_OTP', message: 'x', details: [{ field: 'attemptsRemaining', message: '2' }] },
        },
      });
      setup(makeApiJob('arrived'));
      fireEvent.change(screen.getByLabelText(/start code/i), { target: { value: '9999' } });
      fireEvent.change(document.getElementById('nv-photo') as HTMLInputElement, { target: { files: [photo()] } });
      fireEvent.click(screen.getByRole('button', { name: /Verify and start job/i }));
      expect(await screen.findByText(/Wrong code. 2 attempts left/i)).toBeInTheDocument();
    });

    it('shows the locked message when the server locks the code', async () => {
      vi.spyOn(apiModule, 'verifyStart').mockRejectedValue({ response: { status: 423, data: { code: 'OTP_LOCKED', message: 'x' } } });
      setup(makeApiJob('arrived'));
      fireEvent.change(screen.getByLabelText(/start code/i), { target: { value: '9999' } });
      fireEvent.change(document.getElementById('nv-photo') as HTMLInputElement, { target: { files: [photo()] } });
      fireEvent.click(screen.getByRole('button', { name: /Verify and start job/i }));
      expect(await screen.findByText(/starting is locked/i)).toBeInTheDocument();
    });

    it('shows locked from the start when the job says so', () => {
      setup(makeApiJob('arrived', { startVerification: { maxAttempts: 5, attemptsRemaining: 0, expiresAt: null, expired: false, locked: true } }));
      expect(screen.getByRole('alert')).toHaveTextContent(/locked/i);
      expect(screen.queryByRole('button', { name: /Verify and start job/i })).not.toBeInTheDocument();
    });
  });

  describe('in progress', () => {
    it('asks to confirm, then completes', async () => {
      const spy = vi.spyOn(apiModule, 'completeJob').mockResolvedValue({} as never);
      const onChanged = setup(makeApiJob('in_progress'));
      fireEvent.click(screen.getByRole('button', { name: /^Complete job$/i }));
      expect(screen.getByText(/Is the work finished/i)).toBeInTheDocument();
      expect(screen.getByText(/1 checklist item is still not ticked/i)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /Yes, complete/i }));
      await waitFor(() => expect(onChanged).toHaveBeenCalled());
      expect(spy).toHaveBeenCalledWith('65f1a2b3c4d5e6f7a8b9c0d1');
    });

    it('shows the server error if completing fails', async () => {
      vi.spyOn(apiModule, 'completeJob').mockRejectedValue({ response: { data: { message: 'Not allowed' } } });
      setup(makeApiJob('in_progress'));
      fireEvent.click(screen.getByRole('button', { name: /^Complete job$/i }));
      fireEvent.click(screen.getByRole('button', { name: /Yes, complete/i }));
      expect(await screen.findByText('Not allowed')).toBeInTheDocument();
    });
  });

  describe('completed', () => {
    it('shows thank you and the payment QR', async () => {
      setup(makeApiJob('completed'));
      expect(screen.getByText(/Thank you! Job completed/i)).toBeInTheDocument();
      expect(await screen.findByRole('img', { name: /UPI QR code/i })).toBeInTheDocument();
      expect(screen.getByText('COLLECT PAYMENT')).toBeInTheDocument();
    });

    it('shows payment received once paid', () => {
      setup(makeApiJob('completed', { payment: { status: 'PAID', paidAt: '2026-10-30T06:00:00.000Z' } }));
      expect(screen.getByText('Payment received')).toBeInTheDocument();
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });
  });
});
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import PaymentPanel from '@/components/partner/PaymentPanel';
import * as apiModule from '@/pages/partner/JobDetails/jobDetails.api';
import { buildUpiUri, normalizePayment } from '@/pages/partner/JobDetails/jobDetails.mapper';
import type { JobDetails, JobPayment } from '@/pages/partner/JobDetails/jobDetails.types';

vi.mock('qrcode', () => ({
  default: { toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,AAAA') },
}));

const UPI = {
  payeeId: 'homecarex@bank',
  payeeName: 'HomeCareX',
  amount: 1200,
  note: 'HomeCareX BK-1',
  uri: 'upi://pay?pa=homecarex%40bank&pn=HomeCareX&am=1200.00&cu=INR',
};

function makeJob(status: JobDetails['status'], payment: Partial<JobPayment> = {}): JobDetails {
  return {
    id: 'job1',
    bookingCode: 'BK-1',
    status,
    customer: { name: 'Asha', phoneMasked: '98xxxxxx10' },
    service: { name: 'AC service', quantity: 1, durationMinutes: 60 },
    location: { address: 'x', city: 'Hyderabad', pincode: null },
    schedule: { scheduledAt: '2026-10-30T05:00:00.000Z', slot: null, startedAt: null },
    price: { total: 1200, partnerEarning: 900 },
    addOns: [],
    instructions: null,
    checklist: [],
    payment: { status: 'PENDING', phase: 'pending', amount: 1200, upi: UPI, ...payment },
    actions: [],
    otpRequired: false,
    history: [],
  };
}

describe('normalizePayment', () => {
  it('builds a UPI link when the backend sends only payee fields', () => {
    const p = normalizePayment({ status: 'PENDING', upi: { payeeId: 'a@b', payeeName: 'Home Care' } }, 500, 'BK-9');
    expect(p.phase).toBe('pending');
    expect(p.amount).toBe(500);
    expect(p.upi?.uri).toContain('pa=a%40b');
    expect(p.upi?.uri).toContain('am=500.00');
    expect(p.upi?.uri).toContain('pn=Home%20Care');
  });

  it('prefers the amount the backend sends over the job total', () => {
    expect(normalizePayment({ status: 'PENDING', amount: 1500 }, 1200, 'BK-1').amount).toBe(1500);
  });

  it('maps status text to a phase, ignoring case, and has no upi without a payee', () => {
    expect(normalizePayment({ status: 'PAID' }, 1, 'x').phase).toBe('paid');
    expect(normalizePayment({ status: 'failed' }, 1, 'x').phase).toBe('failed');
    expect(normalizePayment({ status: 'REFUNDED' }, 1, 'x').phase).toBe('refunded');
    expect(normalizePayment(undefined, 1, 'x').upi).toBeNull();
  });

  it('buildUpiUri encodes the note', () => {
    expect(buildUpiUri({ payeeId: 'a@b', payeeName: 'N', amount: 10, note: 'a b' })).toContain('tn=a%20b');
  });
});

describe('PaymentPanel', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('before completion shows the amount but no QR', () => {
    render(<PaymentPanel job={makeJob('in_progress')} />);
    expect(screen.getByText(/to collect/i)).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('after completion shows the QR, payee and waiting message', async () => {
    render(<PaymentPanel job={makeJob('completed')} />);
    expect(await screen.findByRole('img', { name: /UPI QR code/i })).toBeInTheDocument();
    expect(screen.getByText('homecarex@bank')).toBeInTheDocument();
    expect(screen.getByText(/Waiting for payment/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open UPI app/i })).toHaveAttribute('href', UPI.uri);
  });

  it('shows the paid state without a QR', () => {
    render(<PaymentPanel job={makeJob('completed', { status: 'PAID', phase: 'paid', paidAt: '2026-10-30T06:00:00.000Z' })} />);
    expect(screen.getByText('Payment received')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('warns when the backend has no UPI details', () => {
    render(<PaymentPanel job={makeJob('completed', { upi: null })} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/Payment details unavailable/i);
  });

  it('"Check payment now" reports the fresh job to the parent', async () => {
    const paid = makeJob('completed', { status: 'PAID', phase: 'paid' });
    vi.spyOn(apiModule, 'fetchJob').mockResolvedValue(paid);
    const onJobChange = vi.fn();
    render(<PaymentPanel job={makeJob('completed')} onJobChange={onJobChange} />);
    fireEvent.click(screen.getByRole('button', { name: /Check payment now/i }));
    await waitFor(() => expect(onJobChange).toHaveBeenCalledWith(paid));
  });

  it('shows an error when the manual check fails', async () => {
    vi.spyOn(apiModule, 'fetchJob').mockRejectedValue({ response: { data: { message: 'Server down' } } });
    render(<PaymentPanel job={makeJob('completed')} />);
    fireEvent.click(screen.getByRole('button', { name: /Check payment now/i }));
    expect(await screen.findByText('Server down')).toBeInTheDocument();
  });

  it('polls on its own while payment is pending', async () => {
    vi.useFakeTimers();
    const spy = vi.spyOn(apiModule, 'fetchJob').mockResolvedValue(makeJob('completed'));
    render(<PaymentPanel job={makeJob('completed')} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5100);
    });
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
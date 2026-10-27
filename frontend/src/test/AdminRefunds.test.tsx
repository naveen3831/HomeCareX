import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock('@/lib/http', () => ({ default: h }));

import AdminRefundsPage from '@/pages/admin/Refunds';
import { useAuthStore } from '@/store/useAuthStore';

const refund = (over: Record<string, unknown> = {}) => ({
  _id: 'rf1', amount: 499, currency: 'INR', reason: 'Service not completed', method: 'RAZORPAY', status: 'requested', createdAt: '2026-10-20T10:00:00.000Z',
  paymentId: { _id: 'p1', razorpayPaymentId: 'pay_ABC123' }, bookingId: { _id: 'b1', serviceName: 'Deep Cleaning' },
  customerId: { _id: 'c1', name: 'Asha Rao', email: 'asha@example.com' }, ...over,
});
const meta = { page: 1, limit: 20, total: 2, pages: 1 };
const page = (items: unknown[]) => Promise.resolve({ data: { success: true, data: items, meta } });
const signIn = (permissions: string[]) => useAuthStore.setState({ isAuthenticated: true, user: { role: 'staff', permissions } });
const renderPage = () => render(<MemoryRouter><AdminRefundsPage /></MemoryRouter>);

beforeEach(() => {
  Object.values(h).forEach((f) => f.mockReset());
  signIn(['payments:refund']);
  h.get.mockImplementation(() => page([refund(), refund({ _id: 'rf2', status: 'rejected', rejectionReason: 'Duplicate request', customerId: { _id: 'c2', name: 'Ravi K' } })]));
});

describe('Admin refunds page', () => {
  it('lists refunds from GET /admin/refunds', async () => {
    renderPage();
    const table = await screen.findByRole('table', { name: 'Refunds' });
    expect(within(table).getAllByRole('row').slice(1)).toHaveLength(2);
    expect(within(table).getByText('Asha Rao')).toBeInTheDocument();
    expect(within(table).getByText(/Duplicate request/)).toBeInTheDocument();
    expect(h.get).toHaveBeenCalledWith('/admin/refunds', expect.objectContaining({ params: expect.objectContaining({ limit: 20, page: 1 }) }));
  });

  it('filters by status through the server', async () => {
    renderPage();
    await screen.findByRole('table');
    await userEvent.click(screen.getByRole('radio', { name: 'Rejected' }));
    await waitFor(() => expect(h.get).toHaveBeenLastCalledWith('/admin/refunds', expect.objectContaining({ params: expect.objectContaining({ status: 'rejected' }) })));
  });

  it('approves a requested refund with PATCH after confirmation', async () => {
    h.patch.mockResolvedValue({ data: { success: true, data: refund({ status: 'approved' }) } });
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /approve refund of/i }));
    await userEvent.click(await screen.findByRole('button', { name: /^approve$/i }));
    await waitFor(() => expect(h.patch).toHaveBeenCalledWith('/admin/refunds/rf1', { action: 'approve' }));
    expect(await screen.findByText('Refund approved')).toBeInTheDocument();
  });

  it('requires a reason to reject and sends it', async () => {
    h.patch.mockResolvedValue({ data: { success: true, data: refund({ status: 'rejected' }) } });
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /reject refund of/i }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByRole('textbox'), 'Outside refund window');
    await userEvent.click(within(dialog).getByRole('button', { name: /^reject$/i }));
    await waitFor(() => expect(h.patch).toHaveBeenCalledWith('/admin/refunds/rf1', { action: 'reject', rejectionReason: 'Outside refund window' }));
  });

  it('is read-only without payments:refund', async () => {
    signIn([]);
    renderPage();
    await screen.findByRole('table');
    expect(screen.queryByRole('button', { name: /approve refund/i })).not.toBeInTheDocument();
    expect(screen.getByText(/need the “payments:refund” permission/i)).toBeInTheDocument();
  });

  it('shows the error with Retry instead of sample data', async () => {
    h.get.mockRejectedValue({ message: 'Unable to reach the server.' });
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent(/unable to reach the server/i);
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});

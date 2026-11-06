import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock('@/lib/http', () => ({ default: h }));

import AdminRefundsPage from '@/pages/admin/Refunds';
import { useAuthStore } from '@/store/useAuthStore';

const refund = (over: Record<string, unknown> = {}) => ({
  _id: 'rf1', amount: 499, currency: 'INR', reason: 'Service not completed', method: 'WALLET', status: 'PENDING_APPROVAL',
  createdAt: '2026-10-20T10:00:00.000Z',
  paymentId: { _id: 'p1', razorpayPaymentId: 'pay_ABC123' },
  bookingId: { _id: 'b1', bookingNumber: 'BK-1001', serviceName: 'Deep Cleaning' },
  customerId: { _id: 'c1', name: 'Asha Rao', email: 'asha@example.com' },
  ...over,
});
const meta = { page: 1, limit: 10, total: 2, pages: 1 };
const summaryCounts = { pendingApproval: 1, credited: 0, rejected: 1, total: 2 };
const list = (items: unknown[]) =>
  Promise.resolve({ data: { success: true, data: items, meta, summaryCounts } });
const signIn = (permissions: string[]) =>
  useAuthStore.setState({ isAuthenticated: true, user: { role: 'staff', permissions } } as never);

/** Shows the current path so a test can prove a row click navigated. */
const Where = () => <p data-testid="where">{useLocation().pathname}</p>;
const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/admin/refunds']}>
      <Where />
      <Routes>
        <Route path="/admin/refunds" element={<AdminRefundsPage />} />
        <Route path="/admin/refunds/:id" element={<p>refund detail page</p>} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  Object.values(h).forEach((f) => f.mockReset());
  signIn(['payments:refund']);
  h.get.mockImplementation(() =>
    list([refund(), refund({ _id: 'rf2', status: 'REJECTED', customerId: { _id: 'c2', name: 'Ravi K' } })]),
  );
});

describe('Admin refunds page', () => {
  it('lists refunds from GET /admin/refunds', async () => {
    renderPage();
    const table = await screen.findByRole('table');
    expect(within(table).getAllByRole('row').slice(1)).toHaveLength(2);
    expect(within(table).getByText('Asha Rao')).toBeInTheDocument();
    expect(within(table).getByText('Ravi K')).toBeInTheDocument();
    expect(h.get).toHaveBeenCalledWith(
      '/admin/refunds',
      expect.objectContaining({ params: expect.objectContaining({ limit: 10, page: 1 }) }),
    );
  });

  it('filters by status through the server', async () => {
    renderPage();
    await screen.findByRole('table');
    await userEvent.selectOptions(screen.getByRole('combobox'), 'REJECTED');
    await waitFor(() =>
      expect(h.get).toHaveBeenLastCalledWith(
        '/admin/refunds',
        expect.objectContaining({ params: expect.objectContaining({ status: 'REJECTED' }) }),
      ),
    );
  });

  it('opens the details page when anywhere on a row is clicked', async () => {
    renderPage();
    const table = await screen.findByRole('table');
    // Click a plain cell (the service name), not a link or button.
    await userEvent.click(within(table).getAllByText('Deep Cleaning')[0]);
    expect(await screen.findByText('refund detail page')).toBeInTheDocument();
    expect(screen.getByTestId('where')).toHaveTextContent('/admin/refunds/rf1');
  });

  it('opens the details page from the keyboard (Enter on a focused row)', async () => {
    renderPage();
    const table = await screen.findByRole('table');
    const row = within(table).getAllByRole('row')[1];
    row.focus();
    await userEvent.keyboard('{Enter}');
    expect(screen.getByTestId('where')).toHaveTextContent('/admin/refunds/rf1');
  });

  it('shows the error with Retry instead of sample data', async () => {
    h.get.mockRejectedValue(new Error('Unable to reach the server.'));
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent(/unable to reach the server/i);
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});

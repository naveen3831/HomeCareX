import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock('@/lib/http', () => ({ default: h }));

import AdminReviewsPage from '@/pages/admin/Reviews';
import { useAuthStore } from '@/store/useAuthStore';

const review = (over: Record<string, unknown> = {}) => ({
  _id: 'rv1', customerName: 'Asha Rao', customerEmail: 'asha@example.com', rating: 4, message: 'Great and on time', status: 'pending', visible: true,
  tags: ['On time'], partnerName: 'Suresh', createdAt: '2026-10-20T10:00:00.000Z', ...over,
});
const result = (reviews: unknown[]) => Promise.resolve({
  data: { success: true, data: { reviews, pagination: { page: 1, limit: 20, total: reviews.length, pages: 1 }, stats: { total: 2, pending: 1, approved: 1, rejected: 0 } } },
});
const signIn = (permissions: string[]) => useAuthStore.setState({ isAuthenticated: true, user: { role: 'staff', permissions } });
const renderPage = () => render(<MemoryRouter><AdminReviewsPage /></MemoryRouter>);

beforeEach(() => {
  Object.values(h).forEach((f) => f.mockReset());
  signIn(['reviews:moderate']);
  h.get.mockImplementation(() => result([review(), review({ _id: 'rv2', customerName: 'Ravi K', status: 'approved', visible: false, partnerName: null })]));
});

describe('Admin reviews page', () => {
  it('lists reviews with real partner names and a dash when none is assigned', async () => {
    renderPage();
    const table = await screen.findByRole('table', { name: 'Reviews' });
    expect(within(table).getAllByRole('row').slice(1)).toHaveLength(2);
    expect(within(table).getByText('Suresh')).toBeInTheDocument();
    expect(within(table).getByText('Hidden')).toBeInTheDocument();
    expect(within(table).getByText('—')).toBeInTheDocument();
  });

  it('filters by status through the server and shows counts', async () => {
    renderPage();
    await screen.findByRole('table');
    await userEvent.click(screen.getByRole('radio', { name: /^Approved/ }));
    await waitFor(() => expect(h.get).toHaveBeenLastCalledWith('/admin/reviews', expect.objectContaining({ params: expect.objectContaining({ status: 'approved' }) })));
  });

  it('approves a review with PATCH status', async () => {
    h.patch.mockResolvedValue({ data: { success: true } });
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /approve review by asha rao/i }));
    await waitFor(() => expect(h.patch).toHaveBeenCalledWith('/admin/reviews/rv1/status', { status: 'approved' }));
    expect(await screen.findByText('Review approved')).toBeInTheDocument();
  });

  it('restores a hidden review with PATCH visibility', async () => {
    h.patch.mockResolvedValue({ data: { success: true } });
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /restore review by ravi k/i }));
    await waitFor(() => expect(h.patch).toHaveBeenCalledWith('/admin/reviews/rv2/visibility', { visible: true }));
  });

  it('hides the hide/restore button without reviews:moderate', async () => {
    signIn([]);
    renderPage();
    await screen.findByRole('table');
    expect(screen.queryByRole('button', { name: /hide review|restore review/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /approve review by asha rao/i })).toBeInTheDocument();
  });

  it('shows the error with Retry instead of sample data', async () => {
    h.get.mockRejectedValue({ message: 'Unable to reach the server.' });
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent(/unable to reach the server/i);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import type { AdminNotification } from '@/services/adminNotificationApi';

/* A tiny socket: tests push `notification:new` through it exactly like the server would. */
const listeners = new Map<string, Set<(payload?: unknown) => void>>();
const socket = {
  connected: true,
  connect: vi.fn(),
  on: vi.fn((event: string, fn: (payload?: unknown) => void) => {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event)!.add(fn);
  }),
  off: vi.fn((event: string, fn: (payload?: unknown) => void) => listeners.get(event)?.delete(fn)),
};
const push = (event: string, payload?: unknown) => act(() => listeners.get(event)?.forEach((fn) => fn(payload)));

vi.mock('@/services/bookingSocket', () => ({ getSocket: () => socket }));
vi.mock('@/services/adminNotificationApi', async (orig) => ({
  ...(await orig<typeof import('@/services/adminNotificationApi')>()),
  fetchRecent: vi.fn(),
  markRead: vi.fn(),
  markAllRead: vi.fn(),
}));

import { fetchRecent, markAllRead, markRead } from '@/services/adminNotificationApi';
import { NotificationBell } from '@/components/admin/NotificationBell';

const mFetch = vi.mocked(fetchRecent);
const never = () => new Promise<never>(() => undefined); // a refetch that has not answered yet

const row = (id: string, type: string, payload: Record<string, unknown> = {}, readAt: string | null = null, minutesAgo = 5): AdminNotification => ({
  id,
  type,
  payload,
  readAt,
  createdAt: new Date(Date.now() - minutesAgo * 60_000).toISOString(),
});

const Where = () => {
  const l = useLocation();
  return <p data-testid="where">{l.pathname + l.search}</p>;
};
const renderBell = () =>
  render(
    <MemoryRouter initialEntries={['/admin']}>
      <NotificationBell />
      <Where />
    </MemoryRouter>,
  );
const badge = () => screen.queryByTestId('bell-count');
const openBell = async () => userEvent.click(screen.getByRole('button', { name: /notifications/i }));

beforeEach(() => {
  listeners.clear();
  vi.clearAllMocks();
  vi.mocked(markRead).mockResolvedValue({} as never);
  vi.mocked(markAllRead).mockResolvedValue({} as never);
});

describe('admin notification bell', () => {
  it('shows the unread count from GET /notifications', async () => {
    mFetch.mockResolvedValueOnce({ items: [row('a', 'booking.created'), row('b', 'ticket.reply')], unread: 12 });
    renderBell();
    await waitFor(() => expect(badge()).toHaveTextContent('9+')); // 12 is capped
    expect(screen.getByRole('button', { name: 'Notifications, 12 unread' })).toBeInTheDocument();
  });

  it('lists the recent notifications with their titles, including the live alert types', async () => {
    mFetch.mockResolvedValueOnce({
      items: [row('1', 'kyc.submitted'), row('2', 'refund.requested'), row('3', 'payout.failed'), row('4', 'sla.breach')],
      unread: 4,
    });
    renderBell();
    await waitFor(() => expect(badge()).toHaveTextContent('4'));
    await openBell();
    for (const t of ['KYC submitted', 'Refund requested', 'Payout failed', 'SLA breach']) expect(screen.getByText(t)).toBeInTheDocument();
  });

  it('highlights SOS: red badge, listed first, marked urgent', async () => {
    mFetch.mockResolvedValueOnce({
      items: [row('n1', 'booking.created'), row('s1', 'sos.alert', { message: 'SOS pressed by Ravi' }, null, 30)],
      unread: 2,
    });
    renderBell();
    await waitFor(() => expect(badge()).toHaveClass('hcx-bell__count--sos'));
    await openBell();
    const rows = screen.getAllByRole('listitem');
    expect(within(rows[0]).getByText('SOS alert')).toBeInTheDocument(); // older, but first
    expect(rows[0]).toHaveClass('is-sos');
    expect(rows[1]).not.toHaveClass('is-sos');
  });

  it('a read SOS is no longer pinned or red', async () => {
    mFetch.mockResolvedValueOnce({ items: [row('n1', 'booking.created'), row('s1', 'sos.alert', {}, new Date().toISOString())], unread: 1 });
    renderBell();
    await waitFor(() => expect(badge()).toHaveTextContent('1'));
    expect(badge()).not.toHaveClass('hcx-bell__count--sos');
    await openBell();
    expect(within(screen.getAllByRole('listitem')[0]).getByText('New booking')).toBeInTheDocument();
  });

  it('clicking one marks it read and opens its page', async () => {
    mFetch.mockResolvedValueOnce({ items: [row('r1', 'refund.requested', { refundId: 'abc123' })], unread: 1 });
    renderBell();
    await waitFor(() => expect(badge()).toHaveTextContent('1'));
    await openBell();
    await userEvent.click(screen.getByText('Refund requested'));
    expect(markRead).toHaveBeenCalledWith('r1');
    expect(screen.getByTestId('where')).toHaveTextContent('/admin/refunds/abc123');
    expect(badge()).toBeNull(); // 1 -> 0
    expect(screen.queryByText('Mark all read')).toBeNull(); // panel closed
  });

  it('opening an already-read one does not lower the count or call the API', async () => {
    mFetch.mockResolvedValueOnce({
      items: [row('u', 'booking.created'), row('d', 'payout.failed', { payoutId: 'po1' }, new Date().toISOString())],
      unread: 1,
    });
    renderBell();
    await waitFor(() => expect(badge()).toHaveTextContent('1'));
    await openBell();
    await userEvent.click(screen.getByText('Payout failed'));
    expect(markRead).not.toHaveBeenCalled();
    expect(screen.getByTestId('where')).toHaveTextContent('/admin/payouts/po1');
    expect(badge()).toHaveTextContent('1');
  });

  it('Mark all read clears the badge and calls PATCH read-all', async () => {
    mFetch.mockResolvedValueOnce({ items: [row('a', 'booking.created'), row('b', 'sla.breach')], unread: 2 });
    renderBell();
    await waitFor(() => expect(badge()).toHaveTextContent('2'));
    await openBell();
    await userEvent.click(screen.getByRole('button', { name: 'Mark all read' }));
    expect(markAllRead).toHaveBeenCalledTimes(1);
    expect(badge()).toBeNull();
    expect(screen.getByRole('button', { name: 'Mark all read' })).toBeDisabled();
  });

  it('SOS pushed over the socket shows instantly, without waiting for a refetch', async () => {
    mFetch.mockResolvedValueOnce({ items: [], unread: 0 }).mockImplementation(never);
    renderBell();
    await waitFor(() => expect(mFetch).toHaveBeenCalledTimes(1));
    expect(badge()).toBeNull();

    push('notification:new', row('sos1', 'sos.alert', { message: 'SOS pressed by Ravi on an active job', bookingId: 'b1' }, null, 0));

    expect(badge()).toHaveTextContent('1'); // the refetch (2nd call) is still pending
    expect(badge()).toHaveClass('hcx-bell__count--sos');
    expect(screen.getByRole('alert')).toHaveTextContent('SOS pressed by Ravi on an active job');
    await openBell();
    expect(screen.getByText('SOS alert').closest('li')).toHaveClass('is-sos');
  });

  it('other live alerts arrive the same way, in order, newest on top', async () => {
    mFetch.mockResolvedValueOnce({ items: [], unread: 0 }).mockImplementation(never);
    renderBell();
    await waitFor(() => expect(mFetch).toHaveBeenCalledTimes(1));
    push('notification:new', row('k1', 'kyc.submitted', { partnerId: 'p1' }, null, 2));
    push('notification:new', row('p1', 'payout.failed', { payoutId: 'po1' }, null, 0));
    expect(badge()).toHaveTextContent('2');
    expect(badge()).not.toHaveClass('hcx-bell__count--sos');
    await openBell();
    const titles = screen.getAllByRole('listitem').map((li) => li.textContent);
    expect(titles[0]).toContain('Payout failed');
    expect(titles[1]).toContain('KYC submitted');
  });

  it('a redelivered row (socket reconnect) is not counted twice', async () => {
    mFetch.mockResolvedValueOnce({ items: [], unread: 0 }).mockImplementation(never);
    renderBell();
    await waitFor(() => expect(mFetch).toHaveBeenCalledTimes(1));
    const sos = row('sos1', 'sos.alert', {}, null, 0);
    push('notification:new', sos);
    push('notification:new', sos);
    expect(badge()).toHaveTextContent('1');
  });

  it('after a push, the refetch makes the count exact', async () => {
    mFetch.mockResolvedValueOnce({ items: [], unread: 0 }).mockResolvedValueOnce({ items: [row('s', 'sos.alert')], unread: 1 });
    renderBell();
    await waitFor(() => expect(mFetch).toHaveBeenCalledTimes(1));
    push('notification:new', row('s', 'sos.alert'));
    await waitFor(() => expect(mFetch).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(badge()).toHaveTextContent('1'));
  });

  it('when loading fails the panel says so and Retry loads it', async () => {
    mFetch.mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce({ items: [row('a', 'booking.created')], unread: 1 });
    renderBell();
    await waitFor(() => expect(mFetch).toHaveBeenCalledTimes(1));
    await openBell();
    expect(await screen.findByText(/couldn.t load notifications/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('New booking')).toBeInTheDocument();
  });

  it('with nothing to show, says so; the "view all" link goes to the full page', async () => {
    mFetch.mockResolvedValueOnce({ items: [], unread: 0 });
    renderBell();
    await waitFor(() => expect(mFetch).toHaveBeenCalled());
    await openBell();
    expect(screen.getByText(/all caught up/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: 'View all notifications' }));
    expect(screen.getByTestId('where')).toHaveTextContent('/admin/notifications');
  });
});

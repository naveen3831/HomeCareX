import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock('@/lib/http', () => ({ default: h }));

/** A fake socket: lets a test "push" server events and records what the page asked the server for. */
const sock = vi.hoisted(() => {
  const handlers = new Map<string, Set<(p: unknown) => void>>();
  const emitted: { event: string; payload: unknown }[] = [];
  const socket = {
    connected: true,
    on: (e: string, fn: (p: unknown) => void) => (handlers.set(e, (handlers.get(e) ?? new Set()).add(fn)), socket),
    off: (e: string, fn: (p: unknown) => void) => (handlers.get(e)?.delete(fn), socket),
    emit: (event: string, payload: unknown) => void emitted.push({ event, payload }),
    timeout: () => ({
      emit: (event: string, payload: unknown, cb: (err: Error | null, res: { ok: boolean }) => void) => {
        emitted.push({ event, payload });
        cb(null, { ok: true });
      },
    }),
    fire: (event: string, payload: unknown) => handlers.get(event)?.forEach((fn) => fn(payload)),
  };
  return { socket, emitted, handlers };
});
vi.mock('@/hooks/useSocket', () => ({ useSocket: () => ({ socket: sock.socket, connected: true }) }));

const perms = vi.hoisted(() => ({ granted: new Set<string>() }));
vi.mock('@/hooks/usePermissions', () => ({
  usePermissions: () => ({ can: (k?: string | string[]) => (Array.isArray(k) ? k : k ? [k] : []).every((x) => perms.granted.has(x)), permissions: [], isSuperAdmin: false }),
}));

import AdminSupportTicketPage from '@/pages/admin/Support/Ticketdetail';

const apiTicket = (over: Record<string, unknown> = {}) => ({
  id: 't1', ticketRef: 'TCK-000001', subject: 'Refund not received', category: 'payment',
  priority: 'high', status: 'open',
  requester: { role: 'customer', id: 'c1', name: 'Ananya Rao', email: 'ananya@x.com', phone: '9000000011' },
  booking: { id: 'b1', ref: 'BK-A1B2C' }, assignee: null, sla: null,
  bookingContext: { id: 'b1', ref: 'BK-A1B2C', serviceName: 'AC Repair', status: 'COMPLETED', paymentStatus: 'PAID', scheduledAt: '2026-10-14T05:30:00.000Z', total: 899, address: '12 MG Road, Hyderabad', partner: { id: 'p1', name: 'Ramesh Plumber' } },
  createdAt: '2026-10-14T05:30:00.000Z', updatedAt: '2026-10-14T05:30:00.000Z', ...over,
});
const msg = (id: string, over: Record<string, unknown> = {}) => ({
  id, ticketId: 't1', sender: { id: 'c1', name: 'Ananya Rao', role: 'customer' }, body: `body ${id}`,
  attachments: [], internal: false, createdAt: '2026-10-14T06:00:00.000Z', ...over,
});

let ticketRes = apiTicket();
let thread = [msg('m1', { body: 'Where is my refund?' }), msg('m2', { sender: { id: 'a1', name: 'Asha Admin', role: 'admin' }, body: 'Checking with finance', internal: true })];

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/admin/support/t1']}>
      <Routes>
        <Route path="/admin/support/:id" element={<AdminSupportTicketPage />} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  Object.values(h).forEach((f) => f.mockReset());
  sock.emitted.length = 0;
  sock.handlers.clear();
  perms.granted = new Set();
  ticketRes = apiTicket();
  thread = [msg('m1', { body: 'Where is my refund?' }), msg('m2', { sender: { id: 'a1', name: 'Asha Admin', role: 'admin' }, body: 'Checking with finance', internal: true })];
  h.get.mockImplementation(async (url: string) => {
    if (url === '/admin/tickets/t1') return { data: { success: true, data: ticketRes } };
    if (url === '/admin/tickets/t1/messages') return { data: { success: true, data: thread } };
    if (url === '/admin/ticket-assignees') return { data: { success: true, data: [{ id: 'a1', name: 'Asha Admin' }] } };
    throw new Error(`unexpected GET ${url}`);
  });
});

const loaded = async () => {
  renderPage();
  await screen.findByText('Where is my refund?');
};

describe('support ticket page: context', () => {
  it('shows the requester, the booking context and tags internal notes', async () => {
    await loaded();
    expect(screen.getByText('Ananya Rao', { selector: '.sup-fact .sup-strong' })).toBeInTheDocument();
    expect(screen.getByText('ananya@x.com')).toBeInTheDocument();
    expect(screen.getByText('AC Repair')).toBeInTheDocument();
    expect(screen.getByText('₹899')).toBeInTheDocument();
    expect(screen.getByText('12 MG Road, Hyderabad')).toBeInTheDocument();
    expect(screen.getByText('Ramesh Plumber')).toBeInTheDocument();
    expect(screen.getByText(/Internal note · not visible to the customer/)).toBeInTheDocument();
  });

  it('still opens when the ticket has no booking context', async () => {
    ticketRes = apiTicket({ booking: null, bookingContext: null });
    await loaded();
    expect(screen.queryByText('AC Repair')).not.toBeInTheDocument();
  });
});

describe('support ticket page: reply', () => {
  it('sends a reply to the requester and shows it in the thread', async () => {
    h.post.mockResolvedValue({ data: { success: true, data: msg('m3', { sender: { id: 'a1', name: 'Asha Admin', role: 'admin' }, body: 'Refund issued' }) } });
    await loaded();
    const send = screen.getByRole('button', { name: /send reply/i });
    expect(send).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Reply to requester'), '  Refund issued  ');
    await userEvent.click(send);
    await waitFor(() => expect(h.post).toHaveBeenCalledWith('/admin/tickets/t1/messages', { body: 'Refund issued', internal: false }));
    expect(await screen.findByText('Refund issued', { selector: '.sup-msg__bubble' })).toBeInTheDocument();
    expect(screen.getByLabelText('Reply to requester')).toHaveValue('');
  });

  it('sends an internal note with internal: true', async () => {
    h.post.mockResolvedValue({ data: { success: true, data: msg('m4', { internal: true, body: 'Escalate if no reply' }) } });
    await loaded();
    await userEvent.click(screen.getByRole('tab', { name: /internal note/i }));
    await userEvent.type(screen.getByLabelText('Internal note'), 'Escalate if no reply');
    await userEvent.click(screen.getByRole('button', { name: /add note/i }));
    await waitFor(() => expect(h.post).toHaveBeenCalledWith('/admin/tickets/t1/messages', { body: 'Escalate if no reply', internal: true }));
  });

  it('keeps what the agent typed when sending fails, and says why', async () => {
    h.post.mockRejectedValue({ response: { status: 409, data: { message: 'Closed tickets cannot receive messages' } } });
    await loaded();
    await userEvent.type(screen.getByLabelText('Reply to requester'), 'Hello');
    await userEvent.click(screen.getByRole('button', { name: /send reply/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Closed tickets cannot receive messages');
    expect(screen.getByLabelText('Reply to requester')).toHaveValue('Hello');
  });

  it('a closed ticket takes no reply and offers no resolve / escalate', async () => {
    ticketRes = apiTicket({ status: 'closed' });
    await loaded();
    expect(screen.queryByLabelText('Reply to requester')).not.toBeInTheDocument();
    expect(screen.getByText(/ticket is closed/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /resolve/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /escalate/i })).not.toBeInTheDocument();
  });
});

describe('support ticket page: live', () => {
  it('joins the ticket room, says Live, and shows pushed messages once (no duplicates, other tickets ignored)', async () => {
    await loaded();
    expect(sock.emitted).toContainEqual({ event: 'ticket:join', payload: { ticketId: 't1' } });
    expect(await screen.findByText('Live')).toBeInTheDocument();

    act(() => sock.socket.fire('ticket:message', msg('m9', { body: 'Any update?' })));
    expect(await screen.findByText('Any update?')).toBeInTheDocument();
    act(() => sock.socket.fire('ticket:message', msg('m9', { body: 'Any update?' })));
    expect(screen.getAllByText('Any update?')).toHaveLength(1);

    act(() => sock.socket.fire('ticket:message', msg('m10', { ticketId: 'other', body: 'Wrong ticket' })));
    expect(screen.queryByText('Wrong ticket')).not.toBeInTheDocument();
  });

  it('leaves the room when the page closes', async () => {
    const { unmount } = render(
      <MemoryRouter initialEntries={['/admin/support/t1']}>
        <Routes><Route path="/admin/support/:id" element={<AdminSupportTicketPage />} /></Routes>
      </MemoryRouter>,
    );
    await screen.findByText('Where is my refund?');
    unmount();
    expect(sock.emitted).toContainEqual({ event: 'ticket:leave', payload: { ticketId: 't1' } });
  });

  it('refetches when ANOTHER agent changes status, but not for its own change', async () => {
    await loaded();
    const before = h.get.mock.calls.filter(([u]) => u === '/admin/tickets/t1').length;
    act(() => sock.socket.fire('ticket:updated', { ticketId: 't1', status: 'open', priority: 'high', updatedAt: 'x' }));
    expect(h.get.mock.calls.filter(([u]) => u === '/admin/tickets/t1').length).toBe(before);
    ticketRes = apiTicket({ status: 'resolved' });
    act(() => sock.socket.fire('ticket:updated', { ticketId: 't1', status: 'resolved', priority: 'high', updatedAt: 'y' }));
    await waitFor(() => expect(h.get.mock.calls.filter(([u]) => u === '/admin/tickets/t1').length).toBe(before + 1));
  });
});

describe('support ticket page: status, priority, resolve, escalate', () => {
  it('Resolve patches status to resolved', async () => {
    h.patch.mockResolvedValue({ data: { success: true, data: apiTicket({ status: 'resolved' }) } });
    await loaded();
    await userEvent.click(screen.getByRole('button', { name: /^resolve$/i }));
    await waitFor(() => expect(h.patch).toHaveBeenCalledWith('/admin/tickets/t1/status', { status: 'resolved' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: /^resolve$/i })).not.toBeInTheDocument());
  });

  it('rolls the status back and explains when the server refuses', async () => {
    h.patch.mockRejectedValue({ response: { status: 409, data: { message: 'Ticket was changed by someone else. Reload and try again.' } } });
    await loaded();
    await userEvent.selectOptions(screen.getByLabelText('Status for TCK-000001'), 'IN_PROGRESS');
    expect(await screen.findByRole('alert')).toHaveTextContent('changed by someone else');
    expect(screen.getByLabelText('Status for TCK-000001')).toHaveValue('OPEN');
  });

  it('changes priority', async () => {
    h.patch.mockResolvedValue({ data: { success: true, data: apiTicket({ priority: 'low' }) } });
    await loaded();
    await userEvent.selectOptions(screen.getByLabelText('Priority for TCK-000001'), 'LOW');
    await waitFor(() => expect(h.patch).toHaveBeenCalledWith('/admin/tickets/t1/priority', { priority: 'low' }));
  });

  it('Escalate needs a reason, then sets urgent and leaves an internal note', async () => {
    h.patch.mockResolvedValue({ data: { success: true, data: apiTicket({ priority: 'urgent' }) } });
    h.post.mockResolvedValue({ data: { success: true, data: msg('m5', { internal: true, body: 'Escalated: charged twice' }) } });
    await loaded();
    await userEvent.click(screen.getByRole('button', { name: /^escalate$/i }));
    const dialog = within(screen.getByRole('dialog'));
    const confirm = dialog.getByRole('button', { name: 'Escalate' });
    expect(confirm).toBeDisabled();
    await userEvent.type(dialog.getByRole('textbox'), 'charged twice');
    await userEvent.click(confirm);
    await waitFor(() => expect(h.patch).toHaveBeenCalledWith('/admin/tickets/t1/priority', { priority: 'urgent' }));
    expect(h.post).toHaveBeenCalledWith('/admin/tickets/t1/messages', { body: 'Escalated: charged twice', internal: true });
    expect(await screen.findByText('Escalated: charged twice')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('button', { name: /^escalate$/i })).not.toBeInTheDocument());
  });

  it('if only the note fails, the ticket is still escalated and the agent is told', async () => {
    h.patch.mockResolvedValue({ data: { success: true, data: apiTicket({ priority: 'urgent' }) } });
    h.post.mockRejectedValue(new Error('network'));
    await loaded();
    await userEvent.click(screen.getByRole('button', { name: /^escalate$/i }));
    const dialog = within(screen.getByRole('dialog'));
    await userEvent.type(dialog.getByRole('textbox'), 'needs finance');
    await userEvent.click(dialog.getByRole('button', { name: 'Escalate' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/internal note could not be saved/i);
  });
});

describe('support ticket page: refund / credit needs the finance permission', () => {
  it('hidden for an agent with tickets:manage only', async () => {
    perms.granted = new Set(['tickets:manage']);
    await loaded();
    expect(screen.queryByRole('link', { name: /refund \/ credit/i })).not.toBeInTheDocument();
  });

  it('shown with payments:refund, linking to Refunds for this booking', async () => {
    perms.granted = new Set(['tickets:manage', 'payments:refund']);
    await loaded();
    expect(screen.getByRole('link', { name: /refund \/ credit/i })).toHaveAttribute('href', '/admin/refunds?bookingId=b1');
  });

  it('not offered at all when the ticket has no booking, even with the permission', async () => {
    perms.granted = new Set(['payments:refund']);
    ticketRes = apiTicket({ booking: null, bookingContext: null });
    await loaded();
    expect(screen.queryByRole('link', { name: /refund \/ credit/i })).not.toBeInTheDocument();
  });
});
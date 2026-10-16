import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock('@/lib/http', () => ({ default: h }));

import AdminSupportPage from '@/pages/admin/Support';
import { formatDuration, getSla } from '@/pages/admin/Support/sla';
import { normalizeTicket } from '@/services/adminTicketApi';
import type { AdminTicket, ApiTicket } from '@/types/adminTicket';

const NOW = new Date('2026-10-13T12:00:00Z').getTime();
const iso = (offsetMs: number) => new Date(NOW + offsetMs).toISOString();
const H = 3_600_000;

const ticket = (over: Partial<AdminTicket> = {}): AdminTicket => ({
  id: 't1', ticketRef: 'TCK-1', subject: 'AC not cooling', priority: 'HIGH', status: 'OPEN',
  requester: { type: 'customer', id: 'c1', name: 'Asha Rao' }, bookingId: 'b1', bookingRef: 'BK-1A2B3',
  assignee: null, sla: { dueAt: iso(5 * H) }, createdAt: iso(-3 * H), updatedAt: iso(-1 * H), ...over,
});

/** A ticket exactly as the backend sends it: lowercase enums, nested booking, requester.role, nullable sla. */
const apiTicket = (over: Partial<ApiTicket> = {}): ApiTicket => ({
  id: 't1', ticketRef: 'TCK-1', subject: 'AC not cooling', priority: 'high', status: 'open',
  requester: { role: 'customer', id: 'c1', name: 'Asha Rao' }, booking: { id: 'b1', ref: 'BK-1A2B3' },
  assignee: null, sla: { dueAt: iso(5 * H) }, createdAt: iso(-3 * H), updatedAt: iso(-1 * H), ...over,
});

describe('normalizeTicket (backend contract -> page model)', () => {
  it('upper-cases status and priority, including multi-word values (the exact backend enums)', () => {
    const t = normalizeTicket(apiTicket({ status: 'in_progress', priority: 'urgent' }));
    expect(t.status).toBe('IN_PROGRESS');
    expect(t.priority).toBe('URGENT');
  });
  it('flattens booking and maps requester.role to requester.type', () => {
    const t = normalizeTicket(apiTicket({ requester: { role: 'partner', id: 'p1', name: 'Ravi' } }));
    expect(t.bookingId).toBe('b1');
    expect(t.bookingRef).toBe('BK-1A2B3');
    expect(t.requester).toMatchObject({ type: 'partner', name: 'Ravi' });
  });
  it('copes with a missing booking, requester and a null sla', () => {
    const t = normalizeTicket(apiTicket({ booking: null, requester: null, sla: null }));
    expect(t.bookingId).toBeNull();
    expect(t.bookingRef).toBeNull();
    expect(t.requester).toBeNull();
    expect(t.sla).toEqual({ dueAt: null, pausedAt: null, resolvedAt: null });
    expect(getSla(t, NOW).state).toBe('none');
  });
  it('falls back safely on unknown enum values instead of crashing the page', () => {
    const t = normalizeTicket(apiTicket({ status: 'mystery', priority: '' }));
    expect(t.status).toBe('OPEN');
    expect(t.priority).toBe('NORMAL');
    expect(normalizeTicket(apiTicket({ priority: 'normal' })).priority).toBe('NORMAL');
  });
});

describe('getSla', () => {
  it('counts down while healthy', () => {
    expect(getSla(ticket(), NOW)).toMatchObject({ state: 'ok', label: '5h 00m left' });
  });
  it('flags at-risk inside the last 25% of the window', () => {
    // window = 8h, 25% = 2h; 1h left
    expect(getSla(ticket({ sla: { dueAt: iso(1 * H) } }), NOW)).toMatchObject({ state: 'at_risk', label: '1h 00m left' });
  });
  it('flags breached with elapsed time', () => {
    expect(getSla(ticket({ sla: { dueAt: iso(-90 * 60_000) } }), NOW)).toMatchObject({ state: 'breached', label: 'Breached 1h 30m ago' });
  });
  it('pauses while the clock is paused', () => {
    expect(getSla(ticket({ sla: { dueAt: iso(5 * H), pausedAt: iso(-H) } }), NOW).state).toBe('paused');
  });
  it('says "Closed" (not "No SLA") for resolved tickets, where the backend sends sla: null', () => {
    const t = normalizeTicket(apiTicket({ status: 'resolved', sla: null }));
    expect(getSla(t, NOW)).toMatchObject({ state: 'none', label: 'Closed' });
  });
  it('reports met / missed once resolved', () => {
    expect(getSla(ticket({ status: 'RESOLVED', sla: { dueAt: iso(H), resolvedAt: iso(-H) } }), NOW).state).toBe('met');
    expect(getSla(ticket({ status: 'RESOLVED', sla: { dueAt: iso(-2 * H), resolvedAt: iso(-H) } }), NOW).state).toBe('missed');
  });
  it('handles no SLA', () => {
    expect(getSla(ticket({ sla: { dueAt: null } }), NOW).state).toBe('none');
  });
  it('formats durations', () => {
    expect(formatDuration(30_000)).toBe('<1m');
    expect(formatDuration(26 * H)).toBe('1d 2h');
  });
});

const ok = (data: unknown, meta?: unknown) => Promise.resolve({ data: { success: true, data, meta } });
const META = { page: 1, limit: 15, total: 1, pages: 1 };
const AGENTS = [{ id: 'a1', name: 'Priya' }, { id: 'a2', name: 'Dev' }];

describe('Admin support queue', () => {
  beforeEach(() => {
    Object.values(h).forEach((f) => f.mockReset());
    h.get.mockImplementation((url: string) => (url === '/admin/ticket-assignees' ? ok(AGENTS) : ok([apiTicket()], META)));
  });

  it('asks the backend for assignable staff and sends lowercase filters', async () => {
    render(<MemoryRouter><AdminSupportPage /></MemoryRouter>);
    await screen.findByText('TCK-1');
    expect(h.get).toHaveBeenCalledWith('/admin/ticket-assignees', { params: { assignable: true } });
    await userEvent.click(screen.getByRole('button', { name: /^Filters/ }));
    const sheet = within(screen.getByRole('dialog', { name: 'Filter tickets' }));
    await userEvent.click(sheet.getByRole('button', { name: 'In progress' }));
    // nothing is requested until Apply
    expect(h.get).not.toHaveBeenCalledWith('/admin/tickets', { params: expect.objectContaining({ status: 'in_progress' }) });
    await userEvent.click(sheet.getByRole('button', { name: 'Apply filters' }));
    await waitFor(() =>
      expect(h.get).toHaveBeenCalledWith('/admin/tickets', {
        params: expect.objectContaining({ status: 'in_progress' }),
      }),
    );
  });

  it('filters open in a side sheet and offer only what the backend accepts', async () => {
    render(<MemoryRouter><AdminSupportPage /></MemoryRouter>);
    await screen.findByText('TCK-1');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /^Filters/ }));
    const sheet = within(screen.getByRole('dialog', { name: 'Filter tickets' }));
    const group = (name: string) =>
      within(sheet.getByRole('group', { name })).getAllByRole('button').map((b) => b.textContent);
    expect(group('Status')).toEqual(['All', 'Open', 'In progress', 'Waiting', 'Resolved', 'Closed']);
    expect(group('Priority')).toEqual(['All', 'Low', 'Normal', 'High', 'Urgent']);
    await waitFor(() => expect(group('Assignee')).toEqual(['All', 'Unassigned', 'Priya', 'Dev']));
  });

  it('applied filters show as removable tags and a count on the button', async () => {
    render(<MemoryRouter><AdminSupportPage /></MemoryRouter>);
    await screen.findByText('TCK-1');
    await userEvent.click(screen.getByRole('button', { name: /^Filters/ }));
    const sheet = within(screen.getByRole('dialog', { name: 'Filter tickets' }));
    await userEvent.click(sheet.getByRole('button', { name: 'Urgent' }));
    await userEvent.click(sheet.getByRole('button', { name: 'Unassigned' }));
    await userEvent.click(sheet.getByRole('button', { name: 'Apply filters' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const tags = within(screen.getByLabelText('Applied filters'));
    expect(tags.getByText('Urgent priority')).toBeInTheDocument();
    expect(tags.getByText('Unassigned')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Filters/ })).toHaveTextContent('2');
    await waitFor(() =>
      expect(h.get).toHaveBeenCalledWith('/admin/tickets', {
        params: expect.objectContaining({ priority: 'urgent', assignee: 'unassigned', page: 1 }),
      }),
    );
    await userEvent.click(tags.getByRole('button', { name: 'Remove Urgent priority' }));
    expect(screen.queryByText('Urgent priority')).not.toBeInTheDocument();
  });

  it('closing the sheet without applying keeps the old filters', async () => {
    render(<MemoryRouter><AdminSupportPage /></MemoryRouter>);
    await screen.findByText('TCK-1');
    await userEvent.click(screen.getByRole('button', { name: /^Filters/ }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Open' }));
    await userEvent.click(screen.getByRole('button', { name: 'Close filters' }));
    expect(screen.queryByLabelText('Applied filters')).not.toBeInTheDocument();
  });

  it('sends the search box text as ?search=', async () => {
    render(<MemoryRouter><AdminSupportPage /></MemoryRouter>);
    await screen.findByText('TCK-1');
    await userEvent.type(screen.getByLabelText('Search tickets'), 'decade');
    await waitFor(() =>
      expect(h.get).toHaveBeenCalledWith('/admin/tickets', { params: expect.objectContaining({ search: 'decade', page: 1 }) }),
    );
  });

  it('renders a ticket with no SLA and no booking without crashing', async () => {
    h.get.mockImplementation((url: string) =>
      url === '/admin/ticket-assignees' ? ok(AGENTS) : ok([apiTicket({ sla: null, booking: null })], META));
    render(<MemoryRouter><AdminSupportPage /></MemoryRouter>);
    expect(await screen.findByText('TCK-1')).toBeInTheDocument();
    expect(screen.getByText('No SLA')).toBeInTheDocument();
  });

  it('renders the queue with an SLA badge', async () => {
    render(<MemoryRouter><AdminSupportPage /></MemoryRouter>);
    expect(await screen.findByText('TCK-1')).toBeInTheDocument();
    expect(screen.getByText('AC not cooling')).toBeInTheDocument();
    expect(screen.getByTitle(/^Due /)).toBeInTheDocument();
  });

  it('assigns via PATCH /admin/tickets/:id/assign and shows the result', async () => {
    h.patch.mockImplementation(() => ok(apiTicket({ assignee: AGENTS[0] })));
    render(<MemoryRouter><AdminSupportPage /></MemoryRouter>);
    const select = await screen.findByLabelText('Assignee for TCK-1');
    await waitFor(() => expect(within(select).getByRole('option', { name: 'Priya' })).toBeInTheDocument());
    await userEvent.selectOptions(select, 'a1');
    expect(h.patch).toHaveBeenCalledWith('/admin/tickets/t1/assign', { assigneeId: 'a1' });
    await waitFor(() => expect(select).toHaveValue('a1'));
  });

  it('rolls back and reports when assigning fails', async () => {
    h.patch.mockRejectedValue({ response: { data: { message: 'Not allowed' } } });
    render(<MemoryRouter><AdminSupportPage /></MemoryRouter>);
    const select = await screen.findByLabelText('Assignee for TCK-1');
    await waitFor(() => expect(within(select).getByRole('option', { name: 'Dev' })).toBeInTheDocument());
    await userEvent.selectOptions(select, 'a2');
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't update TCK-1: Not allowed");
    expect(select).toHaveValue('');
  });

  it('unassigns by sending a null assigneeId', async () => {
    h.get.mockImplementation((url: string) => (url === '/admin/ticket-assignees' ? ok(AGENTS) : ok([apiTicket({ assignee: AGENTS[0] })], META)));
    h.patch.mockImplementation(() => ok(apiTicket()));
    render(<MemoryRouter><AdminSupportPage /></MemoryRouter>);
    const select = await screen.findByLabelText('Assignee for TCK-1');
    await userEvent.selectOptions(select, '');
    expect(h.patch).toHaveBeenCalledWith('/admin/tickets/t1/assign', { assigneeId: null });
  });
});

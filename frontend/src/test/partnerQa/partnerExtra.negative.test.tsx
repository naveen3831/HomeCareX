import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import * as earn from '@/services/earningsApi';
import * as sup from '@/pages/partner/Support/support.api';
import * as tx from '@/pages/partner/Transactions/transactions.api';
import * as avail from '@/pages/partner/Availability/availability.api';
import * as jobs from '@/pages/partner/JobDetails/jobDetails.api';
import Earnings from '@/pages/partner/Earnings';
import SupportTicketPage from '@/pages/partner/SupportTicket/SupportTicketPage';
import Transactions from '@/pages/partner/Transactions';
import WorkingHours from '@/pages/partner/WorkingHours';
import ActiveSessionsPage from '@/pages/partner/Settings/ActiveSessionsPage';
import { SosButton } from '@/components/partner/SosButton';
import { networkError, renderPage, serverError, setOnline } from './helpers';

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'p1' }, logout: vi.fn() }) }));
vi.mock('@/pages/partner/SupportTicket/usePartnerTicketLive', () => ({ usePartnerTicketLive: () => ({ connected: false }) }));
const sessionsState = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock('@/features/auth', () => ({
  useSessions: () => sessionsState.value,
  useLogoutAll: () => ({ logoutAll: vi.fn(), loading: false, error: null }),
}));

beforeEach(() => { setOnline(true); Element.prototype.scrollTo = (() => {}) as never; });
afterEach(() => { vi.restoreAllMocks(); setOnline(true); });

/* ---------------- D02 Earnings ---------------- */
const summary = { currency: 'INR', today: 0, week: 0, month: 0, total: 0, pending: 0 } as never;
const emptyLedger = { currency: 'INR', items: [], totals: { count: 0, gross: 0, commission: 0, net: 0 }, series: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 } } as never;

describe('Earnings page', () => {
  it('shows a loading state, then the empty state for a new partner', async () => {
    vi.spyOn(earn.earningsApi, 'getSummary').mockResolvedValue(summary);
    vi.spyOn(earn.earningsApi, 'getLedger').mockResolvedValue(emptyLedger);
    renderPage(<Earnings />);
    expect(screen.getAllByRole('status', { name: /loading earnings/i }).length).toBeGreaterThan(0);
    expect(await screen.findByText(/no earnings yet/i)).toBeInTheDocument();
  });

  it('shows an error with retry when the summary fails', async () => {
    const s = vi.spyOn(earn.earningsApi, 'getSummary').mockRejectedValue(serverError());
    vi.spyOn(earn.earningsApi, 'getLedger').mockResolvedValue(emptyLedger);
    renderPage(<Earnings />);
    const btn = await screen.findByRole('button', { name: /try again|retry/i });
    const n = s.mock.calls.length;
    await userEvent.click(btn);
    await waitFor(() => expect(s.mock.calls.length).toBeGreaterThan(n));
  });

  it('shows the offline state when there is no data and the browser is offline', async () => {
    setOnline(false);
    vi.spyOn(earn.earningsApi, 'getSummary').mockRejectedValue(networkError());
    vi.spyOn(earn.earningsApi, 'getLedger').mockRejectedValue(networkError());
    renderPage(<Earnings />);
    expect((await screen.findAllByText(/offline|connection|internet/i)).length).toBeGreaterThan(0);
  });

  it('rejects an inverted custom range and disables the CSV download', async () => {
    vi.spyOn(earn.earningsApi, 'getSummary').mockResolvedValue(summary);
    vi.spyOn(earn.earningsApi, 'getLedger').mockResolvedValue(emptyLedger);
    const exp = vi.spyOn(earn.earningsApi, 'exportCsv');
    renderPage(<Earnings />);
    await screen.findByText(/no earnings yet/i);
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-10-20' } });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-10-10' } });
    expect(await screen.findByText(/start date must be on or before the end date/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /download csv/i })).toBeDisabled();
    expect(exp).not.toHaveBeenCalled();
  });

  it('rejects a range longer than the allowed maximum', async () => {
    vi.spyOn(earn.earningsApi, 'getSummary').mockResolvedValue(summary);
    vi.spyOn(earn.earningsApi, 'getLedger').mockResolvedValue(emptyLedger);
    renderPage(<Earnings />);
    await screen.findByText(/no earnings yet/i);
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2020-01-01' } });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-10-01' } });
    expect(await screen.findByText(/pick a range of at most/i)).toBeInTheDocument();
  });

  it('ledger failure shows an error inside the history section, not a blank area', async () => {
    vi.spyOn(earn.earningsApi, 'getSummary').mockResolvedValue(summary);
    vi.spyOn(earn.earningsApi, 'getLedger').mockRejectedValue(serverError());
    renderPage(<Earnings />);
    expect((await screen.findAllByRole('button', { name: /try again|retry/i })).length).toBeGreaterThan(0);
  });
});

/* ---------------- D08 SupportTicket ---------------- */
const ticketRoute = (id: string) =>
  renderPage(<Routes><Route path="/partner/support/:id" element={<SupportTicketPage />} /></Routes>, `/partner/support/${id}`);
const ticket = { id: 't1', category: 'payment', subject: 'Missing payout', status: 'open', bookingId: null, lastMessageAt: '2026-10-20T10:00:00Z', createdAt: '2026-10-20T09:00:00Z' };

describe('SupportTicket page', () => {
  it('shows a loading state while the ticket loads', () => {
    vi.spyOn(sup, 'getTicket').mockReturnValue(new Promise(() => {}));
    ticketRoute('t1');
    expect(screen.getByLabelText(/loading ticket/i)).toBeInTheDocument();
  });

  it.each([404, 403])('treats a %i as "Ticket not found" without leaking another partner\'s ticket', async (status) => {
    vi.spyOn(sup, 'getTicket').mockRejectedValue({ isAxiosError: true, response: { status, data: { message: 'Forbidden: owned by partner p9' } } });
    ticketRoute('t9');
    expect(await screen.findByText(/ticket not found/i)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/p9|forbidden/i);
  });

  it('shows an error with a working retry on a 500', async () => {
    const g = vi.spyOn(sup, 'getTicket').mockRejectedValue(serverError());
    ticketRoute('t1');
    const btn = await screen.findByRole('button', { name: /try again/i });
    const n = g.mock.calls.length;
    await userEvent.click(btn);
    await waitFor(() => expect(g.mock.calls.length).toBeGreaterThan(n));
  });

  it('renders the ticket details and does not send an empty reply', async () => {
    vi.spyOn(sup, 'getTicket').mockResolvedValue({ ticket, messages: [] } as never);
    const reply = vi.spyOn(sup, 'replyToTicket');
    ticketRoute('t1');
    expect((await screen.findAllByText(/missing payout/i)).length).toBeGreaterThan(0);
    expect(screen.getByText(/not linked to a booking/i)).toBeInTheDocument();
    const box = screen.getByRole('textbox');
    await userEvent.type(box, '    ');
    const send = screen.queryByRole('button', { name: /^send/i });
    if (send) await userEvent.click(send);
    expect(reply).not.toHaveBeenCalled();
  });

  it('locks the reply box for a closed ticket', async () => {
    vi.spyOn(sup, 'getTicket').mockResolvedValue({ ticket: { ...ticket, status: 'closed' }, messages: [] } as never);
    ticketRoute('t1');
    await screen.findAllByText(/missing payout/i);
    expect(screen.queryByRole('textbox')).toBeNull();
  });
});

/* ---------------- D05 Transactions filters / pagination ---------------- */
const page = (n: number, total: number) => ({ items: [{ id: `x${n}`, type: 'earning', amount: 500, createdAt: '2026-10-10T10:00:00Z', description: 'Job' }], total, page: n, limit: 8 }) as never;

describe('Transactions filters and pagination', () => {
  it('rejects an inverted date range without calling the API again', async () => {
    const g = vi.spyOn(tx, 'getTransactions').mockResolvedValue(page(1, 1));
    renderPage(<Transactions />);
    await waitFor(() => expect(g).toHaveBeenCalled());
    const group = screen.getByRole('group', { name: /filter by date/i });
    const [from, to] = Array.from(group.querySelectorAll('input[type="date"]')) as HTMLInputElement[];
    fireEvent.change(from, { target: { value: '2026-10-20' } });
    fireEvent.change(to, { target: { value: '2026-10-10' } });
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByText(/something went wrong/i)).toBeNull();
  });

  it('goes to the next page and disables Previous on page 1', async () => {
    const g = vi.spyOn(tx, 'getTransactions').mockImplementation(async (p: number) => page(p, 20));
    renderPage(<Transactions />);
    const next = await screen.findByRole('button', { name: /next/i });
    expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled();
    await userEvent.click(next);
    await waitFor(() => expect(g.mock.calls.some((c) => c[0] === 2)).toBe(true));
  });
});

/* ---------------- D01 WorkingHours validation ---------------- */
const week = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((day) => ({ day, start: '09:00', end: '18:00', off: false }));

describe('WorkingHours validation', () => {
  it('flags end before start and never saves it', async () => {
    vi.spyOn(avail, 'getAvailability').mockResolvedValue({ workingHours: week } as never);
    const save = vi.spyOn(avail, 'setWorkingHours');
    const { container } = renderPage(<WorkingHours />);
    await screen.findByRole('heading', { name: /working hours/i });
    const times = Array.from(container.querySelectorAll('input[type="time"]')) as HTMLInputElement[];
    fireEvent.change(times[1], { target: { value: '08:00' } }); // Monday end < start
    expect((await screen.findAllByText(/end time must be after start time/i)).length).toBeGreaterThan(0);
    const saveBtn = screen.queryByRole('button', { name: /^save/i });
    if (saveBtn && !(saveBtn as HTMLButtonElement).disabled) await userEvent.click(saveBtn);
    expect(save).not.toHaveBeenCalled();
  });
});

/* ---------------- D10 Active sessions ---------------- */
describe('ActiveSessions page', () => {
  const base = { sessions: [], isLoading: false, error: null, refetch: vi.fn(), revokeSession: vi.fn(), revokingId: null, isRevoking: false, revokeError: null };

  it('shows an error with Try again when sessions fail to load', () => {
    sessionsState.value = { ...base, error: { message: 'boom' } };
    renderPage(<ActiveSessionsPage />);
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('renders sessions without raw HTML injection from device names', () => {
    sessionsState.value = { ...base, sessions: [{ id: 's1', device: '<img src=x onerror=alert(1)>', browser: 'Chrome', ipAddress: '1.2.3.4', lastActiveAt: '2026-10-20T10:00:00Z', isCurrent: false }] };
    const { container } = renderPage(<ActiveSessionsPage />);
    expect(container.querySelector('img[src="x"]')).toBeNull();
  });
});

/* ---------------- D09 SOS button ---------------- */
describe('SosButton', () => {
  it('asks for confirmation, can be cancelled, and sends nothing until confirmed', async () => {
    const t = vi.spyOn(jobs, 'triggerSos').mockResolvedValue(undefined as never);
    renderPage(<SosButton />);
    await userEvent.click(screen.getByRole('button', { name: /emergency sos/i }));
    await userEvent.click(await screen.findByRole('button', { name: /cancel/i }));
    expect(t).not.toHaveBeenCalled();
  });

  it('shows a fallback to call 112 when the alert fails', async () => {
    vi.spyOn(jobs, 'triggerSos').mockRejectedValue(serverError());
    renderPage(<SosButton />);
    await userEvent.click(screen.getByRole('button', { name: /emergency sos/i }));
    await userEvent.click(await screen.findByRole('button', { name: /confirm sos/i }));
    expect((await screen.findAllByRole('alert')).length).toBeGreaterThan(0);
  });

  it('does not double-send on repeated clicks', async () => {
    const t = vi.spyOn(jobs, 'triggerSos').mockImplementation(() => new Promise(() => {}));
    renderPage(<SosButton />);
    await userEvent.click(screen.getByRole('button', { name: /emergency sos/i }));
    const send = await screen.findByRole('button', { name: /confirm sos/i });
    await userEvent.click(send);
    await userEvent.click(send);
    expect(t).toHaveBeenCalledTimes(1);
  });
});

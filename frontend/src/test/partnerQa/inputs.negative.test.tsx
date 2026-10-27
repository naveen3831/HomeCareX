import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as bo from '@/pages/partner/BlackoutDates/blackout.api';
import * as sup from '@/pages/partner/Support/support.api';
import BlackoutDates from '@/pages/partner/BlackoutDates';
import NewTicketForm from '@/pages/partner/Support/NewTicketForm';
import ChangePasswordPage from '@/pages/partner/Settings/ChangePasswordPage';
import HelpPage from '@/pages/partner/Help/HelpPage';
import { renderPage, setOnline } from './helpers';

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'p1' }, logout: vi.fn() }) }));

beforeEach(() => setOnline(true));
afterEach(() => { vi.restoreAllMocks(); setOnline(true); });

const isoDay = (offset: number) => {
  const d = new Date(); d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

describe('BlackoutDates invalid input', () => {
  const setup = async () => {
    vi.spyOn(bo, 'listBlackouts').mockResolvedValue([]);
    const create = vi.spyOn(bo, 'createBlackout').mockResolvedValue({ _id: 'b1', date: isoDay(5), reason: 'x' } as never);
    const { container } = renderPage(<BlackoutDates />);
    await screen.findByText(/nothing blocked off yet/i);
    const date = container.querySelector('input[type="date"]') as HTMLInputElement;
    const reason = screen.getByPlaceholderText(/family event/i);
    return { create, date, reason };
  };

  it('rejects a missing date without calling the API', async () => {
    const { create, reason } = await setup();
    await userEvent.type(reason, 'Holiday');
    await userEvent.click(screen.getByRole('button', { name: /add date/i }));
    expect(await screen.findByText(/pick a date/i)).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects a past date', async () => {
    const { create, date, reason } = await setup();
    fireEvent.change(date, { target: { value: isoDay(-3) } });
    await userEvent.type(reason, 'Holiday');
    await userEvent.click(screen.getByRole('button', { name: /add date/i }));
    expect(await screen.findByText(/cannot add a blackout date in the past/i)).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects a whitespace-only reason', async () => {
    const { create, date, reason } = await setup();
    fireEvent.change(date, { target: { value: isoDay(5) } });
    await userEvent.type(reason, '     ');
    await userEvent.click(screen.getByRole('button', { name: /add date/i }));
    expect(await screen.findByText(/add a short reason/i)).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
  });

  it('shows the server message when the API rejects the date (400/409)', async () => {
    const { create, date, reason } = await setup();
    create.mockRejectedValue({ message: 'That date is already blocked' });
    fireEvent.change(date, { target: { value: isoDay(5) } });
    await userEvent.type(reason, 'Holiday');
    await userEvent.click(screen.getByRole('button', { name: /add date/i }));
    expect(await screen.findByText(/already blocked/i)).toBeInTheDocument();
  });
});

describe('NewTicketForm invalid input', () => {
  it('blocks an empty submit and does not call the API', async () => {
    const create = vi.spyOn(sup, 'createTicket');
    renderPage(<NewTicketForm onCreated={vi.fn()} onCancel={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /submit|send|create ticket|raise/i }));
    expect(await screen.findByText(/add a short subject/i)).toBeInTheDocument();
    expect(screen.getByText(/describe what happened/i)).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects a malformed booking id', async () => {
    const create = vi.spyOn(sup, 'createTicket');
    renderPage(<NewTicketForm onCreated={vi.fn()} onCancel={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/subject/i), 'Missing payout');
    await userEvent.type(screen.getByLabelText(/booking/i), 'not-an-id');
    await userEvent.type(screen.getByLabelText(/message|describe|what happened/i), 'Please check');
    await userEvent.click(screen.getByRole('button', { name: /submit|send|create ticket|raise/i }));
    expect(await screen.findByText(/booking id doesn't look right/i)).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
  });
});

describe('ChangePasswordPage invalid input', () => {
  it('rejects a mismatched confirmation and a weak password', async () => {
    const { container } = renderPage(<ChangePasswordPage />);
    const [cur, next, confirm] = Array.from(container.querySelectorAll('input[type="password"]')) as HTMLInputElement[];
    fireEvent.change(cur, { target: { value: 'OldPass1!' } });
    fireEvent.change(next, { target: { value: 'short' } });
    fireEvent.change(confirm, { target: { value: 'different' } });
    fireEvent.click(screen.getByRole('button', { name: /update password/i }));
    expect(await screen.findByText('Password must be at least 8 characters')).toBeInTheDocument();
    expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
  });

  it('disables submit while offline', () => {
    setOnline(false);
    renderPage(<ChangePasswordPage />);
    expect(screen.getByRole('button', { name: /update password/i })).toBeDisabled();
  });
});

describe('HelpPage search', () => {
  it('shows an empty state for a query with no matches and survives odd input', async () => {
    renderPage(<HelpPage />);
    const box = screen.getAllByPlaceholderText(/search help articles/i)[0];
    await userEvent.type(box, 'zzzz<script>alert(1)</script>');
    expect(await screen.findByText(/no articles match/i)).toBeInTheDocument();
    expect(document.querySelector('script')).toBeNull();
  });
});

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock('@/lib/http', () => ({ default: h }));
// Use the real HTTP path (not the localStorage mock) so the request contract is tested.
vi.mock('@/services/adminRbacApi', () => ({ USE_RBAC_MOCK: false }));
vi.mock('@/hooks/useOnlineStatus', () => ({ useOnlineStatus: () => true }));

import AcceptInvitePage from '@/pages/public/AcceptInvite';

const Login: React.FC = () => {
  const l = useLocation();
  const s = l.state as { registeredEmail?: string; registeredMessage?: string } | null;
  return (
    <div>
      <span data-testid="login">login</span>
      <span data-testid="email">{s?.registeredEmail}</span>
      <span data-testid="msg">{s?.registeredMessage}</span>
    </div>
  );
};

const renderAt = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/accept-invite" element={<AcceptInvitePage />} />
        <Route path="/login" element={<Login />} />
      </Routes>
    </MemoryRouter>,
  );

const ok = (data: unknown) => Promise.resolve({ data: { success: true, data } });
const bad = (code: string, message: string) =>
  Promise.reject({ response: { status: 400, data: { success: false, code, message } } });

beforeEach(() => vi.clearAllMocks());

describe('Accept invite: invite -> set password -> login', () => {
  it('shows an invalid-link screen when there is no token', async () => {
    renderAt('/accept-invite');
    expect(await screen.findByText(/invitation link not valid/i)).toBeInTheDocument();
    expect(h.post).not.toHaveBeenCalled();
  });

  it('rejects an expired or used link', async () => {
    h.post.mockImplementation(() => bad('INVALID_INVITE_TOKEN', 'This invitation link is invalid or has expired.'));
    renderAt('/accept-invite?token=old');
    expect(await screen.findByText(/invitation link not valid/i)).toBeInTheDocument();
    expect(screen.getByText(/invalid or has expired/i)).toBeInTheDocument();
  });

  it('validates the password, sets it, then lands on login with the email filled in', async () => {
    h.post.mockImplementation((url: string) =>
      url === '/auth/verify-invite'
        ? ok({ name: 'Meera Joshi', email: 'meera@x.com' })
        : ok({ email: 'meera@x.com', message: 'ready' }),
    );
    renderAt('/accept-invite?token=abc123');

    expect(await screen.findByText(/welcome, meera/i)).toBeInTheDocument();
    expect(h.post).toHaveBeenCalledWith('/auth/verify-invite', { token: 'abc123' });

    // weak password is stopped on the client
    await userEvent.type(screen.getByLabelText(/^password/i), 'weak');
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'weak');
    await userEvent.click(screen.getByRole('button', { name: /set password/i }));
    expect(await screen.findByText(/at least 8 characters/i)).toBeInTheDocument();
    expect(h.post).not.toHaveBeenCalledWith('/auth/accept-invite', expect.anything());

    // mismatch
    await userEvent.clear(screen.getByLabelText(/^password/i));
    await userEvent.clear(screen.getByLabelText(/confirm password/i));
    await userEvent.type(screen.getByLabelText(/^password/i), 'Strong#123');
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'Strong#124');
    await userEvent.click(screen.getByRole('button', { name: /set password/i }));
    expect(await screen.findByText(/do not match/i)).toBeInTheDocument();

    // valid
    await userEvent.clear(screen.getByLabelText(/confirm password/i));
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'Strong#123');
    await userEvent.click(screen.getByRole('button', { name: /set password/i }));

    await waitFor(() =>
      expect(h.post).toHaveBeenCalledWith('/auth/accept-invite', { token: 'abc123', password: 'Strong#123' }),
    );
    expect(await screen.findByTestId('login')).toBeInTheDocument();
    expect(screen.getByTestId('email')).toHaveTextContent('meera@x.com');
    expect(screen.getByTestId('msg')).toHaveTextContent(/your account is ready/i);
  });

  it('falls back to the invalid screen if the link is used between verify and submit', async () => {
    h.post.mockImplementation((url: string) =>
      url === '/auth/verify-invite'
        ? ok({ name: 'Meera Joshi', email: 'meera@x.com' })
        : bad('INVALID_INVITE_TOKEN', 'This invitation link is invalid or has expired.'),
    );
    renderAt('/accept-invite?token=abc123');
    await userEvent.type(await screen.findByLabelText(/^password/i), 'Strong#123');
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'Strong#123');
    await userEvent.click(screen.getByRole('button', { name: /set password/i }));
    expect(await screen.findByText(/invitation link not valid/i)).toBeInTheDocument();
  });
});

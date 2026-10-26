import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';

vi.mock('@/lib/api', () => ({ default: { post: vi.fn(), get: vi.fn() } }));

import api from '@/lib/api';
import PartnerSafetyPage from '@/pages/partner/Safety';
import { sendSos } from '@/pages/partner/Safety/safety.api';
import * as jobsApi from '@/pages/partner/JobDetails/jobDetails.api';

const post = api.post as unknown as ReturnType<typeof vi.fn>;
const REAL_ID = '65f1a2b3c4d5e6f7a8b9c0d1';
const alertDto = { id: 'a1', partnerId: 'p1', bookingId: null, location: null, status: 'active', triggeredAt: '2026-10-23T08:00:00.000Z' };

const renderPage = () =>
  render(
    <HelmetProvider>
      <MemoryRouter>
        <PartnerSafetyPage />
      </MemoryRouter>
    </HelmetProvider>,
  );

beforeEach(() => {
  post.mockReset();
  // No geolocation in jsdom: getQuickFix resolves null without prompting.
  vi.spyOn(jobsApi, 'fetchAssignedServices').mockResolvedValue([]);
});
afterEach(() => vi.restoreAllMocks());

describe('Safety page', () => {
  it('shows emergency numbers and HomeCareX contact as real tel/mailto links', async () => {
    renderPage();
    expect(screen.getByRole('link', { name: /call emergency services on 112/i })).toHaveAttribute('href', 'tel:112');
    expect(screen.getByRole('link', { name: /call police on 100/i })).toHaveAttribute('href', 'tel:100');
    expect(screen.getByRole('link', { name: /call ambulance on 108/i })).toHaveAttribute('href', 'tel:108');
    expect(screen.getByRole('link', { name: /support@homecarex\.com/i })).toHaveAttribute('href', 'mailto:support@homecarex.com');
    await waitFor(() => expect(screen.getByText(/available once you are on the way/i)).toBeInTheDocument());
  });

  it('offers live location only when a real job is active', async () => {
    vi.spyOn(jobsApi, 'fetchAssignedServices').mockResolvedValue([
      { id: REAL_ID, status: 'en_route' } as never,
    ]);
    renderPage();
    const link = await screen.findByRole('link', { name: /open live location/i });
    expect(link).toHaveAttribute('href', `/partner/jobs/${REAL_ID}/location`);
  });

  it('ignores demo job ids for live location', async () => {
    vi.spyOn(jobsApi, 'fetchAssignedServices').mockResolvedValue([
      { id: 'job-booking-123-partner-1', status: 'en_route' } as never,
    ]);
    renderPage();
    await screen.findByText(/available once you are on the way/i);
    expect(screen.queryByRole('link', { name: /open live location/i })).toBeNull();
  });

  it('sends a real SOS after confirmation, with no job open, and says it was sent', async () => {
    post.mockResolvedValue({ data: { data: { alert: alertDto, duplicate: false } } });
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: /emergency sos/i }));
    await user.click(screen.getByRole('button', { name: /confirm sos/i }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post).toHaveBeenCalledWith('/partner/safety/sos', {});
    expect(await screen.findByText(/safety team has been alerted/i)).toBeInTheDocument();
  });

  it('never claims "sent" when the server call fails', async () => {
    post.mockRejectedValue({ response: { data: { message: 'Too many requests' } } });
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: /emergency sos/i }));
    await user.click(screen.getByRole('button', { name: /confirm sos/i }));
    expect((await screen.findAllByRole('alert')).some((el) => /too many requests/i.test(el.textContent ?? ''))).toBe(true);
    expect(screen.queryByText(/safety team has been alerted/i)).toBeNull();
  });
});

describe('sendSos', () => {
  beforeEach(() => post.mockResolvedValue({ data: { data: { alert: alertDto, duplicate: true } } }));

  it('sends bookingId and location, and returns the duplicate flag', async () => {
    const res = await sendSos({ bookingId: REAL_ID, location: { lat: 16.5, lng: 80.6, accuracy: 9 } });
    expect(post).toHaveBeenCalledWith('/partner/safety/sos', { bookingId: REAL_ID, location: { lat: 16.5, lng: 80.6, accuracy: 9 } });
    expect(res.duplicate).toBe(true);
  });

  it('drops a demo booking id instead of failing validation', async () => {
    await sendSos({ bookingId: 'job-booking-123-partner-1', location: null });
    expect(post).toHaveBeenCalledWith('/partner/safety/sos', {});
  });
});
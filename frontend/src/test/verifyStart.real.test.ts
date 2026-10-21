import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiJob } from '@/pages/partner/JobDetails/jobDetails.types';

const post = vi.fn();
const get = vi.fn();
const patch = vi.fn();

const apiJob = (over: Partial<ApiJob> = {}): ApiJob => ({
  id: '65f1a2b3c4d5e6f7a8b9c0d1',
  status: 'arrived',
  customer: { name: 'Rahul K.', phone: '******3210' },
  service: { name: 'AC Service', quantity: 1, durationMinutes: 90 },
  location: { line1: '12 MG Road', area: 'Madhapur', city: 'Hyderabad', pincode: '500081', coordinates: null },
  schedule: { scheduledAt: '2026-10-13T04:30:00.000Z', date: null, slot: '10:00-12:00', startedAt: null },
  price: { currency: 'INR', total: 599, partnerEarning: 450 },
  addOns: [],
  instructions: null,
  checklist: [],
  payment: { status: 'PAID', paidAt: null },
  actions: [],
  otpRequired: true,
  startVerification: {
    maxAttempts: 5,
    attemptsRemaining: 3,
    expiresAt: '2026-10-13T05:30:00.000Z',
    expired: false,
    locked: false,
  },
  statusHistory: [{ from: 'en_route', to: 'arrived', at: '2026-10-13T04:30:00.000Z', actorRole: 'partner', actorId: 'u1', reason: null }],
  ...over,
});

const png = (): File => new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1])], 'start.png', { type: 'image/png' });

/** Loads the API module with VITE_USE_MOCKS=false so it talks to the (mocked) HTTP client. */
async function loadRealApi() {
  vi.resetModules();
  vi.stubEnv('VITE_USE_MOCKS', 'false');
  vi.doMock('@/lib/api', () => ({ default: { post, get, patch } }));
  return import('@/pages/partner/JobDetails/jobDetails.api');
}

describe('real API mode (VITE_USE_MOCKS=false)', () => {
  beforeEach(() => {
    post.mockReset();
    get.mockReset();
    patch.mockReset();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.doUnmock('@/lib/api');
  });

  it('is switched on by the env flag', async () => {
    const api = await loadRealApi();
    expect(api.IS_MOCK_JOBS).toBe(false);
  });

  it('verifyStart POSTs multipart (otp + photo) to /partner/jobs/:id/verify-start', async () => {
    post.mockResolvedValue({ data: { data: apiJob({ status: 'in_progress', otpRequired: false, startVerification: null }) } });
    const api = await loadRealApi();
    const file = png();

    const job = await api.verifyStart('65f1a2b3c4d5e6f7a8b9c0d1', '4821', file);

    expect(post).toHaveBeenCalledTimes(1);
    const [url, body, config] = post.mock.calls[0] as [string, FormData, { headers: Record<string, string> }];
    expect(url).toBe('/partner/jobs/65f1a2b3c4d5e6f7a8b9c0d1/verify-start');
    expect(body).toBeInstanceOf(FormData);
    expect(body.get('otp')).toBe('4821');
    expect(body.get('photo')).toBeInstanceOf(File);
    expect((body.get('photo') as File).name).toBe('start.png');
    expect(config.headers['Content-Type']).toBe('multipart/form-data');
    expect(job.status).toBe('in_progress');
    expect(job.startVerification).toBeNull();
  });

  it('the real server error reaches the caller unchanged (code + attempts left)', async () => {
    const serverError = {
      response: {
        status: 422,
        data: { success: false, code: 'INVALID_OTP', message: 'Incorrect code. 4 attempts left', details: [{ field: 'attemptsRemaining', message: '4' }] },
      },
    };
    post.mockRejectedValue(serverError);
    const api = await loadRealApi();

    const err = await api.verifyStart('65f1a2b3c4d5e6f7a8b9c0d1', '0000', png()).catch((e: unknown) => e);
    expect(api.getHttpStatus(err)).toBe(422);
    expect(api.getErrorCode(err)).toBe('INVALID_OTP');
    expect(api.getAttemptsRemaining(err)).toBe(4);
  });

  it('fetchJob GETs /partner/jobs/:id and keeps the start-verification state', async () => {
    get.mockResolvedValue({ data: { data: apiJob() } });
    const api = await loadRealApi();

    const job = await api.fetchJob('65f1a2b3c4d5e6f7a8b9c0d1');

    expect(get).toHaveBeenCalledWith('/partner/jobs/65f1a2b3c4d5e6f7a8b9c0d1');
    expect(job.status).toBe('arrived');
    expect(job.startVerification).toMatchObject({ attemptsRemaining: 3, locked: false, expired: false });
  });

  it('updateBookingStatus PATCHes /bookings/:id/status', async () => {
    patch.mockResolvedValue({ data: { data: apiJob() } });
    const api = await loadRealApi();

    await api.updateBookingStatus('65f1a2b3c4d5e6f7a8b9c0d1', 'arrived');

    expect(patch).toHaveBeenCalledWith('/bookings/65f1a2b3c4d5e6f7a8b9c0d1/status', { status: 'arrived' });
  });
});

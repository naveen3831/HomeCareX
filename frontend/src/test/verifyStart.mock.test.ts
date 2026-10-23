import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { JobDetails } from '@/pages/partner/JobDetails/jobDetails.types';

type ApiModule = typeof import('@/pages/partner/JobDetails/jobDetails.api');
let api: ApiModule;

async function loadMockApi(): Promise<ApiModule> {
  vi.resetModules();
  vi.stubEnv('VITE_USE_MOCKS', 'true');
  return import('@/pages/partner/JobDetails/jobDetails.api');
}

const ID = 'BK-20418';
const PNG_HEAD = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const photo = (size = 64, head = PNG_HEAD, type = 'image/png', name = 'start.png'): File => {
  const bytes = new Uint8Array(size);
  bytes.set(head.slice(0, size));
  return new File([bytes], name, { type });
};

/** Runs verifyStart and returns the thrown error (or null) so a test can inspect status + code. */
const attempt = async (otp: string, file: File = photo()): Promise<{ err: unknown; job: JobDetails | null }> => {
  try {
    return { err: null, job: await api.verifyStart(ID, otp, file) };
  } catch (err) {
    return { err, job: null };
  }
};

const arrive = async () => {
  window.localStorage.clear();
  api.resetMockPartnerJob(ID);
  await api.updateBookingStatus(ID, 'en_route');
  return api.updateBookingStatus(ID, 'arrived');
};

describe('verifyStart (demo store): same rules as POST /partner/jobs/:id/verify-start', () => {
  beforeEach(async () => {
    api = await loadMockApi();
    await arrive();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('a job that has just arrived waits for the code: 5 attempts, valid for an hour', async () => {
    const job = await api.fetchJob(ID);
    expect(job.status).toBe('arrived');
    expect(job.startVerification).toMatchObject({ maxAttempts: 5, attemptsRemaining: 5, expired: false, locked: false });
    const msLeft = Date.parse(job.startVerification?.expiresAt ?? '') - Date.now();
    expect(msLeft).toBeGreaterThan(59 * 60_000);
    expect(msLeft).toBeLessThanOrEqual(60 * 60_000);
  });

  it('correct code + photo starts the job', async () => {
    const { err, job } = await attempt(api.DEMO_START_OTP);
    expect(err).toBeNull();
    expect(job?.status).toBe('in_progress');
    expect(job?.startVerification).toBeNull();
    expect(job?.history[job.history.length - 1]?.status).toBe('in_progress');
    expect((await api.fetchJob(ID)).status).toBe('in_progress'); // persisted
  });

  it('invalid OTP: 422 INVALID_OTP, tells how many attempts are left, job stays at arrived', async () => {
    const { err } = await attempt('0000');
    expect(api.getHttpStatus(err)).toBe(422);
    expect(api.getErrorCode(err)).toBe('INVALID_OTP');
    expect(api.getAttemptsRemaining(err)).toBe(4);
    expect((await api.fetchJob(ID)).status).toBe('arrived');
    expect((await api.fetchJob(ID)).startVerification?.attemptsRemaining).toBe(4);
  });

  it('counts down 4, 3, 2, 1 across consecutive wrong codes', async () => {
    const left: Array<number | null> = [];
    for (let i = 0; i < 4; i += 1) left.push(api.getAttemptsRemaining((await attempt('0000')).err));
    expect(left).toEqual([4, 3, 2, 1]);
  });

  it('attempt limit: the 5th wrong code locks (423), then even the CORRECT code is refused', async () => {
    for (let i = 0; i < api.START_OTP_MAX_ATTEMPTS - 1; i += 1) {
      expect(api.getHttpStatus((await attempt('0000')).err)).toBe(422);
    }
    const fifth = await attempt('0000');
    expect(api.getHttpStatus(fifth.err)).toBe(423);
    expect(api.getErrorCode(fifth.err)).toBe('OTP_LOCKED');

    const correctButLocked = await attempt(api.DEMO_START_OTP);
    expect(api.getHttpStatus(correctButLocked.err)).toBe(423);
    const after = await api.fetchJob(ID);
    expect(after.status).toBe('arrived');
    expect(after.startVerification).toMatchObject({ locked: true, attemptsRemaining: 0 });
  });

  it('the lock survives a reload (state is stored, not kept in the page)', async () => {
    for (let i = 0; i < api.START_OTP_MAX_ATTEMPTS; i += 1) await attempt('0000');
    expect((await api.fetchJob(ID)).startVerification?.locked).toBe(true);
  });

  it('expired: 410 OTP_EXPIRED even with the correct code, and no attempt is used', async () => {
    const stored = JSON.parse(window.localStorage.getItem(api.MOCK_PARTNER_ROUTE_STORAGE_KEY) ?? '{}') as JobDetails;
    stored.history = stored.history.map((h) =>
      h.status === 'arrived' ? { ...h, at: new Date(Date.now() - 61 * 60_000).toISOString() } : h,
    );
    window.localStorage.setItem(api.MOCK_PARTNER_ROUTE_STORAGE_KEY, JSON.stringify(stored));

    expect((await api.fetchJob(ID)).startVerification?.expired).toBe(true);
    const { err } = await attempt(api.DEMO_START_OTP);
    expect(api.getHttpStatus(err)).toBe(410);
    expect(api.getErrorCode(err)).toBe('OTP_EXPIRED');
    expect((await api.fetchJob(ID)).status).toBe('arrived');
    expect((await api.fetchJob(ID)).startVerification?.attemptsRemaining).toBe(5);
  });

  describe('photo rules', () => {
    it('422 INVALID_FILE for bytes that are not a JPG/PNG (type is checked from the file, not its name)', async () => {
      const fake = new File(['<script>alert(1)</script>'], 'start.png', { type: 'image/png' });
      const { err } = await attempt(api.DEMO_START_OTP, fake);
      expect(api.getHttpStatus(err)).toBe(422);
      expect(api.getErrorCode(err)).toBe('INVALID_FILE');
    });

    it('a bad photo never uses up an OTP attempt', async () => {
      const fake = new File(['nope'], 'start.png', { type: 'image/png' });
      await attempt('0000', fake);
      await attempt('0000', fake);
      expect((await api.fetchJob(ID)).startVerification?.attemptsRemaining).toBe(5);
    });

    it('accepts exactly 5 MB and rejects one byte more with 413 PAYLOAD_TOO_LARGE', async () => {
      const MB5 = 5 * 1024 * 1024;
      const over = await attempt(api.DEMO_START_OTP, photo(MB5 + 1));
      expect(api.getHttpStatus(over.err)).toBe(413);
      expect(api.getErrorCode(over.err)).toBe('PAYLOAD_TOO_LARGE');
      expect((await api.fetchJob(ID)).status).toBe('arrived');

      const exact = await attempt(api.DEMO_START_OTP, photo(MB5));
      expect(exact.err).toBeNull();
      expect(exact.job?.status).toBe('in_progress');
    });

    it('accepts a JPG', async () => {
      const jpg = photo(64, [0xff, 0xd8, 0xff, 0xe0], 'image/jpeg', 'start.jpg');
      expect((await attempt(api.DEMO_START_OTP, jpg)).job?.status).toBe('in_progress');
    });
  });

  describe('request rules', () => {
    it('400 when the code is not exactly 4 digits, and no attempt is used', async () => {
      for (const otp of ['123', '12345', 'abcd', '12 4', '']) {
        expect(api.getHttpStatus((await attempt(otp)).err)).toBe(400);
      }
      expect((await api.fetchJob(ID)).startVerification?.attemptsRemaining).toBe(5);
    });

    it('422 when the partner has not arrived yet', async () => {
      api.resetMockPartnerJob(ID); // back to confirmed
      const { err } = await attempt(api.DEMO_START_OTP);
      expect(api.getHttpStatus(err)).toBe(422);
      expect(api.getErrorCode(err)).toBe('INVALID_STATE_TRANSITION');
    });

    it('409 when the job is already started: a second submit cannot start it twice', async () => {
      expect((await attempt(api.DEMO_START_OTP)).err).toBeNull();
      const again = await attempt(api.DEMO_START_OTP);
      expect(api.getHttpStatus(again.err)).toBe(409);
      const started = (await api.fetchJob(ID)).history.filter((h) => h.status === 'in_progress');
      expect(started).toHaveLength(1);
    });
  });
});

describe('error helpers', async () => {
  const { isNetworkError, getAttemptsRemaining } = await loadMockApi();

  it('isNetworkError is true only when there was no response at all', () => {
    expect(isNetworkError(new Error('Network Error'))).toBe(true);
    expect(isNetworkError({ response: { status: 500 } })).toBe(false);
    expect(isNetworkError(null)).toBe(false);
  });

  it('getAttemptsRemaining ignores malformed details', () => {
    expect(getAttemptsRemaining({ response: { data: { details: [{ field: 'attemptsRemaining', message: 'x' }] } } })).toBeNull();
    expect(getAttemptsRemaining({ response: { data: { details: [{ field: 'other', message: '3' }] } } })).toBeNull();
    expect(getAttemptsRemaining({ response: { data: {} } })).toBeNull();
    expect(getAttemptsRemaining({ response: { data: { details: [{ field: 'attemptsRemaining', message: '0' }] } } })).toBe(0);
  });
});

import api from '@/lib/api';
import { MAX_PHOTO_BYTES, validatePhoto } from '@/lib/photoValidation';
import { mapJob } from './jobDetails.mapper';
import type { ApiJob, CompletionInput, ExtraChargeItem, JobDetails, StartVerification } from './jobDetails.types';
import type { JobAction, JobStatus } from './jobStatus';

export const MOCK_PARTNER_ROUTE_STORAGE_KEY = 'homecarex_partner_route_mock_job_v1';
export const MOCK_PARTNER_ASSIGNED_LIST_STORAGE_KEY = 'homecarex_partner_assigned_services_v2';
/** Demo start code. The real code is 4 digits too (see POST /partner/jobs/:id/verify-start). */
export const DEMO_START_OTP = '1234';

/**
 * true  (default): the job screens run on the local demo store below.
 * false (VITE_USE_MOCKS=false): every job call (assigned list, details, status, start OTP, checklist,
 * complete, decline) goes to the real API, so the partner only ever sees what admin assigned.
 * SOS and add-item have no endpoint yet; in real mode they fail loudly instead of faking success.
 */
export const IS_MOCK_JOBS = String(import.meta.env.VITE_USE_MOCKS ?? 'true') !== 'false';

/** Same rules as the backend (backend/src/modules/partner-jobs/partner-jobs.service.ts). */
export const START_OTP_MAX_ATTEMPTS = 5;
const START_OTP_TTL_MS = 60 * 60_000;

function getActionsForStatus(status: JobStatus): JobAction[] {
  if (status === 'confirmed' || status === 'assigned') {
    return [{ status: 'en_route', label: 'On the way' }];
  }
  if (status === 'en_route') {
    return [{ status: 'arrived', label: 'Arrived at location' }];
  }
  return [];
}

/**
 * Catalog of assigned services for the partner.
 * Empty: mock data for job services has been removed so only real assigned jobs are shown.
 */
export function createInitialAssignedServicesCatalog(): JobDetails[] {
  return [];
}

/**
 * Creates an initial booking object for tests or single-job fallbacks.
 */
export function createInitialPartnerRouteMockJob(requestedId?: string): JobDetails {
  const cleanId = requestedId && requestedId.trim() ? requestedId.trim() : 'BK-20418';
  return {
    id: cleanId,
    bookingCode: '#' + cleanId,
    status: 'confirmed',
    customer: {
      name: 'Rohan K.',
      phoneMasked: '+91 ••••• ••214',
      subtitle: 'Calls are routed through the app',
    },
    service: {
      name: 'Deep home cleaning',
      description: '2 BHK · Kitchen, bathrooms, floors',
      quantity: 1,
      durationMinutes: 180,
    },
    location: {
      address: 'Flat •••, Green Meadows Apartments',
      city: 'Hyderabad',
      pincode: '500039',
      hint: 'Full address unlocks at start · 6.4 km away',
    },
    schedule: {
      scheduledAt: '2026-10-14T04:30:00.000Z',
      dateLabel: 'Tue, 14 Oct 2026',
      slot: '10:00 – 13:00',
      startedAt: new Date(Date.now() - 3600 * 1000).toISOString(),
      startedTimeLabel: '10:02 AM',
      completedAt: null,
    },
    price: {
      basePrice: 1499,
      total: 1997,
      partnerEarning: 1498,
    },
    addOns: [
      { id: 'addon-1', name: 'Fridge cleaning', quantity: 1, amount: 299 },
      { id: 'addon-2', name: 'Balcony wash', quantity: 1, amount: 199 },
    ],
    instructions: 'Pet cat at home. Please bring your own mop. Ring the bell once only.',
    checklist: [
      { id: 'chk-1', label: 'Dust and wipe all surfaces', done: true },
      { id: 'chk-2', label: 'Scrub kitchen counters and sink', done: true },
      { id: 'chk-3', label: 'Fridge cleaning (add-on)', done: true },
      { id: 'chk-4', label: 'Clean both bathrooms', done: false },
      { id: 'chk-5', label: 'Balcony wash (add-on)', done: false },
      { id: 'chk-6', label: 'Sweep and mop floors', done: false },
    ],
    payment: {
      status: 'PENDING',
      amount: 1997,
      method: 'Pay after service (UPI / cash)',
    },
    actions: [{ status: 'en_route', label: 'On the way' }],
    otpRequired: false,
    otpVerified: false,
    sosTriggeredAt: null,
    history: [
      {
        status: 'assigned',
        at: '2026-10-14T04:00:00.000Z',
        actor: 'System',
      },
    ],
  };
}

function loadAssignedCatalogFromStorage(): JobDetails[] {
  try {
    const raw = window.localStorage.getItem(MOCK_PARTNER_ASSIGNED_LIST_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function saveAssignedCatalogToStorage(list: JobDetails[]): JobDetails[] {
  try {
    window.localStorage.setItem(MOCK_PARTNER_ASSIGNED_LIST_STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* ignore storage quota errors */
  }
  return list;
}

function syncJobIntoCatalog(job: JobDetails): void {
  const catalog = loadAssignedCatalogFromStorage();
  const idx = catalog.findIndex((item) => item.id === job.id);
  if (idx >= 0) {
    const next = [...catalog];
    next[idx] = job;
    saveAssignedCatalogToStorage(next);
  }
}

function loadRawMockJob(requestedId?: string): JobDetails {
  try {
    const cleanId = requestedId?.trim();
    if (cleanId) {
      const catalog = loadAssignedCatalogFromStorage();
      const fromCatalog = catalog.find(
        (item) => item.id.toLowerCase() === cleanId.toLowerCase(),
      );
      const rawCurrent = window.localStorage.getItem(MOCK_PARTNER_ROUTE_STORAGE_KEY);
      if (rawCurrent) {
        const parsedCurrent = JSON.parse(rawCurrent) as Partial<JobDetails>;
        if (
          parsedCurrent &&
          typeof parsedCurrent === 'object' &&
          parsedCurrent.id === cleanId &&
          Array.isArray(parsedCurrent.checklist) &&
          parsedCurrent.service &&
          parsedCurrent.customer
        ) {
          return parsedCurrent as JobDetails;
        }
      }
      if (fromCatalog) {
        const normalized: JobDetails =
          fromCatalog.status === 'assigned'
            ? { ...fromCatalog, status: 'confirmed' }
            : fromCatalog;
        window.localStorage.setItem(MOCK_PARTNER_ROUTE_STORAGE_KEY, JSON.stringify(normalized));
        return normalized;
      }
      // An id was asked for but it is not the stored job and not in the catalog: never return the
      // stored job of a DIFFERENT booking (that is how one job's checklist leaked into another).
      const unknown = createInitialPartnerRouteMockJob(cleanId);
      window.localStorage.setItem(MOCK_PARTNER_ROUTE_STORAGE_KEY, JSON.stringify(unknown));
      return unknown;
    }

    const raw = window.localStorage.getItem(MOCK_PARTNER_ROUTE_STORAGE_KEY);
    if (!raw) {
      const initial = createInitialPartnerRouteMockJob(requestedId);
      window.localStorage.setItem(MOCK_PARTNER_ROUTE_STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    const parsed = JSON.parse(raw) as Partial<JobDetails>;
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      typeof parsed.id !== 'string' ||
      !Array.isArray(parsed.checklist) ||
      !parsed.service ||
      !parsed.customer
    ) {
      const recovered = createInitialPartnerRouteMockJob(requestedId);
      window.localStorage.setItem(MOCK_PARTNER_ROUTE_STORAGE_KEY, JSON.stringify(recovered));
      return recovered;
    }
    return parsed as JobDetails;
  } catch {
    return createInitialPartnerRouteMockJob(requestedId);
  }
}

/** The OTP clock starts at the last "arrived" entry, exactly like the backend. */
function mockOtpExpiry(job: JobDetails): Date | null {
  for (let i = job.history.length - 1; i >= 0; i -= 1) {
    if (job.history[i].status === 'arrived') {
      const at = new Date(job.history[i].at).getTime();
      return Number.isNaN(at) ? null : new Date(at + START_OTP_TTL_MS);
    }
  }
  return null;
}

/** Adds the live start-OTP state (attempts left, expiry, lock) to a job that is waiting at "arrived". */
function withStartVerification(job: JobDetails, now: Date = new Date()): JobDetails {
  if (job.status !== 'arrived') return { ...job, startVerification: null };
  const left = Math.min(
    START_OTP_MAX_ATTEMPTS,
    Math.max(0, job.startVerification?.attemptsRemaining ?? START_OTP_MAX_ATTEMPTS),
  );
  const expiresAt = mockOtpExpiry(job);
  const verification: StartVerification = {
    maxAttempts: START_OTP_MAX_ATTEMPTS,
    attemptsRemaining: left,
    expiresAt: expiresAt ? expiresAt.toISOString() : null,
    expired: expiresAt ? now.getTime() >= expiresAt.getTime() : false,
    locked: left <= 0,
  };
  return { ...job, otpRequired: true, startVerification: verification };
}

function loadMockJobFromStorage(requestedId?: string): JobDetails {
  return withStartVerification(loadRawMockJob(requestedId));
}

function saveMockJobToStorage(job: JobDetails): JobDetails {
  try {
    window.localStorage.setItem(MOCK_PARTNER_ROUTE_STORAGE_KEY, JSON.stringify(job));
    syncJobIntoCatalog(job);
  } catch {
    /* ignore storage quota errors */
  }
  return job;
}

/** The partner's assigned services. Real mode: only bookings admin (or an accepted offer) assigned to this partner. */
export async function fetchAssignedServices(): Promise<JobDetails[]> {
  if (!IS_MOCK_JOBS) {
    const res = await api.get<{ data: ApiJob[] }>('/partner/jobs/assigned');
    return res.data.data.map(mapJob);
  }
  return loadAssignedCatalogFromStorage();
}

export async function acceptAssignedService(bookingId: string): Promise<JobDetails> {
  // Real mode: admin already assigned this job to the partner, so "accept" only opens it. The server
  // moves it forward when the partner taps "On the way".
  if (!IS_MOCK_JOBS) return fetchJob(bookingId);
  const catalog = loadAssignedCatalogFromStorage();
  const target =
    catalog.find((item) => item.id === bookingId) ??
    createInitialPartnerRouteMockJob(bookingId);
  const nowIso = new Date().toISOString();
  const isPendingOrDeclined =
    target.status === 'assigned' || target.status.startsWith('cancelled');
  const nextStatus: JobStatus = isPendingOrDeclined ? 'confirmed' : target.status;

  const acceptedJob: JobDetails = {
    ...target,
    status: nextStatus,
    actions: getActionsForStatus(nextStatus),
    history: [
      ...target.history,
      ...(isPendingOrDeclined
        ? [{ status: 'confirmed' as JobStatus, at: nowIso, actor: 'Partner' }]
        : []),
    ],
  };

  return saveMockJobToStorage(acceptedJob);
}

export async function declineAssignedService(bookingId: string): Promise<JobDetails[]> {
  if (!IS_MOCK_JOBS) {
    await api.post(`/partner/jobs/${bookingId}/decline`, {});
    return fetchAssignedServices();
  }
  const catalog = loadAssignedCatalogFromStorage();
  const next = catalog.map((item) =>
    item.id === bookingId
      ? {
          ...item,
          status: 'cancelled_by_partner' as JobStatus,
          history: [
            ...item.history,
            {
              status: 'cancelled_by_partner' as JobStatus,
              at: new Date().toISOString(),
              actor: 'Partner',
            },
          ],
        }
      : item,
  );
  return saveAssignedCatalogToStorage(next);
}

export function resetAllAssignedServices(): JobDetails[] {
  const freshCatalog = createInitialAssignedServicesCatalog();
  saveAssignedCatalogToStorage(freshCatalog);
  const defaultJob = createInitialPartnerRouteMockJob('BK-20418');
  try {
    window.localStorage.setItem(MOCK_PARTNER_ROUTE_STORAGE_KEY, JSON.stringify(defaultJob));
  } catch {
    /* ignore */
  }
  return freshCatalog;
}

export function resetMockPartnerJob(requestedId?: string): JobDetails {
  const freshCatalog = createInitialAssignedServicesCatalog();
  const cleanId = requestedId && requestedId.trim() ? requestedId.trim() : 'BK-20418';
  const fresh = createInitialPartnerRouteMockJob(cleanId);
  const updatedCatalog = freshCatalog.map((item) =>
    item.id === fresh.id ? fresh : item,
  );
  saveAssignedCatalogToStorage(updatedCatalog);
  return saveMockJobToStorage(fresh);
}

export async function fetchJob(id: string): Promise<JobDetails> {
  if (!IS_MOCK_JOBS) {
    const res = await api.get<{ data: ApiJob }>(`/partner/jobs/${id}`);
    return mapJob(res.data.data);
  }
  return loadMockJobFromStorage(id || 'BK-20418');
}

/** Updates the booking status locally in localStorage and returns the updated job. */
export async function updateBookingStatus(
  bookingId: string,
  status: JobStatus,
): Promise<JobDetails> {
  if (!IS_MOCK_JOBS) {
    const res = await api.patch<{ data: ApiJob }>(`/bookings/${bookingId}/status`, { status });
    return mapJob(res.data.data);
  }
  const current = loadMockJobFromStorage(bookingId);
  const nowIso = new Date().toISOString();
  const updated: JobDetails = {
    ...current,
    status,
    actions: getActionsForStatus(status),
    otpRequired: status === 'arrived' && !current.otpVerified,
    history: [
      ...current.history,
      {
        status,
        at: nowIso,
        actor: 'Partner',
      },
    ],
  };
  return saveMockJobToStorage(updated);
}

export async function persistChecklistItem(
  bookingId: string,
  itemId: string,
  done: boolean,
): Promise<{ id: string; label: string; done: boolean }[]> {
  if (!IS_MOCK_JOBS) {
    const res = await api.patch<{ data: { checklist: { id: string; label: string; done: boolean }[] } }>(
      `/partner/jobs/${bookingId}/checklist/${encodeURIComponent(itemId)}`,
      { done },
    );
    return res.data.data.checklist;
  }
  const current = loadMockJobFromStorage(bookingId);
  const nextChecklist = current.checklist.map((item) =>
    item.id === itemId ? { ...item, done } : item,
  );
  saveMockJobToStorage({
    ...current,
    checklist: nextChecklist,
  });
  return nextChecklist;
}

export async function completeJob(bookingId: string, input?: CompletionInput): Promise<JobDetails> {
  if (!IS_MOCK_JOBS) {
    let payload: unknown = undefined;
    let headers: Record<string, string> = {};
    if (input?.photo) {
      const form = new FormData();
      if (input.otp) form.append('otp', input.otp);
      form.append('photo', input.photo, input.photo.name);
      if (input.notes) form.append('notes', input.notes);
      payload = form;
      headers['Content-Type'] = 'multipart/form-data';
    } else if (input?.otp || input?.notes) {
      payload = {
        ...(input.otp ? { otp: input.otp } : {}),
        ...(input.notes ? { notes: input.notes } : {}),
      };
    }
    const res = await api.post<{ data: ApiJob }>(`/partner/jobs/${bookingId}/complete`, payload, { headers });
    return mapJob(res.data.data);
  }
  const current = loadMockJobFromStorage(bookingId);
  const nowIso = new Date().toISOString();
  const updated: JobDetails = {
    ...current,
    status: 'completed',
    actions: [],
    otpRequired: false,
    schedule: {
      ...current.schedule,
      completedAt: nowIso,
    },
    history: [
      ...current.history,
      {
        status: 'completed',
        at: nowIso,
        actor: 'Partner',
      },
    ],
  };
  return saveMockJobToStorage(updated);
}

export const MOCK_EXTRA_CHARGES_STORAGE_KEY = 'homecarex_partner_extra_charges_v1';

export function getMockExtraCharges(bookingId: string): ExtraChargeItem[] {
  try {
    const raw = localStorage.getItem(`${MOCK_EXTRA_CHARGES_STORAGE_KEY}_${bookingId}`);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

export function saveMockExtraCharges(bookingId: string, items: ExtraChargeItem[]): void {
  try {
    localStorage.setItem(`${MOCK_EXTRA_CHARGES_STORAGE_KEY}_${bookingId}`, JSON.stringify(items));
  } catch {}
}

export async function fetchExtraCharges(bookingId: string): Promise<ExtraChargeItem[]> {
  if (!IS_MOCK_JOBS) {
    const res = await api.get<{ data: ExtraChargeItem[] }>(`/partner/jobs/${bookingId}/extra-charges`);
    return res.data.data;
  }
  return getMockExtraCharges(bookingId);
}

export async function createExtraCharge(
  bookingId: string,
  payload: { description: string; quantity: number; amount: number; reason?: string },
): Promise<ExtraChargeItem> {
  if (!IS_MOCK_JOBS) {
    const res = await api.post<{ data: ExtraChargeItem }>(`/partner/jobs/${bookingId}/extra-charges`, payload);
    return res.data.data;
  }
  const current = getMockExtraCharges(bookingId);
  const newCharge: ExtraChargeItem = {
    id: `ec-${Date.now()}`,
    title: payload.description,
    description: payload.description,
    quantity: payload.quantity,
    amount: payload.amount,
    reason: payload.reason,
    status: 'pending',
    requestedAt: new Date().toISOString(),
  };
  const next = [...current, newCharge];
  saveMockExtraCharges(bookingId, next);

  try {
    const job = loadMockJobFromStorage(bookingId);
    saveMockJobToStorage({
      ...job,
      extraCharges: next,
    });
  } catch {}

  return newCharge;
}

export async function triggerSos(
  bookingId: string,
  _coordinates?: { lat: number; lng: number } | null,
): Promise<{ success: boolean; message: string }> {
  if (!IS_MOCK_JOBS) {
    // No SOS endpoint yet. Never report "sent" for a safety alert that went nowhere.
    throw new Error('SOS is not connected to the server yet. Call emergency services (112) now.');
  }
  const current = loadMockJobFromStorage(bookingId);
  saveMockJobToStorage({
    ...current,
    sosTriggeredAt: new Date().toISOString(),
  });
  return {
    success: true,
    message: 'SOS alert sent (Demo Mode)',
  };
}

export async function addJobItem(
  bookingId: string,
  item: { title: string; amount: number; reason?: string },
): Promise<void> {
  if (!IS_MOCK_JOBS) {
    throw new Error('Adding items to a live job is not available yet.');
  }
  const current = loadMockJobFromStorage(bookingId);
  const customId = `custom-${Date.now()}`;
  const nextAddOns = [
    ...current.addOns,
    {
      id: customId,
      name: item.title,
      quantity: 1,
      amount: item.amount,
    },
  ];
  const nextChecklist = [
    ...current.checklist,
    {
      id: `chk-${customId}`,
      label: `${item.title} (add-on)`,
      done: false,
    },
  ];
  saveMockJobToStorage({
    ...current,
    addOns: nextAddOns,
    checklist: nextChecklist,
  });
}

/** Error shaped like an axios error, so the UI handles mock and real failures with the same code. */
function mockApiError(
  status: number,
  code: string,
  message: string,
  details?: Array<{ field: string; message: string }>,
): never {
  throw { response: { status, data: { success: false, code, message, details } } };
}

/** Local stand-in for POST /partner/jobs/:id/verify-start. Same checks, same order, same errors. */
async function mockVerifyStart(jobId: string, otp: string, photo: File): Promise<JobDetails> {
  const current = loadMockJobFromStorage(jobId);
  if (current.status === 'in_progress') mockApiError(409, 'CONFLICT', 'This job has already been started');
  if (current.status !== 'arrived') {
    mockApiError(422, 'INVALID_STATE_TRANSITION', 'You can only start a job after you have arrived');
  }
  if (!/^\d{4}$/.test(otp)) mockApiError(400, 'VALIDATION_ERROR', 'otp must be exactly 4 digits');

  // A bad photo is refused BEFORE an attempt is used, like the server.
  if (photo.size > MAX_PHOTO_BYTES) mockApiError(413, 'PAYLOAD_TOO_LARGE', 'Photo must be 5 MB or smaller');
  const photoProblem = await validatePhoto(photo);
  if (photoProblem) mockApiError(422, 'INVALID_FILE', photoProblem);

  const v = current.startVerification;
  if (v?.locked) {
    mockApiError(423, 'OTP_LOCKED', 'Too many incorrect codes. This job is locked, please contact support');
  }
  if (v?.expired) mockApiError(410, 'OTP_EXPIRED', 'The start code has expired. Ask support for help');

  // One attempt is used up before the code is compared.
  const remaining = Math.max(0, (v?.attemptsRemaining ?? START_OTP_MAX_ATTEMPTS) - 1);
  if (otp !== DEMO_START_OTP) {
    saveMockJobToStorage({
      ...current,
      startVerification: { ...(v as StartVerification), attemptsRemaining: remaining },
    });
    if (remaining <= 0) {
      mockApiError(423, 'OTP_LOCKED', 'Too many incorrect codes. This job is locked, please contact support');
    }
    mockApiError(
      422,
      'INVALID_OTP',
      `Incorrect code. ${remaining} ${remaining === 1 ? 'attempt' : 'attempts'} left`,
      [{ field: 'attemptsRemaining', message: String(remaining) }],
    );
  }

  const nowIso = new Date().toISOString();
  return saveMockJobToStorage({
    ...current,
    status: 'in_progress',
    otpRequired: false,
    otpVerified: true,
    startVerification: null,
    actions: [],
    schedule: { ...current.schedule, startedAt: current.schedule.startedAt ?? nowIso },
    history: [...current.history, { status: 'in_progress', at: nowIso, actor: 'Partner' }],
  });
}

/**
 * Start verification: the customer's 4-digit code plus a start photo (jpg/png, up to 5 MB).
 * Returns the updated job (now in_progress). Failures carry `code`:
 * INVALID_OTP (details: attemptsRemaining), OTP_LOCKED, OTP_EXPIRED, INVALID_FILE, PAYLOAD_TOO_LARGE, CONFLICT.
 * The Content-Type is left to the browser so it can add the multipart boundary.
 */
export async function verifyStart(jobId: string, otp: string, photo: File): Promise<JobDetails> {
  if (IS_MOCK_JOBS) return mockVerifyStart(jobId, otp, photo);
  const form = new FormData();
  form.append('otp', otp);
  form.append('photo', photo, photo.name);
  const res = await api.post<{ data: ApiJob }>(`/partner/jobs/${jobId}/verify-start`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return mapJob(res.data.data);
}

export function getHttpStatus(err: unknown): number | null {
  if (typeof err === 'object' && err !== null && 'response' in err) {
    const response = (err as { response?: { status?: unknown } }).response;
    if (typeof response?.status === 'number') return response.status;
  }
  return null;
}

export function getErrorMessage(err: unknown, fallback: string): string {
  if (typeof err === 'object' && err !== null && 'response' in err) {
    const response = (err as { response?: { data?: { message?: unknown } } }).response;
    const message = response?.data?.message;
    if (typeof message === 'string' && message.length > 0) return message;
  }
  return fallback;
}

/** The machine-readable `code` of an API error, e.g. INVALID_OTP, OTP_LOCKED, OTP_EXPIRED. */
export function getErrorCode(err: unknown): string | null {
  if (typeof err === 'object' && err !== null && 'response' in err) {
    const code = (err as { response?: { data?: { code?: unknown } } }).response?.data?.code;
    if (typeof code === 'string') return code;
  }
  return null;
}

/** Attempts left after a wrong code; the server sends it in `details` as { field: 'attemptsRemaining' }. */
export function getAttemptsRemaining(err: unknown): number | null {
  if (typeof err === 'object' && err !== null && 'response' in err) {
    const details = (err as { response?: { data?: { details?: unknown } } }).response?.data?.details;
    if (Array.isArray(details)) {
      for (const d of details) {
        if (typeof d === 'object' && d !== null && (d as { field?: unknown }).field === 'attemptsRemaining') {
          const n = Number((d as { message?: unknown }).message);
          if (Number.isInteger(n) && n >= 0) return n;
        }
      }
    }
  }
  return null;
}

/** true when the request never got an answer (offline, DNS, server down). */
export function isNetworkError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    !('response' in err && (err as { response?: unknown }).response)
  );
}

/** Backwards-compatibility aliases for tests and components */
export async function verifyJobOtp(_jobId: string, otp: string): Promise<{ verified: boolean }> {
  return { verified: otp === DEMO_START_OTP };
}

export async function startJob(jobId: string): Promise<JobDetails> {
  return updateBookingStatus(jobId, 'in_progress');
}

/**
 * Partner job API.
 *
 * Two back ends live behind the same functions:
 *  - the real server (ids that look like Mongo ObjectIds, when a login token exists), and
 *  - a demo store kept in localStorage (demo ids such as "BK-20418", or VITE_USE_MOCKS=true).
 *
 * The demo store follows the same rules as the server (status steps, 4-digit start code,
 * 5 attempts, 1 hour validity, photo checks) so the screens behave the same in both modes.
 */
import api from '@/lib/api';
import { tokenStore } from '@/lib/tokenStore';
import { sendSos } from '@/pages/partner/Safety/safety.api';
import { mapJob, mapJobListItemToJobDetails, normalizePayment, getDefaultChecklistForService } from './jobDetails.mapper';
import type { ApiJob, JobChecklistItem, JobDetails, StartVerification } from './jobDetails.types';
import type { JobStatus } from './jobStatus';

/* ------------------------------------------------------------------ constants */

const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true';

/** The demo start code the customer "shows" the partner. */
export const DEMO_START_OTP = '1234';
export const START_OTP_MAX_ATTEMPTS = 5;
export const START_OTP_TTL_MS = 60 * 60 * 1000;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

/** Holds the one demo job that is currently being worked on (the route job). */
export const MOCK_PARTNER_ROUTE_STORAGE_KEY = 'homecarex_partner_route_job_v1';
/** Holds the demo "Assigned Services" list. */
export const MOCK_PARTNER_ASSIGNED_STORAGE_KEY = 'homecarex_partner_assigned_services_v2';

const OBJECT_ID = /^[a-f\d]{24}$/i;
const isDemoId = (id: string): boolean => !OBJECT_ID.test(id);
const useDemo = (id: string): boolean => USE_MOCKS || isDemoId(id);

/* ------------------------------------------------------------------ error helpers */

type ErrorLike = {
  message?: unknown;
  status?: unknown;
  code?: unknown;
  response?: { status?: unknown; data?: { message?: unknown; code?: unknown; details?: unknown } };
};

const asErr = (err: unknown): ErrorLike | null => (err && typeof err === 'object' ? (err as ErrorLike) : null);

/** HTTP status of a failed call, or undefined when there was none. */
export function getHttpStatus(err: unknown): number | undefined {
  const e = asErr(err);
  const status = e?.response?.status ?? e?.status;
  return typeof status === 'number' ? status : undefined;
}

/** The server's `code` (for example INVALID_OTP), or undefined. */
export function getErrorCode(err: unknown): string | undefined {
  const e = asErr(err);
  const code = e?.response?.data?.code;
  return typeof code === 'string' ? code : undefined;
}

/** Message to show the person. Uses what the server said, otherwise the fallback. */
export function getErrorMessage(err: unknown, fallback: string): string {
  const message = asErr(err)?.response?.data?.message;
  return typeof message === 'string' && message.trim() ? message : fallback;
}

/** true only when no response came back at all (offline, DNS, CORS, timeout). */
export function isNetworkError(err: unknown): boolean {
  const e = asErr(err);
  return Boolean(e) && !e?.response;
}

/** How many start-code attempts are left, read from the error details. null when unknown. */
export function getAttemptsRemaining(err: unknown): number | null {
  const details = asErr(err)?.response?.data?.details;
  if (!Array.isArray(details)) return null;
  const entry = details.find(
    (d): d is { field: string; message: string } =>
      Boolean(d) && typeof d === 'object' && (d as { field?: unknown }).field === 'attemptsRemaining',
  );
  if (!entry || typeof entry.message !== 'string' || !/^\d+$/.test(entry.message.trim())) return null;
  return Number(entry.message.trim());
}

/** Builds an error shaped like an Axios error, so the screens handle demo and real errors the same way. */
function demoError(status: number, code: string, message: string, details?: Array<{ field: string; message: string }>) {
  const err = new Error(message) as Error & { response: { status: number; data: Record<string, unknown> } };
  err.response = { status, data: { code, message, ...(details ? { details } : {}) } };
  return err;
}

/* ------------------------------------------------------------------ demo store */

type StoredJob = JobDetails & { startAttempts?: number };

const hasStorage = (): boolean => {
  try {
    return typeof window !== 'undefined' && !!window.localStorage;
  } catch {
    return false;
  }
};

function readJson<T>(key: string): T | null {
  if (!hasStorage()) return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  if (!hasStorage()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked: the demo keeps working for this page load only */
  }
}

const dayAt = (daysFromNow: number, hour: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};

const demoPayment = (total: number, code: string, paid = false) =>
  normalizePayment(
    {
      status: paid ? 'PAID' : 'PENDING',
      paidAt: paid ? new Date().toISOString() : null,
      method: paid ? 'upi' : null,
      upi: { payeeId: 'homecarex@upi', payeeName: 'HomeCareX' },
    },
    total,
    code,
  );

interface SeedInput {
  n: number;
  status: JobStatus;
  service: string;
  description: string;
  customer: string;
  phone: string;
  address: string;
  minutes: number;
  total: number;
  earning: number;
  day: number;
  hour: number;
  addOns?: Array<{ name: string; amount: number }>;
  checklist?: JobChecklistItem[];
}

function seedJob(s: SeedInput): JobDetails {
  const id = `BK-${20417 + s.n}`;
  const code = `#${id}`;
  const done = s.status === 'completed';
  return {
    id,
    bookingCode: code,
    status: s.status,
    customer: { name: s.customer, phoneMasked: s.phone },
    service: { name: s.service, description: s.description, quantity: 1, durationMinutes: s.minutes },
    location: { address: s.address, city: 'Hyderabad', pincode: '500081', coordinates: null },
    schedule: {
      scheduledAt: dayAt(s.day, s.hour),
      slot: `${s.hour}:00 – ${s.hour + Math.ceil(s.minutes / 60)}:00`,
      startedAt: null,
      completedAt: done ? dayAt(s.day, s.hour + 2) : null,
    },
    price: { basePrice: s.total - 49, total: s.total, partnerEarning: s.earning },
    addOns: (s.addOns ?? []).map((a, i) => ({ id: `addon-${s.n}-${i}`, name: a.name, quantity: 1, amount: a.amount })),
    extraCharges: [],
    instructions: 'Please call 10 minutes before reaching. Parking is available near the gate.',
    checklist: s.checklist ?? getDefaultChecklistForService(s.service),
    payment: demoPayment(s.total, code, done),
    actions: [],
    otpRequired: false,
    history: [{ status: s.status, at: new Date().toISOString(), actor: 'System' }],
  };
}

function seedAssigned(): JobDetails[] {
  const base = { customer: 'Customer', phone: '+91 ••••• ••000', address: 'Madhapur, Hyderabad', minutes: 120 };
  return [
    seedJob({
      ...base,
      n: 1,
      status: 'assigned',
      service: 'Deep home cleaning',
      description: 'Top-to-bottom cleaning of rooms, kitchen and bathrooms',
      customer: 'Rohan K.',
      phone: '+91 ••••• ••214',
      address: '12 MG Road, Madhapur',
      minutes: 180,
      total: 1899,
      earning: 1500,
      day: 0,
      hour: 16,
      addOns: [
        { name: 'Fridge cleaning', amount: 199 },
        { name: 'Balcony wash', amount: 149 },
      ],
      checklist: [
        { id: 'chk-1', label: 'Dust ceilings, fans and light fixtures', done: true },
        { id: 'chk-2', label: 'Wipe walls, switches and windows', done: true },
        { id: 'chk-3', label: 'Scrub kitchen counters and chimney', done: true },
        { id: 'chk-4', label: 'Deep clean bathrooms and fittings', done: false },
        { id: 'chk-5', label: 'Vacuum and mop all floors', done: false },
        { id: 'chk-6', label: 'Final walkthrough with customer', done: false },
      ],
    }),
    seedJob({ ...base, n: 2, status: 'assigned', service: 'Bathroom & kitchen sanitization', description: 'Anti-bacterial treatment for wet areas', customer: 'Anita R.', phone: '+91 ••••• ••318', total: 1299, earning: 1000, day: 0, hour: 18 }),
    seedJob({ ...base, n: 3, status: 'assigned', service: 'AC foam-jet service & gas check', description: 'Foam-jet cleaning with pressure test', customer: 'Vikram S.', phone: '+91 ••••• ••427', minutes: 90, total: 699, earning: 520, day: 1, hour: 10 }),
    seedJob({ ...base, n: 4, status: 'assigned', service: 'Sofa & carpet shampooing', description: 'Dry vacuum, shampoo and suction extraction', customer: 'Meera P.', phone: '+91 ••••• ••536', minutes: 90, total: 899, earning: 700, day: 1, hour: 14 }),
    seedJob({ ...base, n: 5, status: 'assigned', service: 'General pest control', description: 'Odourless spray and gel bait treatment', customer: 'Sanjay D.', phone: '+91 ••••• ••645', minutes: 60, total: 799, earning: 600, day: 2, hour: 11 }),
    seedJob({ ...base, n: 6, status: 'assigned', service: 'Interior wall touch-up painting', description: 'Patch, prime and repaint selected walls', customer: 'Lakshmi N.', phone: '+91 ••••• ••754', total: 2499, earning: 1900, day: 2, hour: 15 }),
    seedJob({ ...base, n: 7, status: 'confirmed', service: 'Kitchen chimney & hob deep cleaning', description: 'Degreasing of chimney, filters and hob', customer: 'Farhan A.', phone: '+91 ••••• ••863', minutes: 90, total: 999, earning: 780, day: 3, hour: 10 }),
    seedJob({ ...base, n: 8, status: 'cancelled_by_partner', service: 'Terrace water tank cleaning', description: 'Empty, scrub and disinfect the tank', customer: 'Gopal M.', phone: '+91 ••••• ••972', total: 1199, earning: 900, day: 3, hour: 14 }),
    seedJob({ ...base, n: 9, status: 'completed', service: 'Full bathroom steam sanitization', description: 'Steam cleaning and disinfection', customer: 'Divya T.', phone: '+91 ••••• ••081', minutes: 60, total: 849, earning: 650, day: -1, hour: 11 }),
  ];
}

/** Fills the gaps in a stored job so a partial record (older version, hand-edited) still renders. */
function hydrate(raw: Partial<StoredJob> & { id: string }): StoredJob {
  const total = raw.price?.total ?? 0;
  const code = raw.bookingCode ?? `#${raw.id}`;
  const payment = raw.payment
    ? raw.payment.phase
      ? raw.payment
      : normalizePayment(raw.payment as never, raw.payment.amount ?? total, code)
    : normalizePayment(undefined, total, code);
  return {
    status: 'assigned',
    instructions: null,
    otpRequired: false,
    ...raw,
    bookingCode: code,
    customer: { name: 'Customer', phoneMasked: '—', ...raw.customer },
    service: { name: 'Service', quantity: 1, durationMinutes: null, ...raw.service },
    location: { address: '', city: '', pincode: null, ...raw.location },
    schedule: { scheduledAt: new Date().toISOString(), slot: null, startedAt: null, ...raw.schedule },
    price: { total: 0, partnerEarning: 0, ...raw.price },
    addOns: raw.addOns ?? [],
    extraCharges: raw.extraCharges ?? [],
    checklist: raw.checklist ?? [],
    payment,
    actions: raw.actions ?? [],
    history: raw.history ?? [],
  } as StoredJob;
}

function loadAssigned(): StoredJob[] {
  const stored = readJson<Array<Partial<StoredJob> & { id: string }>>(MOCK_PARTNER_ASSIGNED_STORAGE_KEY);
  if (Array.isArray(stored)) return stored.filter((j) => j && typeof j.id === 'string').map(hydrate);
  const seeded = seedAssigned() as StoredJob[];
  writeJson(MOCK_PARTNER_ASSIGNED_STORAGE_KEY, seeded);
  return seeded;
}

const saveAssigned = (list: StoredJob[]): void => writeJson(MOCK_PARTNER_ASSIGNED_STORAGE_KEY, list);

function loadRoute(id: string): StoredJob | null {
  const stored = readJson<Partial<StoredJob> & { id: string }>(MOCK_PARTNER_ROUTE_STORAGE_KEY);
  if (stored && stored.id === id) return hydrate(stored);
  const fromList = loadAssigned().find((j) => j.id === id);
  return fromList ? { ...fromList } : null;
}

/** Saves the route job and keeps the matching list card in step. */
function saveRoute(job: StoredJob): void {
  writeJson(MOCK_PARTNER_ROUTE_STORAGE_KEY, job);
  const list = loadAssigned();
  const index = list.findIndex((j) => j.id === job.id);
  if (index >= 0) {
    list[index] = { ...job };
    saveAssigned(list);
  }
}

const nextActions = (status: JobStatus): JobDetails['actions'] =>
  status === 'confirmed' || status === 'assigned'
    ? [{ status: 'en_route', label: 'I am on the way' }]
    : status === 'en_route'
      ? [{ status: 'arrived', label: 'I have arrived' }]
      : [];

function startVerificationFor(job: StoredJob): StartVerification | null {
  if (job.status !== 'arrived') return null;
  const arrived = [...job.history].reverse().find((h) => h.status === 'arrived');
  const arrivedMs = arrived ? Date.parse(arrived.at) : NaN;
  const expiresAt = Number.isNaN(arrivedMs) ? null : new Date(arrivedMs + START_OTP_TTL_MS).toISOString();
  const used = job.startAttempts ?? 0;
  return {
    maxAttempts: START_OTP_MAX_ATTEMPTS,
    attemptsRemaining: Math.max(0, START_OTP_MAX_ATTEMPTS - used),
    expiresAt,
    expired: expiresAt ? Date.now() > Date.parse(expiresAt) : false,
    locked: used >= START_OTP_MAX_ATTEMPTS,
  };
}

/** What the screens get: no internal counters, and the computed fields filled in. */
function view(job: StoredJob): JobDetails {
  const { startAttempts: _attempts, ...rest } = job;
  void _attempts;
  return {
    ...rest,
    actions: nextActions(job.status),
    otpRequired: job.status === 'arrived',
    startVerification: startVerificationFor(job),
  };
}

function requireRoute(id: string): StoredJob {
  const job = loadRoute(id);
  if (!job) throw demoError(404, 'NOT_FOUND', 'Job not found');
  return job;
}

const pushHistory = (job: StoredJob, status: JobStatus): void => {
  job.status = status;
  job.history = [...job.history, { status, at: new Date().toISOString(), actor: 'Partner' }];
};

/** Back to the state right after the partner accepted the job. Used by the "Reset demo" buttons and tests. */
export function resetMockPartnerJob(id: string): JobDetails {
  const fresh = seedAssigned().find((j) => j.id === id) ?? seedAssigned()[0];
  const job: StoredJob = { ...fresh, id, bookingCode: `#${id}`, status: 'confirmed', startAttempts: 0 };
  job.history = [{ status: 'confirmed', at: new Date().toISOString(), actor: 'System' }];
  saveRoute(job);
  return view(job);
}

/* ------------------------------------------------------------------ file checks (start photo) */

async function readHead(file: Blob, length: number): Promise<Uint8Array> {
  const slice = file.slice(0, length);
  if (typeof slice.arrayBuffer === 'function') return new Uint8Array(await slice.arrayBuffer());
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(slice);
  });
}

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPG = [0xff, 0xd8, 0xff];
const startsWith = (bytes: Uint8Array, magic: number[]): boolean => magic.every((b, i) => bytes[i] === b);

/** The type is checked from the file's own bytes, never from its name or declared type. */
async function assertStartPhoto(file: File): Promise<void> {
  if (file.size > MAX_PHOTO_BYTES) {
    throw demoError(413, 'PAYLOAD_TOO_LARGE', 'The photo is larger than 5 MB.');
  }
  const head = await readHead(file, 8);
  if (!startsWith(head, PNG) && !startsWith(head, JPG)) {
    throw demoError(422, 'INVALID_FILE', 'The photo must be a JPG or PNG image.');
  }
}

/* ------------------------------------------------------------------ real server helpers */

const unwrap = <T>(res: { data: { data: T } }): T => res.data.data;
const hasToken = (): boolean => Boolean(tokenStore.get());

/* ------------------------------------------------------------------ jobs */

/** GET /partner/jobs/:id (demo ids come from the local store). */
export async function fetchJob(id: string): Promise<JobDetails> {
  if (useDemo(id)) return view(requireRoute(id));
  return mapJob(unwrap(await api.get<{ data: ApiJob }>(`/partner/jobs/${id}`)));
}

/** The "Assigned Services" list. */
export async function fetchAssignedServices(): Promise<JobDetails[]> {
  if (USE_MOCKS || !hasToken()) return loadAssigned().map(view);
  const res = await api.get<{ data: Array<Record<string, unknown>> }>('/partner/jobs');
  return unwrap(res).map((item) => mapJobListItemToJobDetails(item));
}

/** POST /partner/jobs/:id/accept, then returns the accepted job. */
export async function acceptAssignedService(id: string): Promise<JobDetails> {
  if (useDemo(id)) {
    const job = requireRoute(id);
    if (job.status === 'assigned') pushHistory(job, 'confirmed');
    job.startAttempts = 0;
    saveRoute(job);
    return view(job);
  }
  await api.post(`/partner/jobs/${id}/accept`);
  return fetchJob(id);
}

/** POST /partner/jobs/:id/reject. Returns the refreshed list (the declined card moves to the Decline tab). */
export async function declineAssignedService(id: string): Promise<JobDetails[]> {
  if (useDemo(id)) {
    const list = loadAssigned();
    const index = list.findIndex((j) => j.id === id);
    if (index < 0) throw demoError(404, 'NOT_FOUND', 'Job not found');
    list[index] = { ...list[index], status: 'cancelled_by_partner', actions: [] };
    saveAssigned(list);
    return list.map(view);
  }
  await api.post(`/partner/jobs/${id}/reject`);
  return fetchAssignedServices();
}

/** PATCH /bookings/:id/status. A partner can only step assigned -> en_route -> arrived. */
export async function updateBookingStatus(id: string, status: JobStatus): Promise<JobDetails> {
  if (useDemo(id)) {
    const job = requireRoute(id);
    const allowed =
      (status === 'en_route' && (job.status === 'confirmed' || job.status === 'assigned')) ||
      (status === 'arrived' && job.status === 'en_route');
    if (!allowed) {
      throw demoError(422, 'INVALID_STATE_TRANSITION', `A job that is "${job.status}" cannot move to "${status}".`);
    }
    pushHistory(job, status);
    job.startAttempts = 0;
    saveRoute(job);
    return view(job);
  }
  return mapJob(unwrap(await api.patch<{ data: ApiJob }>(`/bookings/${id}/status`, { status })));
}

/**
 * POST /partner/jobs/:id/verify-start: the customer's 4-digit code, and optionally a photo of the work area.
 * This is the ONLY way to start a job: it checks the code and starts the job in one call.
 * (There is no separate "verify code" route and PATCH /bookings/:id/status cannot move a job to in_progress.)
 * Same rules in the demo: 400 bad code format, 422 wrong state / wrong code / bad file,
 * 410 expired, 413 photo too big, 423 locked after 5 wrong codes, 409 already started.
 */
export async function verifyStart(id: string, otp: string, media?: File | File[] | null): Promise<JobDetails> {
  if (!useDemo(id)) {
    const files = Array.isArray(media) ? media : media ? [media] : [];
    if (files.length > 0) {
      const form = new FormData();
      form.append('otp', otp);
      files.forEach((file) => form.append('media', file));
      const res = await api.post<{ data: ApiJob }>(`/partner/jobs/${id}/verify-start`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        // A video can take a while on a slow mobile network.
        timeout: 120_000,
      });
      return mapJob(unwrap(res));
    }
    // No files: plain JSON. The server accepts both.
    const res = await api.post<{ data: ApiJob }>(`/partner/jobs/${id}/verify-start`, { otp });
    return mapJob(unwrap(res));
  }

  const job = requireRoute(id);
  if (!/^\d{4}$/.test(otp)) throw demoError(400, 'VALIDATION_ERROR', 'The start code must be 4 digits.');
  if (job.status === 'in_progress' || job.status === 'completed' || job.status === 'rated') {
    throw demoError(409, 'ALREADY_STARTED', 'This job has already started.');
  }
  if (job.status !== 'arrived') {
    throw demoError(422, 'INVALID_STATE_TRANSITION', 'You can only start a job after you have arrived.');
  }

  const state = startVerificationFor(job);
  if (state?.locked) throw demoError(423, 'OTP_LOCKED', 'Starting is locked. Contact support to unlock it.');
  if (state?.expired) throw demoError(410, 'OTP_EXPIRED', 'The start code has expired. Ask support for a new one.');

  // A bad photo never uses up an attempt (demo mode checks the first photo only).
  const demoPhoto = Array.isArray(media) ? media.find((f) => f.type.startsWith('image/')) : media;
  if (demoPhoto) await assertStartPhoto(demoPhoto);

  if (otp !== DEMO_START_OTP) {
    job.startAttempts = (job.startAttempts ?? 0) + 1;
    saveRoute(job);
    const left = Math.max(0, START_OTP_MAX_ATTEMPTS - job.startAttempts);
    if (left === 0) throw demoError(423, 'OTP_LOCKED', 'Starting is locked. Contact support to unlock it.');
    throw demoError(422, 'INVALID_OTP', 'Wrong start code.', [{ field: 'attemptsRemaining', message: String(left) }]);
  }

  pushHistory(job, 'in_progress');
  job.schedule = { ...job.schedule, startedAt: new Date().toISOString() };
  job.otpVerified = true;
  saveRoute(job);
  return view(job);
}

/** POST /partner/jobs/:id/complete. */
export async function completeJob(id: string): Promise<JobDetails> {
  if (useDemo(id)) {
    const job = requireRoute(id);
    if (job.status !== 'in_progress') {
      throw demoError(422, 'INVALID_STATE_TRANSITION', 'Start the job before completing it.');
    }
    pushHistory(job, 'completed');
    job.schedule = { ...job.schedule, completedAt: new Date().toISOString() };
    saveRoute(job);
    return view(job);
  }
  return mapJob(unwrap(await api.post<{ data: ApiJob }>(`/partner/jobs/${id}/complete`)));
}

/* ------------------------------------------------------------------ checklist, extras, payment, SOS */

/** Saves one tick. Returns the full checklist as the server now has it (or undefined if it did not send one). */
export async function persistChecklistItem(
  jobId: string,
  itemId: string,
  done: boolean,
): Promise<JobChecklistItem[] | undefined> {
  if (useDemo(jobId)) {
    const job = requireRoute(jobId);
    job.checklist = job.checklist.map((c) => (c.id === itemId ? { ...c, done } : c));
    saveRoute(job);
    return job.checklist;
  }
  const res = await api.patch<{ data?: { checklist?: JobChecklistItem[] } }>(`/partner/jobs/${jobId}/checklist/${itemId}`, { done });
  return res.data?.data?.checklist;
}

export interface AddJobItemInput {
  title: string;
  amount: number;
  reason?: string;
}

/** Asks for an extra charge / material on the job. */
export async function addJobItem(bookingId: string, input: AddJobItemInput): Promise<void> {
  if (useDemo(bookingId)) {
    const job = requireRoute(bookingId);
    job.addOns = [...job.addOns, { id: `custom-${Date.now()}`, name: input.title, quantity: 1, amount: input.amount }];
    job.checklist = [...job.checklist, { id: `chk-custom-${Date.now()}`, label: `${input.title} (add-on)`, done: false }];
    saveRoute(job);
    return;
  }
  await api.post(`/partner/jobs/${bookingId}/extra-charges`, { ...input, quantity: 1 });
}

/** Partner confirms the customer paid, in cash or by UPI. */
export async function collectPayment(jobId: string, method: 'cash' | 'upi'): Promise<JobDetails> {
  if (useDemo(jobId)) {
    const job = requireRoute(jobId);
    job.payment = { ...job.payment, status: 'PAID', phase: 'paid', method, paidAt: new Date().toISOString() };
    saveRoute(job);
    return view(job);
  }
  await api.post(`/partner/jobs/${jobId}/collect-payment`, { method });
  return fetchJob(jobId);
}

/** Raises the SOS alert. The booking is only sent when it is a real one (see sendSos). */
export async function triggerSos(
  bookingId?: string | null,
  coordinates?: { lat: number; lng: number } | null,
): Promise<void> {
  await sendSos({ bookingId, location: coordinates ?? null });
}

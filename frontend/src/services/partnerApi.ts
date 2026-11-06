import http, { type ApiResponse } from "@/lib/http";

import type {
  ActiveJob,
  EarningsSummary,
  JobMutationResult,
  JobRequest,
  JobTab,
  JobsResponse,
  PartnerDashboard,
  PartnerJob,
  PartnerJobStatus,
  PartnerNotification,
} from "@/types/partner";

import type { PartnerDetails, AccountStatus } from "@/types/adminPartner";
import { PARTNER_DETAILS } from "@/mocks/partnerDetails";

/* =========================================================
   Config
   ========================================================= */

/** "true" serves the demo partners from mocks/partnerDetails.ts when no live record exists. */
const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === "true";

const PARTNER_CACHE_KEY = "homecarex_admin_partner_cache_v1";

function readPartnerCache(): Record<string, PartnerDetails> {
  try {
    const raw = window.localStorage.getItem(PARTNER_CACHE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, PartnerDetails>) : {};
  } catch {
    return {};
  }
}

/** Demo partner with this id, if there is one. */
function getMockPartner(id: string): PartnerDetails | undefined {
  return PARTNER_DETAILS.find((partner) => partner.id === id) as PartnerDetails | undefined;
}

/** Partner we already know about: the cached live record first, then (in mock mode) the demo one. */
function getCurrentPartner(id: string): PartnerDetails | undefined {
  return readPartnerCache()[id] ?? (USE_MOCKS ? getMockPartner(id) : undefined);
}

/** Remembers a partner so the details page can reuse its full structure next time. */
function savePartner(partner: PartnerDetails): void {
  try {
    window.localStorage.setItem(
      PARTNER_CACHE_KEY,
      JSON.stringify({ ...readPartnerCache(), [partner.id]: partner }),
    );
  } catch {
    /* storage full or blocked: the record just is not cached */
  }
}

/* =========================================================
   Types
   ========================================================= */

export interface PartnerProfileInput {
  name: string;
  phone: string;
  bio?: string;
}

/** What the partner gave when joining (address, services, bank), as saved now. */
export interface PartnerJoinDetails {
  name: string;
  phone: string;
  email: string;
  joined: {
    address: { line1: string; city: string; state: string; pincode: string };
    categories: string[];
    skills: string[];
    serviceRadiusKm: number | null;
    bank: { accountHolder: string; accountLast4: string; ifsc: string; upiId: string } | null;
  };
}

export type {
  ActiveJob,
  EarningsSummary,
  JobRequest,
  PartnerDashboard,
  PartnerNotification,
};

export type KycDecision = "approve" | "reject";

export interface KycUpdatePayload {
  decision: KycDecision;
  reason?: string;
}

export interface StatusUpdatePayload {
  status: AccountStatus;
}

export interface PartnerMutationResult {
  success: boolean;
  message: string;
  partner: PartnerDetails;
}

/* =========================================================
   Helpers
   ========================================================= */

const httpMessage = (error: unknown, fallback: string): string =>
  (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
  (error as { message?: string })?.message ||
  fallback;

/* =========================================================
   Admin partner APIs (real backend, no mock data)
   ========================================================= */


export async function getPartnerById(
  id: string,
): Promise<PartnerDetails | null> {
  if (!id?.trim()) {
    return null;
  }

  // In mock mode, preserve existing mock behavior when a matching
  // local or mock partner exists.
  const localPartner = getCurrentPartner(id);

  if (USE_MOCKS && localPartner) {
    return structuredClone(localPartner);
  }

  try {
    // Fetch the actual partner from the backend.
    const response = await http.get<ApiResponse<Record<string, unknown>>>(
      `/admin/partners/${encodeURIComponent(id)}`,
    );

    const raw = response.data?.data;

    if (!raw || typeof raw !== "object") {
      throw new Error("The partner API returned an empty response.");
    }

    const apiId = String(raw.id ?? raw._id ?? id);

    // Prefer an existing template to preserve the complete details-page
    // structure. Use the first template if the live partner has no mock.
    const template =
      localPartner ??
      getMockPartner(apiId) ??
      getMockPartner(id) ??
      PARTNER_DETAILS[0];

    if (!template) {
      throw new Error(
        "No PartnerDetails template exists. Check mocks/partnerDetails.ts.",
      );
    }

    const partner = structuredClone(template);

    // Replace template values with actual backend values.
    partner.id = apiId;

    if (typeof raw.name === "string") {
      partner.name = raw.name;
    }

    if (typeof raw.email === "string") {
      partner.email = raw.email;
    }

    if (typeof raw.phone === "string") {
      partner.phone = raw.phone;
    }

    if (typeof raw.category === "string") {
      partner.category = raw.category;
    }

    if (typeof raw.city === "string") {
      partner.city = raw.city;
    }

    if (typeof raw.rating === "number") {
      partner.rating = raw.rating;
    }

    if (typeof raw.kycStatus === "string") {
      partner.kycStatus = raw.kycStatus as PartnerDetails["kycStatus"];
    }

    // Use the live sections from the backend. The template above is only a skeleton: without this the
    // page keeps the demo KYC documents (placehold.co "Aadhaar Document" / "PAN Document") and the
    // files the partner really uploaded are never shown. Stored files come back as secure: true with
    // an admin-only url, which the details page fetches with the admin token.
    const live = raw as Record<string, unknown>;
    const target = partner as unknown as Record<string, unknown>;
    const isObject = (v: unknown): v is Record<string, unknown> =>
      !!v && typeof v === "object" && !Array.isArray(v);

    if (isObject(live.kyc)) {
      const k = live.kyc;
      partner.kyc = {
        ...partner.kyc,
        submittedAt: typeof k.submittedAt === "string" ? k.submittedAt : "",
        reviewedAt: typeof k.reviewedAt === "string" ? k.reviewedAt : undefined,
        documents: Array.isArray(k.documents) ? (k.documents as PartnerDetails["kyc"]["documents"]) : [],
        checklist: Array.isArray(k.checklist) ? (k.checklist as PartnerDetails["kyc"]["checklist"]) : [],
      };
    }
    for (const key of ["accountStatus", "address", "joined"] as const) {
      if (typeof live[key] === "string") target[key] = live[key];
    }
    for (const key of ["acceptance", "completion"] as const) {
      if (typeof live[key] === "number") target[key] = live[key];
    }
    for (const key of ["profile", "performance", "training"] as const) {
      if (isObject(live[key])) target[key] = live[key];
    }
    for (const key of ["categories", "bookings", "earnings", "payouts", "reviews", "support", "activity"] as const) {
      if (Array.isArray(live[key])) target[key] = live[key];
    }

    // Cache using the actual backend user ID.
    savePartner(partner);

    return structuredClone(partner);
  } catch (error) {
    console.error("Failed to load partner details:", error);
    throw error;
  }
}


export async function updatePartnerKyc(
  id: string,
  payload: KycUpdatePayload,
): Promise<PartnerMutationResult> {
  try {
    const res = await http.post<ApiResponse<PartnerDetails>>(`/admin/partners/${id}/kyc`, {
      decision: payload.decision,
      reason: payload.reason,
    });
    return {
      success: true,
      message: res.data?.message ?? (payload.decision === "approve" ? "Partner KYC approved." : "Partner KYC rejected."),
      partner: res.data.data,
    };
  } catch (error) {
    throw new Error(httpMessage(error, "Unable to update KYC."));
  }
}

/**
 * Approve / reject the training a partner submitted after KYC approval.
 * The backend must only let the partner log in to their dashboard once this is approved.
 */
export async function updatePartnerTraining(
  id: string,
  payload: KycUpdatePayload,
): Promise<PartnerMutationResult> {
  try {
    // Backend routes: /training/approve lets the partner in, /training/reset sends them back to step 1.
    const action = payload.decision === "approve" ? "approve" : "reset";
    const res = await http.post<ApiResponse<unknown>>(`/admin/partners/${id}/training/${action}`);
    const partner = await getPartnerById(id);
    return {
      success: true,
      message:
        res.data?.message ??
        (payload.decision === "approve"
          ? "Partner training approved."
          : "Training reset. The partner must complete it again."),
      partner: partner as PartnerDetails,
    };
  } catch (error) {
    throw new Error(httpMessage(error, "Unable to update training."));
  }
}

export async function updatePartnerStatus(
  id: string,
  payload: StatusUpdatePayload,
): Promise<PartnerMutationResult> {
  try {
    // Backend only has active / blocked; "Suspended" and "Inactive" both block the login.
    await http.patch(`/admin/partners/${id}`, {
      status: payload.status === "Active" ? "active" : "blocked",
    });
    const partner = await getPartnerById(id);
    if (!partner) throw new Error("Partner not found.");
    return {
      success: true,
      message: `Partner status changed to ${payload.status}.`,
      partner,
    };
  } catch (error) {
    throw new Error(httpMessage(error, "Unable to update partner status."));
  }
}

/**
 * Downloads one stored KYC document as a Blob. The endpoint is admin-only, so it needs the auth
 * header: an <img>/<iframe> pointing at the API path would be rejected with 401.
 */
export async function fetchKycDocumentBlob(path: string): Promise<Blob> {
  try {
    const res = await http.get<Blob>(path, { responseType: "blob" });
    return res.data;
  } catch (err) {
    // With responseType "blob" an error body arrives as a Blob too: read the server message from it.
    const e = err as { status?: number; message?: string; response?: { status?: number; data?: unknown } };
    let message = e.message ?? "";
    const body = e.response?.data;
    if (body instanceof Blob) {
      try {
        const parsed = JSON.parse(await body.text()) as { message?: string };
        if (parsed.message) message = parsed.message;
      } catch {
        /* not JSON */
      }
    }
    const status = e.response?.status ?? e.status;
    throw new Error(`${status ? `HTTP ${status}: ` : ""}${message || "Network error"}`);
  }
}

/* =========================================================
   P02 - Partner Jobs / My Jobs (all data comes from the backend)
   ========================================================= */

/** Maps the UI tab ("requests") to the job status ("requested"). */
const matchesJobTab = (job: PartnerJob, tab: JobTab): boolean => {
  if (tab === "all") return true;
  if (tab === "requests") return job.status === "requested";
  return job.status === tab;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

const toJobStatus = (raw: string): PartnerJobStatus => {
  if (["en_route", "arrived", "in_progress"].includes(raw)) return "active";
  if (raw === "completed" || raw === "rated") return "completed";
  if (raw.startsWith("cancelled")) return "cancelled";
  return "upcoming"; // "assigned"
};

const shortId = (id: string): string => `#${id.slice(-6).toUpperCase()}`;

/* The backend has used different names for the partner's money on a job.
   Try the likely ones (partner earning first) so the amount is never blank. */
const AMOUNT_KEYS = [
  "partnerEarning", "partnerPayout", "partnerAmount", "payout", "earning", "netEarning",
  "partnerFee", "price", "amount", "totalAmount", "total", "finalAmount",
];

const toNumber = (v: unknown): number =>
  typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;

const pickAmount = (item: Record<string, unknown>): number => {
  const scopes = [item, asRecord(item.pricing), asRecord(item.payment), asRecord(item.booking), asRecord(item.earnings)];
  for (const scope of scopes) {
    for (const key of AMOUNT_KEYS) {
      const n = toNumber(scope[key]);
      if (Number.isFinite(n) && n > 0) return n;
    }
  }
  return 0;
};

const IMAGE_KEYS = ["imageUrl", "image", "thumbnail", "thumbnailUrl", "coverImage", "photo"];

const pickImage = (...scopes: Array<Record<string, unknown>>): string | undefined => {
  for (const scope of scopes) {
    for (const key of IMAGE_KEYS) {
      const v = scope[key];
      if (typeof v === "string" && v) return v;
    }
    const list = scope.images;
    if (Array.isArray(list) && list.length > 0) {
      const first = list[0];
      if (typeof first === "string" && first) return first;
      const url = asRecord(first).url;
      if (typeof url === "string" && url) return url;
    }
  }
  return undefined;
};

const mapRequest = (req: JobRequest): PartnerJob => ({
  id: req.id,
  bookingId: shortId(req.id),
  service: req.service,
  customer: "Customer",
  location: req.area || "Hyderabad",
  distance: 0,
  scheduledAt: req.scheduledAt,
  amount: req.price > 0 ? req.price : pickAmount(asRecord(req)),
  status: "requested",
  expiresAt: req.expiresAt ?? undefined,
  assignedByAdmin: req.assignedByAdmin ?? !req.expiresAt,
  image: pickImage(asRecord(req)),
});

const mapLiveJob = (rawItem: unknown): PartnerJob => {
  const item = asRecord(rawItem);
  const rawId = item.id ?? item._id;
  const id = typeof rawId === "string" || typeof rawId === "number" ? String(rawId) : "";
  const service = asRecord(item.service);

  return {
    id,
    bookingId: shortId(id),
    service: typeof service.name === "string" ? service.name : "Home Service",
    customer: typeof item.customerName === "string" ? item.customerName : "Customer",
    location: typeof item.address === "string" ? item.address : "",
    distance: 0,
    scheduledAt: typeof item.scheduledAt === "string" ? item.scheduledAt : new Date().toISOString(),
    amount: pickAmount(item),
    status: toJobStatus(typeof item.status === "string" ? item.status : ""),
    accepted: typeof item.accepted === "boolean" ? item.accepted : undefined,
    image: pickImage(service, item),
  };
};

async function fetchRequests(): Promise<PartnerJob[]> {
  const res = await http.get<ApiResponse<JobRequest[]>>("/partner/job-requests");
  return (res.data.data ?? []).map(mapRequest);
}

async function fetchLive(scope?: "completed" | "cancelled"): Promise<PartnerJob[]> {
  const res = await http.get<ApiResponse<unknown[]>>("/partner/jobs", {
    params: scope ? { scope } : undefined,
  });
  // A job the admin assigned that the partner has not accepted yet is a request (see fetchRequests), not a live job.
  return (res.data.data ?? []).map(mapLiveJob).filter((job) => job.accepted !== false);
}

/**
 * GET jobs for a tab. Requests come from /partner/job-requests, everything else
 * from /partner/jobs (live, or ?scope=completed|cancelled for history).
 */
async function getJobs(
  tab: JobTab = "all",
  page = 1,
  limit = 10,
  search = "",
): Promise<JobsResponse> {
  let jobs: PartnerJob[];

  if (tab === "requests") {
    jobs = await fetchRequests();
  } else if (tab === "completed" || tab === "cancelled") {
    jobs = await fetchLive(tab);
  } else if (tab === "all") {
    const [requests, live, done, cancelled] = await Promise.all([
      fetchRequests(),
      fetchLive(),
      fetchLive("completed"),
      fetchLive("cancelled"),
    ]);
    jobs = [...requests, ...live, ...done, ...cancelled];
  } else {
    jobs = (await fetchLive()).filter((job) => matchesJobTab(job, tab));
  }

  const q = search.trim().toLowerCase();
  const filtered = q
    ? jobs.filter((job) =>
        [job.bookingId, job.service, job.customer, job.location, job.status].some((v) =>
          v.toLowerCase().includes(q),
        ),
      )
    : jobs;

  const start = (page - 1) * limit;
  return { jobs: filtered.slice(start, start + limit), total: filtered.length, page, limit };
}

/** POST /partner/jobs/:id/accept */
async function acceptJob(id: string): Promise<JobMutationResult> {
  const res = await http.post<ApiResponse<JobMutationResult>>(`/partner/jobs/${id}/accept`);
  return res.data.data;
}

/** POST /partner/jobs/:id/reject */
async function rejectJob(id: string, reason?: string): Promise<JobMutationResult> {
  const trimmed = reason?.trim();
  const res = await http.post<ApiResponse<JobMutationResult>>(
    `/partner/jobs/${id}/reject`,
    trimmed ? { reason: trimmed } : {},
  );
  return res.data.data;
}

/* =========================================================
   Partner API
   ========================================================= */

const humanize = (type: string): string => {
  const text = type.replace(/[._:-]+/g, " ").trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "Notification";
};

export const partnerApi = {
  /* Dashboard */

  async getDashboard(): Promise<PartnerDashboard> {
    const res = await http.get<ApiResponse<PartnerDashboard>>("/partner/dashboard");
    return res.data.data;
  },

  /* Job requests (open offers) */

  async getJobRequests(): Promise<JobRequest[]> {
    const res = await http.get<ApiResponse<JobRequest[]>>("/partner/job-requests");
    return res.data.data ?? [];
  },

  /* P02 - My Jobs */

  getJobs,
  acceptJob,
  rejectJob,

  /* Earnings */

  async getEarningsSummary(): Promise<EarningsSummary> {
    const res = await http.get<ApiResponse<EarningsSummary>>("/partner/earnings/summary");
    return res.data.data;
  },

  /* Profile */

  async getProfileDetails(): Promise<PartnerJoinDetails> {
    const res = await http.get<ApiResponse<PartnerJoinDetails>>("/partner/profile");
    return res.data.data;
  },

  async updateProfile(input: PartnerProfileInput): Promise<PartnerProfileInput> {
    const res = await http.patch<ApiResponse<PartnerProfileInput>>("/partner/profile", input);
    return res.data.data;
  },

  /* Notifications */

  async getNotifications(): Promise<PartnerNotification[]> {
    const res = await http.get<
      ApiResponse<
        Array<{
          id: string;
          type: string;
          payload: unknown;
          readAt: string | null;
          createdAt: string;
        }>
      >
    >("/partner/notifications", { params: { limit: 20 } });

    return (res.data.data ?? []).map((n) => {
      const payload = asRecord(n.payload);
      const title =
        typeof payload.title === "string"
          ? payload.title
          : typeof payload.message === "string"
            ? payload.message
            : humanize(n.type);
      return { id: n.id, title, createdAt: n.createdAt, read: n.readAt !== null };
    });
  },
};
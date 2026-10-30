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

import {
  PARTNER_DETAILS,
  type PartnerDetails,
  type AccountStatus,
} from "@/mocks/partnerDetails";

/* =========================================================
   Config
   ========================================================= */

/* =========================================================
   Types
   ========================================================= */

export interface PartnerProfileInput {
  name: string;
  phone: string;
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

const STORAGE_PREFIX = "homecarex:partner:";

const delay = (milliseconds: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });

const getStorageKey = (id: string): string => `${STORAGE_PREFIX}${id}`;

/* =========================================================
   Mock partner storage (localStorage)
   ========================================================= */

const savePartner = (partner: PartnerDetails): void => {
  window.localStorage.setItem(
    getStorageKey(partner.id),
    JSON.stringify(partner),
  );
};

const getStoredPartner = (id: string): PartnerDetails | null => {
  const storedPartner = window.localStorage.getItem(getStorageKey(id));

  if (!storedPartner) {
    return null;
  }

  try {
    return JSON.parse(storedPartner) as PartnerDetails;
  } catch {
    window.localStorage.removeItem(getStorageKey(id));

    return null;
  }
};

const getMockPartner = (id: string): PartnerDetails | null => {
  const partner = PARTNER_DETAILS.find((item) => item.id === id);

  return partner ? structuredClone(partner) : null;
};

const getCurrentPartner = (id: string): PartnerDetails | null =>
  getStoredPartner(id) ?? getMockPartner(id);

/* =========================================================
   Partner details APIs
   ========================================================= */

export async function getPartnerById(
  id: string,
): Promise<PartnerDetails | null> {
  await delay(500);

  const partner = getCurrentPartner(id);

  return partner ? structuredClone(partner) : null;
}

export async function updatePartnerKyc(
  id: string,
  payload: KycUpdatePayload,
): Promise<PartnerMutationResult> {
  await delay(500);

  const partner = getCurrentPartner(id);

  if (!partner) {
    throw new Error("Partner not found.");
  }

  /* REJECT */

  if (payload.decision === "reject") {
    const reason = payload.reason?.trim();

    if (!reason) {
      throw new Error("Rejection reason is required.");
    }

    partner.kycStatus = "Rejected";
    partner.kyc.reviewedAt = new Date().toISOString();

    savePartner(partner);

    return {
      success: true,
      message: "Partner KYC rejected.",
      partner: structuredClone(partner),
    };
  }

  /* APPROVE */

  partner.kycStatus = "Approved";
  partner.kyc.reviewedAt = new Date().toISOString();
  partner.kyc.checklist = partner.kyc.checklist.map((item) => ({
    ...item,
    completed: true,
  }));

  savePartner(partner);

  return {
    success: true,
    message: "Partner KYC approved.",
    partner: structuredClone(partner),
  };
}

export async function updatePartnerStatus(
  id: string,
  payload: StatusUpdatePayload,
): Promise<PartnerMutationResult> {
  await delay(500);

  const partner = getCurrentPartner(id);

  if (!partner) {
    throw new Error("Partner not found.");
  }

  partner.accountStatus = payload.status;

  savePartner(partner);

  return {
    success: true,
    message: `Partner status changed to ${payload.status}.`,
    partner: structuredClone(partner),
  };
}

export async function notifyPartner(
  id: string,
  message: string,
): Promise<void> {
  await delay(200);

  console.info(`[MOCK NOTIFY] ${id}: ${message}`);
}

export async function recordPartnerAudit(
  id: string,
  action: string,
  details: Record<string, string>,
): Promise<void> {
  await delay(100);

  console.info(
    "[MOCK AUDIT]",
    JSON.stringify({
      partnerId: id,
      action,
      details,
      timestamp: new Date().toISOString(),
    }),
  );
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
  expiresAt: req.expiresAt,
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
  return (res.data.data ?? []).map(mapLiveJob);
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
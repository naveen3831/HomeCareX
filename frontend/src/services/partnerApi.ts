import http, { type ApiResponse } from "@/lib/http";

import {
  mockDashboard,
  mockEarningsSummary,
  mockJobRequests,
  mockNotifications,
} from "@/mocks/partnerDashboard";

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

/* =========================================================
   Config
   ========================================================= */

/**
 * Mocks are ON unless VITE_USE_MOCKS=false.
 */
const USE_MOCKS = String(import.meta.env.VITE_USE_MOCKS ?? "true") !== "false";

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

const delay = (milliseconds: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });

const httpStatus = (error: unknown): number | undefined =>
  (error as { response?: { status?: number } })?.response?.status;

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
  try {
    const res = await http.get<ApiResponse<PartnerDetails>>(`/admin/partners/${id}`);
    return res.data?.data ?? null;
  } catch (error) {
    if (httpStatus(error) === 404) return null; // genuinely not found
    throw error; // network / server errors show "Unable to load partner details."
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
    const res = await http.post<ApiResponse<PartnerDetails>>(`/admin/partners/${id}/training`, {
      decision: payload.decision,
      reason: payload.reason,
    });
    return {
      success: true,
      message:
        res.data?.message ??
        (payload.decision === "approve" ? "Partner training approved." : "Partner training rejected."),
      partner: res.data.data,
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
  const res = await http.get<Blob>(path, { responseType: "blob" });
  return res.data;
}

/* =========================================================
   P02 - Partner Jobs / My Jobs
   ========================================================= */

/**
 * Mock jobs used by the My Jobs page until GET /partner/jobs
 * is available.
 */
const MOCK_PARTNER_JOBS: PartnerJob[] = [
  {
    id: "job-001",
    bookingId: "HCX-10001",
    service: "Deep Home Cleaning",
    customer: "Rahul Sharma",
    location: "Gachibowli, Hyderabad",
    distance: 2.4,
    scheduledAt: "2026-10-08T14:00:00+05:30",
    amount: 1499,
    status: "requested",
    instructions: "Please call the customer before arriving.",
    expiresAt: new Date(Date.now() + 60 * 1000).toISOString(),
  },
  {
    id: "job-002",
    bookingId: "HCX-10002",
    service: "Washing Machine Repair",
    customer: "Priya Reddy",
    location: "Kondapur, Hyderabad",
    distance: 4.1,
    scheduledAt: "2026-10-09T10:30:00+05:30",
    amount: 599,
    status: "upcoming",
    instructions: "Customer reported unusual vibration.",
  },
  {
    id: "job-003",
    bookingId: "HCX-10003",
    service: "AC Service",
    customer: "Arjun Kumar",
    location: "Madhapur, Hyderabad",
    distance: 5.2,
    scheduledAt: "2026-10-08T12:30:00+05:30",
    amount: 899,
    status: "active",
    instructions: "Check cooling performance and clean filters.",
  },
  {
    id: "job-004",
    bookingId: "HCX-10004",
    service: "Kitchen Cleaning",
    customer: "Sneha Patel",
    location: "Jubilee Hills, Hyderabad",
    distance: 7.8,
    scheduledAt: "2026-10-05T11:00:00+05:30",
    amount: 1299,
    status: "completed",
    instructions: "Focus on kitchen cabinets and chimney area.",
  },
  {
    id: "job-005",
    bookingId: "HCX-10005",
    service: "Plumbing Repair",
    customer: "Vikram Singh",
    location: "Manikonda, Hyderabad",
    distance: 6.3,
    scheduledAt: "2026-10-04T15:30:00+05:30",
    amount: 749,
    status: "cancelled",
    instructions: "Customer cancelled the booking.",
  },
];

/** Maps the UI tab ("requests") to the job status ("requested"). */
const matchesJobTab = (job: PartnerJob, tab: JobTab): boolean => {
  if (tab === "all") {
    return true;
  }

  if (tab === "requests") {
    return job.status === "requested";
  }

  return job.status === tab;
};

/**
 * GET /partner/jobs?tab=all|requests|upcoming|active|completed|cancelled
 */
async function getJobs(
  tab: JobTab = "all",
  page = 1,
  limit = 10,
  search = "",
): Promise<JobsResponse> {
  const trimmedSearch = search.trim();

  try {
    if (tab === "requests") {
      const res = await http.get<ApiResponse<JobRequest[]>>("/partner/job-requests");
      const requests = Array.isArray(res.data?.data) ? res.data.data : [];
      if (requests.length > 0 || !USE_MOCKS) {
        const mappedJobs: PartnerJob[] = requests.map((req) => ({
          id: req.id,
          bookingId: `#${req.id.slice(-6).toUpperCase()}`,
          service: req.service,
          customer: "Customer",
          location: req.area || "Hyderabad",
          distance: 2.0,
          scheduledAt: req.scheduledAt,
          amount: req.price,
          status: "requested" as PartnerJobStatus,
          expiresAt: req.expiresAt,
        }));

        const normalizedSearch = trimmedSearch.toLowerCase();
        const filtered = mappedJobs.filter((job) => {
          if (!normalizedSearch) return true;
          return [job.bookingId, job.service, job.customer, job.location, job.status].some(
            (val) => val.toLowerCase().includes(normalizedSearch),
          );
        });

        const startIndex = (page - 1) * limit;
        return {
          jobs: filtered.slice(startIndex, startIndex + limit),
          total: filtered.length,
          page,
          limit,
        };
      }
    } else {
      const res = await http.get<ApiResponse<unknown>>("/partner/jobs");
      const rawData = res.data?.data;
      if (Array.isArray(rawData)) {
        const liveJobs: PartnerJob[] = rawData.map((rawItem: unknown) => {
          const item = (rawItem && typeof rawItem === "object" ? rawItem : {}) as Record<string, unknown>;
          let status: PartnerJobStatus = "upcoming";
          const itemStatus = typeof item.status === "string" ? item.status : "";
          if (["en_route", "arrived", "in_progress"].includes(itemStatus)) {
            status = "active";
          } else if (itemStatus === "completed") {
            status = "completed";
          } else if (itemStatus.startsWith("cancelled")) {
            status = "cancelled";
          } else {
            status = "upcoming"; // "assigned"
          }

          const rawId = item.id || item._id;
          const id = typeof rawId === "string" || typeof rawId === "number" ? String(rawId) : "";
          const serviceName =
            typeof item.service === "object" && item.service !== null && "name" in item.service
              ? String((item.service as { name?: unknown }).name)
              : typeof item.service === "string"
                ? item.service
                : "Home Service";
          const customer =
            typeof item.customerName === "string"
              ? item.customerName
              : typeof item.customer === "string"
                ? item.customer
                : "Customer";
          const location =
            typeof item.address === "string"
              ? item.address
              : typeof item.location === "string"
                ? item.location
                : "Hyderabad";
          const scheduledAt =
            typeof item.scheduledAt === "string" ? item.scheduledAt : new Date().toISOString();
          const amount =
            typeof item.partnerEarning === "number"
              ? item.partnerEarning
              : typeof item.amount === "number"
                ? item.amount
                : 1499;

          return {
            id,
            bookingId: `#${id.slice(-6).toUpperCase()}`,
            service: serviceName,
            customer,
            location,
            distance: 2.5,
            scheduledAt,
            amount,
            status,
            instructions: typeof item.instructions === "string" ? item.instructions : undefined,
          };
        });

        const normalizedSearch = trimmedSearch.toLowerCase();
        const filtered = liveJobs.filter((job) => {
          if (!matchesJobTab(job, tab)) return false;
          if (!normalizedSearch) return true;
          return [job.bookingId, job.service, job.customer, job.location, job.status].some(
            (val) => val.toLowerCase().includes(normalizedSearch),
          );
        });

        if (filtered.length > 0 || !USE_MOCKS) {
          const startIndex = (page - 1) * limit;
          return {
            jobs: filtered.slice(startIndex, startIndex + limit),
            total: filtered.length,
            page,
            limit,
          };
        }
      }
    }
  } catch {
    // If live API is unavailable, fall back to mock data
  }

  await delay(400);

  const normalizedSearch = trimmedSearch.toLowerCase();

  const filteredJobs = MOCK_PARTNER_JOBS.filter((job) => {
    if (!matchesJobTab(job, tab)) {
      return false;
    }

    if (!normalizedSearch) {
      return true;
    }

    return [
      job.bookingId,
      job.service,
      job.customer,
      job.location,
      job.status,
    ].some((value) => value.toLowerCase().includes(normalizedSearch));
  });

  const startIndex = (page - 1) * limit;

  return {
    jobs: filteredJobs
      .slice(startIndex, startIndex + limit)
      .map((job) => structuredClone(job)),
    total: filteredJobs.length,
    page,
    limit,
  };
}

/**
 * POST /partner/jobs/:id/accept
 * In mock mode this updates the in-memory job for this session.
 */
async function acceptJob(id: string): Promise<JobMutationResult> {
  if (!USE_MOCKS) {
    const res = await http.post<ApiResponse<JobMutationResult>>(
      `/partner/jobs/${id}/accept`,
    );

    return res.data.data;
  }

  await delay(400);

  const jobIndex = MOCK_PARTNER_JOBS.findIndex((job) => job.id === id);

  if (jobIndex === -1) {
    throw new Error("Job not found.");
  }

  const job = MOCK_PARTNER_JOBS[jobIndex];

  if (job.status !== "requested") {
    throw new Error("This job is no longer available.");
  }

  if (job.expiresAt && new Date(job.expiresAt).getTime() <= Date.now()) {
    throw new Error("This job request has expired.");
  }

  MOCK_PARTNER_JOBS[jobIndex] = { ...job, status: "upcoming" };

  return { success: true, message: "Job accepted successfully." };
}

/**
 * POST /partner/jobs/:id/reject
 * In mock mode the job is marked cancelled so it leaves the requests tab.
 */
async function rejectJob(id: string): Promise<JobMutationResult> {
  if (!USE_MOCKS) {
    const res = await http.post<ApiResponse<JobMutationResult>>(
      `/partner/jobs/${id}/reject`,
    );

    return res.data.data;
  }

  await delay(400);

  const jobIndex = MOCK_PARTNER_JOBS.findIndex((job) => job.id === id);

  if (jobIndex === -1) {
    throw new Error("Job not found.");
  }

  const job = MOCK_PARTNER_JOBS[jobIndex];

  if (job.status !== "requested") {
    throw new Error("This job is no longer available.");
  }

  MOCK_PARTNER_JOBS[jobIndex] = { ...job, status: "cancelled" };

  return { success: true, message: "Job rejected successfully." };
}

/* =========================================================
   Partner API
   ========================================================= */

export const partnerApi = {
  /* Dashboard */

  async getDashboard(): Promise<PartnerDashboard> {
    if (USE_MOCKS) {
      return mockDashboard();
    }

    const res = await http.get<ApiResponse<PartnerDashboard>>(
      "/partner/dashboard",
    );

    return res.data.data;
  },

  /* Job requests (open offers) */

  async getJobRequests(partnerId?: string): Promise<JobRequest[]> {
    if (USE_MOCKS) {
      return mockJobRequests();
    }

    /* Assumed endpoint; adjust to match the backend contract. */
    const res = await http.get<ApiResponse<JobRequest[]>>(
      "/partner/jobs/requests",
      { params: partnerId ? { partnerId } : undefined },
    );

    return res.data.data;
  },

  /* P02 - My Jobs */

  getJobs,
  acceptJob,
  rejectJob,

  /* Earnings */

  async getEarningsSummary(): Promise<EarningsSummary> {
    if (USE_MOCKS) {
      return mockEarningsSummary();
    }

    const res = await http.get<ApiResponse<EarningsSummary>>(
      "/partner/earnings/summary",
    );

    return res.data.data;
  },

  /* Profile */

  async updateProfile(
    input: PartnerProfileInput,
  ): Promise<PartnerProfileInput> {
    await delay(500);

    return input;
  },

  /* Notifications */

  async getNotifications(): Promise<PartnerNotification[]> {
    return mockNotifications();
  },
};
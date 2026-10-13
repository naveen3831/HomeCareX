import http, { type ApiResponse } from "@/lib/http";

import type {
  ActiveJob,
  EarningsSummary,
  JobMutationResult,
  JobRequest,
  JobTab,
  JobsResponse,
  PartnerDashboard,
  PartnerNotification,
} from "@/types/partner";

import {
  PARTNER_DETAILS,
  type PartnerDetails,
  type AccountStatus,
  type KycItem,
} from "../mocks/partnerDetails";

/* =========================================================
   Partner Profile / KYC / Status types
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
   Configuration and helpers
   ========================================================= */

const STORAGE_PREFIX = "homecarex:partner:";

const delay = (milliseconds: number): Promise<void> =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });

const getStorageKey = (id: string): string =>
  `${STORAGE_PREFIX}${id}`;

const savePartner = (partner: PartnerDetails): void => {
  window.localStorage.setItem(
    getStorageKey(partner.id),
    JSON.stringify(partner),
  );
};

const getStoredPartner = (id: string): PartnerDetails | null => {
  const storedPartner = window.localStorage.getItem(
    getStorageKey(id),
  );

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

const getCurrentPartner = (id: string): PartnerDetails | null => {
  const storedPartner = getStoredPartner(id);

  if (storedPartner) {
    return storedPartner;
  }

  return getMockPartner(id);
};

/* =========================================================
   Partner Details API
   ========================================================= */

export async function getPartnerById(
  id: string,
): Promise<PartnerDetails | null> {
  await delay(500);

  const partner = getCurrentPartner(id);

  return partner ? structuredClone(partner) : null;
}

/* =========================================================
   Update Partner KYC
   ========================================================= */

export async function updatePartnerKyc(
  id: string,
  payload: KycUpdatePayload,
): Promise<PartnerMutationResult> {
  await delay(500);

  const partner = getCurrentPartner(id);

  if (!partner) {
    throw new Error("Partner not found.");
  }

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

  partner.kycStatus = "Approved";
  partner.kyc.reviewedAt = new Date().toISOString();

  partner.kyc.checklist = partner.kyc.checklist.map((item: KycItem) => ({
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

/* =========================================================
   Update Partner Status
   ========================================================= */

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

/* =========================================================
   Partner Notifications and Audit
   ========================================================= */

export async function notifyPartner(
  id: string,
  message: string,
): Promise<void> {
  await delay(200);

  console.info(`[NOTIFY] ${id}: ${message}`);
}

export async function recordPartnerAudit(
  id: string,
  action: string,
  details: Record<string, string>,
): Promise<void> {
  await delay(100);

  console.info(
    "[AUDIT]",
    JSON.stringify({
      partnerId: id,
      action,
      details,
      timestamp: new Date().toISOString(),
    }),
  );
}

/* =========================================================
   P02 - Partner Jobs / My Jobs
   ========================================================= */

const USE_MOCKS = String(import.meta.env.VITE_USE_MOCKS ?? "true") !== "false";

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

const matchesJobTab = (job: PartnerJob, tab: JobTab): boolean => {
  if (tab === "all") {
    return true;
  }

  if (tab === "requests") {
    return job.status === "requested";
  }

  return job.status === tab;
};

/* =========================================================
   Get Jobs
   ========================================================= */

async function getJobs(
  tab: JobTab = "all",
  page = 1,
  limit = 10,
  search = "",
): Promise<JobsResponse> {
  const res = await http.get<ApiResponse<JobsResponse>>(
    "/partner/jobs",
    {
      params: {
        tab,
        page,
        limit,
        ...(search.trim() ? { search: search.trim() } : {}),
      },
    },
  );

  return res.data.data;
}

async function acceptJob(id: string): Promise<JobMutationResult> {
  const res = await http.post<ApiResponse<JobMutationResult>>(
    `/partner/jobs/${id}/accept`,
  );

  return res.data.data;
}

async function rejectJob(id: string): Promise<JobMutationResult> {
  const res = await http.post<ApiResponse<JobMutationResult>>(
    `/partner/jobs/${id}/reject`,
  );

  return res.data.data;
}

/* =========================================================
   Partner API
   ========================================================= */

export const partnerApi = {
  /* Dashboard */

  async getDashboard(): Promise<PartnerDashboard> {
    const res = await http.get<ApiResponse<PartnerDashboard>>(
      "/partner/dashboard",
    );

    return res.data.data;
  },

  /* Job Requests / Offers */

  async getJobRequests(): Promise<JobRequest[]> {
    const res = await http.get<ApiResponse<JobRequest[]>>(
      "/partner/job-requests",
    );

    return res.data.data;
  },

  async getJobOffers(_partnerId?: string): Promise<JobRequest[]> {
    const res = await http.get<ApiResponse<JobRequest[]>>(
      "/partner/job-requests",
    );

    return res.data.data;
  },

  async getJobOffers(partnerId = "partner-1"): Promise<JobRequest[]> {
    return listMockPartnerJobs(partnerId);
  },

  /* P02 - My Jobs */

  async getJobs(
    tab: JobTab = "all",
    page = 1,
    limit = 10,
    search = "",
  ): Promise<JobsResponse> {
    return getJobs(tab, page, limit, search);
  },

  async acceptJob(id: string): Promise<JobMutationResult> {
    return acceptJob(id);
  },

  async rejectJob(id: string): Promise<JobMutationResult> {
    return rejectJob(id);
  },

  /* Earnings */

  async getEarningsSummary(): Promise<EarningsSummary> {
    const res = await http.get<ApiResponse<EarningsSummary>>(
      "/partner/earnings/summary",
    );

    return res.data.data;
  },

  /* Profile */

  async updateProfile(
    input: PartnerProfileInput,
  ): Promise<PartnerProfileInput> {
    const res = await http.patch<ApiResponse<PartnerProfileInput>>(
      "/partner/profile",
      input,
    );

    return res.data.data;
  },

  /* Notifications */

  async getNotifications(): Promise<PartnerNotification[]> {
    const res = await http.get<
      ApiResponse<
        Array<{
          id: string;
          userId: string;
          type: string;
          payload: unknown;
          readAt: string | null;
          createdAt: string;
        }>
      >
    >("/notifications");

    const items = res.data.data ?? [];
    return items.map((n) => {
      let title = "";
      if (typeof n.payload === "object" && n.payload !== null) {
        const p = n.payload as Record<string, unknown>;
        if (typeof p.title === "string") title = p.title;
        else if (typeof p.message === "string") title = p.message;
        else if (typeof p.text === "string") title = p.text;
      }
      if (!title) {
        title = n.type
          ? n.type
              .replace(/_/g, " ")
              .replace(/\b\w/g, (c) => c.toUpperCase())
          : "Notification";
      }

      return {
        id: n.id,
        title,
        createdAt:
          typeof n.createdAt === "string"
            ? n.createdAt
            : new Date(n.createdAt).toISOString(),
        read: Boolean(n.readAt),
      };
    });
  },
};
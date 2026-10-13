import api from "@/lib/api";
import type { ApiJob, JobDetails } from "./jobDetails.types";
import { mapJob } from "./jobDetails.mapper";

export const getHttpStatus = (error: unknown): number | undefined => {
  if (typeof error === "object" && error !== null && "status" in error) {
    const value = (error as { status?: number }).status;
    if (typeof value === "number") return value;
  }
  return undefined;
};

export const getErrorMessage = (
  error: unknown,
  fallback: string,
): string => {
  if (typeof error === "object" && error !== null) {
    const message = (error as { message?: string }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
};

export async function fetchJob(id: string): Promise<JobDetails> {
  const res = await api.get<{ data: ApiJob }>(`/partner/jobs/${id}`);
  return mapJob(res.data.data);
}

export async function updateBookingStatus(
  id: string,
  status: string,
  reason?: string,
): Promise<JobDetails> {
  const res = await api.patch<{ data: ApiJob }>(`/bookings/${id}/status`, {
    status,
    reason,
  });
  return mapJob(res.data.data);
}

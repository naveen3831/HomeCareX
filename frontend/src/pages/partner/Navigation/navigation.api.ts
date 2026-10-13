import api from "@/lib/api";
import type { ApiJob } from "../JobDetails/jobDetails.types";

/** GET /partner/jobs/:id: booking id, status, customer name, address + coordinates, and the actions allowed right now. */
export async function fetchNavigationJob(id: string): Promise<ApiJob> {
  const res = await api.get<{ data: ApiJob }>(`/partner/jobs/${id}`);
  return res.data.data;
}

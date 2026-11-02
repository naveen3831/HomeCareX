import { useQuery } from "@tanstack/react-query";
import { partnerApi } from "@/services/partnerApi";
import type { JobTab } from "@/types/partner";

export function useJobs(
  tab: JobTab,
  search = "",
  page = 1
) {
  return useQuery({
    queryKey: ["partner", "jobs", tab, search, page],

    queryFn: () =>
      partnerApi.getJobs(
        tab,
        page,
        10,
        search
      ),

    retry: 1,

    staleTime: 5_000,

    // New requests / assignments appear on their own: re-check every 10 s while the
    // tab is visible, and straight away when the partner returns to the tab or reconnects.
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}
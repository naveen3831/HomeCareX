import { useQuery } from "@tanstack/react-query";
import http, { type ApiResponse } from "@/lib/http";
import { useAuth } from "@/hooks/useAuth";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

export interface ReferralSummary {
  code: string;
  rewardPerReferralPaise: number;
  stats: { invited: number; completed: number; rewardsPaise: number };
  entries: {
    id: string;
    status: "invited" | "completed" | "rewarded";
    rewardPaise: number;
    createdAt: string;
    rewardedAt: string | null;
  }[];
  meta: { page: number; pages: number; total: number };
  /** Active admin referral offers: what a friend gets on their first booking. */
  offers?: {
    id: string;
    name: string;
    /** This customer's own code for this offer. */
    code: string;
    scope: "ALL" | "CATEGORY" | "SERVICE";
    appliesTo: string[];
    discountType: "PERCENT" | "FLAT";
    value: number;
    maxDiscount: number | null;
    minOrder: number;
    endAt: string | null;
  }[];
}
export function useReferral(page = 1) {
  const { user } = useAuth();
  const online = useOnlineStatus();
  return useQuery({
    queryKey: ["customer-referrals", user?.id, page],
    queryFn: async ({ signal }) =>
      (
        await http.get<ApiResponse<ReferralSummary>>("/referrals", {
          params: { page },
          signal,
        })
      ).data.data,
    enabled: Boolean(user) && online,
    retry: false,
    refetchOnReconnect: true,
    refetchInterval: online ? 30_000 : false,
  });
}
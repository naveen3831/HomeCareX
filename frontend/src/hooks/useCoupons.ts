import { useQuery } from "@tanstack/react-query";
import { pricingApi } from "@/services/pricingApi";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import type { AvailableCoupon } from "@/types/pricing";

export function useCustomerCoupons() {
  const online = useOnlineStatus();
  return useQuery<AvailableCoupon[]>({
    queryKey: ["customer-available-coupons"],
    queryFn: () => pricingApi.listCoupons(null),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    enabled: online,
  });
}

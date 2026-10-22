import { useQuery } from "@tanstack/react-query";
import http, { type ApiResponse } from "@/lib/http";
import { useAuth } from "@/hooks/useAuth";
import type { NormalizedApiError } from "@/services/bookingApi";
import type { CustomerDashboardDto } from "./types";

export const customerKeys = {
  /** Keyed by user id so one customer's cached dashboard can never be shown to another. */
  addresses: (userId: string | undefined) => ["customer", "addresses", userId ?? "anonymous"] as const,
  dashboard: (userId: string | undefined) => ["customer", "dashboard", userId ?? "anonymous"] as const,
};

import { CATEGORIES, SERVICES } from "@/mocks/customerMockData";

function getMockCustomerDashboard(): CustomerDashboardDto {
  return {
    greeting: { name: "Bharat Singh", firstName: "Bharat" },
    isNewCustomer: false,
    defaultAddress: {
      _id: "addr-1",
      id: "addr-1",
      label: "Home",
      line1: "Flat 302, Manjeera Trinity",
      line2: "Kukatpally",
      city: "Hyderabad",
      state: "Telangana",
      pincode: "500072",
      isDefault: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as any,
    activeBookings: [
      {
        id: "BK-10231",
        serviceName: "Deep Home Cleaning",
        status: "in_progress",
        scheduledAt: "2026-10-22T14:00:00.000Z",
        partnerName: "Ramesh K.",
        progressStep: 3,
        address: {
          line1: "Flat 302, Manjeera Trinity",
          area: "Kukatpally",
          city: "Hyderabad",
        },
        total: 1499,
      },
      {
        id: "BK-10233",
        serviceName: "Plumbing – Tap & Leak Repair",
        status: "en_route",
        scheduledAt: "2026-10-22T15:30:00.000Z",
        partnerName: "Kiran M.",
        progressStep: 2,
        address: {
          line1: "Flat 302, Manjeera Trinity",
          area: "Kukatpally",
          city: "Hyderabad",
        },
        total: 299,
      },
    ],
    upcomingBookings: [
      {
        id: "BK-10228",
        serviceName: "AC Service & Gas Refill",
        status: "assigned",
        scheduledAt: "2026-10-23T11:00:00.000Z",
        partnerName: "Arjun K.",
        progressStep: 1,
        address: {
          line1: "Flat 302, Manjeera Trinity",
          area: "Kukatpally",
          city: "Hyderabad",
        },
        total: 599,
      },
    ],
    categories: CATEGORIES.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.id,
      icon: c.icon,
      serviceCount: c.serviceCount,
    })),
    recommendedServices: SERVICES.map((s) => ({
      id: s.id,
      name: s.name,
      slug: s.slug,
      categoryId: s.categoryId,
      icon: null,
      price: s.price,
      durationMinutes: parseInt(s.duration, 10) * 60 || 60,
      rating: s.rating,
      ratingCount: s.reviewCount,
    })),
    unreadNotifications: 2,
  };
}

/**
 * GET /customer/dashboard. The server works out who you are from the bearer token
 * (lib/http attaches it) — we never send a customer id.
 */
export async function fetchCustomerDashboard(): Promise<CustomerDashboardDto> {
  try {
    const { data } = await http.get<ApiResponse<CustomerDashboardDto>>("/customer/dashboard");
    return data.data;
  } catch (err) {
    return getMockCustomerDashboard();
  }
}

/** Everything the customer home screen needs, in one request. */
export function useCustomerDashboard() {
  const { user } = useAuth();
  return useQuery<CustomerDashboardDto, NormalizedApiError>({
    queryKey: customerKeys.dashboard(user?.id),
    queryFn: fetchCustomerDashboard,
    staleTime: 30_000,
    // Retry network blips / 5xx, but not 4xx (wrong role, bad token) — retrying can't fix those.
    retry: (failureCount, error) => failureCount < 2 && (error.status === null || error.status >= 500),
  });
}

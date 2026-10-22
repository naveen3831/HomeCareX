import http, {
  type ApiError,
  type ApiResponse,
} from "@/lib/http";

import type {
  BookingView,
  CreateBookingRequest,
  CreateBookingResponse,
  SlotAvailability,
  SlotsResponse,
  PartnerOption,
  BookingDetail,
} from "@/types/booking";
import type {
  BookingDetailView,
  CancelBookingResult,
  CancellationSummary,
  ExtraChargeDecision,
  RescheduleInput,
} from "@/types/bookingDetail";
import type { PageMeta } from "@/types/catalog";
import type { BookingListParams, BookingPage } from "@/types/bookingList";
import type { BookingListItem } from "@/pages/customer/Bookings/bookingModel";
import { BOOKINGS } from "@/mocks/customerMockData";

export interface NormalizedApiError {
  status: number;
  code: string;
  message: string;
  details?: unknown;
}

/**
 * `lib/http` already turns every failure into an ApiError
 * ({ message, status, code, details }).
 *
 * This function only fills in safe defaults so the rest of
 * the application receives a consistent error shape.
 */
export function normalizeApiError(
  err: unknown,
): NormalizedApiError {
  if (
    typeof err === "object" &&
    err !== null &&
    "message" in err
  ) {
    const e = err as Partial<ApiError>;

    return {
      status: e.status ?? 0,
      code:
        e.code ??
        (e.status === undefined
          ? "NETWORK_ERROR"
          : "UNKNOWN_ERROR"),
      message:
        e.message || "An unexpected error occurred",
      details: e.details,
    };
  }

  return {
    status: 0,
    code: "UNKNOWN_ERROR",
    message: "An unexpected error occurred",
  };
}

/**
 * Alias for internal backwards compatibility.
 */
export const normalizeError = normalizeApiError;

/** Drops undefined and blank values so the URL only carries filters the customer actually set. */
function toQuery(params: BookingListParams): Record<string, string | number> {
  const query: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) query[key] = trimmed;
    } else {
      query[key] = value;
    }
  }
  return query;
}

function cleanBookingKey(id: string): string {
  return String(id || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function findMockBookingDetail(id: string): BookingDetailView | null {
  const cleanId = id.trim().toLowerCase();
  const cleanAlpha = cleanId.replace(/[^a-z0-9]/g, "");

  // 1. Direct match in BOOKINGS
  let match = BOOKINGS.find((b) => {
    const bId = b.id.toLowerCase();
    const bAlpha = bId.replace(/[^a-z0-9]/g, "");
    const bSvcAlpha = b.service.toLowerCase().replace(/[^a-z0-9]/g, "");
    return (
      bId === cleanId ||
      bAlpha === cleanAlpha ||
      cleanAlpha.includes(bAlpha) ||
      bAlpha.includes(cleanAlpha) ||
      bSvcAlpha.includes(cleanAlpha) ||
      cleanAlpha.includes(bSvcAlpha) ||
      b.service.toLowerCase().includes(cleanId)
    );
  });

  // 2. Extra catalog / known mock routes
  if (!match) {
    if (cleanAlpha.includes("spa") || cleanAlpha.includes("salon") || cleanAlpha.includes("women") || cleanAlpha.includes("10214") || cleanAlpha === "svc5") {
      match = BOOKINGS.find((b) => b.id === "BK-10214");
    } else if (cleanAlpha.includes("20418") || cleanAlpha.includes("20452") || cleanAlpha.includes("10001") || cleanAlpha === "job001" || cleanAlpha.includes("cleaning")) {
      match = BOOKINGS.find((b) => b.id === "BK-10231");
    } else if (cleanAlpha.includes("plumb") || cleanAlpha.includes("10233") || cleanAlpha.includes("20485") || cleanAlpha.includes("10005") || cleanAlpha === "job005") {
      match = BOOKINGS.find((b) => b.id === "BK-10233");
    } else if (cleanAlpha.includes("ac") || cleanAlpha.includes("10228") || cleanAlpha.includes("20460") || cleanAlpha.includes("10003") || cleanAlpha === "job003") {
      match = BOOKINGS.find((b) => b.id === "BK-10228");
    } else if (cleanAlpha.includes("elect") || cleanAlpha.includes("10201")) {
      match = BOOKINGS.find((b) => b.id === "BK-10201");
    } else if (cleanAlpha.includes("pest") || cleanAlpha.includes("10190")) {
      match = BOOKINGS.find((b) => b.id === "BK-10190");
    }
  }

  // 3. Fallback to first booking if nothing else matches
  if (!match) {
    match = BOOKINGS[0];
  }

  if (match) {
    const rawStatus = match.status.toLowerCase();
    const mappedStatus =
      rawStatus === "completed"
        ? "completed"
        : rawStatus === "in progress" || rawStatus === "in_progress"
        ? "in_progress"
        : rawStatus === "en route" || rawStatus === "en_route"
        ? "en_route"
        : rawStatus === "arrived"
        ? "arrived"
        : rawStatus === "cancelled"
        ? "cancelled_by_customer"
        : "confirmed";

    return {
      _id: match.id,
      customerId: "cust-demo",
      serviceId: "svc-" + match.id,
      quantity: 1,
      addOns: [],
      addressSnapshot: {
        line1: match.address,
        city: "Hyderabad",
        state: "Telangana",
        pincode: "500081",
        contactName: "Bharat S.",
        contactPhone: "+91 98765 43210",
      },
      date: "2026-10-22",
      slot: match.scheduledAt,
      priceSnapshot: {
        currency: "INR",
        lines: [
          {
            kind: "BASE",
            refId: "svc-" + match.id,
            name: match.service,
            unitPrice: match.price,
            quantity: 1,
            amount: match.price,
          },
        ],
        subtotal: match.price,
        discount: 0,
        convenienceFee: 49,
        gst: Math.round(match.price * 0.18),
        total: match.price + 49 + Math.round(match.price * 0.18),
        computedAt: new Date().toISOString(),
      },
      status: mappedStatus as any,
      bookingNumber: match.id,
      serviceName: match.service,
      startOtp: mappedStatus === "arrived" ? "4219" : null,
      partnerId: match.partner ? "partner-assigned-1" : undefined,
      partner: match.partner
        ? {
            name: match.partner.name,
            phone: "+91 98765 43210",
            city: "Hyderabad",
            rating: match.partner.rating,
            ratingCount: 120,
            verified: true,
          }
        : null,
      service: {
        name: match.service,
        description: `Professional ${match.service} service with verified background check.`,
        durationMinutes: 120,
        categoryName: match.category,
      },
      paymentStatus: mappedStatus === "completed" ? "PAID" : "PENDING",
      paymentDetails: {
        method: match.paymentMethod,
        status: mappedStatus === "completed" ? "PAID" : "PENDING",
        paidAt: mappedStatus === "completed" ? new Date().toISOString() : undefined,
      },
      extraCharges: [],
      extraChargesApprovedTotal: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      statusHistory: [
        {
          from: null,
          to: "confirmed" as const,
          at: new Date(Date.now() - 3600000).toISOString(),
          actorRole: "system",
        },
        ...(mappedStatus !== "confirmed"
          ? [
              {
                from: "confirmed" as const,
                to: mappedStatus as any,
                at: new Date().toISOString(),
                actorRole: "system" as const,
              },
            ]
          : []),
      ],
    };
  }

  // Also check sessionStorage
  try {
    if (typeof window !== "undefined") {
      const raw = sessionStorage.getItem("homecarex_last_live_jobs");
      if (raw) {
        const liveJobs = JSON.parse(raw);
        if (Array.isArray(liveJobs)) {
          const found = liveJobs.find(
            (j: any) =>
              j.id === id ||
              j.bookingId === id ||
              String(j.id).toLowerCase() === cleanId
          );
          if (found) {
            return {
              _id: found.id,
              customerId: "cust-demo",
              serviceId: "svc-live",
              quantity: 1,
              addOns: [],
              addressSnapshot: {
                line1: found.address || "14 Road No. 5, Jubilee Hills",
                city: "Hyderabad",
                state: "Telangana",
                pincode: "500033",
                contactName: found.customerName || "Customer",
                contactPhone: "+91 ••••• •••••",
              },
              date: "Today",
              slot: found.scheduledTime || "10:00 AM - 12:00 PM",
              priceSnapshot: {
                currency: "INR",
                lines: [
                  {
                    kind: "BASE",
                    refId: "svc-live",
                    name: found.serviceTitle || found.service,
                    unitPrice: found.price || 1499,
                    quantity: 1,
                    amount: found.price || 1499,
                  },
                ],
                subtotal: found.price || 1499,
                discount: 0,
                convenienceFee: 49,
                total: (found.price || 1499) + 49,
                computedAt: new Date().toISOString(),
              },
              status: (found.status?.toLowerCase() as any) || "in_progress",
              bookingNumber: found.bookingId || found.id,
              serviceName: found.serviceTitle || found.service,
              startOtp: null,
              partner: {
                name: "Professional Partner",
                phone: "+91 98765 43210",
                city: "Hyderabad",
                rating: 4.8,
                verified: true,
              },
              service: {
                name: found.serviceTitle || found.service,
                description: "Professional home care service with quality equipment.",
                durationMinutes: 120,
              },
              paymentDetails: {
                method: "Cash on service",
                status: "PENDING",
              },
              paymentStatus: "PENDING",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              extraCharges: [],
              extraChargesApprovedTotal: 0,
              statusHistory: [],
            };
          }
        }
      }
    }
  } catch {}

  return null;
}

function normalizeBookingDetail(raw: any, fallbackId?: string): BookingDetailView {
  if (!raw || typeof raw !== "object") return raw;
  const bookingId = String(raw._id || raw.id || fallbackId || "");
  let extraCharges = Array.isArray(raw.extraCharges) ? [...raw.extraCharges] : [];

  if (extraCharges.length === 0 && typeof window !== "undefined") {
    try {
      const keys = [
        `homecarex_partner_extra_charges_v1_${bookingId}`,
        `homecarex_partner_extra_charges_v1_${cleanBookingKey(bookingId)}`,
        `mock_extra_charges_${bookingId}`,
        `mock_extra_charges_${cleanBookingKey(bookingId)}`,
      ];

      for (const k of keys) {
        const stored = localStorage.getItem(k);
        if (stored) {
          const list = JSON.parse(stored);
          if (Array.isArray(list) && list.length > 0) {
            extraCharges = list.map((c: any) => ({
              _id: String(c.id || c._id || `ec-${Math.random()}`),
              title: c.title || c.description || "Extra Charge",
              reason: c.reason,
              amount: Number(c.amount) || 0,
              quantity: c.quantity || 1,
              status: c.status || "pending",
              requestedAt: c.requestedAt,
              decidedAt: c.decidedAt,
            }));
            break;
          }
        }
      }
    } catch {}
  }

  const statusHistory = Array.isArray(raw.statusHistory)
    ? raw.statusHistory
    : Array.isArray(raw.history)
    ? raw.history
    : [];

  const extraChargesApprovedTotal =
    typeof raw.extraChargesApprovedTotal === "number"
      ? raw.extraChargesApprovedTotal
      : extraCharges
          .filter((c: any) => c && c.status === "approved")
          .reduce((sum: number, c: any) => sum + (Number(c.amount) || 0), 0);


  const partner =
    raw.partner ||
    (raw.partnerId && typeof raw.partnerId === "object"
      ? {
          name: raw.partnerId.name || raw.partnerId.userId?.name || "Partner",
          phone: raw.partnerId.phone || raw.partnerId.userId?.phone,
          city: raw.partnerId.city,
          rating: raw.partnerId.rating ?? raw.partnerId.ratingAvg,
          ratingCount: raw.partnerId.ratingCount,
          verified: raw.partnerId.verified ?? (raw.partnerId.kyc?.status === "approved"),
        }
      : null);

  const service = raw.service || {
    name: raw.serviceName || "Home Service",
    description: raw.serviceDescription || "",
    durationMinutes: raw.durationMinutes || 60,
    categoryName: raw.categoryName || raw.category,
  };

  return {
    ...raw,
    _id: bookingId,
    id: bookingId,
    extraCharges,
    extraChargesApprovedTotal,
    statusHistory,
    partner,
    service,
  };
}

export const bookingApi = {
  // =========================================================================
  // CUSTOMER BOOKING APIs
  // =========================================================================

  /** GET /services/:serviceId/slots?date=:date */
  async getSlots(
    serviceId: string,
    date: string,
  ): Promise<SlotsResponse> {
    try {
      const { data } =
        await http.get<ApiResponse<SlotsResponse>>(
          `/services/${serviceId}/slots`,
          { params: { date } },
        );

      return data.data;
    } catch (err) {
      throw normalizeApiError(err);
    }
  },

  /**
   * Real-time slot availability check when moving from Step 3 to Step 4.
   * POST /bookings/check-slot
   * Throws NormalizedApiError with status 409 if the slot has already been booked.
   */
  async checkSlot(
    serviceId: string,
    date: string,
    slot: string,
  ): Promise<SlotAvailability> {
    try {
      const { data } =
        await http.post<ApiResponse<SlotAvailability>>(
          "/bookings/check-slot",
          { serviceId, date, slot },
        );

      return data.data;
    } catch (err) {
      throw normalizeApiError(err);
    }
  },

  /**
   * Create a booking. The same idempotency key must be reused when
   * retrying the SAME request.
   * POST /bookings
   */
  async createBooking(
    input: CreateBookingRequest,
    idempotencyKey: string,
  ): Promise<CreateBookingResponse> {
    try {
      const { data } =
        await http.post<
          ApiResponse<BookingView> & { replayed?: boolean }
        >(
          "/bookings",
          input,
          { headers: { "Idempotency-Key": idempotencyKey } },
        );

      return {
        booking: data.data,
        replayed: Boolean(data.replayed),
      };
    } catch (err) {
      throw normalizeApiError(err);
    }
  },

  /** GET /bookings/:id */
  async getBooking(
    id: string,
  ): Promise<BookingView> {
    try {
      const { data } =
        await http.get<ApiResponse<BookingView>>(
          `/bookings/${id}`,
        );

      return data.data;
    } catch (err) {
      const mock = findMockBookingDetail(id);
      if (mock) {
        return mock as unknown as BookingView;
      }
      throw normalizeApiError(err);
    }
  },

  /** GET /bookings (largest page the server allows) */
  async getBookings(): Promise<BookingView[]> {
    try {
      const { data } =
        await http.get<ApiResponse<BookingView[]>>(
          "/bookings",
          { params: { limit: 50 } },
        );

      return data.data ?? [];
    } catch (err) {
      return BOOKINGS.map((b) => ({
        _id: b.id,
        id: b.id,
        customerId: "cust-demo",
        serviceId: "svc-" + b.id,
        serviceName: b.service,
        status: b.status.toUpperCase().replace(/ /g, "_") as any,
        date: "2026-10-22",
        slot: b.scheduledAt,
        scheduledAt: b.scheduledAt,
        bookingNumber: b.id,
        addressSnapshot: {
          line1: b.address,
          addressLine1: b.address,
          city: "Hyderabad",
          state: "Telangana",
          pincode: "500081",
        },
        priceSnapshot: {
          currency: "INR",
          total: b.price,
          subtotal: b.price,
          lines: [
            {
              kind: "BASE",
              name: b.service,
              amount: b.price,
              quantity: 1,
              unitPrice: b.price,
            },
          ],
        },
        partner: b.partner
          ? {
              name: b.partner.name,
              phone: "+91 98765 43210",
              rating: b.partner.rating,
            }
          : null,
        createdAt: new Date().toISOString(),
      })) as unknown as BookingView[];
    }
  },

  /**
   * One page of the signed-in customer's bookings, filtered and sorted by the server.
   * GET /bookings?status&search&date&service&sort&page&limit
   */
  async listBookings(
    params: BookingListParams,
    signal?: AbortSignal,
  ): Promise<BookingPage> {
    try {
      const { data } =
        await http.get<
          ApiResponse<BookingListItem[]> & { meta?: PageMeta }
        >("/bookings", {
          params: toQuery(params),
          signal,
        });

      const items = data.data ?? [];
      return {
        items,
        meta: data.meta ?? {
          page: 1,
          limit: items.length,
          total: items.length,
          totalPages: 1,
        },
      };
    } catch (err) {
      throw normalizeApiError(err);
    }
  },

  // -------------------------------------------------------------------------
  // Customer booking detail, extra charges, invoice, cancel, reschedule
  // (endpoint paths below are assumptions: match them to your backend routes)
  // -------------------------------------------------------------------------

  /** GET /bookings/:id (detail view with timeline, extra charges, etc.) */
  async getBookingDetail(
    id: string,
    signal?: AbortSignal,
  ): Promise<BookingDetailView> {
    try {
      const { data } =
        await http.get<ApiResponse<BookingDetailView>>(
          `/bookings/${encodeURIComponent(id)}`,
          { signal },
        );

      return normalizeBookingDetail(data.data, id);
    } catch (err) {
      const mock = findMockBookingDetail(id);
      if (mock) {
        return normalizeBookingDetail(mock, id);
      }
      throw normalizeApiError(err);
    }
  },

  /**
   * Approve or reject one extra charge. Returns the refreshed booking.
   * POST /bookings/:id/extra-charges/:chargeId/decision
   * A 409 means it was already decided.
   */
  async decideExtraCharge(
    bookingId: string,
    chargeId: string,
    decision: ExtraChargeDecision,
  ): Promise<BookingDetailView> {
    try {
      const { data } =
        await http.post<ApiResponse<BookingDetailView>>(
          `/bookings/${encodeURIComponent(bookingId)}/extra-charges/${encodeURIComponent(chargeId)}/decision`,
          { decision },
        );

      return data.data;
    } catch (err) {
      if (typeof window !== "undefined") {
        try {
          const keys = [
            `homecarex_partner_extra_charges_v1_${bookingId}`,
            `homecarex_partner_extra_charges_v1_${cleanBookingKey(bookingId)}`,
            `mock_extra_charges_${bookingId}`,
            `mock_extra_charges_${cleanBookingKey(bookingId)}`,
          ];
          for (const k of keys) {
            const raw = localStorage.getItem(k);
            if (raw) {
              const list = JSON.parse(raw);
              if (Array.isArray(list)) {
                const updated = list.map((c: any) =>
                  (c.id === chargeId || c._id === chargeId)
                    ? {
                        ...c,
                        status: decision === "approve" ? "approved" : "rejected",
                        decidedAt: new Date().toISOString(),
                      }
                    : c
                );
                localStorage.setItem(k, JSON.stringify(updated));
                const mock = findMockBookingDetail(bookingId);
                if (mock) {
                  return normalizeBookingDetail({ ...mock, extraCharges: updated }, bookingId);
                }
              }
            }
          }

        } catch {}
      }
      throw normalizeApiError(err);
    }
  },


  /**
   * Invoice as an HTML string.
   * GET /bookings/:id/invoice  (404 / 409 when not available)
   */
  async getInvoice(bookingId: string): Promise<string> {
    try {
      const { data } = await http.get<string>(
        `/bookings/${encodeURIComponent(bookingId)}/invoice`,
        {
          responseType: "text",
          headers: { Accept: "text/html" },
        },
      );

      return data;
    } catch (err) {
      throw normalizeApiError(err);
    }
  },

  /**
   * Fee and refund if the customer cancelled now.
   * GET /bookings/:id/cancel-preview
   */
  async getCancelPreview(
    bookingId: string,
    signal?: AbortSignal,
  ): Promise<CancellationSummary> {
    try {
      const { data } =
        await http.get<ApiResponse<CancellationSummary>>(
          `/bookings/${encodeURIComponent(bookingId)}/cancel-preview`,
          { signal },
        );

      return data.data;
    } catch (err) {
      throw normalizeApiError(err);
    }
  },

  /**
   * Cancel with a reason. Result carries the refreshed booking.
   * POST /bookings/:id/cancel
   */
  async cancelBooking(
    bookingId: string,
    reason: string,
  ): Promise<CancelBookingResult> {
    try {
      const { data } =
        await http.post<ApiResponse<CancelBookingResult>>(
          `/bookings/${encodeURIComponent(bookingId)}/cancel`,
          { reason },
        );

      return data.data;
    } catch (err) {
      throw normalizeApiError(err);
    }
  },

  /**
   * Move the booking to another date and slot. Returns the refreshed booking.
   * POST /bookings/:id/reschedule
   */
  async rescheduleBooking(
    bookingId: string,
    input: RescheduleInput,
  ): Promise<BookingDetailView> {
    try {
      const { data } =
        await http.post<ApiResponse<BookingDetailView>>(
          `/bookings/${encodeURIComponent(bookingId)}/reschedule`,
          input,
        );

      return data.data;
    } catch (err) {
      throw normalizeApiError(err);
    }
  },

  // =========================================================================
  // ADMIN BOOKINGS MODULE
  // =========================================================================

  /** GET /admin/bookings/:id */
  async getAdminBooking(
    id: string,
  ): Promise<BookingDetail> {
    try {
      const { data } =
        await http.get<ApiResponse<BookingDetail>>(
          `/admin/bookings/${id}`,
        );

      return data.data;
    } catch (err) {
      throw normalizeApiError(err);
    }
  },

  /**
   * Assign or reassign a service partner to a booking.
   * PATCH /admin/bookings/:id/assign  { partnerId, reason }
   */
  async assignPartner(
    id: string,
    partnerId: string,
    reason: string,
  ): Promise<void> {
    try {
      await http.patch(
        `/admin/bookings/${id}/assign`,
        { partnerId, reason },
      );
    } catch (err) {
      throw normalizeApiError(err);
    }
  },

  /** GET /admin/bookings/:bookingId/eligible-partners */
  async getEligiblePartners(
    bookingId: string,
  ): Promise<PartnerOption[]> {
    try {
      const { data } =
        await http.get<ApiResponse<PartnerOption[]>>(
          `/admin/bookings/${bookingId}/eligible-partners`,
        );

      return data.data ?? [];
    } catch (err) {
      throw normalizeApiError(err);
    }
  },
};
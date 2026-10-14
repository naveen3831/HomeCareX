import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchServiceDetail } from "@/services/catalogApi";
import { customerPath } from "@/routes/customerPath";
import type { AddressSnapshot } from "@/types/booking";
import type { BookingDetailView } from "@/types/bookingDetail";
import type { ServiceDetail } from "@/types/catalog";
import { useBookingDraftStore, type BookingAddOn } from "./draftStore";

/** Backend rejects quantity > 20 (bookings.validation.ts), same cap as Step 1. */
const MAX_QUANTITY = 20;

/** What a repeat booking starts from. Built from the CURRENT catalog, never from the old booking's prices. */
export interface BookAgainPlan {
  serviceId: string;
  serviceSlug: string;
  serviceName: string;
  basePrice: number;
  quantity: number;
  addOns: BookingAddOn[];
  /** The saved address the old booking used, if it still came from one. Null means the customer picks again. */
  address: { id: string; snapshot: AddressSnapshot } | null;
  /** Add-ons the old booking had that the service no longer offers. */
  droppedAddOns: number;
}

type PreviousBooking = Pick<
  BookingDetailView,
  "quantity" | "addOns" | "addressSnapshot"
>;

/**
 * Pure: turns a previous booking plus the service as it is today into the draft for a new booking.
 * Prices and ids come from the catalog (the booking API validates them against the database), so an
 * add-on that was removed is dropped instead of being sent and rejected with ADDON_NOT_FOUND.
 * Date, slot and coupon are deliberately NOT copied: they belong to the old visit.
 */
export function planBookAgain(
  previous: PreviousBooking,
  service: ServiceDetail,
): BookAgainPlan {
  const offered = new Map(service.addOns.map((a) => [a.id, a]));
  const wanted = Array.isArray(previous.addOns) ? previous.addOns : [];

  const addOns: BookingAddOn[] = [];
  let droppedAddOns = 0;
  for (const old of wanted) {
    const current = offered.get(old.addOnId);
    if (!current) {
      droppedAddOns += 1;
      continue;
    }
    addOns.push({
      id: current.id,
      quantity: Math.max(1, old.quantity || 1),
      price: current.price,
      name: current.name,
    });
  }

  const snapshot = previous.addressSnapshot;
  const sourceId = snapshot?.sourceAddressId;

  return {
    serviceId: service.id,
    serviceSlug: service.slug,
    serviceName: service.name,
    basePrice: service.basePrice,
    quantity: Math.min(MAX_QUANTITY, Math.max(1, previous.quantity || 1)),
    addOns,
    address: snapshot && sourceId ? { id: sourceId, snapshot } : null,
    droppedAddOns,
  };
}

export interface UseBookAgainResult {
  start: () => Promise<void>;
  isLoading: boolean;
  error: string;
}

/**
 * Book Again: loads the service as it is now, replaces the booking draft with a fresh one built from the
 * previous booking, and opens the wizard at Step 2 (address). Step 1's choices are already filled in.
 */
export function useBookAgain(booking: BookingDetailView): UseBookAgainResult {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const start = useCallback(async () => {
    if (isLoading) return;
    setError("");
    if (!booking.serviceId) {
      setError("This service can't be booked again from here.");
      return;
    }
    setIsLoading(true);
    try {
      // GET /services/:idOrSlug accepts the id the old booking stored.
      const service = await fetchServiceDetail(booking.serviceId);
      const plan = planBookAgain(booking, service);

      const draft = useBookingDraftStore.getState();
      // clearDraft also drops the saved Idempotency-Key, so the new booking can never replay the old one.
      draft.clearDraft();
      draft.setServiceDetails(
        plan.serviceId,
        plan.serviceSlug,
        plan.basePrice,
        plan.quantity,
        plan.addOns,
        plan.serviceName,
      );
      if (plan.address)
        draft.setAddress(plan.address.id, plan.address.snapshot);
      if (plan.droppedAddOns > 0) {
        draft.setNotice(
          plan.droppedAddOns === 1
            ? "One add-on from your earlier booking is no longer offered, so it was left out."
            : `${plan.droppedAddOns} add-ons from your earlier booking are no longer offered, so they were left out.`,
        );
      }
      draft.setStep(2);

      navigate(`${customerPath(`/book/${plan.serviceSlug}`)}?step=2`);
    } catch (err) {
      const status =
        typeof err === "object" && err !== null && "status" in err
          ? (err as { status?: number }).status
          : undefined;
      setError(
        status === 404
          ? "This service is no longer available."
          : "We couldn't start a new booking. Please check your connection and try again.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [booking, isLoading, navigate]);

  return { start, isLoading, error };
}

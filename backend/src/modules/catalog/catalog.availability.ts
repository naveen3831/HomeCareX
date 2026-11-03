
import { BookingService } from "../bookings/bookings.service";
import { addDays, nowInBookingTz } from "../bookings/bookings.time";
import type { SlotAvailabilityDto } from "./catalog.types";

/**
 * Number of days checked, including today.
 */
export const AVAILABILITY_WINDOW_DAYS = 7;

/**
 * Slot lookup abstraction.
 *
 * Tests can replace getDaySlots to mock availability responses.
 */
export const slotSource = {
  getDaySlots: (serviceId: string, date: string) =>
    BookingService.getAvailableSlots(serviceId, date),
};

/**
 * Checks availability for today and the following six days.
 *
 * Returns:
 * - hasSlots: true when an available slot is found.
 * - hasSlots: false when no available slots exist in the window.
 * - hasSlots: null when availability could not be checked.
 *
 * Stops at the first date with an available slot.
 */
export async function summarizeAvailability(
  serviceId: string,
  today: string = nowInBookingTz().date,
): Promise<SlotAvailabilityDto> {
  try {
    for (
      let offset = 0;
      offset < AVAILABILITY_WINDOW_DAYS;
      offset += 1
    ) {
      const date = addDays(today, offset);
      const day = await slotSource.getDaySlots(serviceId, date);

      if (day.slots.some((slot) => slot.available)) {
        return {
          windowDays: AVAILABILITY_WINDOW_DAYS,
          hasSlots: true,
          nextAvailableDate: date,
        };
      }
    }

    return {
      windowDays: AVAILABILITY_WINDOW_DAYS,
      hasSlots: false,
      nextAvailableDate: null,
    };
  } catch (error: unknown) {
    console.error(
      `Slot availability lookup failed for service ${serviceId}:`,
      error,
    );

    return {
      windowDays: AVAILABILITY_WINDOW_DAYS,
      hasSlots: null,
      nextAvailableDate: null,
    };
  }
}

import { getSetting } from '../settings';
import { SLOT_CAPACITY } from './bookings.constants';

/**
 * Booking-related Settings. Slot capacity comes from the admin Settings page (`slots.capacityPerSlot`), so changing
 * it there changes the slots customers see (GET /services/:id/slots) and how many bookings a slot accepts.
 * getSetting() caches for 30s, and the admin save clears the cache, so the change shows up at once.
 */
export const bookingSettings = {
  async getSlotCapacity(_serviceId: string): Promise<number> {
    const fromSettings = Number(await getSetting('slots.capacityPerSlot'));
    if (Number.isInteger(fromSettings) && fromSettings > 0) return fromSettings;
    // Setting missing or corrupt: fall back to the env var, then the constant.
    const fromEnv = Number.parseInt(process.env.SLOT_CAPACITY ?? '', 10);
    return Number.isInteger(fromEnv) && fromEnv > 0 ? fromEnv : SLOT_CAPACITY;
  },

  /**
   * Whether a booking must be paid before it is CONFIRMED.
   * false (default, until the Payments module is wired to Step 4): the booking is CONFIRMED on submit.
   * true: it is created PENDING_PAYMENT and holds its seat for BOOKING_HOLD_MS.
   */
  async isPaymentRequired(): Promise<boolean> {
    return process.env.BOOKING_REQUIRE_PAYMENT === 'true';
  },

  async getCancellationPolicy(): Promise<{ windowHours: number; feeAmount: number }> {
    return { windowHours: 4, feeAmount: 99 };
  },
};

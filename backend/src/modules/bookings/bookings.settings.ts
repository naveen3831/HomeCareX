import { getSetting } from '../settings';

import { SLOT_CAPACITY } from './bookings.constants';


export interface CancellationPolicy {
  windowHours: number;
  feeAmount: number;
}

/**
 * Booking-related settings.
 * Slot capacity comes from the admin Settings page.
 */
export const bookingSettings = {
  async getSlotCapacity(_serviceId: string): Promise<number> {
    const fromSettings = Number(
      await getSetting("slots.capacityPerSlot"),
    );

    if (Number.isInteger(fromSettings) && fromSettings > 0) {
      return fromSettings;
    }

    const fromEnv = Number.parseInt(
      process.env.SLOT_CAPACITY ?? "",
      10,
    );

    return Number.isInteger(fromEnv) && fromEnv > 0
      ? fromEnv
      : SLOT_CAPACITY;
  },

  async isPaymentRequired(): Promise<boolean> {
    return process.env.BOOKING_REQUIRE_PAYMENT === "true";
  },

  async getCancellationPolicy(): Promise<CancellationPolicy> {
    return {
      windowHours: 4,
      feeAmount: 99,
    };
  },
};

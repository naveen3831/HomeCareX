
import { SLOT_CAPACITY } from './bookings.constants';
import { getSetting } from '../settings/settings.service';

export interface CancellationPolicy {
  windowHours: number;
  feeAmount: number;
}

/**
 * Booking-related settings.
 * Capacity and payment requirements retain their existing behavior.
 * Cancellation policy values are read from the central settings service.
 */
export const bookingSettings = {
  async getSlotCapacity(_serviceId: string): Promise<number> {
    const fromEnv = Number.parseInt(process.env.SLOT_CAPACITY ?? '', 10);

    return Number.isInteger(fromEnv) && fromEnv > 0
      ? fromEnv
      : SLOT_CAPACITY;
  },

  async isPaymentRequired(): Promise<boolean> {
    return process.env.BOOKING_REQUIRE_PAYMENT === 'true';
  },

  async getCancellationPolicy(): Promise<CancellationPolicy> {
    const [windowHours, feeAmount] = await Promise.all([
      getSetting('cancellation.windowHours'),
      getSetting('cancellation.feeAmount'),
    ]);

    return {
      windowHours,
      feeAmount,
    };
  },
};

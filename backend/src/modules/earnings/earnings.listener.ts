
import { EVENTS, eventBus } from "../events/eventBus";
import { earningsService } from "./earnings.service";
import { settleEarningForBooking } from "./earnings.settle";

let registered = false;

export function registerEarningsListeners(): void {
  if (registered) return;

  registered = true;
  console.log("[earnings] Registering JOB_COMPLETED listener");

  eventBus.on(EVENTS.JOB_COMPLETED, async (payload) => {
    console.log("[earnings] JOB_COMPLETED event received:", payload);

    try {
      const result = await earningsService.recordJobCompleted(payload);

      console.log(
        `[earnings] Booking ${payload.bookingId}: ${
          result.created ? "earning created" : "earning already exists"
        }`,
      );

      // Service is done: pay the partner's share and the platform commission right away (online-paid jobs).
      const settled = await settleEarningForBooking(payload.bookingId);

      console.log(
        `[earnings] Booking ${payload.bookingId}: ${
          settled.settled ? "credited to partner + admin wallets" : `not auto-credited (${settled.reason})`
        }`,
      );
    } catch (error) {
      console.error(
        `[earnings] Failed to record earning for booking ${payload.bookingId}:`,
        error,
      );
    }
  });
}


import { EVENTS, eventBus } from "../events/eventBus";
import { earningsService } from "./earnings.service";

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
    } catch (error) {
      console.error(
        `[earnings] Failed to record earning for booking ${payload.bookingId}:`,
        error,
      );
    }
  });
}

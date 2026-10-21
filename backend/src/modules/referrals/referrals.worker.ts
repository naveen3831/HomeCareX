import { referralsService } from "./referrals.service";

/** Reconciles stored bookings too, including status updates that do not emit an event. */
export function startReferralWorker(onError: (error: unknown) => void) {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await referralsService.reconcile();
    } catch (error) {
      onError(error);
    } finally {
      running = false;
    }
  };
  const timer = setInterval(() => void tick(), 60_000);
  timer.unref();
  void tick();
  return () => clearInterval(timer);
}

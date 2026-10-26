import { TicketModel } from '../../models/Ticket';
import { alertSlaBreach } from '../notifications/admin-alerts';
import { slaClause, ticketRefOf } from './admin-tickets.service';

const BATCH = 200;

/**
 * Finds active tickets that are now past their SLA target and tells the admins once per ticket.
 * Uses the same boundary as the queue's "breached" filter (slaClause). Each ticket is claimed with an atomic
 * update on `slaBreachNotifiedAt: null`, so two servers (or two overlapping runs) can never alert twice.
 * Returns how many tickets were announced.
 */
export async function sweepSlaBreaches(now: Date = new Date()): Promise<number> {
  const due = await TicketModel.find({ ...slaClause('breached', now), slaBreachNotifiedAt: null })
    .select('_id priority')
    .limit(BATCH)
    .lean();

  let announced = 0;
  for (const t of due) {
    const claimed = await TicketModel.updateOne({ _id: t._id, slaBreachNotifiedAt: null }, { $set: { slaBreachNotifiedAt: now } });
    if (claimed.modifiedCount !== 1) continue; // someone else got it
    alertSlaBreach({ ticketId: String(t._id), ticketRef: ticketRefOf(t._id), priority: String(t.priority ?? 'normal') });
    announced += 1;
  }
  return announced;
}

/** Runs the sweep now and then every `everyMs`. Returns a stop function. Errors are logged, never thrown. */
export function startSlaSweep(everyMs = 5 * 60_000): () => void {
  const run = () => sweepSlaBreaches().catch((err) => console.error('[sla-sweep] failed; will retry', err instanceof Error ? err.message : err));
  void run();
  const timer = setInterval(run, everyMs);
  timer.unref();
  return () => clearInterval(timer);
}

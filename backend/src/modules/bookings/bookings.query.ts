import { Types, type FilterQuery } from 'mongoose';
import { z } from 'zod';
import type { IBooking } from '../../models/Booking';
import { BOOKING_STATUSES, SERVICE_SLOTS, type BookingStatus } from './bookings.constants';
import { nowInBookingTz } from './bookings.time';

/* ------------------------------------------------------------------ */
/* Tabs: one place that says which statuses belong to which tab        */
/* ------------------------------------------------------------------ */

export const BOOKING_TABS = ['upcoming', 'live', 'overdue', 'completed', 'cancelled'] as const;
export type BookingTab = (typeof BOOKING_TABS)[number];

/** Upcoming and Overdue share pre-service statuses; the schedule separates those two views. */
export const TAB_STATUSES: Record<BookingTab, readonly BookingStatus[]> = {
  upcoming: ['pending_payment', 'confirmed', 'created', 'searching_for_partner', 'assigned'],
  live: ['en_route', 'arrived', 'in_progress'],
  overdue: ['pending_payment', 'confirmed', 'created', 'searching_for_partner', 'assigned'],
  completed: ['completed', 'rated', 'disputed'],
  cancelled: ['cancelled_by_customer', 'cancelled_by_partner', 'cancelled_by_admin', 'no_show'],
};

export const BOOKING_SORTS = ['newest', 'oldest', 'date_asc', 'date_desc', 'amount_asc', 'amount_desc'] as const;
export type BookingSort = (typeof BOOKING_SORTS)[number];

/** `_id` is the tie-breaker so pages never repeat or skip a row when the sort key ties. */
export const SORT_SPECS: Record<BookingSort, Record<string, 1 | -1>> = {
  newest: { createdAt: -1, _id: -1 },
  oldest: { createdAt: 1, _id: 1 },
  date_asc: { date: 1, slot: 1, _id: 1 },
  date_desc: { date: -1, slot: -1, _id: -1 },
  amount_asc: { 'priceSnapshot.total': 1, _id: 1 },
  amount_desc: { 'priceSnapshot.total': -1, _id: -1 },
};

export const DEFAULT_LIMIT = 10;
export const MAX_LIMIT = 50;

/* ------------------------------------------------------------------ */
/* Query validation: GET /bookings?status&search&date&service&page&limit&sort */
/* ------------------------------------------------------------------ */

const blankToUndefined = (v: unknown): unknown => (typeof v === 'string' && v.trim() === '' ? undefined : v);

const statusToken = z.enum([...BOOKING_TABS, ...BOOKING_STATUSES], { message: 'Unknown status or tab' });

/** "live" | "completed,cancelled" | "en_route". Tabs and raw statuses can be mixed. */
const statusList = z
  .string()
  .max(300)
  .transform((v) =>
    v
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  )
  .pipe(z.array(statusToken).min(1, 'status must not be empty').max(20));

export const listBookingsQuerySchema = z.object({
  tab: z.preprocess(blankToUndefined, z.enum(BOOKING_TABS).optional()),
  status: z.preprocess(blankToUndefined, statusList.optional()),
  search: z.preprocess(blankToUndefined, z.string().trim().min(1).max(60).optional()),
  date: z.preprocess(
    blankToUndefined,
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD')
      .optional()
  ),
  service: z.preprocess(blankToUndefined, z.string().trim().min(1).max(100).optional()),
  page: z.preprocess(blankToUndefined, z.coerce.number().int().min(1).max(10_000).default(1)),
  limit: z.preprocess(blankToUndefined, z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT)),
  sort: z.preprocess(blankToUndefined, z.enum(BOOKING_SORTS, { message: 'Unknown sort' }).default('newest')),
});

export type ListBookingsQuery = z.output<typeof listBookingsQuerySchema>;

/* ------------------------------------------------------------------ */
/* Filter builder (pure, so it can be unit-tested without a database)   */
/* ------------------------------------------------------------------ */

const escapeRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const isTab = (t: string): t is BookingTab => (BOOKING_TABS as readonly string[]).includes(t);
const isObjectId = (s: string): boolean => /^[0-9a-fA-F]{24}$/.test(s);

/** A passed service window is overdue, never proof that a job was completed. */
export function pastScheduleFilter(now: Date): FilterQuery<IBooking> {
  const { date, minutes } = nowInBookingTz(now);
  const endedSlots = SERVICE_SLOTS.filter((slot) => {
    const [hour, minute] = slot.slice(-5).split(':').map(Number);
    return hour * 60 + minute <= minutes;
  });
  const dayStart = new Date(now.getTime() - minutes * 60_000);
  dayStart.setUTCSeconds(0, 0);

  return {
    $or: [
      { date: { $lt: date, $ne: '' } },
      { date, slot: { $in: endedSlots } },
      // Older partner-created bookings may only have scheduledAt. Do not guess a missing slot duration.
      { $and: [{ $or: [{ date: null }, { date: '' }] }, { scheduledAt: { $lt: dayStart } }] },
    ],
  };
}

/**
 * An unpaid booking whose slot hold ran out is shown as Cancelled, not Upcoming. The customer UI has always
 * classified it that way, so the server does too, otherwise tab counts and pages would disagree with the cards.
 */
function statusConditions(tokens: string[], now: Date): FilterQuery<IBooking>[] {
  const plain = new Set<string>();
  const extra: FilterQuery<IBooking>[] = [];

  for (const token of tokens) {
    if (!isTab(token)) {
      plain.add(token);
      continue;
    }
    if (token === 'upcoming' || token === 'overdue') {
      const eligible: FilterQuery<IBooking> = {
        $or: [
          { status: { $in: TAB_STATUSES.upcoming.filter((s) => s !== 'pending_payment') } },
          { status: 'pending_payment', $or: [{ holdExpiresAt: null }, { holdExpiresAt: { $gt: now } }] },
        ],
      };
      const elapsed = pastScheduleFilter(now);
      extra.push({ $and: [eligible, token === 'overdue' ? elapsed : { $nor: [elapsed] }] });
    } else if (token === 'cancelled') {
      TAB_STATUSES.cancelled.forEach((s) => plain.add(s));
      extra.push({ status: 'pending_payment', holdExpiresAt: { $lte: now } });
    } else {
      TAB_STATUSES[token].forEach((s) => plain.add(s));
    }
  }

  const conditions: FilterQuery<IBooking>[] = [];
  if (plain.size > 0) conditions.push({ status: { $in: [...plain] } });
  return [...conditions, ...extra];
}

/**
 * Always scoped to `customerId`, which comes from the access token and never from the query string.
 * Callers must pass a valid ObjectId string.
 */
export function buildBookingFilter(
  customerId: string,
  q: Pick<ListBookingsQuery, 'tab' | 'status' | 'search' | 'date' | 'service'>,
  now: Date = new Date()
): FilterQuery<IBooking> {
  const and: FilterQuery<IBooking>[] = [];

  // A selected raw status narrows its tab; it must never bypass the schedule boundary.
  if (q.tab) {
    const conditions = statusConditions([q.tab], now);
    and.push(conditions.length === 1 ? conditions[0] : { $or: conditions });
  }

  if (q.status) {
    const conditions = statusConditions(q.status, now);
    and.push(conditions.length === 1 ? conditions[0] : { $or: conditions });
  }

  if (q.date) and.push({ date: q.date });

  if (q.service) {
    and.push(
      isObjectId(q.service)
        ? { serviceId: new Types.ObjectId(q.service) }
        : { serviceName: { $regex: escapeRegex(q.service), $options: 'i' } }
    );
  }

  if (q.search) {
    const term = q.search.trim();
    const code = term.replace(/^bk-?/i, ''); // cards show the id as "BK-" + its last 5 characters
    const or: FilterQuery<IBooking>[] = [{ serviceName: { $regex: escapeRegex(term), $options: 'i' } }];
    if (code.length >= 4 && /^[0-9a-f]+$/i.test(code) && code.length <= 24) {
      or.push({
        $expr: { $regexMatch: { input: { $toString: '$_id' }, regex: `${code}$`, options: 'i' } },
      });
    }
    and.push({ $or: or });
  }

  const filter: FilterQuery<IBooking> = { customerId: new Types.ObjectId(customerId) };
  if (and.length > 0) filter.$and = and;
  return filter;
}

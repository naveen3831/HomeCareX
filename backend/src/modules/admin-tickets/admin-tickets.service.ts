import { Types, type FilterQuery } from 'mongoose';
import { ERROR_CODES } from '../../constants/errorCodes';
import type { Ticket } from '../../models/Ticket';
import { Errors } from '../../utils/errors';
import { bookingRefOf } from '../admin-payments/admin-payments.service';
import { auditService } from '../audit/audit.service';
import { emitTicketMessage, emitTicketUpdated, type LiveTicketMessage } from '../../sockets/ticket.socket';
import { TICKET_PRIORITIES, type TicketPriority, type TicketStatus } from '../tickets/tickets.constants';
import {
  ACTIVE_STATUSES,
  AUDIT_ACTION,
  AUDIT_ENTITY,
  FILTER_UTC_OFFSET,
  SLA_AT_RISK_RATIO,
  SLA_TARGET_HOURS,
  type SlaState,
} from './admin-tickets.constants';
import {
  adminTicketsRepository as repo,
  escapeRegex,
  type BookingLean,
  type TicketLean,
  type TicketMessageLean,
  type UserLean,
} from './admin-tickets.repository';
import type {
  AdminTicketDetailDto,
  AdminTicketDto,
  AdminTicketMessageDto,
  AssignableAgentDto,
  AdminTicketsQuery,
  AdminTicketsResult,
  TicketBookingContextDto,
  TicketPersonDto,
  TicketSlaDto,
} from './admin-tickets.types';
import { isObjectIdString } from './admin-tickets.validation';

const HOUR_MS = 3_600_000;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const startOf = (v: string): Date => new Date(DATE_ONLY.test(v) ? `${v}T00:00:00.000${FILTER_UTC_OFFSET}` : v);
const endOf = (v: string): Date => new Date(DATE_ONLY.test(v) ? `${v}T23:59:59.999${FILTER_UTC_OFFSET}` : v);

export const ticketRefOf = (id: unknown): string => `TCK-${String(id).slice(-6).toUpperCase()}`;
const iso = (d: Date): string => new Date(d).toISOString();

/* ------------------------------ SLA (derived) ------------------------------ */

const targetMs = (priority: TicketPriority): number => SLA_TARGET_HOURS[priority] * HOUR_MS;

/** Used for the response. The Mongo clauses in `slaClause` express exactly the same boundaries. */
export function computeSla(t: Pick<TicketLean, 'status' | 'priority' | 'createdAt'>, now: Date): TicketSlaDto | null {
  if (!(ACTIVE_STATUSES as readonly string[]).includes(t.status)) return null;
  const priority = (t.priority ?? 'normal') as TicketPriority;
  const target = targetMs(priority);
  const elapsed = now.getTime() - new Date(t.createdAt).getTime();
  const state: SlaState = elapsed >= target ? 'breached' : elapsed >= target * SLA_AT_RISK_RATIO ? 'at_risk' : 'ok';
  return {
    state,
    dueAt: new Date(new Date(t.createdAt).getTime() + target).toISOString(),
    targetHours: SLA_TARGET_HOURS[priority],
  };
}

/** Active tickets whose age, relative to their own priority's target, puts them in `state`. */
function slaClause(state: SlaState, now: Date): FilterQuery<Ticket> {
  const ageLimit = (ms: number) => new Date(now.getTime() - ms);
  const perPriority = TICKET_PRIORITIES.map((priority): FilterQuery<Ticket> => {
    const target = targetMs(priority);
    const breachedAt = ageLimit(target); // createdAt <= this  => elapsed >= target
    const atRiskAt = ageLimit(target * SLA_AT_RISK_RATIO); // createdAt <= this => elapsed >= 75% of target
    if (state === 'breached') return { priority, createdAt: { $lte: breachedAt } };
    if (state === 'at_risk') return { priority, createdAt: { $gt: breachedAt, $lte: atRiskAt } };
    return { priority, createdAt: { $gt: atRiskAt } };
  });
  return { status: { $in: [...ACTIVE_STATUSES] }, $or: perPriority };
}

/* -------------------------------- filtering -------------------------------- */

export interface FilterContext {
  now: Date;
  /** The calling admin, for `assignee=me`. */
  actorId: string;
  /** Resolved up front when `requester` is free text; [] means nobody matched. */
  requesterIds?: Types.ObjectId[];
  /** Resolved up front for `search`: users whose name / email / phone contains the term. */
  searchUserIds?: Types.ObjectId[];
}

const TICKET_REF = /^TCK-/i;
const BOOKING_REF = /^BK-/i;
const HEX = /^[a-f0-9]+$/i;
/** A bare hex-looking word ("decade", "face") is only treated as a possible id fragment from this length up. */
const MIN_BARE_HEX = 4;

/** `_id` / `bookingId` as MongoDB sees them: an ObjectId's 24-char hex, matched by its tail. */
const idTail = (field: string, hex: string): FilterQuery<Ticket> =>
  ({ $expr: { $regexMatch: { input: { $toString: field }, regex: `${hex}$`, options: 'i' } } }) as FilterQuery<Ticket>;

/**
 * Single search box -> OR of every place the term could mean something. Never either/or: a plain word that
 * happens to be valid hex ("decade", "face") must still find the subject or requester it names, and an id
 * fragment must still find the ticket or booking it belongs to.
 */
export function buildSearchClause(term: string, searchUserIds: Types.ObjectId[] = []): FilterQuery<Ticket> {
  const or: FilterQuery<Ticket>[] = [{ subject: { $regex: escapeRegex(term), $options: 'i' } }];

  if (isObjectIdString(term)) {
    const id = new Types.ObjectId(term);
    or.push({ _id: id }, { bookingId: id }, { createdBy: id });
  } else {
    const tck = TICKET_REF.test(term);
    const bk = BOOKING_REF.test(term);
    const hex = term.replace(TICKET_REF, '').replace(BOOKING_REF, '');
    const looksHex = HEX.test(hex) && hex.length <= 24;
    // TCK-XXXXXX is the last 6 chars of the id, BK-XXXXX the last 5 of the booking id.
    if (looksHex && (tck || !bk) && hex.length <= 6 && (tck || hex.length >= MIN_BARE_HEX)) or.push(idTail('$_id', hex));
    if (looksHex && (bk || !tck) && hex.length <= 5 && (bk || hex.length >= MIN_BARE_HEX)) or.push(idTail('$bookingId', hex));
    if (searchUserIds.length) or.push({ createdBy: { $in: searchUserIds } });
  }
  return { $or: or };
}

/**
 * Pure: query -> Mongo filter. Returns null when the filters can never match (so the caller can skip the query).
 * Customer and partner tickets are deliberately NOT scoped apart: it is one queue, `requesterRole` only narrows it.
 */
export function buildTicketFilter(q: AdminTicketsQuery, ctx: FilterContext): FilterQuery<Ticket> | null {
  const and: FilterQuery<Ticket>[] = [];

  if (q.status?.length) and.push({ status: { $in: q.status } });
  if (q.priority?.length) and.push({ priority: { $in: q.priority } });
  if (q.category?.length) and.push({ category: { $in: q.category } });
  if (q.requesterRole) and.push({ createdByRole: q.requesterRole });

  if (q.assignee) {
    if (q.assignee === 'unassigned') and.push({ assignedTo: null });
    else and.push({ assignedTo: new Types.ObjectId(q.assignee === 'me' ? ctx.actorId : q.assignee) });
  }

  if (q.requester) {
    if (isObjectIdString(q.requester)) {
      and.push({ createdBy: new Types.ObjectId(q.requester) });
    } else {
      if (!ctx.requesterIds?.length) return null;
      and.push({ createdBy: { $in: ctx.requesterIds } });
    }
  }

  if (q.booking) {
    if (isObjectIdString(q.booking)) {
      and.push({ bookingId: new Types.ObjectId(q.booking) });
    } else {
      // Accept the "BK-1A2B3" reference shown in the UI (= last 5 chars of the booking id).
      const suffix = q.booking.replace(/^BK-/i, '');
      if (!/^[a-f0-9]{1,24}$/i.test(suffix)) return null;
      and.push({
        $expr: { $regexMatch: { input: { $toString: '$bookingId' }, regex: `${suffix}$`, options: 'i' } },
      } as FilterQuery<Ticket>);
    }
  }

  if (q.from || q.to) {
    const createdAt: { $gte?: Date; $lte?: Date } = {};
    if (q.from) createdAt.$gte = startOf(q.from);
    if (q.to) createdAt.$lte = endOf(q.to);
    and.push({ createdAt });
  }

  if (q.search) and.push(buildSearchClause(q.search, ctx.searchUserIds));

  if (q.sla) and.push(slaClause(q.sla, ctx.now));

  return and.length ? { $and: and } : {};
}

/* --------------------------------- mapping --------------------------------- */

const person = (id: Types.ObjectId, users: Map<string, UserLean>): TicketPersonDto => {
  const u = users.get(String(id));
  return { id: String(id), name: u?.name ?? null, email: u?.email ?? null, phone: u?.phone ?? null };
};

export function toTicketDto(t: TicketLean, users: Map<string, UserLean>, now: Date): AdminTicketDto {
  return {
    id: String(t._id),
    ticketRef: ticketRefOf(t._id),
    subject: t.subject,
    category: t.category,
    status: t.status,
    priority: t.priority,
    requester: { ...person(t.createdBy, users), role: t.createdByRole },
    booking: t.bookingId ? { id: String(t.bookingId), ref: bookingRefOf(t.bookingId) } : null,
    assignee: t.assignedTo ? person(t.assignedTo, users) : null,
    sla: computeSla(t, now),
    lastMessageAt: iso(t.lastMessageAt),
    createdAt: iso(t.createdAt),
    updatedAt: iso(t.updatedAt),
  };
}

async function hydrate(rows: TicketLean[], now: Date): Promise<AdminTicketDto[]> {
  const ids = new Map<string, Types.ObjectId>();
  for (const t of rows) {
    ids.set(String(t.createdBy), t.createdBy);
    if (t.assignedTo) ids.set(String(t.assignedTo), t.assignedTo);
  }
  const users = new Map((await repo.findUsersByIds([...ids.values()])).map((u) => [String(u._id), u]));
  return rows.map((t) => toTicketDto(t, users, now));
}

export function toMessageDto(m: TicketMessageLean, senderName: string | null): AdminTicketMessageDto {
  return {
    id: String(m._id),
    ticketId: String(m.ticketId),
    sender: { id: String(m.senderId), name: senderName, role: m.senderRole },
    body: m.body,
    attachments: (m.attachments ?? []).map((a) => ({ url: a.url, name: a.name, mimeType: a.mimeType, sizeBytes: a.sizeBytes })),
    internal: m.isInternal === true,
    readAt: m.readAt ? iso(m.readAt) : null,
    createdAt: iso(m.createdAt),
  };
}

const addressLine = (a: BookingLean['address']): string | null => {
  const text = [a?.line1, a?.area, a?.city, a?.pincode].filter(Boolean).join(', ');
  return text || null;
};

/** A booking that was deleted (or an unreadable id) is just "no context": the ticket page still opens. */
async function loadBookingContext(bookingId: string): Promise<TicketBookingContextDto | null> {
  const b = await repo.findBookingSummary(bookingId);
  if (!b) return null;
  const partner = b.partnerId ? await repo.findPartnerUser(b.partnerId) : null;
  return {
    id: String(b._id),
    ref: bookingRefOf(b._id),
    serviceName: b.serviceName ?? '',
    status: b.status ?? '',
    paymentStatus: b.paymentStatus ?? '',
    scheduledAt: b.scheduledAt ? iso(b.scheduledAt) : null,
    total: b.priceBreakdown?.total ?? null,
    address: addressLine(b.address),
    partner,
  };
}

/** Closed is final: nothing can be reopened, reassigned, re-prioritised or replied to. */
const closedError = (what: string) => Errors.conflict(ERROR_CODES.CONFLICT, `Closed tickets cannot ${what}`);

type Actor = { id: string; ip: string };

/** The audit write never undoes the change it describes: failures are logged loudly instead. */
async function audit(actor: Actor, action: string, id: string, before: unknown, after: unknown): Promise<void> {
  try {
    await auditService.recordAudit({ actor: actor.id, action, entity: AUDIT_ENTITY, entityId: id, before, after, ip: actor.ip, result: 'Success' });
  } catch (err) {
    console.error(`[admin-tickets] audit write failed for ticket ${id} (${action}, by ${actor.id})`, err);
  }
}

/* --------------------------------- service --------------------------------- */

export const adminTicketsService = {
  /** GET /admin/ticket-assignees?assignable=true: the same people `assign` will accept. */
  async listAssignableAgents(): Promise<AssignableAgentDto[]> {
    const admins = await repo.listAssignableAdmins();
    return admins.map((a) => ({ id: String(a._id), name: a.name ?? a.email ?? 'Admin', email: a.email ?? null }));
  },

  /** GET /admin/tickets/:id: a queue row plus the booking the ticket is about. */
  async get(id: string, now: Date = new Date()): Promise<AdminTicketDetailDto> {
    const ticket = await repo.findById(id);
    if (!ticket) throw Errors.notFound(ERROR_CODES.TICKET_NOT_FOUND, 'Ticket not found');
    const row = (await hydrate([ticket], now))[0];
    return { ...row, bookingContext: ticket.bookingId ? await loadBookingContext(String(ticket.bookingId)) : null };
  },

  /** GET /admin/tickets/:id/messages: read-only thread, oldest first, with sender names. */
  async listMessages(id: string): Promise<AdminTicketMessageDto[]> {
    const ticket = await repo.findById(id);
    if (!ticket) throw Errors.notFound(ERROR_CODES.TICKET_NOT_FOUND, 'Ticket not found');
    const rows = await repo.listMessages(id);
    const senderIds = new Map<string, Types.ObjectId>();
    for (const m of rows) senderIds.set(String(m.senderId), m.senderId);
    const users = new Map((await repo.findUsersByIds([...senderIds.values()])).map((u) => [String(u._id), u]));
    return rows.map((m) => toMessageDto(m, users.get(String(m.senderId))?.name ?? null));
  },

  async list(q: AdminTicketsQuery, actor: { id: string }, now: Date = new Date()): Promise<AdminTicketsResult> {
    let requesterIds: Types.ObjectId[] | undefined;
    if (q.requester && !isObjectIdString(q.requester)) requesterIds = await repo.findUserIdsByText(q.requester);

    // A pasted 24-char id is looked up directly; anything else may also be a person's name, email or phone.
    const searchUserIds = q.search && !isObjectIdString(q.search) ? await repo.findUserIdsByText(q.search) : undefined;

    const filter = buildTicketFilter(q, { now, actorId: actor.id, requesterIds, searchUserIds });
    if (!filter) return { items: [], meta: { page: q.page, limit: q.limit, total: 0, pages: 0 } };

    const [rows, total] = await Promise.all([repo.find(filter, (q.page - 1) * q.limit, q.limit), repo.count(filter)]);
    return {
      items: await hydrate(rows, now),
      meta: { page: q.page, limit: q.limit, total, pages: Math.ceil(total / q.limit) },
    };
  },

  /**
   * Assign to an admin, reassign, or unassign (assigneeId = null). Re-sending the current assignee is a no-op
   * (200, no write, no audit row). The audit write never undoes the assignment: it is logged loudly instead.
   */
  async assign(
    id: string,
    input: { assigneeId: string | null },
    actor: { id: string; ip: string },
    now: Date = new Date(),
  ): Promise<AdminTicketDto> {
    const ticket = await repo.findById(id);
    if (!ticket) throw Errors.notFound(ERROR_CODES.TICKET_NOT_FOUND, 'Ticket not found');

    const current = ticket.assignedTo ? String(ticket.assignedTo) : null;
    if (current === input.assigneeId) return (await hydrate([ticket], now))[0];

    if (ticket.status === 'closed') {
      throw Errors.conflict(ERROR_CODES.CONFLICT, 'Closed tickets cannot be reassigned');
    }

    if (input.assigneeId) {
      const assignee = await repo.findAdminUser(input.assigneeId);
      if (!assignee || assignee.status === 'blocked') {
        throw Errors.validation([{ field: 'assigneeId', message: 'Assignee must be an active admin user' }]);
      }
    }

    const updated = await repo.setAssignee(id, ticket.assignedTo ?? null, input.assigneeId);
    if (!updated) {
      throw Errors.conflict(ERROR_CODES.CONFLICT, 'Ticket was changed by someone else. Reload and try again.');
    }

    try {
      await auditService.recordAudit({
        actor: actor.id,
        action: !input.assigneeId ? AUDIT_ACTION.unassigned : current ? AUDIT_ACTION.reassigned : AUDIT_ACTION.assigned,
        entity: AUDIT_ENTITY,
        entityId: id,
        before: { assignedTo: current },
        after: { assignedTo: input.assigneeId },
        ip: actor.ip,
        result: 'Success',
      });
    } catch (err) {
      console.error(`[admin-tickets] audit write failed for ticket ${id} (assign ${current} -> ${input.assigneeId}, by ${actor.id})`, err);
    }

    return (await hydrate([updated], now))[0];
  },

  /**
   * PATCH /admin/tickets/:id/status. Open / in progress / resolved move freely (so a resolved ticket can be
   * reopened); closed is final. Re-sending the current status is a no-op (200, no write, no audit, no event).
   */
  async updateStatus(id: string, status: TicketStatus, actor: Actor, now: Date = new Date()): Promise<AdminTicketDto> {
    const ticket = await repo.findById(id);
    if (!ticket) throw Errors.notFound(ERROR_CODES.TICKET_NOT_FOUND, 'Ticket not found');
    if (ticket.status === status) return (await hydrate([ticket], now))[0];
    if (ticket.status === 'closed') throw closedError('change status');

    const previous = ticket.status;
    const updated = await repo.setStatus(id, previous, status);
    if (!updated) throw Errors.conflict(ERROR_CODES.CONFLICT, 'Ticket was changed by someone else. Reload and try again.');

    await audit(actor, AUDIT_ACTION.statusChanged, id, { status: previous }, { status });
    emitTicketUpdated(String(updated.createdBy), {
      ticketId: id,
      status: updated.status,
      priority: updated.priority,
      updatedAt: iso(updated.updatedAt),
    });
    return (await hydrate([updated], now))[0];
  },

  /** PATCH /admin/tickets/:id/priority. Same rules as status: no-op when unchanged, 409 on a closed ticket or a lost race. */
  async updatePriority(id: string, priority: TicketPriority, actor: Actor, now: Date = new Date()): Promise<AdminTicketDto> {
    const ticket = await repo.findById(id);
    if (!ticket) throw Errors.notFound(ERROR_CODES.TICKET_NOT_FOUND, 'Ticket not found');
    if (ticket.priority === priority) return (await hydrate([ticket], now))[0];
    if (ticket.status === 'closed') throw closedError('change priority');

    const previous = ticket.priority;
    const updated = await repo.setPriority(id, previous, priority);
    if (!updated) throw Errors.conflict(ERROR_CODES.CONFLICT, 'Ticket was changed by someone else. Reload and try again.');

    await audit(actor, AUDIT_ACTION.priorityChanged, id, { priority: previous }, { priority });
    emitTicketUpdated(String(updated.createdBy), {
      ticketId: id,
      status: updated.status,
      priority: updated.priority,
      updatedAt: iso(updated.updatedAt),
    });
    return (await hydrate([updated], now))[0];
  },

  /**
   * POST /admin/tickets/:id/messages. A reply is pushed live to the requester; an internal note only to admins
   * watching the thread. The message is saved first: a socket or audit failure never loses or fails it.
   */
  async postMessage(
    id: string,
    input: { body: string; internal: boolean },
    actor: Actor,
  ): Promise<AdminTicketMessageDto> {
    const ticket = await repo.findById(id);
    if (!ticket) throw Errors.notFound(ERROR_CODES.TICKET_NOT_FOUND, 'Ticket not found');
    if (ticket.status === 'closed') throw closedError('receive messages');

    const saved = await repo.createMessage({ ticketId: id, senderId: actor.id, body: input.body, internal: input.internal });
    const [sender] = await repo.findUsersByIds([new Types.ObjectId(actor.id)]);
    const dto = toMessageDto(saved, sender?.name ?? null);

    await audit(actor, input.internal ? AUDIT_ACTION.noted : AUDIT_ACTION.replied, id, null, { messageId: dto.id, internal: dto.internal });
    const live: LiveTicketMessage = {
      id: dto.id,
      ticketId: dto.ticketId,
      sender: dto.sender,
      body: dto.body,
      attachments: dto.attachments,
      internal: dto.internal,
      createdAt: dto.createdAt,
    };
    emitTicketMessage(String(ticket.createdBy), live);
    return dto;
  },
};
import { z } from 'zod';
import {
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
} from '../tickets/tickets.constants';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, REQUESTER_ROLES, SLA_STATES } from './admin-tickets.constants';

export const isObjectIdString = (v: string): boolean => /^[a-f0-9]{24}$/i.test(v);

/** '' (an empty form field) means "not provided". */
const emptyToUndefined = (v: unknown) => (v === '' || v === null ? undefined : v);
const optional = <T extends z.ZodTypeAny>(schema: T) => z.preprocess(emptyToUndefined, schema.optional());

/** `?status=open,in_progress` and `?status=open&status=in_progress` both become ['open','in_progress']. */
const multi = <T extends readonly [string, ...string[]]>(values: T) =>
  z.preprocess(
    (v) => {
      if (v === undefined || v === null) return undefined;
      const list = (Array.isArray(v) ? v : String(v).split(','))
        .map((s) => String(s).trim().toLowerCase())
        .filter(Boolean);
      return list.length ? [...new Set(list)] : undefined;
    },
    z.array(z.enum(values)).optional(),
  );

const isoDate = z
  .string()
  .trim()
  .refine((v) => !Number.isNaN(Date.parse(v)), 'Must be a valid date (YYYY-MM-DD)');

export const listTicketsQuerySchema = z
  .object({
    status: multi(TICKET_STATUSES),
    priority: multi(TICKET_PRIORITIES),
    category: multi(TICKET_CATEGORIES),
    assignee: optional(
      z
        .string()
        .trim()
        .transform((v) => (v.toLowerCase() === 'me' || v.toLowerCase() === 'unassigned' ? v.toLowerCase() : v))
        .refine((v) => v === 'me' || v === 'unassigned' || isObjectIdString(v), 'Must be a user id, "me" or "unassigned"'),
    ),
    requester: optional(z.string().trim().max(100)),
    requesterRole: optional(z.preprocess((v) => (typeof v === 'string' ? v.toLowerCase() : v), z.enum(REQUESTER_ROLES))),
    booking: optional(z.string().trim().max(60)),
    /** The page's single search box: ticket ref, subject, requester (name/email/phone) or booking ref. */
    search: optional(z.string().trim().max(100)),
    sla: optional(z.preprocess((v) => (typeof v === 'string' ? v.toLowerCase() : v), z.enum(SLA_STATES))),
    from: optional(isoDate),
    to: optional(isoDate),
    page: optional(z.coerce.number().int().min(1)).transform((v) => v ?? 1),
    limit: optional(z.coerce.number().int().min(1).max(MAX_PAGE_SIZE)).transform((v) => v ?? DEFAULT_PAGE_SIZE),
  })
  .refine((q) => !q.from || !q.to || Date.parse(q.from) <= Date.parse(q.to), {
    message: '"from" must be on or before "to"',
    path: ['from'],
  });

export type ListTicketsQuery = z.infer<typeof listTicketsQuerySchema>;

export const ticketIdParamSchema = z.object({
  id: z.string().refine(isObjectIdString, 'Invalid ticket id'),
});

/** `assigneeId: null` unassigns. The key must be present so a forgotten field is not read as "unassign". */
export const assignTicketSchema = z.object({
  assigneeId: z
    .string({
      required_error: 'assigneeId is required (send null to unassign)',
      invalid_type_error: 'assigneeId must be a user id or null',
    })
    .refine(isObjectIdString, 'Invalid assignee id')
    .nullable(),
});

export type AssignTicketBody = z.infer<typeof assignTicketSchema>;

/** The agent picker only ever asks for assignable admins, so say so explicitly rather than guess a default. */
export const listAgentsQuerySchema = z.object({
  assignable: z.literal('true', { errorMap: () => ({ message: 'Only assignable=true is supported' }) }),
});

import { z } from 'zod';
import {
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
} from './tickets.constants';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Must be a valid id');

export const createTicketSchema = z
  .object({
    category: z.enum(TICKET_CATEGORIES),
    subject: z.string().trim().min(3).max(140),
    body: z.string().trim().min(1).max(4000),
    bookingId: objectId.optional(),
    priority: z.enum(TICKET_PRIORITIES).optional().default('normal'),
  })
  .strict();

export const ticketQuerySchema = z.object({
  status: z.enum(TICKET_STATUSES).optional(),
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const ticketIdSchema = z.object({
  id: objectId,
});

export const attachmentIdSchema = z.object({
  id: objectId,
  attachmentId: objectId,
});

export const ticketMessageSchema = z
  .object({
    body: z.string().trim().min(1).max(4000),
  })
  .strict();

export type NewTicket = z.infer<typeof createTicketSchema>;
export type TicketQuery = z.infer<typeof ticketQuerySchema>;

import { z } from "zod";
import {
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
} from "./tickets.constants";

export const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");
export const ticketIdSchema = z.object({ id: objectId });
export const attachmentIdSchema = z.object({
  id: objectId,
  attachmentId: objectId,
});
export const createTicketSchema = z
  .object({
    category: z.enum(TICKET_CATEGORIES),
    subject: z
      .string()
      .trim()
      .min(3, "Subject needs at least 3 characters")
      .max(200),
    body: z
      .string()
      .trim()
      .min(10, "Describe the issue in at least 10 characters")
      .max(4000),
    bookingId: z.preprocess(
      (v) => (v === "" ? undefined : v),
      objectId.optional(),
    ),
    priority: z.enum(TICKET_PRIORITIES).default("normal"),
  })
  .strict();
export const ticketMessageSchema = z
  .object({ body: z.string().trim().min(1, "Enter a message").max(4000) })
  .strict();
export const ticketStatusSchema = z
  .object({ status: z.enum(TICKET_STATUSES) })
  .strict();
export const listTicketsSchema = z
  .object({
    page: z.coerce.number().int().min(1).max(10_000).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
    status: z.enum(TICKET_STATUSES).optional(),
    search: z.string().trim().max(100).optional(),
  })
  .strict();
export type NewTicket = z.infer<typeof createTicketSchema>;
export type TicketQuery = z.infer<typeof listTicketsSchema>;

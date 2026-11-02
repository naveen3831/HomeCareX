// Partner support API (D08). Uses the same http client as availability.api.ts.
import http, { type ApiResponse } from "@/lib/http";

import type {
  PartnerTicketCategory,
  Ticket,
  TicketAttachment,
  TicketMessage,
} from "@/components/tickets/ticket.types";

const BASE = "/partner/support";

export interface TicketDetail {
  ticket: Ticket;
  messages: TicketMessage[];
}

export interface CreateTicketInput {
  category: PartnerTicketCategory;
  subject: string;
  body: string;
  bookingId?: string;
  files: File[];
}

/**
 * Uploads files and returns the attachment records the ticket APIs expect
 * ({ url, name, mimeType, sizeBytes }).
 * NOTE: assumes POST /partner/support/attachments (multipart, field "files").
 * Adjust here if the backend uses a different upload route.
 */
async function uploadAttachments(files: File[]): Promise<TicketAttachment[]> {
  if (files.length === 0) return [];
  const form = new FormData();
  files.forEach((f) => form.append("files", f));
  const res = await http.post<ApiResponse<TicketAttachment[]>>(
    `${BASE}/attachments`,
    form
  );
  return res.data.data;
}

export async function listTickets(): Promise<Ticket[]> {
  const res = await http.get<ApiResponse<Ticket[] | { items: Ticket[] }>>(
    `${BASE}/tickets`
  );
  const data = res.data.data;
  return Array.isArray(data) ? data : data.items;
}

export async function getTicket(id: string): Promise<TicketDetail> {
  const res = await http.get<ApiResponse<TicketDetail>>(`${BASE}/tickets/${id}`);
  return res.data.data;
}

export async function createTicket(input: CreateTicketInput): Promise<Ticket> {
  const attachments = await uploadAttachments(input.files);
  const res = await http.post<ApiResponse<Ticket>>(`${BASE}/tickets`, {
    category: input.category,
    subject: input.subject,
    body: input.body,
    ...(input.bookingId ? { bookingId: input.bookingId } : {}),
    ...(attachments.length ? { attachments } : {}),
  });
  return res.data.data;
}

export async function replyToTicket(
  id: string,
  body: string,
  files: File[]
): Promise<TicketMessage> {
  const attachments = await uploadAttachments(files);
  const res = await http.post<ApiResponse<TicketMessage>>(
    `${BASE}/tickets/${id}/reply`,
    { body, ...(attachments.length ? { attachments } : {}) }
  );
  return res.data.data;
}
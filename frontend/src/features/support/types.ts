export const STATUSES = [
  'open',
  'in_progress',
  'waiting',
  'resolved',
  'closed',
] as const;
export type TicketStatus = (typeof STATUSES)[number];
export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent';
export const CATEGORIES = [
  'booking',
  'payment',
  'cancellation',
  'rescheduling',
  'partner',
  'account',
  'refunds',
  'safety',
  'app_issue',
  'other',
] as const;
export type TicketCategory = (typeof CATEGORIES)[number];
export interface CustomerTicket {
  id: string;
  createdBy: string;
  createdByRole: 'customer' | 'partner';
  bookingId: string | null;
  category: TicketCategory;
  subject: string;
  priority: TicketPriority;
  status: TicketStatus;
  assignedTo: string | null;
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
}
export interface Evidence {
  url: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
}
export interface CustomerMessage {
  id: string;
  ticketId: string;
  senderId: string;
  senderRole: 'customer' | 'partner' | 'admin';
  body: string;
  attachments: Evidence[];
  readAt: string | null;
  createdAt: string;
}
export interface TicketPage {
  items: CustomerTicket[];
  meta: { page: number; limit: number; total: number; pages: number };
}
export interface TicketDetail {
  ticket: CustomerTicket;
  messages: CustomerMessage[];
  nextBefore: string | null;
}
export interface NewTicket {
  category: TicketCategory;
  subject: string;
  body: string;
  priority: TicketPriority;
  bookingId?: string;
}
export interface TicketFilters {
  page: number;
  status?: TicketStatus;
  search?: string;
}
export const label = (value: string) =>
  value === 'partner'
    ? 'Partner issues'
    : value.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
export const ticketRef = (id: string) => `TCK-${id.slice(-6).toUpperCase()}`;
export const when = (value: string) =>
  new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
export const problem = (error: unknown) =>
  (error as { message?: string } | null)?.message ||
  'Could not complete the request. Please try again.';

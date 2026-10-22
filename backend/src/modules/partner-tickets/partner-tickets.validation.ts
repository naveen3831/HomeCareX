import { isValidObjectId } from 'mongoose';
import {
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  type TicketCategory,
  type TicketPriority,
} from '../tickets/tickets.constants';
import type { CreateTicketInput, CreateTicketMessageInput, TicketAttachmentDto } from '../tickets/tickets.types';

export class TicketError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly errors?: Record<string, string>,
  ) {
    super(message);
  }
}

export const SUBJECT_MAX = 200;
export const BODY_MAX = 4000;
export const MAX_ATTACHMENTS = 5;
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
export const ALLOWED_ATTACHMENT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
/** The partner form offers 9 categories, the ticket contract has 6: map the extra ones onto the closest. */
const CATEGORY_ALIASES = new Map<string, TicketCategory>([
  ['customer', 'other'],
  ['payout', 'payment'],
  ['kyc', 'account'],
  ['technical', 'app_issue'],
]);
type Raw = Record<string, unknown>;

const asRecord = (v: unknown): Raw => (v && typeof v === 'object' ? (v as Raw) : {});
const asTrimmed = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

export function assertObjectId(value: string, field = 'id'): void {
  if (!isValidObjectId(value)) throw new TicketError(400, `Invalid ${field}`, { [field]: 'Invalid id' });
}

/** https only (blocks javascript:, data:, http:). Optionally pin hosts with TICKET_ATTACHMENT_HOSTS=a.com,b.com. */
export function isSafeAttachmentUrl(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== 'https:') return false;
  const hosts = (process.env.TICKET_ATTACHMENT_HOSTS ?? '').split(',').map((h) => h.trim().toLowerCase()).filter(Boolean);
  return hosts.length === 0 || hosts.some((h) => u.hostname.toLowerCase() === h || u.hostname.toLowerCase().endsWith(`.${h}`));
}

function parseAttachments(value: unknown, errors: Record<string, string>): TicketAttachmentDto[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    errors.attachments = 'attachments must be an array';
    return [];
  }
  if (value.length > MAX_ATTACHMENTS) {
    errors.attachments = `At most ${MAX_ATTACHMENTS} attachments are allowed`;
    return [];
  }
  const out: TicketAttachmentDto[] = [];
  for (const item of value) {
    const a = asRecord(item);
    const url = asTrimmed(a.url);
    const name = asTrimmed(a.name);
    const mimeType = asTrimmed(a.mimeType);
    const sizeBytes = typeof a.sizeBytes === 'number' ? a.sizeBytes : NaN;
    if (!url || !name || !mimeType || Number.isNaN(sizeBytes)) {
      errors.attachments = 'Each attachment needs url, name, mimeType and sizeBytes';
      return [];
    }
    if (!isSafeAttachmentUrl(url)) {
      errors.attachments = 'Attachment url must be a valid https link';
      return [];
    }
    if (!ALLOWED_ATTACHMENT_TYPES.includes(mimeType)) {
      errors.attachments = 'Only JPG, PNG, WEBP and PDF files are allowed';
      return [];
    }
    if (sizeBytes <= 0 || sizeBytes > MAX_ATTACHMENT_BYTES) {
      errors.attachments = 'Each file must be 5 MB or smaller';
      return [];
    }
    out.push({ url, name, mimeType, sizeBytes });
  }
  return out;
}

function validateBody(raw: Raw, errors: Record<string, string>): string {
  const body = asTrimmed(raw.body);
  if (!body) errors.body = 'Message is required';
  else if (body.length > BODY_MAX) errors.body = `Message must be at most ${BODY_MAX} characters`;
  return body;
}

export function parseCreateTicket(input: unknown): CreateTicketInput & { attachments: TicketAttachmentDto[] } {
  const raw = asRecord(input);
  const errors: Record<string, string> = {};

  const rawCategory = asTrimmed(raw.category);
  const category = CATEGORY_ALIASES.get(rawCategory) ?? rawCategory;
  if (!category) errors.category = 'Category is required';
  else if (!(TICKET_CATEGORIES as readonly string[]).includes(category)) errors.category = 'Invalid category';

  const subject = asTrimmed(raw.subject);
  if (!subject) errors.subject = 'Subject is required';
  else if (subject.length > SUBJECT_MAX) errors.subject = `Subject must be at most ${SUBJECT_MAX} characters`;

  const body = validateBody(raw, errors);

  let priority: TicketPriority | undefined;
  if (raw.priority !== undefined) {
    const p = asTrimmed(raw.priority);
    if ((TICKET_PRIORITIES as readonly string[]).includes(p)) priority = p as TicketPriority;
    else errors.priority = 'Invalid priority';
  }

  let bookingId: string | undefined;
  if (raw.bookingId !== undefined && raw.bookingId !== null && raw.bookingId !== '') {
    const b = asTrimmed(raw.bookingId);
    if (isValidObjectId(b)) bookingId = b;
    else errors.bookingId = 'Invalid booking id';
  }

  const attachments = parseAttachments(raw.attachments, errors);

  if (Object.keys(errors).length) throw new TicketError(400, 'Validation failed', errors);
  return { category: category as TicketCategory, subject, body, priority, bookingId, attachments };
}

export function parseReply(input: unknown): Required<CreateTicketMessageInput> {
  const raw = asRecord(input);
  const errors: Record<string, string> = {};
  const body = validateBody(raw, errors);
  const attachments = parseAttachments(raw.attachments, errors);
  if (Object.keys(errors).length) throw new TicketError(400, 'Validation failed', errors);
  return { body, attachments };
}
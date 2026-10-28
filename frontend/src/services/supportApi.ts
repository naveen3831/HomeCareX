import http, { type ApiResponse } from "@/lib/http";
import type {
  CustomerMessage,
  CustomerTicket,
  NewTicket,
  TicketDetail,
  TicketFilters,
  TicketPage,
} from "@/features/support/types";

function cleanParams(obj: object): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null || v === "") continue;
    out[k] = v as string | number;
  }
  return out;
}

const asObject = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" ? value as Record<string, unknown> : {};

const asTickets = (value: unknown): CustomerTicket[] =>
  Array.isArray(value) ? value as CustomerTicket[] : [];

const ticketMeta = (
  value: unknown,
  fallback: TicketPage["meta"],
): TicketPage["meta"] => {
  const meta = asObject(value);
  return {
    page: Number(meta.page) || fallback.page,
    limit: Number(meta.limit) || fallback.limit,
    total: Number(meta.total) || fallback.total,
    pages: Number(meta.pages) || fallback.pages,
  };
};

export const supportApi = {
  /** GET /support/tickets -> { items, meta } */
  async list(filters: TicketFilters, signal?: AbortSignal): Promise<TicketPage> {
    const response = await http.get<unknown>("/support/tickets", {
      params: cleanParams(filters),
      signal,
    });
    const body = response.data;
    const record = asObject(body);
    const data = record.data;
    if (Array.isArray(data)) {
      const items = asTickets(data);
      return {
        items,
        meta: ticketMeta(record.meta, {
          page: Number(filters.page) || 1,
          limit: 10,
          total: items.length,
          pages: 1,
        }),
      };
    }
    const nested = asObject(data);
    if (Array.isArray(nested.items)) {
      const items = asTickets(nested.items);
      return {
        items,
        meta: ticketMeta(nested.meta, {
          page: Number(filters.page) || 1,
          limit: 10,
          total: items.length,
          pages: 1,
        }),
      };
    }
    if (Array.isArray(record.items)) {
      const items = asTickets(record.items);
      return {
        items,
        meta: ticketMeta(record.meta, {
          page: Number(filters.page) || 1,
          limit: 10,
          total: items.length,
          pages: 1,
        }),
      };
    }
    if (Array.isArray(body)) {
      return {
        items: asTickets(body),
        meta: {
          page: Number(filters.page) || 1,
          limit: 10,
          total: body.length,
          pages: 1,
        },
      };
    }
    return {
      items: [],
      meta: { page: 1, limit: 10, total: 0, pages: 1 },
    };
  },

  /** GET /support/tickets/:id -> { ticket, messages, nextBefore } */
  async get(id: string, signal?: AbortSignal, before?: string | null): Promise<TicketDetail> {
    const { data } = await http.get<ApiResponse<TicketDetail>>(
      `/support/tickets/${encodeURIComponent(id)}`,
      { params: before ? { before } : undefined, signal },
    );
    return data.data;
  },

  /** POST /support/tickets (multipart, so evidence files can be attached). */
  async create(input: NewTicket, files?: File[]): Promise<CustomerTicket> {
    const fd = new FormData();
    for (const [k, v] of Object.entries(input)) {
      if (v !== undefined && v !== null) fd.append(k, String(v));
    }
    (files ?? []).forEach((f) => fd.append("attachments", f));
    const { data } = await http.post<ApiResponse<CustomerTicket>>("/support/tickets", fd);
    return data.data;
  },

  /** POST /support/tickets/:id/messages */
  async reply(id: string, body: string, files?: File[]): Promise<CustomerMessage> {
    const fd = new FormData();
    fd.append("body", body);
    (files ?? []).forEach((f) => fd.append("attachments", f));
    const { data } = await http.post<ApiResponse<CustomerMessage>>(
      `/support/tickets/${encodeURIComponent(id)}/messages`,
      fd,
    );
    return data.data;
  },

  /** Authenticated file download. */
  async download(url: string, name: string, admin = false): Promise<void> {
    const res = await http.get<Blob>(url, {
      responseType: "blob",
      params: admin ? { admin: true } : undefined,
    });
    const href = URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = href;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(href);
  },
};
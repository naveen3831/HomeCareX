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

export const supportApi = {
  /** GET /support/tickets -> { items, meta } */
  async list(filters: TicketFilters, signal?: AbortSignal): Promise<TicketPage> {
    const response = await http.get<any>("/support/tickets", {
      params: cleanParams(filters),
      signal,
    });
    const body = response.data;
    if (Array.isArray(body?.data)) {
      return {
        items: body.data,
        meta: body.meta ?? {
          page: Number(filters.page) || 1,
          limit: 10,
          total: body.data.length,
          pages: 1,
        },
      };
    }
    if (body?.data?.items && Array.isArray(body.data.items)) {
      return body.data;
    }
    if (body?.items && Array.isArray(body.items)) {
      return body;
    }
    if (Array.isArray(body)) {
      return {
        items: body,
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
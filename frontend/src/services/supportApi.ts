// Customer support API. (The partner version lives in pages/partner/Support/support.api.ts.)
import http from "@/lib/http";
import type {
  CustomerMessage,
  Evidence,
  NewTicket,
  CustomerTicket,
  TicketDetail,
  TicketFilters,
  TicketPage,
} from "@/features/support/types";

const BASE = "/support/tickets";
const PAGE_SIZE = 10;

interface Envelope<T> {
  success?: boolean;
  data: T;
  meta?: Partial<TicketPage["meta"]> & { totalPages?: number };
}

/** Uploads the files first and returns the attachment records the ticket endpoints expect. */
async function uploadAttachments(files: File[]): Promise<Evidence[]> {
  if (files.length === 0) return [];
  const form = new FormData();
  files.forEach((file) => form.append("files", file));
  const res = await http.post<Envelope<Evidence[]>>("/support/attachments", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data.data;
}

/** Saves a downloaded blob with the given file name. */
function saveBlob(blob: Blob, name: string): void {
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(href), 1000);
}

export const supportApi = {
  /** GET /support/tickets. Empty filters are dropped so the server sees a clean query. */
  async list(filters: TicketFilters, signal?: AbortSignal): Promise<TicketPage> {
    const params: Record<string, string | number> = { page: filters.page, limit: PAGE_SIZE };
    if (filters.status) params.status = filters.status;
    if (filters.search?.trim()) params.search = filters.search.trim();
    const res = await http.get<Envelope<CustomerTicket[] | TicketPage>>(BASE, { params, signal });
    const body = res.data.data;
    if (!Array.isArray(body)) return body;
    const meta = res.data.meta ?? {};
    return {
      items: body,
      meta: {
        page: meta.page ?? filters.page,
        limit: meta.limit ?? PAGE_SIZE,
        total: meta.total ?? body.length,
        pages: meta.pages ?? meta.totalPages ?? 1,
      },
    };
  },

  /** GET /support/tickets/:id. `before` is the cursor for "Load earlier messages". */
  async get(id: string, signal?: AbortSignal, before?: string | null): Promise<TicketDetail> {
    const res = await http.get<Envelope<TicketDetail>>(`${BASE}/${encodeURIComponent(id)}`, {
      params: before ? { before } : undefined,
      signal,
    });
    const data = res.data.data;
    return { ...data, nextBefore: data.nextBefore ?? null };
  },

  /** POST /support/tickets. Returns the new ticket. */
  async create(input: NewTicket, files: File[] = []): Promise<CustomerTicket> {
    const attachments = await uploadAttachments(files);
    const res = await http.post<Envelope<CustomerTicket>>(BASE, {
      ...input,
      ...(attachments.length ? { attachments } : {}),
    });
    return res.data.data;
  },

  /** POST /support/tickets/:id/messages. Returns the saved message. */
  async reply(id: string, body: string, files: File[] = []): Promise<CustomerMessage> {
    const attachments = await uploadAttachments(files);
    const res = await http.post<Envelope<CustomerMessage>>(`${BASE}/${encodeURIComponent(id)}/messages`, {
      body,
      ...(attachments.length ? { attachments } : {}),
    });
    return res.data.data;
  },

  /** Downloads an attachment through the API so the login token is sent (a plain link would not carry it). */
  async download(url: string, name: string, admin = false): Promise<void> {
    const res = await http.get<Blob>(url, {
      responseType: "blob",
      params: admin ? { audience: "admin" } : undefined,
    });
    saveBlob(res.data, name);
  },
};

export default supportApi;

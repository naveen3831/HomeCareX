import http, { type ApiResponse } from "@/lib/http";
import type {
  CustomerMessage,
  CustomerTicket,
  NewTicket,
  TicketDetail,
  TicketFilters,
  TicketPage,
} from "@/features/support/types";

function multipart(input: object, files: File[]) {
  const form = new FormData();
  Object.entries(input).forEach(([key, value]) => {
    if (value !== undefined && value !== "") form.append(key, String(value));
  });
  files.forEach((file) => form.append("attachments", file));
  return form;
}
// Let the browser generate the multipart boundary; http otherwise defaults to JSON.
const uploadOptions = {
  headers: { "Content-Type": undefined },
  timeout: 60_000,
};
export const supportApi = {
  async list(
    filters: TicketFilters,
    signal?: AbortSignal,
  ): Promise<TicketPage> {
    const { data } = await http.get<
      ApiResponse<CustomerTicket[]> & { meta: TicketPage["meta"] }
    >("/tickets", { params: { ...filters, limit: 10 }, signal });
    return { items: data.data, meta: data.meta };
  },
  async get(
    id: string,
    signal?: AbortSignal,
    before?: string,
  ): Promise<TicketDetail> {
    return (
      await http.get<ApiResponse<TicketDetail>>(
        `/tickets/${encodeURIComponent(id)}`,
        { signal, params: before ? { before } : undefined },
      )
    ).data.data;
  },
  async create(input: NewTicket, files: File[]): Promise<CustomerTicket> {
    return (
      await http.post<ApiResponse<CustomerTicket>>(
        "/tickets",
        multipart(input, files),
        uploadOptions,
      )
    ).data.data;
  },
  async reply(
    id: string,
    body: string,
    files: File[],
    admin = false,
  ): Promise<CustomerMessage> {
    const prefix = admin ? "/admin/tickets" : "/tickets";
    return (
      await http.post<ApiResponse<CustomerMessage>>(
        `${prefix}/${encodeURIComponent(id)}/messages`,
        multipart({ body }, files),
        uploadOptions,
      )
    ).data.data;
  },
  async download(url: string, name: string, admin = false): Promise<void> {
    // Only fetch our authenticated evidence route, never a user-supplied external URL.
    const match =
      /^\/api\/v1\/tickets\/([a-f\d]{24})\/attachments\/([a-f\d]{24})$/i.exec(
        url,
      );
    if (!match) throw new Error("This attachment link is not available.");
    const path = `${admin ? "/admin/tickets" : "/tickets"}/${match[1]}/attachments/${match[2]}`;
    const { data } = await http.get<Blob>(path, { responseType: "blob" });
    const href = URL.createObjectURL(data);
    const link = document.createElement("a");
    link.href = href;
    link.download = name;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(href), 1000);
  },
};

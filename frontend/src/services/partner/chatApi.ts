import http from "@/lib/http";

export interface NormalizedMessage {
  _id: string;
  text: string;
  attachments: Array<{ url: string }>;
}

export interface RawMessage {
  id?: string | number;
  _id?: string | number;
  body?: string;
  text?: string;
  attachments?: Array<string | { url?: string }>;
}

export const normalizeMessage = (m: RawMessage): NormalizedMessage => ({
  _id: String(m._id ?? m.id ?? "msg-" + Math.random().toString(16).slice(2)),
  text: m.text ?? m.body ?? "",
  attachments: (m.attachments ?? []).map((item) =>
    typeof item === "string" ? { url: item } : { url: item.url ?? "" },
  ),
});

export async function sendBookingMessage(
  bookingId: string,
  text: string,
  files: File[] = [],
) {
  const form = new FormData();
  form.append("text", text);
  files.forEach((file) => form.append("attachments", file));

  const res = await http.post<{ data: RawMessage }>(
    `/bookings/${bookingId}/messages`,
    form,
    {
      headers: { "Content-Type": "multipart/form-data" },
    },
  );

  return res.data.data;
}
import api from "@/lib/api";
import type { ChatMessage, ChatPage } from "./Chat.types";

export async function fetchMessages(
  bookingId: string,
  before?: string,
): Promise<ChatPage> {
  const res = await api.get<{
    data: ChatMessage[];
    meta?: { nextCursor?: string | null };
  }>(`/bookings/${bookingId}/messages`, {
    params: { limit: 30, ...(before ? { before } : {}) },
  });
  return {
    messages: res.data.data,
    nextCursor: res.data.meta?.nextCursor ?? null,
  };
}

export async function postMessage(
  bookingId: string,
  input: { text?: string; photos?: string[] },
): Promise<ChatMessage> {
  const res = await api.post<{ data: ChatMessage }>(
    `/bookings/${bookingId}/messages`,
    {
      ...(input.text ? { text: input.text } : {}),
      ...(input.photos?.length
        ? { attachments: input.photos.map((url) => ({ url })) }
        : {}),
    },
  );
  return res.data.data;
}

export function httpStatus(err: unknown): number | null {
  if (typeof err === "object" && err !== null && "response" in err) {
    const status = (err as { response?: { status?: unknown } }).response
      ?.status;
    if (typeof status === "number") return status;
  }
  return null;
}

export function errorMessage(err: unknown, fallback: string): string {
  if (typeof err === "object" && err !== null && "response" in err) {
    const message = (err as { response?: { data?: { message?: unknown } } })
      .response?.data?.message;
    if (typeof message === "string" && message.length > 0) return message;
  }
  return fallback;
}

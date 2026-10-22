import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useSocket } from "@/hooks/useSocket";
import type { CustomerMessage, TicketDetail } from "@/features/support/types";

/** Shape the server emits on `ticket:message` (see backend sockets/ticket.socket.ts, LiveTicketMessage). */
export interface LiveTicketMessage {
  id: string;
  ticketId: string;
  sender: { id: string; name: string | null; role: "customer" | "partner" | "admin" };
  body: string;
  attachments: { url: string; name: string; mimeType: string; sizeBytes: number }[];
  internal: boolean;
  createdAt: string;
}

const TICKET_MESSAGE = "ticket:message";

export function toCustomerMessage(live: LiveTicketMessage): CustomerMessage {
  return {
    id: live.id,
    ticketId: live.ticketId,
    senderId: live.sender.id,
    senderRole: live.sender.role,
    body: live.body,
    attachments: live.attachments,
    readAt: null,
    createdAt: live.createdAt,
  };
}

function isLiveMessage(value: unknown): value is LiveTicketMessage {
  const v = value as Partial<LiveTicketMessage> | null;
  return (
    typeof v === "object" &&
    v !== null &&
    typeof v.id === "string" &&
    typeof v.ticketId === "string" &&
    typeof v.body === "string" &&
    typeof v.sender === "object" &&
    v.sender !== null
  );
}

/**
 * Pushes agent replies into the open customer thread the moment the server emits them, so the page does not
 * wait for the next poll. Internal notes are ignored (the server never sends them here; this is a second guard).
 * The polling in useTicket stays as the fallback while the socket is down, and a reconnect refetches whatever
 * arrived while offline. Returns whether the socket is connected, so the page can say "Live" only when true.
 */
export function useLiveTicketMessages(ticketId: string): { live: boolean } {
  const { user } = useAuth();
  const { socket, connected } = useSocket();
  const client = useQueryClient();
  const userId = user?.id;
  const wasConnected = useRef(connected);

  useEffect(() => {
    if (!ticketId || !userId) return;
    const key = ["customer-support", userId, "ticket", ticketId];
    const onMessage = (payload: unknown) => {
      if (!isLiveMessage(payload) || payload.internal || payload.ticketId !== ticketId) return;
      const incoming = toCustomerMessage(payload);
      client.setQueryData<TicketDetail>(key, (current) => {
        if (!current || current.messages.some((m) => m.id === incoming.id)) return current;
        return { ...current, messages: [...current.messages, incoming] };
      });
    };
    socket.on(TICKET_MESSAGE, onMessage);
    return () => {
      socket.off(TICKET_MESSAGE, onMessage);
    };
  }, [socket, client, userId, ticketId]);

  // Anything sent while the socket was down was missed: reconcile with the server once it is back.
  useEffect(() => {
    if (connected && !wasConnected.current) {
      void client.invalidateQueries({ queryKey: ["customer-support"] });
    }
    wasConnected.current = connected;
  }, [connected, client]);

  return { live: connected };
}
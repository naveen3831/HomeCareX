import { useEffect, useRef } from "react";

import { useSocket } from "@/hooks/useSocket";
import type {
  TicketMessage,
  TicketSenderRole,
  TicketStatus,
} from "@/components/tickets/ticket.types";

/** Server -> partner events. The partner's own `user:<id>` room receives them, so there is nothing to join. */
export const TICKET_EVENTS = {
  message: "ticket:message",
  updated: "ticket:updated",
} as const;

/** Shape pushed by the backend (sockets/ticket.socket.ts: LiveTicketMessage). */
interface LiveTicketMessage {
  id: string;
  ticketId: string;
  sender: { id: string; name: string | null; role: TicketSenderRole };
  body: string;
  attachments: TicketMessage["attachments"];
  internal: boolean;
  createdAt: string;
}

/** Shape pushed by the backend (LiveTicketUpdate, minus priority which partners never receive). */
export interface LiveTicketStatus {
  ticketId: string;
  status: TicketStatus;
  updatedAt: string;
}

/** Live payload -> the same shape the REST API returns, so one list can hold both. */
export function toTicketMessage(m: LiveTicketMessage): TicketMessage {
  return {
    id: m.id,
    ticketId: m.ticketId,
    senderId: m.sender.id,
    senderRole: m.sender.role,
    body: m.body,
    attachments: m.attachments ?? [],
    createdAt: m.createdAt,
  };
}

interface Handlers {
  onMessage: (m: TicketMessage) => void;
  onStatus: (u: LiveTicketStatus) => void;
}

/**
 * Live replies and status changes for one ticket.
 * Returns whether the socket is connected right now, so the page can show "Live" only when true
 * and fall back to polling when false.
 */
export function usePartnerTicketLive(
  ticketId: string | undefined,
  handlers: Handlers,
): { connected: boolean } {
  const { socket, connected } = useSocket();

  // Handlers change every render; the subscription must not.
  const ref = useRef(handlers);
  ref.current = handlers;

  useEffect(() => {
    if (!ticketId) return;

    const onMessage = (m: LiveTicketMessage) => {
      // Internal notes are agent-only; never show one even if it somehow arrives.
      if (m?.ticketId === ticketId && !m.internal) ref.current.onMessage(toTicketMessage(m));
    };
    const onUpdated = (u: LiveTicketStatus) => {
      if (u?.ticketId === ticketId) ref.current.onStatus(u);
    };

    socket.on(TICKET_EVENTS.message, onMessage);
    socket.on(TICKET_EVENTS.updated, onUpdated);
    return () => {
      socket.off(TICKET_EVENTS.message, onMessage);
      socket.off(TICKET_EVENTS.updated, onUpdated);
    };
  }, [socket, ticketId]);

  return { connected };
}
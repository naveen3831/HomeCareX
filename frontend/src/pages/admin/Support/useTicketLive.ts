import { useEffect, useRef, useState } from 'react';
import { useSocket } from '@/hooks/useSocket';
import type { TicketMessage, TicketUpdatedEvent } from '@/types/adminTicket';

export const TICKET_EVENTS = {
  message: 'ticket:message',
  updated: 'ticket:updated',
  join: 'ticket:join',
  leave: 'ticket:leave',
} as const;

interface Handlers {
  onMessage: (m: TicketMessage) => void;
  onUpdated?: (u: TicketUpdatedEvent) => void;
}

/**
 * Live thread for one ticket. Joins `ticket:admin:<id>` on the server (admins with tickets:manage only),
 * so customer replies and other agents' replies/notes arrive without polling.
 * Rooms are lost on reconnect, so it joins again every time the socket (re)connects.
 * Returns whether this tab is actually subscribed right now, so the page can say "Live" only when true.
 */
export function useTicketLive(ticketId: string, handlers: Handlers): { live: boolean } {
  const { socket, connected } = useSocket();
  const [joined, setJoined] = useState(false);

  // Handlers change every render; the subscription must not.
  const ref = useRef(handlers);
  ref.current = handlers;

  useEffect(() => {
    if (!ticketId) return;
    const onMessage = (m: TicketMessage) => {
      if (m?.ticketId === ticketId) ref.current.onMessage(m);
    };
    const onUpdated = (u: TicketUpdatedEvent) => {
      if (u?.ticketId === ticketId) ref.current.onUpdated?.(u);
    };
    socket.on(TICKET_EVENTS.message, onMessage);
    socket.on(TICKET_EVENTS.updated, onUpdated);
    return () => {
      socket.off(TICKET_EVENTS.message, onMessage);
      socket.off(TICKET_EVENTS.updated, onUpdated);
    };
  }, [socket, ticketId]);

  useEffect(() => {
    if (!ticketId || !connected) {
      setJoined(false);
      return;
    }
    let alive = true;
    socket.timeout(5_000).emit(TICKET_EVENTS.join, { ticketId }, (err: Error | null, res?: { ok?: boolean }) => {
      if (alive) setJoined(!err && res?.ok === true);
    });
    return () => {
      alive = false;
      socket.emit(TICKET_EVENTS.leave, { ticketId });
    };
  }, [socket, connected, ticketId]);

  return { live: connected && joined };
}
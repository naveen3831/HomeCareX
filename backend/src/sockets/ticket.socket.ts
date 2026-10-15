import type { Socket } from "socket.io";
import { z } from "zod";
import { ERROR_CODES } from "../constants/errorCodes";
import { TicketModel } from "../models/Ticket";
import { ROLE_PERMISSIONS } from "../modules/auth/auth.constants";
import type { AccessTokenPayload } from "../modules/auth/auth.types";
import { getIOIfReady, rooms, type JoinAck } from "./index";

/** Admins looking at one ticket's thread. Internal notes only ever go to this room. */
export const ticketAdminRoom = (ticketId: string) => `ticket:admin:${ticketId}`;

/** Events. Customer/partner apps listen for these on their normal `user:<id>` room. */
export const TICKET_EVENTS = {
  message: "ticket:message",
  updated: "ticket:updated",
  join: "ticket:join",
  leave: "ticket:leave",
} as const;

export interface LiveTicketMessage {
  id: string;
  ticketId: string;
  sender: { id: string; name: string | null; role: "customer" | "partner" | "admin" };
  body: string;
  attachments: { url: string; name: string; mimeType: string; sizeBytes: number }[];
  internal: boolean;
  createdAt: string;
}

export interface LiveTicketUpdate {
  ticketId: string;
  status: string;
  priority: string;
  updatedAt: string;
}

const joinPayload = z.object({ ticketId: z.string().regex(/^[a-f\d]{24}$/i) });

/**
 * Agent reply -> requester, live. A public reply goes to the requester's `user:<id>` room (every device they
 * are signed in on) and to admins viewing the thread; an internal note goes to the admin room only.
 * Never throws: the message is already saved, so a socket problem must not fail the request.
 */
export function emitTicketMessage(requesterId: string, message: LiveTicketMessage): void {
  try {
    const io = getIOIfReady();
    if (!io) return;
    if (message.internal) {
      io.to(ticketAdminRoom(message.ticketId)).emit(TICKET_EVENTS.message, message);
      return;
    }
    io.to(rooms.user(requesterId)).to(ticketAdminRoom(message.ticketId)).emit(TICKET_EVENTS.message, message);
  } catch (err) {
    console.error(`[ticket.socket] emit failed for ticket ${message.ticketId}`, err);
  }
}

/** Status / priority changed. The requester only needs to see the status; priority is an internal matter. */
export function emitTicketUpdated(requesterId: string, update: LiveTicketUpdate): void {
  try {
    const io = getIOIfReady();
    if (!io) return;
    io.to(rooms.user(requesterId)).emit(TICKET_EVENTS.updated, {
      ticketId: update.ticketId,
      status: update.status,
      updatedAt: update.updatedAt,
    });
    io.to(ticketAdminRoom(update.ticketId)).emit(TICKET_EVENTS.updated, update);
  } catch (err) {
    console.error(`[ticket.socket] emit failed for ticket ${update.ticketId}`, err);
  }
}

/** Admins with `tickets:manage` may watch a ticket thread. Rooms are lost on reconnect, so clients re-join then. */
export function registerTicketSocket(socket: Socket): void {
  const auth = socket.data.auth as AccessTokenPayload;

  socket.on(TICKET_EVENTS.join, async (payload: unknown, ack?: (res: JoinAck) => void) => {
    const reply = typeof ack === "function" ? ack : () => undefined;
    const parsed = joinPayload.safeParse(payload);
    if (!parsed.success) {
      return reply({ ok: false, code: ERROR_CODES.VALIDATION_ERROR, message: "ticketId is required" });
    }
    const granted = ROLE_PERMISSIONS[auth.role] ?? [];
    if (auth.role !== "admin" || !(granted.includes("*") || granted.includes("tickets:manage"))) {
      return reply({ ok: false, code: ERROR_CODES.RESOURCE_FORBIDDEN, message: "You cannot watch this ticket" });
    }
    try {
      if (!(await TicketModel.exists({ _id: parsed.data.ticketId }))) {
        return reply({ ok: false, code: ERROR_CODES.TICKET_NOT_FOUND, message: "Ticket not found" });
      }
      await socket.join(ticketAdminRoom(parsed.data.ticketId));
      reply({ ok: true });
    } catch {
      reply({ ok: false, code: ERROR_CODES.INTERNAL_ERROR, message: "Could not join ticket" });
    }
  });

  socket.on(TICKET_EVENTS.leave, (payload: unknown) => {
    const parsed = joinPayload.safeParse(payload);
    if (parsed.success) void socket.leave(ticketAdminRoom(parsed.data.ticketId));
  });
}
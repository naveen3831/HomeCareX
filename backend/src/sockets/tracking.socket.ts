import type { Socket } from "socket.io";
import { z } from "zod";
import type { AccessTokenPayload } from "../modules/auth/auth.types";
import { ERROR_CODES, type ErrorCode } from "../constants/errorCodes";
import {
  trackingRoom,
  trackingService,
  type TrackingSnapshot,
} from "../services/TrackingService";

export type TrackingJoinAck =
  | { ok: true; snapshot: TrackingSnapshot }
  | { ok: false; code: ErrorCode; message: string };

const payloadSchema = z.object({
  bookingId: z.string().regex(/^[a-f\d]{24}$/i),
});

/**
 * Customer tracking room. `tracking:join` is only accepted for the customer who owns the booking and
 * replies with the latest snapshot, so the same call serves the first join and every reconnect
 * (rooms are lost when a socket reconnects). The partner never writes here: location and status are
 * relayed by the backend after it has validated and stored them.
 */
export const registerTrackingSocket = (socket: Socket): void => {
  const auth = socket.data.auth as AccessTokenPayload;

  socket.on(
    "tracking:join",
    async (payload: unknown, ack?: (res: TrackingJoinAck) => void) => {
      const reply = typeof ack === "function" ? ack : () => undefined;
      const parsed = payloadSchema.safeParse(payload);
      if (!parsed.success)
        return reply({
          ok: false,
          code: ERROR_CODES.VALIDATION_ERROR,
          message: "bookingId is required",
        });
      const { bookingId } = parsed.data;
      try {
        if (
          auth.role !== "customer" ||
          !(await trackingService.isOwner(auth.sub, bookingId))
        ) {
          return reply({
            ok: false,
            code: ERROR_CODES.RESOURCE_FORBIDDEN,
            message: "You cannot track this booking",
          });
        }
        await socket.join(trackingRoom(bookingId));
        const snapshot = await trackingService.snapshot(bookingId);
        if (!snapshot)
          return reply({
            ok: false,
            code: ERROR_CODES.BOOKING_NOT_FOUND,
            message: "Booking not found",
          });
        reply({ ok: true, snapshot });
      } catch {
        reply({
          ok: false,
          code: ERROR_CODES.INTERNAL_ERROR,
          message: "Could not join tracking",
        });
      }
    },
  );

  socket.on("tracking:leave", (payload: unknown) => {
    const parsed = payloadSchema.safeParse(payload);
    if (parsed.success) void socket.leave(trackingRoom(parsed.data.bookingId));
  });
};

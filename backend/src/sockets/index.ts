
import type { Server as HttpServer } from 'http';
import { Server, type Socket } from 'socket.io';
import { z } from 'zod';

import { ERROR_CODES, type ErrorCode } from '../constants/errorCodes';
import BookingModel from '../models/Booking';
import PartnerModel from '../models/Partner';
import { authService } from '../modules/auth/auth.service';
import type { AccessTokenPayload } from '../modules/auth/auth.types';

import { registerTicketSocket } from './ticket.socket';
import { registerTrackingSocket } from './tracking.socket';

/**
 * Room names.
 *
 * A socket joins:
 * - user:<id>
 * - role:<role>
 * - booking:<id> after successful booking:join authorization
 * - tracking:<id> after successful tracking:join authorization (see tracking.socket.ts)
 * - ticket:admin:<id> after successful ticket:join authorization (see ticket.socket.ts)
 */
export const rooms = {
  user: (userId: string) => `user:${userId}`,
  role: (role: string) => `role:${role}`,
  booking: (bookingId: string) => `booking:${bookingId}`,
  tracking: (bookingId: string) => `tracking:${bookingId}`,
};

export type JoinAck =
  | { ok: true }
  | { ok: false; code: ErrorCode; message: string };

type AckFn = (res: JoinAck) => void;

const bookingPayload = z.object({
  bookingId: z.string().regex(/^[a-f\d]{24}$/i),
});

let io: Server | null = null;

/** Returns the initialized Socket.IO server. */
export const getIO = (): Server => {
  if (!io) {
    throw new Error(
      'Socket.IO has not been initialised. Call initSockets(server) first.',
    );
  }

  return io;
};

/** Returns the initialized Socket.IO server, or null if not initialized. */
export const getIOIfReady = (): Server | null => io;

/** Emits an event to all sockets belonging to a user. */
export const emitToUser = (
  userId: string,
  event: string,
  payload: unknown,
) => getIO().to(rooms.user(userId)).emit(event, payload);


/** Emits an event to all sockets in a booking room. */
export const emitToBooking = (
  bookingId: string,
  event: string,
  payload: unknown,
) => getIO().to(rooms.booking(bookingId)).emit(event, payload);

/**
 * Admins can join existing bookings.
 * Customers can join only their own bookings.
 * Partners can join only bookings assigned to them.
 */
async function canJoinBooking(
  auth: AccessTokenPayload,
  bookingId: string,
): Promise<boolean> {
  if (auth.role === 'admin') {
    return Boolean(
      await BookingModel.exists({ _id: bookingId }),
    );
  }


  if (auth.role === 'customer') {
    return Boolean(
      await BookingModel.exists({
        _id: bookingId,
        customerId: auth.sub,
      }),
    );
  }

  if (auth.role === 'partner') {
    const partner = await PartnerModel.findOne({
      userId: auth.sub,
    })
      .select('_id')
      .lean();

    if (!partner) {
      return false;
    }

    return Boolean(
      await BookingModel.exists({
        _id: bookingId,
        partnerId: partner._id,
      }),
    );
  }

  return false;
}

/** Extracts an access token from the Socket.IO handshake. */
const tokenFrom = (socket: Socket): string | undefined => {
  const fromAuth: unknown = socket.handshake.auth?.token;

  if (typeof fromAuth === 'string' && fromAuth) {
    return fromAuth;
  }

  const header = socket.handshake.headers.authorization;

  return header?.startsWith('Bearer ')
    ? header.slice(7)
    : undefined;
};

/** Creates a Socket.IO authentication error. */
const reject = (code: ErrorCode) => {
  const err = new Error(code) as Error & {
    data?: { code: ErrorCode };
  };

  err.data = { code };
  return err;
};

/**
 * Initializes Socket.IO, configures JWT authentication,
 * and registers booking, tracking and ticket socket events.
 */
export const initSockets = (server: HttpServer): Server => {
  const origins = (
    process.env.CORS_ORIGINS ||
    'http://localhost:3000,http://localhost:5173'
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  io = new Server(server, {
    cors: {
      origin: origins,
      credentials: true,
    },
  });

  io.use((socket, next) => {
    const token = tokenFrom(socket);

    if (!token) {
      return next(reject(ERROR_CODES.NO_ACCESS_TOKEN));
    }

    try {
      socket.data.auth = authService.verifyAccessToken(token);
      return next();
    } catch {
      return next(reject(ERROR_CODES.INVALID_ACCESS_TOKEN));
    }
  });

  io.on('connection', (socket) => {
    const auth = socket.data.auth as AccessTokenPayload;

    // Automatically join the authenticated user's and role's rooms.
    void socket.join([
      rooms.user(auth.sub),
      rooms.role(auth.role),
    ]);

    // Booking room access is checked for every join request.
    socket.on(
      'booking:join',
      async (payload: unknown, ack?: AckFn) => {
        const reply: AckFn =
          typeof ack === 'function' ? ack : () => undefined;

        const parsed = bookingPayload.safeParse(payload);

        if (!parsed.success) {
          return reply({
            ok: false,
            code: ERROR_CODES.VALIDATION_ERROR,
            message: 'bookingId is required',
          });
        }

        try {
          const allowed = await canJoinBooking(
            auth,
            parsed.data.bookingId,
          );

          if (!allowed) {
            return reply({
              ok: false,
              code: ERROR_CODES.RESOURCE_FORBIDDEN,
              message: 'You cannot join this booking',
            });
          }

          await socket.join(rooms.booking(parsed.data.bookingId));

          return reply({ ok: true });
        } catch {
          return reply({
            ok: false,
            code: ERROR_CODES.INTERNAL_ERROR,
            message: 'Could not join booking',
          });
        }
      },
    );

    socket.on('booking:leave', (payload: unknown) => {
      const parsed = bookingPayload.safeParse(payload);

      if (parsed.success) {
        void socket.leave(rooms.booking(parsed.data.bookingId));
      }
    });

    // --------------------------------------------------
    // TRACKING + TICKET SOCKET EVENTS
    // --------------------------------------------------

    // Preserve the existing tracking and ticket event implementations.
    registerTrackingSocket(socket);
    registerTicketSocket(socket);
  });

  return io;
};
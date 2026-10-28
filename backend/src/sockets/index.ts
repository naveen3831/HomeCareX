
import type { Server as HttpServer } from 'http';
import { Server, type Socket } from 'socket.io';
import { z } from 'zod';

import { ERROR_CODES, type ErrorCode } from '../constants/errorCodes';
import BookingModel from '../models/Booking';
import PartnerModel from '../models/Partner';
import { authService } from '../modules/auth/auth.service';
import type { AccessTokenPayload } from '../modules/auth/auth.types';

import { registerTrackingSocket } from './tracking.socket';
import { registerTicketSocket } from './ticket.socket';

/**
 * Room names.
 *
 * A socket automatically joins:
 * - user:<id>
 * - role:<role>
 *
 * A socket can join:
 * - booking:<id> after successful booking:join authorization
 * - tracking:<id> after successful tracking:join authorization
 * - ticket:admin:<id> after successful ticket:join authorization
 *
 * Tracking and ticket rooms are managed by their respective socket modules.
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

/**
 * Returns the initialized Socket.IO server.
 * Throws if initSockets() has not been called.
 */
export const getIO = (): Server => {
  if (!io) {
    throw new Error(
      'Socket.IO has not been initialised. Call initSockets(server) first.',
    );
  }

  return io;
};

/**
 * Returns the Socket.IO server if initialized.
 * Useful in tests and scripts where sockets may not be started.
 */
export const getIOIfReady = (): Server | null => io;

/**
 * Emits an event to a user's room.
 */
export const emitToUser = (
  userId: string,
  event: string,
  payload: unknown,
) => getIO().to(rooms.user(userId)).emit(event, payload);

/**
 * Emits an event to a booking's room.
 */
export const emitToBooking = (
  bookingId: string,
  event: string,
  payload: unknown,
) => getIO().to(rooms.booking(bookingId)).emit(event, payload);

/**
 * Determines whether an authenticated user can join a booking room.
 *
 * - Admin: any existing booking.
 * - Customer: only their own booking.
 * - Partner: only a booking assigned to their partner profile.
 */
async function canJoinBooking(
  auth: AccessTokenPayload,
  bookingId: string,
): Promise<boolean> {
  if (auth.role === 'admin') {
    return Boolean(await BookingModel.exists({ _id: bookingId }));
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

/**
 * Extracts an access token from the Socket.IO handshake.
 */
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

/**
 * Creates a Socket.IO authentication error.
 */
const reject = (code: ErrorCode) => {
  const err = new Error(code) as Error & {
    data?: { code: ErrorCode };
  };

  err.data = { code };

  return err;
};

/**
 * Initializes Socket.IO, configures JWT authentication,
 * and registers booking, tracking, and ticket socket events.
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

  // Authenticate every socket connection using an access token.
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

    // Automatically join the user's room and role room.
    void socket.join([
      rooms.user(auth.sub),
      rooms.role(auth.role),
    ]);

    // Join a booking room only after authorization.
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

    // Leave a booking room when a valid booking ID is provided.
    socket.on('booking:leave', (payload: unknown) => {
      const parsed = bookingPayload.safeParse(payload);

      if (parsed.success) {
        void socket.leave(rooms.booking(parsed.data.bookingId));
      }
    });

    // Preserve the tracking and ticket event implementations.
    registerTrackingSocket(socket);
    registerTicketSocket(socket);
  });

  return io;
};

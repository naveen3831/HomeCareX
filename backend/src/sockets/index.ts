import type { Server as HttpServer } from 'http';
import { Server, type Socket } from 'socket.io';
import { z } from 'zod';

import { authService } from '../modules/auth/auth.service';
import type { AccessTokenPayload } from '../modules/auth/auth.types';
import BookingModel from '../models/Booking';
import PartnerModel from '../models/Partner';
import PartnerLocationModel from '../models/PartnerLocation';
import { ERROR_CODES, type ErrorCode } from '../constants/errorCodes';
import { registerTicketSocket } from './ticket.socket';

/**
 * Room names.
 *
 * A socket joins:
 * - user:<id>
 * - role:<role>
 * - booking:<id> after successful booking:join authorization
 * - tracking:<id> after successful tracking:join authorization
 * - ticket rooms through ticket.socket.ts
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

type TrackingSnapshot = {
  bookingId: string;
  status: string;
  partnerAssigned: boolean;
  location: {
    sharing: boolean;
    lat: number | null;
    lng: number | null;
    accuracy: number | null;
    heading: number | null;
    updatedAt: string | null;
  };
};

type TrackingJoinAck =
  | { ok: true; snapshot: TrackingSnapshot }
  | { ok: false; code: ErrorCode; message: string };

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
 */
export const getIOIfReady = (): Server | null => io;

/**
 * Emits an event to a specific user's room.
 */
export const emitToUser = (
  userId: string,
  event: string,
  payload: unknown,
) => getIO().to(rooms.user(userId)).emit(event, payload);

/**
 * Emits an event to a specific booking's room.
 */
export const emitToBooking = (
  bookingId: string,
  event: string,
  payload: unknown,
) => getIO().to(rooms.booking(bookingId)).emit(event, payload);

/**
 * Checks whether the authenticated user can join a booking room.
 *
 * Customers can join their own bookings.
 * Partners can join bookings assigned to them.
 * Admins can join booking rooms.
 */
const canJoinBooking = async (
  auth: AccessTokenPayload,
  bookingId: string,
): Promise<boolean> => {
  if (auth.role === 'admin') {
    return true;
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

    return (
      !!partner &&
      !!(await BookingModel.exists({
        _id: bookingId,
        partnerId: partner._id,
      }))
    );
  }

  return false;
};

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
 * and registers booking and ticket socket events.
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

  // Authenticate each socket using an access token.
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

    // Register ticket:join and ticket:leave handlers.
    // Ticket authorization remains inside ticket.socket.ts.
    registerTicketSocket(socket);

    // --------------------------------------------------
    // BOOKING SOCKET EVENTS
    // --------------------------------------------------

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

          await socket.join(
            rooms.booking(parsed.data.bookingId),
          );

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
        void socket.leave(
          rooms.booking(parsed.data.bookingId),
        );
      }
    });

    // --------------------------------------------------
    // CUSTOMER TRACKING SOCKET EVENTS
    // --------------------------------------------------

    socket.on(
      'tracking:join',
      async (
        payload: unknown,
        ack?: (result: TrackingJoinAck) => void,
      ) => {
        const reply =
          typeof ack === 'function' ? ack : () => undefined;

        const parsed = bookingPayload.safeParse(payload);

        if (!parsed.success) {
          return reply({
            ok: false,
            code: ERROR_CODES.VALIDATION_ERROR,
            message: 'bookingId is required',
          });
        }

        // Only customers may subscribe to booking tracking.
        if (auth.role !== 'customer') {
          return reply({
            ok: false,
            code: ERROR_CODES.RESOURCE_FORBIDDEN,
            message: 'You cannot track this booking',
          });
        }

        try {
          const ownsBooking = await BookingModel.exists({
            _id: parsed.data.bookingId,
            customerId: auth.sub,
          });

          if (!ownsBooking) {
            return reply({
              ok: false,
              code: ERROR_CODES.RESOURCE_FORBIDDEN,
              message: 'You cannot track this booking',
            });
          }

          const booking = await BookingModel.findById(
            parsed.data.bookingId,
          )
            .select('status partnerId')
            .lean<{
              status: string;
              partnerId?: unknown;
            }>();

          if (!booking) {
            return reply({
              ok: false,
              code: ERROR_CODES.RESOURCE_FORBIDDEN,
              message: 'You cannot track this booking',
            });
          }

          const location = await PartnerLocationModel.findOne({
            bookingId: parsed.data.bookingId,
          }).lean();

          await socket.join(
            rooms.tracking(parsed.data.bookingId),
          );

          return reply({
            ok: true,
            snapshot: {
              bookingId: parsed.data.bookingId,
              status: booking.status,
              partnerAssigned: Boolean(booking.partnerId),
              location: {
                sharing: location?.sharing ?? false,
                lat: location?.lat ?? null,
                lng: location?.lng ?? null,
                accuracy: location?.accuracy ?? null,
                heading: location?.heading ?? null,
                updatedAt:
                  location?.updatedAt?.toISOString() ?? null,
              },
            },
          });
        } catch {
          return reply({
            ok: false,
            code: ERROR_CODES.INTERNAL_ERROR,
            message: 'Could not join tracking',
          });
        }
      },
    );

    socket.on('tracking:leave', (payload: unknown) => {
      const parsed = bookingPayload.safeParse(payload);

      if (parsed.success) {
        void socket.leave(
          rooms.tracking(parsed.data.bookingId),
        );
      }
    });
  });

  return io;
};
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
 * - tracking:<id> after successful tracking:join authorization (customer only)
 * - ticket:admin:<id> after successful ticket:join authorization
 */
export const rooms = {
  user: (userId: string) => `user:${userId}`,
  role: (role: string) => `role:${role}`,
  booking: (bookingId: string) => `booking:${bookingId}`,
};

export const trackingRoom = (bookingId: string) => `tracking:${bookingId}`;

export type JoinAck =
  | { ok: true }
  | { ok: false; code: ErrorCode; message: string };

type AckFn = (res: JoinAck) => void;

const bookingPayload = z.object({
  bookingId: z.string().regex(/^[a-f\d]{24}$/i),
});

let io: Server | null = null;

export const getIOIfReady = (): Server | null => io;

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

export const emitToUser = (userId: string, event: string, payload: unknown) =>
  getIO().to(rooms.user(userId)).emit(event, payload);

export const emitToBooking = (
  bookingId: string,
  event: string,
  payload: unknown,
) => getIO().to(rooms.booking(bookingId)).emit(event, payload);

export const emitToTracking = (
  bookingId: string,
  event: string,
  payload: unknown,
) => getIO().to(trackingRoom(bookingId)).emit(event, payload);

/**
 * Whether this user may join the booking room.
 * Admins: any booking. Customers: their own. Partners: bookings assigned to them.
 */
async function canJoinBooking(
  auth: AccessTokenPayload,
  bookingId: string,
): Promise<boolean> {
  if (auth.role === 'admin') return true;

  if (auth.role === 'customer') {
    return !!(await BookingModel.exists({
      _id: bookingId,
      customerId: auth.sub,
    }));
  }

  if (auth.role === 'partner') {
    const partner = await PartnerModel.findOne({ userId: auth.sub })
      .select('_id')
      .lean();

    return (
      !!partner &&
      !!(
        await BookingModel.exists({
          _id: bookingId,
          partnerId: partner._id,
        })
      )
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

  return header?.startsWith('Bearer ') ? header.slice(7) : undefined;
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

type TrackingAck = (res: {
  ok: boolean;
  code?: ErrorCode;
  snapshot?: {
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
}) => void;

/**
 * Initializes Socket.IO, configures JWT authentication,
 * and registers booking, tracking and ticket socket events.
 */
export const initSockets = (server: HttpServer): Server => {
  const origins = (
    process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:5173'
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

    // Automatically join the user's room and their role room.
    void socket.join([rooms.user(auth.sub), rooms.role(auth.role)]);

    // Register ticket:join and ticket:leave handlers.
    // Ticket authorization remains inside ticket.socket.ts.
    registerTicketSocket(socket);

    // --------------------------------------------------
    // BOOKING SOCKET EVENTS
    // --------------------------------------------------

    socket.on('booking:join', async (payload: unknown, ack?: AckFn) => {
      const reply: AckFn = typeof ack === 'function' ? ack : () => undefined;

      const parsed = bookingPayload.safeParse(payload);

      if (!parsed.success) {
        return reply({
          ok: false,
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'bookingId is required',
        });
      }

      try {
        const allowed = await canJoinBooking(auth, parsed.data.bookingId);

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
    });

    socket.on('booking:leave', (payload: unknown) => {
      const parsed = bookingPayload.safeParse(payload);

      if (parsed.success) {
        void socket.leave(rooms.booking(parsed.data.bookingId));
      }
    });

    // --------------------------------------------------
    // LIVE TRACKING SOCKET EVENTS (customer only)
    // --------------------------------------------------

    socket.on('tracking:join', async (payload: unknown, ack?: TrackingAck) => {
      const reply: TrackingAck =
        typeof ack === 'function' ? ack : () => undefined;

      const parsed = bookingPayload.safeParse(payload);
      if (!parsed.success) {
        return reply({ ok: false, code: ERROR_CODES.VALIDATION_ERROR });
      }

      if (auth.role !== 'customer') {
        return reply({ ok: false, code: ERROR_CODES.RESOURCE_FORBIDDEN });
      }

      try {
        const ownsBooking = await BookingModel.exists({
          _id: parsed.data.bookingId,
          customerId: auth.sub,
        });
        if (!ownsBooking) {
          return reply({ ok: false, code: ERROR_CODES.RESOURCE_FORBIDDEN });
        }

        const booking = await BookingModel.findById(parsed.data.bookingId)
          .select('status partnerId')
          .lean<{ status: string; partnerId?: unknown }>();
        if (!booking) {
          return reply({ ok: false, code: ERROR_CODES.RESOURCE_FORBIDDEN });
        }

        const location = await PartnerLocationModel.findOne({
          bookingId: parsed.data.bookingId,
        }).lean<{
          sharing?: boolean;
          lat?: number;
          lng?: number;
          accuracy?: number;
          heading?: number;
          updatedAt?: Date;
        }>();

        await socket.join(trackingRoom(parsed.data.bookingId));

        return reply({
          ok: true,
          snapshot: {
            status: booking.status,
            partnerAssigned: Boolean(booking.partnerId),
            location: {
              sharing: location?.sharing ?? false,
              lat: location?.lat ?? null,
              lng: location?.lng ?? null,
              accuracy: location?.accuracy ?? null,
              heading: location?.heading ?? null,
              updatedAt: location?.updatedAt?.toISOString() ?? null,
            },
          },
        });
      } catch (error) {
        console.error('[sockets] Failed to join booking tracking room', error);
        return reply({ ok: false, code: ERROR_CODES.INTERNAL_ERROR });
      }
    });

    socket.on('tracking:leave', (payload: unknown) => {
      const parsed = bookingPayload.safeParse(payload);
      if (parsed.success) {
        void socket.leave(trackingRoom(parsed.data.bookingId));
      }
    });
  });

  return io;
};
import type {
  Server,
  Socket,
} from "socket.io";

type SocketUser = {
  id: string;
  role: string;
};

type AuthenticatedSocket = Socket & {
  data: {
    user?: SocketUser;
  };
};

/**
 * TODO: INTEGRATE with your Booking model.
 *
 * Return true only when the verified socket user is the
 * customer or assigned partner for this booking.
 */
async function canAccessBooking(
  _bookingId: string,
  _user: SocketUser
): Promise<boolean> {
  // Safe default: no room access until authorization exists.
  return false;
}

export function registerBookingSocketHandlers(
  io: Server
) {
  io.on("connection", (rawSocket) => {
    const socket = rawSocket as AuthenticatedSocket;

    socket.on(
      "booking:join",
      async (
        payload: { bookingId?: string },
        callback?: (
          result: {
            ok: boolean;
            message?: string;
          }
        ) => void
      ) => {
        try {
          const user = socket.data.user;
          const bookingId = payload?.bookingId;

          if (
            !user ||
            !bookingId ||
            !(await canAccessBooking(bookingId, user))
          ) {
            callback?.({
              ok: false,
              message: "Booking room access denied.",
            });
            return;
          }

          await socket.join(`booking:${bookingId}`);

          callback?.({ ok: true });
        } catch {
          callback?.({
            ok: false,
            message: "Unable to join booking room.",
          });
        }
      }
    );

    socket.on(
      "booking:leave",
      async (payload: { bookingId?: string }) => {
        if (payload?.bookingId) {
          await socket.leave(
            `booking:${payload.bookingId}`
          );
        }
      }
    );

    // Do not accept client-originated authoritative
    // partner:location_update events. The backend controller
    // emits that event only after validating and saving location.
  });
}
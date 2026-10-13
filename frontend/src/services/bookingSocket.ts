import { io, type Socket } from "socket.io-client";
import { tokenStore } from "@/lib/tokenStore";

let socket: Socket | null = null;

/** One shared connection per tab. The JWT is read on every (re)connect, so a refreshed token is picked up. */
export function getSocket(): Socket {
  if (!socket) {
    const url =
      (import.meta.env.VITE_SOCKET_URL as string | undefined) ||
      "http://localhost:5000";
    socket = io(url, {
      auth: (cb) => cb({ token: tokenStore.get() }),
      reconnection: true,
      reconnectionDelayMax: 10_000,
    });
  }
  return socket;
}

/**
 * Asks the server to add this socket to `booking:<id>`. The server only agrees for the booking's
 * customer, its assigned partner or an admin. Rooms are lost on reconnect, so callers re-join then.
 */
export function joinBookingRoom(
  s: Socket,
  bookingId: string,
): Promise<boolean> {
  return new Promise((resolve) => {
    s.timeout(5_000).emit(
      "booking:join",
      { bookingId },
      (err: Error | null, res?: { ok?: boolean }) => {
        resolve(!err && res?.ok === true);
      },
    );
  });
}

export function leaveBookingRoom(s: Socket, bookingId: string): void {
  s.emit("booking:leave", { bookingId });
}

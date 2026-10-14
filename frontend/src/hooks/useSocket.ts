import { useEffect, useState } from "react";
import type { Socket } from "socket.io-client";
import { getSocket } from "@/services/bookingSocket";

/** The tab's shared Socket.IO connection, plus whether it is connected right now. */
export function useSocket(): { socket: Socket; connected: boolean } {
  const [socket] = useState<Socket>(() => getSocket());
  const [connected, setConnected] = useState<boolean>(socket.connected);

  useEffect(() => {
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    setConnected(socket.connected);
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, [socket]);

  return { socket, connected };
}
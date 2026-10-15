import { useCallback, useEffect, useState } from "react";
import { useSocket } from "@/hooks/useSocket";
import {
  TRACKING_JOIN_EVENT,
  TRACKING_LEAVE_EVENT,
  TRACKING_LOCATION_EVENT,
  TRACKING_STATUS_EVENT,
  type TrackingJoinAck,
  type TrackingLocation,
  type TrackingLocationEvent,
  type TrackingStatusEvent,
} from "@/types/tracking";

/**
 * connecting:   waiting for the socket or the join reply
 * live:         joined, events are flowing
 * reconnecting: was live, the connection dropped; the last data stays on screen
 * denied:       the server refused the join (not this customer's booking)
 * error:        could not connect or join; the page keeps showing saved data
 */
export type TrackingPhase =
  | "connecting"
  | "live"
  | "reconnecting"
  | "denied"
  | "error";

const JOIN_TIMEOUT_MS = 5_000;

/**
 * Live tracking for one of the signed-in customer's bookings.
 * Joining replies with a snapshot, so the same call serves the first join and every reconnect
 * (the server forgets rooms when a socket reconnects, so we join again on each `connect`).
 */
export function useTracking(bookingId: string | undefined) {
  const { socket } = useSocket();
  const [phase, setPhase] = useState<TrackingPhase>("connecting");
  const [status, setStatus] = useState<string | null>(null);
  const [location, setLocation] = useState<TrackingLocation | null>(null);
  const [partnerAssigned, setPartnerAssigned] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!bookingId) return;
    let cancelled = false;
    setPhase("connecting");

    const join = () => {
      socket
        .timeout(JOIN_TIMEOUT_MS)
        .emit(
          TRACKING_JOIN_EVENT,
          { bookingId },
          (err: Error | null, ack?: TrackingJoinAck) => {
            if (cancelled) return;
            if (err || !ack) return setPhase("error");
            if (!ack.ok) {
              return setPhase(
                ack.code === "RESOURCE_FORBIDDEN" ? "denied" : "error",
              );
            }
            setStatus(ack.snapshot.status);
            setLocation(ack.snapshot.location);
            setPartnerAssigned(ack.snapshot.partnerAssigned);
            setPhase("live");
          },
        );
    };

    const onLocation = (event: TrackingLocationEvent) => {
      if (event.bookingId !== bookingId) return;
      setLocation({
        sharing: event.sharing,
        lat: event.lat,
        lng: event.lng,
        accuracy: event.accuracy,
        heading: event.heading,
        updatedAt: event.updatedAt,
      });
    };
    const onStatus = (event: TrackingStatusEvent) => {
      if (event.bookingId === bookingId) setStatus(event.status);
    };
    const onDisconnect = () =>
      setPhase((p) => (p === "live" ? "reconnecting" : p));
    const onConnectError = () =>
      setPhase((p) => (p === "live" ? "reconnecting" : "error"));

    socket.on("connect", join);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);
    socket.on(TRACKING_LOCATION_EVENT, onLocation);
    socket.on(TRACKING_STATUS_EVENT, onStatus);
    if (socket.connected) join();

    return () => {
      cancelled = true;
      socket.off("connect", join);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
      socket.off(TRACKING_LOCATION_EVENT, onLocation);
      socket.off(TRACKING_STATUS_EVENT, onStatus);
      if (socket.connected) socket.emit(TRACKING_LEAVE_EVENT, { bookingId });
    };
  }, [socket, bookingId, attempt]);

  /** Tries the connection and the join again, e.g. after an error. */
  const retry = useCallback(() => {
    if (!socket.connected) socket.connect();
    setAttempt((n) => n + 1);
  }, [socket]);

  return { phase, status, location, partnerAssigned, retry };
}

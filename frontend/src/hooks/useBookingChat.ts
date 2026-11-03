import { useCallback, useEffect, useRef, useState } from "react";
import {
  getSocket,
  joinBookingRoom,
  leaveBookingRoom,
} from "@/services/bookingSocket";
import {
  errorMessage,
  fetchMessages,
  httpStatus,
  postMessage,
} from "@/services/Chat.api";
import { NEW_MESSAGE_EVENT, type ChatMessage } from "@/services/Chat.types";

export type ChatLoad = "loading" | "ready" | "unavailable" | "error";

/** Union by id, oldest first. Ids are Mongo ObjectIds, so they sort in creation order. */
function merge(
  existing: ChatMessage[],
  incoming: ChatMessage[],
): ChatMessage[] {
  const byId = new Map(existing.map((m) => [m.id, m]));
  for (const m of incoming) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  );
}

export function useBookingChat(bookingId: string) {
  const [load, setLoad] = useState<ChatLoad>("loading");
  const [loadMessage, setLoadMessage] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [live, setLive] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const connectedBefore = useRef(false);

  // Initial page.
  useEffect(() => {
    let cancelled = false;
    setLoad("loading");
    setMessages([]);
    fetchMessages(bookingId)
      .then((page) => {
        if (cancelled) return;
        setMessages((prev) => merge(prev, page.messages));
        setNextCursor(page.nextCursor);
        setLoad("ready");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const status = httpStatus(err);
        if (status === 403 || status === 404) {
          setLoad("unavailable"); // someone else's booking looks the same as a missing one
        } else {
          setLoadMessage(errorMessage(err, "Could not load the conversation."));
          setLoad("error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [bookingId, reloadKey]);

  // Realtime: join the booking room, append new messages, and catch up after a reconnect.
  useEffect(() => {
    const socket = getSocket();
    let cancelled = false;

    const join = () => {
      void joinBookingRoom(socket, bookingId).then((ok) => {
        if (!cancelled) setLive(ok);
      });
    };
    const onMessage = (m: ChatMessage) => {
      if (m.bookingId === bookingId) setMessages((prev) => merge(prev, [m]));
    };
    const onConnect = () => {
      join();
      if (connectedBefore.current) {
        // Messages sent while we were disconnected never reached us over the socket.
        fetchMessages(bookingId)
          .then(
            (page) =>
              !cancelled && setMessages((prev) => merge(prev, page.messages)),
          )
          .catch(() => undefined);
      }
      connectedBefore.current = true;
    };
    const onDown = () => setLive(false);

    socket.on(NEW_MESSAGE_EVENT, onMessage);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDown);
    socket.on("connect_error", onDown);
    if (socket.connected) {
      connectedBefore.current = true;
      join();
    }
    return () => {
      cancelled = true;
      socket.off(NEW_MESSAGE_EVENT, onMessage);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDown);
      socket.off("connect_error", onDown);
      if (socket.connected) leaveBookingRoom(socket, bookingId);
    };
  }, [bookingId]);

  // Safety net: the socket can drop without telling us (sleeping phone, proxy, expired token).
  // Re-read the newest page on a timer (fast while not live, slow while live) and when the tab
  // comes back to the front. merge() dedupes by id, so this never shows a message twice.
  useEffect(() => {
    if (load !== "ready") return undefined;
    let cancelled = false;
    const catchUp = () => {
      if (document.visibilityState === "hidden" || !navigator.onLine) return;
      fetchMessages(bookingId)
        .then(
          (page) =>
            !cancelled && setMessages((prev) => merge(prev, page.messages)),
        )
        .catch(() => undefined);
    };
    const timer = window.setInterval(catchUp, live ? 20_000 : 4_000);
    document.addEventListener("visibilitychange", catchUp);
    window.addEventListener("focus", catchUp);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", catchUp);
      window.removeEventListener("focus", catchUp);
    };
  }, [bookingId, load, live]);

  const loadOlder = useCallback(async () => {
    if (!nextCursor || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const page = await fetchMessages(bookingId, nextCursor);
      setMessages((prev) => merge(prev, page.messages));
      setNextCursor(page.nextCursor);
    } catch (err) {
      setSendError(errorMessage(err, "Could not load older messages."));
    } finally {
      setLoadingOlder(false);
    }
  }, [bookingId, nextCursor, loadingOlder]);

  /** Resolves true when the message was stored, so the composer knows whether to clear itself. */
  const send = useCallback(
    async (text: string, photos: string[]): Promise<boolean> => {
      setSending(true);
      setSendError(null);
      try {
        const saved = await postMessage(bookingId, {
          text: text.trim() || undefined,
          photos,
        });
        setMessages((prev) => merge(prev, [saved])); // the realtime copy of the same id is deduped
        return true;
      } catch (err) {
        setSendError(errorMessage(err, "Message not sent. Please try again."));
        return false;
      } finally {
        setSending(false);
      }
    },
    [bookingId],
  );

  return {
    load,
    loadMessage,
    messages,
    hasOlder: nextCursor !== null,
    loadingOlder,
    live,
    sending,
    sendError,
    loadOlder,
    send,
    reload: () => setReloadKey((k) => k + 1),
  };
}
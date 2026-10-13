import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { fileToDataUrl } from "@/lib/imageFile";
import { useBookingChat } from "@/hooks/useBookingChat";
import "./ChatPanel.css";

const MAX_TEXT = 1000;
const MAX_PHOTOS = 3;
/** Must stay in step with MAX_ATTACHMENT_CHARS in backend/src/modules/chat/chat.validation.ts. */
const MAX_PHOTO_CHARS = 220_000;

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });

async function compress(file: File): Promise<string> {
  for (const [edge, quality] of [
    [800, 0.7],
    [600, 0.55],
    [480, 0.45],
  ] as const) {
    const url = await fileToDataUrl(file, edge, quality);
    if (url.length <= MAX_PHOTO_CHARS) return url;
  }
  throw new Error(`${file.name} is too large. Choose a smaller photo.`);
}

interface Props {
  bookingId: string;
  /** Whose side of the conversation this panel is. Bubbles from this role are shown on the right. */
  viewerRole?: "partner" | "customer";
}

export default function ChatPanel({
  bookingId,
  viewerRole = "partner",
}: Props) {
  const online = useOnlineStatus();
  const chat = useBookingChat(bookingId);
  const [text, setText] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const fileRef = useRef<HTMLInputElement>(null);

  // Keep the newest message in view, unless the partner scrolled up to read history.
  useLayoutEffect(() => {
    const el = listRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [chat.messages, chat.load]);

  useEffect(() => {
    if (chat.load === "ready") stickToBottom.current = true;
  }, [chat.load]);

  const onScroll = () => {
    const el = listRef.current;
    if (el)
      stickToBottom.current =
        el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  const canSend =
    online &&
    !chat.sending &&
    !processing &&
    (text.trim().length > 0 || photos.length > 0);

  const submit = async () => {
    if (!canSend) return;
    stickToBottom.current = true;
    if (await chat.send(text, photos)) {
      setText("");
      setPhotos([]);
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  };

  const onPick = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    setPhotoError(null);
    setProcessing(true);
    try {
      const room = MAX_PHOTOS - photos.length;
      if (files.length > room)
        setPhotoError(`You can attach up to ${MAX_PHOTOS} photos per message.`);
      const added: string[] = [];
      for (const f of files.slice(0, Math.max(0, room))) {
        if (!/^image\/(jpeg|png|webp)$/.test(f.type))
          throw new Error("Choose JPG, PNG or WebP photos.");
        added.push(await compress(f));
      }
      setPhotos((prev) => [...prev, ...added]);
    } catch (err) {
      setPhotoError(
        err instanceof Error ? err.message : "Could not read that photo.",
      );
    } finally {
      setProcessing(false);
    }
  };

  if (chat.load === "loading") {
    return (
      <section className="cp" aria-busy="true" aria-label="Loading chat">
        <div className="cp-skel" />
        <div className="cp-skel cp-skel-short" />
        <div className="cp-skel" />
      </section>
    );
  }

  if (chat.load === "unavailable") {
    return (
      <section className="cp cp-center" aria-label="Chat">
        <p className="cp-empty-title">Chat unavailable</p>
        <p className="cp-muted">
          This booking was not found, or it is not assigned to you.
        </p>
      </section>
    );
  }

  if (chat.load === "error") {
    return (
      <section className="cp cp-center" aria-label="Chat">
        <p className="cp-alert" role="alert">
          {chat.loadMessage}
        </p>
        <button type="button" className="cp-btn" onClick={chat.reload}>
          Try again
        </button>
      </section>
    );
  }

  return (
    <section className="cp" aria-label="Chat with customer">
      <header className="cp-head">
        <h3 className="cp-title">Chat with customer</h3>
        <span
          className={`cp-live ${chat.live ? "cp-live-on" : ""}`}
          role="status"
        >
          <span className="cp-dot" aria-hidden="true" />
          {chat.live ? "Live" : online ? "Connecting…" : "Offline"}
        </span>
      </header>

      {!online && (
        <p className="cp-offline" role="status">
          You are offline. You can read earlier messages, but sending is paused
          until you reconnect.
        </p>
      )}

      <div
        className="cp-list"
        ref={listRef}
        onScroll={onScroll}
        role="log"
        aria-live="polite"
        aria-label="Messages"
        tabIndex={0}
      >
        {chat.hasOlder && (
          <button
            type="button"
            className="cp-older"
            onClick={() => void chat.loadOlder()}
            disabled={chat.loadingOlder}
          >
            {chat.loadingOlder ? "Loading…" : "Load earlier messages"}
          </button>
        )}
        {chat.messages.length === 0 ? (
          <div className="cp-center cp-empty">
            <p className="cp-empty-title">No messages yet</p>
            <p className="cp-muted">
              Say hello to the customer, or tell them when you will arrive.
            </p>
          </div>
        ) : (
          chat.messages.map((m) => {
            const mine = m.senderRole === viewerRole;
            return (
              <article
                key={m.id}
                className={`cp-msg ${mine ? "cp-msg-mine" : "cp-msg-theirs"}`}
              >
                <div className="cp-bubble">
                  {m.attachments.map((a, i) => (
                    <img
                      key={i}
                      className="cp-photo"
                      src={a.url}
                      alt={`Photo from ${mine ? "you" : m.senderRole}`}
                      loading="lazy"
                    />
                  ))}
                  {m.text && <p className="cp-text">{m.text}</p>}
                </div>
                <span className="cp-time">
                  {mine
                    ? "You"
                    : m.senderRole === "customer"
                      ? "Customer"
                      : "Partner"}{" "}
                  · {time(m.createdAt)}
                </span>
              </article>
            );
          })
        )}
      </div>

      {(chat.sendError || photoError) && (
        <p className="cp-alert" role="alert">
          {chat.sendError ?? photoError}
        </p>
      )}

      {photos.length > 0 && (
        <ul className="cp-previews" aria-label="Photos to send">
          {photos.map((src, i) => (
            <li key={i} className="cp-preview">
              <img src={src} alt={`Attachment ${i + 1}`} />
              <button
                type="button"
                className="cp-remove"
                aria-label={`Remove photo ${i + 1}`}
                onClick={() => setPhotos((p) => p.filter((_, j) => j !== i))}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="cp-compose">
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          hidden
          onChange={(e) => void onPick(e)}
        />
        <button
          type="button"
          className="cp-btn cp-attach"
          aria-label="Attach photo"
          onClick={() => fileRef.current?.click()}
          disabled={processing || photos.length >= MAX_PHOTOS}
        >
          {processing ? "…" : "📎"}
        </button>
        <label className="cp-sr" htmlFor={`cp-input-${bookingId}`}>
          Message
        </label>
        <textarea
          id={`cp-input-${bookingId}`}
          className="cp-input"
          rows={1}
          maxLength={MAX_TEXT}
          placeholder="Type a message"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <button
          type="button"
          className="cp-btn cp-btn-primary"
          onClick={() => void submit()}
          disabled={!canSend}
        >
          {chat.sending ? "Sending…" : "Send"}
        </button>
      </div>
    </section>
  );
}

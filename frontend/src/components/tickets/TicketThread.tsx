import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Paperclip, Send, X, Lock } from "lucide-react";

import {
  ATTACHMENT_ACCEPT,
  MAX_ATTACHMENTS,
  formatBytes,
  validateAttachments,
} from "./attachments";
import { getErrorMessage } from "./getErrorMessage";
import type { TicketMessage, TicketSenderRole } from "./ticket.types";

const MAX_BODY = 4000;

const ROLE_LABEL: Record<TicketSenderRole, string> = {
  partner: "Partner",
  customer: "Customer",
  admin: "Support team",
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

interface TicketThreadProps {
  messages: TicketMessage[];
  /** Whose screen this is. Their messages sit on the right and read "You". */
  viewerRole: TicketSenderRole;
  /** Closed tickets are read-only: no composer is rendered. */
  closed?: boolean;
  /** Must throw on failure so the composer can keep the draft and show the error. */
  onSend: (body: string, files: File[]) => Promise<void>;
  disabled?: boolean;
}

/** Conversation + reply box. Shared by the partner, customer and admin ticket pages. */
export default function TicketThread({
  messages,
  viewerRole,
  closed = false,
  onSend,
  disabled = false,
}: TicketThreadProps) {
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const onPickFiles = (e: ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = ""; // allow picking the same file again after removing it
    const { accepted, errors } = validateAttachments(files, picked);
    setFiles((cur) => [...cur, ...accepted]);
    setFileErrors(errors);
  };

  const removeFile = (index: number) => {
    setFiles((cur) => cur.filter((_, i) => i !== index));
    setFileErrors([]);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) {
      setSendError("Write a message before sending.");
      return;
    }
    setSending(true);
    setSendError(null);
    try {
      await onSend(trimmed, files);
      setBody("");
      setFiles([]);
      setFileErrors([]);
    } catch (err) {
      setSendError(getErrorMessage(err, "Could not send your reply. Try again."));
    } finally {
      setSending(false);
    }
  };

  return (
    <section aria-label="Conversation" className="flex flex-col gap-4">
      <ol className="flex flex-col gap-3" aria-live="polite">
        {messages.length === 0 && (
          <li className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
            No messages yet.
          </li>
        )}

        {messages.map((m) => {
          const mine = m.senderRole === viewerRole;
          return (
            <li
              key={m.id}
              className={`flex ${mine ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[90%] rounded-2xl px-4 py-2.5 text-sm shadow-sm sm:max-w-[75%] ${
                  mine
                    ? "rounded-br-sm bg-[#4338ca] text-white"
                    : "rounded-bl-sm border border-slate-200 bg-white text-slate-800"
                }`}
              >
                <p
                  className={`mb-0.5 text-xs font-medium ${
                    mine ? "text-indigo-100" : "text-slate-500"
                  }`}
                >
                  {mine ? "You" : ROLE_LABEL[m.senderRole]} · {formatTime(m.createdAt)}
                </p>
                <p className="whitespace-pre-wrap break-words">{m.body}</p>

                {m.attachments.length > 0 && (
                  <ul className="mt-2 flex flex-col gap-1">
                    {m.attachments.map((a) => (
                      <li key={a.url}>
                        <a
                          href={a.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`inline-flex max-w-full items-center gap-1.5 rounded-md px-2 py-1 text-xs underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4338ca] ${
                            mine ? "bg-white/15" : "bg-slate-100"
                          }`}
                        >
                          <Paperclip size={12} aria-hidden className="shrink-0" />
                          <span className="truncate">{a.name}</span>
                          <span className="shrink-0 opacity-75">
                            ({formatBytes(a.sizeBytes)})
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
          );
        })}
        <div ref={bottomRef} />
      </ol>

      {closed ? (
        <div
          role="status"
          className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-600"
        >
          <Lock size={16} aria-hidden />
          This ticket is closed, so you can no longer reply. Raise a new ticket
          if you still need help.
        </div>
      ) : (
        <form
          onSubmit={submit}
          className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
          noValidate
        >
          <label htmlFor="ticket-reply" className="sr-only">
            Your reply
          </label>
          <textarea
            id="ticket-reply"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={MAX_BODY}
            rows={3}
            placeholder="Write your reply…"
            disabled={disabled || sending}
            aria-invalid={sendError ? true : undefined}
            aria-describedby={sendError ? "ticket-reply-error" : undefined}
            className="w-full resize-y rounded-md border border-slate-300 p-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#4338ca] disabled:bg-slate-50"
          />

          {files.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-2">
              {files.map((f, i) => (
                <li
                  key={`${f.name}-${i}`}
                  className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-slate-100 py-1 pl-3 pr-1 text-xs text-slate-700"
                >
                  <span className="truncate">
                    {f.name} ({formatBytes(f.size)})
                  </span>
                  <button
                    type="button"
                    onClick={() => removeFile(i)}
                    aria-label={`Remove ${f.name}`}
                    className="rounded-full p-1 hover:bg-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#4338ca]"
                  >
                    <X size={12} aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {fileErrors.length > 0 && (
            <ul role="alert" className="mt-2 text-xs text-red-600">
              {fileErrors.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          )}
          {sendError && (
            <p id="ticket-reply-error" role="alert" className="mt-2 text-xs text-red-600">
              {sendError}
            </p>
          )}

          <div className="mt-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept={ATTACHMENT_ACCEPT}
                multiple
                onChange={onPickFiles}
                className="sr-only"
                tabIndex={-1}
                aria-hidden
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled || sending || files.length >= MAX_ATTACHMENTS}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#4338ca] disabled:opacity-50"
              >
                <Paperclip size={16} aria-hidden />
                Attach
              </button>
              <span className="hidden text-xs text-slate-500 sm:inline">
                {body.length}/{MAX_BODY}
              </span>
            </div>

            <button
              type="submit"
              disabled={disabled || sending}
              className="inline-flex items-center gap-1.5 rounded-md bg-[#4338ca] px-4 py-2 text-sm font-medium text-white hover:bg-[#3730a3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4338ca] disabled:opacity-60"
            >
              <Send size={16} aria-hidden />
              {sending ? "Sending…" : "Send"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

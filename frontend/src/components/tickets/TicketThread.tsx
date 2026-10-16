import { Fragment, useEffect, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Paperclip, Send, X, Lock, LifeBuoy } from "lucide-react";
import clsx from "clsx";

import { NO_SCROLLBAR } from "@/components/customer/noScrollbar";
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

function dayKey(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toDateString();
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function clockTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
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
  /**
   * Chat-app layout: fills its parent's height, the message list scrolls on its own (scrollbar hidden)
   * and the reply box stays pinned at the bottom. Off by default so the customer and admin pages look the same as before.
   */
  fill?: boolean;
}

/** Conversation + reply box. Shared by the partner, customer and admin ticket pages. */
export default function TicketThread({
  messages,
  viewerRole,
  closed = false,
  onSend,
  disabled = false,
  fill = false,
}: TicketThreadProps) {
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (fill) {
      const el = listRef.current;
      if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
      return;
    }
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, fill]);

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
    <section
      aria-label="Conversation"
      className={fill ? "flex h-full min-h-0 flex-col" : "flex flex-col gap-4"}
    >
      <ol
        ref={listRef}
        className={
          fill
            ? clsx("flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto bg-slate-50 px-3 py-4 sm:px-8 sm:py-6", NO_SCROLLBAR)
            : "flex flex-col gap-3"
        }
        aria-live="polite"
      >
        {messages.length === 0 && (
          <li
            className={
              fill
                ? "m-auto max-w-xs rounded-2xl bg-white px-6 py-8 text-center text-sm text-slate-500 shadow-sm ring-1 ring-slate-200"
                : "rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500"
            }
          >
            No messages yet.
          </li>
        )}

        {messages.map((m, idx) => {
          const mine = m.senderRole === viewerRole;
          const newDay = fill && (idx === 0 || dayKey(messages[idx - 1].createdAt) !== dayKey(m.createdAt));
          return (
            <Fragment key={m.id}>
              {newDay && (
                <li aria-hidden className="my-1 flex justify-center">
                  <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400 ring-1 ring-slate-200">
                    {dayLabel(m.createdAt)}
                  </span>
                </li>
              )}
            <li
              className={`flex items-end gap-2 ${mine ? "justify-end" : "justify-start"}`}
            >
              {fill && !mine && (
                <span
                  aria-hidden
                  className="mb-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-sm"
                >
                  <LifeBuoy size={16} />
                </span>
              )}
              <div
                className={
                  fill
                    ? `max-w-[85%] px-4 py-2.5 text-sm sm:max-w-[65%] ${
                        mine
                          ? "rounded-2xl rounded-br-md bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-600/20"
                          : "rounded-2xl rounded-bl-md bg-white text-slate-800 shadow-sm ring-1 ring-slate-200"
                      }`
                    : `max-w-[90%] rounded-2xl px-4 py-2.5 text-sm shadow-sm sm:max-w-[75%] ${
                        mine
                          ? "rounded-br-sm bg-[#4338ca] text-white"
                          : "rounded-bl-sm border border-slate-200 bg-white text-slate-800"
                      }`
                }
              >
                <p
                  className={`mb-0.5 text-xs font-medium ${
                    mine ? "text-indigo-100" : "text-slate-500"
                  }`}
                >
                  {mine ? "You" : ROLE_LABEL[m.senderRole]} · {fill ? clockTime(m.createdAt) : formatTime(m.createdAt)}
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
                          <span className="shrink-0 opacity-75">({formatBytes(a.sizeBytes)})</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
            </Fragment>
          );
        })}
        <div ref={bottomRef} />
      </ol>

      {closed ? (
        <div
          role="status"
          className={
            fill
              ? "flex shrink-0 items-center gap-2 border-t border-slate-200 bg-white px-4 py-4 text-sm text-slate-500 sm:px-8"
              : "flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-600"
          }
        >
          <Lock size={16} aria-hidden className="shrink-0" />
          This ticket is closed, so you can no longer reply. Raise a new ticket if you still need help.
        </div>
      ) : fill ? (
        <form
          onSubmit={submit}
          noValidate
          className="shrink-0 border-t border-slate-200 bg-white px-3 py-3 sm:px-8"
        >
          {(files.length > 0 || fileErrors.length > 0 || sendError) && (
            <div className="mb-2 flex flex-col gap-1.5">
              {files.length > 0 && (
                <ul className="flex flex-wrap gap-2">
                  {files.map((f, i) => (
                    <li
                      key={`${f.name}-${i}`}
                      className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-indigo-50 py-1 pl-3 pr-1 text-xs text-indigo-800"
                    >
                      <span className="truncate">
                        {f.name} ({formatBytes(f.size)})
                      </span>
                      <button
                        type="button"
                        onClick={() => removeFile(i)}
                        aria-label={`Remove ${f.name}`}
                        className="rounded-full p-1 hover:bg-indigo-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
                      >
                        <X size={12} aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {fileErrors.length > 0 && (
                <ul role="alert" className="text-xs text-red-600">
                  {fileErrors.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              )}
              {sendError && (
                <p id="ticket-reply-error" role="alert" className="text-xs text-red-600">
                  {sendError}
                </p>
              )}
            </div>
          )}

          <div className="flex items-end gap-2 rounded-3xl bg-slate-100 p-1.5 ring-1 ring-inset ring-slate-200 focus-within:bg-white focus-within:ring-2 focus-within:ring-indigo-500">
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
              aria-label="Attach files"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600 disabled:opacity-50"
            >
              <Paperclip size={18} aria-hidden />
            </button>

            <label htmlFor="ticket-reply" className="sr-only">
              Your reply
            </label>
            <textarea
              id="ticket-reply"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => {
                // Enter sends, Shift+Enter adds a new line
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
              maxLength={MAX_BODY}
              rows={1}
              placeholder="Write your reply…"
              disabled={disabled || sending}
              aria-invalid={sendError ? true : undefined}
              aria-describedby={sendError ? "ticket-reply-error" : undefined}
              className="max-h-28 min-h-[2.5rem] flex-1 resize-none bg-transparent px-1 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none disabled:opacity-60"
            />

            <button
              type="submit"
              disabled={disabled || sending}
              aria-label={sending ? "Sending" : "Send reply"}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-600/30 hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-60"
            >
              <Send size={17} aria-hidden />
            </button>
          </div>
        </form>
      ) : (
        <form
          onSubmit={submit}
          className={
            fill
              ? "shrink-0 border-t border-line bg-panel p-3 sm:px-6 sm:py-4"
              : "rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
          }
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
            rows={fill ? 2 : 3}
            placeholder="Write your reply…"
            disabled={disabled || sending}
            aria-invalid={sendError ? true : undefined}
            aria-describedby={sendError ? "ticket-reply-error" : undefined}
            className="w-full resize-none rounded-md border border-slate-300 p-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#4338ca] disabled:bg-slate-50"
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
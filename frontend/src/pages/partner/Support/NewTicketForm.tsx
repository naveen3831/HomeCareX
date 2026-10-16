import { useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Paperclip, X } from "lucide-react";

import {
  ATTACHMENT_ACCEPT,
  MAX_ATTACHMENTS,
  formatBytes,
  validateAttachments,
} from "@/components/tickets/attachments";
import { getErrorMessage } from "@/components/tickets/getErrorMessage";
import {
  PARTNER_TICKET_CATEGORIES,
  type PartnerTicketCategory,
  type Ticket,
} from "@/components/tickets/ticket.types";
import { createTicket } from "./support.api";

const OBJECT_ID = /^[a-f\d]{24}$/i;
const SUBJECT_MAX = 200;
const BODY_MAX = 4000;

const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus-visible:border-[#4338ca] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#4338ca]/30 aria-[invalid=true]:border-red-500";

const labelCls = "mb-1.5 block text-sm font-medium text-slate-800";

interface FieldErrors {
  category?: string;
  subject?: string;
  body?: string;
  bookingId?: string;
}

interface Props {
  onCreated: (ticket: Ticket) => void;
  onCancel: () => void;
  disabled?: boolean;
}

export default function NewTicketForm({ onCreated, onCancel, disabled = false }: Props) {
  const [category, setCategory] = useState<PartnerTicketCategory | "">("");
  const [subject, setSubject] = useState("");
  const [bookingId, setBookingId] = useState("");
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const validate = (): FieldErrors => {
    const next: FieldErrors = {};
    if (!PARTNER_TICKET_CATEGORIES.some((c) => c.value === category)) {
      next.category = "Choose what this is about.";
    }
    const s = subject.trim();
    if (!s) next.subject = "Add a short subject.";
    else if (s.length > SUBJECT_MAX) next.subject = `Keep the subject under ${SUBJECT_MAX} characters.`;
    const b = body.trim();
    if (!b) next.body = "Describe what happened.";
    else if (b.length > BODY_MAX) next.body = `Keep the message under ${BODY_MAX} characters.`;
    if (bookingId.trim() && !OBJECT_ID.test(bookingId.trim())) {
      next.bookingId = "That booking ID doesn't look right. Copy it from the job details.";
    }
    return next;
  };

  const onPickFiles = (e: ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = "";
    const { accepted, errors: errs } = validateAttachments(files, picked);
    setFiles((cur) => [...cur, ...accepted]);
    setFileErrors(errs);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const found = validate();
    setErrors(found);
    setSubmitError(null);
    if (Object.keys(found).length > 0) {
      // Move focus to the first invalid field once React has rendered aria-invalid
      requestAnimationFrame(() => {
        formRef.current?.querySelector<HTMLElement>("[aria-invalid='true']")?.focus();
      });
      return;
    }

    setSubmitting(true);
    try {
      const ticket = await createTicket({
        category: category as PartnerTicketCategory,
        subject: subject.trim(),
        body: body.trim(),
        bookingId: bookingId.trim() || undefined,
        files,
      });
      onCreated(ticket);
    } catch (err) {
      setSubmitError(getErrorMessage(err, "Could not create the ticket. Try again."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      ref={formRef}
      onSubmit={submit}
      noValidate
      aria-label="Create a support ticket"
      className="overflow-hidden rounded-xl border border-indigo-200 bg-white shadow-sm"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b border-indigo-100 bg-indigo-50/60 px-5 py-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Raise a ticket</h3>
          <p className="mt-0.5 text-sm text-slate-500">Tell us what went wrong and we'll pick it up.</p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          aria-label="Close the form"
          className="rounded-md p-1.5 text-slate-500 hover:bg-white hover:text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#4338ca]"
        >
          <X size={18} aria-hidden />
        </button>
      </div>

      <div className="flex flex-col gap-5 px-5 py-5">
        {/* Category chips */}
        <div>
          <p id="nt-category-label" className={labelCls}>
            What is this about?
          </p>
          <div
            role="radiogroup"
            aria-labelledby="nt-category-label"
            aria-invalid={errors.category ? true : undefined}
            aria-describedby={errors.category ? "nt-category-err" : undefined}
            tabIndex={-1}
            className="flex flex-wrap gap-2 rounded-lg outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#4338ca]"
          >
            {PARTNER_TICKET_CATEGORIES.map((c) => {
              const selected = category === c.value;
              return (
                <button
                  key={c.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setCategory(c.value)}
                  className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4338ca] ${
                    selected
                      ? "border-[#4338ca] bg-[#4338ca] text-white"
                      : "border-slate-300 bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-50"
                  }`}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
          {errors.category && (
            <p id="nt-category-err" className="mt-1.5 text-xs text-red-600">
              {errors.category}
            </p>
          )}
        </div>

        <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_16rem]">
          <div>
            <label htmlFor="nt-subject" className={labelCls}>
              Subject
            </label>
            <input
              id="nt-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={SUBJECT_MAX}
              placeholder="e.g. Payout for Tuesday's job is missing"
              aria-invalid={errors.subject ? true : undefined}
              aria-describedby={errors.subject ? "nt-subject-err" : undefined}
              className={inputCls}
            />
            {errors.subject && (
              <p id="nt-subject-err" className="mt-1.5 text-xs text-red-600">
                {errors.subject}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="nt-booking" className={labelCls}>
              Booking ID <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <input
              id="nt-booking"
              value={bookingId}
              onChange={(e) => setBookingId(e.target.value)}
              autoComplete="off"
              placeholder="Paste from the job details"
              aria-invalid={errors.bookingId ? true : undefined}
              aria-describedby={errors.bookingId ? "nt-booking-err" : undefined}
              className={inputCls}
            />
            {errors.bookingId && (
              <p id="nt-booking-err" className="mt-1.5 text-xs text-red-600">
                {errors.bookingId}
              </p>
            )}
          </div>
        </div>

        <div>
          <div className="flex items-baseline justify-between">
            <label htmlFor="nt-body" className={labelCls}>
              Message
            </label>
            <span className="text-xs tabular-nums text-slate-400">
              {body.length}/{BODY_MAX}
            </span>
          </div>
          <textarea
            id="nt-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
            maxLength={BODY_MAX}
            placeholder="What happened, and what did you expect to happen?"
            aria-invalid={errors.body ? true : undefined}
            aria-describedby={errors.body ? "nt-body-err" : undefined}
            className={`${inputCls} resize-y`}
          />
          {errors.body && (
            <p id="nt-body-err" className="mt-1.5 text-xs text-red-600">
              {errors.body}
            </p>
          )}
        </div>

        {/* Attachments */}
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/60 p-4">
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
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={submitting || files.length >= MAX_ATTACHMENTS}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#4338ca] disabled:opacity-50"
            >
              <Paperclip size={16} aria-hidden />
              Add files
            </button>
            <span className="text-xs text-slate-500">
              Up to {MAX_ATTACHMENTS} files. JPG, PNG, WebP or PDF, 5 MB each.
            </span>
          </div>

          {files.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2">
              {files.map((f, i) => (
                <li
                  key={`${f.name}-${i}`}
                  className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-slate-200 bg-white py-1 pl-3 pr-1 text-xs text-slate-700"
                >
                  <span className="truncate">
                    {f.name} ({formatBytes(f.size)})
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setFiles((cur) => cur.filter((_, idx) => idx !== i));
                      setFileErrors([]);
                    }}
                    aria-label={`Remove ${f.name}`}
                    className="rounded-full p-1 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#4338ca]"
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
        </div>

        {submitError && (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {submitError}
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3.5">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#4338ca]"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={disabled || submitting}
          className="rounded-lg bg-[#4338ca] px-5 py-2 text-sm font-semibold text-white hover:bg-[#3730a3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4338ca] disabled:opacity-60"
        >
          {submitting ? "Submitting…" : "Submit ticket"}
        </button>
      </div>
    </form>
  );
}
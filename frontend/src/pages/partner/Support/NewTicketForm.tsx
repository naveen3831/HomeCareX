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
const inputCls =
  "w-full rounded-md border border-slate-300 bg-white p-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#4338ca] aria-[invalid=true]:border-red-500";

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
      next.category = "Choose a category.";
    }
    const s = subject.trim();
    if (!s) next.subject = "Add a short subject.";
    else if (s.length > 200) next.subject = "Subject must be 200 characters or fewer.";
    const b = body.trim();
    if (!b) next.body = "Describe the problem.";
    else if (b.length > 4000) next.body = "Message must be 4000 characters or fewer.";
    if (bookingId.trim() && !OBJECT_ID.test(bookingId.trim())) {
      next.bookingId = "That booking ID doesn't look right.";
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
        formRef.current
          ?.querySelector<HTMLElement>("[aria-invalid='true']")
          ?.focus();
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
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
    >
      <h2 className="text-base font-semibold text-slate-900">New ticket</h2>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="nt-category" className="mb-1 block text-sm font-medium text-slate-700">
            Category
          </label>
          <select
            id="nt-category"
            value={category}
            onChange={(e) => setCategory(e.target.value as PartnerTicketCategory | "")}
            aria-invalid={errors.category ? true : undefined}
            aria-describedby={errors.category ? "nt-category-err" : undefined}
            className={inputCls}
          >
            <option value="">Select a category</option>
            {PARTNER_TICKET_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          {errors.category && (
            <p id="nt-category-err" className="mt-1 text-xs text-red-600">
              {errors.category}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="nt-booking" className="mb-1 block text-sm font-medium text-slate-700">
            Booking ID <span className="font-normal text-slate-500">(optional)</span>
          </label>
          <input
            id="nt-booking"
            value={bookingId}
            onChange={(e) => setBookingId(e.target.value)}
            autoComplete="off"
            aria-invalid={errors.bookingId ? true : undefined}
            aria-describedby={errors.bookingId ? "nt-booking-err" : undefined}
            className={inputCls}
          />
          {errors.bookingId && (
            <p id="nt-booking-err" className="mt-1 text-xs text-red-600">
              {errors.bookingId}
            </p>
          )}
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="nt-subject" className="mb-1 block text-sm font-medium text-slate-700">
            Subject
          </label>
          <input
            id="nt-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={200}
            aria-invalid={errors.subject ? true : undefined}
            aria-describedby={errors.subject ? "nt-subject-err" : undefined}
            className={inputCls}
          />
          {errors.subject && (
            <p id="nt-subject-err" className="mt-1 text-xs text-red-600">
              {errors.subject}
            </p>
          )}
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="nt-body" className="mb-1 block text-sm font-medium text-slate-700">
            Message
          </label>
          <textarea
            id="nt-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            maxLength={4000}
            aria-invalid={errors.body ? true : undefined}
            aria-describedby={errors.body ? "nt-body-err" : undefined}
            className={`${inputCls} resize-y`}
          />
          {errors.body && (
            <p id="nt-body-err" className="mt-1 text-xs text-red-600">
              {errors.body}
            </p>
          )}
        </div>
      </div>

      <div className="mt-3">
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
          disabled={submitting || files.length >= MAX_ATTACHMENTS}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#4338ca] disabled:opacity-50"
        >
          <Paperclip size={16} aria-hidden />
          Attach files
        </button>
        <span className="ml-2 text-xs text-slate-500">
          Up to {MAX_ATTACHMENTS} files · JPG, PNG, WebP or PDF · 5 MB each
        </span>

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
                  onClick={() => {
                    setFiles((cur) => cur.filter((_, idx) => idx !== i));
                    setFileErrors([]);
                  }}
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
      </div>

      {submitError && (
        <p role="alert" className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700">
          {submitError}
        </p>
      )}

      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#4338ca]"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={disabled || submitting}
          className="rounded-md bg-[#4338ca] px-4 py-2 text-sm font-medium text-white hover:bg-[#3730a3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4338ca] disabled:opacity-60"
        >
          {submitting ? "Submitting…" : "Submit ticket"}
        </button>
      </div>
    </form>
  );
}

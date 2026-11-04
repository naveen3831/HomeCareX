import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { X } from "lucide-react";

export const REJECT_REASONS = [
  "Too far from my location",
  "Not available at that time",
  "I don't offer this service",
  "Payout is too low",
  "Other",
] as const;

const MIN_LEN = 3;
const MAX_LEN = 300;

interface Props {
  open: boolean;
  /** e.g. "AC Service" — shown so the partner knows which job they are rejecting. */
  jobLabel?: string;
  busy?: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}

/** Builds the string sent to the backend from the chosen chip + free text. */
export const buildRejectReason = (choice: string, note: string): string => {
  const text = note.trim();
  if (choice === "Other" || !choice) return text;
  return text ? `${choice} - ${text}` : choice;
};

export default function RejectReasonDialog({
  open,
  jobLabel,
  busy = false,
  error,
  onCancel,
  onConfirm,
}: Props) {
  const [choice, setChoice] = useState<string>("");
  const [note, setNote] = useState("");
  const [touched, setTouched] = useState(false);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const titleId = useId();
  const noteId = useId();

  /* Start fresh every time the dialog opens. */
  useEffect(() => {
    if (open) {
      setChoice("");
      setNote("");
      setTouched(false);
      window.setTimeout(() => noteRef.current?.focus(), 0);
    }
  }, [open]);

  /* Esc closes (unless a request is in flight). */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  const reason = buildRejectReason(choice, note);
  const valid = reason.length >= MIN_LEN && reason.length <= MAX_LEN;
  const showError = touched && !valid;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (valid && !busy) onConfirm(reason);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onSubmit={submit}
        className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id={titleId} className="text-base font-semibold text-slate-900">
              Why are you rejecting this job?
            </h2>
            {jobLabel && <p className="mt-0.5 text-sm text-slate-500">{jobLabel}</p>}
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            aria-label="Close"
            className="-mr-1 -mt-1 rounded-full p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2" role="radiogroup" aria-label="Common reasons">
          {REJECT_REASONS.map((r) => {
            const selected = choice === r;
            return (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setChoice(selected ? "" : r)}
                className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                  selected
                    ? "border-[#4338ca] bg-[#4338ca] text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {r}
              </button>
            );
          })}
        </div>

        <label htmlFor={noteId} className="mt-4 block text-sm font-medium text-slate-700">
          {choice && choice !== "Other" ? "Add details (optional)" : "Tell us the reason"}
        </label>
        <textarea
          id={noteId}
          ref={noteRef}
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, MAX_LEN))}
          onBlur={() => setTouched(true)}
          rows={3}
          maxLength={MAX_LEN}
          placeholder="Type your reason here…"
          aria-invalid={showError}
          aria-describedby={showError ? `${noteId}-err` : undefined}
          className={`mt-1 w-full resize-none rounded-lg border px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-[#4338ca]/40 ${
            showError ? "border-red-400" : "border-slate-300"
          }`}
        />
        <div className="mt-1 flex justify-between text-xs">
          <span id={`${noteId}-err`} className="text-red-600" role={showError ? "alert" : undefined}>
            {showError ? `Please enter a reason (at least ${MIN_LEN} characters).` : ""}
          </span>
          <span className="text-slate-400">
            {note.length}/{MAX_LEN}
          </span>
        </div>

        {error && (
          <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {error}
          </p>
        )}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Keep job
          </button>
          <button
            type="submit"
            disabled={busy}
            className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
          >
            {busy ? "Rejecting…" : "Reject job"}
          </button>
        </div>
      </form>
    </div>
  );
}

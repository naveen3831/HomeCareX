import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Check, X } from "lucide-react";

export const REJECT_REASONS = [
  "Too far from my location",
  "Not available at that time",
  "Already have another job",
  "I don't offer this service",
  "Payout is too low",
  "Tools or materials not available",
  "Vehicle or travel problem",
  "Health or personal emergency",
  "Unsafe or unclear location",
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
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onSubmit={submit}
        className="flex max-h-[92dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-6 pb-4 pt-5">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-bold text-slate-900">
              Why are you rejecting this job?
            </h2>
            {jobLabel && (
              <p className="mt-1 truncate text-sm font-medium text-indigo-700">{jobLabel}</p>
            )}
            <p className="mt-1 text-xs text-slate-500">Pick the closest reason. This helps us send you better jobs.</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            aria-label="Close"
            className="-mr-2 -mt-1 rounded-full p-2 text-slate-500 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#4338ca] disabled:opacity-50"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2" role="radiogroup" aria-label="Common reasons">
          {REJECT_REASONS.map((r) => {
            const selected = choice === r;
            return (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setChoice(selected ? "" : r)}
                className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#4338ca] ${
                  selected
                    ? "border-[#4338ca] bg-indigo-50 text-indigo-900"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                    selected ? "border-[#4338ca] bg-[#4338ca] text-white" : "border-slate-300 bg-white"
                  }`}
                >
                  {selected && <Check size={12} strokeWidth={3} />}
                </span>
                <span className="min-w-0 flex-1">{r}</span>
              </button>
            );
          })}
        </div>

        <label htmlFor={noteId} className="mt-5 block text-sm font-semibold text-slate-800">
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
          className={`mt-2 w-full resize-none rounded-xl border bg-slate-50 px-3.5 py-3 text-sm text-slate-900 outline-none transition focus:border-[#4338ca] focus:bg-white focus:ring-2 focus:ring-[#4338ca]/30 ${
            showError ? "border-red-400" : "border-slate-200"
          }`}
        />
        <div className="mt-1.5 flex justify-between text-xs">
          <span id={`${noteId}-err`} className="text-red-600" role={showError ? "alert" : undefined}>
            {showError ? `Please enter a reason (at least ${MIN_LEN} characters).` : ""}
          </span>
          <span className="text-slate-400">
            {note.length}/{MAX_LEN}
          </span>
        </div>

        {error && (
          <p className="mt-3 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700" role="alert">
            {error}
          </p>
        )}
        </div>

        <div className="flex gap-3 border-t border-slate-100 bg-slate-50/60 px-6 py-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#4338ca] disabled:opacity-50"
          >
            Keep job
          </button>
          <button
            type="submit"
            disabled={busy}
            className="flex-1 rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:opacity-60"
          >
            {busy ? "Rejecting…" : "Reject job"}
          </button>
        </div>
      </form>
    </div>
  );
}
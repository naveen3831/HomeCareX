import type { LucideIcon } from "lucide-react";
import { AlertTriangle, CheckCircle2, ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import clsx from "clsx";
import { FOCUS_RING } from "@/components/customer/focusRing";

export const INPUT =
  "h-12 w-full rounded-xl border bg-panel px-4 text-[15px] text-ink outline-none transition-shadow placeholder:text-muted/70 focus:border-brand focus:ring-4 focus:ring-brand/15 disabled:cursor-not-allowed disabled:opacity-60";
export const inputClass = (invalid: boolean) => clsx(INPUT, invalid ? "border-danger" : "border-line");

export const PRIMARY_BUTTON = clsx(
  "inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-brand px-6 text-sm font-semibold text-white",
  "shadow-[0_8px_18px_-8px_rgba(67,56,202,.7)] transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:brightness-100",
  FOCUS_RING,
);
export const SECONDARY_BUTTON = clsx(
  "inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full border border-line px-5 text-sm font-semibold text-ink",
  "transition-colors hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-50",
  FOCUS_RING,
);

interface SectionCardProps {
  id: string;
  title: string;
  description?: string;
  icon: LucideIcon;
  children: ReactNode;
  /** Pass onToggle to make the card collapsible: only the header shows until it is opened. */
  open?: boolean;
  onToggle?: () => void;
}

/**
 * A titled settings card. The id doubles as an anchor (#personal-info) and the heading's label.
 * Collapsible cards keep their content mounted but hidden, so a half-typed form survives closing the card.
 */
export function SectionCard({ id, title, description, icon: Icon, children, open = true, onToggle }: SectionCardProps) {
  const collapsible = onToggle !== undefined;
  const expanded = !collapsible || open;
  const heading = (
    <>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand" aria-hidden="true">
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-bold text-ink">{title}</span>
        {description && <span className="block text-sm font-normal text-muted">{description}</span>}
      </span>
    </>
  );
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="scroll-mt-24 rounded-[24px] border border-line/70 bg-panel p-5 shadow-[0_10px_28px_-12px_rgba(30,27,46,.14)] md:p-6"
    >
      <h2 id={`${id}-title`} className="m-0">
        {collapsible ? (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            aria-controls={`${id}-panel`}
            className={clsx("flex min-h-[44px] w-full items-center gap-3 rounded-xl text-left", FOCUS_RING)}
          >
            {heading}
            <ChevronDown className={clsx("h-5 w-5 shrink-0 text-muted transition-transform duration-200", expanded && "rotate-180")} aria-hidden="true" />
          </button>
        ) : (
          <span className="flex items-start gap-3">{heading}</span>
        )}
      </h2>
      <div id={`${id}-panel`} hidden={!expanded} className="mt-4">
        {children}
      </div>
    </section>
  );
}

interface FieldProps {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  optional?: boolean;
  children: (a11y: { id: string; "aria-invalid": boolean; "aria-describedby"?: string }) => ReactNode;
}

/** Label + control + inline error. The control gets its id / aria wiring through the render prop. */
export function Field({ id, label, error, hint, optional, children }: FieldProps) {
  const describedBy = [error ? `${id}-error` : null, hint ? `${id}-hint` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-xs font-semibold uppercase tracking-wide text-muted">
        {label} {optional && <span className="font-normal normal-case tracking-normal">(optional)</span>}
      </label>
      {children({ id, "aria-invalid": Boolean(error), "aria-describedby": describedBy })}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

/** Form-level result: red for a server/offline error, green for a saved confirmation. */
export function FormMessage({ kind, children }: { kind: "error" | "success" | "info"; children: ReactNode }) {
  const Icon = kind === "success" ? CheckCircle2 : AlertTriangle;
  return (
    <p
      role={kind === "error" ? "alert" : "status"}
      className={clsx(
        "flex items-start gap-2 rounded-xl px-3 py-2 text-sm",
        kind === "error" && "bg-danger-soft text-danger",
        kind === "success" && "bg-green-50 text-green-800",
        kind === "info" && "bg-amber-50 text-amber-800",
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

export function Spinner() {
  return <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />;
}

export const OFFLINE_NOTE = "You're offline. Reconnect to save changes.";

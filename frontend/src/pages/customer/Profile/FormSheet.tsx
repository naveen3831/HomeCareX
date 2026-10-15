import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X, type LucideIcon } from "lucide-react";
import clsx from "clsx";
import { FOCUS_RING } from "@/components/customer/focusRing";

interface FormSheetProps {
  id: string;
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  icon: LucideIcon;
  children: ReactNode;
}

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Responsive form container: a bottom sheet on phones, a right-hand drawer from `md` up.
 * Children stay mounted while closed (hidden with `invisible`), so a half-typed form survives closing the sheet.
 * Esc and the backdrop close it, focus is trapped while open and restored on close, and the page behind doesn't scroll.
 */
export default function FormSheet({ id, open, onClose, title, description, icon: Icon, children }: FormSheetProps) {
  const panel = useRef<HTMLDivElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    returnTo.current = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = requestAnimationFrame(() => panel.current?.focus());

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return onClose();
      if (e.key !== "Tab" || !panel.current) return;
      const items = Array.from(panel.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      returnTo.current?.focus?.();
    };
  }, [open, onClose]);

  return createPortal(
    <div className={clsx("fixed inset-0 z-[70] transition-[visibility] duration-300", open ? "visible" : "invisible pointer-events-none")}>
      <div
        aria-hidden="true"
        onClick={onClose}
        className={clsx("absolute inset-0 bg-ink/40 backdrop-blur-[2px] transition-opacity duration-300 motion-reduce:transition-none", open ? "opacity-100" : "opacity-0")}
      />
      <div
        ref={panel}
        id={id}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        tabIndex={-1}
        className={clsx(
          "absolute flex flex-col bg-panel outline-none shadow-[0_-20px_60px_-20px_rgba(30,27,46,.35)] transition-transform duration-300 ease-out motion-reduce:transition-none",
          // phone: bottom sheet
          "inset-x-0 bottom-0 max-h-[92dvh] rounded-t-[28px]",
          // md+: right drawer
          "md:inset-x-auto md:inset-y-0 md:right-0 md:max-h-none md:w-[480px] md:max-w-full md:rounded-l-[28px] md:rounded-tr-none md:shadow-[-20px_0_60px_-20px_rgba(30,27,46,.35)]",
          open ? "translate-x-0 translate-y-0" : "translate-y-full md:translate-x-full md:translate-y-0",
        )}
      >
        <div aria-hidden="true" className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-line md:hidden" />
        <header className="flex items-start gap-3 border-b border-line/70 px-5 pb-4 pt-4 md:px-6 md:pt-6">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-brand-soft text-brand" aria-hidden="true">
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id={`${id}-title`} className="text-lg font-bold leading-tight text-ink">
              {title}
            </h2>
            {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={`Close ${title}`}
            className={clsx("flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-canvas hover:text-ink", FOCUS_RING)}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] md:px-6">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

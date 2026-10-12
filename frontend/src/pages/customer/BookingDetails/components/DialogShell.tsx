import {
  useEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import clsx from "clsx";
import { FOCUS_RING } from "@/components/customer/focusRing";

interface Props {
  titleId: string;
  title: string;
  onClose: () => void;
  /** While true (a request is in flight) the dialog can't be dismissed, so a result is never lost. */
  busy?: boolean;
  children: ReactNode;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Accessible modal: labelled, Escape closes it, Tab stays inside, focus returns to the button that opened
 * it, and the page behind doesn't scroll. On a phone it sits at the bottom like a sheet.
 */
export default function DialogShell({
  titleId,
  title,
  onClose,
  busy = false,
  children,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const busyRef = useRef(busy);
  busyRef.current = busy;

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel)?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      if (opener && document.contains(opener)) opener.focus();
    };
  }, []);

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      if (!busyRef.current) onCloseRef.current();
      return;
    }
    if (e.key !== "Tab") return;
    const nodes = Array.from(
      panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [],
    );
    if (nodes.length === 0) {
      e.preventDefault();
      return;
    }
    const firstNode = nodes[0];
    const lastNode = nodes[nodes.length - 1];
    if (e.shiftKey && document.activeElement === firstNode) {
      e.preventDefault();
      lastNode.focus();
    } else if (!e.shiftKey && document.activeElement === lastNode) {
      e.preventDefault();
      firstNode.focus();
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 sm:items-center sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className="flex max-h-[92dvh] w-full min-w-0 max-w-lg flex-col overflow-hidden rounded-t-2xl bg-panel shadow-xl outline-none sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3.5 sm:px-5">
          <h2 id={titleId} className="min-w-0 text-base font-bold text-ink sm:text-lg">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className={clsx(
              "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted transition hover:bg-canvas disabled:opacity-50",
              FOCUS_RING,
            )}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="min-w-0 overflow-y-auto px-4 py-4 sm:px-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

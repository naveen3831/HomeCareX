import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, CalendarCheck, LogOut, ShieldCheck, Smartphone } from "lucide-react";
import clsx from "clsx";
import { FOCUS_RING } from "./focusRing";

const FOCUSABLE = "button:not([disabled]),a[href],[tabindex]:not([tabindex=\"-1\"])";

const NOTES: { icon: typeof LogOut; text: string; tone: string }[] = [
  { icon: Smartphone, text: "You'll be signed out on this device", tone: "bg-rose-50 text-rose-600" },
  { icon: CalendarCheck, text: "Your bookings and saved addresses stay safe", tone: "bg-emerald-50 text-emerald-600" },
  { icon: ShieldCheck, text: "Sign in again anytime to book or track a service", tone: "bg-sky-50 text-sky-600" },
];

interface Props {
  open: boolean;
  busy: boolean;
  error: string | null;
  onStay: () => void;
  onLogout: () => void;
}

/** "Log out of HomeCareX?" pop-up, styled like the delete-account one: bottom sheet on phones, centred card from md up. "Stay signed in" is focused first. */
export default function LogoutDialog({ open, busy, error, onStay, onLogout }: Props) {
  const panel = useRef<HTMLDivElement>(null);
  const stayRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = requestAnimationFrame(() => stayRef.current?.focus());
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) return onStay();
      if (e.key !== "Tab" || !panel.current) return;
      const items = Array.from(panel.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
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
    };
  }, [open, busy, onStay]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center md:items-center md:p-6">
      <div aria-hidden="true" onClick={() => !busy && onStay()} className="logout-backdrop absolute inset-0 bg-ink/50 backdrop-blur-sm" />

      <div
        ref={panel}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="logout-title"
        aria-describedby="logout-desc"
        className="logout-sheet relative w-full overflow-hidden rounded-t-[32px] bg-panel shadow-[0_-24px_60px_-20px_rgba(30,27,46,.45)] md:max-w-md md:rounded-[32px] md:shadow-[0_32px_80px_-24px_rgba(30,27,46,.5)]"
      >
        {/* warm glow behind the icon */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-rose-100/80 via-orange-50/50 to-transparent" />
        <div aria-hidden="true" className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-line md:hidden" />

        <div className="relative px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-6 text-center md:pb-7 md:pt-8">
          <div className="relative mx-auto flex h-20 w-20 items-center justify-center">
            <span aria-hidden="true" className="logout-ring absolute inset-0 rounded-full bg-rose-400/40" />
            <span aria-hidden="true" className="logout-ring logout-ring-2 absolute inset-0 rounded-full bg-rose-400/30" />
            <span
              aria-hidden="true"
              className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[#FF8FA3] to-[#DC2626] text-white shadow-[0_14px_24px_-8px_rgba(220,38,38,.65),inset_0_1px_0_rgba(255,255,255,.5),inset_0_-2px_0_rgba(0,0,0,.14)]"
            >
              <LogOut className="h-7 w-7" />
            </span>
          </div>

          <h2 id="logout-title" className="mt-5 text-[22px] font-bold leading-tight text-ink">
            Log out of HomeCareX?
          </h2>
          <p id="logout-desc" className="mx-auto mt-1.5 max-w-xs text-sm text-muted">
            You&apos;ll need to sign in again to book or track a service.
          </p>

          <ul className="mt-5 space-y-2 text-left">
            {NOTES.map(({ icon: Icon, text, tone }) => (
              <li key={text} className="flex items-center gap-3 rounded-2xl border border-line/70 bg-canvas px-3 py-2.5">
                <span aria-hidden="true" className={clsx("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", tone)}>
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <span className="text-[13px] font-medium leading-snug text-ink">{text}</span>
              </li>
            ))}
          </ul>

          {error && (
            <p role="alert" className="mt-4 flex items-start gap-2 rounded-xl bg-danger-soft px-3 py-2 text-left text-sm text-danger">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </p>
          )}

          <div className="mt-6 grid grid-cols-2 gap-3">
            <button
              ref={stayRef}
              type="button"
              onClick={onStay}
              disabled={busy}
              className={clsx(
                "inline-flex min-h-[50px] items-center justify-center gap-2 rounded-full bg-brand px-4 text-sm font-semibold text-white",
                "shadow-[0_8px_18px_-8px_rgba(67,56,202,.7)] transition-all hover:brightness-110 motion-safe:active:scale-95 disabled:opacity-60",
                FOCUS_RING,
              )}
            >
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              Stay signed in
            </button>
            <button
              type="button"
              onClick={onLogout}
              disabled={busy}
              className={clsx(
                "inline-flex min-h-[50px] items-center justify-center gap-2 rounded-full border-[1.5px] border-danger/40 bg-white px-4 text-sm font-semibold text-danger",
                "transition-all hover:bg-danger hover:text-white motion-safe:active:scale-95 disabled:opacity-60",
                FOCUS_RING,
              )}
            >
              {busy ? (
                <>
                  <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-danger/30 border-t-danger" />
                  Logging out…
                </>
              ) : (
                "Yes, log out"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

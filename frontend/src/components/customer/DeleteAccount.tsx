import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArchiveRestore, MapPinOff, ShieldCheck, Trash2, UserX } from "lucide-react";
import clsx from "clsx";
import { useAuth } from "@/hooks/useAuth";
import { useDeleteAccount } from "@/features/customer";
import { LOGIN_PATH } from "@/routes/authPaths";
import { FOCUS_RING } from "./focusRing";

const FOCUSABLE = "button:not([disabled]),a[href],[tabindex]:not([tabindex=\"-1\"])";

const EFFECTS: { icon: typeof UserX; text: string; tone: string }[] = [
  { icon: UserX, text: "Your profile, photo and sign-in are removed", tone: "bg-rose-50 text-rose-600" },
  { icon: MapPinOff, text: "Saved addresses, notifications and wallet are erased", tone: "bg-orange-50 text-orange-600" },
  { icon: ArchiveRestore, text: "Past booking and payment records are kept for accounting", tone: "bg-sky-50 text-sky-600" },
];

interface DialogProps {
  open: boolean;
  busy: boolean;
  error: string | null;
  onKeep: () => void;
  onDelete: () => void;
}

/** The "Are you sure?" pop-up: a bottom sheet on phones, a centred card from md up. "No" is focused first, so Enter is the safe choice. */
function DeleteAccountDialog({ open, busy, error, onKeep, onDelete }: DialogProps) {
  const panel = useRef<HTMLDivElement>(null);
  const keepRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = requestAnimationFrame(() => keepRef.current?.focus());
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) return onKeep();
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
  }, [open, busy, onKeep]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center md:items-center md:p-6">
      <div aria-hidden="true" onClick={() => !busy && onKeep()} className="delete-backdrop absolute inset-0 bg-ink/50 backdrop-blur-sm" />

      <div
        ref={panel}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-account-title"
        aria-describedby="delete-account-desc"
        className="delete-sheet relative w-full overflow-hidden rounded-t-[32px] bg-panel shadow-[0_-24px_60px_-20px_rgba(30,27,46,.45)] md:max-w-md md:rounded-[32px] md:shadow-[0_32px_80px_-24px_rgba(30,27,46,.5)]"
      >
        {/* warm danger glow behind the icon */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-rose-100/80 via-orange-50/50 to-transparent" />
        <div aria-hidden="true" className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-line md:hidden" />

        <div className="relative px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-6 text-center md:pb-7 md:pt-8">
          <div className="relative mx-auto flex h-20 w-20 items-center justify-center">
            <span aria-hidden="true" className="delete-ring absolute inset-0 rounded-full bg-rose-400/40" />
            <span aria-hidden="true" className="delete-ring delete-ring-2 absolute inset-0 rounded-full bg-rose-400/30" />
            <span
              aria-hidden="true"
              className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[#FF8FA3] to-[#DC2626] text-white shadow-[0_14px_24px_-8px_rgba(220,38,38,.65),inset_0_1px_0_rgba(255,255,255,.5),inset_0_-2px_0_rgba(0,0,0,.14)]"
            >
              <Trash2 className="h-7 w-7" />
            </span>
          </div>

          <h2 id="delete-account-title" className="mt-5 text-[22px] font-bold leading-tight text-ink">
            Delete your account?
          </h2>
          <p id="delete-account-desc" className="mx-auto mt-1.5 max-w-xs text-sm text-muted">
            Are you sure? This is permanent and can&apos;t be undone.
          </p>

          <ul className="mt-5 space-y-2 text-left">
            {EFFECTS.map(({ icon: Icon, text, tone }) => (
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
              ref={keepRef}
              type="button"
              onClick={onKeep}
              disabled={busy}
              className={clsx(
                "inline-flex min-h-[50px] items-center justify-center gap-2 rounded-full bg-brand px-4 text-sm font-semibold text-white",
                "shadow-[0_8px_18px_-8px_rgba(67,56,202,.7)] transition-all hover:brightness-110 motion-safe:active:scale-95 disabled:opacity-60",
                FOCUS_RING,
              )}
            >
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              No, keep it
            </button>
            <button
              type="button"
              onClick={onDelete}
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
                  Deleting…
                </>
              ) : (
                "Yes, delete"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * "Delete account" entry point with its confirmation pop-up.
 *  - variant "card": the red row on the mobile Profile page (sits right above Log out).
 *  - variant "inline": the pill button shown beside "Edit profile" in the desktop Profile header.
 *  - variant "sidebar": the compact sidebar button (no longer used by the sidebar; kept for existing tests).
 * On success the session is cleared and the customer lands on the login page.
 */
export default function DeleteAccount({ variant }: { variant: "card" | "sidebar" | "inline" }) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const del = useDeleteAccount();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const keep = () => {
    setOpen(false);
    setError(null);
    requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const confirmDelete = () => {
    if (del.isPending) return;
    setError(null);
    del.mutate(undefined, {
      onSuccess: async () => {
        // The user no longer exists, so the server-side logout may fail; the local session is cleared either way.
        await logout().catch(() => undefined);
        qc.clear();
        navigate(LOGIN_PATH, { replace: true });
      },
      onError: (e) => setError(e.message || "Couldn't delete your account. Please try again."),
    });
  };

  const dialog = <DeleteAccountDialog open={open} busy={del.isPending} error={error} onKeep={keep} onDelete={confirmDelete} />;

  if (variant === "inline") {
    return (
      <>
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen(true)}
          className={clsx(
            "inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full border-[1.5px] border-danger/40 bg-white px-6 text-sm font-semibold text-danger",
            "transition-all hover:bg-danger hover:text-white motion-safe:active:scale-95",
            FOCUS_RING,
          )}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Delete account
        </button>
        {dialog}
      </>
    );
  }

  if (variant === "sidebar") {
    return (
      <>
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen(true)}
          className={clsx("mt-1 flex min-h-[44px] w-full items-center gap-3 rounded-lg px-2 text-sm font-medium text-muted transition-colors hover:bg-danger-soft hover:text-danger", FOCUS_RING)}
        >
          <Trash2 className="ml-2.5 h-4 w-4" aria-hidden="true" />
          Delete account
        </button>
        {dialog}
      </>
    );
  }

  return (
    <section className="profile-rise md:hidden" style={{ ["--d" as string]: "320ms" }} aria-label="Delete account">
      <div className="overflow-hidden rounded-[22px] border border-line/70 bg-panel shadow-[0_10px_28px_-12px_rgba(30,27,46,.14)]">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen(true)}
          className={clsx("group flex min-h-[64px] w-full items-center gap-3.5 px-4 py-3 text-left transition-colors active:bg-danger-soft", FOCUS_RING)}
        >
          <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-danger-soft text-danger transition-transform duration-200 motion-safe:group-active:scale-90">
            <Trash2 className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold text-danger">Delete account</span>
            <span className="block truncate text-xs text-muted">Permanently remove your data</span>
          </span>
        </button>
      </div>
      {dialog}
    </section>
  );
}
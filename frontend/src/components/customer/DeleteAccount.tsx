import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArchiveRestore,
  ChevronRight,
  MapPinOff,
  ShieldCheck,
  Trash2,
  UserX,
} from "lucide-react";
import clsx from "clsx";
import { useAuth } from "@/hooks/useAuth";
import { useDeleteAccount, useCustomerDashboard } from "@/features/customer";
import { bookingApi } from "@/services/bookingApi";
import { LOGIN_PATH } from "@/routes/authPaths";
import { FOCUS_RING } from "./focusRing";

const FOCUSABLE = "button:not([disabled]),a[href],[tabindex]:not([tabindex=\"-1\"])";

/**
 * Any booking status that represents an in-flight, ongoing or pending booking
 * that blocks account deletion according to business and server retention rules.
 */
export const ACTIVE_BOOKING_STATUSES = new Set([
  "pending",
  "pending_confirmation",
  "pending_payment",
  "confirmed",
  "scheduled",
  "created",
  "searching_for_partner",
  "assigned",
  "en_route",
  "arrived",
  "in_progress",
  "in-progress",
  "started",
  "disputed",
]);

const EFFECTS: { icon: typeof UserX; text: string; tone: string }[] = [
  {
    icon: UserX,
    text: "Your profile, photo and sign-in are removed",
    tone: "bg-[#fee2e2] text-[#ef4444]",
  },
  {
    icon: MapPinOff,
    text: "Saved addresses, notifications and wallet are erased",
    tone: "bg-[#fef3c7] text-[#f59e0b]",
  },
  {
    icon: ArchiveRestore,
    text: "Past booking and payment records are kept for accounting",
    tone: "bg-[#e0f2fe] text-[#0ea5e9]",
  },
];

interface DialogProps {
  open: boolean;
  busy: boolean;
  error: string | null;
  activeCount: number;
  isCheckingBookings: boolean;
  isBookingCheckError: boolean;
  onRetryBookings?: () => void;
  onKeep: () => void;
  onDelete: () => void;
}

/**
 * Delete Account confirmation sheet:
 * - Mobile: iOS-style bottom sheet with drag handle, smooth slide-up, rounded-t-[32px]
 * - Desktop: Centred modal card
 * - Scenario A: When customer has active bookings, shows "Account deletion unavailable",
 *   a pale-red active bookings warning card (linking to Active Bookings), and disables "Yes, delete".
 * - Scenario B: When customer has 0 active bookings, shows "Delete your account?",
 *   permanent action confirmation, and enabled red-outline "Yes, delete" button.
 */
function DeleteAccountDialog({
  open,
  busy,
  error,
  activeCount,
  isCheckingBookings,
  isBookingCheckError,
  onRetryBookings,
  onKeep,
  onDelete,
}: DialogProps) {
  const panel = useRef<HTMLDivElement>(null);
  const keepRef = useRef<HTMLButtonElement>(null);

  const hasActiveBookings = activeCount > 0;
  const isDeletionBlocked = hasActiveBookings || isCheckingBookings || isBookingCheckError;

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
      <div
        aria-hidden="true"
        onClick={() => !busy && onKeep()}
        className="delete-backdrop absolute inset-0 bg-ink/50 backdrop-blur-sm"
      />

      <div
        ref={panel}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-account-title"
        aria-describedby="delete-account-desc"
        className="delete-sheet relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-[32px] bg-white shadow-[0_-24px_60px_-20px_rgba(30,27,46,.45)] md:max-w-md md:rounded-[32px] md:shadow-[0_32px_80px_-24px_rgba(30,27,46,.5)]"
      >
        {/* Soft pink/red danger glow behind the icon */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-rose-100/60 via-orange-50/20 to-transparent"
        />

        {/* Drag handle for mobile bottom sheet */}
        <div
          aria-hidden="true"
          className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-slate-200 md:hidden"
        />

        <div className="relative flex-1 overflow-y-auto px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5 text-center sm:px-6 md:pb-7 md:pt-7">
          {/* Top circular delete icon */}
          <div className="relative mx-auto flex h-16 w-16 items-center justify-center">
            <span
              aria-hidden="true"
              className="absolute inset-0 rounded-full bg-red-400/20 blur-md"
            />
            <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#f87171] via-[#ef4444] to-[#dc2626] text-white shadow-[0_8px_20px_-4px_rgba(220,38,38,0.55),inset_0_1px_1px_rgba(255,255,255,0.6)]">
              <Trash2 className="h-6 w-6" aria-hidden="true" />
            </div>
          </div>

          {/* Heading & Subtitle based on scenario */}
          {hasActiveBookings ? (
            <>
              <h2
                id="delete-account-title"
                className="mt-4 text-[19px] font-bold leading-snug tracking-tight text-slate-900 sm:text-[21px]"
              >
                Account deletion unavailable
              </h2>
              <p
                id="delete-account-desc"
                className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-slate-500 sm:text-[13px]"
              >
                You have active bookings or ongoing services. Please wait until all your active services are completed or cancelled before deleting your account.
              </p>

              {/* Warning Card for Active Bookings */}
              <div
                aria-label={`You have ${activeCount} active booking${activeCount === 1 ? "" : "s"}`}
                className="mt-4 flex items-center gap-3 rounded-2xl border border-[#fecdd3] bg-[#fff1f2] p-3 text-left sm:p-3.5"
              >
                <span
                  aria-hidden="true"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#e11d48] shadow-2xs"
                >
                  <AlertTriangle className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold leading-snug text-slate-900 sm:text-sm">
                    You have{" "}
                    <span className="font-bold text-[#e11d48]">
                      {activeCount} active booking{activeCount === 1 ? "" : "s"}
                    </span>
                  </p>
                  <p className="mt-0.5 text-[11px] leading-tight text-slate-500 sm:text-xs">
                    Complete or cancel your active services to delete your account.
                  </p>
                </div>
              </div>
            </>
          ) : (
            <>
              <h2
                id="delete-account-title"
                className="mt-4 text-[19px] font-bold leading-snug tracking-tight text-slate-900 sm:text-[21px]"
              >
                Delete your account?
              </h2>
              <p
                id="delete-account-desc"
                className="mx-auto mt-2 max-w-xs text-xs leading-relaxed text-slate-500 sm:text-[13px]"
              >
                Are you sure? This action is permanent and can&apos;t be undone.
              </p>
            </>
          )}

          {/* Booking Check Error State */}
          {isBookingCheckError && (
            <div
              role="alert"
              className="mt-4 flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-left text-xs text-amber-800 sm:text-[13px]"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">Unable to verify booking status</p>
                <p className="mt-0.5 text-amber-700">
                  Please check your connection and try again before deleting your account.
                </p>
              </div>
              {onRetryBookings && (
                <button
                  type="button"
                  onClick={onRetryBookings}
                  className="shrink-0 font-semibold text-brand hover:underline"
                >
                  Retry
                </button>
              )}
            </div>
          )}

          {/* Account information / consequence rows */}
          <ul className="mt-4 space-y-2.5 text-left" aria-label="Deletion consequences">
            {EFFECTS.map(({ icon: Icon, text, tone }) => (
              <li
                key={text}
                className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white p-3 shadow-2xs sm:p-3.5"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span
                    aria-hidden="true"
                    className={clsx(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                      tone,
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 text-xs font-medium leading-snug text-slate-700 sm:text-[13px]">
                    {text}
                  </span>
                </div>
                <ChevronRight
                  className="h-4 w-4 shrink-0 text-slate-300"
                  aria-hidden="true"
                />
              </li>
            ))}
          </ul>

          {/* Mutation failure alert (e.g. 409 refused on backend) */}
          {error && (
            <p
              role="alert"
              className="mt-4 flex items-start gap-2 rounded-xl bg-danger-soft px-3 py-2 text-left text-xs text-danger sm:text-sm"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </p>
          )}

          {/* Action buttons */}
          <div className="mt-6 grid grid-cols-2 gap-3">
            <button
              ref={keepRef}
              type="button"
              onClick={onKeep}
              disabled={busy}
              className={clsx(
                "inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-[#5046e5] px-4 text-xs font-semibold text-white sm:text-sm",
                "shadow-[0_8px_18px_-8px_rgba(80,70,229,.6)] transition-all hover:bg-[#4338ca] active:scale-95 disabled:opacity-60",
                FOCUS_RING,
              )}
            >
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              <span>No, keep it</span>
            </button>

            {isDeletionBlocked ? (
              <button
                type="button"
                disabled={true}
                aria-disabled={true}
                title={
                  hasActiveBookings
                    ? "Account deletion unavailable while active bookings exist"
                    : isBookingCheckError
                      ? "Cannot delete account until booking status is verified"
                      : "Verifying eligibility…"
                }
                className={clsx(
                  "inline-flex min-h-[48px] select-none items-center justify-center gap-2 rounded-full border border-transparent bg-[#f1f3f9] px-4 text-xs font-semibold text-[#9ca3af] cursor-not-allowed sm:text-sm",
                  FOCUS_RING,
                )}
              >
                <Trash2 className="h-4 w-4 text-[#9ca3af]" aria-hidden="true" />
                <span>Yes, delete</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onDelete}
                disabled={busy}
                className={clsx(
                  "inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full border-[1.5px] border-[#fca5a5] bg-white px-4 text-xs font-semibold text-[#dc2626] sm:text-sm",
                  "shadow-2xs transition-all hover:bg-rose-50 active:scale-95 disabled:opacity-60",
                  FOCUS_RING,
                )}
              >
                {busy ? (
                  <>
                    <span
                      aria-hidden="true"
                      className="h-4 w-4 animate-spin rounded-full border-2 border-rose-300 border-t-rose-600"
                    />
                    <span>Deleting…</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 text-[#dc2626]" aria-hidden="true" />
                    <span>Yes, delete</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export interface DeleteAccountProps {
  variant: "card" | "sidebar" | "inline";
  activeBookingsCount?: number | null;
}

/**
 * "Delete account" entry point with its confirmation bottom sheet / modal.
 *  - variant "card": the red row on the mobile Profile page (sits below Log out).
 *  - variant "inline": the pill button shown beside "Edit profile" in desktop Profile header.
 *  - variant "sidebar": compact sidebar button.
 * Validates active bookings for the authenticated customer both on frontend and via server revalidation.
 */
export default function DeleteAccount({
  variant,
  activeBookingsCount: propActiveCount,
}: DeleteAccountProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const del = useDeleteAccount();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const dashboard = useCustomerDashboard();

  // Check active bookings dynamically for the authenticated customer
  const bookingsQuery = useQuery({
    queryKey: ["customer-active-bookings-check", user?.id],
    queryFn: async ({ signal }) => {
      try {
        if (typeof bookingApi?.listBookings === "function") {
          const res = await bookingApi.listBookings({ page: 1, limit: 50 }, signal);
          const items = res?.items ?? [];
          const active = items.filter((b) => {
            const s = (b.status || "").toLowerCase().replace(/-/g, "_");
            return ACTIVE_BOOKING_STATUSES.has(s);
          });
          return { count: active.length, items: active };
        }
      } catch (err) {
        // If booking list query fails but dashboard data is already present, gracefully fall back
        if (dashboard?.data) {
          const dashActive = [
            ...(dashboard.data.activeBookings || []),
            ...(dashboard.data.upcomingBookings || []),
          ].filter((b) => {
            const s = (b.status || "").toLowerCase().replace(/-/g, "_");
            return ACTIVE_BOOKING_STATUSES.has(s);
          });
          return { count: dashActive.length, items: dashActive };
        }
        throw err;
      }

      if (dashboard?.data) {
        const dashActive = [
          ...(dashboard.data.activeBookings || []),
          ...(dashboard.data.upcomingBookings || []),
        ].filter((b) => {
          const s = (b.status || "").toLowerCase().replace(/-/g, "_");
          return ACTIVE_BOOKING_STATUSES.has(s);
        });
        return { count: dashActive.length, items: dashActive };
      }

      return { count: 0, items: [] };
    },
    enabled: Boolean(user?.id) && propActiveCount === undefined,
    staleTime: 5000,
    retry: false,
  });

  const activeCount =
    propActiveCount !== undefined && propActiveCount !== null
      ? propActiveCount
      : (bookingsQuery.data?.count ?? 0);

  const isCheckingBookings = propActiveCount === undefined && bookingsQuery.isLoading;
  const isBookingCheckError = propActiveCount === undefined && bookingsQuery.isError;
  const isDeletionBlocked = activeCount > 0 || isCheckingBookings || isBookingCheckError;

  const keep = () => {
    setOpen(false);
    setError(null);
    requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const confirmDelete = () => {
    if (del.isPending || isDeletionBlocked) return;
    setError(null);
    del.mutate(undefined, {
      onSuccess: async () => {
        // The user no longer exists, so server-side logout may fail; local session is cleared either way.
        await logout().catch(() => undefined);
        qc.clear();
        navigate(LOGIN_PATH, { replace: true });
      },
      onError: (e) => setError(e.message || "Couldn't delete your account. Please try again."),
    });
  };

  const handleOpen = () => {
    setOpen(true);
    if (propActiveCount === undefined) {
      void bookingsQuery.refetch();
    }
  };

  const dialog = (
    <DeleteAccountDialog
      open={open}
      busy={del.isPending}
      error={error}
      activeCount={activeCount}
      isCheckingBookings={isCheckingBookings}
      isBookingCheckError={isBookingCheckError}
      onRetryBookings={() => void bookingsQuery.refetch()}
      onKeep={keep}
      onDelete={confirmDelete}
    />
  );

  if (variant === "inline") {
    return (
      <>
        <button
          ref={triggerRef}
          type="button"
          onClick={handleOpen}
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
          onClick={handleOpen}
          className={clsx(
            "mt-1 flex min-h-[44px] w-full items-center gap-3 rounded-lg px-2 text-sm font-medium text-muted transition-colors hover:bg-danger-soft hover:text-danger",
            FOCUS_RING,
          )}
        >
          <Trash2 className="ml-2.5 h-4 w-4" aria-hidden="true" />
          Delete account
        </button>
        {dialog}
      </>
    );
  }

  return (
    <section
      className="profile-rise md:hidden"
      style={{ ["--d" as string]: "360ms" }}
      aria-label="Delete account"
    >
      <div className="overflow-hidden rounded-[22px] border border-line/70 bg-panel shadow-[0_10px_28px_-12px_rgba(30,27,46,.14)]">
        <button
          ref={triggerRef}
          type="button"
          onClick={handleOpen}
          className={clsx(
            "group flex min-h-[64px] w-full items-center gap-3.5 px-4 py-3 text-left transition-colors active:bg-danger-soft",
            FOCUS_RING,
          )}
        >
          <span
            aria-hidden="true"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-danger-soft text-danger transition-transform duration-200 motion-safe:group-active:scale-90"
          >
            <Trash2 className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold text-danger">
              Delete account
            </span>
            <span className="block truncate text-xs text-muted">
              Permanently remove your data
            </span>
          </span>
        </button>
      </div>
      {dialog}
    </section>
  );
}

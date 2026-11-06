import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  BellOff,
  ExternalLink,
  FileText,
  Headphones,
  Mail,
  Shield,
  Trash2,
  User,
} from "lucide-react";
import clsx from "clsx";
import { useAuth } from "@/hooks/useAuth";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useDeleteAccount, useCustomerDashboard } from "@/features/customer";
import type { DashboardBookingDto } from "@/features/customer";
import { bookingApi } from "@/services/bookingApi";
import { phaseOf, type BookingListItem } from "@/pages/customer/Bookings/bookingModel";
import { LOGIN_PATH } from "@/routes/authPaths";
import { customerPath } from "@/routes/customerPath";
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
]);

/**
 * Returns true if a booking belongs strictly to the Upcoming or Live tab.
 * Overdue, completed, and cancelled bookings are never counted as active.
 */
export function isUpcomingOrLiveBooking(
  b: BookingListItem,
  now: number = Date.now(),
): boolean {
  const phase = phaseOf(b, now);
  if (phase !== null) {
    return phase === "upcoming" || phase === "live";
  }

  // Fallback for minimal objects without date/slot (e.g. test mocks with only status)
  const s = (b.status || "").toLowerCase().replace(/-/g, "_");
  if (
    s === "disputed" ||
    s.startsWith("cancel") ||
    s === "completed" ||
    s === "rated" ||
    s === "no_show"
  ) {
    return false;
  }
  return ACTIVE_BOOKING_STATUSES.has(s);
}

const DASHBOARD_LIVE_STATUSES = new Set(["en_route", "arrived", "in_progress"]);
const dashboardBookingDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function isUpcomingOrLiveDashboardBooking(
  booking: DashboardBookingDto,
  now: number,
): boolean {
  const status = booking.status.toLowerCase().replace(/-/g, "_");
  if (DASHBOARD_LIVE_STATUSES.has(status)) return true;
  if (!ACTIVE_BOOKING_STATUSES.has(status)) return false;

  const scheduledAt = new Date(booking.scheduledAt);
  if (Number.isNaN(scheduledAt.getTime())) return true;
  return dashboardBookingDate.format(scheduledAt) >= dashboardBookingDate.format(new Date(now));
}

const EFFECTS: {
  icon: typeof User;
  text: string;
  altText: string;
  tone: string;
}[] = [
  {
    icon: User,
    text: "Your profile, photo and sign-in details will be removed",
    altText: "Your profile, photo and sign-in are removed",
    tone: "bg-[#fee2e2] text-[#ef4444]",
  },
  {
    icon: BellOff,
    text: "Saved addresses, notifications and wallet data will be erased",
    altText: "Saved addresses, notifications and wallet are erased",
    tone: "bg-[#fef3c7] text-[#f59e0b]",
  },
  {
    icon: FileText,
    text: "Past booking and payment records are kept for accounting",
    altText: "Past booking and payment records are kept for accounting",
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
  onHelpNavigate?: () => void;
}

/**
 * Delete Account confirmation sheet:
 * - Mobile: iOS-style bottom sheet matching reference template, rounded-t-[36px]
 * - Desktop: Centred modal card
 * - Scenario A: When customer has active bookings, shows "Account deletion unavailable",
 *   a pale-red active bookings warning card, consequences, Need Help section, and disables "Yes, delete".
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
  onHelpNavigate,
}: DialogProps) {
  const panel = useRef<HTMLDivElement>(null);
  const keepRef = useRef<HTMLButtonElement>(null);

  const hasActiveBookings = activeCount > 0;
  const isDeletionBlocked = hasActiveBookings || isCheckingBookings || isBookingCheckError;

  useEffect(() => {
    if (!open) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (panel.current) {
      panel.current.scrollTop = 0;
    }
    const frame = requestAnimationFrame(() => {
      try {
        keepRef.current?.focus({ preventScroll: true });
      } catch {
        keepRef.current?.focus();
      }
      if (panel.current) {
        panel.current.scrollTop = 0;
      }
    });
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
        className="delete-backdrop absolute inset-0 bg-black/40 backdrop-blur-[2px] touch-none"
      />

      <div
        ref={panel}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-account-title"
        aria-describedby="delete-account-desc"
        className="delete-sheet relative flex h-auto max-h-[96dvh] min-h-0 w-full flex-col justify-start overflow-hidden rounded-t-[32px] bg-white px-4 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] text-center shadow-[0_-20px_60px_-15px_rgba(0,0,0,0.25)] md:h-auto md:min-h-0 md:max-h-none md:max-w-[440px] md:overflow-visible md:rounded-[32px] md:p-6 md:shadow-[0_32px_80px_-24px_rgba(0,0,0,0.35)] md:justify-start"
      >
        <div className="min-h-0 w-full md:min-h-0 md:shrink-0">
          {/* Drag handle for mobile bottom sheet */}
          <div
            aria-hidden="true"
            className="mx-auto mb-2 mt-0.5 h-1 w-10 shrink-0 rounded-full bg-[#e2e8f0] md:hidden"
          />

          {/* Top circular delete icon with soft halo */}
          <div className="relative mx-auto mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center md:mt-0 md:h-12 md:w-12">
            <span
              aria-hidden="true"
              className="absolute -inset-2.5 rounded-full bg-rose-400/25 blur-md"
            />
            <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-[#f87171] text-white shadow-[0_8px_24px_-4px_rgba(248,113,113,0.55)] md:h-12 md:w-12">
              <Trash2 className="h-5 w-5 stroke-[2] md:h-6 md:w-6" aria-hidden="true" />
            </div>
          </div>

          {/* Heading & Subtitle based on scenario */}
          {hasActiveBookings ? (
            <>
              <h2
                id="delete-account-title"
                className="mt-2 text-[18px] font-bold tracking-tight text-slate-900 leading-snug md:mt-2.5 md:text-[20px]"
              >
                Account deletion unavailable
              </h2>
              <p
                id="delete-account-desc"
                className="mx-auto mt-1 max-w-sm text-[11px] leading-snug text-slate-500 md:mt-1 md:text-[12.5px] md:leading-normal"
              >
                You have active bookings or ongoing services. Please wait until all your active services are completed or cancelled before deleting your account.
              </p>

              {/* Warning Card for Active Bookings */}
              <div
                aria-label={`You have ${activeCount} active booking${activeCount === 1 ? "" : "s"}`}
                className="mt-2 flex items-start gap-2.5 rounded-[18px] border border-[#fecdd3] bg-[#fff1f2] p-2.5 text-left md:mt-2.5 md:gap-3 md:rounded-[18px] md:p-3"
              >
                <span
                  aria-hidden="true"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#ffe4e6] text-[#e11d48] md:h-9 md:w-9"
                >
                  <AlertTriangle className="h-4 w-4 stroke-[2.2] md:h-4.5 md:w-4.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11.5px] font-bold text-slate-900 leading-snug md:text-[13px]">
                    You have{" "}
                    <span className="font-extrabold text-[#e11d48]">
                      {activeCount} active booking{activeCount === 1 ? "" : "s"}
                    </span>
                  </p>
                  <p className="mt-0.5 text-[10.5px] leading-snug text-slate-500 md:text-[11.5px] md:leading-tight">
                    Complete or cancel your active services to delete your account.
                  </p>
                </div>
              </div>
            </>
          ) : (
            <>
              <h2
                id="delete-account-title"
                className="mt-2 text-[18px] font-bold tracking-tight text-slate-900 leading-snug md:mt-2.5 md:text-[20px]"
              >
                Delete your account?
              </h2>
              <p
                id="delete-account-desc"
                className="mx-auto mt-1.5 max-w-xs text-[12.5px] leading-relaxed text-slate-500 md:mt-1 md:text-[12.5px]"
              >
                Are you sure? This action is permanent and can&apos;t be undone.
              </p>
            </>
          )}

          {/* Booking Check Error State */}
          {isBookingCheckError && (
            <div
              role="alert"
              className="mt-3 flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-left text-xs text-amber-800"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-xs">Unable to verify booking status</p>
                <p className="mt-0.5 text-[11px] text-amber-700">
                  Please check your connection and try again before deleting your account.
                </p>
              </div>
              {onRetryBookings && (
                <button
                  type="button"
                  onClick={onRetryBookings}
                  className="shrink-0 font-semibold text-brand hover:underline text-xs"
                >
                  Retry
                </button>
              )}
            </div>
          )}

          {/* Account information / consequence rows */}
          <ul className="mt-2 space-y-1.5 text-left md:mt-2.5 md:space-y-1.5" aria-label="Deletion consequences">
            {EFFECTS.map(({ icon: Icon, text, altText, tone }) => (
              <li
                key={text}
                className="flex items-center gap-2.5 rounded-[16px] border border-[#f1f5f9] bg-white p-2 md:gap-3 md:rounded-[16px] md:py-2 md:px-3 shadow-[0_1px_3px_rgba(0,0,0,0.03)]"
              >
                <span
                  aria-hidden="true"
                  className={clsx(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full md:h-8 md:w-8",
                    tone,
                  )}
                >
                  <Icon className="h-4 w-4 md:h-4 md:w-4" />
                </span>
                <span className="min-w-0 flex-1 text-[11px] font-medium leading-snug text-slate-700 md:text-[12px]">
                  {altText && altText !== text && (
                    <span className="sr-only">{altText}</span>
                  )}
                  <span>{text}</span>
                </span>
              </li>
            ))}
          </ul>

          {/* Need help? section — opens Support / Contact Us */}
          <div className="mt-2 rounded-[18px] border border-[#e0e7ff] bg-[#f0f4ff] p-2.5 text-left md:mt-2.5 md:rounded-[18px] md:p-3">
            <div className="flex items-start gap-2.5 md:gap-3">
              <span
                aria-hidden="true"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-[#4f46e5] shadow-2xs md:h-8 md:w-8"
              >
                <Headphones className="h-4 w-4 md:h-4.5 md:w-4.5" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-[12px] font-bold text-slate-900 leading-snug md:text-[13px]">
                  Need help?
                </h3>
                <p className="mt-0.5 text-[10.5px] text-slate-500 leading-snug md:text-[11.5px] md:leading-tight">
                  Visit our Help Center or contact our support team.
                </p>
              </div>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2 md:mt-2.5 md:gap-2.5">
              <Link
                to={customerPath("/support")}
                state={{
                  from: "delete-account",
                  returnTo: customerPath("/profile?action=delete-account"),
                }}
                onClick={() => {
                  try {
                    sessionStorage.setItem(
                      "support_return_to",
                      customerPath("/profile?action=delete-account"),
                    );
                  } catch {
                    // ignore
                  }
                  if (onHelpNavigate) onHelpNavigate();
                  else onKeep();
                }}
                className={clsx(
                  "inline-flex h-8 items-center justify-center gap-1 rounded-full border border-[#dbeafe] bg-white px-2 text-[10.5px] font-semibold text-[#4338ca] shadow-2xs transition-all hover:bg-slate-50 active:scale-95 whitespace-nowrap md:h-9 md:gap-1.5 md:px-3 md:text-[11.5px]",
                  FOCUS_RING,
                )}
              >
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Help Center</span>
              </Link>
              <Link
                to={customerPath("/support?view=new")}
                state={{
                  from: "delete-account",
                  returnTo: customerPath("/profile?action=delete-account"),
                }}
                onClick={() => {
                  try {
                    sessionStorage.setItem(
                      "support_return_to",
                      customerPath("/profile?action=delete-account"),
                    );
                  } catch {
                    // ignore
                  }
                  if (onHelpNavigate) onHelpNavigate();
                  else onKeep();
                }}
                className={clsx(
                  "inline-flex h-8 items-center justify-center gap-1 rounded-full border border-[#dbeafe] bg-white px-2 text-[10.5px] font-semibold text-[#4338ca] shadow-2xs transition-all hover:bg-slate-50 active:scale-95 whitespace-nowrap md:h-9 md:gap-1.5 md:px-3 md:text-[11.5px]",
                  FOCUS_RING,
                )}
              >
                <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Contact Us</span>
              </Link>
            </div>
          </div>

          {/* Mutation failure alert (e.g. 409 refused on backend) */}
          {error && (
            <p
              role="alert"
              className="mt-3 flex items-start gap-2 rounded-xl bg-danger-soft px-3.5 py-2 text-left text-xs text-danger sm:text-sm"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </p>
          )}
        </div>

        {/* Action buttons */}
        <div className="mt-2 shrink-0 grid grid-cols-2 gap-2 pt-0 md:mt-3 md:gap-2.5 md:pt-0">
          <button
            ref={keepRef}
            type="button"
            onClick={onKeep}
            disabled={busy}
            aria-label="No, keep it"
            className={clsx(
              "inline-flex h-10 items-center justify-center gap-1 rounded-full bg-[#4f46e5] px-2 text-[10px] font-bold text-white whitespace-nowrap shadow-[0_8px_20px_-6px_rgba(79,70,229,0.55)] transition-all hover:bg-[#4338ca] active:scale-95 disabled:opacity-60 md:h-11 md:gap-1.5 md:px-4 md:text-[13px]",
              FOCUS_RING,
            )}
          >
            <Shield className="h-4 w-4 stroke-[2.2] shrink-0" aria-hidden="true" />
            <span>No, keep my account</span>
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
                "inline-flex h-10 select-none items-center justify-center gap-1 rounded-full border border-transparent bg-[#eef2f6] px-2 text-[10px] font-bold text-[#94a3b8] whitespace-nowrap cursor-not-allowed md:h-11 md:gap-1.5 md:px-4 md:text-[13px]",
                FOCUS_RING,
              )}
            >
              <Trash2 className="h-4 w-4 stroke-[2.2] text-[#94a3b8] shrink-0" aria-hidden="true" />
              <span>Yes, delete</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onDelete}
              disabled={busy}
              className={clsx(
                "inline-flex h-10 items-center justify-center gap-1 rounded-full border-[1.5px] border-[#fca5a5] bg-white px-2 text-[10px] font-bold text-[#dc2626] whitespace-nowrap shadow-2xs transition-all hover:bg-rose-50 active:scale-95 disabled:opacity-60 md:h-11 md:gap-1.5 md:px-4 md:text-[13px]",
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
                  <Trash2 className="h-4 w-4 stroke-[2.2] text-[#dc2626]" aria-hidden="true" />
                  <span>Yes, delete</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export interface DeleteAccountProps {
  variant: "card" | "sidebar" | "inline";
  activeBookingsCount?: number | null;
  defaultOpen?: boolean;
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
  defaultOpen = false,
}: DeleteAccountProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const qc = useQueryClient();
  const del = useDeleteAccount();

  const isDesktop = useMediaQuery("(min-width: 768px)");

  const action = searchParams.get("action") || searchParams.get("modal") || searchParams.get("dialog");
  const isDeleteRoute =
    defaultOpen ||
    action === "delete-account" ||
    searchParams.get("delete") === "true" ||
    location.hash === "#delete-account" ||
    location.hash === "#delete" ||
    location.pathname.endsWith("/delete") ||
    location.pathname.endsWith("/delete-account") ||
    (location.state as { openDeleteAccount?: boolean })?.openDeleteAccount === true;

  const [open, setOpen] = useState(() => {
    if (typeof window === "undefined") return defaultOpen;
    const isInitialDesktop = window.innerWidth >= 768;
    const matchesVariant = isInitialDesktop ? variant !== "card" : variant === "card";
    return Boolean((defaultOpen || isDeleteRoute) && matchesVariant);
  });

  const [error, setError] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const dashboard = useCustomerDashboard();

  // Check active bookings dynamically for the authenticated customer
  const bookingsQuery = useQuery({
    queryKey: ["customer-active-bookings-check", user?.id],
    queryFn: async ({ signal }) => {
      try {
        if (typeof bookingApi?.listBookings === "function") {
          const res = await bookingApi.listBookings(
            { status: "upcoming,live", page: 1, limit: 50 },
            signal,
          );
          const items = res?.items ?? [];
          const now = Date.now();
          const active = items.filter((b) => isUpcomingOrLiveBooking(b, now));
          const totalCount =
            typeof res?.meta?.total === "number" && items.length > 0 && active.length === items.length
              ? Math.max(active.length, res.meta.total)
              : active.length;
          return { count: totalCount, items: active };
        }
      } catch (err) {
        // If booking list query fails but dashboard data is already present, gracefully fall back
        if (dashboard?.data) {
          const now = Date.now();
          const dashActive = [
            ...(dashboard.data.activeBookings || []),
            ...(dashboard.data.upcomingBookings || []),
          ].filter((b) => isUpcomingOrLiveDashboardBooking(b, now));
          return { count: dashActive.length, items: dashActive };
        }
        throw err;
      }

      if (dashboard?.data) {
        const now = Date.now();
        const dashActive = [
          ...(dashboard.data.activeBookings || []),
          ...(dashboard.data.upcomingBookings || []),
        ].filter((b) => isUpcomingOrLiveDashboardBooking(b, now));
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

  // Sync open state with route changes (e.g. returning from Support or opening /profile?action=delete-account)
  useEffect(() => {
    const isSingleInstance =
      typeof document !== "undefined"
        ? document.querySelectorAll("[data-delete-account-trigger]").length <= 1
        : true;
    const isTargetVariant =
      isSingleInstance || (isDesktop ? variant !== "card" : variant === "card");

    if (isDeleteRoute && isTargetVariant) {
      setOpen(true);
      if (propActiveCount === undefined) {
        void bookingsQuery.refetch();
      }
    } else if (!isDeleteRoute && open) {
      setOpen(false);
    }
  }, [
    isDeleteRoute,
    isDesktop,
    variant,
    propActiveCount,
    open,
  ]);

  const keep = () => {
    setOpen(false);
    setError(null);
    if (
      searchParams.get("action") === "delete-account" ||
      searchParams.get("modal") === "delete-account" ||
      searchParams.get("dialog") === "delete-account" ||
      searchParams.get("delete") === "true"
    ) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete("action");
      nextParams.delete("modal");
      nextParams.delete("dialog");
      nextParams.delete("delete");
      setSearchParams(nextParams, { replace: true });
    } else if (
      location.pathname.endsWith("/delete") ||
      location.pathname.endsWith("/delete-account")
    ) {
      navigate(customerPath("/profile"), { replace: true });
    }
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
    if (searchParams.get("action") !== "delete-account") {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.set("action", "delete-account");
      setSearchParams(nextParams, { replace: false });
    }
  };

  const handleHelpNavigate = () => {
    setOpen(false);
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
      onHelpNavigate={handleHelpNavigate}
    />
  );

  if (variant === "inline") {
    return (
      <>
        <button
          ref={triggerRef}
          type="button"
          data-delete-account-trigger="inline"
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
          data-delete-account-trigger="sidebar"
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
          data-delete-account-trigger="card"
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

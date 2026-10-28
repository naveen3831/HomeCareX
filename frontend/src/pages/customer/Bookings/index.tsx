import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronDown, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import clsx from "clsx";
import { EmptyState, ErrorState, OfflineState } from "@/components/customer";
import { Pagination } from "@/components/customer/catalog/Pagination";
import { FOCUS_RING } from "@/components/customer/focusRing";
import { PaymentResult } from "@/components/customer/payments";
import { canPayOnline, usePayBooking } from "@/features/payments";
import { useBookings } from "@/hooks/useBookings";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { customerPath } from "@/routes/customerPath";
import type { BookingSort } from "@/types/bookingList";
import { BTN_OUTLINE, BTN_PRIMARY } from "./BookingCards";
import { BookingCard } from "./components/BookingCard";
import { BookingFilters, FilterToggle } from "./components/BookingFilters";
import { BookingListSkeleton } from "./components/BookingListSkeleton";
import { BookingSearch } from "./components/BookingSearch";
import { BookingTabs, tabId } from "./components/BookingTabs";
import { DEFAULT_SORT, EMPTY_COPY, PAGE_SIZE, SORT_OPTIONS } from "./bookingTabs";
import {
  cancelNote,
  getBookingCode,
  getBookingId,
  getServiceName,
  getTotal,
  rupees,
  type BookingListItem,
} from "./bookingModel";
import { useBookingsUrlState } from "./useBookingsUrlState";

const PANEL_ID = "bookings-panel";

export default function MyBookingsPage() {
  const navigate = useNavigate();
  const {
    state,
    hasFilters,
    setTab,
    setSearch,
    setFilters,
    setPage,
    clearFilters,
  } = useBookingsUrlState();
  const online = useOnlineStatus();
  const { state: payState, pay, reset, busy: payBusy } = usePayBooking();

  // Filter panel: closed by default, open if a shared link already carries filters.
  const [filtersOpen, setFiltersOpen] = useState(hasFilters);
  // Count only what the user actually changed, so the badge on the icon is honest.
  const activeFilterCount =
    [state.status, state.date, state.service].filter(Boolean).length +
    (state.sort !== DEFAULT_SORT[state.tab] ? 1 : 0);

  const { data, isError, error, refetch, isPlaceholderData } = useBookings({
    tab: state.tab,
    status: state.status || undefined,
    search: state.search || undefined,
    date: state.date || undefined,
    service: state.service || undefined,
    sort: state.sort,
    page: state.page,
    limit: PAGE_SIZE,
  });

  // One "now" per fetch so every card agrees on what has expired.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const now = useMemo(() => Date.now(), [data]);

  // A shared link or a filter change can leave us past the last page: step back to it.
  const totalPages = data?.meta.totalPages ?? 0;
  useEffect(() => {
    if (!isPlaceholderData && totalPages > 0 && state.page > totalPages)
      setPage(totalPages, true);
  }, [isPlaceholderData, totalPages, state.page, setPage]);

  // Always go to Profile. navigate(-1) would only step back through tab/page changes on this same page.
  const goBack = () => {
    navigate(customerPath("/profile"));
  };

  /** Pay-now strip and the payment result for one booking. Kept here so payment state lives in one place. */
  const renderFooter = (b: BookingListItem): ReactNode => {
    const id = getBookingId(b);
    // No amount on the booking means nothing to collect: don't offer "Pay now" for ₹0.
    const payable = canPayOnline(b, now) && getTotal(b) > 0;
    const result =
      payState.bookingId === id && payState.phase !== "idle" ? payState : null;
    if (!payable && !result) return null;

    const name = getServiceName(b);
    const thisBusy =
      result?.phase === "pending" || result?.phase === "processing";
    const retry = result?.phase === "failed" || result?.phase === "cancelled";
    const awaitingPayment = b.status === "pending_payment";

    return (
      <>
        {payable && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
            <p className="text-xs sm:text-sm text-slate-600">
              {awaitingPayment ? "Payment pending" : "Cash on service"} ·{" "}
              <span className="font-bold text-slate-900">
                {rupees(getTotal(b))}
              </span>{" "}
              due
            </p>
            <button
              type="button"
              onClick={() => void pay(id)}
              disabled={payBusy}
              className={clsx(
                "inline-flex min-h-[38px] items-center justify-center rounded-xl bg-[#4338ca] px-5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-[#3730a3] active:scale-95 disabled:cursor-not-allowed disabled:opacity-60",
                FOCUS_RING,
              )}
            >
              {thisBusy ? "Please wait…" : retry ? "Try again" : "Pay now"}
              <span className="sr-only">
                {" "}
                for {name}, {getBookingCode(b)}
              </span>
            </button>
          </div>
        )}
        {result && result.phase !== "idle" && (
          <div className="px-4 pb-4 pt-1 sm:px-5">
            <PaymentResult
              phase={result.phase}
              message={result.message}
              actions={
                !thisBusy && (
                  <button
                    type="button"
                    onClick={reset}
                    className={clsx(
                      "min-h-[44px] rounded border border-line bg-white px-3 text-sm font-medium text-ink hover:bg-canvas",
                      FOCUS_RING,
                    )}
                  >
                    Dismiss
                  </button>
                )
              }
            />
          </div>
        )}
      </>
    );
  };

  const retry = () => void refetch();
  const bookNow = (
    <Link to={customerPath("/services")} className={BTN_OUTLINE}>
      Book a service
    </Link>
  );

  let content: ReactNode;
  if (!data && isError) {
    // Offline wins over a generic failure: the fix is different.
    content = online ? (
      <ErrorState
        title="Couldn't load bookings"
        message={error?.message || "Failed to fetch bookings from server"}
        onRetry={retry}
      />
    ) : (
      <OfflineState message="Reconnect to see your bookings." onRetry={retry} />
    );
  } else if (!data) {
    // While offline, React Query pauses the request, so a skeleton would spin forever.
    content = online ? (
      <BookingListSkeleton />
    ) : (
      <OfflineState message="Reconnect to see your bookings." onRetry={retry} />
    );
  } else if (data.items.length === 0) {
    content = hasFilters ? (
      <EmptyState
        title="No bookings match your filters"
        description="Try a different search or clear the filters."
        action={
          <button
            type="button"
            onClick={clearFilters}
            className={clsx(BTN_OUTLINE)}
          >
            Clear filters
          </button>
        }
      />
    ) : (
      <EmptyState
        title={EMPTY_COPY[state.tab].title}
        description={EMPTY_COPY[state.tab].description}
        action={state.tab === "upcoming" ? bookNow : undefined}
      />
    );
  } else {
    const { page, limit, total } = data.meta;
    const from = (page - 1) * limit + 1;
    const to = from + data.items.length - 1;
    content = (
      <>
        {isError && (
          <div
            role="alert"
            className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-panel px-4 py-3 text-sm text-ink"
          >
            <span>
              Couldn&apos;t refresh. Showing the bookings loaded earlier.
            </span>
            <button
              type="button"
              onClick={retry}
              className={clsx(
                "min-h-[44px] font-semibold text-brand hover:underline",
                FOCUS_RING,
              )}
            >
              Try again
            </button>
          </div>
        )}
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-sm text-slate-600 font-normal" aria-live="polite">
            Showing {from}–{to} of {total} {total === 1 ? "booking" : "bookings"}
          </p>
          <div className="relative inline-flex items-center gap-1 text-sm font-medium text-slate-700 md:hidden">
            <span>Sort by</span>
            <ChevronDown className="h-4 w-4 text-slate-500" aria-hidden="true" />
            <select
              value={state.sort}
              onChange={(e) => setFilters({ sort: e.target.value as BookingSort })}
              className="absolute inset-0 cursor-pointer opacity-0 w-full h-full"
              aria-label="Sort bookings"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <ul
          aria-busy={isPlaceholderData}
          className={clsx(
            "grid grid-cols-[repeat(auto-fill,minmax(min(20rem,100%),1fr))] gap-4 transition-opacity",
            isPlaceholderData && "opacity-60",
          )}
        >
          {data.items.map((b, i) => (
            <BookingCard
              key={getBookingId(b)}
              booking={b}
              tab={state.tab}
              now={now}
              index={i}
              note={state.tab === "cancelled" ? cancelNote(b, now) : undefined}
              footer={renderFooter(b)}
            />
          ))}
        </ul>
        <div className="mt-6">
          <Pagination
            page={page}
            totalPages={data.meta.totalPages}
            onPageChange={(p) => setPage(p)}
            disabled={isPlaceholderData}
          />
        </div>
      </>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl">
      {/* Mobile-only Header (md:hidden) */}
      <div className="space-y-3 md:hidden">
        <div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={goBack}
              aria-label="Back to Profile"
              className="-ml-1.5 flex h-9 w-9 items-center justify-center rounded-xl text-slate-900 transition-all hover:bg-slate-100 active:scale-95"
            >
              <ChevronLeft className="h-6 w-6 stroke-[2.5]" aria-hidden="true" />
            </button>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              My Bookings
            </h1>
          </div>
          <p className="mt-1 pl-1 text-xs sm:text-sm text-slate-500 font-normal">
            Manage and track your service bookings
          </p>
        </div>

        {/* Full-width Book a service button */}
        <Link
          to={customerPath("/services")}
          className="flex w-full items-center justify-between rounded-2xl bg-[#4338ca] px-5 py-3.5 text-white shadow-md transition-all hover:bg-[#3730a3] active:scale-[0.99]"
        >
          <span className="flex items-center gap-2 text-sm font-semibold">
            <Plus className="h-5 w-5 stroke-[2.5]" aria-hidden="true" />
            Book a service
          </span>
          <ChevronRight className="h-5 w-5 stroke-[2.5]" aria-hidden="true" />
        </Link>
      </div>

      {/* Desktop Header (hidden md:flex) - preserved exactly */}
      <div className="hidden md:flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="sr-only">
            My Bookings
          </h1>
          <p className="mt-1 text-sm text-muted">
            Track what&apos;s happening now, what&apos;s next and what&apos;s
            done.
          </p>
        </div>
        <Link to={customerPath("/services")} className={BTN_PRIMARY}>
          <Plus
            className="mr-1.5 h-4 w-4"
            strokeWidth={2.5}
            aria-hidden="true"
          />
          Book a service
        </Link>
      </div>

      {/* Search + filter button */}
      <div className="mt-4 flex items-center gap-2.5 md:mt-6">
        <div className="min-w-0 flex-1">
          <BookingSearch value={state.search} onSearch={setSearch} />
        </div>
        <FilterToggle
          open={filtersOpen}
          activeCount={activeFilterCount}
          onToggle={() => setFiltersOpen((o) => !o)}
        />
      </div>

      {/* Filter fields: Status, Service date, Service, Sort by */}
      <div className="mt-3">
        <BookingFilters
          open={filtersOpen}
          tab={state.tab}
          status={state.status}
          date={state.date}
          service={state.service}
          sort={state.sort}
          hasFilters={hasFilters}
          onChange={setFilters}
          onClear={clearFilters}
        />
      </div>

      {/* Tabs */}
      <div className="mt-4">
        <BookingTabs active={state.tab} onChange={setTab} panelId={PANEL_ID} />
      </div>

      <div
        role="tabpanel"
        id={PANEL_ID}
        aria-labelledby={tabId(state.tab)}
        className="mt-5 md:mt-6"
      >
        {content}
      </div>
    </div>
  );
}
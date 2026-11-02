import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, MessageSquareText, Star, X } from "lucide-react";
import clsx from "clsx";
import { EmptyState, ErrorState, OfflineState } from "@/components/customer";
import { FOCUS_RING } from "@/components/customer/focusRing";
import { useCreateReview, useReviews } from "@/hooks/useReviews";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { customerPath } from "@/routes/customerPath";
import type { CreateBookingReviewInput } from "@/services/reviewsApi";
import { PendingReviewCard } from "./components/PendingReviewCard";
import { ReviewCard } from "./components/ReviewCard";
import { ReviewForm } from "./components/ReviewForm";
import { ReviewsSkeleton } from "./components/ReviewsSkeleton";
import { isReviewsTab, type ReviewsTab } from "./reviewModel";

const TABS: ReadonlyArray<{ id: ReviewsTab; label: string }> = [
  { id: "pending", label: "Pending" },
  { id: "mine", label: "My reviews" },
];
const tabId = (t: ReviewsTab) => `reviews-tab-${t}`;
const PANEL_ID = "reviews-panel";
const LIST_CARD = "overflow-hidden rounded-[22px] border border-line/70 bg-panel shadow-[0_10px_28px_-16px_rgba(30,27,46,.18)]";

/**
 * /customer/reviews
 *  - Pending: completed bookings with no review yet; "Write a review" opens the form inside the card.
 *  - My reviews: reviews already written, with their validation status.
 * A link like ?booking=<id> (from a "service completed" notification) opens that booking's form straight away.
 */
export default function Reviews() {
  const [params, setParams] = useSearchParams();
  const online = useOnlineStatus();
  const { pending, mine } = useReviews();
  const create = useCreateReview();

  const targetBooking = params.get("booking");
  const rawTab = params.get("tab");
  const tab: ReviewsTab = isReviewsTab(rawTab) ? rawTab : "pending";

  const [openId, setOpenId] = useState<string | null>(targetBooking);
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const tabRefs = useRef<Partial<Record<ReviewsTab, HTMLButtonElement | null>>>({});

  // A booking link opens its form once; scroll it into view when the list arrives.
  const scrolled = useRef(false);
  useEffect(() => {
    if (!targetBooking || scrolled.current || !pending.data?.some((b) => b.bookingId === targetBooking)) return;
    scrolled.current = true;
    document.getElementById(`pending-${targetBooking}`)?.scrollIntoView?.({ block: "start" });
  }, [targetBooking, pending.data]);

  const targetMissing = Boolean(targetBooking && pending.data && !pending.data.some((b) => b.bookingId === targetBooking));

  const setTab = (next: ReviewsTab) => {
    const p = new URLSearchParams(params);
    if (next === "pending") p.delete("tab");
    else p.set("tab", next);
    p.delete("booking");
    setParams(p, { replace: true });
    setOpenId(null);
    setFormError("");
  };

  const toggle = (bookingId: string) => {
    create.reset();
    setFormError("");
    setNotice(null);
    setOpenId((cur) => (cur === bookingId ? null : bookingId));
  };

  const clearBookingParam = () => {
    if (!params.has("booking")) return;
    const p = new URLSearchParams(params);
    p.delete("booking");
    setParams(p, { replace: true });
  };

  const submit = (bookingId: string, serviceName: string, input: CreateBookingReviewInput) => {
    setFormError("");
    setNotice(null);
    // While offline the request would just wait, so say so right away.
    if (!online) {
      setFormError("You're offline. Reconnect and try again.");
      return;
    }
    create.mutate(
      { bookingId, ...input },
      {
        onSuccess: (saved) => {
          setOpenId(null);
          clearBookingParam();
          setNotice({ kind: "success", text: `Thanks! Your review of ${saved.serviceName ?? serviceName} was submitted. It is now live on the service page.` });
        },
        onError: (err) => {
          // Already reviewed / not yours / not completed: the form can't succeed, so close it and explain.
          if (err.status === 409 || err.status === 404) {
            setOpenId(null);
            clearBookingParam();
            setNotice({ kind: "error", text: err.message });
          }
        },
      },
    );
  };

  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next = index;
    if (e.key === "ArrowRight") next = (index + 1) % TABS.length;
    else if (e.key === "ArrowLeft") next = (index - 1 + TABS.length) % TABS.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = TABS.length - 1;
    else return;
    e.preventDefault();
    setTab(TABS[next].id);
    tabRefs.current[TABS[next].id]?.focus();
  };

  const counts: Record<ReviewsTab, number | undefined> = { pending: pending.data?.length, mine: mine.data?.length };
  const mutationError = create.isError && create.error.status !== 409 && create.error.status !== 404 ? create.error.message : "";

  /** One list's loading / offline / error / empty / data states, so no tab is ever blank. */
  const renderList = <T,>(q: { data?: T[]; isError: boolean; error: { message: string } | null; refetch: () => unknown }, noun: string, empty: ReactNode, rows: (items: T[]) => ReactNode): ReactNode => {
    const retry = () => void q.refetch();
    if (!q.data) {
      if (!online) return <OfflineState message={`Reconnect to see your ${noun}.`} onRetry={retry} />;
      if (q.isError) return <ErrorState title={`Couldn't load your ${noun}`} message={q.error?.message} onRetry={retry} />;
      return <div className={LIST_CARD}><ReviewsSkeleton /></div>;
    }
    if (q.data.length === 0) return empty;
    return (
      <>
        {q.isError && (
          <p role="alert" className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Couldn't refresh just now. Showing what we last loaded.{" "}
            <button type="button" onClick={retry} className={clsx("font-semibold underline", FOCUS_RING)}>Retry</button>
          </p>
        )}
        {rows(q.data)}
      </>
    );
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5">
      <header>
        {/* The top bar shows the page name; keep a real heading for screen readers. */}
        <h1 className="sr-only">Reviews</h1>
        <p className="mt-1 text-sm text-muted">Rate your completed services. Your review is published on the service page right away, and our team may remove anything that breaks our guidelines.</p>
      </header>

      {notice && (
        <div role={notice.kind === "error" ? "alert" : "status"} className={clsx("flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm", notice.kind === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-800")}>
          {notice.kind === "success" && <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />}
          <p className="min-w-0 flex-1">
            {notice.text}
            {notice.kind === "success" && (
              <>
                {" "}
                <button type="button" onClick={() => { setTab("mine"); setNotice(null); }} className={clsx("font-semibold underline", FOCUS_RING)}>See my reviews</button>
              </>
            )}
          </p>
          <button type="button" aria-label="Dismiss message" onClick={() => setNotice(null)} className={clsx("-m-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full hover:bg-black/5", FOCUS_RING)}>
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
      )}

      {targetMissing && tab === "pending" && (
        <p role="status" className="rounded-2xl border border-line bg-panel px-4 py-3 text-sm text-muted">
          That booking is either already reviewed or isn't completed yet, so there's nothing to review right now.
        </p>
      )}

      <div role="tablist" aria-label="Reviews" className="grid grid-cols-2 border-b border-line">
        {TABS.map((t, i) => {
          const selected = tab === t.id;
          const n = counts[t.id];
          return (
            <button
              key={t.id}
              ref={(el) => { tabRefs.current[t.id] = el; }}
              id={tabId(t.id)}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={PANEL_ID}
              aria-label={n !== undefined ? `${t.label}, ${n} ${t.id === "pending" ? "waiting" : "written"}` : t.label}
              tabIndex={selected ? 0 : -1}
              onClick={() => setTab(t.id)}
              onKeyDown={(e) => onTabKey(e, i)}
              className={clsx("-mb-px flex min-h-[48px] items-center justify-center gap-2 border-b-2 text-sm font-medium transition-colors", selected ? "border-brand text-brand" : "border-transparent text-muted hover:text-ink", FOCUS_RING)}
            >
              {t.label}
              {n !== undefined && (
                <span aria-hidden="true" className={clsx("min-w-[22px] rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums", selected ? "bg-brand text-white" : "bg-line/70 text-muted")}>
                  {n}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div id={PANEL_ID} role="tabpanel" aria-labelledby={tabId(tab)} tabIndex={-1}>
        {tab === "pending"
          ? renderList(
              pending,
              "pending reviews",
              <EmptyState
                icon={Star}
                title="You're all caught up"
                description="When a service is completed, you can rate it here."
                action={<Link to={customerPath("/bookings")} className={clsx("inline-flex min-h-[44px] items-center rounded-full border border-line bg-panel px-5 text-sm font-semibold text-ink hover:bg-canvas", FOCUS_RING)}>View my bookings</Link>}
              />,
              (items) => (
                <ul className={clsx(LIST_CARD, "divide-y divide-line")}>
                  {items.map((b) => (
                    <PendingReviewCard key={b.bookingId} booking={b} open={openId === b.bookingId} onToggle={() => toggle(b.bookingId)}>
                      <ReviewForm
                        booking={b}
                        submitting={create.isPending}
                        error={formError || mutationError}
                        onSubmit={(input) => submit(b.bookingId, b.serviceName, input)}
                        onCancel={() => { toggle(b.bookingId); clearBookingParam(); }}
                      />
                    </PendingReviewCard>
                  ))}
                </ul>
              ),
            )
          : renderList(
              mine,
              "reviews",
              <EmptyState icon={MessageSquareText} title="No reviews yet" description="Reviews you write will show up here with their validation status." action={<button type="button" onClick={() => setTab("pending")} className={clsx("inline-flex min-h-[44px] items-center rounded-full border border-line bg-panel px-5 text-sm font-semibold text-ink hover:bg-canvas", FOCUS_RING)}>See pending reviews</button>} />,
              (items) => (
                <ul className={clsx(LIST_CARD, "divide-y divide-line")}>
                  {items.map((r) => (
                    <li key={r.id}>
                      <ReviewCard review={r} />
                    </li>
                  ))}
                </ul>
              ),
            )}
      </div>
    </div>
  );
}

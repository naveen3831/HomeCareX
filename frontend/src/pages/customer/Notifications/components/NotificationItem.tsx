import { useRef, useState, type PointerEvent } from "react";
import { Link } from "react-router-dom";
import { Check, Trash2 } from "lucide-react";
import clsx from "clsx";
import { FOCUS_RING } from "@/components/customer/focusRing";
import type { CustomerNotification } from "@/services/notificationApi";
import { GROUP_META, bookingHref, describeNotification, fullDate, notificationTargets, reviewHref, ticketHref, timeAgo } from "../notificationModel";

interface Props {
  notification: CustomerNotification;
  onMarkRead: (id: string) => void;
  /** Called after the row has been swiped left far enough (or its Delete button was used). */
  onDelete: (notification: CustomerNotification) => void;
  /** True while this row's "mark read" request is in flight. */
  marking?: boolean;
}

/** Swipe left by this many px (or this share of the row's width, whichever is smaller) to delete. */
const SWIPE_PX = 96;
const SWIPE_SHARE = 0.4;

const ACTION = clsx("inline-flex min-h-[40px] items-center rounded-full border border-line bg-panel px-4 text-sm font-semibold text-ink transition-colors hover:bg-canvas", FOCUS_RING);
const ACTION_PRIMARY = clsx("inline-flex min-h-[40px] items-center rounded-full bg-brand px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90", FOCUS_RING);

/**
 * One notification. Swipe it left (finger, pen or mouse drag) to delete it; a red "Delete" shows underneath while you drag.
 * Wider screens also get a Delete button on hover / keyboard focus. Opening a booking / ticket / review from it also marks it read.
 * Actions are real links and buttons (not a clickable row), so keyboard and screen reader users get each one.
 */
export function NotificationItem({ notification: n, onMarkRead, onDelete, marking }: Props) {
  const meta = GROUP_META[n.group] ?? GROUP_META.system;
  const Icon = meta.icon;
  const { title, message } = describeNotification(n);
  const { bookingId, ticketId } = notificationTargets(n);
  const unread = !n.readAt;
  const markOnOpen = () => {
    if (unread) onMarkRead(n.id);
  };

  // Swipe-to-delete. `touch-action: pan-y` lets the browser keep vertical scrolling; horizontal moves come to us.
  const rowRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; horizontal: boolean | null } | null>(null);
  const moved = useRef(false);
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const reset = () => {
    drag.current = null;
    setDragging(false);
    setDx(0);
  };
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (leaving || (e.pointerType === "mouse" && e.button !== 0)) return;
    moved.current = false;
    drag.current = { x: e.clientX, y: e.clientY, horizontal: null };
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const mx = e.clientX - d.x;
    const my = e.clientY - d.y;
    if (d.horizontal === null) {
      if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
      d.horizontal = Math.abs(mx) > Math.abs(my);
      if (d.horizontal) {
        e.currentTarget.setPointerCapture?.(e.pointerId);
        setDragging(true);
      }
    }
    if (!d.horizontal) return;
    moved.current = true;
    setDx(Math.min(0, mx)); // left only
  };
  const onPointerEnd = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d?.horizontal) return reset();
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) e.currentTarget.releasePointerCapture?.(e.pointerId);
    const width = rowRef.current?.offsetWidth || 320;
    if (e.type === "pointerup" && -dx >= Math.min(SWIPE_PX, width * SWIPE_SHARE)) {
      drag.current = null;
      setDragging(false);
      setLeaving(true);
      setDx(-width);
      window.setTimeout(() => onDelete(n), 180);
    } else {
      reset();
    }
  };
  // A drag that ends over a link or button must not also "click" it.
  const swallowClick = (e: { preventDefault: () => void; stopPropagation: () => void }) => {
    if (moved.current) {
      e.preventDefault();
      e.stopPropagation();
      moved.current = false;
    }
  };

  return (
    <li className="group relative overflow-hidden bg-danger/65" data-swiping={dx < 0 ? "true" : undefined}>
      <div aria-hidden="true" className="absolute inset-y-0 right-0 flex w-full items-center justify-end gap-2 pr-6 text-sm font-semibold text-white">
        <Trash2 className="h-5 w-5" />
        Delete
      </div>
      <div
        ref={rowRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onClickCapture={swallowClick}
        style={{ transform: dx ? `translateX(${dx}px)` : undefined, touchAction: "pan-y" }}
        className={clsx(
          "relative flex gap-3 bg-canvas px-4 py-4 sm:gap-4 sm:px-6",
          !dragging && "transition-transform duration-200 ease-out motion-reduce:transition-none",
          leaving && "opacity-70",
          unread && "before:pointer-events-none before:absolute before:inset-0 before:bg-brand-soft/40",
        )}
      >
      <span aria-hidden="true" className={clsx("relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full", meta.tint)}>
        <Icon className="h-5 w-5" />
      </span>

      <div className="relative min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <p className={clsx("min-w-0 break-words text-[15px] text-ink", unread ? "font-semibold" : "font-medium")}>
            {unread && <span className="sr-only">Unread. </span>}
            {title}
          </p>
          <div className="flex shrink-0 items-center gap-1 pt-0.5">
            <time dateTime={n.createdAt} title={fullDate(n.createdAt)} className="text-xs text-muted">
              {timeAgo(n.createdAt)}
            </time>
            <button
              type="button"
              onClick={() => onDelete(n)}
              aria-label={`Delete notification: ${title}`}
              className={clsx("-my-1.5 hidden h-8 w-8 items-center justify-center rounded-full text-muted transition-opacity hover:bg-danger-soft hover:text-danger focus-visible:opacity-100 group-hover:opacity-100 sm:flex sm:opacity-0", FOCUS_RING)}
            >
              <Trash2 aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
        </div>
        <p className="mt-0.5 break-words text-sm text-muted">{message}</p>
        <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-muted/80">{meta.label}</p>

        {(bookingId || ticketId || unread) && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {n.type === "booking.completed" && bookingId && (
              <Link to={reviewHref(bookingId)} onClick={markOnOpen} className={ACTION_PRIMARY}>
                Rate service
              </Link>
            )}
            {bookingId && (
              <Link to={bookingHref(bookingId)} onClick={markOnOpen} className={ACTION}>
                Open booking
              </Link>
            )}
            {ticketId && (
              <Link to={ticketHref(ticketId)} onClick={markOnOpen} className={ACTION}>
                Open ticket
              </Link>
            )}
            {unread && (
              <button type="button" onClick={() => onMarkRead(n.id)} disabled={marking} className={clsx("inline-flex min-h-[40px] items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-brand hover:bg-brand-soft disabled:opacity-60 first:-ml-3", FOCUS_RING)}>
                <Check aria-hidden="true" className="h-4 w-4" />
                Mark as read<span className="sr-only">: {title}</span>
              </button>
            )}
          </div>
        )}
      </div>

      {unread && <span aria-hidden="true" className="absolute right-3 top-4 hidden h-2 w-2 rounded-full bg-brand sm:block" />}
      </div>
    </li>
  );
}

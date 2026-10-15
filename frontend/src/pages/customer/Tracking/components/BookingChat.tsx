import clsx from "clsx";
import { MessageCircle, MoreHorizontal, X } from "lucide-react";
import ChatPanel from "@/components/ChatPanel";
import { FOCUS_RING } from "@/components/customer/focusRing";

/**
 * The customer's side of the booking chat, shown beside the timeline when the customer
 * clicks the Chat button on the Service Partner card.
 */
export default function BookingChat({
  id,
  bookingId,
  onClose,
}: {
  /** DOM id, used by the partner card's Chat button. */
  id: string;
  bookingId: string;
  /** Optional handler to hide the chat card again. */
  onClose?: () => void;
}) {
  return (
    <section
      id={id}
      tabIndex={-1}
      aria-labelledby={`${id}-title`}
      className="booking-chat-card tk-booking-chat focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
    >
      <div className="tk-card-header">
        <div className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden="true"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand"
          >
            <MessageCircle className="h-3.5 w-3.5" />
          </span>
          <h2
            id={`${id}-title`}
            className="truncate text-[15px] font-semibold leading-tight text-ink"
          >
            Chat with Partner
          </h2>
        </div>

        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close chat"
            title="Close chat"
            className={clsx(
              "inline-flex h-6 w-6 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-ink",
              FOCUS_RING,
            )}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : (
          <span
            aria-hidden="true"
            className="inline-flex h-6 w-6 items-center justify-center rounded-full text-slate-400"
          >
            <MoreHorizontal className="h-4 w-4" />
          </span>
        )}
      </div>

      <div className="tk-chat-slot">
        <ChatPanel bookingId={bookingId} viewerRole="customer" />
      </div>
    </section>
  );
}

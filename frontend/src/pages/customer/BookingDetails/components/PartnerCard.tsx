import { BadgeCheck, MapPin, Phone, Star, UserRound } from "lucide-react";
import clsx from "clsx";
import { FOCUS_RING } from "@/components/customer/focusRing";
import type { BookingDetailPartner } from "@/types/bookingDetail";
import { formatRating } from "../../Bookings/bookingModel";

/** Who is coming. Before a partner accepts, says so with an active search state instead of an empty box. */
export default function PartnerCard({
  partner,
  hasPartner,
  isCancelled,
}: {
  partner: BookingDetailPartner | null;
  hasPartner: boolean;
  isCancelled?: boolean;
}) {
  if (!hasPartner) {
    if (isCancelled) {
      return (
        <div className="flex items-center gap-3 rounded-xl bg-canvas p-4 ring-1 ring-line">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <UserRound className="h-5 w-5" />
          </span>
          <p className="text-sm text-muted">
            No partner was assigned for this booking.
          </p>
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-3 rounded-xl bg-brand-soft/40 p-4 ring-1 ring-brand/10 sm:flex-row sm:items-center">
        <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand/20 opacity-75" />
          <UserRound className="relative h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">
            Finding your service partner
          </p>
          <p className="mt-0.5 text-xs text-muted">
            We're finding the best partner for you. You'll see their details here as soon as someone accepts.
          </p>
        </div>
      </div>
    );
  }

  const rating = formatRating(partner?.rating);
  const name = partner?.name?.trim() || "Your partner";

  return (
    <div className="flex flex-col gap-3.5 rounded-xl bg-canvas p-4 ring-1 ring-line sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-1 items-start gap-3.5 sm:items-center">
        <span
          aria-hidden="true"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand shadow-sm"
        >
          {partner?.name ? (
            <span className="text-lg font-bold">
              {partner.name.trim().charAt(0).toUpperCase()}
            </span>
          ) : (
            <UserRound className="h-6 w-6" />
          )}
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="break-words text-sm font-bold text-ink">{name}</p>
            {partner?.verified && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
                Verified partner
              </span>
            )}
          </div>
          {rating && (
            <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
              <span className="flex items-center gap-0.5 font-semibold text-ink">
                <Star
                  className="h-3.5 w-3.5 fill-amber-400 text-amber-400"
                  aria-hidden="true"
                />
                {rating}
              </span>
              <span className="sr-only"> out of 5</span>
              {partner?.ratingCount ? (
                <span className="break-words">({partner.ratingCount} jobs completed)</span>
              ) : null}
            </p>
          )}
          {(partner?.phone || partner?.city) && (
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
              {partner?.phone && (
                <span className="inline-flex items-center gap-1">
                  <Phone className="h-3 w-3 text-muted" aria-hidden="true" />
                  {partner.phone}
                </span>
              )}
              {partner?.city && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-muted" aria-hidden="true" />
                  {partner.city}
                </span>
              )}
            </p>
          )}
        </div>
      </div>
      {partner?.phone && (
        <a
          href={`tel:${partner.phone}`}
          aria-label={`Call ${name}`}
          className={clsx(
            "inline-flex h-10 w-full shrink-0 items-center justify-center gap-1.5 rounded-xl bg-brand px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-brand/90 sm:h-9 sm:w-auto",
            FOCUS_RING,
          )}
        >
          <Phone className="h-3.5 w-3.5" aria-hidden="true" />
          Call Partner
        </a>
      )}
    </div>
  );
}

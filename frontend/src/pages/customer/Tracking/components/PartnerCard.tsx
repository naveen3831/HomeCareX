import { useState } from "react";
import clsx from "clsx";
import { Link } from "react-router-dom";
import {
  BadgeCheck,
  FileText,
  MapPin,
  MessageCircle,
  Phone,
  ShieldCheck,
  Star,
  UserRound,
} from "lucide-react";
import { FOCUS_RING } from "@/components/customer/focusRing";
import type { BookingDetailPartner } from "@/types/bookingDetail";
import { formatRating } from "../../Bookings/bookingModel";

const ACTION_BTN =
  "flex h-9 items-center justify-center gap-1.5 rounded-lg border px-2 text-xs font-semibold leading-none text-ink transition";

/** Who is coming: photo (or initial), name, rating, role/ID, Call / Chat / Details, and the ETA and distance tiles. */
export default function PartnerCard({
  partner,
  hasPartner,
  serviceTitle,
  partnerCode = null,
  etaMinutes,
  distanceText,
  showTravel,
  detailsHref,
  chatOpen = false,
  onChat,
}: {
  partner: BookingDetailPartner | null;
  hasPartner: boolean;
  serviceTitle?: string | null;
  /** Real partner code derived from the partner id. Null hides the ID row. */
  partnerCode?: string | null;
  /** Rough minutes away. Null when there is no live position. */
  etaMinutes: number | null;
  /** e.g. "2.8 km". Null when either position is unknown. */
  distanceText: string | null;
  /** False once the partner is on site: ETA and distance no longer mean anything. */
  showTravel: boolean;
  detailsHref: string;
  chatOpen?: boolean;
  onChat: () => void;
}) {
  const [photoFailed, setPhotoFailed] = useState(false);

  if (!hasPartner) {
    return (
      <p className="text-xs leading-relaxed text-muted">
        We're finding the best partner for you. Their details and live location
        will appear here as soon as someone accepts.
      </p>
    );
  }

  const name = partner?.name?.trim() || "Your partner";
  // No made-up rating: show it only when the partner actually has one.
  const rating = formatRating(partner?.rating);
  const count = partner?.ratingCount ?? 0;
  const showPhoto = Boolean(partner?.avatar) && !photoFailed;
  const roleLabel = serviceTitle?.toLowerCase().includes("clean")
    ? "Cleaning Specialist"
    : "Service Specialist";

  return (
    <div className="flex shrink-0 flex-col gap-2.5">
      {/* Partner Avatar + Name + Rating + Specialist Subtitle */}
      <div className="flex shrink-0 items-center gap-2.5">
        <span
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-brand/15 bg-brand-soft text-brand shadow-xs"
        >
          {showPhoto ? (
            <img
              src={partner?.avatar}
              alt=""
              className="h-full w-full object-cover"
              onError={() => setPhotoFailed(true)}
            />
          ) : partner?.name ? (
            <span className="text-sm font-bold">
              {partner.name.trim().charAt(0).toUpperCase()}
            </span>
          ) : (
            <UserRound className="h-4 w-4" />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold leading-[1.15] text-ink">
            {name}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-1 text-[11px] leading-[1.15] text-slate-600">
            {rating ? (
              <>
                <Star
                  className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400"
                  aria-hidden="true"
                />
                <span className="font-bold text-ink">{rating}</span>
                <span className="sr-only"> out of 5</span>
                <span>
                  ({count} {count === 1 ? "review" : "reviews"})
                </span>
              </>
            ) : (
              <span>New partner</span>
            )}
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] leading-[1.15] text-slate-600">
            <span className="font-medium">{roleLabel}</span>
            {partnerCode && (
              <>
                <span aria-hidden="true" className="text-slate-300">
                  •
                </span>
                <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
                  {partner?.verified ? (
                    <BadgeCheck
                      className="h-3 w-3 shrink-0 text-brand"
                      aria-hidden="true"
                    />
                  ) : (
                    <ShieldCheck
                      className="h-3 w-3 shrink-0 text-emerald-600"
                      aria-hidden="true"
                    />
                  )}
                  Partner ID: {partnerCode}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons: Call / Chat / Details with clear icons */}
      <div className="grid shrink-0 grid-cols-3 gap-1.5">
        {partner?.phone ? (
          <a
            href={`tel:${partner.phone}`}
            aria-label={`Call ${name}`}
            className={clsx(
              ACTION_BTN,
              "border-emerald-200/80 bg-emerald-50/90 hover:bg-emerald-100/80",
              FOCUS_RING,
            )}
          >
            <span
              aria-hidden="true"
              className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white"
            >
              <Phone className="h-2.5 w-2.5 stroke-[2.25]" />
            </span>
            <span>Call</span>
          </a>
        ) : (
          <span
            aria-disabled="true"
            className={clsx(
              ACTION_BTN,
              "cursor-not-allowed border-emerald-100 bg-emerald-50/70",
            )}
          >
            <span
              aria-hidden="true"
              className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white"
            >
              <Phone className="h-2.5 w-2.5 stroke-[2.25]" />
            </span>
            <span>Call</span>
          </span>
        )}

        <button
          type="button"
          onClick={onChat}
          aria-expanded={chatOpen}
          aria-controls="tracking-chat"
          className={clsx(
            ACTION_BTN,
            chatOpen
              ? "border-brand bg-brand/15 text-brand"
              : "border-brand/20 bg-brand-soft hover:bg-brand-soft/75",
            FOCUS_RING,
          )}
        >
          <span
            aria-hidden="true"
            className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand text-white"
          >
            <MessageCircle className="h-2.5 w-2.5 stroke-[2.25]" />
          </span>
          <span>Chat</span>
        </button>

        <Link
          to={detailsHref}
          className={clsx(
            ACTION_BTN,
            "border-line bg-white hover:bg-slate-50",
            FOCUS_RING,
          )}
        >
          <span
            aria-hidden="true"
            className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand-soft/80 text-brand"
          >
            <FileText className="h-2.5 w-2.5 stroke-[2.25]" />
          </span>
          <span>Details</span>
        </Link>
      </div>

      {/* Compact ETA & Distance */}
      {showTravel && (
        <dl className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-xl border border-brand/15 bg-[#f4f3ff] px-3 py-1">
          <div className="min-w-0">
            <dt className="text-[10px] font-semibold uppercase tracking-wide leading-none text-slate-500">
              ETA
            </dt>
            <dd className="mt-0.5 truncate text-xs font-bold leading-none text-brand">
              {etaMinutes !== null ? `${etaMinutes} min` : "—"}
            </dd>
          </div>
          <span aria-hidden="true" className="h-5 w-px shrink-0 bg-brand/15" />
          <div className="flex min-w-0 items-center justify-between gap-1.5">
            <div className="min-w-0">
              <dt className="text-[10px] font-semibold uppercase tracking-wide leading-none text-slate-500">
                Distance
              </dt>
              <dd className="mt-0.5 truncate text-xs font-bold leading-none text-ink">
                {distanceText ?? "—"}
              </dd>
            </div>
            <MapPin
              className="h-3.5 w-3.5 shrink-0 text-brand"
              aria-hidden="true"
            />
          </div>
        </dl>
      )}
    </div>
  );
}

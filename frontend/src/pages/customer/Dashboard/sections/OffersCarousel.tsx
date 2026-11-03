import { useState } from "react";
import { Check, Copy } from "lucide-react";
import clsx from "clsx";
import { Icon3D } from "@/components/customer";

export interface Offer {
  id: string;
  title: string;
  description: string;
  code: string;
  accent: "brand" | "accent";
  isReferral?: boolean;
}

interface OffersCarouselProps {
  offers: Offer[];
  isLoading?: boolean;
}

/** Offer banners: scroll on phones, two-up grid from md. */
export default function OffersCarousel({ offers, isLoading }: OffersCarouselProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function copy(offer: Offer) {
    try {
      await navigator.clipboard.writeText(offer.code);
      setCopiedId(offer.id);
      setTimeout(() => setCopiedId((id) => (id === offer.id ? null : id)), 1800);
    } catch {
      /* clipboard unavailable — the code is still visible to copy by hand */
    }
  }

  if (isLoading && offers.length === 0) {
    return (
      <div className="relative -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-4 md:items-stretch md:auto-rows-fr md:overflow-visible md:px-0 md:pb-0">
        {[1, 2, 3].map((idx) => (
          <div
            key={idx}
            className="group relative flex min-h-[148px] w-[calc(100vw-32px)] max-w-[420px] shrink-0 snap-start flex-col justify-between overflow-hidden rounded-[24px] border border-slate-200/60 bg-slate-100/80 p-4 animate-pulse md:w-auto md:h-full md:max-w-none md:p-5"
          >
            <div className="flex items-start gap-3">
              <div className="h-14 w-14 rounded-2xl bg-slate-200 shrink-0" />
              <div className="flex-1 space-y-2 pt-1">
                <div className="h-4 w-3/4 rounded bg-slate-200" />
                <div className="h-3 w-1/2 rounded bg-slate-200" />
              </div>
            </div>
            <div className="mt-auto pt-3 flex items-center justify-between gap-2">
              <div className="h-8 w-10 rounded bg-slate-200" />
              <div className="flex items-center gap-2">
                <div className="h-8 w-28 rounded-xl bg-slate-200" />
                <div className="h-8 w-20 rounded-full bg-slate-200" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  const isSingle = offers.length === 1;

  // Web layout: 1 col if single, 2 cols if 2, 3 cols from lg (and span last odd item on md)
  const gridColsClass =
    offers.length === 1
      ? "md:grid-cols-1"
      : offers.length === 2
        ? "md:grid-cols-2"
        : offers.length === 3
          ? "md:grid-cols-2 lg:grid-cols-3"
          : "md:grid-cols-2 lg:grid-cols-4";

  return (
    <div
      className={clsx(
        isSingle
          ? "w-full max-w-xl"
          : clsx(
              "relative -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2",
              "md:mx-0 md:grid md:gap-4 md:items-stretch md:auto-rows-fr md:overflow-visible md:px-0 md:pb-0",
              gridColsClass
            )
      )}
    >
      {offers.map((o, index) => {
        const isReferral = o.isReferral || o.id === "referral-reward";
        const isCopied = copiedId === o.id;

        // Grid span logic for web/tablet:
        // - When there are 3 offers: 3rd card spans 2 cols on md, 1 col on lg (clean 3-col row on desktop).
        // - When there are 5 offers: 5th card (Referral banner) spans 2 cols on md, and all 4 cols on lg (clean full-width banner).
        // - When any referral banner sits as the last item on an odd row: span across remaining columns to avoid truncation & gaps.
        let spanClass = "";
        if (offers.length === 3 && index === 2) {
          spanClass = "md:col-span-2 lg:col-span-1";
        } else if (offers.length === 5 && index === 4) {
          spanClass = "md:col-span-2 lg:col-span-4";
        } else if (isReferral && index === offers.length - 1 && offers.length > 2) {
          spanClass = "md:col-span-2 lg:col-span-full";
        }

        if (isReferral) {
          return (
            <div
              key={o.id}
              className={clsx(
                "dashboard-offer group relative flex min-h-[148px] flex-col justify-between overflow-hidden rounded-[24px] border border-[#d9e1fa]/80 bg-gradient-to-r from-[#eef2fe] via-[#edf1fe] to-[#edf0fb] p-4 sm:p-5 shadow-[0_4px_20px_rgba(79,70,229,0.06)] transition-all hover:shadow-[0_8px_28px_rgba(79,70,229,0.12)] md:w-auto md:h-full",
                isSingle ? "w-full" : "w-[calc(100vw-32px)] max-w-[420px] shrink-0 snap-start md:w-auto md:max-w-none",
                spanClass
              )}
            >
              <span aria-hidden="true" className="dashboard-offer__shine" />
              {/* Top: 3D Green Gift Box with Red Ribbon on the Left, Title & Subtitle on the Right */}
              <div className="flex items-start gap-3 sm:gap-4 flex-1">
                <div className="relative shrink-0 pt-0.5">
                  <Icon3D
                    hints={["gift-green"]}
                    size={52}
                    float={true}
                    delay={0}
                    className="drop-shadow-[0_4px_10px_rgba(34,197,94,0.15)]"
                  />
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  <h3 className="text-[15px] sm:text-base font-bold text-slate-900 leading-tight">
                    {o.title}
                  </h3>
                  <p className="mt-1 text-xs sm:text-[13px] text-slate-600 leading-snug sm:leading-relaxed">
                    {o.description}
                  </p>
                </div>
              </div>

              {/* Bottom: Lavender Sparkles under the gift box, Code Box + Orange Copy Button on the right */}
              <div className="relative mt-auto pt-3.5 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5">
                <div className="relative shrink-0 pl-1">
                  <Icon3D
                    hints={["sparkles-lavender"]}
                    size={42}
                    float={true}
                    delay={-0.8}
                    className="pointer-events-none drop-shadow-[0_2px_8px_rgba(129,140,248,0.2)]"
                  />
                </div>

                <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
                  <div
                    tabIndex={0}
                    aria-label={`Referral code: ${o.code}`}
                    className="rounded-xl border border-dashed border-[#CBD5E1] bg-white px-2.5 sm:px-4 py-1.5 text-xs sm:text-sm font-bold tracking-wider text-slate-900 shadow-sm select-all whitespace-nowrap shrink-0"
                  >
                    {o.code}
                  </div>
                  <button
                    type="button"
                    onClick={() => copy(o)}
                    aria-label={isCopied ? "Referral code copied" : "Copy referral code"}
                    className="flex min-h-[34px] shrink-0 items-center gap-1.5 rounded-full bg-[#f97316] px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-[#ea580c] active:scale-95 whitespace-nowrap focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f97316]"
                  >
                    {isCopied ? (
                      <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4 stroke-[2.5]" aria-hidden="true" />
                    ) : (
                      <Copy className="h-3.5 w-3.5 sm:h-4 sm:w-4 stroke-[2.5]" aria-hidden="true" />
                    )}
                    <span className="whitespace-nowrap">{isCopied ? "Copied" : "Copy"}</span>
                  </button>
                </div>
              </div>
            </div>
          );
        }

        const solid = o.accent === "brand";
        return (
          <div
            key={o.id}
            className={clsx(
              "dashboard-offer group relative flex min-h-[148px] flex-col justify-between overflow-hidden rounded-[24px] p-4 sm:p-5 shadow-[0_4px_20px_rgba(30,27,46,0.06)] transition-all hover:shadow-[0_8px_28px_rgba(30,27,46,0.12)] md:w-auto md:h-full",
              isSingle ? "w-full" : "w-[calc(100vw-32px)] max-w-[420px] shrink-0 snap-start md:w-auto md:max-w-none",
              solid
                ? "border border-[#d9e1fa]/80 bg-gradient-to-r from-[#eef2fe] via-[#edf1fe] to-[#edf0fb] text-slate-900"
                : "border border-accent/20 bg-accent-soft text-ink",
              spanClass
            )}
          >
            <span aria-hidden="true" className="dashboard-offer__shine" />
            <Icon3D
              hints={[index % 2 === 0 ? "🎁" : "✨"]}
              size={56}
              delay={index * -1.4}
              className="absolute -bottom-2 right-2 md:bottom-auto md:top-3.5 md:right-3.5 pointer-events-none opacity-85 md:opacity-95"
            />
            <div className="relative z-[1] flex-1 md:pr-14">
              <div className="text-[15px] sm:text-base font-bold text-slate-900 leading-tight">{o.title}</div>
              <p className="mt-1 text-xs sm:text-[13px] text-slate-600 leading-snug sm:leading-relaxed">{o.description}</p>
            </div>
            <div className="relative z-[1] mt-auto pt-3.5 flex items-center gap-2">
              <span className="rounded-xl border border-dashed border-[#CBD5E1] bg-white px-2.5 sm:px-4 py-1.5 text-xs sm:text-sm font-bold tracking-wider text-slate-900 shadow-sm select-all whitespace-nowrap shrink-0">
                {o.code}
              </span>
              <button
                type="button"
                onClick={() => copy(o)}
                aria-label={isCopied ? "Offer code copied" : "Copy offer code"}
                className="flex min-h-[34px] items-center gap-1.5 rounded-full bg-[#f97316] px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-[#ea580c] active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f97316] whitespace-nowrap shrink-0"
              >
                {isCopied ? (
                  <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4 stroke-[2.5]" aria-hidden="true" />
                ) : (
                  <Copy className="h-3.5 w-3.5 sm:h-4 sm:w-4 stroke-[2.5]" aria-hidden="true" />
                )}
                <span className="whitespace-nowrap">{isCopied ? "Copied" : "Copy"}</span>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

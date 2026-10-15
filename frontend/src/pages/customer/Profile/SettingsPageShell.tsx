import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, type LucideIcon } from "lucide-react";
import clsx from "clsx";
import { customerPath } from "@/routes/customerPath";
import { FOCUS_RING } from "@/components/customer/focusRing";

export const TONES = {
  indigo: "from-[#8E86F5] to-[#4338CA] [--sh:rgba(67,56,202,.65)]",
  orange: "from-[#FFB35C] to-[#F26A0C] [--sh:rgba(242,106,12,.7)]",
  sky: "from-[#6FB6FF] to-[#1D5FD1] [--sh:rgba(29,95,209,.65)]",
  emerald: "from-[#4FD1A5] to-[#12805F] [--sh:rgba(18,128,95,.65)]",
} as const;
const DISC = "shadow-[0_10px_18px_-6px_var(--sh),inset_0_1px_0_rgba(255,255,255,.5),inset_0_-2px_0_rgba(0,0,0,.14)]";

interface Props {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  tone: keyof typeof TONES;
  children: ReactNode;
  /** Skip the lg+ card around the content (used by the Terms / Privacy pages). */
  bare?: boolean;
}

/**
 * Full-page frame for Edit profile, Change password and Notification settings.
 *  - lg+: the form sits in a card, like the cards on the Profile page.
 *  - below lg: just the heading and the form on the page background, no cards.
 *  - md+: the normal customer shell (sidebar + top bar) with a back link and page title.
 *  - phone: no top bar or bottom nav (CustomerLayout hides them); a sticky header with a back arrow instead.
 */
export default function SettingsPageShell({ title, subtitle, icon: Icon, tone, children, bare }: Props) {
  const back = customerPath("/profile");
  return (
    <div className="mx-auto w-full max-w-5xl">
      {/* phone header */}
      <div className="sticky top-0 z-30 -mx-4 -mt-6 mb-5 flex items-center gap-3 border-b border-line/60 bg-canvas/90 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur md:hidden">
        <Link to={back} aria-label="Back to profile" className={clsx("flex h-10 w-10 items-center justify-center rounded-full border border-line bg-panel text-ink transition-transform active:scale-95", FOCUS_RING)}>
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </Link>
        <h1 className="text-lg font-bold text-ink">{title}</h1>
      </div>

      {/* desktop / tablet header */}
      <header className="mb-8 hidden md:block">
        <Link to={back} className={clsx("group mb-4 inline-flex items-center gap-2 rounded-full border border-line bg-panel py-1.5 pl-2.5 pr-4 text-sm font-semibold text-ink transition-colors hover:border-brand/40 hover:text-brand", FOCUS_RING)}>
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" aria-hidden="true" />
          Back to profile
        </Link>
        <div className="flex items-center gap-4">
          <span aria-hidden="true" className={clsx("flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-white", DISC, TONES[tone])}>
            <Icon className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-[28px] font-bold leading-tight tracking-tight text-ink">{title}</h1>
            <p className="mt-0.5 text-sm text-muted">{subtitle}</p>
          </div>
        </div>
      </header>

      <p className="mb-5 text-sm text-muted md:hidden">{subtitle}</p>

      <div className="animate-fadeUp">
        {bare ? children : <div className="lg:rounded-[24px] lg:border lg:border-line/70 lg:bg-panel lg:p-6 lg:shadow-[0_16px_40px_-22px_rgba(30,27,46,.18)]">{children}</div>}
      </div>
    </div>
  );
}

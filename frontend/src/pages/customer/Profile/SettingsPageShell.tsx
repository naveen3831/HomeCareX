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
} as const;
const DISC = "shadow-[0_10px_18px_-6px_var(--sh),inset_0_1px_0_rgba(255,255,255,.5),inset_0_-2px_0_rgba(0,0,0,.14)]";

interface Props {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  tone: keyof typeof TONES;
  /** Context panel: sits left of the form on desktop, below it on tablet, hidden on phones. */
  aside: ReactNode;
  children: ReactNode;
}

/** Soft lavender card used for the context panels, matching the Profile hero. */
export function AsideCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={clsx("relative overflow-hidden rounded-[28px] border border-[#D9DCF7] bg-[#E9EBFF] p-6 text-ink", className)}>
      <div aria-hidden="true" className="pointer-events-none absolute -right-14 -top-16 h-44 w-44 rounded-full bg-white/60 blur-2xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-20 -left-10 h-40 w-40 rounded-full bg-brand/10 blur-2xl" />
      <div className="relative">{children}</div>
    </div>
  );
}

/**
 * Full-page frame for Edit profile, Change password and Notification settings.
 *  - md+: the normal customer shell (sidebar + top bar) with a back link, page title, a context panel and the form card.
 *  - phone: no top bar or bottom nav (CustomerLayout hides them); a sticky header with a back arrow instead.
 */
export default function SettingsPageShell({ title, subtitle, icon: Icon, tone, aside, children }: Props) {
  const back = customerPath("/profile");
  return (
    <div className="mx-auto w-full max-w-6xl">
      {/* phone header */}
      <div className="sticky top-0 z-30 -mx-4 -mt-6 mb-5 flex items-center gap-3 border-b border-line/60 bg-canvas/90 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur md:hidden">
        <Link to={back} aria-label="Back to profile" className={clsx("flex h-10 w-10 items-center justify-center rounded-full border border-line bg-panel text-ink transition-transform active:scale-95", FOCUS_RING)}>
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </Link>
        <h1 className="text-lg font-bold text-ink">{title}</h1>
      </div>

      {/* desktop / tablet header */}
      <header className="mb-6 hidden md:block">
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

      <p className="mb-4 text-sm text-muted md:hidden">{subtitle}</p>

      <div className="grid items-start gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
        <section className="animate-fadeUp overflow-hidden rounded-[28px] border border-line/70 bg-panel shadow-[0_16px_40px_-20px_rgba(30,27,46,.2)] lg:order-2">
          <div aria-hidden="true" className={clsx("h-1.5 bg-gradient-to-r", tone === "orange" ? "from-[#FFB35C] to-[#F26A0C]" : tone === "sky" ? "from-[#6FB6FF] to-[#1D5FD1]" : "from-[#8E86F5] to-[#4338CA]")} />
          <div className="p-5 md:p-8">{children}</div>
        </section>
        <aside className="hidden md:block lg:sticky lg:top-24 lg:order-1">{aside}</aside>
      </div>
    </div>
  );
}

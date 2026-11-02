import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import clsx from "clsx";

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
  /** Hide the round icon beside the subtitle on md+ (Edit profile). */
  hideIcon?: boolean;
}

/**
 * Full-page frame for Edit profile, Change password and Notification settings.
 *  - lg+: the form sits in a card, like the cards on the Profile page.
 *  - below lg: just the heading and the form on the page background, no cards.
 *  - md+: the normal customer shell (sidebar + top bar); the top bar carries the back arrow and page title.
 *  - phone: no bottom nav; the customer top bar (CustomerLayout) provides the back arrow + page title.
 */
export default function SettingsPageShell({ title, subtitle, icon: Icon, tone, children, bare, hideIcon }: Props) {
  return (
    <div className="mx-auto w-full max-w-5xl">
      {/* md+: icon + subtitle; the page name and back arrow live in the top bar. */}
      <header className={clsx("hidden items-center gap-4 md:flex", hideIcon ? "mb-5" : "mb-8")}>
        {!hideIcon && (
          <span aria-hidden="true" className={clsx("flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-white", DISC, TONES[tone])}>
            <Icon className="h-6 w-6" />
          </span>
        )}
        <p className="text-sm text-muted">{subtitle}</p>
      </header>
      <h1 className="sr-only">{title}</h1>

      <p className="mb-5 text-sm text-muted md:hidden">{subtitle}</p>

      <div className="animate-fadeUp">
        {bare ? children : <div className="lg:rounded-[24px] lg:border lg:border-line/70 lg:bg-panel lg:p-6 lg:shadow-[0_16px_40px_-22px_rgba(30,27,46,.18)]">{children}</div>}
      </div>
    </div>
  );
}
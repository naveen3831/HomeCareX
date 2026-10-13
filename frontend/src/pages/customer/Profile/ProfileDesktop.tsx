import { Link } from "react-router-dom";
import { ArrowUpRight, Bell, Camera, CreditCard, Gift, Headset, Lock, Mail, MapPin, Pencil, Phone, User, Wallet, type LucideIcon } from "lucide-react";
import clsx from "clsx";
import { customerPath } from "@/routes/customerPath";
import { FOCUS_RING } from "@/components/customer/focusRing";
import { initialsOf, type ProfileStat } from "./ProfileHero";

interface Props {
  name: string;
  email?: string;
  phone?: string;
  avatarUrl?: string;
  /** Default address as one line, if the customer has one. */
  addressText?: string;
  stats: ProfileStat[];
}

const DISC = "shadow-[0_8px_14px_-6px_var(--sh),inset_0_1px_0_rgba(255,255,255,.5),inset_0_-2px_0_rgba(0,0,0,.14)]";

/** One grid for everything the customer can open from here: first row = account, second row = money and help. */
const ITEMS: { label: string; hint: string; to: string; icon: LucideIcon; tone: string }[] = [
  { label: "Edit profile", hint: "Photo, name, email and phone", to: "/profile/edit", icon: User, tone: "from-[#8E86F5] to-[#4338CA] [--sh:rgba(67,56,202,.65)]" },
  { label: "Change password", hint: "Keep your account secure", to: "/profile/password", icon: Lock, tone: "from-[#FFB35C] to-[#F26A0C] [--sh:rgba(242,106,12,.7)]" },
  { label: "Notifications", hint: "Choose alerts and your language", to: "/profile/notifications", icon: Bell, tone: "from-[#FF9AAE] to-[#E0365B] [--sh:rgba(224,54,91,.6)]" },
  { label: "Addresses", hint: "Where we should come", to: "/addresses", icon: MapPin, tone: "from-[#6FB6FF] to-[#1D5FD1] [--sh:rgba(29,95,209,.65)]" },
  { label: "Payments", hint: "Payment methods and receipts", to: "/payments", icon: CreditCard, tone: "from-[#FFD36B] to-[#D98A00] [--sh:rgba(217,138,0,.6)]" },
  { label: "Wallet", hint: "Balance and cashback", to: "/wallet", icon: Wallet, tone: "from-[#4FD1A5] to-[#12805F] [--sh:rgba(18,128,95,.65)]" },
  { label: "Refer & earn", hint: "Invite friends, earn rewards", to: "/referrals", icon: Gift, tone: "from-[#F58BB7] to-[#D13A7C] [--sh:rgba(209,58,124,.65)]" },
  { label: "Support", hint: "Help center and your tickets", to: "/support", icon: Headset, tone: "from-[#5FD3E6] to-[#0E8CA6] [--sh:rgba(14,140,166,.6)]" },
];

function Chip({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-line bg-canvas px-3 py-1 text-xs font-semibold text-ink">
      <Icon className="h-3.5 w-3.5 shrink-0 text-brand" aria-hidden="true" />
      <span className="truncate">{children}</span>
    </span>
  );
}

/** Live stats. "glass" sits on the cover banner (xl and up); the light version drops below the name on narrower screens. */
function Stats({ stats, glass }: { stats: ProfileStat[]; glass?: boolean }) {
  return (
    <ul className={clsx(glass ? "absolute right-6 top-1/2 hidden -translate-y-1/2 gap-3 xl:flex lg:right-8" : "mt-5 grid grid-cols-3 gap-3 xl:hidden")}>
      {stats.map((s) => (
        <li key={s.label}>
          <Link
            to={s.to}
            className={clsx(
              "block text-center transition-all hover:-translate-y-0.5 motion-reduce:hover:translate-y-0",
              glass ? "min-w-[104px] rounded-2xl border border-white/30 bg-white/15 px-5 py-2.5 text-white backdrop-blur-sm hover:bg-white/25" : "rounded-2xl border border-line bg-canvas px-3 py-3 text-ink hover:border-brand",
              glass ? "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white" : FOCUS_RING,
            )}
          >
            {s.value === undefined ? (
              <span className={clsx("mx-auto block h-6 w-6 animate-pulse rounded", glass ? "bg-white/40" : "bg-line")} role="status" aria-label="Loading" />
            ) : (
              <span className="block text-2xl font-bold leading-tight">{s.value ?? "–"}</span>
            )}
            <span className={clsx("text-xs", glass ? "text-white/85" : "text-muted")}>{s.label}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/**
 * Desktop / tablet profile. No page heading (the sidebar already says where you are), so the hero starts right under the top bar:
 *  - hero: gradient cover with the live stats, overlapping photo, name, contact chips and the Edit profile button;
 *  - one grid of tiles for account settings, money and help.
 */
export default function ProfileDesktop({ name, email, phone, avatarUrl, addressText, stats }: Props) {
  const editTo = customerPath("/profile/edit");
  return (
    <div className="hidden space-y-6 md:block">
      <h1 className="sr-only">Profile</h1>

      <section aria-labelledby="profile-desktop-name" className="overflow-hidden rounded-[28px] border border-line/70 bg-panel shadow-[0_16px_40px_-22px_rgba(30,27,46,.25)]">
        <div className="relative h-28 overflow-hidden bg-gradient-to-r from-[#4338CA] via-[#6A5DE8] to-[#A99CF8] lg:h-32">
          <div aria-hidden="true" className="absolute -left-10 -top-16 h-52 w-52 rounded-full bg-white/10" />
          <div aria-hidden="true" className="absolute left-1/3 top-10 h-40 w-40 rounded-full bg-white/10" />
          <div aria-hidden="true" className="absolute -bottom-20 right-1/4 h-48 w-48 rounded-full bg-black/10" />
          <Stats stats={stats} glass />
        </div>

        <div className="px-6 pb-6 lg:px-8">
          <div className="flex flex-wrap items-start gap-x-6 gap-y-4">
            <div className="relative -mt-12 shrink-0 lg:-mt-14">
              <div
                aria-hidden="true"
                className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-brand text-3xl font-semibold text-white shadow-[0_14px_30px_-12px_rgba(67,56,202,.6)] lg:h-28 lg:w-28"
              >
                {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : initialsOf(name)}
              </div>
              <Link
                to={editTo}
                aria-label="Change profile photo"
                className={clsx("absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border border-line bg-white text-brand shadow-md transition-transform hover:scale-110", FOCUS_RING)}
              >
                <Camera className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>

            <div className="min-w-0 flex-1 basis-[260px] pt-3">
              <h2 id="profile-desktop-name" className="truncate text-2xl font-bold text-ink">
                {name}
              </h2>
              <div className="mt-2 flex flex-wrap gap-2">
                <Chip icon={Mail}>{email ?? "No email added"}</Chip>
                {phone && <Chip icon={Phone}>{phone}</Chip>}
                {addressText && <Chip icon={MapPin}>{addressText}</Chip>}
              </div>
            </div>

            <Link
              to={editTo}
              className={clsx("mt-3 flex shrink-0 items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_18px_-8px_rgba(67,56,202,.7)] transition-all hover:brightness-110", FOCUS_RING)}
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
              Edit profile
            </Link>
          </div>

          <Stats stats={stats} />
        </div>
      </section>

      <section aria-label="Account, payments and help">
        <ul className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {ITEMS.map(({ label, hint, to, icon: Icon, tone }) => (
            <li key={label}>
              <Link
                to={customerPath(to)}
                className={clsx("group relative flex h-full flex-col gap-4 rounded-[24px] border border-line bg-panel p-5 transition-all hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-[0_16px_32px_-18px_rgba(67,56,202,.35)] motion-reduce:hover:translate-y-0", FOCUS_RING)}
              >
                <span aria-hidden="true" className={clsx("flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br text-white", DISC, tone)}>
                  <Icon className="h-[22px] w-[22px]" />
                </span>
                <ArrowUpRight className="absolute right-5 top-5 h-5 w-5 text-muted/60 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-brand" aria-hidden="true" />
                <span className="block">
                  <span className="block text-[15px] font-bold text-ink">{label}</span>
                  <span className="mt-0.5 block text-[13px] leading-snug text-muted">{hint}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

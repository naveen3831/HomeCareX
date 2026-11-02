import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  Bell,
  CalendarCheck,
  Camera,
  CreditCard,
  Gift,
  Headset,
  Lock,
  FileText,
  Mail,
  MapPin,
  Navigation,
  Pencil,
  Phone,
  ShieldCheck,
  User,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import clsx from "clsx";
import { customerPath } from "@/routes/customerPath";
import { FOCUS_RING } from "@/components/customer/focusRing";
import DeleteAccount from "@/components/customer/DeleteAccount";
import { initialsOf } from "./ProfileHero";

interface Props {
  name: string;
  email?: string;
  phone?: string;
  avatarUrl?: string;
  /** Default address as one line, if the customer has one. */
  addressText?: string;
}

const DISC =
  "shadow-[0_8px_14px_-6px_var(--sh),inset_0_1px_0_rgba(255,255,255,.5),inset_0_-2px_0_rgba(0,0,0,.14)]";

/** Everything the customer can open from here, all in the same card style, two per row: Bookings and Active booking first, then account, money and help. */
const ITEMS: {
  label: string;
  hint: string;
  to: string;
  icon: LucideIcon;
  tone: string;
}[] = [
  {
    label: "Bookings",
    hint: "Upcoming, completed and cancelled",
    to: "/bookings",
    icon: CalendarCheck,
    tone: "from-[#8E86F5] to-[#4338CA] [--sh:rgba(67,56,202,.65)]",
  },
  {
    label: "Active booking",
    hint: "Track your partner live",
    to: "/tracking",
    icon: Navigation,
    tone: "from-[#FFB35C] to-[#F26A0C] [--sh:rgba(242,106,12,.7)]",
  },
  {
    label: "Edit profile",
    hint: "Photo, name, email and phone",
    to: "/profile/edit",
    icon: User,
    tone: "from-[#8E86F5] to-[#4338CA] [--sh:rgba(67,56,202,.65)]",
  },
  {
    label: "Account Security",
    hint: "Password, sessions and devices",
    to: "/security",
    icon: ShieldCheck,
    tone: "from-[#8E86F5] to-[#4338CA] [--sh:rgba(67,56,202,.65)]",
  },
  {
    label: "Change password",
    hint: "Keep your account secure",
    to: "/profile/password",
    icon: Lock,
    tone: "from-[#FFB35C] to-[#F26A0C] [--sh:rgba(242,106,12,.7)]",
  },
  {
    label: "Notifications",
    hint: "Choose alerts and your language",
    to: "/profile/notifications",
    icon: Bell,
    tone: "from-[#FF9AAE] to-[#E0365B] [--sh:rgba(224,54,91,.6)]",
  },
  {
    label: "Addresses",
    hint: "Where we should come",
    to: "/addresses",
    icon: MapPin,
    tone: "from-[#6FB6FF] to-[#1D5FD1] [--sh:rgba(29,95,209,.65)]",
  },
  {
    label: "Payments",
    hint: "Payment methods and receipts",
    to: "/payments",
    icon: CreditCard,
    tone: "from-[#FFD36B] to-[#D98A00] [--sh:rgba(217,138,0,.6)]",
  },
  {
    label: "Wallet",
    hint: "Balance and cashback",
    to: "/wallet",
    icon: Wallet,
    tone: "from-[#4FD1A5] to-[#12805F] [--sh:rgba(18,128,95,.65)]",
  },
  {
    label: "Refer & earn",
    hint: "Invite friends, earn rewards",
    to: "/referrals",
    icon: Gift,
    tone: "from-[#F58BB7] to-[#D13A7C] [--sh:rgba(209,58,124,.65)]",
  },
  {
    label: "Support",
    hint: "Help center and your tickets",
    to: "/support",
    icon: Headset,
    tone: "from-[#5FD3E6] to-[#0E8CA6] [--sh:rgba(14,140,166,.6)]",
  },
  {
    label: "Terms & Conditions",
    hint: "Read the rules for using HomeCareX",
    to: "/profile/terms",
    icon: FileText,
    tone: "from-[#8E86F5] to-[#4338CA] [--sh:rgba(67,56,202,.65)]",
  },
  {
    label: "Privacy Policy",
    hint: "How we handle your data",
    to: "/profile/privacy",
    icon: ShieldCheck,
    tone: "from-[#4FD1A5] to-[#12805F] [--sh:rgba(18,128,95,.65)]",
  },
];

function Chip({
  icon: Icon,
  children,
}: {
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-[#D9DCF7] bg-white px-3 py-1 text-xs font-semibold text-ink">
      <Icon className="h-3.5 w-3.5 shrink-0 text-brand" aria-hidden="true" />
      <span className="truncate">{children}</span>
    </span>
  );
}

/**
 * Desktop / tablet profile. No page heading (the sidebar already says where you are), so the hero starts right under the top bar:
 *  - hero: one light lavender card with photo, name, contact chips, and the Edit profile + Delete account buttons;
 *  - Bookings, Active booking, account settings, money and help as one set of matching cards, two per row.
 */
export default function ProfileDesktop({
  name,
  email,
  phone,
  avatarUrl,
  addressText,
}: Props) {
  const editTo = customerPath("/profile/edit");
  return (
    <div className="hidden space-y-6 md:block">
      <h1 className="sr-only">Profile</h1>

      <section
        aria-labelledby="profile-desktop-name"
        className="relative overflow-hidden rounded-[28px] border border-[#D9DCF7] bg-[#E9EBFF] p-6 lg:p-8"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-14 -top-16 h-44 w-44 rounded-full bg-white/60 blur-2xl"
        />
        <div className="relative flex flex-wrap items-center gap-x-6 gap-y-4">
          <div className="relative shrink-0">
            <div
              aria-hidden="true"
              className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-brand text-3xl font-semibold text-white shadow-[0_14px_30px_-12px_rgba(67,56,202,.6)] lg:h-28 lg:w-28"
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                initialsOf(name)
              )}
            </div>
            <Link
              to={editTo}
              aria-label="Change profile photo"
              className={clsx(
                "absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border border-line bg-white text-brand shadow-md transition-transform hover:scale-110",
                FOCUS_RING,
              )}
            >
              <Camera className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>

          <div className="min-w-0 flex-1 basis-[260px]">
            <h2
              id="profile-desktop-name"
              className="truncate text-2xl font-bold text-ink"
            >
              {name}
            </h2>
            <div className="mt-2 flex flex-wrap gap-2">
              <Chip icon={Mail}>{email ?? "No email added"}</Chip>
              {phone && <Chip icon={Phone}>{phone}</Chip>}
              {addressText && <Chip icon={MapPin}>{addressText}</Chip>}
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-3">
            <Link
              to={editTo}
              className={clsx(
                "flex shrink-0 items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_18px_-8px_rgba(67,56,202,.7)] transition-all hover:brightness-110",
                FOCUS_RING,
              )}
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
              Edit profile
            </Link>
            <DeleteAccount variant="inline" />
          </div>
        </div>
      </section>

      <section aria-label="Bookings, account, payments and help">
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {ITEMS.map(({ label, hint, to, icon: Icon, tone }) => (
            <li key={label}>
              <Link
                to={customerPath(to)}
                state={{ from: customerPath("/profile") }}
                className={clsx(
                  "group flex h-full items-center gap-4 rounded-[22px] border border-line bg-panel p-4 transition-all hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-[0_16px_32px_-18px_rgba(67,56,202,.35)] motion-reduce:hover:translate-y-0",
                  FOCUS_RING,
                )}
              >
                <span
                  aria-hidden="true"
                  className={clsx(
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-white",
                    DISC,
                    tone,
                  )}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-bold text-ink">
                    {label}
                  </span>
                  <span className="mt-0.5 block text-[13px] leading-snug text-muted">
                    {hint}
                  </span>
                </span>
                <ArrowUpRight
                  className="h-5 w-5 shrink-0 text-muted/60 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-brand"
                  aria-hidden="true"
                />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

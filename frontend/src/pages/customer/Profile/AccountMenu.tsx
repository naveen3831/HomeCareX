import { Link } from "react-router-dom";
import { Bell, ChevronRight, FileText, Lock, ShieldCheck } from "lucide-react";
import clsx from "clsx";
import { FOCUS_RING } from "@/components/customer/focusRing";
import { PROFILE_ITEM_META, PROFILE_MENU_GROUPS, type CustomerNavGroup, type CustomerNavItem, type ProfileTint } from "@/components/customer/customerNav";
import { customerPath } from "@/routes/customerPath";

const TINTS: Record<ProfileTint, string> = {
  indigo: "bg-indigo-50 text-indigo-600",
  orange: "bg-orange-50 text-orange-600",
  emerald: "bg-emerald-50 text-emerald-600",
  amber: "bg-amber-50 text-amber-600",
  sky: "bg-sky-50 text-sky-600",
  rose: "bg-rose-50 text-rose-600",
  violet: "bg-violet-50 text-violet-600",
};
const DEFAULT_META = { description: "", tint: "indigo" as ProfileTint };

/** Settings rows that live in the Account group on phones (they open full pages; desktop shows them as tiles instead). */
const ACCOUNT_SETTINGS: CustomerNavItem[] = [
  { label: "Change password", to: customerPath("/profile/password"), icon: Lock },
  { label: "Notification settings", to: customerPath("/profile/notifications"), icon: Bell },
];
const SETTINGS_META: Record<string, { description: string; tint: ProfileTint }> = {
  "Change password": { description: "Keep your account secure", tint: "orange" },
  "Notification settings": { description: "Alerts and language", tint: "sky" },
  "Terms & Conditions": { description: "Rules for using HomeCareX", tint: "indigo" },
  "Privacy Policy": { description: "How we handle your data", tint: "emerald" },
};

const LEGAL_GROUP: CustomerNavGroup = {
  heading: "Legal",
  items: [
    { label: "Terms & Conditions", to: customerPath("/profile/terms"), icon: FileText },
    { label: "Privacy Policy", to: customerPath("/profile/privacy"), icon: ShieldCheck },
  ],
};

const GROUPS = [...PROFILE_MENU_GROUPS.map((g) => (g.heading.toLowerCase() === "account" ? { ...g, items: [...g.items, ...ACCOUNT_SETTINGS] } : g)), LEGAL_GROUP];

/** Small value shown on the right of a row instead of nothing, keyed by nav label. */
export type RowBadges = Partial<Record<string, { text: string; live?: boolean }>>;

/**
 * The mobile replacement for the hamburger drawer: every sidebar link except Dashboard / Categories /
 * Services (bottom nav) and Profile itself, as grouped iOS-style cards. Driven by PROFILE_MENU_GROUPS.
 */
export default function AccountMenu({ badges = {} }: { badges?: RowBadges }) {
  return (
    <nav aria-label="Account menu" className="space-y-5 md:hidden">
      {GROUPS.map((group, gi) => {
        const headingId = `profile-group-${group.heading.toLowerCase()}`;
        return (
          <section key={group.heading} aria-labelledby={headingId} className="profile-rise" style={{ ["--d" as string]: `${120 + gi * 80}ms` }}>
            <h2 id={headingId} className="mb-2 px-1 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
              {group.heading}
            </h2>
            <ul className="divide-y divide-line/70 overflow-hidden rounded-[22px] border border-line/70 bg-panel shadow-[0_10px_28px_-12px_rgba(30,27,46,.14)]">
              {group.items.map(({ label, to, icon: Icon }) => {
                const meta = PROFILE_ITEM_META[label] ?? SETTINGS_META[label] ?? DEFAULT_META;
                const badge = badges[label];
                return (
                  <li key={to}>
                    <Link
                      to={to}
                      className={clsx(
                        "group flex min-h-[64px] items-center gap-3.5 px-4 py-3 transition-colors active:bg-canvas",
                        FOCUS_RING,
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={clsx(
                          "flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] transition-transform duration-200 motion-safe:group-active:scale-90",
                          TINTS[meta.tint],
                        )}
                      >
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-semibold leading-tight text-ink">{label}</span>
                        {meta.description && <span className="mt-0.5 block truncate text-xs text-muted">{meta.description}</span>}
                      </span>
                      {badge && (
                        <span
                          className={clsx(
                            "flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                            badge.live ? "bg-emerald-50 text-emerald-700" : "bg-canvas text-muted",
                          )}
                        >
                          {badge.live && <span aria-hidden="true" className="dashboard-live-dot" />}
                          {badge.text}
                        </span>
                      )}
                      <ChevronRight
                        aria-hidden="true"
                        className="h-4 w-4 shrink-0 text-muted/70 transition-transform duration-200 motion-safe:group-hover:translate-x-0.5"
                      />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </nav>
  );
}

import { Link, useLocation } from "react-router-dom";
import "./EarningsTabs.css";

type Tab = { label: string; to: string; isActive: (path: string) => boolean };

const TABS: Tab[] = [
  {
    label: "Earnings",
    to: "/partner/earnings",
    isActive: (p) => p === "/partner/earnings" || p === "/partner/earnings/",
  },
  {
    label: "Wallet",
    to: "/partner/wallet",
    isActive: (p) => p.startsWith("/partner/wallet"),
  },
  {
    label: "Payouts",
    to: "/partner/payouts",
    isActive: (p) => p.startsWith("/partner/payouts") || p.startsWith("/partner/earnings/payouts"),
  },
];

/**
 * Switcher for the three money pages, shown on phones and desktop. Each tab is a normal route link, so the
 * existing pages, URLs and back button keep working. On desktop it sits above the page
 * content next to the sidebar menu.
 */
export default function EarningsTabs() {
  const { pathname } = useLocation();
  return (
    <nav className="etabs" aria-label="Earnings sections">
      {TABS.map((t) => (
        <Link key={t.to} to={t.to} aria-current={t.isActive(pathname) ? "page" : undefined}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

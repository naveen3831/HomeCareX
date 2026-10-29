import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAddresses, useCustomerDashboard, useProfile } from "@/features/customer";
import { customerPath } from "@/routes/customerPath";
import AccountMenu, { type RowBadges } from "./AccountMenu";
import DeleteAccount from "@/components/customer/DeleteAccount";
import LogoutCard from "./LogoutCard";
import ProfileDesktop from "./ProfileDesktop";
import ProfileHero from "./ProfileHero";
import { FormMessage } from "./formKit";

/** Old links like /profile#password still work: they forward to the matching page. */
const LEGACY_HASH: Record<string, string> = {
  "personal-info": customerPath("/profile/edit"),
  password: customerPath("/profile/password"),
  notifications: customerPath("/profile/notifications"),
};

/**
 * Profile (/customer/profile).
 *  - header: avatar, name and contact details in one light card (mobile also gets the account menu that replaced the hamburger).
 *  - settings: Edit profile, Change password and Notification settings are full pages (/profile/edit, /profile/password,
 *    /profile/notifications). After saving, they send the customer back here with a short confirmation banner.
 *  - Log out sits last on mobile; on desktop the sidebar carries it.
 */
export default function Profile() {
  const { user } = useAuth();
  const dashboard = useCustomerDashboard();
  const addresses = useAddresses();
  const profile = useProfile();
  const location = useLocation();
  const navigate = useNavigate();
  const [flash, setFlash] = useState<string | null>(null);

  // Forward legacy #hash links to their page.
  useEffect(() => {
    const to = LEGACY_HASH[location.hash.slice(1)];
    if (to) navigate(to, { replace: true });
  }, [location.hash, navigate]);

  // A settings page redirects here with { flash }: show it once, then clear the router state so a refresh doesn't repeat it.
  useEffect(() => {
    const message = (location.state as { flash?: string } | null)?.flash;
    if (message) {
      setFlash(message);
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.state, location.pathname, navigate]);
  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 5000);
    return () => clearTimeout(t);
  }, [flash]);

  const name = profile.data?.name ?? user?.name ?? "Guest";
  const email = profile.data?.email ?? user?.email;
  const phone = profile.data ? profile.data.phone : user?.phone;
  const avatarUrl = profile.data?.avatarUrl;
  const defaultAddress = addresses.data?.find((a) => a.isDefault) ?? addresses.data?.[0];

  // Small badges on the mobile menu rows.
  const active = dashboard.data?.activeBookings.length;
  const places = addresses.isError ? null : addresses.data?.length;

  const badges: RowBadges = {};
  if (active) badges["Active Booking"] = { text: `${active} live`, live: true };
  if (places) badges.Addresses = { text: `${places} saved` };

  return (
    <div className="profile-page -mt-4 space-y-5 md:space-y-6">
      {flash && (
        <div className="flex items-start gap-2 animate-fadeUp">
          <div className="flex-1">
            <FormMessage kind="success">{flash}</FormMessage>
          </div>
          <button type="button" onClick={() => setFlash(null)} aria-label="Dismiss" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted hover:bg-panel hover:text-ink">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* ---------- mobile ---------- */}
      <ProfileHero name={name} email={email} phone={phone} avatarUrl={avatarUrl} />
      <AccountMenu badges={badges} />

      {/* ---------- desktop ---------- */}
      <ProfileDesktop
        name={name}
        email={email}
        phone={phone}
        avatarUrl={avatarUrl}
        addressText={defaultAddress ? [defaultAddress.line1, defaultAddress.city].filter(Boolean).join(", ") : undefined}
      />

      <DeleteAccount variant="card" />
      <LogoutCard />
    </div>
  );
}
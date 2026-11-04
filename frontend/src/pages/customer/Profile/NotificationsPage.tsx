import { Link, useNavigate } from "react-router-dom";
import { Bell, Inbox } from "lucide-react";
import { usePreferences } from "@/features/customer";
import { customerPath } from "@/routes/customerPath";
import PreferencesCard from "./PreferencesCard";
import QueryState from "./QueryState";
import SettingsPageShell from "./SettingsPageShell";

/** /customer/profile/notifications: alerts and language as a full page. Saving returns to the Profile page. */
export default function NotificationsPage() {
  const navigate = useNavigate();
  const preferences = usePreferences();

  return (
    <SettingsPageShell title="Notification settings" subtitle="Choose how we reach you, and your language." icon={Bell} tone="sky">
      <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-line bg-canvas p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-panel text-brand shadow-sm">
            <Inbox className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-ink">Notification Inbox</p>
            <p className="text-xs text-muted">View all your received booking updates, receipts and messages</p>
          </div>
        </div>
        <Link
          to={customerPath("/notifications")}
          className="inline-flex min-h-[40px] shrink-0 items-center justify-center rounded-xl bg-brand px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-brand/90"
        >
          Open Inbox &rarr;
        </Link>
      </div>

      {preferences.data ? (
        <PreferencesCard preferences={preferences.data} onSaved={() => navigate(customerPath("/profile"), { state: { flash: "Preferences saved." } })} />
      ) : (
        <QueryState q={preferences} label="preferences" />
      )}
    </SettingsPageShell>
  );
}

import { useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
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
      {preferences.data ? (
        <PreferencesCard preferences={preferences.data} onSaved={() => navigate(customerPath("/profile"), { state: { flash: "Preferences saved." } })} />
      ) : (
        <QueryState q={preferences} label="preferences" />
      )}
    </SettingsPageShell>
  );
}

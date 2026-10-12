import { useNavigate } from "react-router-dom";
import { Bell, Mail, MessageSquare, Smartphone, BellRing } from "lucide-react";
import { usePreferences } from "@/features/customer";
import { customerPath } from "@/routes/customerPath";
import PreferencesCard from "./PreferencesCard";
import QueryState from "./QueryState";
import SettingsPageShell, { AsideCard } from "./SettingsPageShell";

const CHANNELS = [
  { icon: Smartphone, name: "Push", text: "Instant alerts on your phone" },
  { icon: MessageSquare, name: "SMS", text: "Text messages to your mobile" },
  { icon: Mail, name: "Email", text: "Receipts and summaries" },
  { icon: Bell, name: "In-app", text: "The bell at the top of the app" },
];

/** /customer/profile/notifications: alerts and language as a full page. Saving returns to the Profile page. */
export default function NotificationsPage() {
  const navigate = useNavigate();
  const preferences = usePreferences();

  const aside = (
    <AsideCard>
      <span aria-hidden="true" className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-sky-600 shadow-sm">
        <BellRing className="h-7 w-7" />
      </span>
      <h2 className="mt-4 text-xl font-bold">Your alerts, your way</h2>
      <p className="mt-1 text-sm text-muted">Pick which updates reach you, and where. Switch off what you don't need.</p>
      <ul className="mt-5 space-y-3">
        {CHANNELS.map(({ icon: Icon, name, text }) => (
          <li key={name} className="flex items-center gap-3 rounded-2xl bg-white/70 p-3">
            <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-sky-600">
              <Icon className="h-[18px] w-[18px]" />
            </span>
            <span>
              <span className="block text-sm font-bold">{name}</span>
              <span className="block text-[13px] text-muted">{text}</span>
            </span>
          </li>
        ))}
      </ul>
    </AsideCard>
  );

  return (
    <SettingsPageShell title="Notification settings" subtitle="Choose how we reach you, and your language." icon={Bell} tone="sky" aside={aside}>
      {preferences.data ? (
        <PreferencesCard preferences={preferences.data} onSaved={() => navigate(customerPath("/profile"), { state: { flash: "Preferences saved." } })} />
      ) : (
        <QueryState q={preferences} label="preferences" />
      )}
    </SettingsPageShell>
  );
}

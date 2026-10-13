import { useNavigate } from "react-router-dom";
import { Lock, Lightbulb, ShieldCheck, Repeat2, Fingerprint, KeyRound } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/features/customer";
import { customerPath } from "@/routes/customerPath";
import ChangePasswordForm from "./ChangePasswordForm";
import SettingsPageShell, { AsideCard } from "./SettingsPageShell";

const TIPS = [
  { icon: Fingerprint, title: "Make it long", text: "8+ characters with a capital letter, a number and a symbol." },
  { icon: Repeat2, title: "Keep it unique", text: "Don't reuse a password from another app or site." },
  { icon: KeyRound, title: "Forgot it?", text: "Use “Forgot your password?” on the form and we'll email you a code." },
];

/** /customer/profile/password: change password as a full page. Success returns to the Profile page. */
export default function ChangePasswordPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const profile = useProfile();
  const email = profile.data?.email ?? user?.email;

  const aside = (
    <AsideCard>
      <span aria-hidden="true" className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-brand shadow-sm">
        <ShieldCheck className="h-7 w-7" />
      </span>
      <h2 className="mt-4 text-xl font-bold">Keep your account safe</h2>
      <p className="mt-1 text-sm text-muted">A strong password protects your bookings, wallet and saved addresses.</p>
      <ul className="mt-5 space-y-4">
        {TIPS.map(({ icon: Icon, title, text }) => (
          <li key={title} className="flex gap-3">
            <span aria-hidden="true" className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-orange-600">
              <Icon className="h-[18px] w-[18px]" />
            </span>
            <span>
              <span className="block text-sm font-bold">{title}</span>
              <span className="block text-[13px] leading-relaxed text-muted">{text}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-6 flex items-start gap-2 rounded-2xl bg-white/70 p-3 text-[13px] leading-relaxed text-muted">
        <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
        HomeCareX will never ask for your password by phone, chat or email.
      </p>
    </AsideCard>
  );

  return (
    <SettingsPageShell title="Change password" subtitle="Use a strong password you don't use anywhere else." icon={Lock} tone="orange" aside={aside}>
      <ChangePasswordForm email={email} onChanged={() => navigate(customerPath("/profile"), { state: { flash: "Password updated." } })} />
    </SettingsPageShell>
  );
}

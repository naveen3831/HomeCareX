import { useNavigate } from "react-router-dom";
import { Lock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/features/customer";
import { customerPath } from "@/routes/customerPath";
import ChangePasswordForm from "./ChangePasswordForm";
import SettingsPageShell from "./SettingsPageShell";

/** /customer/profile/password: change password as a full page. Success returns to the Profile page. */
export default function ChangePasswordPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const profile = useProfile();
  const email = profile.data?.email ?? user?.email;

  return (
    <SettingsPageShell title="Change password" subtitle="Use a strong password you don't use anywhere else." icon={Lock} tone="orange">
      <ChangePasswordForm email={email} onChanged={() => navigate(customerPath("/profile"), { state: { flash: "Password updated." } })} />
    </SettingsPageShell>
  );
}

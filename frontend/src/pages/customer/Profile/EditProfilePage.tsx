import { Link, useNavigate } from "react-router-dom";
import { User } from "lucide-react";
import { useProfile } from "@/features/customer";
import { customerPath } from "@/routes/customerPath";
import AvatarUpload from "./AvatarUpload";
import ProfileForm from "./ProfileForm";
import QueryState from "./QueryState";
import SettingsPageShell from "./SettingsPageShell";

/** /customer/profile/edit: photo, name, email and phone as a full page. Saving returns to the Profile page. */
export default function EditProfilePage() {
  const navigate = useNavigate();
  const profile = useProfile();
  const p = profile.data;

  return (
    <SettingsPageShell title="Edit profile" subtitle="Update your photo, name, email and phone." icon={User} tone="indigo" hideIcon>
      {p ? (
        <ProfileForm
          profile={p}
          avatar={<AvatarUpload profile={p} />}
          onSaved={() => navigate(customerPath("/profile"), { state: { flash: "Profile updated." } })}
        />
      ) : (
        <QueryState q={profile} label="profile" />
      )}
      <p className="mt-4 text-center text-sm md:hidden">
        <Link to={customerPath("/profile")} className="font-semibold text-muted hover:text-ink">
          Cancel
        </Link>
      </p>
    </SettingsPageShell>
  );
}

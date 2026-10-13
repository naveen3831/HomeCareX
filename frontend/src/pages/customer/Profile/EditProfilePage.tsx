import { Link, useNavigate } from "react-router-dom";
import { Check, Mail, Phone, User, Camera, type LucideIcon } from "lucide-react";
import clsx from "clsx";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/features/customer";
import { customerPath } from "@/routes/customerPath";
import AvatarUpload from "./AvatarUpload";
import ProfileForm from "./ProfileForm";
import QueryState from "./QueryState";
import SettingsPageShell, { AsideCard } from "./SettingsPageShell";
import { initialsOf } from "./ProfileHero";

function Row({ icon: Icon, label, done }: { icon: LucideIcon; label: string; done: boolean }) {
  return (
    <li className="flex items-center gap-3 text-sm">
      <span aria-hidden="true" className={clsx("flex h-8 w-8 items-center justify-center rounded-full", done ? "bg-emerald-100 text-emerald-700" : "bg-white text-muted")}>
        {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
      </span>
      <span className={done ? "font-semibold text-ink" : "text-muted"}>{label}</span>
      <span className="sr-only">{done ? "(done)" : "(missing)"}</span>
    </li>
  );
}

/** /customer/profile/edit: photo, name, email and phone as a full page. Saving returns to the Profile page. */
export default function EditProfilePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const profile = useProfile();
  const p = profile.data;
  const name = p?.name ?? user?.name ?? "";
  const email = p?.email ?? user?.email;
  const phone = p ? p.phone : user?.phone;

  const checks = [
    { icon: User, label: "Full name", done: Boolean(name) },
    { icon: Mail, label: "Email address", done: Boolean(email) },
    { icon: Phone, label: "Mobile number", done: Boolean(phone) },
    { icon: Camera, label: "Profile photo", done: Boolean(p?.avatarUrl) },
  ];
  const pct = Math.round((checks.filter((c) => c.done).length / checks.length) * 100);

  const aside = (
    <AsideCard>
      <div className="flex items-center gap-4">
        <div aria-hidden="true" className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-brand text-xl font-semibold text-white shadow-[0_14px_30px_-12px_rgba(67,56,202,.6)]">
          {p?.avatarUrl ? <img src={p.avatarUrl} alt="" className="h-full w-full object-cover" /> : initialsOf(name || "?")}
        </div>
        <div className="min-w-0">
          <p className="truncate text-lg font-bold">{name || "Your name"}</p>
          <p className="truncate text-sm text-muted">{email ?? "No email yet"}</p>
        </div>
      </div>

      <div className="mt-6">
        <div className="mb-1.5 flex items-center justify-between text-sm">
          <span className="font-semibold">Profile completeness</span>
          <span className="font-bold text-brand">{pct}%</span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-white" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Profile completeness">
          <div className="h-full rounded-full bg-gradient-to-r from-[#8E86F5] to-[#4338CA] transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <ul className="mt-5 space-y-2.5">
        {checks.map((c) => (
          <Row key={c.label} {...c} />
        ))}
      </ul>

      <p className="mt-6 rounded-2xl bg-white/70 p-3 text-[13px] leading-relaxed text-muted">
        Partners use your name and number to reach you on the day, and booking confirmations go to your email.
      </p>
    </AsideCard>
  );

  return (
    <SettingsPageShell title="Edit profile" subtitle="Update your photo, name, email and phone." icon={User} tone="indigo" aside={aside}>
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

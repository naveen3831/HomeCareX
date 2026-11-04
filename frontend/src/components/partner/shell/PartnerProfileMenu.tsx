import { useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import EditProfileSheet from "../EditProfileSheet";
import type { PartnerProfileInput } from "@/services/partnerApi";

/** Profile card at the top of the Settings tab: name, phone, email and an Edit button. */
export default function ProfileMenu() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<PartnerProfileInput>({
    name: user?.name ?? "Partner",
    phone: (user?.phone ?? "").replace(/\D/g, "").slice(-10),
  });
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 3000);
    return () => clearTimeout(t);
  }, [notice]);

  return (
    <>
      <section aria-label="Your profile" className="rounded-2xl bg-gradient-to-br from-[#4338ca] to-[#7c3aed] p-4 text-white shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white/20 text-2xl font-bold" aria-hidden>
            {profile.name.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-bold">{profile.name}</h2>
            <p className="truncate text-sm text-white/80">{profile.phone ? `+91 ${profile.phone}` : "Add mobile number"}</p>
            <p className="truncate text-xs text-white/70">{user?.email ?? ""}</p>
          </div>
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label="Edit profile"
            className="inline-flex h-10 items-center gap-1.5 rounded-full bg-white px-4 text-sm font-semibold text-[#4338ca] active:bg-indigo-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <Pencil size={14} aria-hidden /> Edit
          </button>
        </div>
      </section>

      {notice && (
        <p role="status" className="mt-3 rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700">
          {notice}
        </p>
      )}

      {editing && (
        <EditProfileSheet
          initial={profile}
          email={user?.email}
          onClose={() => setEditing(false)}
          onSaved={(value) => {
            setProfile(value);
            setEditing(false);
            setNotice("Profile updated.");
          }}
        />
      )}
    </>
  );
}
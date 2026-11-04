import { useState, useEffect, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Check } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { customerPath } from "@/routes/customerPath";
import { FOCUS_RING } from "@/components/customer/focusRing";
import { initialsOf } from "./ProfileHero";
import {
  useProfile,
  useUpdateProfile,
  describeError,
  type NormalizedApiError,
  type ProfilePatch,
} from "@/features/customer";
import { normalizePhone } from "@/lib/profileSchemas";
import { FormMessage, Spinner } from "./formKit";

const INPUT =
  "h-12 w-full rounded-xl border border-line bg-panel px-4 text-[15px] text-ink outline-none transition-shadow placeholder:text-muted/70 focus:border-brand focus:ring-4 focus:ring-brand/15";

/** Edit profile: name, email and phone. Persists to the database via PATCH /customer/profile and updates the auth session. */
export default function EditProfile() {
  const { user, updateProfile } = useAuth();
  const navigate = useNavigate();
  const profileQuery = useProfile();
  const updateMutation = useUpdateProfile();

  const profile = profileQuery.data;
  const [name, setName] = useState(() => profile?.name ?? user?.name ?? "");
  const [email, setEmail] = useState(() => profile?.email ?? user?.email ?? "");
  const [phone, setPhone] = useState(() => profile?.phone ?? user?.phone ?? "");
  const [isDirty, setIsDirty] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Sync with remote profile data when it loads if user hasn't edited yet
  useEffect(() => {
    if (profile && !isDirty) {
      setName(profile.name ?? user?.name ?? "");
      setEmail(profile.email ?? user?.email ?? "");
      setPhone(profile.phone ?? user?.phone ?? "");
    }
  }, [profile, isDirty, user]);

  const cleanPhone = phone.trim() ? normalizePhone(phone) : "";
  const phoneValid = phone.trim() === "" || /^[6-9]\d{9}$/.test(cleanPhone);
  const nameValid = name.trim().length >= 2;
  const emailValid = /^\S+@\S+\.\S+$/.test(email.trim());
  const valid = nameValid && emailValid && phoneValid;

  const onNameChange = (val: string) => {
    setName(val);
    setIsDirty(true);
    if (fieldErrors.name) setFieldErrors((prev) => ({ ...prev, name: "" }));
    if (formError) setFormError(null);
  };

  const onEmailChange = (val: string) => {
    setEmail(val);
    setIsDirty(true);
    if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: "" }));
    if (formError) setFormError(null);
  };

  const onPhoneChange = (val: string) => {
    setPhone(val);
    setIsDirty(true);
    if (fieldErrors.phone) setFieldErrors((prev) => ({ ...prev, phone: "" }));
    if (formError) setFormError(null);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid || !user || updateMutation.isPending) return;

    setFormError(null);
    setFieldErrors({});

    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();
    const patchPhone = phone.trim() === "" ? null : cleanPhone;

    // Detect if anything changed
    const currentName = (profile?.name ?? user?.name ?? "").trim();
    const currentEmail = (profile?.email ?? user?.email ?? "").trim().toLowerCase();
    const currentPhoneRaw = profile?.phone ?? user?.phone;
    const currentPhone = currentPhoneRaw ? normalizePhone(currentPhoneRaw) : null;

    const patch: ProfilePatch = {};
    if (trimmedName !== currentName) patch.name = trimmedName;
    if (trimmedEmail !== currentEmail) patch.email = trimmedEmail;
    if (patchPhone !== currentPhone) patch.phone = patchPhone;

    // If nothing changed, return to profile
    if (!Object.keys(patch).length) {
      navigate(customerPath("/profile"));
      return;
    }

    try {
      const updated = await updateMutation.mutateAsync(patch);
      updateProfile({
        name: updated.name,
        email: updated.email,
        phone: updated.phone,
      });
      navigate(customerPath("/profile"), { state: { flash: "Profile updated successfully." } });
    } catch (err: unknown) {
      const errInfo = describeError(err as NormalizedApiError);
      if (errInfo.fields && Object.keys(errInfo.fields).length > 0) {
        setFieldErrors(errInfo.fields);
      }
      setFormError(errInfo.form || "Failed to update profile. Please try again.");
    }
  };

  return (
    <div className="w-full min-w-0 max-w-xl space-y-6">
      <div className="flex items-center gap-4">
        <span
          className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-brand to-[#7C6CF6] text-xl font-bold text-white shadow-lg"
          aria-hidden="true"
        >
          {profile?.avatarUrl ? (
            <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            initialsOf(name || user?.name || "Customer")
          )}
        </span>
        <div>
          <h1 className="text-xl font-bold text-ink">Edit profile</h1>
          <p className="text-sm text-muted">Update your personal details.</p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-4 rounded-[24px] border border-line/70 bg-panel p-5 shadow-[0_10px_28px_-12px_rgba(30,27,46,.14)]">
        {formError && <FormMessage kind="error">{formError}</FormMessage>}

        <label className="block space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">Full name</span>
          <input
            className={`${INPUT} ${fieldErrors.name ? "border-danger focus:border-danger focus:ring-danger/20" : ""}`}
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            autoComplete="name"
            required
            disabled={updateMutation.isPending}
          />
          {fieldErrors.name && <p className="text-xs text-danger">{fieldErrors.name}</p>}
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">Email</span>
          <input
            className={`${INPUT} ${fieldErrors.email ? "border-danger focus:border-danger focus:ring-danger/20" : ""}`}
            type="email"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            autoComplete="email"
            required
            disabled={updateMutation.isPending}
          />
          {fieldErrors.email && <p className="text-xs text-danger">{fieldErrors.email}</p>}
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">Phone</span>
          <input
            className={`${INPUT} ${fieldErrors.phone || (!phoneValid && phone.trim() !== "") ? "border-danger focus:border-danger focus:ring-danger/20" : ""}`}
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => onPhoneChange(e.target.value)}
            autoComplete="tel"
            placeholder="+91 98765 43210"
            disabled={updateMutation.isPending}
          />
          {fieldErrors.phone && <p className="text-xs text-danger">{fieldErrors.phone}</p>}
          {!phoneValid && phone.trim() !== "" && !fieldErrors.phone && (
            <p className="text-xs text-danger">Enter a valid 10-digit mobile number</p>
          )}
        </label>

        <div className="flex gap-3 pt-2">
          <Link
            to={customerPath("/profile")}
            className={`flex h-12 flex-1 items-center justify-center rounded-full border border-line text-sm font-semibold text-ink hover:bg-canvas ${FOCUS_RING}`}
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={!valid || updateMutation.isPending}
            className={`flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-brand text-sm font-semibold text-white shadow-[0_8px_18px_-8px_rgba(67,56,202,.7)] transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 motion-safe:active:scale-[.97] ${FOCUS_RING}`}
          >
            {updateMutation.isPending ? (
              <>
                <Spinner /> Saving...
              </>
            ) : (
              <>
                <Check className="h-4 w-4" aria-hidden="true" /> Save changes
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

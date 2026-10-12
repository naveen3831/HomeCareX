import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Check } from "lucide-react";
import { describeError, useUpdateProfile, type ProfileDto, type ProfilePatch } from "@/features/customer";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { fieldErrors, normalizePhone, profileSchema, type ProfileFormValues } from "@/lib/profileSchemas";
import { Field, FormMessage, OFFLINE_NOTE, PRIMARY_BUTTON, SECONDARY_BUTTON, Spinner, inputClass } from "./formKit";

const toValues = (p: ProfileDto): ProfileFormValues => ({ name: p.name, email: p.email, phone: p.phone ?? "" });

/** Only the fields that changed are sent. A blank phone removes the number. */
export function buildProfilePatch(profile: ProfileDto, values: ProfileFormValues): ProfilePatch {
  const patch: ProfilePatch = {};
  if (values.name.trim() !== profile.name) patch.name = values.name.trim();
  if (values.email.trim().toLowerCase() !== profile.email) patch.email = values.email.trim();
  const phone = values.phone.trim() === "" ? "" : normalizePhone(values.phone);
  if (phone !== (profile.phone ?? "")) patch.phone = phone === "" ? null : phone;
  return patch;
}

/** Name, email and phone (with the photo slot above), saved to PATCH /customer/profile. Shown inside the "Edit profile" card. */
export default function ProfileForm({ profile, avatar, onSaved }: { profile: ProfileDto; avatar?: ReactNode; onSaved?: () => void }) {
  const update = useUpdateProfile();
  const online = useOnlineStatus();
  const [values, setValues] = useState<ProfileFormValues>(() => toValues(profile));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const previous = useRef(profile);

  // A new server version (a refetch) replaces the fields only if the customer hasn't started editing.
  useEffect(() => {
    const before = toValues(previous.current);
    previous.current = profile;
    setValues((cur) => (JSON.stringify(cur) === JSON.stringify(before) ? toValues(profile) : cur));
  }, [profile]);

  const dirty = Object.keys(buildProfilePatch(profile, values)).length > 0;
  const set = (key: keyof ProfileFormValues) => (e: { target: { value: string } }) => {
    setValues((v) => ({ ...v, [key]: e.target.value }));
    setErrors((er) => ({ ...er, [key]: "" }));
    setFormError(null);
    setSaved(false);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (update.isPending || !online) return;
    const parsed = profileSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    const patch = buildProfilePatch(profile, values);
    if (!Object.keys(patch).length) return;
    setErrors({});
    setFormError(null);
    update.mutate(patch, {
      onSuccess: (next) => {
        setValues(toValues(next));
        setSaved(true);
        onSaved?.();
      },
      onError: (err) => {
        const { fields, form } = describeError(err);
        setErrors(fields);
        setFormError(form ?? null);
      },
    });
  };

  const reset = () => {
    setValues(toValues(profile));
    setErrors({});
    setFormError(null);
    setSaved(false);
  };

  return (
    <>
      {avatar}
      <form onSubmit={onSubmit} noValidate className="space-y-4" aria-busy={update.isPending}>
        <Field id="pf-name" label="Full name" error={errors.name}>
          {(a) => <input {...a} className={inputClass(!!errors.name)} value={values.name} onChange={set("name")} autoComplete="name" maxLength={80} />}
        </Field>
        <Field id="pf-email" label="Email" error={errors.email}>
          {(a) => <input {...a} type="email" className={inputClass(!!errors.email)} value={values.email} onChange={set("email")} autoComplete="email" />}
        </Field>
        <Field id="pf-phone" label="Phone" optional error={errors.phone} hint="10-digit mobile number. Leave blank to remove it.">
          {(a) => (
            <input {...a} type="tel" inputMode="tel" className={inputClass(!!errors.phone)} value={values.phone} onChange={set("phone")} autoComplete="tel" placeholder="98765 43210" />
          )}
        </Field>

        {formError && <FormMessage kind="error">{formError}</FormMessage>}
        {saved && <FormMessage kind="success">Profile updated.</FormMessage>}
        {!online && <FormMessage kind="info">{OFFLINE_NOTE}</FormMessage>}

        <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row sm:justify-end">
          <button type="button" onClick={reset} disabled={!dirty || update.isPending} className={SECONDARY_BUTTON}>
            Reset
          </button>
          <button type="submit" disabled={!dirty || update.isPending || !online} className={PRIMARY_BUTTON}>
            {update.isPending ? (
              <>
                <Spinner /> Saving…
              </>
            ) : (
              <>
                <Check className="h-4 w-4" aria-hidden="true" /> Save changes
              </>
            )}
          </button>
        </div>
      </form>
    </>
  );
}

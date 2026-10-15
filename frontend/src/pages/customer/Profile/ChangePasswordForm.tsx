import { useState, type FormEvent } from "react";
import { Check, Eye, EyeOff, X } from "lucide-react";
import clsx from "clsx";
import { describeError, useChangePassword } from "@/features/customer";
import { FOCUS_RING } from "@/components/customer/focusRing";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { PASSWORD_RULES, changePasswordSchema, fieldErrors, type ChangePasswordValues } from "@/lib/profileSchemas";
import ForgotPasswordFlow from "./ForgotPasswordFlow";
import { Field, FormMessage, OFFLINE_NOTE, PRIMARY_BUTTON, Spinner, inputClass } from "./formKit";

const EMPTY: ChangePasswordValues = { currentPassword: "", newPassword: "", confirmPassword: "" };

export function PasswordInput({
  a11y,
  value,
  onChange,
  invalid,
  autoComplete,
}: {
  a11y: object;
  value: string;
  onChange: (v: string) => void;
  invalid: boolean;
  autoComplete: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input {...a11y} type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} className={clsx(inputClass(invalid), "pr-12")} />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Hide password" : "Show password"}
        aria-pressed={show}
        className={clsx("absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-muted hover:text-ink", FOCUS_RING)}
      >
        {show ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
      </button>
    </div>
  );
}

/** Change password: current + new + confirm, checked against the same rules as the server (POST /auth/change-password). */
export default function ChangePasswordForm({ email, onChanged }: { email?: string; onChanged?: () => void }) {
  const change = useChangePassword();
  const online = useOnlineStatus();
  const [values, setValues] = useState<ChangePasswordValues>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [forgot, setForgot] = useState(false);

  const set = (key: keyof ChangePasswordValues) => (v: string) => {
    setValues((cur) => ({ ...cur, [key]: v }));
    setErrors((er) => ({ ...er, [key]: "" }));
    setFormError(null);
    setDone(false);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (change.isPending || !online) return;
    const parsed = changePasswordSchema.safeParse(values);
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    setFormError(null);
    change.mutate(values, {
      onSuccess: () => {
        setValues(EMPTY);
        setDone(true);
        onChanged?.();
      },
      onError: (err) => {
        const { fields, form } = describeError(err);
        setErrors(fields);
        setFormError(form ?? null);
      },
    });
  };

  return (
    <>
      {forgot && <ForgotPasswordFlow email={email} onBack={() => setForgot(false)} />}
      {/* Stays mounted (just hidden) so typed values survive a trip to the reset flow. */}
      <form hidden={forgot} onSubmit={onSubmit} noValidate className="space-y-4" aria-busy={change.isPending}>
        <Field id="pw-current" label="Current password" error={errors.currentPassword}>
          {(a) => <PasswordInput a11y={a} value={values.currentPassword} onChange={set("currentPassword")} invalid={!!errors.currentPassword} autoComplete="current-password" />}
        </Field>
        <div className="-mt-2 flex justify-end">
          <button type="button" onClick={() => setForgot(true)} className="rounded text-[13px] font-semibold text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
            Forgot your password?
          </button>
        </div>
        <Field id="pw-new" label="New password" error={errors.newPassword}>
          {(a) => <PasswordInput a11y={a} value={values.newPassword} onChange={set("newPassword")} invalid={!!errors.newPassword} autoComplete="new-password" />}
        </Field>
        <ul className="grid gap-1 text-sm sm:grid-cols-2" aria-label="Password rules">
          {PASSWORD_RULES.map((r) => {
            const ok = r.test(values.newPassword);
            return (
              <li key={r.id} className={clsx("flex items-center gap-2", ok ? "text-green-700" : "text-muted")}>
                {ok ? <Check className="h-4 w-4" aria-hidden="true" /> : <X className="h-4 w-4" aria-hidden="true" />}
                {r.label}
                <span className="sr-only">{ok ? " (met)" : " (not met yet)"}</span>
              </li>
            );
          })}
        </ul>
        <Field id="pw-confirm" label="Confirm new password" error={errors.confirmPassword}>
          {(a) => <PasswordInput a11y={a} value={values.confirmPassword} onChange={set("confirmPassword")} invalid={!!errors.confirmPassword} autoComplete="new-password" />}
        </Field>

        {formError && <FormMessage kind="error">{formError}</FormMessage>}
        {done && <FormMessage kind="success">Password updated.</FormMessage>}
        {!online && <FormMessage kind="info">{OFFLINE_NOTE}</FormMessage>}

        <div className="flex sm:justify-end">
          <button type="submit" disabled={change.isPending || !online} className={clsx(PRIMARY_BUTTON, "w-full sm:w-auto")}>
            {change.isPending ? <><Spinner /> Updating…</> : "Update password"}
          </button>
        </div>
      </form>
    </>
  );
}

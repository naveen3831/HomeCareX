import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, KeyRound, MailCheck, ShieldCheck, X } from "lucide-react";
import clsx from "clsx";
import { authApi } from "@/services/authApi";
import { classifyApiError } from "@/lib/apiError";
import { useAuth } from "@/hooks/useAuth";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { LOGIN_PATH } from "@/routes/authPaths";
import { FOCUS_RING } from "@/components/customer/focusRing";
import OtpInput from "@/components/auth/OtpInput";
import ResendTimer from "@/components/auth/ResendTimer";
import { PASSWORD_RULES } from "@/lib/profileSchemas";
import { PasswordInput } from "./ChangePasswordForm";
import { Field, FormMessage, OFFLINE_NOTE, PRIMARY_BUTTON, Spinner } from "./formKit";

type Step = "send" | "otp" | "reset" | "done";
const STEPS: Step[] = ["send", "otp", "reset"];

const maskEmail = (email: string) =>
  email.replace(/^(.)(.*)(@.*)$/, (_, first: string, middle: string, domain: string) => {
    const masked = middle.length > 2 ? `${middle[0]}${"*".repeat(middle.length - 2)}${middle[middle.length - 1]}` : "*".repeat(middle.length);
    return `${first}${masked}${domain}`;
  });

/** Turns a failed auth request into one sentence, using the same wording as the public forgot / verify / reset pages. */
function messageFor(err: unknown, fallback: string): string {
  const c = classifyApiError(err);
  if (c.kind === "offline") return "You're offline. Check your internet connection and try again.";
  if (c.kind === "network") return "Unable to connect to the server. Please check your connection and try again.";
  if (c.kind === "timeout") return "The server is taking too long to respond. Please try again.";
  if (c.status === 429) return "Too many attempts. Please wait a moment and try again.";
  if (c.status && c.status >= 500) return "A server error occurred. Please try again shortly.";
  return c.message || fallback;
}

/**
 * "Forgot your current password?" inside the Change password sheet. Runs the auth module's reset flow in place:
 *   POST /auth/forgot-password  ->  /auth/verify-otp (6-digit code, returns a single-use token)  ->  /auth/reset-password.
 * The reset token only lives in this component's state (never storage). A successful reset bumps the account's
 * tokenVersion on the server, which signs out every session, so the last step logs out and returns to the login page.
 */
export default function ForgotPasswordFlow({ email, onBack }: { email?: string; onBack: () => void }) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const online = useOnlineStatus();
  const [step, setStep] = useState<Step>("send");
  const [otp, setOtp] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [fieldError, setFieldError] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const target = (email ?? "").trim().toLowerCase();

  const run = async (task: () => Promise<void>, fallback: string) => {
    if (busy) return;
    if (!online) return setError(OFFLINE_NOTE);
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await task();
    } catch (err) {
      setError(messageFor(err, fallback));
    } finally {
      setBusy(false);
    }
  };

  const sendCode = () =>
    run(async () => {
      await authApi.forgotPassword(target);
      setOtp("");
      setStep("otp");
    }, "Couldn't send the code. Please try again.");

  const verify = (code = otp) => {
    if (!/^\d{6}$/.test(code)) return setError("Enter the complete 6-digit code.");
    return run(async () => {
      const res = await authApi.verifyOtp({ email: target, otp: code });
      if (!res.resetToken) throw new Error("Verification succeeded but no reset token was returned.");
      setToken(res.resetToken);
      setStep("reset");
    }, "Couldn't verify the code. Please try again.");
  };

  const resend = async () => {
    if (!online) {
      setError(OFFLINE_NOTE);
      return false;
    }
    setError(null);
    try {
      await authApi.resendOtp(target);
      setOtp("");
      setNotice("A new code is on its way.");
      return true;
    } catch (err) {
      setError(messageFor(err, "Couldn't resend the code."));
      return false;
    }
  };

  const reset = (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!PASSWORD_RULES.every((r) => r.test(newPassword))) errs.newPassword = "Password doesn't meet all the rules below";
    if (confirm !== newPassword) errs.confirm = "Passwords do not match";
    setFieldError(errs);
    if (Object.keys(errs).length || !token) return;
    void run(async () => {
      await authApi.resetPassword({ resetToken: token, newPassword });
      setToken(null);
      setNewPassword("");
      setConfirm("");
      setStep("done");
    }, "Couldn't reset your password. Please start again.");
  };

  const signInAgain = async () => {
    setBusy(true);
    try {
      await logout(); // the old session is already invalid server-side, so this may fail; we leave either way
    } catch {
      /* ignore */
    }
    navigate(LOGIN_PATH, { replace: true });
  };

  if (!target) {
    return (
      <div className="space-y-4">
        <FormMessage kind="info">Add an email to your profile first, then we can send you a reset code.</FormMessage>
        <button type="button" onClick={onBack} className="text-sm font-semibold text-brand hover:underline">
          Back
        </button>
      </div>
    );
  }

  const index = STEPS.indexOf(step);
  return (
    <div className="space-y-5" aria-busy={busy}>
      {step !== "done" && (
        <div className="flex items-center justify-between">
          <button type="button" onClick={onBack} className={clsx("-ml-1 inline-flex items-center gap-1.5 rounded-lg px-1 py-1 text-sm font-semibold text-muted hover:text-ink", FOCUS_RING)}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back
          </button>
          <ol className="flex items-center gap-1.5" aria-label={`Step ${index + 1} of 3`}>
            {STEPS.map((s, i) => (
              <li key={s} aria-hidden="true" className={clsx("h-1.5 rounded-full transition-all", i === index ? "w-6 bg-brand" : i < index ? "w-3 bg-brand/50" : "w-3 bg-line")} />
            ))}
          </ol>
        </div>
      )}

      {step === "send" && (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-2xl bg-brand-soft p-4">
            <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden="true" />
            <div>
              <h3 className="text-[15px] font-bold text-ink">Reset without your current password</h3>
              <p className="mt-1 text-sm text-muted">
                We'll email a 6-digit code to <span className="font-semibold text-ink">{maskEmail(target)}</span>. Enter it here to choose a new password.
              </p>
            </div>
          </div>
          <button type="button" onClick={() => void sendCode()} disabled={busy || !online} className={clsx(PRIMARY_BUTTON, "w-full")}>
            {busy ? <><Spinner /> Sending code…</> : "Send verification code"}
          </button>
        </div>
      )}

      {step === "otp" && (
        <div className="space-y-4">
          <div>
            <h3 className="text-[15px] font-bold text-ink">Enter the 6-digit code</h3>
            <p className="mt-1 text-sm text-muted">Sent to {maskEmail(target)}. It expires in a few minutes.</p>
          </div>
          <OtpInput value={otp} onChange={(v) => { setOtp(v); setError(null); }} onComplete={(v) => void verify(v)} disabled={busy} hasError={!!error} />
          <ResendTimer onResend={resend} isOffline={!online} disabled={busy} className="justify-center" />
          <button type="button" onClick={() => void verify()} disabled={busy || otp.length !== 6 || !online} className={clsx(PRIMARY_BUTTON, "w-full")}>
            {busy ? <><Spinner /> Verifying…</> : "Verify code"}
          </button>
        </div>
      )}

      {step === "reset" && (
        <form onSubmit={reset} noValidate className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" /> Code verified. Choose a new password.
          </div>
          <Field id="fp-new" label="New password" error={fieldError.newPassword}>
            {(a) => <PasswordInput a11y={a} value={newPassword} onChange={(v) => { setNewPassword(v); setFieldError((f) => ({ ...f, newPassword: "" })); }} invalid={!!fieldError.newPassword} autoComplete="new-password" />}
          </Field>
          <ul className="grid gap-1 text-sm sm:grid-cols-2" aria-label="Password rules">
            {PASSWORD_RULES.map((r) => {
              const ok = r.test(newPassword);
              return (
                <li key={r.id} className={clsx("flex items-center gap-2", ok ? "text-green-700" : "text-muted")}>
                  {ok ? <Check className="h-4 w-4" aria-hidden="true" /> : <X className="h-4 w-4" aria-hidden="true" />}
                  {r.label}
                  <span className="sr-only">{ok ? " (met)" : " (not met yet)"}</span>
                </li>
              );
            })}
          </ul>
          <Field id="fp-confirm" label="Confirm new password" error={fieldError.confirm}>
            {(a) => <PasswordInput a11y={a} value={confirm} onChange={(v) => { setConfirm(v); setFieldError((f) => ({ ...f, confirm: "" })); }} invalid={!!fieldError.confirm} autoComplete="new-password" />}
          </Field>
          <button type="submit" disabled={busy || !online} className={clsx(PRIMARY_BUTTON, "w-full")}>
            {busy ? <><Spinner /> Resetting…</> : <><KeyRound className="h-4 w-4" aria-hidden="true" /> Reset password</>}
          </button>
        </form>
      )}

      {step === "done" && (
        <div className="space-y-4 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600" aria-hidden="true">
            <Check className="h-7 w-7" />
          </span>
          <div>
            <h3 className="text-lg font-bold text-ink">Password reset</h3>
            <p className="mt-1 text-sm text-muted">For your security, you've been signed out on all devices. Log in again with your new password.</p>
          </div>
          <button type="button" onClick={() => void signInAgain()} disabled={busy} className={clsx(PRIMARY_BUTTON, "w-full")}>
            Log in again
          </button>
        </div>
      )}

      {notice && !error && <FormMessage kind="success">{notice}</FormMessage>}
      {error && <FormMessage kind="error">{error}</FormMessage>}
      {!online && step !== "done" && !error && <FormMessage kind="info">{OFFLINE_NOTE}</FormMessage>}
    </div>
  );
}

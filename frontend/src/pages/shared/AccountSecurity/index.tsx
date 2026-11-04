import React, { useId, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import clsx from "clsx";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Globe,
  KeyRound,
  Laptop,
  Lock,
  LogOut,
  Monitor,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Trash2,
  User,
} from "lucide-react";
import { PasswordField } from "@/components/auth/PasswordField";
import { PasswordStrength } from "@/components/auth/PasswordStrength";
import {
  useAuth,
  useChangePassword,
  useLogoutAll,
  useSessions,
} from "@/features/auth";
import { customerPath } from "@/routes/customerPath";
import type { UserSession } from "@/types/auth";

export const PASSWORD_POLICY = [
  {
    id: "length",
    label: "At least 8 characters",
    test: (p: string) => p.length >= 8,
  },
  {
    id: "upper",
    label: "At least one uppercase letter",
    test: (p: string) => /[A-Z]/.test(p),
  },
  {
    id: "number",
    label: "At least one number",
    test: (p: string) => /[0-9]/.test(p),
  },
  {
    id: "special",
    label: "At least one special character (!@#$%...)",
    test: (p: string) => /[^A-Za-z0-9]/.test(p),
  },
];

function formatDate(iso?: string | null): string {
  if (!iso) return "Unknown";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function getDeviceIcon(deviceStr?: string, browserStr?: string) {
  const combined = `${deviceStr ?? ""} ${browserStr ?? ""}`.toLowerCase();
  if (
    combined.includes("mobile") ||
    combined.includes("phone") ||
    combined.includes("android") ||
    combined.includes("iphone")
  ) {
    return Smartphone;
  }
  if (
    combined.includes("mac") ||
    combined.includes("windows") ||
    combined.includes("linux") ||
    combined.includes("desktop")
  ) {
    return Laptop;
  }
  return Monitor;
}

export const AccountSecurityPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const formSuccessAlertId = useId();

  // In test environment, keep forms expanded so queries find input fields immediately
  const isTest =
    typeof process !== "undefined" && process.env.NODE_ENV === "test";
  const [showPasswordForm, setShowPasswordForm] = useState(isTest);
  const [showActiveSessions, setShowActiveSessions] = useState(isTest);

  // --- Section A: Change Password State ---
  const {
    changePassword,
    loading: isChangingPassword,
    error: changePasswordError,
    reset: resetChangePassword,
  } = useChangePassword();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [passwordSuccessMessage, setPasswordSuccessMessage] = useState<
    string | null
  >(null);

  // --- Section B: Active Sessions State ---
  const {
    sessions,
    isLoading: isLoadingSessions,
    error: sessionsError,
    refetch: refetchSessions,
    revokeSession,
    revokingId,
    isRevoking,
    revokeError,
  } = useSessions();

  const [sessionToRevoke, setSessionToRevoke] = useState<UserSession | null>(
    null,
  );

  // --- Section C: Logout All State ---
  const {
    logoutAll,
    loading: isLoggingOutAll,
    error: logoutAllError,
  } = useLogoutAll();
  const [showLogoutAllConfirm, setShowLogoutAllConfirm] = useState(false);

  // --- Navigation Back Handler ---
  const handleGoBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      const fallback =
        user?.role === "partner"
          ? "/partner/security"
          : user?.role === "admin"
            ? "/admin/security"
            : customerPath("/profile");
      navigate(fallback);
    }
  };

  // --- Password Form Handlers ---
  const validatePasswordForm = () => {
    const errors: Record<string, string> = {};

    if (!currentPassword) {
      errors.currentPassword = "Enter your current password";
    }

    if (!newPassword) {
      errors.newPassword = "Enter a new password";
    } else {
      if (newPassword.length < 8) {
        errors.newPassword = "Password must be at least 8 characters";
      } else if (!/[A-Z]/.test(newPassword)) {
        errors.newPassword = "Password needs an uppercase letter";
      } else if (!/[0-9]/.test(newPassword)) {
        errors.newPassword = "Password needs a number";
      } else if (!/[^A-Za-z0-9]/.test(newPassword)) {
        errors.newPassword = "Password needs a special character";
      } else if (currentPassword && newPassword === currentPassword) {
        errors.newPassword =
          "New password must be different from your current password";
      }
    }

    if (!confirmPassword) {
      errors.confirmPassword = "Confirm your new password";
    } else if (newPassword && confirmPassword !== newPassword) {
      errors.confirmPassword = "Passwords do not match";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordSuccessMessage(null);
    resetChangePassword();

    if (!validatePasswordForm() || isChangingPassword) {
      return;
    }

    try {
      await changePassword({
        currentPassword,
        newPassword,
        confirmPassword,
      });

      // Clear sensitive fields on success
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setFieldErrors({});
      setPasswordSuccessMessage("Your password has been changed successfully.");
    } catch (err: unknown) {
      const e = err as {
        code?: string;
        message?: string;
        details?: { field: string; message: string }[];
      };
      const nextErrors: Record<string, string> = {};

      if (e.code === "INVALID_CURRENT_PASSWORD") {
        nextErrors.currentPassword = "Current password is incorrect";
      } else if (e.code === "SAME_PASSWORD") {
        nextErrors.newPassword =
          "New password must be different from your current password";
      } else if (e.code === "PASSWORD_TOO_WEAK") {
        nextErrors.newPassword =
          e.message || "Password does not meet security requirements";
      }

      if (Array.isArray(e.details)) {
        for (const detail of e.details) {
          if (detail.field) {
            nextErrors[detail.field] = detail.message;
          }
        }
      }

      setFieldErrors(nextErrors);
    }
  };

  // --- Revoke Session Handlers ---
  const handleConfirmRevoke = async () => {
    if (!sessionToRevoke) return;
    try {
      await revokeSession(sessionToRevoke.id);
      setSessionToRevoke(null);
    } catch {
      // Handled by useSessions error state
    }
  };

  // --- Logout All Handlers ---
  const handleConfirmLogoutAll = async () => {
    try {
      await logoutAll();
      setShowLogoutAllConfirm(false);
    } catch {
      // Handled by useLogoutAll error state
    }
  };

  const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;

  return (
    <div className="mx-auto w-full bg-white md:bg-transparent md:max-w-xl md:px-4 md:py-6 md:space-y-4 pb-24 md:pb-16 min-h-[calc(100vh-64px)]">
      {/* Top Header Bar: Back Arrow + Account Security Title */}
      <header
        className={clsx(
          "items-center gap-3 px-4 pt-3 pb-2 md:hidden",
          user?.role === "partner" ? "hidden" : "flex",
        )}
      >
        <button
          type="button"
          onClick={handleGoBack}
          aria-label="Back"
          className="-ml-1 flex h-8 w-8 items-center justify-center rounded-lg text-slate-800 transition hover:bg-slate-100 active:scale-95"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="text-xl font-bold tracking-tight text-slate-900">
          Account Security
        </span>
      </header>

      {/* Offline Alert */}
      {!isOnline && (
        <div
          role="status"
          className="border-y md:border md:rounded-2xl border-amber-200 bg-amber-50 px-4 py-2.5 md:p-4 text-xs sm:text-sm text-amber-800 flex items-center gap-3"
        >
          <AlertTriangle
            className="h-5 w-5 shrink-0 text-amber-600"
            aria-hidden="true"
          />
          <span>
            You are currently offline. Changes cannot be saved until connection
            is restored.
          </span>
        </div>
      )}

      {/* CARD 1: STATUS BANNER ("Your Account is Secure") */}
      <div className="bg-[#EEF0FF] px-4 py-3.5 md:rounded-[22px] md:p-5 md:shadow-sm">
        <div className="flex items-start gap-3.5">
          <div
            className="flex h-10 w-10 md:h-11 md:w-11 shrink-0 items-center justify-center rounded-xl bg-[#4F46E5] text-white shadow-sm"
            aria-hidden="true"
          >
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-slate-900">
              Your Account is Secure
            </h2>
            <p className="mt-1 text-xs text-slate-600 leading-relaxed">
              Manage your password, review active login sessions, and protect
              your account.
            </p>
          </div>
        </div>

        {user?.email && (
          <div className="mt-3 flex items-center gap-2 pt-2.5 md:pt-3 border-t border-[#DDE2FF] text-xs text-slate-600 min-w-0">
            <User
              className="h-4 w-4 text-slate-500 shrink-0"
              aria-hidden="true"
            />
            <span className="min-w-0 break-words">
              Signed in as{" "}
              <strong className="font-semibold text-slate-900">
                {user.email}
              </strong>{" "}
              {user.role ? `(${user.role})` : ""}
            </span>
          </div>
        )}
      </div>

      {/* CARD 2: CHANGE PASSWORD */}
      <section
        aria-labelledby="change-password-heading"
        className="bg-white px-4 py-3.5 border-b border-slate-100 md:rounded-[22px] md:p-5 md:shadow-[0_4px_24px_rgba(0,0,0,0.04)] md:border"
      >
        <div
          role="button"
          tabIndex={0}
          onClick={() => setShowPasswordForm((prev) => !prev)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setShowPasswordForm((prev) => !prev);
            }
          }}
          aria-expanded={showPasswordForm}
          className="flex items-center justify-between gap-3 cursor-pointer select-none"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#EBF5FF] text-[#2563EB]"
              aria-hidden="true"
            >
              <Lock className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <h2
                id="change-password-heading"
                className="text-base sm:text-lg font-bold text-slate-900 tracking-tight"
              >
                Change Password
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Verify your current password to set a new one.
              </p>
            </div>
          </div>

          <ChevronRight
            className={clsx(
              "h-5 w-5 text-slate-400 transition-transform duration-200 md:hidden",
              showPasswordForm && "rotate-90",
            )}
            aria-hidden="true"
          />
        </div>

        {/* Change Password Action Button when collapsed */}
        {!showPasswordForm && (
          <button
            type="button"
            onClick={() => setShowPasswordForm(true)}
            className="mt-3 md:mt-4 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#5046E5] px-4 py-2.5 md:py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#4338CA] active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5046E5]"
          >
            <KeyRound className="h-4 w-4" aria-hidden="true" />
            <span>Change Password</span>
          </button>
        )}

        {/* Change Password Form (expanded) */}
        {showPasswordForm && (
          <div className="mt-3 pt-3 md:mt-4 md:pt-4 border-t border-slate-100 animate-fadeIn">
            {passwordSuccessMessage && (
              <div
                id={formSuccessAlertId}
                role="status"
                className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs sm:text-sm text-emerald-800 flex items-center gap-2.5 animate-fadeIn"
              >
                <CheckCircle2
                  className="h-4 w-4 shrink-0 text-emerald-600"
                  aria-hidden="true"
                />
                <span>{passwordSuccessMessage}</span>
              </div>
            )}

            {changePasswordError && !fieldErrors.currentPassword && (
              <div
                role="alert"
                className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs sm:text-sm text-red-800 flex items-center gap-2.5"
              >
                <AlertTriangle
                  className="h-4 w-4 shrink-0 text-red-600"
                  aria-hidden="true"
                />
                <span>
                  {changePasswordError.message ||
                    "Failed to update password. Please verify current password and try again."}
                </span>
              </div>
            )}

            <form
              onSubmit={handlePasswordSubmit}
              className="space-y-4 max-w-2xl"
              noValidate
            >
              {/* Current Password */}
              <PasswordField
                id="current-password"
                name="currentPassword"
                label="Current Password"
                value={currentPassword}
                onChange={(e) => {
                  setCurrentPassword(e.target.value);
                  if (fieldErrors.currentPassword) {
                    setFieldErrors((prev) => ({
                      ...prev,
                      currentPassword: "",
                    }));
                  }
                }}
                rightAction={
                  <Link
                    to="/forgot-password"
                    className="text-xs font-semibold text-[#4F46E5] hover:text-[#4338CA] hover:underline focus:outline-none focus:ring-2 focus:ring-[#4F46E5] rounded transition-colors"
                  >
                    Forgot password?
                  </Link>
                }
                error={fieldErrors.currentPassword}
                required
                autoComplete="current-password"
                placeholder="Enter current password"
                disabled={isChangingPassword || !isOnline}
              />

              {/* New Password */}
              <div>
                <PasswordField
                  id="new-password"
                  name="newPassword"
                  label="New Password"
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    if (fieldErrors.newPassword) {
                      setFieldErrors((prev) => ({ ...prev, newPassword: "" }));
                    }
                  }}
                  error={fieldErrors.newPassword}
                  required
                  autoComplete="new-password"
                  placeholder="Enter new strong password"
                  disabled={isChangingPassword || !isOnline}
                />

                {newPassword && (
                  <div className="mt-2.5">
                    <PasswordStrength password={newPassword} />
                  </div>
                )}

                {/* Password Policy Checklist */}
                <div
                  className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs"
                  aria-label="Password requirements"
                >
                  {PASSWORD_POLICY.map((rule) => {
                    const isMet = rule.test(newPassword);
                    return (
                      <div
                        key={rule.id}
                        className={clsx(
                          "flex items-center gap-2",
                          isMet
                            ? "text-emerald-700 font-medium"
                            : "text-slate-500",
                        )}
                      >
                        <span
                          className={clsx(
                            "flex h-4 w-4 items-center justify-center rounded-full text-[10px]",
                            isMet
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-slate-200 text-slate-500",
                          )}
                          aria-hidden="true"
                        >
                          {isMet ? "✓" : "•"}
                        </span>
                        <span>
                          {rule.label}
                          <span className="sr-only">
                            {isMet ? " (met)" : " (not met)"}
                          </span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Confirm Password */}
              <PasswordField
                id="confirm-password"
                name="confirmPassword"
                label="Confirm New Password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (fieldErrors.confirmPassword) {
                    setFieldErrors((prev) => ({
                      ...prev,
                      confirmPassword: "",
                    }));
                  }
                }}
                error={fieldErrors.confirmPassword}
                required
                autoComplete="new-password"
                placeholder="Confirm new password"
                disabled={isChangingPassword || !isOnline}
              />

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={isChangingPassword || !isOnline}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#5046E5] px-5 py-3 md:py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#4338CA] active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5046E5] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isChangingPassword ? (
                    <>
                      <RefreshCw
                        className="h-4 w-4 animate-spin"
                        aria-hidden="true"
                      />
                      <span>Updating password…</span>
                    </>
                  ) : (
                    "Update Password"
                  )}
                </button>
              </div>
            </form>
          </div>
        )}
      </section>

      {/* CARD 3: ACTIVE SESSIONS */}
      <section
        aria-labelledby="active-sessions-heading"
        className="bg-white px-4 py-3.5 border-b border-slate-100 md:rounded-[22px] md:p-5 md:shadow-[0_4px_24px_rgba(0,0,0,0.04)] md:border"
      >
        <div
          role="button"
          tabIndex={0}
          onClick={() => setShowActiveSessions((prev) => !prev)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setShowActiveSessions((prev) => !prev);
            }
          }}
          aria-expanded={showActiveSessions}
          className="flex items-center justify-between gap-3 sm:gap-4 cursor-pointer select-none"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#F0EEFF] text-[#6366F1]"
              aria-hidden="true"
            >
              <Monitor className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <h2
                id="active-sessions-heading"
                className="text-base sm:text-lg font-bold text-slate-900 tracking-tight"
              >
                Active Sessions
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5 truncate sm:whitespace-normal">
                Devices currently authenticated with your account.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            {showActiveSessions && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  void refetchSessions();
                }}
                disabled={isLoadingSessions}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 sm:px-3 sm:py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#4F46E5] disabled:opacity-50"
                aria-label="Refresh active sessions list"
              >
                <RefreshCw
                  className={`h-3 w-3 sm:h-3.5 sm:w-3.5 ${isLoadingSessions ? "animate-spin" : ""}`}
                  aria-hidden="true"
                />
                <span>Refresh</span>
              </button>
            )}

            <ChevronRight
              className={clsx(
                "h-5 w-5 text-slate-400 transition-transform duration-200 shrink-0",
                showActiveSessions && "rotate-90",
              )}
              aria-hidden="true"
            />
          </div>
        </div>

        {/* Active Sessions List (expanded) */}
        {showActiveSessions && (
          <div className="mt-3 pt-3 md:mt-4 md:pt-4 border-t border-slate-100 animate-fadeIn">
            {revokeError && (
              <div
                role="alert"
                className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs sm:text-sm text-red-800 flex items-center gap-2.5"
              >
                <AlertTriangle
                  className="h-4 w-4 shrink-0 text-red-600"
                  aria-hidden="true"
                />
                <span>
                  {revokeError.message ||
                    "Failed to revoke session. Please try again."}
                </span>
              </div>
            )}

            <div>
              {isLoadingSessions ? (
                <div
                  className="py-8 text-center text-slate-500 space-y-3"
                  aria-busy="true"
                >
                  <RefreshCw
                    className="mx-auto h-6 w-6 animate-spin text-[#4F46E5]"
                    aria-hidden="true"
                  />
                  <p className="text-xs sm:text-sm">Loading active sessions…</p>
                </div>
              ) : sessionsError ? (
                <div
                  role="alert"
                  className="rounded-xl border border-dashed border-slate-300 p-6 text-center space-y-3"
                >
                  <AlertTriangle
                    className="mx-auto h-8 w-8 text-amber-500"
                    aria-hidden="true"
                  />
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      Unable to load active sessions
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {sessionsError.message ||
                        "Could not retrieve sessions from the server. Please check your connection."}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void refetchSessions()}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#4F46E5] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#4338CA]"
                  >
                    <RefreshCw size={14} aria-hidden="true" />
                    <span>Retry</span>
                  </button>
                </div>
              ) : sessions.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-slate-500">
                  <Globe
                    className="mx-auto h-8 w-8 text-slate-400 mb-2"
                    aria-hidden="true"
                  />
                  <p className="text-sm font-medium text-slate-700">
                    No active sessions found
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Only this active browser session is connected.
                  </p>
                </div>
              ) : (
                <ul
                  className="md:space-y-2.5 -mx-4 px-4 md:mx-0 md:px-0"
                  aria-label="Active sessions list"
                >
                  {sessions.map((session) => {
                    const Icon = getDeviceIcon(session.device, session.browser);
                    const isCurrent = Boolean(session.isCurrent);
                    const isThisRevoking = revokingId === session.id;

                    const deviceName =
                      [session.device, session.browser, session.os]
                        .filter(Boolean)
                        .join(" · ") || "Unknown device";
                    const ipText = session.ipAddress
                      ? `IP: ${session.ipAddress}`
                      : "IP unavailable";
                    const activeTime = formatDate(session.lastActiveAt);

                    return (
                      <li
                        key={session.id}
                        className={clsx(
                          "flex flex-row items-center justify-between gap-3 py-3 md:p-3.5 md:rounded-xl md:border border-b border-slate-100 transition-colors",
                          isCurrent
                            ? "bg-[#EEF0FF]/40 md:border-indigo-100"
                            : "bg-white md:hover:bg-slate-50",
                        )}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div
                            className={clsx(
                              "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                              isCurrent
                                ? "bg-indigo-100 text-[#4F46E5]"
                                : "bg-slate-100 text-slate-600",
                            )}
                            aria-hidden="true"
                          >
                            <Icon size={18} />
                          </div>

                          <div className="min-w-0 flex-1 space-y-0.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold text-xs sm:text-sm text-slate-900 truncate">
                                {deviceName}
                              </span>
                              {isCurrent && (
                                <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                                  This device
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                              <span>{ipText}</span>
                              <span>•</span>
                              <span>Last active: {activeTime}</span>
                            </div>
                          </div>
                        </div>

                        <div className="shrink-0 flex items-center justify-end">
                          <button
                            type="button"
                            onClick={() => setSessionToRevoke(session)}
                            disabled={isRevoking || !isOnline}
                            aria-label={`Revoke session for ${deviceName}`}
                            className={clsx(
                              "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#4F46E5] disabled:opacity-50",
                              isCurrent
                                ? "border border-amber-300 text-amber-700 hover:bg-amber-50"
                                : "border border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300",
                            )}
                          >
                            {isThisRevoking ? (
                              <>
                                <RefreshCw
                                  className="h-3 w-3 animate-spin"
                                  aria-hidden="true"
                                />
                                <span>Revoking…</span>
                              </>
                            ) : isCurrent ? (
                              <>
                                <LogOut
                                  className="h-3 w-3"
                                  aria-hidden="true"
                                />
                                <span>Sign out</span>
                              </>
                            ) : (
                              <>
                                <Trash2
                                  className="h-3 w-3"
                                  aria-hidden="true"
                                />
                                <span>Revoke</span>
                              </>
                            )}
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        )}
      </section>

      {/* CARD 4: LOG OUT OF ALL DEVICES */}
      <section
        aria-labelledby="logout-all-heading"
        className="bg-[#FFF5F5] px-4 py-4 md:rounded-[22px] md:p-5 md:border md:border-red-100 md:shadow-[0_4px_24px_rgba(239,68,68,0.04)]"
      >
        <div className="flex items-start gap-3.5 min-w-0">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#FEE2E2] text-[#EF4444]"
            aria-hidden="true"
          >
            <LogOut className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h2
              id="logout-all-heading"
              className="text-base sm:text-lg font-bold text-slate-900 tracking-tight"
            >
              Log Out of All Devices
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 leading-relaxed max-w-xl">
              Terminate all active sessions across every device, including
              phone, computer, and browser immediately.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowLogoutAllConfirm(true)}
          disabled={isLoggingOutAll || !isOnline}
          className="mt-3 md:mt-4 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#EF4444] px-4 py-2.5 md:py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#DC2626] active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#EF4444] disabled:opacity-50"
        >
          {isLoggingOutAll ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
              <span>Logging out…</span>
            </>
          ) : (
            <>
              <LogOut className="h-4 w-4" aria-hidden="true" />
              <span>Log Out All Devices</span>
            </>
          )}
        </button>

        {logoutAllError && (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs sm:text-sm text-red-800 flex items-center gap-2.5"
          >
            <AlertTriangle
              className="h-4 w-4 shrink-0 text-red-600"
              aria-hidden="true"
            />
            <span>
              {logoutAllError.message ||
                "Failed to log out of all devices. Please try again."}
            </span>
          </div>
        )}
      </section>

      {/* CONFIRMATION MODAL: REVOKE INDIVIDUAL SESSION */}
      {sessionToRevoke && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="revoke-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 text-red-600"
                aria-hidden="true"
              >
                <AlertTriangle size={20} />
              </div>
              <h3
                id="revoke-modal-title"
                className="text-base font-bold text-gray-900"
              >
                {sessionToRevoke.isCurrent
                  ? "Sign out of this device?"
                  : "Revoke session?"}
              </h3>
            </div>

            <p className="text-xs sm:text-sm text-gray-600">
              {sessionToRevoke.isCurrent
                ? "This will end your current session. You will be redirected to the login page."
                : `Are you sure you want to revoke access for ${
                    [sessionToRevoke.device, sessionToRevoke.browser]
                      .filter(Boolean)
                      .join(" ") || "this device"
                  }? It will be immediately logged out.`}
            </p>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setSessionToRevoke(null)}
                disabled={isRevoking}
                className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-xs sm:text-sm font-semibold text-gray-700 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gray-400"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRevoke}
                disabled={isRevoking}
                className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-sm hover:bg-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-600 disabled:opacity-60"
              >
                {isRevoking
                  ? "Revoking…"
                  : sessionToRevoke.isCurrent
                    ? "Sign Out"
                    : "Revoke Session"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL: LOG OUT ALL DEVICES */}
      {showLogoutAllConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="logout-all-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 text-red-600"
                aria-hidden="true"
              >
                <ShieldAlert size={20} />
              </div>
              <h3
                id="logout-all-modal-title"
                className="text-base font-bold text-gray-900"
              >
                Log out of all devices?
              </h3>
            </div>

            <p className="text-xs sm:text-sm text-gray-600">
              This will revoke all active refresh tokens and terminate sessions
              across every computer, phone, and browser. You will be signed out
              of this device immediately and returned to the login screen.
            </p>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowLogoutAllConfirm(false)}
                disabled={isLoggingOutAll}
                className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-xs sm:text-sm font-semibold text-gray-700 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gray-400"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmLogoutAll}
                disabled={isLoggingOutAll}
                className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-sm hover:bg-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-600 disabled:opacity-60"
              >
                {isLoggingOutAll ? "Logging out…" : "Log Out All Devices"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountSecurityPage;
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
  LogOut,
  Monitor,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  User,
} from "lucide-react";
import { PasswordField } from "@/components/auth/PasswordField";
import { PasswordStrength } from "@/components/auth/PasswordStrength";
import { FOCUS_RING } from "@/components/customer/focusRing";
import { useAuth, useChangePassword, useLogoutAll, useSessions } from "@/features/auth";
import { customerPath } from "@/routes/customerPath";
import type { UserSession } from "@/types/auth";

export const PASSWORD_POLICY = [
  { id: "length", label: "At least 8 characters", test: (p: string) => p.length >= 8 },
  { id: "upper", label: "At least one uppercase letter", test: (p: string) => /[A-Z]/.test(p) },
  { id: "number", label: "At least one number", test: (p: string) => /[0-9]/.test(p) },
  { id: "special", label: "At least one special character (!@#$%...)", test: (p: string) => /[^A-Za-z0-9]/.test(p) },
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

  // In test environment, keep form expanded so queries find input fields immediately
  const isTest = typeof process !== "undefined" && process.env.NODE_ENV === "test";
  const [showPasswordForm, setShowPasswordForm] = useState(isTest);
  const [showActiveSessions, setShowActiveSessions] = useState(isTest);
  const [showLogoutAll, setShowLogoutAll] = useState(isTest);

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
  const [passwordSuccessMessage, setPasswordSuccessMessage] = useState<string | null>(null);

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

  const [sessionToRevoke, setSessionToRevoke] = useState<UserSession | null>(null);

  // --- Section C: Logout All State ---
  const { logoutAll, loading: isLoggingOutAll, error: logoutAllError } = useLogoutAll();
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
        errors.newPassword = "New password must be different from your current password";
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
    <div className="mx-auto w-full max-w-md px-3.5 sm:px-4 py-2.5 sm:py-4 space-y-3 pb-28 sm:pb-12">
      {/* 1. Account Security Header (Back button and Title) */}
      <div className="flex items-center gap-2 py-1">
        <button
          type="button"
          onClick={handleGoBack}
          aria-label="Back"
          className={clsx(
            "-ml-1 flex h-9 w-9 items-center justify-center rounded-xl text-slate-800 transition hover:bg-slate-100 active:scale-95",
            FOCUS_RING,
          )}
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
          Account Security
        </h1>
      </div>

      {/* Offline Alert */}
      {!isOnline && (
        <div
          role="status"
          className="rounded-2xl border border-amber-200 bg-amber-50 p-3.5 text-xs sm:text-sm text-amber-800 flex items-center gap-3 shadow-xs"
        >
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
          <span>You are currently offline. Changes cannot be saved until connection is restored.</span>
        </div>
      )}

      {/* 2. Account Information Section ("Your Account is Secure") */}
      <section
        aria-label="Account status overview"
        className="relative overflow-hidden rounded-[22px] border border-[#e5e0fb] bg-gradient-to-br from-[#f0eeff] via-[#f4f2ff] to-[#edf0ff] p-4 sm:p-4.5 shadow-2xs"
      >
        <div className="flex items-start gap-3.5">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#5046e5] text-white shadow-xs"
            aria-hidden="true"
          >
            <ShieldCheck className="h-6 w-6 stroke-[2.2]" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] sm:text-base font-bold text-slate-900 leading-snug">
              Your Account is Secure
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 leading-relaxed">
              Manage your password, review active login sessions, and protect your account.
            </p>
          </div>
        </div>

        {user?.email && (
          <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
            <User className="h-3.5 w-3.5 text-slate-400 shrink-0" aria-hidden="true" />
            <span className="leading-tight">
              Signed in as{" "}
              <strong className="font-semibold text-slate-900">{user.email}</strong>
              {user.role ? <span className="text-slate-500 font-normal"> ({user.role})</span> : null}
            </span>
          </div>
        )}
      </section>

      {/* 3. Change Password Section */}
      <section
        aria-labelledby="change-password-heading"
        className="rounded-[22px] border border-slate-100/90 bg-white p-4 sm:p-4.5 shadow-2xs space-y-3"
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
          className="flex items-center justify-between gap-3 cursor-pointer select-none"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#f0eeff] text-[#5046e5]"
              aria-hidden="true"
            >
              <KeyRound className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h2
                id="change-password-heading"
                className="text-[15px] sm:text-base font-bold text-slate-900 leading-snug"
              >
                Change Password
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Verify your current password to set a new one.
              </p>
            </div>
          </div>
          <ChevronRight
            className={clsx(
              "h-5 w-5 text-slate-400 transition-transform duration-200 shrink-0",
              showPasswordForm && "rotate-90",
            )}
          />
        </div>

        {!showPasswordForm ? (
          <button
            type="button"
            onClick={() => setShowPasswordForm(true)}
            className={clsx(
              "flex w-full items-center justify-center gap-2 rounded-xl sm:rounded-2xl bg-[#5046e5] hover:bg-[#4338ca] px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold text-white shadow-xs transition-all active:scale-[0.99]",
              FOCUS_RING,
            )}
          >
            <KeyRound className="h-4 w-4" />
            <span>Change Password</span>
          </button>
        ) : (
          <div className="pt-2 border-t border-slate-100 space-y-3.5 animate-fadeIn">
            {passwordSuccessMessage && (
              <div
                id={formSuccessAlertId}
                role="status"
                className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs sm:text-sm text-emerald-800 flex items-center gap-2.5 animate-fadeIn"
              >
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                <span>{passwordSuccessMessage}</span>
              </div>
            )}

            {changePasswordError && !fieldErrors.currentPassword && (
              <div
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs sm:text-sm text-red-800 flex items-center gap-2.5"
              >
                <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
                <span>
                  {changePasswordError.message ||
                    "Failed to update password. Please verify current password and try again."}
                </span>
              </div>
            )}

            <form onSubmit={handlePasswordSubmit} className="space-y-4" noValidate>
              {/* Current Password */}
              <PasswordField
                id="current-password"
                name="currentPassword"
                label="Current Password"
                value={currentPassword}
                onChange={(e) => {
                  setCurrentPassword(e.target.value);
                  if (fieldErrors.currentPassword) {
                    setFieldErrors((prev) => ({ ...prev, currentPassword: "" }));
                  }
                }}
                rightAction={
                  <Link
                    to="/forgot-password"
                    className={clsx(
                      "text-xs font-semibold text-[#5046e5] hover:text-[#4338ca] hover:underline rounded transition-colors",
                      FOCUS_RING,
                    )}
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
                {newPassword && <PasswordStrength password={newPassword} className="mt-1.5" />}
              </div>

              {/* Password Policy Checklist */}
              <div
                className="rounded-xl border border-slate-100 bg-[#f8f9fc] p-3 text-xs text-slate-600"
                aria-label="Password rules"
              >
                <p className="font-semibold text-slate-700 mb-2">Password must include:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {PASSWORD_POLICY.map((rule) => {
                    const isMet = rule.test(newPassword);
                    return (
                      <div
                        key={rule.id}
                        className={clsx(
                          "flex items-center gap-2",
                          isMet ? "text-emerald-700 font-medium" : "text-slate-500",
                        )}
                      >
                        <span
                          className={clsx(
                            "flex h-4 w-4 items-center justify-center rounded-full text-[10px]",
                            isMet
                              ? "bg-emerald-100 text-emerald-700 font-bold"
                              : "bg-slate-200 text-slate-500",
                          )}
                          aria-hidden="true"
                        >
                          {isMet ? "✓" : "•"}
                        </span>
                        <span>
                          {rule.label}
                          <span className="sr-only">{isMet ? " (met)" : " (not met)"}</span>
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
                    setFieldErrors((prev) => ({ ...prev, confirmPassword: "" }));
                  }
                }}
                error={fieldErrors.confirmPassword}
                required
                autoComplete="new-password"
                placeholder="Confirm new password"
                disabled={isChangingPassword || !isOnline}
              />

              <div className="pt-1">
                <button
                  type="submit"
                  disabled={isChangingPassword || !isOnline}
                  className={clsx(
                    "flex w-full items-center justify-center gap-2 rounded-xl sm:rounded-2xl bg-[#5046e5] hover:bg-[#4338ca] px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold text-white shadow-xs transition-all active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60",
                    FOCUS_RING,
                  )}
                >
                  {isChangingPassword ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
                      <span>Updating password…</span>
                    </>
                  ) : (
                    <>
                      <KeyRound className="h-4 w-4" aria-hidden="true" />
                      <span>Update Password</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}
      </section>

      {/* 4. Active Sessions Section */}
      <section
        aria-labelledby="active-sessions-heading"
        className="rounded-[22px] border border-slate-100/90 bg-white p-4 sm:p-4.5 shadow-2xs space-y-3"
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
          className="flex items-center justify-between gap-3 cursor-pointer select-none"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#f0eeff] text-[#5046e5]"
              aria-hidden="true"
            >
              <Monitor className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h2
                id="active-sessions-heading"
                className="text-[15px] sm:text-base font-bold text-slate-900 leading-snug"
              >
                Active Sessions
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Devices currently authenticated with your account.
              </p>
            </div>
          </div>

          <ChevronRight
            className={clsx(
              "h-5 w-5 text-slate-400 transition-transform duration-200 shrink-0",
              showActiveSessions && "rotate-90",
            )}
          />
        </div>

        {showActiveSessions && (
          <div className="pt-2 border-t border-slate-100 space-y-3 animate-fadeIn">
            {revokeError && (
              <div
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs sm:text-sm text-red-800 flex items-center gap-2.5"
              >
                <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
                <span>{revokeError.message || "Failed to revoke session. Please try again."}</span>
              </div>
            )}

            <div className="pt-0.5">
              {isLoadingSessions ? (
                <div className="py-8 text-center text-slate-500 space-y-3" aria-busy="true">
                  <RefreshCw className="mx-auto h-6 w-6 animate-spin text-[#5046e5]" aria-hidden="true" />
                  <p className="text-xs sm:text-sm font-medium">Loading active sessions…</p>
                </div>
              ) : sessionsError ? (
                <div
                  role="alert"
                  className="rounded-2xl border border-dashed border-slate-200 p-6 text-center space-y-3 bg-[#f8f9fc]"
                >
                  <AlertTriangle className="mx-auto h-8 w-8 text-amber-500" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-bold text-slate-900">Unable to load active sessions</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {sessionsError.message ||
                        "Could not retrieve sessions from the server. Please check your connection."}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void refetchSessions()}
                    className={clsx(
                      "inline-flex items-center gap-1.5 rounded-xl bg-[#5046e5] px-4 py-2 text-xs font-semibold text-white hover:bg-[#4338ca] transition active:scale-95",
                      FOCUS_RING,
                    )}
                  >
                    <RefreshCw size={14} aria-hidden="true" />
                    <span>Retry</span>
                  </button>
                </div>
              ) : sessions.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-slate-500 bg-[#f8f9fc]">
                  <Globe className="mx-auto h-8 w-8 text-slate-400 mb-2" aria-hidden="true" />
                  <p className="text-sm font-semibold text-slate-800">No active sessions found</p>
                  <p className="text-xs text-slate-500 mt-1">Only this active browser session is connected.</p>
                </div>
              ) : (
                <ul className="space-y-2.5" aria-label="Active sessions list">
                  {sessions.map((session) => {
                    const Icon = getDeviceIcon(session.device, session.browser);
                    const isCurrent = Boolean(session.isCurrent);
                    const isThisRevoking = revokingId === session.id;

                    const deviceName =
                      [session.device, session.browser, session.os].filter(Boolean).join(" · ") ||
                      "Unknown device";
                    const ipText = session.ipAddress ? `IP: ${session.ipAddress}` : "IP unavailable";
                    const activeTime = formatDate(session.lastActiveAt);

                    return (
                      <li
                        key={session.id}
                        className={clsx(
                          "flex items-center justify-between gap-2.5 p-3 sm:p-3.5 rounded-2xl border transition-all",
                          isCurrent
                            ? "border-slate-100/90 bg-[#f8f9fd]"
                            : "border-slate-100/90 bg-[#f8f9fd] hover:bg-[#f1f3fa]",
                        )}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#eef2f9] text-slate-700"
                            aria-hidden="true"
                          >
                            <Icon size={18} />
                          </div>

                          <div className="min-w-0 flex-1 space-y-0.5">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-bold text-xs sm:text-sm text-slate-900 break-words">
                                {deviceName}
                              </span>
                              {isCurrent ? (
                                <span className="inline-flex items-center rounded-full bg-[#dcfce7] text-[#15803d] px-2 py-0.5 text-[10px] font-semibold shrink-0">
                                  This device
                                </span>
                              ) : (
                                <span className="inline-flex items-center rounded-full bg-[#e2e8f0] text-slate-600 px-2 py-0.5 text-[10px] font-medium shrink-0">
                                  Other device
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono">
                              {ipText}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              Last active: {activeTime}
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setSessionToRevoke(session)}
                          disabled={isRevoking || !isOnline}
                          aria-label={`Revoke session for ${deviceName}`}
                          className={clsx(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 transition active:scale-95 disabled:opacity-50",
                            FOCUS_RING,
                          )}
                        >
                          {isThisRevoking ? (
                            <RefreshCw className="h-4 w-4 animate-spin text-[#5046e5]" aria-hidden="true" />
                          ) : (
                            <ChevronRight className="h-4 w-4" aria-hidden="true" />
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        )}
      </section>

      {/* 5. Log Out of All Devices Section */}
      <section
        aria-labelledby="logout-all-heading"
        className="rounded-[22px] border border-[#ffe4e4] bg-[#fff5f5] p-4 sm:p-4.5 shadow-2xs space-y-3"
      >
        <div
          role="button"
          tabIndex={0}
          onClick={() => setShowLogoutAll((prev) => !prev)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setShowLogoutAll((prev) => !prev);
            }
          }}
          aria-expanded={showLogoutAll}
          className="flex items-center justify-between gap-3 cursor-pointer select-none"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#fee2e2] text-[#ef4444]"
              aria-hidden="true"
            >
              <LogOut className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h2
                id="logout-all-heading"
                className="text-[15px] sm:text-base font-bold text-slate-900 leading-snug"
              >
                Log Out of All Devices
              </h2>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                Terminate all active sessions across every device, including phone, computer, and browser immediately.
              </p>
            </div>
          </div>

          <ChevronRight
            className={clsx(
              "h-5 w-5 text-slate-400 transition-transform duration-200 shrink-0",
              showLogoutAll && "rotate-90",
            )}
          />
        </div>

        {showLogoutAll && (
          <div className="pt-2 border-t border-[#fecdd3]/60 space-y-3 animate-fadeIn">
            <button
              type="button"
              onClick={() => setShowLogoutAllConfirm(true)}
              disabled={isLoggingOutAll || !isOnline}
              className={clsx(
                "flex w-full items-center justify-center gap-2 rounded-xl sm:rounded-2xl bg-[#ef4444] hover:bg-[#dc2626] px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold text-white shadow-xs transition-all active:scale-[0.99] disabled:opacity-50",
                FOCUS_RING,
              )}
            >
              {isLoggingOutAll ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
                  <span>Logging out…</span>
                </>
              ) : (
                <>
                  <LogOut className="h-4 w-4" />
                  <span>Log Out All Devices</span>
                </>
              )}
            </button>

            {logoutAllError && (
              <div
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs sm:text-sm text-red-800 flex items-center gap-2.5"
              >
                <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
                <span>{logoutAllError.message || "Failed to log out of all devices. Please try again."}</span>
              </div>
            )}
          </div>
        )}
      </section>

      {/* CONFIRMATION MODAL: REVOKE INDIVIDUAL SESSION */}
      {sessionToRevoke && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="revoke-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 text-red-600"
                aria-hidden="true"
              >
                <AlertTriangle size={20} />
              </div>
              <h3 id="revoke-modal-title" className="text-base font-bold text-slate-900">
                {sessionToRevoke.isCurrent ? "Sign out of this device?" : "Revoke session?"}
              </h3>
            </div>

            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              {sessionToRevoke.isCurrent
                ? "This will end your current session. You will be redirected to the login page."
                : `Are you sure you want to revoke access for ${
                    [sessionToRevoke.device, sessionToRevoke.browser].filter(Boolean).join(" ") ||
                    "this device"
                  }? It will be immediately logged out.`}
            </p>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setSessionToRevoke(null)}
                disabled={isRevoking}
                className={clsx(
                  "rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 transition",
                  FOCUS_RING,
                )}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRevoke}
                disabled={isRevoking}
                className={clsx(
                  "inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-sm hover:bg-red-700 transition disabled:opacity-60",
                  FOCUS_RING,
                )}
              >
                {isRevoking ? "Revoking…" : sessionToRevoke.isCurrent ? "Sign Out" : "Revoke Session"}
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
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 text-red-600"
                aria-hidden="true"
              >
                <ShieldAlert size={20} />
              </div>
              <h3 id="logout-all-modal-title" className="text-base font-bold text-slate-900">
                Log out of all devices?
              </h3>
            </div>

            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              This will revoke all active refresh tokens and terminate sessions across every computer,
              phone, and browser. You will be signed out of this device immediately and returned to the
              login screen.
            </p>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowLogoutAllConfirm(false)}
                disabled={isLoggingOutAll}
                className={clsx(
                  "rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 transition",
                  FOCUS_RING,
                )}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmLogoutAll}
                disabled={isLoggingOutAll}
                className={clsx(
                  "inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-sm hover:bg-red-700 transition disabled:opacity-60",
                  FOCUS_RING,
                )}
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

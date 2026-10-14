import React, { useId, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  Globe,
  KeyRound,
  Laptop,
  LogOut,
  Monitor,
  RefreshCw,
  Shield,
  ShieldAlert,
  Smartphone,
  Trash2,
} from "lucide-react";
import { PasswordField } from "@/components/auth/PasswordField";
import { PasswordStrength } from "@/components/auth/PasswordStrength";
import { useAuth, useChangePassword, useLogoutAll, useSessions } from "@/features/auth";
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
  if (combined.includes("mobile") || combined.includes("phone") || combined.includes("android") || combined.includes("iphone")) {
    return Smartphone;
  }
  if (combined.includes("mac") || combined.includes("windows") || combined.includes("linux") || combined.includes("desktop")) {
    return Laptop;
  }
  return Monitor;
}

export const AccountSecurityPage: React.FC = () => {
  const { user } = useAuth();
  const formSuccessAlertId = useId();

  // --- Section A: Change Password State ---
  const { changePassword, loading: isChangingPassword, error: changePasswordError, reset: resetChangePassword } =
    useChangePassword();

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
      const e = err as { code?: string; message?: string; details?: { field: string; message: string }[] };
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
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8 space-y-8">
      {/* Header */}
      <header className="border-b border-gray-200 pb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-[#4338ca]" aria-hidden="true">
            <Shield size={24} />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Account Security</h1>
            <p className="text-xs sm:text-sm text-gray-500">
              Manage your password, review active login sessions, and protect your account.
            </p>
          </div>
        </div>
        {user?.email && (
          <p className="mt-2 text-xs text-gray-500">
            Signed in as <span className="font-medium text-gray-800">{user.email}</span> ({user.role})
          </p>
        )}
      </header>

      {/* Offline Alert */}
      {!isOnline && (
        <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs sm:text-sm text-amber-800 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
          <span>You are currently offline. Changes cannot be saved until connection is restored.</span>
        </div>
      )}

      {/* SECTION A: CHANGE PASSWORD */}
      <section aria-labelledby="change-password-heading" className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 shadow-sm">
        <div className="flex items-center gap-2.5 pb-4 border-b border-gray-100">
          <KeyRound className="h-5 w-5 text-[#4338ca]" aria-hidden="true" />
          <div>
            <h2 id="change-password-heading" className="text-base sm:text-lg font-semibold text-gray-900">
              Change Password
            </h2>
            <p className="text-xs text-gray-500">
              Verify your current password to set a new one.
            </p>
          </div>
        </div>

        {passwordSuccessMessage && (
          <div
            id={formSuccessAlertId}
            role="status"
            className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs sm:text-sm text-emerald-800 flex items-center gap-2.5 animate-fadeIn"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
            <span>{passwordSuccessMessage}</span>
          </div>
        )}

        {changePasswordError && !fieldErrors.currentPassword && (
          <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs sm:text-sm text-red-800 flex items-center gap-2.5">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
            <span>{changePasswordError.message || "Failed to update password. Please verify current password and try again."}</span>
          </div>
        )}

        <form onSubmit={handlePasswordSubmit} className="mt-5 space-y-4" noValidate>
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
                className="text-xs font-semibold text-[#4338ca] hover:text-[#3730a3] hover:underline focus:outline-none focus:ring-2 focus:ring-[#4338ca] rounded transition-colors"
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
            {newPassword && <PasswordStrength password={newPassword} className="mt-1" />}
          </div>

          {/* Password Policy Checklist */}
          <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-3 text-xs text-gray-600" aria-label="Password rules">
            <p className="font-semibold text-gray-700 mb-2">Password must include:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {PASSWORD_POLICY.map((rule) => {
                const isMet = rule.test(newPassword);
                return (
                  <div key={rule.id} className={`flex items-center gap-2 ${isMet ? "text-emerald-700 font-medium" : "text-gray-500"}`}>
                    <span
                      className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${
                        isMet ? "bg-emerald-100 text-emerald-700" : "bg-gray-200 text-gray-500"
                      }`}
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

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={isChangingPassword || !isOnline}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#4338ca] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#3730a3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4338ca] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isChangingPassword ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
                  <span>Updating password…</span>
                </>
              ) : (
                "Update Password"
              )}
            </button>
          </div>
        </form>
      </section>

      {/* SECTION B: ACTIVE SESSIONS */}
      <section aria-labelledby="active-sessions-heading" className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <Monitor className="h-5 w-5 text-[#4338ca]" aria-hidden="true" />
            <div>
              <h2 id="active-sessions-heading" className="text-base sm:text-lg font-semibold text-gray-900">
                Active Sessions
              </h2>
              <p className="text-xs text-gray-500">
                Devices currently authenticated with your account.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void refetchSessions()}
            disabled={isLoadingSessions}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#4338ca] disabled:opacity-50"
            aria-label="Refresh active sessions list"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoadingSessions ? "animate-spin" : ""}`} aria-hidden="true" />
            <span>Refresh</span>
          </button>
        </div>

        {revokeError && (
          <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs sm:text-sm text-red-800 flex items-center gap-2.5">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
            <span>{revokeError.message || "Failed to revoke session. Please try again."}</span>
          </div>
        )}

        <div className="mt-5">
          {isLoadingSessions ? (
            <div className="py-8 text-center text-gray-500 space-y-3" aria-busy="true">
              <RefreshCw className="mx-auto h-6 w-6 animate-spin text-[#4338ca]" aria-hidden="true" />
              <p className="text-xs sm:text-sm">Loading active sessions…</p>
            </div>
          ) : sessionsError ? (
            <div role="alert" className="rounded-xl border border-dashed border-gray-300 p-6 text-center space-y-3">
              <AlertTriangle className="mx-auto h-8 w-8 text-amber-500" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-gray-800">Unable to load active sessions</p>
                <p className="text-xs text-gray-500 mt-1">
                  {sessionsError.message || "Could not retrieve sessions from the server. Please check your connection."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void refetchSessions()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#4338ca] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#3730a3]"
              >
                <RefreshCw size={14} aria-hidden="true" />
                <span>Retry</span>
              </button>
            </div>
          ) : sessions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 p-6 text-center text-gray-500">
              <Globe className="mx-auto h-8 w-8 text-gray-400 mb-2" aria-hidden="true" />
              <p className="text-sm font-medium text-gray-700">No active sessions found</p>
              <p className="text-xs text-gray-400 mt-1">Only this active browser session is connected.</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200" aria-label="Active sessions list">
              {sessions.map((session) => {
                const Icon = getDeviceIcon(session.device, session.browser);
                const isCurrent = Boolean(session.isCurrent);
                const isThisRevoking = revokingId === session.id;

                const deviceName = [session.device, session.browser, session.os].filter(Boolean).join(" · ") || "Unknown device";
                const ipText = session.ipAddress ? `IP: ${session.ipAddress}` : "IP unavailable";
                const activeTime = formatDate(session.lastActiveAt);

                return (
                  <li
                    key={session.id}
                    className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 transition-colors ${
                      isCurrent ? "bg-indigo-50/40" : "bg-white hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-start gap-3.5 min-w-0">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                          isCurrent ? "bg-indigo-100 text-[#4338ca]" : "bg-gray-100 text-gray-600"
                        }`}
                        aria-hidden="true"
                      >
                        <Icon size={20} />
                      </div>

                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-sm text-gray-900 truncate">{deviceName}</span>
                          {isCurrent && (
                            <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
                              This device
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 flex flex-wrap items-center gap-x-3 gap-y-1">
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
                        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#4338ca] disabled:opacity-50 ${
                          isCurrent
                            ? "border border-amber-300 text-amber-700 hover:bg-amber-50"
                            : "border border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
                        }`}
                      >
                        {isThisRevoking ? (
                          <>
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                            <span>Revoking…</span>
                          </>
                        ) : isCurrent ? (
                          <>
                            <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Sign out</span>
                          </>
                        ) : (
                          <>
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
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
      </section>

      {/* SECTION C: LOG OUT ALL DEVICES */}
      <section aria-labelledby="logout-all-heading" className="rounded-2xl border border-red-200 bg-red-50/30 p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-red-700">
              <ShieldAlert className="h-5 w-5" aria-hidden="true" />
              <h2 id="logout-all-heading" className="text-base sm:text-lg font-semibold text-gray-900">
                Log Out of All Devices
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-gray-600 max-w-xl">
              Lost a device or noticed unfamiliar activity? Terminate all active sessions across every phone, computer, and browser immediately.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowLogoutAllConfirm(true)}
            disabled={isLoggingOutAll || !isOnline}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-red-600 bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:opacity-50"
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
        </div>

        {logoutAllError && (
          <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs sm:text-sm text-red-800 flex items-center gap-2.5">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
            <span>{logoutAllError.message || "Failed to log out of all devices. Please try again."}</span>
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
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 text-red-600" aria-hidden="true">
                <AlertTriangle size={20} />
              </div>
              <h3 id="revoke-modal-title" className="text-base font-bold text-gray-900">
                {sessionToRevoke.isCurrent ? "Sign out of this device?" : "Revoke session?"}
              </h3>
            </div>

            <p className="text-xs sm:text-sm text-gray-600">
              {sessionToRevoke.isCurrent
                ? "This will end your current session. You will be redirected to the login page."
                : `Are you sure you want to revoke access for ${[sessionToRevoke.device, sessionToRevoke.browser].filter(Boolean).join(" ") || "this device"}? It will be immediately logged out.`}
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
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 text-red-600" aria-hidden="true">
                <ShieldAlert size={20} />
              </div>
              <h3 id="logout-all-modal-title" className="text-base font-bold text-gray-900">
                Log out of all devices?
              </h3>
            </div>

            <p className="text-xs sm:text-sm text-gray-600">
              This will revoke all active refresh tokens and terminate sessions across every computer, phone, and browser.
              You will be signed out of this device immediately and returned to the login screen.
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

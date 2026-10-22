import { useId, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import { PasswordField } from '@/components/auth/PasswordField';
import { PasswordStrength } from '@/components/auth/PasswordStrength';
import { useChangePassword } from '@/features/auth';
import { PASSWORD_POLICY } from '@/pages/shared/AccountSecurity';
import './settings.css';

/** /partner/settings/security/password. Same central auth hook as the shared security page: no auth logic here. */
export default function ChangePasswordPage() {
  const successId = useId();
  const { changePassword, loading, error, reset } = useChangePassword();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState<string | null>(null);

  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  const validate = () => {
    const errors: Record<string, string> = {};
    if (!currentPassword) errors.currentPassword = 'Enter your current password';

    if (!newPassword) {
      errors.newPassword = 'Enter a new password';
    } else if (newPassword.length < 8) {
      errors.newPassword = 'Password must be at least 8 characters';
    } else if (!/[A-Z]/.test(newPassword)) {
      errors.newPassword = 'Password needs an uppercase letter';
    } else if (!/[0-9]/.test(newPassword)) {
      errors.newPassword = 'Password needs a number';
    } else if (!/[^A-Za-z0-9]/.test(newPassword)) {
      errors.newPassword = 'Password needs a special character';
    } else if (currentPassword && newPassword === currentPassword) {
      errors.newPassword = 'New password must be different from your current password';
    }

    if (!confirmPassword) errors.confirmPassword = 'Confirm your new password';
    else if (newPassword && confirmPassword !== newPassword) errors.confirmPassword = 'Passwords do not match';

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSuccess(null);
    reset();
    if (!validate() || loading) return;

    try {
      await changePassword({ currentPassword, newPassword, confirmPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setFieldErrors({});
      setSuccess('Your password has been changed successfully.');
    } catch (err: unknown) {
      const e2 = err as { code?: string; details?: { field: string; message: string }[] };
      const next: Record<string, string> = {};
      if (e2.code === 'INVALID_CURRENT_PASSWORD') next.currentPassword = 'Current password is incorrect';
      if (Array.isArray(e2.details)) {
        for (const d of e2.details) if (d.field) next[d.field] = d.message;
      }
      setFieldErrors(next);
    }
  };

  return (
    <div className="ps-root">
      <div className="ps-narrow">
        <p className="ps-lead">Enter your current password, then choose a new one.</p>

        {!isOnline ? (
          <div role="status" className="ps-alert is-warn">
            <AlertTriangle size={18} aria-hidden="true" />
            <span>You are offline. Changes cannot be saved until your connection is back.</span>
          </div>
        ) : null}

        {success ? (
          <div id={successId} role="status" className="ps-alert is-ok">
            <CheckCircle2 size={18} aria-hidden="true" />
            <span>{success}</span>
          </div>
        ) : null}

        {error && !fieldErrors.currentPassword ? (
          <div role="alert" className="ps-alert is-error">
            <AlertTriangle size={18} aria-hidden="true" />
            <span>{error.message || 'Failed to update password. Please check your current password and try again.'}</span>
          </div>
        ) : null}

        <form className="ps-form" onSubmit={(e) => void handleSubmit(e)} noValidate>
          <PasswordField
            id="current-password"
            name="currentPassword"
            label="Current Password"
            value={currentPassword}
            onChange={(e) => {
              setCurrentPassword(e.target.value);
              if (fieldErrors.currentPassword) setFieldErrors((p) => ({ ...p, currentPassword: '' }));
            }}
            rightAction={
              <Link to="/forgot-password" className="text-xs font-semibold text-[#4338ca] hover:underline">
                Forgot password?
              </Link>
            }
            error={fieldErrors.currentPassword}
            required
            autoComplete="current-password"
            placeholder="Enter current password"
            disabled={loading || !isOnline}
          />

          <div>
            <PasswordField
              id="new-password"
              name="newPassword"
              label="New Password"
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value);
                if (fieldErrors.newPassword) setFieldErrors((p) => ({ ...p, newPassword: '' }));
              }}
              error={fieldErrors.newPassword}
              required
              autoComplete="new-password"
              placeholder="Enter new strong password"
              disabled={loading || !isOnline}
            />
            {newPassword ? <PasswordStrength password={newPassword} className="mt-1" /> : null}
          </div>

          <div className="ps-policy" aria-label="Password rules">
            <p className="ps-policy-title">Password must include:</p>
            <ul className="ps-policy-list">
              {PASSWORD_POLICY.map((rule) => {
                const met = rule.test(newPassword);
                return (
                  <li key={rule.id} className={met ? 'is-met' : ''}>
                    <span aria-hidden="true">{met ? '\u2713' : '\u2022'}</span>
                    <span>
                      {rule.label}
                      <span className="sr-only">{met ? ' (met)' : ' (not met)'}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          <PasswordField
            id="confirm-password"
            name="confirmPassword"
            label="Confirm New Password"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              if (fieldErrors.confirmPassword) setFieldErrors((p) => ({ ...p, confirmPassword: '' }));
            }}
            error={fieldErrors.confirmPassword}
            required
            autoComplete="new-password"
            placeholder="Confirm new password"
            disabled={loading || !isOnline}
          />

          <div className="ps-form-actions">
            <button type="submit" className="ps-btn ps-btn-primary" disabled={loading || !isOnline}>
              {loading ? (
                <>
                  <RefreshCw size={16} className="ps-spin" aria-hidden="true" />
                  <span>Updating password...</span>
                </>
              ) : (
                'Update password'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
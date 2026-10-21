import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, ArrowRight, WifiOff } from 'lucide-react';
import { acceptInvite, verifyInvite, type InviteInfo } from '@/services/inviteApi';
import { classifyApiError } from '@/lib/apiError';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import PasswordField from '@/components/auth/PasswordField';
import PasswordStrength from '@/components/auth/PasswordStrength';
import AuthFormHeader from '@/components/auth/AuthFormHeader';

type Stage = 'checking' | 'invalid' | 'form';

const BTN =
  'w-full bg-gradient-to-r from-brand-500 to-brand-600 text-white font-medium py-2.5 rounded-lg hover:shadow-lg hover:shadow-brand-500/30 transition-all duration-200 flex items-center justify-center gap-2 text-sm';

/**
 * /accept-invite?token=...
 * Invite email -> this page (set password) -> /login with the email filled in.
 */
export const AcceptInvitePage: React.FC = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const isOnline = useOnlineStatus();
  const token = (params.get('token') ?? '').trim();

  const [stage, setStage] = useState<Stage>(token ? 'checking' : 'invalid');
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [invalidReason, setInvalidReason] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ password?: string; confirm?: string }>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = 'Accept invitation | HomeCareX';
  }, []);

  // Step 1: check the link before showing the form, so a used or expired link fails early.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    verifyInvite(token)
      .then((info) => {
        if (cancelled) return;
        setInvite(info);
        setStage('form');
      })
      .catch((err) => {
        if (cancelled) return;
        const c = classifyApiError(err);
        setInvalidReason(
          c.kind === 'network' || c.kind === 'offline' || c.kind === 'timeout'
            ? 'We couldn’t reach the server. Check your connection and reload this page.'
            : c.message || '',
        );
        setStage('invalid');
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  function validate(): boolean {
    const next: { password?: string; confirm?: string } = {};
    if (!password) next.password = 'Password is required.';
    else if (password.length < 8) next.password = 'Password must be at least 8 characters.';
    else if (!/[A-Z]/.test(password)) next.password = 'Password requires at least one uppercase letter.';
    else if (!/[0-9]/.test(password)) next.password = 'Password requires at least one number.';
    else if (!/[^A-Za-z0-9]/.test(password)) next.password = 'Password requires at least one special character.';

    if (!confirm) next.confirm = 'Please confirm your password.';
    else if (password !== confirm) next.confirm = 'Passwords do not match.';

    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  // Step 2: set the password, then hand over to the login page.
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    if (!isOnline) {
      setError("You're offline. Check your internet connection and try again.");
      return;
    }
    setError('');
    if (!validate()) return;

    setLoading(true);
    try {
      const result = await acceptInvite(token, password);
      navigate('/login', {
        replace: true,
        state: {
          registeredEmail: result.email,
          registeredMessage: 'Your account is ready. Log in with the password you just set.',
        },
      });
    } catch (err) {
      const c = classifyApiError(err);
      if (c.code === 'INVALID_INVITE_TOKEN') {
        setInvalidReason(c.message || '');
        setStage('invalid');
      } else if (c.status === 429) {
        setError('Too many requests. Please wait a moment and try again.');
      } else if (c.status && c.status >= 500) {
        setError('A server error occurred. Please try again shortly.');
      } else {
        setError(c.message || 'Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  if (stage === 'checking') {
    return (
      <div className="w-full text-center py-8" role="status" aria-live="polite">
        <span className="inline-block h-6 w-6 border-2 border-gray-300 border-t-brand-600 rounded-full animate-spin" />
        <p className="mt-3 text-sm text-gray-500">Checking your invitation…</p>
      </div>
    );
  }

  if (stage === 'invalid') {
    return (
      <div className="w-full text-center py-2 animate-fadeUp">
        <AuthFormHeader
          title="Invitation link not valid"
          subtitle={
            invalidReason ||
            'This invitation link is missing, already used, or has expired. Ask an admin to send you a new invite.'
          }
        />
        <Link to="/login" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 font-medium">
          <ArrowLeft size={16} />
          Back to Login
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full">
      {!isOnline && (
        <div role="status" className="mb-4 text-xs sm:text-sm rounded-lg p-3 flex items-start gap-2.5 bg-amber-50 border border-amber-200 text-amber-800">
          <WifiOff size={17} className="shrink-0 mt-0.5 text-amber-600" aria-hidden="true" />
          <span className="leading-snug">You&apos;re offline. Check your internet connection and try again.</span>
        </div>
      )}

      <AuthFormHeader
        title={`Welcome${invite?.name ? `, ${invite.name.split(' ')[0]}` : ''}`}
        subtitle={
          <>
            Set a password for <strong>{invite?.email}</strong> to activate your admin account.
          </>
        }
      />

      {error && (
        <div role="alert" className="mb-4 text-xs sm:text-sm rounded-lg p-3 flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-700">
          <AlertCircle size={17} className="shrink-0 mt-0.5 text-red-500" aria-hidden="true" />
          <span className="leading-snug">{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <PasswordField
            id="invite-password"
            name="password"
            label="Password"
            required
            autoComplete="new-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (fieldErrors.password) setFieldErrors((p) => ({ ...p, password: undefined }));
              if (error) setError('');
            }}
            error={fieldErrors.password}
            disabled={loading || !isOnline}
          />
          <PasswordStrength password={password} />
        </div>

        <PasswordField
          id="invite-confirm-password"
          name="confirmPassword"
          label="Confirm Password"
          required
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => {
            setConfirm(e.target.value);
            if (fieldErrors.confirm) setFieldErrors((p) => ({ ...p, confirm: undefined }));
            if (error) setError('');
          }}
          error={fieldErrors.confirm}
          disabled={loading || !isOnline}
        />

        <button type="submit" disabled={loading || !isOnline} className={`${BTN} disabled:opacity-60 disabled:cursor-not-allowed`}>
          {loading ? (
            <>
              <span className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              <span>Activating account...</span>
            </>
          ) : (
            <>
              <span>Set password &amp; continue</span>
              <ArrowRight size={16} />
            </>
          )}
        </button>
      </form>
    </div>
  );
};

export default AcceptInvitePage;

import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, ArrowRight, ArrowLeft, ShieldCheck, AlertCircle, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { classifyApiError } from '@/lib/apiError';
import { ADMIN_ROLES, type AuthUser } from '@/types/auth';
import { ROUTES } from '@/constants/routes';
import AuthFormHeader from '@/components/auth/AuthFormHeader';

/** Only same-origin paths are allowed as returnUrl (blocks //evil.com, https://..., javascript:). */
function safeReturnUrl(raw: string | null): string | null {
  if (!raw) return null;
  return raw.startsWith('/') && !raw.startsWith('//') && !raw.startsWith('/\\') ? raw : null;
}

/** A returnUrl is only honoured when it belongs to the role's own area. */
function destinationFor(user: AuthUser, returnUrl: string | null): string {
  const area = ADMIN_ROLES.includes(user.role) ? '/admin' : `/${user.role}`;
  if (returnUrl && (returnUrl === area || returnUrl.startsWith(`${area}/`))) return returnUrl;
  return user.home || area;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[6-9]\d{9}$/;

const REMEMBERED_ID_KEY = 'homecarex_remembered_identifier';

function getSavedIdentifier(): string {
  try {
    // Proactively purge any legacy insecure password storage
    localStorage.removeItem('homecarex_remembered_credentials');
    return localStorage.getItem(REMEMBERED_ID_KEY) || '';
  } catch {
    return '';
  }
}

function saveIdentifier(identifier: string) {
  try {
    localStorage.setItem(REMEMBERED_ID_KEY, identifier);
    localStorage.removeItem('homecarex_remembered_credentials');
  } catch {
    // Ignore storage write errors in restricted contexts
  }
}

function clearIdentifier() {
  try {
    localStorage.removeItem(REMEMBERED_ID_KEY);
    localStorage.removeItem('homecarex_remembered_credentials');
  } catch {
    // Ignore storage errors
  }
}

export const LoginPage: React.FC = () => {
  const { login, logout, user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const returnUrl = safeReturnUrl(params.get('returnUrl'));

  // Remember-me restores identifier (email/phone) only. Passwords are never stored in browser storage.
  const [initialId] = useState<string>(() => getSavedIdentifier());
  const [identifier, setIdentifier] = useState(initialId);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(Boolean(initialId));
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState(params.get('expired') ? 'Your session has expired. Please log in again.' : '');
  const [successMessage] = useState(() => {
    const stateMsg = (location.state as { registeredMessage?: string } | null)?.registeredMessage;
    if (stateMsg) return stateMsg;
    if (params.get('registered') === 'partner') {
      return 'Registration submitted! You can log in after an admin approves your documents. We will email you.';
    }
    if (params.get('reset') === 'success' || (location.state as { resetSuccess?: boolean } | null)?.resetSuccess) {
      return 'Password reset successful. Please log in with your new password.';
    }
    return '';
  });
  const [fieldErrors, setFieldErrors] = useState<{ identifier?: string; password?: string }>({});
  const [loading, setLoading] = useState(false);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);

  useEffect(() => {
    document.title = 'Log in | HomeCareX';
  }, []);

  // Autofill credentials when unauthenticated or after logging out
  useEffect(() => {
    if (!isAuthenticated) {
      const stateEmail = (location.state as { registeredEmail?: string } | null)?.registeredEmail;
      if (stateEmail) {
        setIdentifier(stateEmail);
        return;
      }
      const savedId = getSavedIdentifier();
      if (savedId) {
        setIdentifier(savedId);
        setRememberMe(true);
      }
    }
  }, [isAuthenticated, location.state]);

  // Auto-redirect to dashboard if already authenticated
  useEffect(() => {
    if (isAuthenticated && user && !loading) {
      navigate(destinationFor(user, returnUrl), { replace: true });
    }
  }, [isAuthenticated, user, loading, returnUrl, navigate]);

  // Already signed in fallback state
  if (isAuthenticated && user && !loading) {
    return (
      <div className="w-full text-center">
        <AuthFormHeader
          title="Already signed in"
          subtitle={
            <>
              Signed in as <b className="text-gray-900">{user.name}</b>
              {user.email ? ` (${user.email})` : ''} &middot; role: <b className="capitalize text-gray-900">{user.role}</b>
            </>
          }
        />
        <div className="flex flex-col gap-3 mt-6">
          <Link
            to={destinationFor(user, returnUrl)}
            className="w-full text-center rounded-lg bg-[#ff8a3d] hover:bg-[#e0600f] text-white font-medium py-2.5 shadow-sm hover:shadow-md hover:shadow-[#ff8a3d]/25 transition"
          >
            Continue to my dashboard
          </Link>
          <button
            type="button"
            onClick={() => void logout()}
            className="w-full rounded-lg border border-gray-300 py-2.5 font-medium text-gray-700 hover:bg-gray-50 transition"
          >
            Log out and use another account
          </button>
        </div>
      </div>
    );
  }

  function validate(): boolean {
    const nextErrors: { identifier?: string; password?: string } = {};
    const trimmed = identifier.trim();

    if (!trimmed) {
      nextErrors.identifier = 'Please enter your email or mobile number.';
    } else {
      const isCleanPhone = trimmed.replace(/[\s()-]/g, '').replace(/^(\+91|91)/, '');
      const isEmail = EMAIL_RE.test(trimmed);
      const isPhone = PHONE_RE.test(isCleanPhone);
      if (!isEmail && !isPhone) {
        nextErrors.identifier = 'Please enter a valid email or 10-digit mobile number.';
      }
    }

    if (!password) {
      nextErrors.password = 'Password is required.';
    }

    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError('');
    setErrorStatus(null);

    if (!termsAccepted) {
      setError('Please accept the Terms & Conditions and Privacy Policy to continue.');
      return;
    }

    if (!validate()) {
      return;
    }

    setLoading(true);
    try {
      const trimmed = identifier.trim();
      const signedIn = await login({ email: trimmed, password });
      if (rememberMe) {
        saveIdentifier(trimmed);
      } else {
        clearIdentifier();
      }
      navigate(destinationFor(signedIn, returnUrl), { replace: true });
    } catch (err) {
      const classified = classifyApiError(err);
      setErrorStatus(classified.status ?? null);

      if (classified.kind === 'offline') {
        setError('Unable to reach the server. Please check your internet connection.');
      } else if (classified.kind === 'network') {
        setError('Unable to reach the server. Please check your connection and try again.');
      } else if (classified.kind === 'timeout') {
        setError('The server is taking too long to respond. Please check your connection and try again.');
      } else if (classified.status === 423) {
        setError('Your account is temporarily locked due to multiple failed login attempts. Please try again in 15 minutes.');
      } else if (classified.status === 429) {
        setError('Too many login attempts. Please wait a moment and try again.');
      } else if (classified.status === 401) {
        setError('Invalid email or password. Please try again.');
      } else if (classified.status && classified.status >= 500) {
        setError('A server error occurred. Please try again shortly.');
      } else {
        setError(classified.message || 'Login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-[440px] sm:max-w-[460px] lg:max-w-[480px] bg-white/95 sm:bg-white/85 backdrop-blur-xl rounded-2xl sm:rounded-3xl shadow-xl sm:shadow-2xl shadow-slate-900/10 border border-white/80 ring-1 ring-black/[0.03] p-4 sm:p-7 md:p-8 relative transition-all">
      {/* Top Navigation */}
      <div className="flex items-center justify-between gap-2 mb-3 pb-2.5 border-b border-gray-200/70 shrink-0">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-blue-600 hover:bg-slate-100/80 px-2.5 py-1 -ml-1 rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-blue-200 shrink-0 whitespace-nowrap"
          aria-label="Back to Home"
        >
          <ArrowLeft size={15} className="shrink-0 text-slate-500" aria-hidden="true" />
          <span>Back to Home</span>
        </Link>
        <span className="inline-flex items-center gap-1.5 text-[11px] sm:text-xs font-semibold text-blue-700 bg-blue-50/90 border border-blue-200/80 px-2.5 py-1 rounded-full shrink-0 shadow-2xs whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Secure Login
        </span>
      </div>

      {/* Centered Logo in Card */}
      <div className="flex justify-center mb-1.5">
        <img
          src="/logo.webp"
          alt="HomeCareX"
          className="h-7 sm:h-8 w-auto object-contain"
        />
      </div>

      <div className="text-center mb-4">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
          Welcome Back <span role="img" aria-label="wave">👋</span>
        </h2>
        <p className="mt-0.5 text-xs text-slate-500 font-medium">
          Sign in to manage your home care and book services.
        </p>
      </div>

      {successMessage && !error && (
        <div
          role="status"
          className="mb-3 text-xs rounded-xl p-2.5 flex items-start gap-2 bg-green-50 border border-green-200 text-green-800 animate-fadeUp"
        >
          <ShieldCheck size={15} className="shrink-0 mt-0.5 text-green-600" aria-hidden="true" />
          <span className="leading-snug">{successMessage}</span>
        </div>
      )}

      {error && (
        <div
          role="alert"
          id="login-error"
          className={`mb-3 text-xs rounded-xl p-2.5 flex items-start gap-2 animate-fadeUp ${
            errorStatus === 423 || errorStatus === 429
              ? 'bg-amber-50 border border-amber-200 text-amber-800'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}
        >
          {errorStatus === 423 || errorStatus === 429 ? (
            <AlertTriangle size={15} className="shrink-0 mt-0.5 text-amber-600" aria-hidden="true" />
          ) : (
            <AlertCircle size={15} className="shrink-0 mt-0.5 text-red-500" aria-hidden="true" />
          )}
          <span className="leading-snug">{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3" noValidate aria-describedby={error ? 'login-error' : undefined}>
        {/* Email or Phone */}
        <div className="group">
          <label htmlFor="login-identifier" className="block text-xs font-semibold text-slate-700 mb-1">
            Email or Phone Number <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors pointer-events-none">
              <Mail size={16} aria-hidden="true" />
            </div>
            <input
              id="login-identifier"
              type="text"
              name="identifier"
              autoComplete="username"
              autoFocus
              value={identifier}
              onChange={(e) => {
                setIdentifier(e.target.value);
                if (fieldErrors.identifier) setFieldErrors((prev) => ({ ...prev, identifier: undefined }));
              }}
              placeholder="Enter your email or phone number"
              aria-invalid={Boolean(fieldErrors.identifier)}
              aria-describedby={fieldErrors.identifier ? 'identifier-error' : undefined}
              className={`w-full rounded-xl border bg-white pl-10 pr-3.5 py-2 sm:py-2.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 hover:border-slate-300 ${
                fieldErrors.identifier ? 'border-red-400 focus:ring-red-100 focus:border-red-500' : 'border-slate-200'
              }`}
            />
          </div>
          {fieldErrors.identifier && (
            <p id="identifier-error" role="alert" className="mt-1 text-xs text-red-600 font-medium">
              {fieldErrors.identifier}
            </p>
          )}
        </div>

        {/* Password */}
        <div className="group">
          <label htmlFor="login-password" className="block text-xs font-semibold text-slate-700 mb-1">
            Password <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors pointer-events-none">
              <Lock size={16} aria-hidden="true" />
            </div>
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }));
              }}
              placeholder="Enter your password"
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby={fieldErrors.password ? 'password-error' : undefined}
              className={`w-full rounded-xl border bg-white pl-10 pr-10 py-2 sm:py-2.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 hover:border-slate-300 ${
                fieldErrors.password ? 'border-red-400 focus:ring-red-100 focus:border-red-500' : 'border-slate-200'
              }`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {fieldErrors.password && (
            <p id="password-error" role="alert" className="mt-1 text-xs text-red-600 font-medium">
              {fieldErrors.password}
            </p>
          )}
        </div>

        {/* Remember me & Forgot Password */}
        <div className="flex items-center justify-between pt-0.5">
          <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-600 select-none">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-100 cursor-pointer"
            />
            <span>Remember me</span>
          </label>
          <Link
            to="/forgot-password"
            className="text-xs text-blue-600 hover:text-blue-700 font-bold hover:underline"
          >
            Forgot Password?
          </Link>
        </div>

        {/* Terms & Conditions Consent */}
        <div className="flex items-start gap-2 pt-0.5">
          <input
            id="login-consent"
            type="checkbox"
            checked={termsAccepted}
            onChange={(e) => {
              setTermsAccepted(e.target.checked);
              if (e.target.checked && error === 'Please accept the Terms & Conditions and Privacy Policy to continue.') {
                setError('');
              }
            }}
            className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-100 cursor-pointer"
            aria-describedby="login-consent-label"
          />
          <label
            htmlFor="login-consent"
            id="login-consent-label"
            className="text-xs text-slate-500 leading-snug cursor-pointer select-none"
          >
            I agree to the{' '}
            <Link
              to={ROUTES.TERMS}
              onClick={(e) => e.stopPropagation()}
              className="text-blue-600 font-semibold hover:underline"
            >
              Terms &amp; Conditions
            </Link>{' '}
            and{' '}
            <Link
              to={ROUTES.PRIVACY}
              onClick={(e) => e.stopPropagation()}
              className="text-blue-600 font-semibold hover:underline"
            >
              Privacy Policy
            </Link>.
          </label>
        </div>

        {/* Submit CTA - Vibrant Orange Button matching mockup */}
        <button
          type="submit"
          disabled={loading || !termsAccepted}
          className="w-full bg-[#f97316] hover:bg-[#ea580c] active:scale-[0.99] text-white font-bold py-2.5 sm:py-3 rounded-xl shadow-md shadow-orange-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
          aria-label={!termsAccepted ? 'Sign In (accept terms to enable)' : 'Sign In'}
        >
          {loading ? (
            <>
              <span className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" aria-hidden="true" />
              <span>Signing in...</span>
            </>
          ) : (
            <>
              <span>Sign In</span>
              <ArrowRight size={16} aria-hidden="true" />
            </>
          )}
        </button>
      </form>

      {/* Bottom link: Don't have an account? Create an Account */}
      <div className="relative my-3 sm:my-3.5 flex items-center justify-center">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200" /></div>
        <span className="relative bg-white px-3 text-xs text-slate-500">
          Don&apos;t have an account?{' '}
          <Link to="/register" className="font-bold text-blue-600 hover:underline">
            Create an Account
          </Link>
        </span>
      </div>

      {/* Partner Registration link */}
      <div className="pt-2.5 border-t border-slate-100 text-center">
        <p className="text-xs text-slate-500">
          Are you a service professional?{' '}
          <Link
            to="/register/partner"
            className="font-bold text-orange-600 hover:text-orange-700 hover:underline"
          >
            Join as Partner &rarr;
          </Link>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
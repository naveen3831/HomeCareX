import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, Mail, Phone, Lock, Eye, EyeOff, Tag, ArrowRight, ArrowLeft, AlertCircle, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { classifyApiError } from '@/lib/apiError';
import { ROUTES } from '@/constants/routes';
import PasswordStrength from '@/components/auth/PasswordStrength';
import AuthFormHeader from '@/components/auth/AuthFormHeader';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[6-9]\d{9}$/;

export const RegisterPage: React.FC = () => {
  const { register, user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    referralCode: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = 'Create Account | HomeCareX';
  }, []);

  // If already authenticated
  if (isAuthenticated && user && !loading) {
    return (
      <div className="w-full text-center">
        <AuthFormHeader
          title="Account already active"
          subtitle={
            <>
              You are already signed in as <b className="text-gray-900">{user.name}</b> ({user.role}).
            </>
          }
        />
        <div className="mt-6">
          <Link
            to={user.home || (user.role === 'admin' ? '/admin' : `/${user.role}`)}
            className="w-full text-center block rounded-lg bg-[#ff8a3d] hover:bg-[#e0600f] text-white font-medium py-2.5 shadow-sm transition"
          >
            Go to my dashboard
          </Link>
        </div>
      </div>
    );
  }

  function normalizePhone(raw: string): string {
    const cleaned = raw.replace(/[\s()-]/g, '');
    if (cleaned.startsWith('+91')) return cleaned.slice(3);
    if (cleaned.startsWith('91') && cleaned.length === 12) return cleaned.slice(2);
    return cleaned;
  }

  function validate(): boolean {
    const nextErrors: Record<string, string> = {};

    if (!form.name.trim()) {
      nextErrors.name = 'Full name is required.';
    } else if (form.name.trim().length < 2) {
      nextErrors.name = 'Name must be at least 2 characters.';
    }

    if (!form.email.trim()) {
      nextErrors.email = 'Email address is required.';
    } else if (!EMAIL_RE.test(form.email.trim())) {
      nextErrors.email = 'Please enter a valid email address.';
    }

    const cleanedPhone = normalizePhone(form.phone);
    if (!form.phone.trim()) {
      nextErrors.phone = 'Phone number is required.';
    } else if (!PHONE_RE.test(cleanedPhone)) {
      nextErrors.phone = 'Please enter a valid 10-digit Indian mobile number.';
    }

    if (!form.password) {
      nextErrors.password = 'Password is required.';
    } else if (form.password.length < 8) {
      nextErrors.password = 'Password must be at least 8 characters.';
    } else if (!/[A-Z]/.test(form.password)) {
      nextErrors.password = 'Password requires at least one uppercase letter.';
    } else if (!/[0-9]/.test(form.password)) {
      nextErrors.password = 'Password requires at least one number.';
    } else if (!/[^A-Za-z0-9]/.test(form.password)) {
      nextErrors.password = 'Password requires at least one special character.';
    }

    if (!form.confirmPassword) {
      nextErrors.confirmPassword = 'Please confirm your password.';
    } else if (form.password !== form.confirmPassword) {
      nextErrors.confirmPassword = 'Passwords do not match.';
    }

    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function handleChange(field: string, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const copy = { ...prev };
        delete copy[field];
        return copy;
      });
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError('');
    setErrorStatus(null);

    if (!termsAccepted) {
      setError('Please accept the Terms & Conditions and Privacy Policy to create an account.');
      return;
    }

    if (!validate()) {
      return;
    }

    setLoading(true);
    try {
      const cleanedPhone = normalizePhone(form.phone);

      const newUser = await register({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: cleanedPhone,
        password: form.password,
        confirmPassword: form.confirmPassword,
        referralCode: form.referralCode.trim() || undefined,
        role: 'customer',
      });

      const landingPath = newUser.home || (newUser.role === 'admin' ? '/admin' : `/${newUser.role}`);
      navigate(landingPath, { replace: true });
    } catch (err) {
      const classified = classifyApiError(err);
      setErrorStatus(classified.status ?? null);

      if (classified.kind === 'offline') {
        setError('Unable to connect to the server. Please check your internet connection.');
      } else if (classified.kind === 'network') {
        setError('Unable to connect to the server. Please check your connection and try again.');
      } else if (classified.kind === 'timeout') {
        setError('The server is taking too long to respond. Please check your connection and try again.');
      } else if (classified.status === 409) {
        setError('An account with this email or mobile number already exists. Please sign in instead.');
      } else if (classified.status === 429) {
        setError('Too many registration attempts. Please wait a moment and try again.');
      } else if (classified.status && classified.status >= 500) {
        setError('A server error occurred. Please try again shortly.');
      } else {
        setError(classified.message || 'Registration failed. Please check your details and try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full sm:max-w-[560px] lg:max-w-[580px] bg-white sm:bg-white/85 sm:backdrop-blur-xl rounded-none sm:rounded-3xl shadow-none sm:shadow-2xl sm:shadow-slate-900/10 border-0 sm:border sm:border-white/80 ring-0 sm:ring-1 sm:ring-black/[0.03] px-4 py-4 sm:p-5 lg:p-5 pb-8 sm:pb-5 relative transition-all min-h-[100dvh] sm:min-h-0 flex flex-col justify-between sm:block sm:max-h-[calc(100vh-2rem)] overflow-y-visible sm:overflow-y-auto no-scrollbar">
      <div>
        {/* Top Navigation */}
        <div className="flex items-center justify-between gap-2 mb-2 sm:mb-2 pb-2 sm:pb-2 border-b border-slate-100/90 shrink-0">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-blue-600 hover:bg-slate-50 px-2 py-1 -ml-1 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/30 shrink-0 whitespace-nowrap"
            aria-label="Back to Home"
          >
            <ArrowLeft size={16} className="shrink-0 text-slate-400" aria-hidden="true" />
            <span>Back to Home</span>
          </Link>
          <span className="inline-flex items-center gap-1.5 text-[11px] sm:text-xs font-bold text-blue-700 bg-blue-50/90 border border-blue-200/80 px-2.5 py-1 rounded-full shrink-0 shadow-2xs whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
            Customer Registration
          </span>
        </div>

        {/* Centered Logo in Card */}
        <div className="flex justify-center mb-1">
          <img
            src="/logo.webp"
            alt="HomeCareX"
            className="h-7 sm:h-7.5 w-auto object-contain"
          />
        </div>

        <div className="text-center mb-2.5 sm:mb-2">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Create Your <span className="text-blue-600">HomeCareX</span> Account
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 font-medium">
            Join HomeCareX to book trusted home services.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            id="register-error"
            className={`mb-2.5 text-xs rounded-xl p-2.5 flex items-start gap-2 animate-fadeUp ${
              errorStatus === 409 || errorStatus === 429
                ? 'bg-amber-50 border border-amber-200 text-amber-800'
                : 'bg-red-50 border border-red-200 text-red-700'
            }`}
          >
            {errorStatus === 409 || errorStatus === 429 ? (
              <AlertTriangle size={15} className="shrink-0 mt-0.5 text-amber-600" aria-hidden="true" />
            ) : (
              <AlertCircle size={15} className="shrink-0 mt-0.5 text-red-500" aria-hidden="true" />
            )}
            <span className="leading-snug">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-2" noValidate aria-describedby={error ? 'register-error' : undefined}>
          {/* Full Name */}
          <div className="group">
            <label htmlFor="register-name" className="block text-xs font-semibold text-slate-700 mb-1">
              Full Name <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors pointer-events-none">
                <User size={16} aria-hidden="true" />
              </div>
              <input
                id="register-name"
                type="text"
                name="name"
                autoComplete="name"
                value={form.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="Enter your full name"
                aria-invalid={Boolean(fieldErrors.name)}
                aria-describedby={fieldErrors.name ? 'name-error' : undefined}
                className={`w-full h-11 sm:h-10 rounded-xl border bg-slate-50/60 hover:bg-white pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 transition-all focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-600 hover:border-slate-300 ${
                  fieldErrors.name ? 'border-red-400 bg-red-50/20' : 'border-slate-200/90'
                }`}
              />
            </div>
            {fieldErrors.name && (
              <p id="name-error" role="alert" className="mt-1 text-xs text-red-600 font-medium">
                {fieldErrors.name}
              </p>
            )}
          </div>

          {/* Email & Phone */}
          <div className="space-y-3 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-2.5">
            {/* Email */}
            <div className="group">
              <label htmlFor="register-email" className="block text-xs font-semibold text-slate-700 mb-1 truncate">
                Email Address <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors pointer-events-none">
                  <Mail size={16} aria-hidden="true" />
                </div>
                <input
                  id="register-email"
                  type="email"
                  name="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  placeholder="Email address"
                  aria-invalid={Boolean(fieldErrors.email)}
                  aria-describedby={fieldErrors.email ? 'email-error' : undefined}
                  className={`w-full h-11 sm:h-10 rounded-xl border bg-slate-50/60 hover:bg-white pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 transition-all focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-600 hover:border-slate-300 ${
                    fieldErrors.email ? 'border-red-400 bg-red-50/20' : 'border-slate-200/90'
                  }`}
                />
              </div>
              {fieldErrors.email && (
                <p id="email-error" role="alert" className="mt-1 text-xs text-red-600 font-medium truncate">
                  {fieldErrors.email}
                </p>
              )}
            </div>

            {/* Phone */}
            <div className="group">
              <label htmlFor="register-phone" className="block text-xs font-semibold text-slate-700 mb-1 truncate">
                Phone Number <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors pointer-events-none">
                  <Phone size={16} aria-hidden="true" />
                </div>
                <input
                  id="register-phone"
                  type="tel"
                  name="phone"
                  autoComplete="tel"
                  maxLength={10}
                  value={form.phone}
                  onChange={(e) => handleChange('phone', e.target.value.replace(/\D/g, ''))}
                  placeholder="10-digit number"
                  aria-invalid={Boolean(fieldErrors.phone)}
                  aria-describedby={fieldErrors.phone ? 'phone-error' : undefined}
                  className={`w-full h-11 sm:h-10 rounded-xl border bg-slate-50/60 hover:bg-white pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 transition-all focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-600 hover:border-slate-300 ${
                    fieldErrors.phone ? 'border-red-400 bg-red-50/20' : 'border-slate-200/90'
                  }`}
                />
              </div>
              {fieldErrors.phone && (
                <p id="phone-error" role="alert" className="mt-1 text-xs text-red-600 font-medium truncate">
                  {fieldErrors.phone}
                </p>
              )}
            </div>
          </div>

          {/* Password & Confirm Password */}
          <div className="space-y-3 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-2.5">
            {/* Password */}
            <div className="group">
              <label htmlFor="register-password" className="block text-xs font-semibold text-slate-700 mb-1 truncate">
                Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors pointer-events-none">
                  <Lock size={16} aria-hidden="true" />
                </div>
                <input
                  id="register-password"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(e) => handleChange('password', e.target.value)}
                  placeholder="Password"
                  aria-invalid={Boolean(fieldErrors.password)}
                  aria-describedby={fieldErrors.password ? 'password-error' : undefined}
                  className={`w-full h-11 sm:h-10 rounded-xl border bg-slate-50/60 hover:bg-white pl-10 pr-10 text-sm text-slate-900 placeholder:text-slate-400 transition-all focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-600 hover:border-slate-300 ${
                    fieldErrors.password ? 'border-red-400 bg-red-50/20' : 'border-slate-200/90'
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
                <p id="password-error" role="alert" className="mt-1 text-xs text-red-600 font-medium truncate">
                  {fieldErrors.password}
                </p>
              )}
              <PasswordStrength password={form.password} />
            </div>

            {/* Confirm Password */}
            <div className="group">
              <label htmlFor="register-confirm-password" className="block text-xs font-semibold text-slate-700 mb-1 truncate">
                Confirm Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors pointer-events-none">
                  <Lock size={16} aria-hidden="true" />
                </div>
                <input
                  id="register-confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  autoComplete="new-password"
                  value={form.confirmPassword}
                  onChange={(e) => handleChange('confirmPassword', e.target.value)}
                  placeholder="Confirm password"
                  aria-invalid={Boolean(fieldErrors.confirmPassword)}
                  aria-describedby={fieldErrors.confirmPassword ? 'confirm-password-error' : undefined}
                  className={`w-full h-11 sm:h-10 rounded-xl border bg-slate-50/60 hover:bg-white pl-10 pr-10 text-sm text-slate-900 placeholder:text-slate-400 transition-all focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-600 hover:border-slate-300 ${
                    fieldErrors.confirmPassword ? 'border-red-400 bg-red-50/20' : 'border-slate-200/90'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {fieldErrors.confirmPassword && (
                <p id="confirm-password-error" role="alert" className="mt-1 text-xs text-red-600 font-medium truncate">
                  {fieldErrors.confirmPassword}
                </p>
              )}
            </div>
          </div>

          {/* Referral Code (Optional) */}
          <div className="group">
            <label htmlFor="register-referral" className="block text-xs font-semibold text-slate-700 mb-1">
              Referral Code <span className="text-slate-400 text-xs font-normal">(Optional)</span>
            </label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors pointer-events-none">
                <Tag size={16} aria-hidden="true" />
              </div>
              <input
                id="register-referral"
                type="text"
                name="referralCode"
                value={form.referralCode}
                onChange={(e) => handleChange('referralCode', e.target.value.toUpperCase())}
                placeholder="e.g. CAREX2026"
                className="w-full h-11 sm:h-10 rounded-xl border border-slate-200/90 bg-slate-50/60 pl-10 pr-3 text-sm text-slate-900 uppercase placeholder:normal-case placeholder:text-slate-400 transition-all focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-600 hover:border-slate-300"
              />
            </div>
          </div>

          {/* Terms & Conditions Consent */}
          <div className="flex items-start gap-2 pt-0.5">
            <input
              id="register-consent"
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => {
                setTermsAccepted(e.target.checked);
                if (e.target.checked && error.includes('Terms & Conditions')) {
                  setError('');
                }
              }}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-100 cursor-pointer"
              aria-describedby="register-consent-label"
            />
            <label
              htmlFor="register-consent"
              id="register-consent-label"
              className="text-xs text-slate-500 leading-snug cursor-pointer select-none"
            >
              I agree to the{' '}
              <Link
                to={ROUTES.TERMS}
                onClick={(e) => e.stopPropagation()}
                className="text-blue-600 font-bold hover:underline"
              >
                Terms &amp; Conditions
              </Link>{' '}
              and{' '}
              <Link
                to={ROUTES.PRIVACY}
                onClick={(e) => e.stopPropagation()}
                className="text-blue-600 font-bold hover:underline"
              >
                Privacy Policy
              </Link>.
            </label>
          </div>

          {/* Primary CTA */}
          <button
            type="submit"
            disabled={loading || !termsAccepted}
            className="w-full h-12 sm:h-11 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-bold rounded-xl shadow-md shadow-blue-600/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 cursor-pointer"
            aria-label={!termsAccepted ? 'Create Account (accept terms to enable)' : 'Create Account'}
          >
            {loading ? (
              <>
                <span className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" aria-hidden="true" />
                <span>Creating account...</span>
              </>
            ) : (
              <>
                <span>Create Account</span>
                <ArrowRight size={16} aria-hidden="true" />
              </>
            )}
          </button>
        </form>
      </div>

      {/* Bottom Footer Section */}
      <div className="shrink-0 mt-3.5 sm:mt-2">
        {/* Bottom link: Already have an account? Sign In */}
        <div className="relative my-2 sm:my-1.5 flex items-center justify-center">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100" /></div>
          <span className="relative bg-white px-2.5 text-xs text-slate-500">
            Already have an account?{' '}
            <Link to="/login" className="font-bold text-blue-600 hover:underline">
              Sign In
            </Link>
          </span>
        </div>

        {/* Partner Registration link */}
        <div className="pt-1 text-center">
          <p className="text-xs text-slate-500">
            Are you a service professional?{' '}
            <Link
              to="/register/partner"
              className="font-bold text-blue-600 hover:text-blue-700 hover:underline"
            >
              Join as Partner &rarr;
            </Link>
          </p>
        </div>

        {/* Mobile Trust Badges Footer: hidden on desktop since desktop has left branding column */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex sm:hidden items-center justify-center gap-3 text-[11px] font-medium text-slate-400 select-none">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Verified Pros
          </span>
          <span>&middot;</span>
          <span>Upfront Pricing</span>
          <span>&middot;</span>
          <span>256-bit Secure</span>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
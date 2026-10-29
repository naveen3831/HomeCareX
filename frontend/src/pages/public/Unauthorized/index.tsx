import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { ROUTES } from '@/constants/routes';
import type { AuthUser } from '@/types/auth';

export const getRoleDashboard = (role?: string): string | null => {
  if (!role) return null;
  const normalized = role.toLowerCase();
  if (normalized === 'admin') return '/admin';
  if (normalized === 'partner') return '/partner';
  if (normalized === 'customer') return '/customer';
  return null;
};

/** 403: Access Denied error page. */
export const UnauthorizedPage: React.FC = () => {
  let user: AuthUser | null = null;
  let isAuthenticated = false;
  let logout = () => {};

  try {
    const auth = useAuth();
    user = auth.user;
    isAuthenticated = auth.isAuthenticated;
    logout = auth.logout;
  } catch {
    // Gracefully handle render when outside AuthProvider
  }

  useEffect(() => {
    document.title = '403 - Access Denied | HomeCareX';
  }, []);

  const dashboardRoute = isAuthenticated && user ? getRoleDashboard(user.role) : null;

  return (
   
    <main
      className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12"
      role="alert"
      aria-labelledby="unauthorized-heading"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-lg ring-1 ring-gray-900/5 sm:p-10">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 ring-8 ring-indigo-50/50">
          <ShieldAlert className="h-8 w-8 text-[#4338ca]" aria-hidden="true" />
        </div>

        <p className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 ring-1 ring-red-600/20">
          <span className="h-1.5 w-1.5 rounded-full bg-red-600" />
          Error 403 · 403 Status
        </p>

        <h1
          id="unauthorized-heading"
          className="mt-4 text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl"
        >
          Access Denied — You don't have access to this page
        </h1>

        <p className="mt-3 text-base leading-6 text-gray-600">
          You do not have permission to access the requested page. If you believe this is an error, please return home or contact support.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            to={ROUTES.HOME}
            className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#ff8a3d]"
          >
            Go Home
          </Link>

          {dashboardRoute ? (
            <Link
              to={dashboardRoute}
              className="inline-flex items-center justify-center rounded-xl bg-[#ff8a3d] px-5 py-3 text-sm font-semibold text-[#1b1b3a] shadow-sm transition hover:bg-[#ff7a22] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#ff8a3d]"
            >
              Go Dashboard
            </Link>
          ) : (
            <Link
              to={ROUTES.LOGIN}
              className="inline-flex items-center justify-center rounded-xl bg-[#4338ca] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#3730a3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#4338ca]"
            >
              Log in
            </Link>
          )}

          <Link
            to="/contact"
            className="inline-flex items-center justify-center rounded-xl border border-[#4338ca] bg-white px-5 py-3 text-sm font-semibold text-[#4338ca] shadow-sm transition hover:bg-[#4338ca] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#4338ca]"
          >
            Contact support
          </Link>
        </div>

        {isAuthenticated && user && (
          <div className="mt-6 border-t border-gray-100 pt-4">
            <button
              type="button"
              onClick={() => void logout()}
              className="text-xs font-medium text-gray-500 hover:text-[#4338ca] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff8a3d]"
            >
              Signed in as {user.email || user.name}. Switch account?
            </button>
          </div>
        )}
      </div>
    </main>
  );
};

export default UnauthorizedPage;

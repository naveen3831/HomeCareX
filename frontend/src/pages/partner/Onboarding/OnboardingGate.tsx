import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { fetchOnboarding } from './onboarding.api';

/**
 * Keeps a partner out of the app until the training is finished AND an admin approved it.
 * Every visit starts here, so cancelling the demo never opens the dashboard.
 * If the check itself fails (offline) the page lets the partner through; the server still refuses
 * every partner page with a 403 until the training is approved, so nothing is exposed.
 */
export default function OnboardingGate({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const [state, setState] = useState<'checking' | 'demo' | 'ok'>('checking');

  useEffect(() => {
    let live = true;
    fetchOnboarding()
      .then((s) => live && setState(s.eligible && !s.approved ? 'demo' : 'ok'))
      .catch(() => live && setState('ok'));
    return () => {
      live = false;
    };
  }, []);

  if (state === 'checking') return <div aria-busy="true" className="p-8 text-center text-sm text-muted">Loading…</div>;
  if (state === 'demo' && !pathname.startsWith('/partner/onboarding')) return <Navigate to="/partner/onboarding" replace />;
  return <>{children}</>;
}

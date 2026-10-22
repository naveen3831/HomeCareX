import { useMemo } from 'react';
import { AlertTriangle, Globe, Laptop, Monitor, RefreshCw, Smartphone } from 'lucide-react';
import { useSessions } from '@/features/auth';
import './settings.css';

function formatDate(iso?: string | null): string {
  if (!iso) return 'Unknown';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function deviceIcon(device?: string, browser?: string) {
  const s = `${device ?? ''} ${browser ?? ''}`.toLowerCase();
  if (/(mobile|phone|android|iphone)/.test(s)) return Smartphone;
  if (/(mac|windows|linux|desktop)/.test(s)) return Laptop;
  return Monitor;
}

/** /partner/settings/security/history. Read-only view built from central auth's sessions: no auth logic here. */
export default function LoginHistoryPage() {
  const { sessions, isLoading, error, refetch } = useSessions();

  const sorted = useMemo(
    () => [...sessions].sort((a, b) => new Date(b.lastActiveAt ?? 0).getTime() - new Date(a.lastActiveAt ?? 0).getTime()),
    [sessions],
  );

  return (
    <div className="ps-root">
      <p className="ps-lead">Recent sign-ins on devices that are still signed in to your account.</p>

      <div className="ps-toolbar">
        <button type="button" className="ps-btn" onClick={() => void refetch()} disabled={isLoading} aria-label="Refresh login history">
          <RefreshCw size={16} className={isLoading ? 'ps-spin' : ''} aria-hidden="true" />
          <span>Refresh</span>
        </button>
      </div>

      {isLoading ? (
        <div aria-busy="true" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <span key={i} className="ps-skeleton-line" />
          ))}
        </div>
      ) : error ? (
        <div className="ps-state" role="alert">
          <AlertTriangle size={24} aria-hidden="true" />
          <p className="ps-state-title">Unable to load login history</p>
          <p className="ps-muted">{error.message || 'Could not reach the server. Please check your connection.'}</p>
          <button type="button" className="ps-btn ps-btn-primary" onClick={() => void refetch()}>
            Try again
          </button>
        </div>
      ) : sorted.length === 0 ? (
        <div className="ps-state">
          <Globe size={28} aria-hidden="true" />
          <p className="ps-state-title">No sign-ins to show</p>
          <p className="ps-muted">Sign-ins will appear here after your next login.</p>
        </div>
      ) : (
        <ul className="ps-sessions" aria-label="Login history">
          {sorted.map((s) => {
            const Icon = deviceIcon(s.device, s.browser);
            const name = [s.device, s.browser, s.os].filter(Boolean).join(' \u00b7 ') || 'Unknown device';
            return (
              <li key={s.id} className="ps-session">
                <div className="ps-session-main">
                  <span className="ps-session-icon" aria-hidden="true">
                    <Icon size={20} />
                  </span>
                  <div className="ps-row-text">
                    <span className="ps-row-label">
                      {name}
                      {s.isCurrent ? <span className="ps-pill">This device</span> : null}
                    </span>
                    <span className="ps-muted">
                      {s.ipAddress ? `IP: ${s.ipAddress}` : 'IP unavailable'} - Last active: {formatDate(s.lastActiveAt)}
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
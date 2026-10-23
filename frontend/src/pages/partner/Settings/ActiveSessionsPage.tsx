import { useState } from 'react';
import { AlertTriangle, Globe, Laptop, LogOut, Monitor, RefreshCw, ShieldAlert, Smartphone, Trash2 } from 'lucide-react';
import { useLogoutAll, useSessions } from '@/features/auth';
import type { UserSession } from '@/types/auth';
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

/** /partner/settings/security/sessions. Same central auth hooks as the shared security page: no auth logic here. */
export default function ActiveSessionsPage() {
  const { sessions, isLoading, error, refetch, revokeSession, revokingId, isRevoking, revokeError } = useSessions();
  const { logoutAll, loading: loggingOutAll, error: logoutAllError } = useLogoutAll();
  const [toRevoke, setToRevoke] = useState<UserSession | null>(null);
  const [confirmLogoutAll, setConfirmLogoutAll] = useState(false);

  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  const confirmRevoke = async () => {
    if (!toRevoke) return;
    try {
      await revokeSession(toRevoke.id);
      setToRevoke(null);
    } catch {
      // shown through revokeError
    }
  };

  const confirmAll = async () => {
    try {
      await logoutAll();
      setConfirmLogoutAll(false);
    } catch {
      // shown through logoutAllError
    }
  };

  return (
    <div className="ps-root">
      <p className="ps-lead">Devices that are currently signed in to your account.</p>

      <div className="ps-toolbar">
        <button type="button" className="ps-btn" onClick={() => void refetch()} disabled={isLoading} aria-label="Refresh active sessions">
          <RefreshCw size={16} className={isLoading ? 'ps-spin' : ''} aria-hidden="true" />
          <span>Refresh</span>
        </button>
      </div>

      {revokeError ? (
        <div role="alert" className="ps-alert is-error">
          <AlertTriangle size={18} aria-hidden="true" />
          <span>{revokeError.message || 'Failed to revoke the session. Please try again.'}</span>
        </div>
      ) : null}

      {isLoading ? (
        <div aria-busy="true" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <span key={i} className="ps-skeleton-line" />
          ))}
        </div>
      ) : error ? (
        <div className="ps-state" role="alert">
          <p className="ps-state-title">Unable to load active sessions</p>
          <p className="ps-muted">{error.message || 'Could not reach the server. Please check your connection.'}</p>
          <button type="button" className="ps-btn ps-btn-primary" onClick={() => void refetch()}>
            Try again
          </button>
        </div>
      ) : sessions.length === 0 ? (
        <div className="ps-state">
          <Globe size={28} aria-hidden="true" />
          <p className="ps-state-title">No active sessions found</p>
          <p className="ps-muted">Only this browser session is connected.</p>
        </div>
      ) : (
        <ul className="ps-sessions" aria-label="Active sessions">
          {sessions.map((s) => {
            const Icon = deviceIcon(s.device, s.browser);
            const isCurrent = Boolean(s.isCurrent);
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
                      {isCurrent ? <span className="ps-pill">This device</span> : null}
                    </span>
                    <span className="ps-muted">
                      {s.ipAddress ? `IP: ${s.ipAddress}` : 'IP unavailable'} - Last active: {formatDate(s.lastActiveAt)}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  className="ps-btn ps-btn-danger"
                  onClick={() => setToRevoke(s)}
                  disabled={isRevoking || !isOnline}
                  aria-label={`${isCurrent ? 'Sign out of' : 'Revoke'} ${name}`}
                >
                  {revokingId === s.id ? (
                    <>
                      <RefreshCw size={16} className="ps-spin" aria-hidden="true" />
                      <span>Revoking...</span>
                    </>
                  ) : isCurrent ? (
                    <>
                      <LogOut size={16} aria-hidden="true" />
                      <span>Sign out</span>
                    </>
                  ) : (
                    <>
                      <Trash2 size={16} aria-hidden="true" />
                      <span>Revoke</span>
                    </>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="ps-group">
        <h3 className="ps-subhead">Sign out everywhere</h3>
        <div className="ps-row">
          <span className="ps-row-text">
            <span className="ps-row-label">Log out of all devices</span>
            <span className="ps-muted">Lost a device or noticed something unfamiliar? This ends every session, including this one.</span>
          </span>
          <button type="button" className="ps-btn ps-btn-danger" onClick={() => setConfirmLogoutAll(true)} disabled={loggingOutAll || !isOnline}>
            <ShieldAlert size={16} aria-hidden="true" />
            <span>{loggingOutAll ? 'Logging out...' : 'Log out all devices'}</span>
          </button>
        </div>
        {logoutAllError ? (
          <div role="alert" className="ps-alert is-error">
            <AlertTriangle size={18} aria-hidden="true" />
            <span>{logoutAllError.message || 'Failed to log out of all devices. Please try again.'}</span>
          </div>
        ) : null}
      </div>

      {toRevoke ? (
        <div className="ps-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="ps-revoke-title">
          <div className="ps-modal">
            <h3 id="ps-revoke-title" className="ps-modal-title">
              {toRevoke.isCurrent ? 'Sign out of this device?' : 'Revoke session?'}
            </h3>
            <p className="ps-muted">
              {toRevoke.isCurrent
                ? 'This will end your current session and take you to the login page.'
                : `This will immediately sign out ${[toRevoke.device, toRevoke.browser].filter(Boolean).join(' ') || 'that device'}.`}
            </p>
            <div className="ps-modal-actions">
              <button type="button" className="ps-btn" onClick={() => setToRevoke(null)} disabled={isRevoking}>
                Cancel
              </button>
              <button type="button" className="ps-btn ps-btn-primary" onClick={() => void confirmRevoke()} disabled={isRevoking}>
                {isRevoking ? 'Revoking...' : toRevoke.isCurrent ? 'Sign out' : 'Revoke session'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {confirmLogoutAll ? (
        <div className="ps-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="ps-logoutall-title">
          <div className="ps-modal">
            <h3 id="ps-logoutall-title" className="ps-modal-title">
              Log out of all devices?
            </h3>
            <p className="ps-muted">
              Every phone, computer and browser will be signed out, including this one. You will return to the login screen.
            </p>
            <div className="ps-modal-actions">
              <button type="button" className="ps-btn" onClick={() => setConfirmLogoutAll(false)} disabled={loggingOutAll}>
                Cancel
              </button>
              <button type="button" className="ps-btn ps-btn-primary" onClick={() => void confirmAll()} disabled={loggingOutAll}>
                {loggingOutAll ? 'Logging out...' : 'Log out all devices'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
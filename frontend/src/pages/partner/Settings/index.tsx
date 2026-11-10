import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { ChevronRight } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { isAppLanguage, useLanguage } from '@/i18n/LanguageContext';
import {
  settingsApi,
  settingsErrorMessage,
  type Language,
  type LocationSharing,
  type PartnerSettings,
  type SettingsSection,
} from './settings.api';
import { LOGIN_HISTORY_PATH, PASSWORD_PATH, PRIVACY_POLICY_PATH, SESSIONS_PATH, SETTINGS_HOME, TERMS_PATH } from './paths';
import './settings.css';

// Language names are shown in their own script so people can always find theirs.
const LANGUAGE_OPTIONS: { value: Language; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'हिन्दी' },
  { value: 'te', label: 'తెలుగు' },
];

// Which section shows comes from the URL: /partner/settings/:section (the sidebar links to each one).
const SECTIONS = {
  account: { blurb: 'Your sign-in details and account pages.' },
  notifications: { blurb: 'Choose how and when we contact you.' },
  privacy: { blurb: 'Control your location and how customers can reach you.' },
  security: { blurb: 'Keep your account safe.' },
  other: { blurb: 'Language, help and legal.' },
} as const;
type SectionId = keyof typeof SECTIONS;
const isSection = (v: string | undefined): v is SectionId =>
  v !== undefined && Object.prototype.hasOwnProperty.call(SECTIONS, v);

const LOCATION_OPTIONS: { value: LocationSharing; label: string; hint: string }[] = [
  { value: 'active_jobs', label: 'Only during active jobs', hint: 'Customers see you on the map while a job is in progress. Recommended.' },
  { value: 'online', label: 'Whenever I am online', hint: 'Your location is shared as long as you are available for jobs.' },
];

type Status = 'loading' | 'error' | 'ready';
// Only errors are shown. Successful saves are silent.
type Notice = { kind: 'error'; text: string };

function ToggleRow(props: { label: string; hint?: string; checked: boolean; disabled?: boolean; onChange: (next: boolean) => void }) {
  const id = useId();
  const { t } = useLanguage();
  return (
    <div className="ps-row">
      <div className="ps-row-text">
        <label htmlFor={id} className="ps-row-label">
          {t(props.label)}
        </label>
        {props.hint ? (
          <p id={`${id}-hint`} className="ps-muted">
            {t(props.hint)}
          </p>
        ) : null}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={props.checked}
        aria-describedby={props.hint ? `${id}-hint` : undefined}
        disabled={props.disabled}
        className={`ps-switch${props.checked ? ' is-on' : ''}`}
        onClick={() => props.onChange(!props.checked)}
      >
        <span className="ps-switch-knob" />
      </button>
    </div>
  );
}

function LinkRow({ to, label, hint }: { to: string; label: string; hint?: string }) {
  const { t } = useLanguage();
  return (
    <Link to={to} className="ps-row ps-link">
      <span className="ps-row-text">
        <span className="ps-row-label">{t(label)}</span>
        {hint ? <span className="ps-muted">{t(hint)}</span> : null}
      </span>
      <ChevronRight size={18} className="ps-chevron" aria-hidden="true" />
    </Link>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  const { t } = useLanguage();
  return (
    <div className="ps-group">
      <h3 className="ps-subhead">{t(title)}</h3>
      <div className="ps-list">{children}</div>
    </div>
  );
}

export default function PartnerSettingsPage() {
  const { t, setLanguage } = useLanguage();
  const { section } = useParams<{ section: string }>();
  const { user } = useAuth();

  const [status, setStatus] = useState<Status>('loading');
  const [errorText, setErrorText] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [data, setData] = useState<PartnerSettings | null>(null);
  const [pending, setPending] = useState<Set<string>>(() => new Set());
  const [notice, setNotice] = useState<Notice | null>(null);

  // The ref always holds the latest settings, so quick successive changes never overwrite each other.
  const dataRef = useRef<PartnerSettings | null>(null);
  const commit = useCallback((next: PartnerSettings) => {
    dataRef.current = next;
    setData(next);
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    settingsApi.get(ctrl.signal).then(
      (d) => {
        commit(d);
        // The saved language is the source of truth: apply it to the whole app.
        if (isAppLanguage(d.language)) setLanguage(d.language);
        setStatus('ready');
      },
      (err: unknown) => {
        if (axios.isCancel(err)) return;
        setErrorText(settingsErrorMessage(err));
        setStatus('error');
      },
    );
    return () => ctrl.abort();
  }, [reloadKey, commit, setLanguage]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 5000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const reload = () => {
    setStatus('loading');
    setReloadKey((k) => k + 1);
  };

  const markPending = (id: string, on: boolean) =>
    setPending((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  /** Show the change at once, save it silently, and put the old value back (with an error) if the save fails. */
  const save = async (sectionName: SettingsSection, key: string, value: boolean | string) => {
    const current = dataRef.current;
    if (!current) return;
    const id = `${sectionName}.${key}`;
    const previous = (current[sectionName] as unknown as Record<string, unknown>)[key];
    commit({ ...current, [sectionName]: { ...current[sectionName], [key]: value } } as PartnerSettings);
    markPending(id, true);
    try {
      const saved = await settingsApi.patchSection(sectionName, { [key]: value });
      const latest = dataRef.current;
      if (latest) commit({ ...latest, updatedAt: saved.updatedAt });
    } catch (err) {
      const latest = dataRef.current;
      if (latest) commit({ ...latest, [sectionName]: { ...latest[sectionName], [key]: previous } } as PartnerSettings);
      setNotice({ kind: 'error', text: settingsErrorMessage(err) });
    } finally {
      markPending(id, false);
    }
  };

  const saveLanguage = async (language: Language) => {
    const current = dataRef.current;
    if (!current) return;
    const previous = current.language;
    commit({ ...current, language });
    setLanguage(language); // the whole app switches at once
    markPending('language', true);
    try {
      const saved = await settingsApi.patchLanguage(language);
      const latest = dataRef.current;
      if (latest) commit({ ...latest, updatedAt: saved.updatedAt });
    } catch (err) {
      const latest = dataRef.current;
      if (latest) commit({ ...latest, language: previous });
      setLanguage(previous);
      setNotice({ kind: 'error', text: settingsErrorMessage(err) });
    } finally {
      markPending('language', false);
    }
  };

  if (!isSection(section)) return <Navigate to={SETTINGS_HOME} replace />;

  const busy = (id: string) => pending.has(id);

  const body = (() => {
    if (status === 'loading') {
      return (
        <div aria-busy="true" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} className="ps-skeleton-line" />
          ))}
        </div>
      );
    }

    if (status === 'error' || !data) {
      return (
        <div className="ps-state" role="alert">
          <p className="ps-state-title">{t('Could not load your settings')}</p>
          <p className="ps-muted">{errorText}</p>
          <button type="button" className="ps-btn ps-btn-primary" onClick={reload}>
            {t('Try again')}
          </button>
        </div>
      );
    }

    const { notifications, privacy, security } = data;

    switch (section) {
      case 'account':
        return (
          <>
            <Group title="Your details">
              <div className="ps-row">
                <span className="ps-row-text">
                  <span className="ps-row-label">{t('Name')}</span>
                  <span className="ps-muted">{user?.name || '-'}</span>
                </span>
              </div>
              <div className="ps-row">
                <span className="ps-row-text">
                  <span className="ps-row-label">{t('Mobile')}</span>
                  <span className="ps-muted">{user?.phone || '-'}</span>
                </span>
              </div>
              <div className="ps-row">
                <span className="ps-row-text">
                  <span className="ps-row-label">{t('Email')}</span>
                  <span className="ps-muted">{user?.email || '-'}</span>
                </span>
              </div>
            </Group>
            <Group title="Account pages">
              <LinkRow to="/partner/profile/documents" label="ID and address proof" />
              <LinkRow to="/partner/profile/preferences" label="Preferences" hint="Language and job preferences" />
              <LinkRow to="/partner/account/security" label="Account security" hint="Password, sessions and devices" />
            </Group>
          </>
        );

      case 'notifications':
        return (
          <>
            <Group title="Channels">
              <ToggleRow label="Push notifications" checked={notifications.push} disabled={busy('notifications.push')} onChange={(v) => void save('notifications', 'push', v)} />
              <ToggleRow label="SMS" checked={notifications.sms} disabled={busy('notifications.sms')} onChange={(v) => void save('notifications', 'sms', v)} />
              <ToggleRow label="Email" checked={notifications.email} disabled={busy('notifications.email')} onChange={(v) => void save('notifications', 'email', v)} />
            </Group>
            <Group title="What you receive">
              <ToggleRow
                label="Job alerts"
                hint="New job requests and changes to your jobs."
                checked={notifications.jobAlerts}
                disabled={busy('notifications.jobAlerts')}
                onChange={(v) => void save('notifications', 'jobAlerts', v)}
              />
              <ToggleRow
                label="Promotions"
                hint="Offers, incentives and product news."
                checked={notifications.promotions}
                disabled={busy('notifications.promotions')}
                onChange={(v) => void save('notifications', 'promotions', v)}
              />
            </Group>
          </>
        );

      case 'privacy':
        return (
          <>
            <Group title="Location sharing">
              <div role="radiogroup" aria-label={t('Location sharing')}>
                {LOCATION_OPTIONS.map((o) => (
                  <label key={o.value} className={`ps-choice${privacy.locationSharing === o.value ? ' is-selected' : ''}`}>
                    <input
                      type="radio"
                      name="locationSharing"
                      value={o.value}
                      checked={privacy.locationSharing === o.value}
                      disabled={busy('privacy.locationSharing')}
                      onChange={() => void save('privacy', 'locationSharing', o.value)}
                    />
                    <span className="ps-row-text">
                      <span className="ps-row-label">{t(o.label)}</span>
                      <span className="ps-muted">{t(o.hint)}</span>
                    </span>
                  </label>
                ))}
              </div>
            </Group>
            <Group title="Customer contact">
              <ToggleRow
                label="Allow customer calls"
                hint="Customers can call you through a masked number."
                checked={privacy.allowCalls}
                disabled={busy('privacy.allowCalls')}
                onChange={(v) => void save('privacy', 'allowCalls', v)}
              />
              <ToggleRow
                label="Allow customer chat"
                hint="Customers can message you about a booking."
                checked={privacy.allowChat}
                disabled={busy('privacy.allowChat')}
                onChange={(v) => void save('privacy', 'allowChat', v)}
              />
            </Group>
          </>
        );

      case 'security':
        return (
          <>
            <Group title="Sign-in">
              <ToggleRow
                label="Login alerts"
                hint="Get notified when your account signs in on a new device."
                checked={security.loginAlerts}
                disabled={busy('security.loginAlerts')}
                onChange={(v) => void save('security', 'loginAlerts', v)}
              />
              <div className="ps-row">
                <span className="ps-row-text">
                  <span className="ps-row-label">{t('Two-factor authentication')}</span>
                  <span className="ps-muted">{t('An extra verification step when you sign in.')}</span>
                </span>
                <span className="ps-badge">{t('Coming soon')}</span>
              </div>
            </Group>
            <Group title="Password and devices">
              <LinkRow to={PASSWORD_PATH} label="Change password" hint="Set a new password for your account." />
              <LinkRow to={SESSIONS_PATH} label="Active sessions" hint="See where you are signed in, or sign out of all devices." />
              <LinkRow to={LOGIN_HISTORY_PATH} label="Login history" hint="Recent sign-ins on your devices." />
            </Group>
          </>
        );

      default:
        return (
          <>
            <Group title="Language">
              <div className="ps-row">
                <label htmlFor="ps-language" className="ps-row-text">
                  <span className="ps-row-label">{t('App language')}</span>
                  <span className="ps-muted">{t('Used for your partner app and messages.')}</span>
                </label>
                <select
                  id="ps-language"
                  className="ps-select"
                  value={data.language}
                  disabled={busy('language')}
                  onChange={(e) => void saveLanguage(e.target.value as Language)}
                >
                  {LANGUAGE_OPTIONS.map((l) => (
                    <option key={l.value} value={l.value}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </div>
            </Group>
            <Group title="Help and legal">
              <LinkRow to="/partner/help" label="Help center" />
              <LinkRow to={TERMS_PATH} label="Terms of service" />
              <LinkRow to={PRIVACY_POLICY_PATH} label="Privacy policy" />
            </Group>
          </>
        );
    }
  })();

  return (
    <div className="ps-root">
      <p className="ps-lead">{t(SECTIONS[section].blurb)}</p>
      {body}

      {notice ? (
        <p className="ps-notice is-error" role="alert">
          {notice.text}
        </p>
      ) : null}
    </div>
  );
}
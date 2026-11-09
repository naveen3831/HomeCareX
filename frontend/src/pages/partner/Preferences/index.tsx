import { useEffect, useId, useRef, useState } from 'react';
import axios from 'axios';
import { isAppLanguage, useLanguage } from '@/i18n/LanguageContext';
import {
  settingsApi,
  settingsErrorMessage,
  LANGUAGES,
  type Language,
  type LocationSharing,
  type PartnerSettings,
} from '../Settings/settings.api';
import '../Settings/settings.css';

const LOCATION_OPTIONS: { value: LocationSharing; label: string; hint: string }[] = [
  { value: 'active_jobs', label: 'Only during active jobs', hint: 'Customers see you on the map while a job is in progress.' },
  { value: 'online', label: 'Whenever I am online', hint: 'Your location is shared as long as you are available for jobs.' },
];

function ToggleRow(props: { label: string; hint?: string; checked: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  const id = useId();
  const { t } = useLanguage();
  return (
    <div className="ps-row">
      <div className="ps-row-text">
        <label htmlFor={id} className="ps-row-label">{t(props.label)}</label>
        {props.hint ? <p className="ps-muted">{t(props.hint)}</p> : null}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={props.checked}
        disabled={props.disabled}
        className={`ps-switch${props.checked ? ' is-on' : ''}`}
        onClick={() => props.onChange(!props.checked)}
      >
        <span className="ps-switch-knob" />
      </button>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  const { t } = useLanguage();
  return (
    <div className="ps-group">
      <h3 className="ps-subhead">{t(title)}</h3>
      <div className="ps-list">{children}</div>
    </div>
  );
}

/** /partner/profile/preferences: language, job alerts and location sharing, saved through the settings API. */
export default function PartnerPreferencesPage() {
  const { t, setLanguage } = useLanguage();
  const [data, setData] = useState<PartnerSettings | null>(null);
  const [status, setStatus] = useState<'loading' | 'error' | 'ready'>('loading');
  const [errorText, setErrorText] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [pending, setPending] = useState<Set<string>>(() => new Set());
  const [notice, setNotice] = useState('');
  const ref = useRef<PartnerSettings | null>(null);

  const commit = (next: PartnerSettings) => {
    ref.current = next;
    setData(next);
  };

  useEffect(() => {
    const ctrl = new AbortController();
    settingsApi.get(ctrl.signal).then(
      (d) => {
        commit(d);
        setStatus('ready');
      },
      (err: unknown) => {
        if (axios.isCancel(err)) return;
        setErrorText(settingsErrorMessage(err));
        setStatus('error');
      },
    );
    return () => ctrl.abort();
  }, [reloadKey]);

  const mark = (id: string, on: boolean) =>
    setPending((p) => {
      const n = new Set(p);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });
  const busy = (id: string) => pending.has(id);

  const save = async (section: 'notifications' | 'privacy', key: string, value: boolean | string) => {
    const cur = ref.current;
    if (!cur) return;
    const id = `${section}.${key}`;
    const prev = (cur[section] as unknown as Record<string, unknown>)[key];
    commit({ ...cur, [section]: { ...cur[section], [key]: value } } as PartnerSettings);
    mark(id, true);
    try {
      await settingsApi.patchSection(section, { [key]: value });
    } catch (err) {
      const latest = ref.current;
      if (latest) commit({ ...latest, [section]: { ...latest[section], [key]: prev } } as PartnerSettings);
      setNotice(settingsErrorMessage(err));
    } finally {
      mark(id, false);
    }
  };

  const saveLanguage = async (language: Language) => {
    const cur = ref.current;
    if (!cur) return;
    const prev = cur.language;
    commit({ ...cur, language });
    setLanguage(language);
    mark('language', true);
    try {
      await settingsApi.patchLanguage(language);
    } catch (err) {
      const latest = ref.current;
      if (latest) commit({ ...latest, language: prev });
      if (isAppLanguage(prev)) setLanguage(prev);
      setNotice(settingsErrorMessage(err));
    } finally {
      mark('language', false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="ps-root" aria-busy="true">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="ps-skeleton-line" />
        ))}
      </div>
    );
  }

  if (status === 'error' || !data) {
    return (
      <div className="ps-root">
        <div className="ps-state" role="alert">
          <p className="ps-state-title">{t('Could not load your preferences')}</p>
          <p className="ps-muted">{errorText}</p>
          <button
            type="button"
            className="ps-btn ps-btn-primary"
            onClick={() => {
              setStatus('loading');
              setReloadKey((k) => k + 1);
            }}
          >
            {t('Try again')}
          </button>
        </div>
      </div>
    );
  }

  const { notifications, privacy } = data;

  return (
    <div className="ps-root">
      <p className="ps-lead">{t('Language and job preferences')}</p>

      <Group title="Language">
        <div className="ps-row">
          <label htmlFor="pp-language" className="ps-row-text">
            <span className="ps-row-label">{t('App language')}</span>
            <span className="ps-muted">{t('Used for your partner app and messages.')}</span>
          </label>
          <select
            id="pp-language"
            className="ps-select"
            value={data.language}
            disabled={busy('language')}
            onChange={(e) => void saveLanguage(e.target.value as Language)}
          >
            {LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>
        </div>
      </Group>

      <Group title="Job alerts">
        <ToggleRow
          label="Job alerts"
          hint="New job requests and changes to your jobs."
          checked={notifications.jobAlerts}
          disabled={busy('notifications.jobAlerts')}
          onChange={(v) => void save('notifications', 'jobAlerts', v)}
        />
        <ToggleRow label="Push notifications" checked={notifications.push} disabled={busy('notifications.push')} onChange={(v) => void save('notifications', 'push', v)} />
        <ToggleRow label="SMS" checked={notifications.sms} disabled={busy('notifications.sms')} onChange={(v) => void save('notifications', 'sms', v)} />
      </Group>

      <Group title="Location sharing">
        <div role="radiogroup" aria-label={t('Location sharing')}>
          {LOCATION_OPTIONS.map((o) => (
            <label key={o.value} className={`ps-choice${privacy.locationSharing === o.value ? ' is-selected' : ''}`}>
              <input
                type="radio"
                name="pp-locationSharing"
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

      {notice ? <p className="ps-notice is-error" role="alert">{notice}</p> : null}
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { describeError, useUpdatePreferences, type Language, type NotificationChannel, type NotificationMatrix, type NotificationTopic, type PreferencesDto, type PreferencesPatch, NOTIFICATION_CHANNELS, NOTIFICATION_TOPICS } from "@/features/customer";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import LanguageSelect from "./LanguageSelect";
import PreferencesMatrix from "./PreferencesMatrix";
import { FormMessage, OFFLINE_NOTE, PRIMARY_BUTTON, SECONDARY_BUTTON, Spinner } from "./formKit";

/** Only what differs from the saved version, so the server merges just those switches. */
export function buildPreferencesPatch(saved: PreferencesDto, draft: PreferencesDto): PreferencesPatch {
  const patch: PreferencesPatch = {};
  if (draft.language !== saved.language) patch.language = draft.language;
  for (const topic of NOTIFICATION_TOPICS) {
    for (const ch of NOTIFICATION_CHANNELS) {
      if (draft.notifications[topic][ch] !== saved.notifications[topic][ch]) {
        patch.notifications ??= {};
        patch.notifications[topic] = { ...patch.notifications[topic], [ch]: draft.notifications[topic][ch] };
      }
    }
  }
  return patch;
}

const clone = (p: PreferencesDto): PreferencesDto => ({ language: p.language, notifications: JSON.parse(JSON.stringify(p.notifications)) as NotificationMatrix });

/** Language + notification sections (pick a section, then its channels), saved together to PATCH /customer/preferences. */
export default function PreferencesCard({ preferences, onSaved }: { preferences: PreferencesDto; onSaved?: () => void }) {
  const update = useUpdatePreferences();
  const online = useOnlineStatus();
  const [draft, setDraft] = useState<PreferencesDto>(() => clone(preferences));
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [section, setSection] = useState<NotificationTopic | null>(null);
  const previous = useRef(preferences);

  useEffect(() => {
    const before = JSON.stringify(previous.current);
    previous.current = preferences;
    setDraft((cur) => (JSON.stringify(cur) === before ? clone(preferences) : cur));
  }, [preferences]);

  const patch = buildPreferencesPatch(preferences, draft);
  const dirty = Object.keys(patch).length > 0;

  const touch = () => {
    setSaved(false);
    setFormError(null);
  };
  const toggle = (topic: NotificationTopic, channel: NotificationChannel, on: boolean) => {
    touch();
    setDraft((d) => ({ ...d, notifications: { ...d.notifications, [topic]: { ...d.notifications[topic], [channel]: on } } }));
  };
  const setLanguage = (language: Language) => {
    touch();
    setDraft((d) => ({ ...d, language }));
  };

  const save = () => {
    if (!dirty || update.isPending || !online) return;
    update.mutate(patch, {
      onSuccess: (next) => {
        setDraft(clone(next));
        setSaved(true);
        onSaved?.();
      },
      onError: (err) => setFormError(describeError(err).fields.language ?? describeError(err).form ?? "Couldn't save your preferences."),
    });
  };

  return (
    <>
      <div className="space-y-5" aria-busy={update.isPending}>
        {section === null && <LanguageSelect value={draft.language} onChange={setLanguage} disabled={update.isPending} />}
        <PreferencesMatrix value={draft.notifications} onChange={toggle} selected={section} onSelect={setSection} disabled={update.isPending} />

        {formError && <FormMessage kind="error">{formError}</FormMessage>}
        {saved && <FormMessage kind="success">Preferences saved.</FormMessage>}
        {!online && <FormMessage kind="info">{OFFLINE_NOTE}</FormMessage>}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" onClick={() => { setDraft(clone(preferences)); touch(); }} disabled={!dirty || update.isPending} className={SECONDARY_BUTTON}>
            Reset
          </button>
          <button type="button" onClick={save} disabled={!dirty || update.isPending || !online} className={PRIMARY_BUTTON}>
            {update.isPending ? <><Spinner /> Saving…</> : "Save preferences"}
          </button>
        </div>
      </div>
    </>
  );
}

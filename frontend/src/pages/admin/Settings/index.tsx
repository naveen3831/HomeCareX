import { useDragScroll } from '@/hooks/useDragScroll';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, SlidersHorizontal } from 'lucide-react';
import {
  fetchSettings,
  saveSettings,
  SettingsApiError,
  type SettingsSection,
  type SettingValue,
} from '@/services/adminSettingsApi';
import { SettingField } from './SettingField';

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
import React from 'react';

export const AdminSettingsPage: React.FC = () => {
  // Web keeps the original tab-strip design; phones use the filter dropdown below.
  const isMobile = useMediaQuery('(max-width: 767px)');
  const pageRef = useDragScroll<HTMLDivElement>('[role="tablist"]');
  // Mobile filter dropdown (replaces the horizontally scrolling tab strip on small screens)
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!filterOpen) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setFilterOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFilterOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [filterOpen]);
  const [sections, setSections] = useState<SettingsSection[]>([]);
  const [activeId, setActiveId] = useState('business');
  const [draft, setDraft] = useState<Record<string, SettingValue>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const apply = useCallback((next: SettingsSection[]) => {
    setSections(next);
    setDraft(Object.fromEntries(next.flatMap((s) => s.settings.map((x) => [x.key, x.value]))));
  }, []);

  useEffect(() => {
    fetchSettings()
      .then(apply)
      .catch((e: SettingsApiError) => setLoadError(e.message))
      .finally(() => setLoading(false));
  }, [apply]);

  const section = sections.find((s) => s.id === activeId) ?? sections[0];
  const dirtyKeys = useMemo(
    () => (section ? section.settings.filter((s) => !same(draft[s.key], s.value)).map((s) => s.key) : []),
    [section, draft],
  );

  const onSave = async () => {
    if (!section || dirtyKeys.length === 0) return;

    // Check numbers here first so a bad value (e.g. GST 118) shows its error immediately.
    const clientErrors: Record<string, string> = {};
    for (const s of section.settings) {
      if (!dirtyKeys.includes(s.key) || (s.type !== 'number' && s.type !== 'integer')) continue;
      const v = draft[s.key];
      if (typeof v !== 'number' || !Number.isFinite(v)) {
        clientErrors[s.key] = `${s.label} must be a number`;
      } else if (s.type === 'integer' && !Number.isInteger(v)) {
        clientErrors[s.key] = `${s.label} must be a whole number`;
      } else if ((s.min !== undefined && v < s.min) || (s.max !== undefined && v > s.max)) {
        clientErrors[s.key] =
          s.min !== undefined && s.max !== undefined
            ? `${s.label} must be between ${s.min} and ${s.max}${s.unit ? ` ${s.unit}` : ''}`
            : s.min !== undefined
              ? `${s.label} must be at least ${s.min}`
              : `${s.label} must be at most ${s.max}`;
      }
    }
    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors);
      setNotice({ ok: false, text: 'Please fix the highlighted field.' });
      return;
    }

    setSaving(true);
    setNotice(null);
    setErrors({});
    try {
      apply(await saveSettings(Object.fromEntries(dirtyKeys.map((k) => [k, draft[k]]))));
      setNotice({ ok: true, text: `${section.label} settings saved.` });
    } catch (e) {
      const err = e as SettingsApiError;
      setErrors(err.fields);
      setNotice({ ok: false, text: err.status === 403 ? 'You need the settings:manage permission.' : err.message });
    } finally {
      setSaving(false);
    }
  };

  const onCancel = () => {
    if (!section) return;
    setDraft((d) => ({ ...d, ...Object.fromEntries(section.settings.map((s) => [s.key, s.value])) }));
    setErrors({});
    setNotice(null);
  };

  const pick = (id: string) => {
    setActiveId(id);
    setErrors({});
    setNotice(null);
    setFilterOpen(false);
  };

  if (!isMobile) {
    return (
    <div ref={pageRef} className="admin-page-container min-w-0 max-w-full space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="mt-1 text-sm text-gray-500">Platform rules. Every change is recorded in the audit log.</p>
        </div>
  
        {loading && <p className="text-sm text-gray-500">Loading settings…</p>}
        {loadError && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{loadError}</p>}
  
        {section && (
          <div className="min-w-0 max-w-full overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div
              role="tablist"
              className="flex w-full max-w-full gap-2 overflow-x-auto overscroll-x-contain border-b border-gray-200 px-4 py-3 [-webkit-overflow-scrolling:touch] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-slate-100 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300"
            >
              {sections.map((s) => (
                <button
                  key={s.id}
                  role="tab"
                  aria-selected={s.id === section.id}
                  onClick={(e) => {
                    setActiveId(s.id);
                    setErrors({});
                    setNotice(null);
                    e.currentTarget.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                  }}
                  className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-colors ${s.id === section.id ? 'bg-[#4338ca] text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900'}`}
                >
                  {s.label}
                </button>
              ))}
            </div>
  
            <div className="p-5">
              <p className="text-sm text-gray-500">{section.description}</p>
              {section.settings.map((s) => (
                <SettingField
                  mobile={false}
                  key={s.key}
                  setting={s}
                  value={draft[s.key] ?? s.value}
                  error={errors[s.key]}
                  onChange={(v) => {
                    setDraft((d) => ({ ...d, [s.key]: v }));
                    setErrors((e) => { const { [s.key]: _removed, ...rest } = e; return rest; });
                  }}
                />
              ))}
  
              <div className="mt-4 flex items-center gap-3">
                <button
                  type="button"
                  onClick={onSave}
                  disabled={saving || dirtyKeys.length === 0}
                  className="rounded-xl bg-[#4338ca] px-4 py-2 text-sm font-semibold text-white hover:bg-[#3730a3] disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={onCancel}
                  disabled={saving || dirtyKeys.length === 0}
                  className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                {notice && <span role="status" className={`text-sm ${notice.ok ? 'text-emerald-700' : 'text-red-600'}`}>{notice.text}</span>}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="admin-page-container min-w-0 max-w-full space-y-5 !p-4 sm:!p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">Platform rules. Every change is recorded in the audit log.</p>
      </div>

      {loading && (
        <div className="space-y-3" aria-busy="true">
          <div className="h-12 animate-pulse rounded-2xl bg-slate-100 md:hidden" />
          <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />
        </div>
      )}
      {loadError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{loadError}</p>}

      {section && (
        <div className="grid min-w-0 items-start gap-4">
          {/* Mobile: one Filter button. Tap it, pick a section, and that section's settings show below. */}
          <div ref={filterRef} className="relative">
            <button
              type="button"
              aria-haspopup="listbox"
              aria-expanded={filterOpen}
              onClick={() => setFilterOpen((o) => !o)}
              className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm transition active:scale-[.99]"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-[#4338ca]">
                <SlidersHorizontal size={17} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400">Filter</span>
                <span className="block truncate text-sm font-semibold text-slate-900">{section.label}</span>
              </span>
              <ChevronDown size={18} aria-hidden="true" className={`shrink-0 text-slate-400 transition-transform ${filterOpen ? 'rotate-180' : ''}`} />
            </button>
            {filterOpen && (
              <ul
                role="listbox"
                aria-label="Settings section"
                className="absolute inset-x-0 top-full z-20 mt-2 max-h-[60vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl"
              >
                {sections.map((s) => {
                  const active = s.id === section.id;
                  return (
                    <li key={s.id} role="option" aria-selected={active}>
                      <button
                        type="button"
                        onClick={() => pick(s.id)}
                        className={`flex w-full items-center justify-between gap-3 rounded-xl px-3.5 py-3 text-left text-sm font-medium transition ${active ? 'bg-indigo-50 text-[#4338ca]' : 'text-slate-700 hover:bg-slate-50'}`}
                      >
                        {s.label}
                        {active && <Check size={16} aria-hidden="true" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" aria-labelledby="settings-section-title">
            <header className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 bg-gradient-to-r from-indigo-50/70 to-white px-5 py-4">
              <div className="min-w-0">
                <h2 id="settings-section-title" className="text-base font-bold text-slate-900">{section.label}</h2>
                <p className="mt-0.5 text-sm text-slate-500">{section.description}</p>
              </div>
              {dirtyKeys.length > 0 && (
                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
                  {dirtyKeys.length} unsaved
                </span>
              )}
            </header>

            <div className="divide-y divide-slate-100 px-5">
              {section.settings.map((s) => (
                <SettingField
                  mobile
                  key={s.key}
                  setting={s}
                  value={draft[s.key] ?? s.value}
                  error={errors[s.key]}
                  onChange={(v) => {
                    setDraft((d) => ({ ...d, [s.key]: v }));
                    setErrors((e) => { const { [s.key]: _removed, ...rest } = e; return rest; });
                  }}
                />
              ))}
            </div>

            <footer className="sticky bottom-0 flex flex-wrap items-center gap-3 border-t border-slate-100 bg-white/95 px-5 py-3 backdrop-blur">
              <button
                type="button"
                onClick={onSave}
                disabled={saving || dirtyKeys.length === 0}
                className="rounded-xl bg-[#4338ca] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#3730a3] disabled:cursor-not-allowed disabled:opacity-50 max-sm:flex-1"
              >
                {saving ? 'Saving…' : 'Save changes'}
              </button>
              <button
                type="button"
                onClick={onCancel}
                disabled={saving || dirtyKeys.length === 0}
                className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 max-sm:flex-1"
              >
                Cancel
              </button>
              {notice && (
                <span role="status" className={`w-full text-sm font-medium sm:w-auto ${notice.ok ? 'text-emerald-700' : 'text-red-600'}`}>
                  {notice.text}
                </span>
              )}
            </footer>
          </section>
        </div>
      )}
    <div className="admin-page-container p-6">
      <h1 className="text-2xl font-bold">Admin Settings</h1>
    </div>
  );
};

export default AdminSettingsPage;

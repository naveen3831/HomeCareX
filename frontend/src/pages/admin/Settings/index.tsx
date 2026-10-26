
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Check, ChevronDown, SlidersHorizontal } from "lucide-react";
import { useDragScroll } from "@/hooks/useDragScroll";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import {
  fetchSettings,
  saveSettings,
  type SettingsApiError,
  type SettingsSection,
  type SettingValue,
} from "@/services/adminSettingsApi";
import { SettingField } from "./SettingField";

<<<<<<< HEAD
const same = (a: unknown, b: unknown): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

export const AdminSettingsPage: React.FC = () => {
  const isMobile = useMediaQuery("(max-width: 767px)");
=======
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);



export const AdminSettingsPage: React.FC = () => {
  // Web keeps the original tab-strip design; phones use the filter dropdown below.
  const isMobile = useMediaQuery('(max-width: 767px)');
>>>>>>> origin/develop
  const pageRef = useDragScroll<HTMLDivElement>('[role="tablist"]');

  const [sections, setSections] = useState<SettingsSection[]>([]);
  const [activeId, setActiveId] = useState("business");
  const [draft, setDraft] = useState<Record<string, SettingValue>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [notice, setNotice] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);

  const filterRef = useRef<HTMLDivElement>(null);

  const apply = useCallback((next: SettingsSection[]) => {
    setSections(next);
    setDraft(
      Object.fromEntries(
        next.flatMap((section) =>
          section.settings.map((setting) => [
            setting.key,
            setting.value,
          ])
        )
      )
    );
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setLoadError("");

        const result = await fetchSettings();

        if (!cancelled) {
          apply(result);
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(
            (error as SettingsApiError).message ||
              "Unable to load settings. Please try again."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [apply]);

  useEffect(() => {
    if (!filterOpen) {
      return;
    }

    const handleOutsideClick = (event: MouseEvent | TouchEvent) => {
      if (
        filterRef.current &&
        !filterRef.current.contains(event.target as Node)
      ) {
        setFilterOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setFilterOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("touchstart", handleOutsideClick);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [filterOpen]);

  const section =
    sections.find((item) => item.id === activeId) ?? sections[0];

  const dirtyKeys = useMemo(
    () =>
      section
        ? section.settings
            .filter(
              (setting) =>
                !same(draft[setting.key], setting.value)
            )
            .map((setting) => setting.key)
        : [],
    [section, draft]
  );

  const onSave = async () => {
    if (!section || dirtyKeys.length === 0 || saving) {
      return;
    }

    const clientErrors: Record<string, string> = {};

    for (const setting of section.settings) {
      if (
        !dirtyKeys.includes(setting.key) ||
        (setting.type !== "number" &&
          setting.type !== "integer")
      ) {
        continue;
      }

      const value = draft[setting.key];

      if (
        typeof value !== "number" ||
        !Number.isFinite(value)
      ) {
        clientErrors[setting.key] =
          `${setting.label} must be a number`;
      } else if (
        setting.type === "integer" &&
        !Number.isInteger(value)
      ) {
        clientErrors[setting.key] =
          `${setting.label} must be a whole number`;
      } else if (
        (setting.min !== undefined &&
          value < setting.min) ||
        (setting.max !== undefined &&
          value > setting.max)
      ) {
        clientErrors[setting.key] =
          setting.min !== undefined &&
          setting.max !== undefined
            ? `${setting.label} must be between ${setting.min} and ${setting.max}${setting.unit ? ` ${setting.unit}` : ""}`
            : setting.min !== undefined
              ? `${setting.label} must be at least ${setting.min}`
              : `${setting.label} must be at most ${setting.max}`;
      }
    }

    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors);
      setNotice({
        ok: false,
        text: "Please fix the highlighted field.",
      });
      return;
    }

    setSaving(true);
    setNotice(null);
    setErrors({});

    try {
      const updates = Object.fromEntries(
        dirtyKeys.map((key) => [key, draft[key]])
      );

      const updatedSections = await saveSettings(updates);
      apply(updatedSections);

      setNotice({
        ok: true,
        text: `${section.label} settings saved.`,
      });
    } catch (error) {
      const apiError = error as SettingsApiError;

      setErrors(apiError.fields ?? {});
      setNotice({
        ok: false,
        text:
          apiError.status === 403
            ? "You need the settings:manage permission."
            : apiError.message ||
              "Unable to save settings. Please try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  const onCancel = () => {
    if (!section || saving) {
      return;
    }

    setDraft((current) => ({
      ...current,
      ...Object.fromEntries(
        section.settings.map((setting) => [
          setting.key,
          setting.value,
        ])
      ),
    }));

    setErrors({});
    setNotice(null);
  };

  const pick = (id: string) => {
    setActiveId(id);
    setErrors({});
    setNotice(null);
    setFilterOpen(false);
  };

  const handleFieldChange = (
    key: string,
    value: SettingValue
  ) => {
    setDraft((current) => ({
      ...current,
      [key]: value,
    }));

    setErrors((current) => {
      const { [key]: _removed, ...remaining } = current;
      return remaining;
    });

    setNotice(null);
  };

  const renderFields = (mobile: boolean) => {
    if (!section) {
      return null;
    }

    return section.settings.map((setting) => (
      <SettingField
        key={setting.key}
        mobile={mobile}
        setting={setting}
        value={draft[setting.key] ?? setting.value}
        error={errors[setting.key]}
        onChange={(value) =>
          handleFieldChange(setting.key, value)
        }
      />
    ));
  };

  const renderActions = () => (
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={onSave}
        disabled={saving || dirtyKeys.length === 0}
        className="rounded-xl bg-[#4338ca] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#3730a3] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving
          ? "Saving…"
          : isMobile
            ? "Save changes"
            : "Save"}
      </button>

      <button
        type="button"
        onClick={onCancel}
        disabled={saving || dirtyKeys.length === 0}
        className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Cancel
      </button>

      {notice && (
        <span
          role="status"
          className={`text-sm ${
            notice.ok ? "text-emerald-700" : "text-red-600"
          }`}
        >
          {notice.text}
        </span>
      )}
    </div>
  );

  return (
    <div
      ref={pageRef}
      className={`admin-page-container min-w-0 max-w-full space-y-6 ${
        isMobile ? "!p-4 sm:!p-6" : "p-6"
      }`}
    >
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          Settings
        </h1>

        <p className="mt-1 text-sm text-gray-500">
          Platform rules. Every change is recorded in the audit log.
        </p>
      </header>

      {loading && (
        <div
          className="space-y-3"
          aria-busy="true"
          aria-label="Loading settings"
        >
          <div className="h-12 animate-pulse rounded-2xl bg-slate-100" />
          <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />
          <p className="text-sm text-gray-500">
            Loading settings…
          </p>
        </div>
      )}

      {loadError && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {loadError}
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="ml-2 font-semibold underline"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !loadError && sections.length === 0 && (
        <p className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-500">
          No settings are available.
        </p>
      )}

      {!loading && !loadError && section && (
        <>
          {!isMobile ? (
            <section className="min-w-0 max-w-full overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div
                role="tablist"
                aria-label="Settings sections"
                className="flex w-full max-w-full gap-2 overflow-x-auto overscroll-x-contain border-b border-gray-200 px-4 py-3 [-webkit-overflow-scrolling:touch] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-slate-100 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300"
              >
                {sections.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={item.id === section.id}
                    onClick={(event) => {
                      pick(item.id);
                      event.currentTarget.scrollIntoView({
                        behavior: "smooth",
                        inline: "center",
                        block: "nearest",
                      });
                    }}
                    className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                      item.id === section.id
                        ? "bg-[#4338ca] text-white shadow-sm"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="min-w-0 p-5">
                <p className="text-sm text-gray-500">
                  {section.description}
                </p>

                {renderFields(false)}
                {renderActions()}
              </div>
            </section>
          ) : (
            <div className="grid min-w-0 items-start gap-4">
              <div ref={filterRef} className="relative">
                <button
                  type="button"
                  aria-haspopup="listbox"
                  aria-expanded={filterOpen}
                  onClick={() =>
                    setFilterOpen((open) => !open)
                  }
                  className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm transition active:scale-[.99]"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-[#4338ca]">
                    <SlidersHorizontal
                      size={17}
                      aria-hidden="true"
                    />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Filter
                    </span>

                    <span className="block truncate text-sm font-semibold text-slate-900">
                      {section.label}
                    </span>
                  </span>

                  <ChevronDown
                    size={18}
                    aria-hidden="true"
                    className={`shrink-0 text-slate-400 transition-transform ${
                      filterOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {filterOpen && (
                  <ul
                    role="listbox"
                    aria-label="Settings section"
                    className="absolute inset-x-0 top-full z-20 mt-2 max-h-[60vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl"
                  >
                    {sections.map((item) => {
                      const active = item.id === section.id;

                      return (
                        <li
                          key={item.id}
                          role="option"
                          aria-selected={active}
                        >
                          <button
                            type="button"
                            onClick={() => pick(item.id)}
                            className={`flex w-full items-center justify-between gap-3 rounded-xl px-3.5 py-3 text-left text-sm font-medium transition ${
                              active
                                ? "bg-indigo-50 text-[#4338ca]"
                                : "text-slate-700 hover:bg-slate-50"
                            }`}
                          >
                            {item.label}

                            {active && (
                              <Check
                                size={16}
                                aria-hidden="true"
                              />
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <section
                className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                aria-labelledby="settings-section-title"
              >
                <header className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 bg-gradient-to-r from-indigo-50/70 to-white px-5 py-4">
                  <div className="min-w-0">
                    <h2
                      id="settings-section-title"
                      className="text-base font-bold text-slate-900"
                    >
                      {section.label}
                    </h2>

                    <p className="mt-0.5 text-sm text-slate-500">
                      {section.description}
                    </p>
                  </div>

                  {dirtyKeys.length > 0 && (
                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
                      {dirtyKeys.length} unsaved
                    </span>
                  )}
                </header>

                <div className="divide-y divide-slate-100 px-5">
                  {renderFields(true)}
                </div>

                <footer className="sticky bottom-0 border-t border-slate-100 bg-white/95 px-5 py-3 backdrop-blur">
                  {renderActions()}
                </footer>
              </section>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AdminSettingsPage;

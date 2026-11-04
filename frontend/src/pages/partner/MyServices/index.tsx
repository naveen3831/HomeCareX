import { useEffect, useId, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Search,
  SearchX,
  Sparkles,
} from "lucide-react";
import EmptyState from "@/components/common/EmptyState";
import ErrorState from "@/components/common/ErrorState";
import OfflineState from "@/components/common/OfflineState";
import CategoryIcon from "@/components/customer/CategoryIcon";
import { classifyApiError } from "@/lib/apiError";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useLoad } from "../useLoad";
import {
  getPartnerServices,
  getServiceCategories,
  savePartnerServices,
  type ApprovedService,
  type PartnerServices,
  type ServiceCategoryInfo,
} from "./myServices.api";

export const approvedPartnerServices = [
  "AC Repair",
  "AC Service",
  "Washing Machine",
  "Refrigerator",
  "Geyser",
  "Microwave",
  "Water Purifier",
  "Laptop Repair",
] as const;

export const isApprovedPartnerService = (serviceName: string) =>
  approvedPartnerServices.some(
    (service) => service.toLowerCase() === serviceName.trim().toLowerCase(),
  );

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600";

const sameSet = (a: string[], b: string[]): boolean =>
  a.length === b.length && a.every((x) => b.includes(x));

const OTHER_ID = "__other__";

interface Group {
  id: string;
  name: string;
  icon?: string;
  iconUrl?: string;
  items: ApprovedService[];
}

type Filter = "all" | "on" | "off";

export default function PartnerMyServicesPage() {
  const { status, data, error, reload, setData } =
    useLoad<PartnerServices>(getPartnerServices);
  const online = useOnlineStatus();
  const [selectedOverride, setSelectedOverride] = useState<string[] | null>(null);
  const selected = useMemo(
    () => selectedOverride ?? data?.selectedIds ?? [],
    [selectedOverride, data?.selectedIds],
  );
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const headingId = useId();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [categories, setCategories] = useState<ServiceCategoryInfo[]>([]);

  // Category names/icons are only for grouping. If they fail to load, services still show.
  useEffect(() => {
    let alive = true;
    Promise.resolve()
      .then(() => getServiceCategories())
      .then((list) => {
        if (alive && Array.isArray(list)) setCategories(list);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!showSuccessPopup) return;
    const timer = window.setTimeout(() => setShowSuccessPopup(false), 3500);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowSuccessPopup(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
    };
  }, [showSuccessPopup]);

  const original = data?.selectedIds;
  const dirty = useMemo(
    () => (data ? !sameSet(selected, data.selectedIds) : false),
    [data, selected],
  );
  const { added, removed } = useMemo(() => {
    const base = new Set(original ?? []);
    return {
      added: selected.filter((id) => !base.has(id)).length,
      removed: (original ?? []).filter((id) => !selectedSet.has(id)).length,
    };
  }, [original, selected, selectedSet]);

  const groups = useMemo<Group[]>(() => {
    const q = query.trim().toLowerCase();
    const byCat = new Map<string, Group>();
    const known = new Map(categories.map((c) => [c.id, c]));
    for (const s of data?.approved ?? []) {
      const on = selectedSet.has(s.id);
      if (filter === "on" && !on) continue;
      if (filter === "off" && on) continue;
      if (q && !s.name.toLowerCase().includes(q)) continue;
      const cat = known.get(s.categoryId);
      const id = cat ? cat.id : OTHER_ID;
      let g = byCat.get(id);
      if (!g) {
        g = {
          id,
          name: cat?.name ?? (categories.length ? "Other services" : "Services"),
          icon: cat?.icon,
          iconUrl: cat?.iconUrl,
          items: [],
        };
        byCat.set(id, g);
      }
      g.items.push(s);
    }
    const order = new Map(categories.map((c, i) => [c.id, c.sortOrder ?? i]));
    return [...byCat.values()].sort(
      (a, b) => (order.get(a.id) ?? 9999) - (order.get(b.id) ?? 9999),
    );
  }, [data?.approved, categories, selectedSet, query, filter]);

  const clearFeedback = () => {
    setSaved(false);
    setShowSuccessPopup(false);
    setSaveError(null);
  };

  const apply = (fn: (current: string[]) => string[]) => {
    clearFeedback();
    setSelectedOverride((current) => fn(current ?? data?.selectedIds ?? []));
  };

  const toggle = (id: string) =>
    apply((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const setMany = (ids: string[], on: boolean) =>
    apply((cur) => {
      const rest = cur.filter((x) => !ids.includes(x));
      return on ? [...rest, ...ids] : rest;
    });

  const resetSelection = () => {
    if (!data) return;
    setSelectedOverride(null);
    clearFeedback();
  };

  const save = async () => {
    if (!data || saving || !dirty || !online) return;
    setSaving(true);
    setSaveError(null);
    setShowSuccessPopup(false);
    try {
      const next = await savePartnerServices(selected);
      setData(next);
      setSelectedOverride(null);
      setSaved(true);
      setShowSuccessPopup(true);
    } catch (err) {
      const c = classifyApiError(err, "Could not save your services.");
      setSaveError(c.details?.[0]?.message ?? c.message);
    } finally {
      setSaving(false);
    }
  };

  const total = data?.approved.length ?? 0;
  const pct = total ? Math.round((selected.length / total) * 100) : 0;
  const searching = query.trim().length > 0;

  return (
    <div className="-mx-4 -mt-4 box-border w-auto min-w-0 max-w-none space-y-3 px-3 pb-4 pt-3 sm:mx-auto sm:mt-0 sm:w-full sm:max-w-5xl sm:p-0">
      {showSuccessPopup && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="services-saved-title"
          data-testid="services-saved-popup"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[1px]"
          onClick={() => setShowSuccessPopup(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl border border-line bg-white p-6 text-center shadow-2xl"
          >
            <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <Check size={22} aria-hidden="true" />
            </span>
            <p
              id="services-saved-title"
              role="status"
              aria-live="polite"
              className="text-base font-semibold text-brand"
            >
              Services saved successfully
            </p>
            <p className="mt-1.5 text-sm text-muted">
              Your approved service preferences have been updated.
            </p>
            <button
              type="button"
              autoFocus
              onClick={() => setShowSuccessPopup(false)}
              className={`mt-5 min-h-[40px] min-w-[100px] rounded-lg bg-indigo-700 px-5 text-sm font-medium text-white transition hover:bg-indigo-800 ${focusRing}`}
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* Summary hero */}
      <header className="flex items-center gap-3 rounded-2xl border border-slate-300/70 bg-white p-3 shadow-sm sm:p-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-base font-bold text-slate-900 sm:text-lg">My services</h1>
          <p className="mt-0.5 text-xs leading-snug text-slate-500">
            You get job requests only for services that are on.
          </p>
        </div>
        {status === "ready" && total > 0 && (
          <div className="flex shrink-0 items-center gap-2" aria-live="polite">
            <div className="relative h-11 w-11">
              <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90" aria-hidden="true">
                <circle cx="18" cy="18" r="15.5" fill="none" strokeWidth="4" className="stroke-slate-100" />
                <circle
                  cx="18"
                  cy="18"
                  r="15.5"
                  fill="none"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={`${(pct / 100) * 97.4} 97.4`}
                  className="stroke-indigo-600 transition-all duration-500"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-slate-800">
                {pct}%
              </span>
            </div>
            <span className="text-xs font-semibold leading-tight text-slate-600">
              {selected.length} of {total}
              <span className="block font-normal text-slate-400">on</span>
            </span>
          </div>
        )}
      </header>

      {status === "loading" && (
        <div aria-busy="true" aria-live="polite" data-testid="services-loading" className="space-y-3">
          <span className="sr-only">Loading services</span>
          <div className="h-11 animate-pulse rounded-xl bg-panel" />
          {[0, 1].map((g) => (
            <div key={g} className="space-y-2">
              <div className="h-6 w-40 animate-pulse rounded bg-panel" />
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-16 animate-pulse rounded-xl border border-line bg-panel" />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {status === "offline" && <OfflineState onRetry={reload} />}

      {status === "error" && (
        <ErrorState
          title="Couldn't load your services"
          message={error?.message ?? "Please try again."}
          onRetry={reload}
        />
      )}

      {status === "ready" && data && total === 0 && (
        <EmptyState
          title="No services available yet"
          message="The platform has not approved any services. Check back soon."
          actionLabel="Refresh"
          onAction={reload}
        />
      )}

      {status === "ready" && data && total > 0 && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
          className="w-full min-w-0 space-y-4"
        >
          {/* Search + filter, aligned on one row on wider screens */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="relative block min-w-0 flex-1">
              <span className="sr-only">Search services</span>
              <Search
                size={16}
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-indigo-500"
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search services"
                className="h-11 w-full rounded-xl border-2 border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-500 hover:border-indigo-300 focus:border-indigo-600 focus:outline-none focus:ring-4 focus:ring-indigo-100"
              />
            </label>
            <div
              role="group"
              aria-label="Show services"
              className="grid h-10 shrink-0 grid-cols-3 gap-1 rounded-xl bg-slate-200/70 p-1 text-xs font-semibold sm:w-72"
            >
              {(
                [
                  ["all", `All (${total})`],
                  ["on", `On (${selected.length})`],
                  ["off", `Off (${total - selected.length})`],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={filter === id}
                  onClick={() => setFilter(id)}
                  className={`rounded-lg transition ${focusRing} ${
                    filter === id
                      ? "bg-white text-indigo-700 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div role="group" aria-labelledby={headingId} className="space-y-3">
            <h2 id={headingId} className="sr-only">
              Approved services
            </h2>

            {groups.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line bg-panel px-4 py-8 text-center">
                <SearchX size={26} aria-hidden="true" className="text-slate-400" />
                <p className="text-sm font-medium text-slate-700">No services to show here.</p>
                {(searching || filter !== "all") && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery("");
                      setFilter("all");
                    }}
                    className={`rounded-lg px-3 py-1.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 ${focusRing}`}
                  >
                    Clear search and filters
                  </button>
                )}
              </div>
            ) : (
              groups.map((g) => {
                const ids = g.items.map((s) => s.id);
                const onCount = ids.filter((id) => selectedSet.has(id)).length;
                const allOn = onCount === ids.length;
                const open = searching || !collapsed[g.id];
                const panelId = `${headingId}-${g.id}`;
                return (
                  <section
                    key={g.id}
                    className="overflow-hidden rounded-2xl border border-slate-300/70 bg-white shadow-sm"
                  >
                    <div className="flex items-center gap-2 border-b border-slate-100 bg-white px-3 py-1.5 sm:px-4">
                      <button
                        type="button"
                        aria-expanded={open}
                        aria-controls={panelId}
                        onClick={() => setCollapsed((c) => ({ ...c, [g.id]: open }))}
                        className={`flex min-w-0 flex-1 items-center gap-2.5 rounded-lg py-1 text-left ${focusRing}`}
                      >
                        <CategoryIcon
                          iconUrl={g.iconUrl}
                          hints={[g.icon, g.name]}
                          size={24}
                          float={false}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-bold text-slate-900">
                            {g.name}
                          </span>
                          <span className="block text-[11px] text-slate-400">
                            {onCount} of {ids.length} on
                          </span>
                        </span>
                        <ChevronDown
                          size={18}
                          aria-hidden="true"
                          className={`shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
                        />
                      </button>
                      <button
                        type="button"
                        onClick={() => setMany(ids, !allOn)}
                        className={`shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${focusRing} ${
                          allOn
                            ? "text-slate-500 hover:bg-slate-100"
                            : "text-indigo-700 hover:bg-indigo-50"
                        }`}
                      >
                        {allOn ? "Turn all off" : "Turn all on"}
                      </button>
                    </div>

                    {open && (
                      <ul
                        id={panelId}
                        className="grid grid-cols-1 gap-1.5 p-2 sm:grid-cols-2 sm:gap-2 sm:p-3 lg:grid-cols-3"
                      >
                        {g.items.map((s) => {
                          const on = selectedSet.has(s.id);
                          return (
                            <li key={s.id} className="min-w-0">
                              <label
                                className={`flex min-h-[48px] cursor-pointer select-none items-center gap-2.5 rounded-xl border px-2.5 py-1.5 transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-indigo-600 ${
                                  on
                                    ? "border-slate-200 bg-white shadow-[inset_3px_0_0_0_theme(colors.indigo.500)]"
                                    : "border-slate-100 bg-slate-50 hover:bg-slate-100"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={on}
                                  aria-label={s.name}
                                  onChange={() => toggle(s.id)}
                                  className="peer sr-only"
                                />
                                <span
                                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 transition ${
                                    on ? "" : "opacity-50 grayscale"
                                  }`}
                                >
                                  <CategoryIcon
                                    hints={[s.icon, s.name, s.slug]}
                                    size={22}
                                    float={false}
                                  />
                                </span>
                                <span
                                  className={`min-w-0 flex-1 text-[13px] font-medium leading-snug [overflow-wrap:anywhere] ${
                                    on ? "text-slate-900" : "text-slate-500"
                                  }`}
                                >
                                  {s.name}
                                </span>
                                <span
                                  aria-hidden="true"
                                  className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                                    on ? "bg-indigo-600" : "bg-slate-300"
                                  }`}
                                >
                                  <span
                                    className={`absolute left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                                      on ? "translate-x-4" : "translate-x-0"
                                    }`}
                                  />
                                </span>
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </section>
                );
              })
            )}
          </div>

          {selected.length === 0 && (
            <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <AlertTriangle size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
              Nothing is on yet, so you will not get job requests.
            </p>
          )}

          {!online && (
            <p role="alert" className="text-sm text-orange-700">
              You are offline. Reconnect to save your changes.
            </p>
          )}

          {saveError && (
            <p role="alert" className="text-sm text-red-600">
              {saveError}
            </p>
          )}

          {saved && !dirty && (
            <p role="status" className="sr-only">
              Services saved.
            </p>
          )}

          {/* Save bar */}
          <div className="sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))] z-20 -mx-3 border-t border-line bg-white/95 px-3 py-2 backdrop-blur sm:mx-0 sm:rounded-xl sm:border sm:px-3 lg:bottom-3">
            <div className="mx-auto flex max-w-5xl items-center gap-2">
              <p className="hidden min-w-0 flex-1 items-center gap-1.5 text-xs text-slate-500 sm:flex" aria-live="polite">
                <Sparkles size={14} aria-hidden="true" className="shrink-0 text-indigo-500" />
                {dirty ? (
                  <span className="truncate">
                    Unsaved:{" "}
                    {added > 0 && <b className="text-emerald-700">{added} added</b>}
                    {added > 0 && removed > 0 && " · "}
                    {removed > 0 && <b className="text-rose-700">{removed} removed</b>}
                  </span>
                ) : (
                  <span className="truncate">All changes saved</span>
                )}
              </p>
              <button
                type="button"
                disabled={!dirty || saving}
                onClick={resetSelection}
                className={`min-h-[44px] rounded-xl border border-line bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-panel disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`}
              >
                Reset
              </button>
              <button
                type="submit"
                disabled={!dirty || saving || !online}
                className={`min-h-[44px] flex-1 rounded-xl bg-indigo-700 px-6 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-800 disabled:cursor-not-allowed disabled:bg-indigo-700/60 disabled:text-white sm:flex-none ${focusRing}`}
              >
                {saving
                  ? "Saving…"
                  : dirty
                    ? `Save changes (${added + removed})`
                    : "Save changes"}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
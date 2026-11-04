import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, Loader2, LocateFixed, Plus } from "lucide-react";
import EmptyState from "@/components/common/EmptyState";
import ErrorState from "@/components/common/ErrorState";
import OfflineState from "@/components/common/OfflineState";
import { classifyApiError } from "@/lib/apiError";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { reverseGeocode } from "@/components/customer/maps/osm";
import { useLoad } from "../useLoad";
import { getServiceArea, saveServiceArea, type PartnerServiceArea } from "./serviceArea.api";
import {
  MAX_AREAS,
  MAX_CITIES,
  MAX_RADIUS_KM,
  MIN_RADIUS_KM,
  addEntry,
  emptyForm,
  hasErrors,
  sameForm,
  toForm,
  toInput,
  validateForm,
  type AreaForm,
} from "./serviceAreaModel";
import { suggestCities } from "./indianCities";
import AreaMap from "./AreaMap";
import SavedDialog from "./SavedDialog";

/* ------------------------------------------------------------------ */
/* Shared styles (app palette: indigo text, orange action)            */
/* ------------------------------------------------------------------ */
const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700 focus-visible:ring-offset-2";
const inputCls = `h-11 w-full min-w-0 rounded-xl border border-[#c7cbe8] bg-white px-3 text-base text-ink placeholder:text-muted/60 hover:border-indigo-400 focus:border-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-100 sm:text-sm`;
const cardCls = "rounded-2xl border border-line bg-white p-4 shadow-sm";
const RADIUS_PRESETS = [3, 5, 10, 15, 25, 50] as const;

type GeoNote = { kind: "info" | "success" | "error"; text: string };

/* ------------------------------------------------------------------ */
/* Small pieces                                                        */
/* ------------------------------------------------------------------ */
function StepBadge({ n, done }: { n: number; done: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
        done ? "bg-indigo-700 text-white" : "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200"
      }`}
    >
      {done ? <Check size={13} /> : n}
    </span>
  );
}

function CardHeading({ n, done, title, hint }: { n?: number; done?: boolean; title: string; hint?: string }) {
  return (
    <div className="mb-3 flex items-start gap-2.5">
      {n !== undefined && <StepBadge n={n} done={!!done} />}
      <div className="min-w-0">
        <h2 className="text-sm font-bold leading-6 text-brand">{title}</h2>
        {hint && <p className="text-xs leading-snug text-muted">{hint}</p>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tag input with optional suggestions dropdown                        */
/* ------------------------------------------------------------------ */
interface TagInputProps {
  id?: string;
  label: string;
  hint?: string;
  values: string[];
  max: number;
  placeholder: string;
  error?: string;
  onChange: (next: string[]) => void;
  suggest?: (query: string, exclude: string[]) => string[];
}

function TagInput({ id: idProp, label, hint, values, max, placeholder, error, onChange, suggest }: TagInputProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const listId = `${id}-list`;
  const [text, setText] = useState("");
  const [local, setLocal] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const options = useMemo(() => (suggest && open ? suggest(text, values) : []), [suggest, open, text, values]);
  const expanded = options.length > 0;

  const commit = (raw: string) => {
    const result = addEntry(values, raw, max);
    if (result.error) {
      setLocal(result.error);
      return;
    }
    setLocal(null);
    setText("");
    setOpen(false);
    setActive(-1);
    onChange(result.list);
  };

  const add = () => {
    if (text.trim() === "") return;
    commit(active >= 0 && options[active] ? options[active] : text);
  };

  const shown = local ?? error;
  const errId = `${id}-err`;

  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1 block text-sm font-semibold text-brand">
        {label}
      </label>
      {hint && <p className="mb-2 text-xs text-muted">{hint}</p>}
      <div className="flex min-w-0 gap-2">
        <div className="relative min-w-0 flex-1">
          <input
            id={id}
            value={text}
            maxLength={80}
            placeholder={placeholder}
            autoComplete="off"
            role={suggest ? "combobox" : undefined}
            aria-expanded={suggest ? expanded : undefined}
            aria-controls={suggest ? listId : undefined}
            aria-autocomplete={suggest ? "list" : undefined}
            aria-activedescendant={expanded && active >= 0 ? `${id}-opt-${active}` : undefined}
            aria-invalid={shown ? true : undefined}
            aria-describedby={shown ? errId : undefined}
            onChange={(e) => {
              setText(e.target.value);
              setLocal(null);
              setOpen(true);
              setActive(-1);
            }}
            onFocus={() => text.trim().length >= 2 && setOpen(true)}
            onBlur={() => setOpen(false)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown" && suggest) {
                e.preventDefault();
                setOpen(true);
                setActive((a) => (options.length ? (a + 1) % options.length : -1));
              } else if (e.key === "ArrowUp" && suggest) {
                e.preventDefault();
                setActive((a) => (options.length ? (a <= 0 ? options.length - 1 : a - 1) : -1));
              } else if (e.key === "Escape" && expanded) {
                e.preventDefault();
                setOpen(false);
                setActive(-1);
              } else if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            className={inputCls}
          />
          {suggest && expanded && (
            <ul
              id={listId}
              role="listbox"
              aria-label={`${label} suggestions`}
              className="absolute inset-x-0 top-full z-50 mt-1 max-h-60 overflow-y-auto rounded-xl border border-line bg-white py-1 shadow-lg"
            >
              {options.map((opt, i) => (
                <li
                  key={opt}
                  id={`${id}-opt-${i}`}
                  role="option"
                  aria-selected={i === active}
                  // mousedown (not click) so the input's blur does not close the list first
                  onMouseDown={(e) => {
                    e.preventDefault();
                    commit(opt);
                  }}
                  onMouseEnter={() => setActive(i)}
                  className={`flex min-h-[44px] cursor-pointer items-center px-3 py-1.5 text-[15px] ${
                    i === active
                      ? "bg-indigo-50 font-semibold text-indigo-900 shadow-[inset_3px_0_0_0_#4338ca]"
                      : "bg-white"
                  }`}
                >
                  {opt}
                </li>
              ))}
            </ul>
          )}
        </div>
        <button
          type="button"
          onClick={add}
          className={`h-11 shrink-0 rounded-xl border border-brand-500 bg-white px-4 text-sm font-semibold text-brand transition hover:bg-[#fff5ef] ${focusRing}`}
        >
          Add
        </button>
      </div>
      {shown && (
        <p id={errId} role="alert" className="mt-1 text-xs text-red-600">
          {shown}
        </p>
      )}
      {values.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5" aria-label={`${label} added`}>
          {values.map((v) => (
            <li
              key={v}
              className="inline-flex max-w-full items-center gap-0.5 rounded-full border border-indigo-100 bg-indigo-50 py-0.5 pl-3 pr-0.5 text-sm text-indigo-900"
            >
              <span className="min-w-0 break-words">{v}</span>
              <button
                type="button"
                aria-label={`Remove ${v}`}
                onClick={() => onChange(values.filter((x) => x !== v))}
                className={`flex h-8 w-8 items-center justify-center rounded-full text-indigo-700/70 hover:bg-indigo-100 hover:text-red-600 ${focusRing}`}
              >
                <span aria-hidden="true">×</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */
const toNum = (text: string): number | null => {
  if (text.trim() === "") return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
};

export default function PartnerServiceAreaPage() {
  const { status, data, error, reload, setData } = useLoad<PartnerServiceArea>(getServiceArea);
  const online = useOnlineStatus();
  const [form, setForm] = useState<AreaForm>(emptyForm());
  const [baseline, setBaseline] = useState<AreaForm>(emptyForm());
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<PartnerServiceArea | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [geo, setGeo] = useState<GeoNote | null>(null);
  const [locating, setLocating] = useState(false);
  const [detected, setDetected] = useState<string | null>(null);
  /** True while the base-location name was filled in by us, so moving the pin can refresh it. */
  const labelAuto = useRef(true);

  useEffect(() => {
    if (!data) return;
    const f = toForm(data);
    setForm(f);
    setBaseline(f);
    labelAuto.current = f.label.trim() === "";
  }, [data]);

  const errors = useMemo(() => validateForm(form), [form]);
  const dirty = !sameForm(form, baseline);
  const show = touched ? errors : {};

  const patch = (p: Partial<AreaForm>) => {
    setSaveError(null);
    setForm((f) => ({ ...f, ...p }));
  };

  /** Names the spot under the pin. Optional: if it fails the coordinates are already set. */
  const lookup = (lat: number, lng: number, onPlace?: (where: string) => void) => {
    Promise.resolve(reverseGeocode({ lat, lng }))
      .then((place) => {
        if (!place) return;
        const name = place.area || place.city;
        setDetected(place.city || null);
        const where = [place.area, place.city, place.state].filter(Boolean).join(", ");
        if (where) onPlace?.(where);
        if (name) setForm((f) => (labelAuto.current || !f.label.trim() ? { ...f, label: name } : f));
        labelAuto.current = true;
      })
      .catch(() => undefined);
  };

  const pickOnMap = (lat: number, lng: number) => {
    setGeo(null);
    patch({ lat: lat.toFixed(5), lng: lng.toFixed(5) });
    lookup(lat, lng);
  };

  const useMyLocation = () => {
    if (!("geolocation" in navigator)) {
      setGeo({ kind: "error", text: "Your browser cannot share its location. Enter the coordinates instead." });
      return;
    }
    setGeo({ kind: "info", text: "Finding your location…" });
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const coords = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        patch({ lat: lat.toFixed(5), lng: lng.toFixed(5) });
        setGeo({ kind: "success", text: `Location fetched successfully (${coords}).` });
        lookup(lat, lng, (where) =>
          setGeo({ kind: "success", text: `Location fetched successfully: ${where} (${coords}).` }),
        );
      },
      (err) => {
        setLocating(false);
        setGeo({
          kind: "error",
          text:
            err.code === 1
              ? "Location permission was denied. Allow location access or enter the coordinates."
              : "Could not fetch your location. Try again or enter the coordinates.",
        });
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  const save = async () => {
    setTouched(true);
    if (hasErrors(errors)) {
      const target = errors.baseLocation ? "area-lat" : errors.cities ? "service-cities-input" : "area-radius-number";
      requestAnimationFrame(() => document.getElementById(target)?.focus());
      return;
    }
    if (saving || !online) return;
    setSaving(true);
    setSaveError(null);
    try {
      const input = toInput(form);
      const result = await saveServiceArea(input);
      // Fall back to what was submitted if the API response has an unexpected shape.
      const next: PartnerServiceArea =
        result && Array.isArray(result.cities)
          ? result
          : { ...input, configured: true, updatedAt: null };
      setData(next);
      setSaved(next);
    } catch (err) {
      const c = classifyApiError(err, "Could not save your service area.");
      setSaveError(c.details?.[0]?.message ?? c.message);
    } finally {
      setSaving(false);
    }
  };

  const latNum = toNum(form.lat);
  const lngNum = toNum(form.lng);
  const mapPoint =
    latNum !== null && lngNum !== null && Math.abs(latNum) <= 90 && Math.abs(lngNum) <= 180
      ? { lat: latNum, lng: lngNum }
      : null;
  const radiusNum = toNum(form.radius);
  const radiusValid =
    radiusNum !== null && Number.isInteger(radiusNum) && radiusNum >= MIN_RADIUS_KM && radiusNum <= MAX_RADIUS_KM;
  const sliderValue = radiusValid ? (radiusNum as number) : MIN_RADIUS_KM;
  const coverage = radiusValid ? Math.round(Math.PI * (radiusNum as number) ** 2) : null;

  const locationDone = !validateForm({ ...form, cities: ["x"], radius: "1" }).baseLocation;
  const radiusDone = radiusValid;
  const citiesDone = form.cities.length > 0;
  const stepsDone = [locationDone, radiusDone, citiesDone].filter(Boolean).length;

  const showDetected = detected && !form.cities.some((c) => c.toLowerCase() === detected.toLowerCase());

  return (
    <div
      className="-mx-4 -mt-4 box-border w-auto min-w-0 max-w-none space-y-3 px-3 pb-4 pt-3 sm:mx-auto sm:mt-0 sm:w-full sm:max-w-6xl sm:p-0"
      style={{ overflowX: "clip" }}
      data-page="service-area-v3"
    >
      <header className="flex items-center gap-3 rounded-2xl border border-line bg-white p-3 shadow-sm sm:p-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-base font-bold text-brand sm:text-lg">Service area</h1>
          <p className="mt-0.5 text-xs leading-snug text-muted">
            Job requests are matched using your base location, radius and cities.
          </p>
        </div>
        {status === "ready" && (
          <div className="shrink-0 text-right" aria-live="polite">
            <p className="text-sm font-bold text-brand">{stepsDone} of 3</p>
            <div className="mt-1 flex gap-1" aria-hidden="true">
              {[locationDone, radiusDone, citiesDone].map((d, i) => (
                <span key={i} className={`h-1.5 w-5 rounded-full ${d ? "bg-indigo-600" : "bg-indigo-100"}`} />
              ))}
            </div>
            <span className="sr-only">steps complete</span>
          </div>
        )}
      </header>

      {status === "loading" && (
        <div aria-busy="true" aria-live="polite" className="space-y-3" data-testid="area-loading">
          <span className="sr-only">Loading service area</span>
          <div className="h-64 animate-pulse rounded-2xl border border-line bg-panel" />
          {[0, 1].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl border border-line bg-panel" />
          ))}
        </div>
      )}

      {status === "offline" && <OfflineState onRetry={reload} />}

      {status === "error" && (
        <ErrorState
          title="Couldn't load your service area"
          message={error?.message ?? "Please try again."}
          onRetry={reload}
        />
      )}

      {status === "ready" && data && (
        <>
          {!data.configured && (
            <EmptyState
              title="Service area not set"
              message="Add your base location, the cities you serve and a radius to start receiving job requests."
            />
          )}

          <div className="grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:items-start lg:gap-4">
            {/* Map */}
            <section aria-label="Map" className="min-w-0 overflow-hidden rounded-2xl border border-line bg-white shadow-sm lg:sticky lg:top-20">
              <AreaMap
                lat={mapPoint?.lat ?? null}
                lng={mapPoint?.lng ?? null}
                radiusKm={radiusValid ? (radiusNum as number) : null}
                onPick={pickOnMap}
                onLocate={useMyLocation}
                className="h-[300px] sm:h-[380px] lg:h-[480px]"
              />
              <div className="flex items-center justify-between gap-3 border-t border-line px-3 py-2.5 text-xs">
                <p className="min-w-0 truncate text-muted">
                  {mapPoint ? (
                    <>
                      <span className="font-semibold text-ink">{form.label.trim() || "Base location"}</span>
                      <span className="text-muted/60"> · </span>
                      {mapPoint.lat.toFixed(4)}, {mapPoint.lng.toFixed(4)}
                    </>
                  ) : (
                    "No base location yet"
                  )}
                </p>
                <p className="shrink-0 font-semibold text-brand">
                  {radiusValid ? `${radiusNum} km` : "– km"}
                  {coverage !== null && <span className="font-normal text-muted"> · ~{coverage.toLocaleString("en-IN")} km²</span>}
                </p>
              </div>
            </section>

            {/* Form */}
            <form
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                void save();
              }}
              className="min-w-0 space-y-3"
            >
              <fieldset className={`${cardCls} min-w-0`}>
                <legend className="sr-only">Base location</legend>
                <CardHeading
                  n={1}
                  done={locationDone}
                  title="Base location"
                  hint="Search, tap the map or drag the pin. Fine-tune the coordinates below."
                />
                <div className="space-y-3">
                  <div className="min-w-0">
                    <label htmlFor="area-label" className="mb-1 block text-xs font-semibold text-ink">
                      Name (optional)
                    </label>
                    <input
                      id="area-label"
                      className={inputCls}
                      value={form.label}
                      maxLength={120}
                      placeholder="e.g. Home, Powerpet"
                      onChange={(e) => {
                        labelAuto.current = e.target.value.trim() === "";
                        patch({ label: e.target.value });
                      }}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="min-w-0">
                      <label htmlFor="area-lat" className="mb-1 block text-xs font-semibold text-ink">
                        Latitude
                      </label>
                      <input
                        id="area-lat"
                        className={inputCls}
                        inputMode="decimal"
                        value={form.lat}
                        aria-invalid={show.baseLocation ? true : undefined}
                        aria-describedby={show.baseLocation ? "area-loc-err" : undefined}
                        onChange={(e) => patch({ lat: e.target.value })}
                      />
                    </div>
                    <div className="min-w-0">
                      <label htmlFor="area-lng" className="mb-1 block text-xs font-semibold text-ink">
                        Longitude
                      </label>
                      <input
                        id="area-lng"
                        className={inputCls}
                        inputMode="decimal"
                        value={form.lng}
                        aria-invalid={show.baseLocation ? true : undefined}
                        aria-describedby={show.baseLocation ? "area-loc-err" : undefined}
                        onChange={(e) => patch({ lng: e.target.value })}
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={useMyLocation}
                    disabled={locating}
                    className={`inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-brand-500 bg-white px-4 text-sm font-semibold text-brand transition hover:bg-[#fff5ef] disabled:opacity-60 ${focusRing}`}
                  >
                    {locating ? (
                      <Loader2 size={16} aria-hidden="true" className="animate-spin" />
                    ) : (
                      <LocateFixed size={16} aria-hidden="true" />
                    )}
                    Use my current location
                  </button>
                  {geo && (
                    <p
                      role={geo.kind === "error" ? "alert" : "status"}
                      className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-sm ${
                        geo.kind === "success"
                          ? "border-indigo-100 bg-indigo-50 text-indigo-900"
                          : geo.kind === "error"
                            ? "border-red-200 bg-red-50 text-red-700"
                            : "border-line bg-panel text-muted"
                      }`}
                    >
                      <span aria-hidden="true" className="font-bold">
                        {geo.kind === "success" ? "✓" : geo.kind === "error" ? "!" : "…"}
                      </span>
                      <span className="min-w-0 break-words">{geo.text}</span>
                    </p>
                  )}
                  {show.baseLocation && (
                    <p id="area-loc-err" role="alert" className="text-xs text-red-600">
                      {show.baseLocation}
                    </p>
                  )}
                </div>
              </fieldset>

              <section className={cardCls}>
                <CardHeading
                  n={2}
                  done={radiusDone}
                  title={`Service radius: ${form.radius || "–"} km`}
                  hint={`How far from your base location you will travel (${MIN_RADIUS_KM}–${MAX_RADIUS_KM} km). The circle on the map updates as you change it.`}
                />
                <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Quick radius">
                  {RADIUS_PRESETS.map((p) => {
                    const on = form.radius === String(p);
                    return (
                      <button
                        key={p}
                        type="button"
                        aria-pressed={on}
                        onClick={() => patch({ radius: String(p) })}
                        className={`h-9 min-w-[3.25rem] rounded-full border px-3 text-xs font-semibold transition ${focusRing} ${
                          on
                            ? "border-indigo-700 bg-indigo-50 text-indigo-800 ring-1 ring-indigo-700"
                            : "border-[#c7cbe8] bg-white text-ink hover:bg-indigo-50"
                        }`}
                      >
                        {p} km
                      </button>
                    );
                  })}
                </div>
                <label htmlFor="area-radius" className="sr-only">
                  Service radius slider
                </label>
                <div className="flex min-w-0 items-center gap-3">
                  <input
                    id="area-radius"
                    type="range"
                    min={MIN_RADIUS_KM}
                    max={MAX_RADIUS_KM}
                    step={1}
                    value={sliderValue}
                    onChange={(e) => patch({ radius: e.target.value })}
                    className={`min-w-0 flex-1 accent-indigo-700 ${focusRing}`}
                  />
                  <input
                    id="area-radius-number"
                    aria-label="Radius in km"
                    type="number"
                    inputMode="numeric"
                    min={MIN_RADIUS_KM}
                    max={MAX_RADIUS_KM}
                    value={form.radius}
                    aria-invalid={show.radiusKm ? true : undefined}
                    aria-describedby={show.radiusKm ? "area-radius-err" : undefined}
                    onChange={(e) => patch({ radius: e.target.value })}
                    className={`${inputCls} !w-20 shrink-0 text-center sm:!w-24`}
                  />
                </div>
                <div className="mt-1 flex justify-between text-[11px] text-muted" aria-hidden="true">
                  <span>{MIN_RADIUS_KM} km</span>
                  <span>{MAX_RADIUS_KM} km</span>
                </div>
                {show.radiusKm && (
                  <p id="area-radius-err" role="alert" className="mt-1 text-xs text-red-600">
                    {show.radiusKm}
                  </p>
                )}
              </section>

              <section className={cardCls}>
                <CardHeading n={3} done={citiesDone} title="Cities and areas" />
                <div className="space-y-4">
                  <div>
                    <TagInput
                      id="service-cities-input"
                      label="Service cities"
                      hint="Cities where you accept jobs. Type 2 letters to see suggestions."
                      placeholder="Add a city"
                      values={form.cities}
                      max={MAX_CITIES}
                      error={show.cities}
                      suggest={suggestCities}
                      onChange={(cities) => patch({ cities })}
                    />
                    {showDetected && (
                      <button
                        type="button"
                        onClick={() => {
                          const r = addEntry(form.cities, detected as string, MAX_CITIES);
                          if (!r.error) patch({ cities: r.list });
                        }}
                        className={`mt-2 inline-flex h-9 items-center gap-1.5 rounded-full border border-dashed border-indigo-400 px-3 text-xs font-semibold text-indigo-800 hover:bg-indigo-50 ${focusRing}`}
                      >
                        <Plus size={14} aria-hidden="true" />
                        Add {detected} (near your pin)
                      </button>
                    )}
                  </div>
                  <TagInput
                    label="Preferred areas (optional)"
                    hint="Neighbourhoods you prefer within those cities."
                    placeholder="Add an area"
                    values={form.areas}
                    max={MAX_AREAS}
                    onChange={(areas) => patch({ areas })}
                  />
                </div>
              </section>

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

              <div className="sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))] z-20 -mx-3 border-t border-line bg-white/95 px-3 py-2 backdrop-blur sm:mx-0 sm:rounded-xl sm:border lg:bottom-3">
                <div className="flex items-center gap-2">
                  <p className="hidden min-w-0 flex-1 truncate text-xs text-muted sm:block" aria-live="polite">
                    {dirty ? "You have unsaved changes" : data.configured ? "All changes saved" : "Not saved yet"}
                  </p>
                  <button
                    type="button"
                    disabled={!dirty || saving}
                    onClick={() => {
                      setForm(baseline);
                      setTouched(false);
                      setSaveError(null);
                      setGeo(null);
                    }}
                    className={`h-11 rounded-xl border border-[#c7cbe8] bg-white px-4 text-sm font-semibold text-ink transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`}
                  >
                    Reset
                  </button>
                  <button
                    type="submit"
                    disabled={saving || !online || (data.configured && !dirty)}
                    className={`h-11 flex-1 rounded-xl bg-brand-500 px-6 text-sm font-bold text-white shadow-sm transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none ${focusRing}`}
                  >
                    {saving ? "Saving…" : "Save service area"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </>
      )}

      {saved && (
        <SavedDialog
          title="Service area saved!"
          details={[
            `${saved.cities.length} ${saved.cities.length === 1 ? "city" : "cities"} · ${saved.radiusKm} km radius`,
            saved.baseLocation?.label ? `Base location: ${saved.baseLocation.label}` : "Your base location is set.",
            "Job matching will use your new area.",
          ]}
          onClose={() => setSaved(null)}
        />
      )}
    </div>
  );
}
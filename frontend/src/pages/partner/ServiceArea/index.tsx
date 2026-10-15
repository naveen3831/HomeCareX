import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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

/* ------------------------------------------------------------------ */
/* City suggestions (bundled list, no network calls while typing)     */
/* ------------------------------------------------------------------ */
const INDIAN_CITIES: string[] = [
  // Andhra Pradesh
  "Eluru", "Vijayawada", "Visakhapatnam", "Guntur", "Nellore", "Tirupati", "Kakinada", "Rajahmundry",
  "Kurnool", "Anantapur", "Kadapa", "Ongole", "Machilipatnam", "Bhimavaram", "Tadepalligudem", "Tenali",
  "Narasaraopet", "Chittoor", "Srikakulam", "Vizianagaram", "Amaravati", "Nandyal", "Hindupur", "Proddatur",
  "Madanapalle", "Dharmavaram", "Gudivada", "Tanuku", "Palakollu", "Narsapur", "Amalapuram", "Mangalagiri",
  "Chilakaluripet", "Sattenapalli", "Bapatla", "Chirala", "Markapur", "Gudur", "Adoni", "Yemmiganur",
  "Jangareddygudem", "Nuzvid", "Jaggaiahpet", "Samalkot", "Peddapuram", "Mandapeta", "Ravulapalem",
  // Telangana
  "Hyderabad", "Secunderabad", "Warangal", "Karimnagar", "Nizamabad", "Khammam", "Ramagundam", "Mahbubnagar",
  "Nalgonda", "Adilabad", "Suryapet", "Siddipet", "Miryalaguda", "Mancherial", "Kothagudem", "Jagtial",
  // Metros and major cities
  "Mumbai", "Delhi", "New Delhi", "Bengaluru", "Bangalore", "Chennai", "Kolkata", "Pune", "Ahmedabad", "Surat",
  "Jaipur", "Lucknow", "Kanpur", "Nagpur", "Indore", "Bhopal", "Patna", "Vadodara", "Ghaziabad", "Ludhiana",
  "Agra", "Nashik", "Faridabad", "Meerut", "Rajkot", "Varanasi", "Srinagar", "Aurangabad", "Dhanbad", "Amritsar",
  "Navi Mumbai", "Allahabad", "Prayagraj", "Ranchi", "Howrah", "Coimbatore", "Jabalpur", "Gwalior", "Jodhpur",
  "Madurai", "Raipur", "Kota", "Chandigarh", "Guwahati", "Solapur", "Mysuru", "Mysore", "Hubballi", "Dharwad",
  "Mangaluru", "Belagavi", "Kalaburagi", "Ballari", "Davanagere", "Shivamogga", "Tumakuru", "Thane", "Noida",
  "Gurugram", "Gurgaon", "Dehradun", "Jammu", "Shimla", "Bhubaneswar", "Cuttack", "Puducherry", "Pondicherry",
  "Tiruchirappalli", "Salem", "Tirunelveli", "Erode", "Vellore", "Thoothukudi", "Thanjavur", "Hosur",
  "Kochi", "Thiruvananthapuram", "Kozhikode", "Thrissur", "Kollam", "Kannur", "Alappuzha", "Palakkad",
  "Panaji", "Margao", "Vasco da Gama", "Udaipur", "Ajmer", "Bikaner", "Jamshedpur", "Bokaro", "Siliguri",
  "Durgapur", "Asansol", "Gorakhpur", "Bareilly", "Aligarh", "Moradabad", "Jhansi", "Mathura", "Haridwar",
];

/** Normalises for matching: lower case, accents and extra spaces removed. */
const norm = (s: string): string =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/**
 * Up to `limit` cities for what the partner has typed so far. Starts-with matches come first,
 * then contains matches. Needs at least 2 letters; cities already added are left out.
 */
function suggestCities(query: string, exclude: string[] = [], limit = 6): string[] {
  const q = norm(query);
  if (q.length < 2) return [];
  const taken = new Set(exclude.map(norm));
  const starts: string[] = [];
  const contains: string[] = [];
  for (const city of INDIAN_CITIES) {
    const n = norm(city);
    if (taken.has(n)) continue;
    if (n.startsWith(q)) starts.push(city);
    else if (n.includes(q)) contains.push(city);
  }
  return [...starts, ...contains].slice(0, limit);
}


/* ------------------------------------------------------------------ */
/* Shared styles                                                       */
/* ------------------------------------------------------------------ */
const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2";
const inputCls = `min-h-[44px] w-full min-w-0 rounded border border-line px-3 text-base sm:text-sm ${focusRing}`;
type GeoNote = { kind: "info" | "success" | "error"; text: string };

/* ------------------------------------------------------------------ */
/* Success popup (rendered in document.body so no parent can clip it)  */
/* ------------------------------------------------------------------ */
const prefersReducedMotion = () =>
  typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function SavedDialog({ title, details, onClose }: { title: string; details: string[]; onClose: () => void }) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden"; // page behind must not scroll while the dialog is open
    buttonRef.current?.focus();
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => {
      document.body.style.overflow = prevOverflow;
      cancelAnimationFrame(raf);
      previous?.focus?.();
    };
  }, []);

  return createPortal(
    <div
      style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, overflowY: "auto", background: "rgba(0,0,0,0.45)", opacity: entered ? 1 : 0, transition: prefersReducedMotion() ? "none" : "opacity 200ms" }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
        if (e.key === "Tab") {
          e.preventDefault();
          buttonRef.current?.focus();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="saved-dialog-title"
        aria-describedby="saved-dialog-desc"
        style={{ width: "100%", maxWidth: 384, maxHeight: "calc(100dvh - 32px)", overflowY: "auto", background: "#fff", borderRadius: 16, padding: 24, textAlign: "center", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.35)", transform: entered ? "scale(1)" : "scale(0.95)", transition: prefersReducedMotion() ? "none" : "transform 200ms" }}
      >
        <div style={{ margin: "0 auto 16px", width: 64, height: 64, borderRadius: "50%", background: "#dcfce7", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#16a34a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 id="saved-dialog-title" className="text-lg font-semibold text-brand">
          {title}
        </h2>
        <div id="saved-dialog-desc" className="mt-2 space-y-1 text-sm text-muted">
          {details.map((d) => (
            <p key={d} className="break-words">
              {d}
            </p>
          ))}
        </div>
        <button
          ref={buttonRef}
          type="button"
          onClick={onClose}
          className="mt-6 min-h-[44px] w-full rounded-lg bg-brand-500 px-5 text-sm font-medium text-white transition hover:bg-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
        >
          Done
        </button>
      </div>
    </div>,
    document.body,
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
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-brand">
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
              style={{ position: "absolute", left: 0, right: 0, top: "100%", marginTop: 4, zIndex: 50, maxHeight: "min(240px, 50dvh)", overflowY: "auto", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: "4px 0", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.15)" }}
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
                  style={{ cursor: "pointer", display: "flex", alignItems: "center", minHeight: 44, padding: "6px 12px", fontSize: 15, background: i === active ? "#e0e7ff" : "#fff", boxShadow: i === active ? "inset 4px 0 0 #4338ca" : "none", fontWeight: i === active ? 600 : 400 }}
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
          className={`min-h-[44px] shrink-0 rounded border border-brand-500 px-4 text-sm font-medium text-brand ${focusRing}`}
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
        <ul className="mt-2 flex flex-wrap gap-2" aria-label={`${label} added`}>
          {values.map((v) => (
            <li
              key={v}
              className="inline-flex max-w-full items-center gap-1 rounded-full border border-line bg-panel py-1 pl-3 pr-1 text-sm"
            >
              <span className="min-w-0 break-words">{v}</span>
              <button
                type="button"
                aria-label={`Remove ${v}`}
                onClick={() => onChange(values.filter((x) => x !== v))}
                className={`flex h-8 w-8 items-center justify-center rounded-full text-muted hover:text-red-600 ${focusRing}`}
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

  useEffect(() => {
    if (!data) return;
    const f = toForm(data);
    setForm(f);
    setBaseline(f);
  }, [data]);

  const errors = useMemo(() => validateForm(form), [form]);
  const dirty = !sameForm(form, baseline);
  const show = touched ? errors : {};

  const patch = (p: Partial<AreaForm>) => {
    setSaveError(null);
    setForm((f) => ({ ...f, ...p }));
  };

  const useMyLocation = () => {
    if (!("geolocation" in navigator)) {
      setGeo({ kind: "error", text: "Your browser cannot share its location. Enter the coordinates instead." });
      return;
    }
    setGeo({ kind: "info", text: "Finding your location…" });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const coords = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        patch({ lat: lat.toFixed(5), lng: lng.toFixed(5) });
        setGeo({ kind: "success", text: `Location fetched successfully (${coords}).` });
        // Optional lookup to name the place. If it fails the coordinates are already set.
        reverseGeocode({ lat, lng })
          .then((place) => {
            if (!place) return;
            const where = [place.area, place.city, place.state].filter(Boolean).join(", ");
            if (!where) return;
            setGeo({ kind: "success", text: `Location fetched successfully: ${where} (${coords}).` });
            setForm((f) => (f.label.trim() ? f : { ...f, label: place.area || place.city }));
          })
          .catch(() => undefined);
      },
      (err) =>
        setGeo({
          kind: "error",
          text:
            err.code === 1
              ? "Location permission was denied. Allow location access or enter the coordinates."
              : "Could not fetch your location. Try again or enter the coordinates.",
        }),
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

  const radiusNum = Number(form.radius);
  const sliderValue =
    Number.isFinite(radiusNum) && radiusNum >= MIN_RADIUS_KM && radiusNum <= MAX_RADIUS_KM ? radiusNum : MIN_RADIUS_KM;

  return (
    <div className="w-full min-w-0 max-w-full space-y-3 px-3 pt-2 sm:px-4 sm:pt-3" style={{ overflowX: "clip" }} data-page="service-area-v2">
      <header>
        <h1 className="sr-only">Service area</h1>
        <p className="mx-auto max-w-2xl break-words text-center text-sm text-muted">
          Tell us where you work. Job requests are matched using your base location, cities and radius.
        </p>
      </header>

      {status === "loading" && (
        <div aria-busy="true" aria-live="polite" className="space-y-3" data-testid="area-loading">
          <span className="sr-only">Loading service area</span>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded border border-line bg-panel" />
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

          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
            className="space-y-4"
          >
            <fieldset className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-3">
              <legend className="text-sm font-medium text-brand">Base location</legend>
              <div className="min-w-0">
                <label htmlFor="area-label" className="mb-1 block text-sm">
                  Name (optional)
                </label>
                <input
                  id="area-label"
                  className={inputCls}
                  value={form.label}
                  maxLength={120}
                  placeholder="e.g. Home, Powerpet"
                  onChange={(e) => patch({ label: e.target.value })}
                />
              </div>
              <div className="contents">
                <div className="min-w-0">
                  <label htmlFor="area-lat" className="mb-1 block text-sm">
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
                  <label htmlFor="area-lng" className="mb-1 block text-sm">
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
                className={`min-h-[44px] w-full justify-self-start rounded border border-brand-500 px-4 text-sm font-medium text-brand sm:w-auto md:col-span-3 ${focusRing}`}
              >
                Use my current location
              </button>
              {geo && (
                <p
                  role={geo.kind === "error" ? "alert" : "status"}
                  style={
                    geo.kind === "success"
                      ? { background: "#f0fdf4", borderColor: "#bbf7d0", color: "#166534" }
                      : geo.kind === "error"
                        ? { background: "#fef2f2", borderColor: "#fecaca", color: "#b91c1c" }
                        : undefined
                  }
                  className="flex items-start gap-2 rounded border border-line px-3 py-2 text-sm md:col-span-3"
                >
                  <span aria-hidden="true">{geo.kind === "success" ? "✓" : geo.kind === "error" ? "!" : "…"}</span>
                  <span className="min-w-0 break-words">{geo.text}</span>
                </p>
              )}
              {show.baseLocation && (
                <p id="area-loc-err" role="alert" className="text-xs text-red-600 md:col-span-3">
                  {show.baseLocation}
                </p>
              )}
            </fieldset>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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

            <TagInput
              label="Preferred areas (optional)"
              hint="Neighbourhoods you prefer within those cities."
              placeholder="Add an area"
              values={form.areas}
              max={MAX_AREAS}
              onChange={(areas) => patch({ areas })}
            />
            </div>

            <div>
              <label htmlFor="area-radius" className="mb-1 block text-sm font-medium text-brand">
                Service radius: {form.radius || "–"} km
              </label>
              <p className="mb-2 text-xs text-muted">
                How far from your base location you will travel ({MIN_RADIUS_KM}–{MAX_RADIUS_KM} km).
              </p>
              <div className="flex min-w-0 items-center gap-3">
                <input
                  id="area-radius"
                  type="range"
                  min={MIN_RADIUS_KM}
                  max={MAX_RADIUS_KM}
                  step={1}
                  value={sliderValue}
                  onChange={(e) => patch({ radius: e.target.value })}
                  className={`min-w-0 flex-1 accent-brand-500 ${focusRing}`}
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
                  className={`${inputCls} !w-20 shrink-0 sm:!w-24`}
                />
              </div>
              {show.radiusKm && (
                <p id="area-radius-err" role="alert" className="mt-1 text-xs text-red-600">
                  {show.radiusKm}
                </p>
              )}
            </div>

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
            <div
              style={{ background: "#fff" }}
              className="sticky bottom-0 z-10 -mx-3 flex flex-wrap items-center justify-center gap-3 border-t border-line px-3 py-3 sm:-mx-4 sm:px-4"
            >
              <button
                type="submit"
                disabled={saving || !online || (data.configured && !dirty)}
                className={`min-h-[44px] rounded bg-brand-500 px-5 text-sm font-medium text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`}
              >
                {saving ? "Saving…" : "Save service area"}
              </button>
              <button
                type="button"
                disabled={!dirty || saving}
                onClick={() => {
                  setForm(baseline);
                  setTouched(false);
                  setSaveError(null);
                }}
                className={`min-h-[44px] rounded border border-line px-4 text-sm disabled:opacity-50 ${focusRing}`}
              >
                Reset
              </button>
            </div>
          </form>
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
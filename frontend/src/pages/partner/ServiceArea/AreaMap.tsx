import { useCallback, useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Crosshair, Loader2, LocateFixed, MapPin, Minus, Plus, Search, X } from "lucide-react";
import { searchPlaces, type PlaceResult } from "@/components/customer/maps/osm";

interface AreaMapProps {
  lat: number | null;
  lng: number | null;
  /** null hides the coverage circle (radius field is empty or invalid). */
  radiusKm: number | null;
  /** Called when the partner taps the map, drags the pin or picks a search result. */
  onPick: (lat: number, lng: number) => void;
  /** Ask the browser for the partner's location (handled by the page so messages stay in one place). */
  onLocate: () => void;
  className?: string;
}

/** Hyderabad, only used to open the map somewhere sensible before a base location is set. */
const DEFAULT_CENTER: [number, number] = [17.385, 78.4867];

const round5 = (n: number) => Math.round(n * 1e5) / 1e5;
const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;

/** divIcon avoids Leaflet's default marker images, which bundlers do not resolve. */
const pinIcon = () =>
  L.divIcon({
    className: "",
    iconSize: [28, 36],
    iconAnchor: [14, 34],
    html: '<svg width="28" height="36" viewBox="0 0 28 36" aria-hidden="true" style="filter:drop-shadow(0 2px 3px rgba(15,23,42,.35))"><path d="M14 0C6.3 0 0 6.2 0 13.9 0 24 14 36 14 36s14-12 14-22.1C28 6.2 21.7 0 14 0z" fill="#f5731f"/><circle cx="14" cy="14" r="5" fill="#fff"/></svg>',
  });

const roundBtn =
  "flex h-9 w-9 items-center justify-center rounded-full bg-white text-indigo-800 shadow-md ring-1 ring-indigo-100 transition hover:bg-indigo-50 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700";

/**
 * Interactive service-area map (Leaflet + OpenStreetMap, no API key).
 * Tap the map or drag the pin to set the base location; the circle shows the radius live.
 */
export default function AreaMap({ lat, lng, radiusKm, onPick, onLocate, className }: AreaMapProps) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;
  /** Last position that came from the map itself, so we do not re-centre the map under the partner's finger. */
  const fromMap = useRef<{ lat: number; lng: number } | null>(null);
  const lastRadius = useRef<number | null>(null);

  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchNote, setSearchNote] = useState<string | null>(null);

  const emit = useCallback((p: { lat: number; lng: number }) => {
    const next = { lat: round5(p.lat), lng: round5(p.lng) };
    fromMap.current = next;
    onPickRef.current(next.lat, next.lng);
  }, []);

  // Create the map once.
  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    let map: L.Map;
    try {
      map = L.map(el, {
        center: DEFAULT_CENTER,
        zoom: 5,
        zoomControl: false,
        attributionControl: false, // credited in the footer strip below the map
        scrollWheelZoom: false, // keeps page scrolling smooth; pinch / buttons / double-tap still zoom
        keyboard: true,
      });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
    } catch (err) {
      console.warn("[AreaMap] Map failed to start:", err);
      setFailed(true);
      return;
    }
    mapRef.current = map;
    map.on("click", (e: L.LeafletMouseEvent) => emit(e.latlng));

    const refresh = () => map.invalidateSize();
    const timer = window.setTimeout(refresh, 0);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(refresh) : null;
    ro?.observe(el);

    return () => {
      window.clearTimeout(timer);
      ro?.disconnect();
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      circleRef.current = null;
    };
  }, [emit]);

  // Keep the pin, circle and view in step with the form.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (lat === null || lng === null) {
      markerRef.current?.remove();
      circleRef.current?.remove();
      markerRef.current = null;
      circleRef.current = null;
      return;
    }

    const at: L.LatLngTuple = [lat, lng];
    if (!markerRef.current) {
      const marker = L.marker(at, { icon: pinIcon(), draggable: true, keyboard: false, title: "Base location" }).addTo(map);
      marker.on("dragend", () => emit(marker.getLatLng()));
      markerRef.current = marker;
    } else {
      markerRef.current.setLatLng(at);
    }

    if (radiusKm === null) {
      circleRef.current?.remove();
      circleRef.current = null;
    } else if (!circleRef.current) {
      circleRef.current = L.circle(at, {
        radius: radiusKm * 1000,
        color: "#4338ca",
        weight: 2,
        dashArray: "6 6",
        fillColor: "#4338ca",
        fillOpacity: 0.14,
        interactive: false,
      }).addTo(map);
    } else {
      circleRef.current.setLatLng(at);
      circleRef.current.setRadius(radiusKm * 1000);
    }

    const movedByMap = fromMap.current && near(fromMap.current.lat, lat) && near(fromMap.current.lng, lng);
    const radiusChanged = lastRadius.current !== radiusKm;
    lastRadius.current = radiusKm;
    if (movedByMap && !radiusChanged) return;

    try {
      if (circleRef.current) {
        map.fitBounds(circleRef.current.getBounds(), { padding: [28, 28], maxZoom: 16, animate: true });
      } else {
        map.setView(at, Math.max(map.getZoom(), 13), { animate: true });
      }
    } catch (err) {
      // e.g. the map container has no size yet; the next resize will fix the view.
      console.warn("[AreaMap] Could not move the view:", err);
    }
  }, [lat, lng, radiusKm, emit]);

  const recentre = () => {
    const map = mapRef.current;
    if (!map) return;
    if (circleRef.current) map.fitBounds(circleRef.current.getBounds(), { padding: [28, 28], maxZoom: 16 });
    else if (markerRef.current) map.setView(markerRef.current.getLatLng(), 14);
  };

  const runSearch = async () => {
    const q = query.trim();
    if (q.length < 3) {
      setSearchNote("Type at least 3 letters to search.");
      setResults([]);
      return;
    }
    setSearching(true);
    setSearchNote(null);
    try {
      const found = await searchPlaces(q);
      const list = Array.isArray(found) ? found : [];
      setResults(list);
      if (list.length === 0) setSearchNote("No places found. Try a nearby area or city.");
    } catch {
      setResults([]);
      setSearchNote("Search is not available right now. Tap the map instead.");
    } finally {
      setSearching(false);
    }
  };

  const choose = (r: PlaceResult) => {
    setResults([]);
    setSearchNote(null);
    setQuery(r.title);
    onPickRef.current(round5(r.position.lat), round5(r.position.lng));
  };

  return (
    <div className={`relative isolate overflow-hidden bg-panel ${className ?? ""}`}>
      <div
        ref={elRef}
        role="application"
        aria-label="Service area map. Tap the map or drag the pin to set your base location."
        className="absolute inset-0"
      />

      {failed && (
        <div className="absolute inset-0 z-[500] flex flex-col items-center justify-center gap-2 bg-panel p-6 text-center">
          <MapPin size={28} aria-hidden="true" className="text-muted/60" />
          <p className="text-sm font-medium text-ink">The map could not load.</p>
          <p className="text-xs text-muted">You can still enter your coordinates below.</p>
        </div>
      )}

      {/* Search */}
      <div className="absolute inset-x-3 top-3 z-[1000]">
        <div
          className="flex items-center gap-1 rounded-xl bg-white p-1 shadow-md ring-1 ring-indigo-100 focus-within:ring-2 focus-within:ring-indigo-700"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void runSearch();
            }
          }}
        >
          <Search size={16} aria-hidden="true" className="ml-2 shrink-0 text-indigo-700" />
          <input
            type="search"
            aria-label="Search a place on the map"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSearchNote(null);
              if (!e.target.value) setResults([]);
            }}
            placeholder="Search area, landmark or city"
            className="h-9 min-w-0 flex-1 bg-transparent px-1 text-sm text-ink placeholder:text-muted focus:outline-none"
          />
          {query && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                setQuery("");
                setResults([]);
                setSearchNote(null);
              }}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-indigo-50"
            >
              <X size={14} aria-hidden="true" />
            </button>
          )}
          <button
            type="button"
            onClick={() => void runSearch()}
            disabled={searching}
            className="flex h-9 items-center gap-1 rounded-lg bg-indigo-700 px-3 text-xs font-semibold text-white transition hover:bg-indigo-800 disabled:opacity-60"
          >
            {searching ? <Loader2 size={14} aria-hidden="true" className="animate-spin" /> : "Go"}
            {searching && <span className="sr-only">Searching</span>}
          </button>
        </div>

        {(results.length > 0 || searchNote) && (
          <div className="mt-1.5 overflow-hidden rounded-xl bg-white shadow-lg ring-1 ring-indigo-100">
            {searchNote && <p className="px-3 py-2.5 text-xs text-muted">{searchNote}</p>}
            {results.length > 0 && (
              <ul role="listbox" aria-label="Place results" className="max-h-52 overflow-y-auto py-1">
                {results.map((r) => (
                  <li key={r.id} role="option" aria-selected="false">
                    <button
                      type="button"
                      onClick={() => choose(r)}
                      className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-indigo-50"
                    >
                      <MapPin size={15} aria-hidden="true" className="mt-0.5 shrink-0 text-muted/60" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-ink">{r.title}</span>
                        {r.subtitle && <span className="block truncate text-xs text-muted">{r.subtitle}</span>}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Map controls */}
      <div className="absolute bottom-3 right-3 z-[1000] flex flex-col gap-2">
        <button type="button" aria-label="Centre on my location" title="Use my location" onClick={onLocate} className={roundBtn}>
          <LocateFixed size={17} aria-hidden="true" />
        </button>
        {(lat !== null && lng !== null) && (
          <button type="button" aria-label="Fit the whole service area" title="Fit service area" onClick={recentre} className={roundBtn}>
            <Crosshair size={17} aria-hidden="true" />
          </button>
        )}
        <div className="flex flex-col overflow-hidden rounded-full bg-white shadow-md ring-1 ring-indigo-100">
          <button
            type="button"
            aria-label="Zoom in"
            onClick={() => mapRef.current?.zoomIn()}
            className="flex h-9 w-9 items-center justify-center text-indigo-800 hover:bg-indigo-50 active:bg-indigo-100"
          >
            <Plus size={17} aria-hidden="true" />
          </button>
          <span className="mx-2 h-px bg-indigo-100" aria-hidden="true" />
          <button
            type="button"
            aria-label="Zoom out"
            onClick={() => mapRef.current?.zoomOut()}
            className="flex h-9 w-9 items-center justify-center text-indigo-800 hover:bg-indigo-50 active:bg-indigo-100"
          >
            <Minus size={17} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Hint + attribution */}
      <div className="pointer-events-none absolute bottom-0 left-0 z-[900] flex w-full items-end justify-between gap-2 p-2">
        <span className="rounded-md bg-white/90 px-2 py-1 text-[11px] font-medium text-indigo-900 shadow-sm">
          {lat === null ? "Tap the map to drop your pin" : "Drag the pin to adjust"}
        </span>
        <span className="mr-12 rounded bg-white/80 px-1.5 py-0.5 text-[10px] text-muted">
          ©{" "}
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noreferrer"
            className="pointer-events-auto underline"
          >
            OpenStreetMap
          </a>
        </span>
      </div>
    </div>
  );
}
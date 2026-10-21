import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import api from "@/lib/api";
import { STATUS_LABEL } from "@/pages/partner/JobDetails/jobStatus";
import type { JobStatus } from "@/pages/partner/JobDetails/jobStatus";
import { useLocationSharing } from "@/pages/partner/LocationSharing/useLocationSharing";

/** Mirrors backend JobListItemDto (partner-jobs.types.ts). Coordinates are optional extras. */
export interface LiveJob {
  id: string;
  status: JobStatus;
  service: { name: string };
  customerName: string;
  address: string;
  scheduledAt: string;
  slot: string | null;
  partnerEarning: number;
  coordinates?: unknown;
  location?: { coordinates?: unknown };
}

type State = "loading" | "ready" | "error";
type Point = { lat: number; lng: number };
type LocalProblem = "denied" | "unsupported" | "unavailable" | null;

/** Statuses in which the backend accepts live location (same rule as the navigation page). */
const SHARING_STATUSES = new Set(["en_route", "arrived", "in_progress"]);

/**
 * When the jobs list does not return coordinates, look the address up on
 * OpenStreetMap's free search service (Nominatim).
 */
const GEOCODE_FALLBACK = true;

/** How often the list quietly re-checks the backend for new / changed jobs. */
const POLL_MS = 15_000;

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });

/** Accepts {lat,lng}, {latitude,longitude}, {lat,lon}, [lng,lat] (GeoJSON) or {coordinates:[lng,lat]}. */
const toPoint = (c: unknown): Point | null => {
  if (!c || typeof c !== "object") return null;
  let lat: unknown;
  let lng: unknown;
  if (Array.isArray(c)) {
    [lng, lat] = c;
  } else {
    const o = c as Record<string, unknown>;
    if (Array.isArray(o.coordinates)) return toPoint(o.coordinates);
    lat = o.lat ?? o.latitude;
    lng = o.lng ?? o.lon ?? o.longitude;
  }
  return typeof lat === "number" &&
    typeof lng === "number" &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
    ? { lat, lng }
    : null;
};

/* ---- Distance, ETA and display helpers ---- */
const distanceKm = (a: Point, b: Point) => {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
};

/** City driving at about 25 km/h. This is an estimate, not live traffic. */
const etaMinutes = (km: number) => Math.max(1, Math.round((km / 25) * 60));

const fmtDistance = (km: number) =>
  km < 1
    ? `${Math.round(km * 1000)} m`
    : km < 100
      ? `${km.toFixed(1)} km`
      : `${Math.round(km)} km`;

const fmtEta = (min: number) =>
  min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${min % 60} min`;
const fmtLat = (v: number) =>
  `${Math.abs(v).toFixed(4)}° ${v >= 0 ? "N" : "S"}`;
const fmtLng = (v: number) =>
  `${Math.abs(v).toFixed(4)}° ${v >= 0 ? "E" : "W"}`;
const agoText = (seconds: number) =>
  seconds < 60
    ? `${seconds} ${seconds === 1 ? "second" : "seconds"} ago`
    : `${Math.floor(seconds / 60)} min ago`;

/* ---- Address -> point fallback ---- */
type Geo = { point: Point; approx: boolean };
const geoCache = new Map<string, Geo | null>();
let geoChain: Promise<unknown> = Promise.resolve();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function lookup(q: string): Promise<Point | null | "error"> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=in&q=${encodeURIComponent(q)}`,
      { headers: { Accept: "application/json" } },
    );
    if (!res.ok) return "error";
    const rows = (await res.json()) as { lat: string; lon: string }[];
    return rows[0]
      ? { lat: Number(rows[0].lat), lng: Number(rows[0].lon) }
      : null;
  } catch {
    return "error";
  }
}

function geocode(address: string): Promise<Geo | null> {
  if (geoCache.has(address))
    return Promise.resolve(geoCache.get(address) ?? null);
  const run = geoChain.then(async (): Promise<Geo | null> => {
    if (geoCache.has(address)) return geoCache.get(address) ?? null;
    const parts = address
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const tries =
      parts.length > 1
        ? parts
            .map((_, i) => parts.slice(i).join(", "))
            .slice(0, parts.length - 1)
        : [address];
    for (let i = 0; i < tries.length; i++) {
      const r = await lookup(tries[i]);
      await sleep(1100);
      if (r === "error") return null;
      if (r) {
        const g = { point: r, approx: i > 0 };
        geoCache.set(address, g);
        return g;
      }
    }
    geoCache.set(address, null);
    return null;
  });
  geoChain = run.catch(() => undefined);
  return run;
}

type MapState =
  | { kind: "loading" }
  | { kind: "ready"; point: Point; approx: boolean }
  | { kind: "none" };

function useJobPoint(job: LiveJob): MapState {
  const fromList =
    toPoint(job.location?.coordinates) ?? toPoint(job.coordinates);
  const [looked, setLooked] = useState<MapState>({ kind: "loading" });

  useEffect(() => {
    if (fromList) return;
    if (!GEOCODE_FALLBACK) {
      setLooked({ kind: "none" });
      return;
    }
    let cancelled = false;
    setLooked({ kind: "loading" });
    void geocode(job.address).then((g) => {
      if (!cancelled) {
        setLooked(
          g
            ? { kind: "ready", point: g.point, approx: g.approx }
            : { kind: "none" },
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, [fromList?.lat, fromList?.lng, job.address]);

  return fromList ? { kind: "ready", point: fromList, approx: false } : looked;
}

/* ---- Leaflet map ---- */
const PIN_SVG =
  '<svg width="30" height="40" viewBox="0 0 34 44" xmlns="http://www.w3.org/2000/svg"><path d="M17 2C9 2 3 8 3 16c0 11 14 26 14 26s14-15 14-26C31 8 25 2 17 2z" fill="#b45309" stroke="#fff" stroke-width="2"/><circle cx="17" cy="16" r="5.5" fill="#fff"/></svg>';

const pinIcon = L.divIcon({
  className: "",
  html: PIN_SVG,
  iconSize: [30, 40],
  iconAnchor: [15, 38],
});

const meIcon = L.divIcon({
  className: "",
  html: '<div style="width:16px;height:16px;border-radius:50%;background:#0f766e;border:3px solid #fff;box-shadow:0 0 0 5px rgba(15,118,110,.25)"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

function JobMap({
  customer,
  partner,
  label,
}: {
  customer: Point | null;
  partner: Point | null;
  label: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const viewKey = useRef("");

  useEffect(() => {
    if (!ref.current) return;
    const map = L.map(ref.current, {
      center: [20.5937, 78.9629],
      zoom: 5,
      scrollWheelZoom: false,
      dragging: !L.Browser.mobile,
      keyboard: true, // Arrow keys move the map; +/- zoom when the map is focused.
    });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>',
    }).addTo(map);
    mapRef.current = map;
    layerRef.current = L.layerGroup().addTo(map);
    viewKey.current = "";

    // Re-measure whenever the container changes size (viewport resize,
    // sidebar toggle, layout switch). rAF avoids "ResizeObserver loop" errors.
    let raf = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => map.invalidateSize());
    });
    ro.observe(ref.current);

    requestAnimationFrame(() => map.invalidateSize());
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    if (customer && partner) {
      L.polyline(
        [
          [partner.lat, partner.lng],
          [customer.lat, customer.lng],
        ],
        { color: "#0f766e", weight: 5, opacity: 0.9, lineCap: "round" },
      ).addTo(layer);
    }
    if (customer) {
      L.marker([customer.lat, customer.lng], {
        icon: pinIcon,
        keyboard: false,
      }).addTo(layer);
    }
    if (partner) {
      L.marker([partner.lat, partner.lng], {
        icon: meIcon,
        keyboard: false,
      }).addTo(layer);
    }

    const key = `${customer ? `c${customer.lat},${customer.lng}` : "-"}|${partner ? "p" : "-"}`;
    if (key !== viewKey.current) {
      viewKey.current = key;
      if (customer && partner) {
        map.fitBounds(
          L.latLngBounds(
            [partner.lat, partner.lng],
            [customer.lat, customer.lng],
          ),
          { padding: [36, 36], maxZoom: 16 },
        );
      } else if (customer) {
        map.setView([customer.lat, customer.lng], 16);
      } else if (partner) {
        map.setView([partner.lat, partner.lng], 15);
      }
    }
  }, [customer?.lat, customer?.lng, partner?.lat, partner?.lng]);

  return (
    <div
      ref={ref}
      role="region"
      aria-label={`Map showing ${label}`}
      tabIndex={0}
      className="jobs-map h-full w-full min-w-0 max-w-full outline-none"
    />
  );
}

function MapBox({
  map,
  partner,
  address,
}: {
  map: MapState;
  partner: Point | null;
  address: string;
}) {
  const customer = map.kind === "ready" ? map.point : null;
  const showMap = Boolean(customer || partner);
  const note =
    map.kind === "none" && partner
      ? "Customer pin not found"
      : map.kind === "ready" && map.approx
        ? "Approximate pin"
        : null;

  return (
    <div className="relative isolate h-full w-full min-w-0 max-w-full overflow-hidden bg-[#e4ece8]">
      {showMap ? (
        <JobMap
          customer={customer}
          partner={partner}
          label={`the customer location, ${address}`}
        />
      ) : map.kind === "loading" ? (
        <div
          className="h-full w-full animate-pulse bg-[#e4ece8]"
          role="status"
          aria-label="Loading map"
        />
      ) : (
        <p className="flex h-full items-center justify-center px-6 text-center text-xs text-muted">
          Map unavailable for this address. Open navigation to see directions.
        </p>
      )}
      {note && (
        <span className="absolute left-14 top-3 z-[500] max-w-[calc(100%-4rem)] rounded bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-[#8a5a00] shadow-sm sm:left-16 sm:top-4">
          {note}
        </span>
      )}
    </div>
  );
}

/* ---- Small UI pieces ---- */
function Label({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase leading-none tracking-wide text-muted">
      {children}
    </p>
  );
}

const ring =
  "focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#4f46e5]";

const outlineBtn = `flex min-h-11 sm:min-h-12 xl:min-h-11 min-w-0 w-full max-sm:flex-1 items-center justify-center rounded-xl border border-[#abd8d0] bg-white px-2.5 text-center text-sm font-bold text-[#0f766e] transition-colors hover:bg-[#ecf7f4] ${ring}`;

const wrapText = "break-words [overflow-wrap:anywhere]";

/* ---- One job card ---- */
export function JobCard({
  job: j,
  isSingle,
}: {
  job: LiveJob;
  isSingle?: boolean;
}) {
  const sharing = useLocationSharing(j.id);
  const customerMap = useJobPoint(j);
  const customer = customerMap.kind === "ready" ? customerMap.point : null;

  const [started, setStarted] = useState(false);
  const [localPoint, setLocalPoint] = useState<Point | null>(null);
  const [localProblem, setLocalProblem] = useState<LocalProblem>(null);
  const watchRef = useRef<number | null>(null);

  const canShare = SHARING_STATUSES.has(j.status);
  const travelling = j.status === "assigned" || j.status === "en_route";

  const startLocal = () => {
    setLocalProblem(null);
    if (!navigator.geolocation) {
      setLocalProblem("unsupported");
      return;
    }
    if (watchRef.current !== null) return;
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) =>
        setLocalPoint({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => {
        setLocalProblem(err.code === 1 ? "denied" : "unavailable");
        if (watchRef.current !== null) {
          navigator.geolocation.clearWatch(watchRef.current);
          watchRef.current = null;
        }
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    );
  };

  const stopLocal = () => {
    if (watchRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchRef.current);
    }
    watchRef.current = null;
    setLocalPoint(null);
  };

  useEffect(
    () => () => {
      if (watchRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchRef.current);
      }
    },
    [],
  );

  const geoProblem = sharing.geoProblem ?? localProblem;
  const partner = toPoint(sharing.coords) ?? localPoint;
  const active = sharing.sharing || (started && !geoProblem);

  const lat = partner?.lat;
  const lng = partner?.lng;
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (lat !== undefined && lng !== undefined) setUpdatedAt(Date.now());
  }, [lat, lng]);

  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(t);
  }, [active]);

  const agoSeconds =
    updatedAt !== null
      ? Math.max(0, Math.round((now - updatedAt) / 1000))
      : null;

  const km = partner && customer ? distanceKm(partner, customer) : null;

  const startNavigation = () => {
    setStarted(true);
    if (canShare) sharing.start();
    else startLocal();
  };

  const stopNavigation = () => {
    if (sharing.sharing) {
      void Promise.resolve(sharing.stop()).finally(() => setStarted(false));
    } else {
      stopLocal();
      setStarted(false);
    }
  };

  const alertText =
    geoProblem === "denied"
      ? "Location permission is blocked. Allow it in your browser settings, then tap Start navigation again."
      : geoProblem === "unsupported"
        ? "This browser does not support location sharing."
        : geoProblem === "unavailable"
          ? "Could not read your location. Check that location is on, then try again."
          : sharing.ended
            ? "Sharing stopped because this job is no longer active."
            : (sharing.sendProblem ?? null);

  const hint =
    km !== null
      ? "Straight-line estimate at city speed, not live traffic."
      : !customer && customerMap.kind === "none"
        ? "ETA unavailable: the customer's pin could not be found."
        : active
          ? "Waiting for your location…"
          : "Tap Start navigation to see ETA and distance.";

  return (
    <li className="w-full min-w-0 max-w-full list-none">
      <article
        className={`w-full min-w-0 max-w-full overflow-hidden supports-[overflow:clip]:overflow-clip rounded-2xl border border-slate-200 bg-white shadow-[0_10px_36px_rgba(15,23,42,0.06)] sm:rounded-[24px] ${
          isSingle
            ? // Map left / details right on desktop. The card height is fixed to
              // the space left under the header + page heading (--chrome), so the
              // heading and card always fit one screen and the card never changes
              // size (e.g. when navigation starts). If the details ever need more
              // room, only the details pane scrolls; the action buttons stay pinned.
              "xl:grid xl:h-[max(480px,calc(100dvh_-_var(--chrome,14rem)))] xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] xl:grid-rows-[minmax(0,1fr)]"
            : "flex flex-col"
        }`}
      >
        {/* Map pane. Explicit heights are for the map only (Leaflet needs a sized box). */}
        <div
          className={`relative isolate min-w-0 max-w-full overflow-hidden bg-[#e5eee9] ${
            isSingle
              ? "h-[clamp(150px,26dvh,230px)] sm:h-[320px] lg:h-[380px] xl:h-auto xl:min-h-0"
              : "h-[clamp(150px,26dvh,220px)] sm:h-[250px] lg:h-[260px]"
          }`}
        >
          <MapBox
            map={customerMap}
            partner={active ? partner : null}
            address={j.address}
          />
          <div className="pointer-events-none absolute right-3 top-3 z-[500] hidden items-center gap-2 rounded-full border border-white/80 bg-white/95 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-700 shadow-md sm:flex sm:right-4 sm:top-4 sm:text-xs">
            <span className="h-2 w-2 rounded-full bg-[#0f766e]" />
            Job location
          </div>
          {/* bottom-8 keeps the Leaflet / OSM attribution readable */}
          <div className="pointer-events-none absolute bottom-8 left-3 z-[500] hidden w-[min(24rem,calc(100%_-_1.5rem))] rounded-2xl border border-white/80 bg-white/95 p-3 shadow-lg backdrop-blur-sm sm:left-4 sm:block sm:w-[min(24rem,calc(100%_-_2rem))]">
            <Label>Service location</Label>
            <p
              className={`mt-1 text-sm font-semibold text-slate-900 ${wrapText}`}
            >
              {j.customerName}
            </p>
            <p
              className={`mt-0.5 line-clamp-2 text-xs leading-relaxed text-slate-600 ${wrapText}`}
            >
              {j.address}
            </p>
          </div>
        </div>

        {/* Details pane */}
        <div
          className={`flex min-w-0 max-w-full flex-col p-3.5 min-[400px]:p-4 sm:p-6 ${isSingle ? "lg:p-7 xl:min-h-0 xl:overflow-y-auto xl:overscroll-contain xl:scroll-pb-24 xl:p-5" : ""}`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#4f46e5]">
              Assigned booking
            </p>
            <div className="flex items-center gap-2">
              <Link
                to={`/partner/jobs/${j.id}`}
                className="text-xs font-semibold text-[#4f46e5] hover:underline"
              >
                View details &rarr;
              </Link>
              <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-[#e7f4ef] px-3 py-1.5 text-xs font-semibold text-[#0f766e]">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#0f766e]" />
                {STATUS_LABEL[j.status]}
              </span>
            </div>
          </div>

          <h3
            className={`mt-2 text-xl font-extrabold leading-tight tracking-tight text-slate-900 sm:mt-3 sm:text-[28px] xl:text-[26px] ${wrapText}`}
          >
            <Link
              to={`/partner/jobs/${j.id}`}
              className="hover:text-[#4f46e5] hover:underline transition-colors"
            >
              {j.service.name}
            </Link>
          </h3>
          <p
            className={`mt-1 text-xs leading-relaxed text-slate-500 sm:mt-2 sm:text-sm ${wrapText}`}
          >
            Job{" "}
            <Link
              to={`/partner/jobs/${j.id}`}
              className="font-semibold text-slate-700 hover:text-[#4f46e5] hover:underline transition-colors"
            >
              #{j.id.slice(-8).toUpperCase()}
            </Link>
            <span className="mx-2 text-slate-300" aria-hidden="true">
              •
            </span>
            {when(j.scheduledAt)}
            {j.slot ? ` · ${j.slot}` : ""}
          </p>

          {active && (
            <div
              role="status"
              className={`mt-3 flex items-start gap-2.5 rounded-xl border px-3 py-2 ${
                sharing.sharing
                  ? "border-teal-200 bg-teal-50"
                  : "border-amber-200 bg-amber-50"
              }`}
            >
              <span className="relative mt-1.5 flex h-2.5 w-2.5 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-40" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#0f766e]" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-800">
                  {sharing.sharing
                    ? "Live location is being shared"
                    : "Navigation started"}
                </p>
                <p className="mt-0.5 text-xs leading-snug text-slate-600">
                  {sharing.sharing
                    ? "The customer can see you on your way."
                    : "Location is visible only on your device. Mark the job On the way to share it."}
                </p>
                {!sharing.sharing && (
                  <Link
                    to={`/partner/jobs/${j.id}/navigation`}
                    className={`mt-1.5 inline-block rounded text-xs font-bold text-[#0f766e] underline underline-offset-2 ${ring}`}
                  >
                    Open job page
                  </Link>
                )}
              </div>
            </div>
          )}

          {alertText && (
            <div
              className={`mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs leading-relaxed text-red-700 ${wrapText}`}
              role="alert"
            >
              {alertText}
            </div>
          )}

          <div className="mt-3 grid min-w-0 grid-cols-2 gap-2 sm:mt-4 sm:gap-3 xl:mt-3">
            <div className="min-w-0 rounded-2xl bg-[#ecf7f4] px-2.5 py-2.5 sm:px-4 sm:py-3 xl:px-3 xl:py-2.5">
              <Label>ETA</Label>
              <p
                className={`mt-1.5 text-sm font-extrabold leading-tight sm:mt-2 text-slate-900 sm:text-lg xl:text-base ${wrapText}`}
              >
                {km !== null && travelling
                  ? `~${fmtEta(etaMinutes(km))}`
                  : km !== null
                    ? "At location"
                    : "—"}
              </p>
            </div>
            <div className="min-w-0 rounded-2xl bg-slate-100 px-2.5 py-2.5 sm:px-4 sm:py-3 xl:px-3 xl:py-2.5">
              <Label>Distance</Label>
              <p
                className={`mt-1.5 text-sm font-extrabold leading-tight sm:mt-2 text-slate-900 sm:text-lg xl:text-base ${wrapText}`}
              >
                {km !== null ? `~${fmtDistance(km)}` : "—"}
              </p>
            </div>
          </div>

          <div className="mt-3 min-w-0 rounded-2xl border border-slate-200 bg-white p-3 sm:mt-4 sm:p-4 xl:mt-3 xl:py-3">
            {/* Header row is dropped on desktop: the section labels below say the same thing. */}
            <div className="hidden items-center gap-3 sm:flex xl:hidden">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600"
                aria-hidden="true"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5"
                >
                  <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
                  <circle cx="12" cy="10" r="2.5" />
                </svg>
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900">
                  Location details
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Your position and customer address
                </p>
              </div>
            </div>

            <div className="sm:mt-3 sm:border-t sm:border-slate-100 sm:pt-3 xl:mt-0 xl:border-t-0 xl:pt-0">
              {active ? (
                <>
                  <Label>Your live location</Label>
                  <p
                    className={`mt-1 text-sm font-semibold text-slate-800 ${wrapText}`}
                  >
                    <abbr title="Latitude" className="no-underline">
                      Lat
                    </abbr>{" "}
                    {partner ? fmtLat(partner.lat) : "Waiting…"}
                    <span className="mx-1.5 text-slate-300" aria-hidden="true">
                      ·
                    </span>
                    <abbr title="Longitude" className="no-underline">
                      Lng
                    </abbr>{" "}
                    {partner ? fmtLng(partner.lng) : "Waiting…"}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Last updated:{" "}
                    {agoSeconds !== null
                      ? agoText(agoSeconds)
                      : "Waiting for GPS…"}
                  </p>
                </>
              ) : (
                <>
                  <Label>Your location</Label>
                  <p className="mt-1 text-sm font-semibold text-slate-800">
                    {partner
                      ? "Detected on this device"
                      : "Start navigation to detect your location"}
                  </p>
                </>
              )}
              <div className="mt-3 border-t border-slate-100 pt-3">
                <Label>Customer location</Label>
                <p
                  className={`mt-1.5 text-sm font-semibold text-slate-800 ${wrapText}`}
                >
                  {j.customerName}
                </p>
                <p
                  className={`mt-1 text-xs leading-relaxed text-slate-500 sm:text-sm ${wrapText}`}
                >
                  {j.address}
                </p>
              </div>
            </div>
          </div>

          <p className="mt-2 text-xs leading-relaxed text-slate-500 sm:mt-3 xl:mt-2">
            {hint}
          </p>

          <div
            className={`sticky bottom-0 z-10 -mx-3.5 -mb-3.5 mt-auto flex items-stretch gap-2 border-t border-slate-200 bg-white/95 px-3.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2.5 backdrop-blur min-[400px]:-mx-4 min-[400px]:-mb-4 min-[400px]:px-4 sm:static sm:z-auto sm:mx-0 sm:mb-0 sm:block sm:border-t-0 sm:bg-transparent sm:px-0 sm:pb-0 sm:pt-5 sm:backdrop-blur-none xl:pt-3 ${isSingle ? "xl:sticky xl:bottom-0 xl:z-10 xl:-mx-5 xl:-mb-5 xl:border-t xl:border-slate-200 xl:bg-white xl:px-5 xl:pb-4" : ""}`}
          >
            {active ? (
              <button
                type="button"
                onClick={stopNavigation}
                disabled={sharing.stopping}
                className={`flex min-h-11 sm:min-h-[50px] xl:min-h-12 w-full max-sm:flex-[3] items-center justify-center rounded-xl border border-red-300 bg-white px-4 text-sm font-bold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 ${ring}`}
              >
                {sharing.stopping
                  ? "Stopping…"
                  : sharing.sharing
                    ? "Stop sharing"
                    : "Stop navigation"}
              </button>
            ) : (
              <button
                type="button"
                onClick={startNavigation}
                className={`flex min-h-11 sm:min-h-[50px] xl:min-h-12 w-full max-sm:flex-[3] items-center justify-center gap-2 rounded-xl bg-[#0f766e] px-4 text-sm font-bold text-white shadow-[0_6px_16px_rgba(15,118,110,0.20)] transition hover:bg-[#0b5b55] ${ring}`}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                  aria-hidden="true"
                >
                  <path d="m3 11 19-9-9 19-2.6-7.4L3 11Z" />
                </svg>
                Start navigation
              </button>
            )}
            <div className="contents sm:mt-3 sm:grid sm:min-w-0 sm:grid-cols-3 sm:gap-2.5">
              <Link
                to={`/partner/jobs/${j.id}`}
                aria-label="View job details"
                className={outlineBtn}
              >
                <span className="sm:hidden" aria-hidden="true">
                  Details
                </span>
                <span className="hidden sm:inline" aria-hidden="true">
                  Job details
                </span>
              </Link>
              <Link
                to={`/partner/jobs/${j.id}/navigation?panel=call`}
                aria-label="Call customer"
                className={outlineBtn}
              >
                <span className="sm:hidden" aria-hidden="true">
                  Call
                </span>
                <span className="hidden sm:inline" aria-hidden="true">
                  Call customer
                </span>
              </Link>
              <Link
                to={`/partner/jobs/${j.id}/navigation?panel=chat`}
                className={outlineBtn}
              >
                Chat
              </Link>
            </div>
          </div>
        </div>
      </article>
    </li>
  );
}

/** The signed-in partner's real jobs (GET /partner/jobs). */
export default function LiveJobsList({
  heading = "Your assigned jobs",
}: {
  heading?: string;
}) {
  const [jobs, setJobs] = useState<LiveJob[]>([]);
  const [state, setState] = useState<State>("loading");
  const [reloadKey, setReloadKey] = useState(0);
  const [announce, setAnnounce] = useState("");
  const knownIds = useRef<Set<string> | null>(null);

  useEffect(() => {
    let cancelled = false;
    let inFlight = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    // background = true: silent refresh (no skeleton, errors ignored so the
    // jobs already on screen stay put). The first load / Retry shows states.
    const load = async (background: boolean) => {
      if (inFlight) return;
      inFlight = true;
      if (!background) setState("loading");
      try {
        const res = await api.get<{ data: LiveJob[] }>("/partner/jobs");
        if (cancelled) return;
        const next = res.data.data;

        // Tell screen-reader users when a new job shows up.
        const known = knownIds.current;
        if (known) {
          const added = next.filter((j) => !known.has(j.id)).length;
          if (added > 0)
            setAnnounce(
              `${added} new ${added === 1 ? "job" : "jobs"} assigned to you`,
            );
        }
        knownIds.current = new Set(next.map((j) => j.id));

        // Keep the same array when nothing changed, so cards (and the maps /
        // GPS watchers inside them) are not re-rendered for no reason.
        setJobs((prev) =>
          JSON.stringify(prev) === JSON.stringify(next) ? prev : next,
        );
        setState("ready");
      } catch {
        if (!cancelled && !background) setState("error");
      } finally {
        inFlight = false;
      }
    };

    const schedule = () => {
      timer = setTimeout(async () => {
        if (!document.hidden) await load(true);
        if (!cancelled) schedule();
      }, POLL_MS);
    };

    // Refresh straight away when the partner comes back to the tab / is online again.
    const refreshNow = () => {
      if (!document.hidden) void load(true);
    };

    knownIds.current = null;
    void load(false);
    schedule();
    document.addEventListener("visibilitychange", refreshNow);
    window.addEventListener("online", refreshNow);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", refreshNow);
      window.removeEventListener("online", refreshNow);
    };
  }, [reloadKey]);

  const isSingleJob = jobs.length === 1;
  // The sidebar takes 16rem at >=1024px, so 2 columns only start at 1280px
  // (xl) and 3 only at 1920px (3xl-ish via min-[1900px]).
  const gridClasses = isSingleJob
    ? "grid-cols-1"
    : jobs.length === 2
      ? "grid-cols-1 xl:grid-cols-2"
      : "grid-cols-1 xl:grid-cols-2 min-[1900px]:grid-cols-3";

  return (
    <section
      aria-label={heading}
      data-jobs-layout
      className="box-border w-full min-w-0 max-w-full bg-[#f7f9fc] px-3 py-3 min-[400px]:px-4 sm:px-6 sm:py-6 lg:px-8 lg:py-5 [--chrome:14rem]"
    >
      {/* Visible keyboard focus for Leaflet controls + generic fallback ring. */}
      <style>{`
        [data-jobs-layout] :focus-visible { outline: 3px solid #4f46e5; outline-offset: 2px; }
        [data-jobs-layout] .jobs-map:focus-visible { outline: 3px solid #4f46e5 !important; outline-offset: -4px; }
        [data-jobs-layout] .leaflet-control-zoom a:focus-visible,
        [data-jobs-layout] .leaflet-control-attribution a:focus-visible {
          outline: 3px solid #4f46e5 !important;
          outline-offset: 2px;
          box-shadow: 0 0 0 4px white;
        }
        [data-jobs-layout] .leaflet-container { max-width: 100%; }
        @media (max-width: 639px) { [data-jobs-layout] :focus-visible { scroll-margin-bottom: 6rem; } }
        @media (prefers-reduced-motion: reduce) {
          [data-jobs-layout] .animate-pulse,
          [data-jobs-layout] .animate-ping { animation: none !important; }
        }
      `}</style>
      <p className="sr-only" role="status" aria-live="polite">
        {announce}
      </p>
      <div className="mb-3 flex w-full min-w-0 flex-wrap items-start justify-between gap-2 sm:mb-6 sm:gap-3 xl:mb-4">
        <div className="min-w-0 flex-1 basis-[11rem] sm:basis-[20rem]">
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.17em] text-[#4f46e5] xl:mb-1">
            Partner workspace
          </p>
          <h2
            className={`text-[23px] font-extrabold leading-tight tracking-tight text-slate-900 sm:text-[30px] xl:text-[26px] ${wrapText}`}
          >
            {heading}
          </h2>
          <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-slate-500 sm:text-sm xl:mt-1">
            View your bookings, customer locations and live navigation in one
            place.
          </p>
        </div>
        {state === "ready" && (
          <div className="inline-flex shrink-0 items-center gap-2 rounded-full border border-indigo-100 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm sm:px-4 sm:py-2 sm:text-sm">
            <span className="h-2 w-2 rounded-full bg-[#4f46e5]" />
            {jobs.length} {jobs.length === 1 ? "Active job" : "Active jobs"}
          </div>
        )}
      </div>

      {state === "loading" && (
        <div
          className="grid w-full min-w-0 grid-cols-1 gap-4 xl:grid-cols-2 xl:gap-6"
          aria-busy="true"
        >
          {[1, 2].map((n) => (
            <div
              key={n}
              className="min-w-0 overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm"
            >
              <div className="h-64 w-full animate-pulse bg-slate-200" />
              <div className="space-y-4 p-6">
                <div className="h-5 w-1/2 animate-pulse rounded-md bg-slate-200" />
                <div className="h-4 w-2/3 animate-pulse rounded-md bg-slate-100" />
                <div className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-3">
                  {[1, 2, 3].map((k) => (
                    <div
                      key={k}
                      className="h-20 animate-pulse rounded-xl bg-slate-100"
                    />
                  ))}
                </div>
                <div className="h-20 animate-pulse rounded-xl bg-slate-100" />
                <div className="h-12 animate-pulse rounded-xl bg-slate-200" />
              </div>
            </div>
          ))}
        </div>
      )}

      {state === "error" && (
        <div
          className="w-full rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700"
          role="alert"
        >
          <p className="font-bold">Could not load your jobs.</p>
          <p className="mt-1 text-red-600">
            Check your connection and try again.
          </p>
          <button
            type="button"
            className={`mt-4 min-h-11 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-red-700 ${ring}`}
            onClick={() => setReloadKey((k) => k + 1)}
          >
            Retry loading
          </button>
        </div>
      )}

      {state === "ready" && jobs.length === 0 && (
        <div className="flex min-h-[260px] w-full flex-col items-center justify-center rounded-[24px] border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-[#4f46e5]">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-7 w-7"
              aria-hidden="true"
            >
              <rect x="3" y="5" width="18" height="16" rx="2" />
              <path d="M8 3v4M16 3v4M3 10h18" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-slate-900">
            No jobs assigned right now
          </h3>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-slate-500">
            New bookings appear here automatically as soon as they are assigned
            to you.
          </p>
        </div>
      )}

      {state === "ready" && jobs.length > 0 && (
        <ul
          className={`grid w-full min-w-0 list-none gap-4 p-0 sm:gap-6 ${gridClasses}`}
        >
          {jobs.map((j) => (
            <JobCard key={j.id} job={j} isSingle={isSingleJob} />
          ))}
        </ul>
      )}
    </section>
  );
}

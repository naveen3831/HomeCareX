import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import clsx from "clsx";
import { Crosshair, MapPin, Minus, Plus } from "lucide-react";
import "leaflet/dist/leaflet.css";
import "./tracking-map.css";
import type { MapPoint } from "../trackingModel";

interface Props {
  /** The customer's address. Null when the booking has no coordinates. */
  destination: MapPoint | null;
  /** The partner's live or last known position. */
  partner: MapPoint | null;
  /** True when `partner` is a last known position, not a live one: the pin is dimmed. */
  stale: boolean;
  /** Text alternative for the map, e.g. "Your partner is about 3.2 km from your address." */
  summary: string;
  partnerName?: string;
  /** Already formatted, e.g. "4.8". */
  partnerRating?: string | null;
  partnerPhoto?: string | null;
  /** Small card at the top left, e.g. "Partner arriving" + "Reach your location in 12 min". */
  overlayTitle?: string | null;
  overlayText?: string | null;
  /** Chip at the bottom left, e.g. "Last updated 2 min ago". */
  updatedLabel?: string | null;
  /** Incremented when the user clicks "View Last Known Location" to zoom directly onto the partner pin. */
  focusPartnerKey?: number;
  /** Called when the user clicks Recenter to restore full route bounds. */
  onResetFocus?: () => void;
}

/** Only used to open the map somewhere sensible before any position is known. */
const FALLBACK_CENTER: L.LatLngExpression = [17.385, 78.4867];

/** Static markup (no user data), so it is safe to set as HTML. */
const HOME_SVG =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 10 9-7 9 7"/><path d="M5 9v11h14V9"/><path d="M10 20v-6h4v6"/></svg>';

const TRUCK_SVG =
  '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>';

const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

/** Pins are built from DOM nodes (textContent), never from HTML strings, so names and URLs cannot inject markup. */
function homePin(): L.DivIcon {
  const root = el("div", "tk-hpin");
  const badge = el("span", "tk-hpin-badge");
  badge.innerHTML = HOME_SVG;
  root.append(badge, el("span", "tk-hpin-label", "Your Location"));
  return L.divIcon({
    className: "tk-pin-wrap",
    html: root,
    iconSize: [104, 62],
    iconAnchor: [52, 20],
  });
}

function routeMidPin(): L.DivIcon {
  const badge = el("span", "tk-route-truck");
  badge.innerHTML = TRUCK_SVG;
  return L.divIcon({
    className: "tk-pin-wrap",
    html: badge,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

function partnerPin(
  name: string,
  rating: string | null,
  photo: string | null,
  focused = false,
): L.DivIcon {
  const root = el("div", focused ? "tk-ppin tk-ppin--focused" : "tk-ppin");
  const card = el("div", "tk-ppin-card");
  const initial = name.trim().charAt(0).toUpperCase() || "P";

  const avatar = el("span", "tk-ppin-avatar");
  if (photo) {
    const img = el("img", "");
    img.src = photo;
    img.alt = "";
    img.onerror = () => {
      img.remove();
      avatar.textContent = initial;
    };
    avatar.append(img);
  } else {
    avatar.textContent = initial;
  }

  const text = el("span", "tk-ppin-text");
  text.append(el("span", "tk-ppin-name", name));
  if (rating) text.append(el("span", "tk-ppin-rating", `★ ${rating}`));

  card.append(avatar, text);
  root.append(card, el("span", "tk-ppin-dot"));
  return L.divIcon({
    className: "tk-pin-wrap",
    html: root,
    iconSize: [165, 60],
    iconAnchor: [82, 52],
  });
}

export default function LiveMap({
  destination,
  partner,
  stale,
  summary,
  partnerName = "Partner",
  partnerRating = null,
  partnerPhoto = null,
  overlayTitle = null,
  overlayText = null,
  updatedLabel = null,
  focusPartnerKey = 0,
  onResetFocus,
}: Props) {
  const canvas = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const homeMarker = useRef<L.Marker | null>(null);
  const partnerMarker = useRef<L.Marker | null>(null);
  const midMarker = useRef<L.Marker | null>(null);
  const partnerKey = useRef("");
  const line = useRef<L.Polyline | null>(null);
  /** Once the customer pans, zooms, or focuses the partner pin, stop re-framing on every update. */
  const userMoved = useRef(false);
  const [highlightMap, setHighlightMap] = useState(false);

  const frame = () => {
    const m = map.current;
    if (!m) return;
    if (destination && partner) {
      m.fitBounds(
        L.latLngBounds(
          [destination.lat, destination.lng],
          [partner.lat, partner.lng],
        ),
        { padding: [44, 44], maxZoom: 16 },
      );
    } else if (destination) {
      m.setView([destination.lat, destination.lng], 15);
    } else if (partner) {
      m.setView([partner.lat, partner.lng], 15);
    }
  };

  useEffect(() => {
    if (!canvas.current) return;
    const m = L.map(canvas.current, {
      center: FALLBACK_CENTER,
      zoom: 12,
      zoomControl: false,
      attributionControl: true,
    });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(m);
    const markInteraction = () => {
      userMoved.current = true;
    };
    const container = m.getContainer();
    container.addEventListener("mousedown", markInteraction);
    container.addEventListener("touchstart", markInteraction, {
      passive: true,
    });
    container.addEventListener("wheel", markInteraction, { passive: true });
    const resize = new ResizeObserver(() => {
      m.invalidateSize();
      if (!userMoved.current) {
        frame();
      }
    });
    resize.observe(canvas.current);
    map.current = m;
    return () => {
      resize.disconnect();
      m.remove();
      map.current = null;
      homeMarker.current =
        partnerMarker.current =
        midMarker.current =
        line.current =
          null;
      partnerKey.current = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- map instance is created once on mount
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m) return;

    // Your address
    if (!destination) {
      homeMarker.current?.remove();
      homeMarker.current = null;
    } else if (homeMarker.current) {
      homeMarker.current.setLatLng([destination.lat, destination.lng]);
    } else {
      homeMarker.current = L.marker([destination.lat, destination.lng], {
        icon: homePin(),
        keyboard: false,
      }).addTo(m);
    }

    // The partner (the pin is rebuilt only when the name, rating, photo, or focus state change)
    const isFocused = focusPartnerKey > 0;
    if (!partner) {
      partnerMarker.current?.remove();
      partnerMarker.current = null;
      partnerKey.current = "";
    } else {
      const key = `${partnerName}|${partnerRating ?? ""}|${partnerPhoto ?? ""}|${isFocused ? "1" : "0"}`;
      if (!partnerMarker.current) {
        partnerMarker.current = L.marker([partner.lat, partner.lng], {
          icon: partnerPin(partnerName, partnerRating, partnerPhoto, isFocused),
          keyboard: false,
        }).addTo(m);
        partnerKey.current = key;
      } else {
        partnerMarker.current.setLatLng([partner.lat, partner.lng]);
        if (partnerKey.current !== key) {
          partnerMarker.current.setIcon(
            partnerPin(partnerName, partnerRating, partnerPhoto, isFocused),
          );
          partnerKey.current = key;
        }
      }
      partnerMarker.current.setOpacity(stale && !isFocused ? 0.8 : 1);
    }

    // The route line + midpoint truck badge
    if (destination && partner) {
      const midLat = (destination.lat + partner.lat) / 2;
      const midLng = (destination.lng + partner.lng) / 2;
      const path: L.LatLngExpression[] = [
        [destination.lat, destination.lng],
        [partner.lat, partner.lng],
      ];
      if (line.current) {
        line.current.setLatLngs(path);
      } else {
        line.current = L.polyline(path, {
          color: "#3b5bdb",
          weight: 3.5,
          opacity: 0.9,
        }).addTo(m);
      }

      if (midMarker.current) {
        midMarker.current.setLatLng([midLat, midLng]);
      } else {
        midMarker.current = L.marker([midLat, midLng], {
          icon: routeMidPin(),
          keyboard: false,
          interactive: false,
        }).addTo(m);
      }
    } else {
      line.current?.remove();
      line.current = null;
      midMarker.current?.remove();
      midMarker.current = null;
    }

    if (!userMoved.current) frame();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- frame() only reads the same two points
  }, [
    destination?.lat,
    destination?.lng,
    partner?.lat,
    partner?.lng,
    stale,
    partnerName,
    partnerRating,
    partnerPhoto,
    focusPartnerKey,
  ]);

  // When the user clicks "View Last Known Location", fly directly to the partner marker at street zoom.
  useEffect(() => {
    if (!focusPartnerKey || !partner || !map.current) return;
    userMoved.current = true;
    const m = map.current;
    m.invalidateSize();
    const targetZoom = Math.max(m.getZoom(), 16);
    m.flyTo([partner.lat, partner.lng], targetZoom, {
      animate: true,
      duration: 0.75,
    });
    partnerMarker.current?.setOpacity(1);
    setHighlightMap(true);
    const timer = window.setTimeout(() => setHighlightMap(false), 1800);
    return () => window.clearTimeout(timer);
  }, [focusPartnerKey, partner]);

  const recenter = () => {
    userMoved.current = false;
    onResetFocus?.();
    frame();
  };

  return (
    <div className={clsx("tk-map", highlightMap && "tk-map--focused")}>
      <div
        ref={canvas}
        className="tk-map-canvas"
        role="img"
        aria-label={`Map. ${summary}`}
      />

      {overlayTitle && (
        <div
          className={clsx(
            "tk-overlay-card",
            highlightMap && "tk-overlay-card--focused",
          )}
        >
          <span className="tk-overlay-icon" aria-hidden="true">
            <MapPin className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <p className="tk-overlay-title">{overlayTitle}</p>
            {overlayText && <p className="tk-overlay-text">{overlayText}</p>}
          </div>
        </div>
      )}

      <div className="tk-controls">
        <button
          type="button"
          className="tk-ctrl tk-ctrl-solo"
          onClick={recenter}
          aria-label="Recenter map"
          title="Show full route"
        >
          <Crosshair className="h-4 w-4" aria-hidden="true" />
        </button>
        <div className="tk-ctrl-group">
          <button
            type="button"
            className="tk-ctrl"
            onClick={() => map.current?.zoomIn()}
            aria-label="Zoom in"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            className="tk-ctrl"
            onClick={() => map.current?.zoomOut()}
            aria-label="Zoom out"
          >
            <Minus className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {updatedLabel && (
        <p className="tk-updated">
          <span
            className={
              stale ? "tk-updated-dot tk-updated-dot-stale" : "tk-updated-dot"
            }
            aria-hidden="true"
          />
          {updatedLabel}
        </p>
      )}
    </div>
  );
}

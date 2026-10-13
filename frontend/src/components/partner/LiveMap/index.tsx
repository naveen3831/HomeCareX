import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./liveMap.css";

export interface MapPoint {
  lat: number;
  lng: number;
}

interface Props {
  /** Customer address pin. Null when the booking has no coordinates. */
  customer: MapPoint | null;
  /** The partner's own position. Null until the browser has reported one. */
  partner: MapPoint | null;
  /** Text alternative for the map, e.g. "3.2 km from the customer". */
  summary: string;
}

/** Hyderabad, only used to open the map somewhere sensible before any position is known. */
const FALLBACK_CENTER: L.LatLngExpression = [17.385, 78.4867];

/** divIcons avoid Leaflet's default marker images, which bundlers do not resolve. */
const pin = (kind: "customer" | "partner", label: string) =>
  L.divIcon({
    className: "lm-pin-wrap",
    html: `<span class="lm-pin lm-pin-${kind}">${label}</span>`,
    iconSize: [44, 28],
    iconAnchor: [22, 14],
  });

export default function LiveMap({ customer, partner, summary }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const customerMarker = useRef<L.Marker | null>(null);
  const partnerMarker = useRef<L.Marker | null>(null);
  const line = useRef<L.Polyline | null>(null);
  /** Once the partner pans or zooms, stop re-framing the map on every GPS update. */
  const userMoved = useRef(false);

  useEffect(() => {
    if (!el.current) return;
    const m = L.map(el.current, {
      center: FALLBACK_CENTER,
      zoom: 12,
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
    const resize = new ResizeObserver(() => m.invalidateSize());
    resize.observe(el.current);
    map.current = m;
    return () => {
      resize.disconnect();
      m.remove();
      map.current = null;
      customerMarker.current = partnerMarker.current = line.current = null;
    };
  }, []);

  const frame = () => {
    const m = map.current;
    if (!m) return;
    if (customer && partner) {
      m.fitBounds(
        L.latLngBounds(
          [customer.lat, customer.lng],
          [partner.lat, partner.lng],
        ),
        { padding: [48, 48], maxZoom: 16 },
      );
    } else if (customer) {
      m.setView([customer.lat, customer.lng], 15);
    } else if (partner) {
      m.setView([partner.lat, partner.lng], 15);
    }
  };

  useEffect(() => {
    const m = map.current;
    if (!m) return;

    const sync = (
      ref: { current: L.Marker | null },
      point: MapPoint | null,
      icon: L.DivIcon,
    ) => {
      if (!point) {
        ref.current?.remove();
        ref.current = null;
      } else if (ref.current) {
        ref.current.setLatLng([point.lat, point.lng]);
      } else {
        ref.current = L.marker([point.lat, point.lng], {
          icon,
          keyboard: false,
        }).addTo(m);
      }
    };
    sync(customerMarker, customer, pin("customer", "Customer"));
    sync(partnerMarker, partner, pin("partner", "You"));

    if (customer && partner) {
      const path: L.LatLngExpression[] = [
        [partner.lat, partner.lng],
        [customer.lat, customer.lng],
      ];
      if (line.current) line.current.setLatLngs(path);
      else
        line.current = L.polyline(path, {
          color: "#4034c7",
          weight: 3,
          dashArray: "6 8",
          opacity: 0.8,
        }).addTo(m);
    } else {
      line.current?.remove();
      line.current = null;
    }

    if (!userMoved.current) frame();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- frame() only reads the same two props
  }, [customer?.lat, customer?.lng, partner?.lat, partner?.lng]);

  const recenter = () => {
    userMoved.current = false;
    frame();
  };

  return (
    <div className="lm">
      <div
        ref={el}
        className="lm-canvas"
        role="img"
        aria-label={`Map. ${summary}`}
      />
      <button type="button" className="lm-recenter" onClick={recenter}>
        Recenter
      </button>
    </div>
  );
}

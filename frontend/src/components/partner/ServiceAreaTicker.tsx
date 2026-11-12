import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MapPin } from 'lucide-react';
import { getServiceArea } from '@/pages/partner/ServiceArea/serviceArea.api';
import './ServiceAreaTicker.css';

/**
 * One small line for the mobile top bar, right under the HomeCareX name.
 * Shows the partner's service area, e.g. "Rekulakunta · 3 km" (the base location from the map; cities only if no base location name is saved). When the text is longer than the space,
 * it slides sideways back and forth so all of it can be read. Tapping opens the Service area page.
 */
export default function ServiceAreaTicker({ className = '' }: { className?: string }) {
  const { data, isPending } = useQuery({
    queryKey: ['partner', 'service-area'],
    queryFn: getServiceArea,
    staleTime: 60_000,
  });

  // Show the place the partner set on the map (the base location), the same name the Service area map card shows.
  // Cities and areas are a separate list, so they are used only when no base location name is saved yet.
  const base = data?.baseLocation?.label?.trim();
  const places = base
    ? [base]
    : Array.from(new Set([...(data?.cities ?? []), ...(data?.areas ?? [])])).slice(0, 8);
  const text = isPending
    ? 'Loading service area…'
    : data?.configured && places.length
      ? `${places.join(', ')} · ${data.radiusKm} km`
      : 'Set your service area';

  const viewRef = useRef<HTMLSpanElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [dist, setDist] = useState(0);

  useEffect(() => {
    const measure = () => {
      const view = viewRef.current;
      const inner = textRef.current;
      if (!view || !inner) return;
      setDist(Math.max(0, Math.ceil(inner.scrollWidth - view.clientWidth)));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [text]);

  const slide = dist > 0;
  return (
    <Link
      to="/partner/service-area"
      aria-label={`Service area: ${text}. Tap to change`}
      className={`sat ${slide ? 'sat--slide' : ''} ${className}`}
    >
      <MapPin size={12} className="sat__pin" aria-hidden="true" />
      <span ref={viewRef} className="sat__view">
        <span
          ref={textRef}
          className="sat__text"
          style={slide ? ({ '--sat-dist': `${dist}px`, '--sat-dur': `${Math.max(6, dist / 14)}s` } as CSSProperties) : undefined}
        >
          {text}
        </span>
      </span>
    </Link>
  );
}
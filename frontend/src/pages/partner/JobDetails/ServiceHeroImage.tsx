import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Hammer,
  Droplets,
  Paintbrush,
  Bug,
  Scissors,
  Sparkles,
  Wrench,
  ChevronLeft,
  ChevronRight,
  Zap,
  type LucideIcon,
} from 'lucide-react';

/**
 * Sliding pictures at the top of the job page.
 * The pictures come from /public/images/card and are picked from the service name
 * (cleaning -> cleaning photos, electrician -> electrician photos, ...).
 * First rule that matches wins, so keep the specific ones above the general ones.
 */
const IMG = '/images/card/';

interface Rule {
  test: RegExp;
  images: string[];
  Icon: LucideIcon;
  from: string;
  to: string;
}

const RULES: Rule[] = [
  // ---- cleaning (specific first) ----
  { test: /kitchen/i, images: ['kitchen-cleaning', 'kitchen-cleaning-2', 'kitchen-deep-cleaning'], Icon: Sparkles, from: '#c7d2fe', to: '#4f46e5' },
  { test: /(bathroom|toilet)/i, images: ['bathroom-cleaning', 'bathroom-cleaning-2', 'bathroom-deep-cleaning'], Icon: Sparkles, from: '#c7d2fe', to: '#4f46e5' },
  { test: /tank/i, images: ['water-tank-cleaning'], Icon: Droplets, from: '#bae6fd', to: '#0ea5e9' },
  { test: /sanitiz/i, images: ['full-home-sanitization', 'home-cleaning', 'deep-cleaning-3'], Icon: Sparkles, from: '#c7d2fe', to: '#4f46e5' },
  // ---- waterproofing ----
  { test: /(waterproof|terrace)/i, images: ['terrace-waterproofing', 'home-maintenance-2'], Icon: Hammer, from: '#fed7aa', to: '#f97316' },
  // ---- pest control ----
  { test: /termite/i, images: ['TermiteTreatment', 'pestControl'], Icon: Bug, from: '#bbf7d0', to: '#22c55e' },
  { test: /bed.?bug/i, images: ['bed-bug-treatment', 'pest-control-clean'], Icon: Bug, from: '#bbf7d0', to: '#22c55e' },
  { test: /(mosquito|fogging)/i, images: ['mosquito-fogging', 'pestControl'], Icon: Bug, from: '#bbf7d0', to: '#22c55e' },
  { test: /(pest|cockroach|rodent|\bants?\b)/i, images: ['pestControl', 'pest-control-clean', 'TermiteTreatment', 'bed-bug-treatment', 'mosquito-fogging'], Icon: Bug, from: '#bbf7d0', to: '#22c55e' },
  // ---- salon / spa ----
  { test: /(massage|\bspa\b)/i, images: ['full-body-massage', 'Home-spa-women'], Icon: Scissors, from: '#fecdd3', to: '#f43f5e' },
  { test: /(hair|groom|barber)/i, images: ['mens-haircut-grooming'], Icon: Scissors, from: '#fecdd3', to: '#f43f5e' },
  { test: /(bridal|makeup|beauty|salon|facial)/i, images: ['bridal-makeup', 'Home-spa-women', 'mens-haircut-grooming', 'full-body-massage'], Icon: Scissors, from: '#fecdd3', to: '#f43f5e' },
  // ---- plumbing ----
  { test: /(geyser|water heater)/i, images: ['geyser-installation-repair', 'plumbing', 'plumbing-3'], Icon: Droplets, from: '#bae6fd', to: '#0ea5e9' },
  { test: /(plumb|pipe|\btaps?\b|drain|leak|water)/i, images: ['plumbing', 'plumbing-3', 'geyser-installation-repair'], Icon: Droplets, from: '#bae6fd', to: '#0ea5e9' },
  // ---- electrician ----
  { test: /(electric|wiring|switch|socket|\bfans?\b|light|inverter|mcb)/i, images: ['electrical', 'electrical-2', 'electrical-3', 'electrical-4'], Icon: Zap, from: '#fde68a', to: '#f59e0b' },
  // ---- appliances ----
  { test: /washing/i, images: ['washing-machine-repair', 'appliance-repair-4'], Icon: Wrench, from: '#e2e8f0', to: '#64748b' },
  { test: /(fridge|refrigerat)/i, images: ['refrigerator-repair', 'appliance-repair-4'], Icon: Wrench, from: '#e2e8f0', to: '#64748b' },
  { test: /(microwave|oven)/i, images: ['microwave-oven-repair', 'appliance-repair-3', 'appliance-repair-2'], Icon: Wrench, from: '#e2e8f0', to: '#64748b' },
  { test: /(appliance|\bac\b|air.?condition|\btv\b|repair)/i, images: ['appliance-repair', 'appliance-repair-2', 'appliance-repair-3', 'appliance-repair-4', 'washing-machine-repair', 'refrigerator-repair', 'microwave-oven-repair'], Icon: Wrench, from: '#e2e8f0', to: '#64748b' },
  // ---- painting ----
  { test: /(paint|wall|texture|putty)/i, images: ['room-painting-per-room', 'texture-accent-wall'], Icon: Paintbrush, from: '#fbcfe8', to: '#ec4899' },
  // ---- carpentry / general maintenance ----
  { test: /(carpent|furniture|wood|door|cabinet|maintenance|handyman|install)/i, images: ['home-maintenance', 'home-maintenance-2', 'home-maintenance-3', 'home-maintenance-4'], Icon: Hammer, from: '#fed7aa', to: '#f97316' },
  // ---- general cleaning (also catches "Deep Home Cleaning") ----
  { test: /(clean|dust|mop|sofa|carpet|deep|home)/i, images: ['home-cleaning', 'home-cleaning-2', 'deep-cleaning-3', 'deep-cleaning-4', 'deep-cleaning-2', 'kitchen-cleaning', 'bathroom-cleaning'], Icon: Sparkles, from: '#c7d2fe', to: '#4f46e5' },
];

const DEFAULT_RULE: Rule = {
  test: /./,
  images: ['home-maintenance', 'home-maintenance-2', 'home-maintenance-3', 'home-maintenance-4'],
  Icon: Hammer,
  from: '#fed7aa',
  to: '#f97316',
};

export function pickServiceRule(serviceName: string): Rule {
  return RULES.find((r) => r.test.test(serviceName)) ?? DEFAULT_RULE;
}

const SLIDE_MS = 3500;
const PAUSE_AFTER_TOUCH_MS = 8000;

export default function ServiceHeroImage({ serviceName }: { serviceName: string }) {
  const rule = useMemo(() => pickServiceRule(serviceName), [serviceName]);
  const [broken, setBroken] = useState<string[]>([]);
  const [active, setActive] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const pausedUntil = useRef(0);

  const images = rule.images.filter((name) => !broken.includes(name));
  const reduceMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const goTo = useCallback(
    (index: number) => {
      const el = trackRef.current;
      if (!el) return;
      el.scrollTo({ left: index * el.clientWidth, behavior: reduceMotion ? 'auto' : 'smooth' });
    },
    [reduceMotion],
  );

  // New service -> start from the first picture.
  useEffect(() => {
    setActive(0);
    setBroken([]);
    trackRef.current?.scrollTo({ left: 0 });
  }, [serviceName]);

  // Auto slide. Stops while the partner is touching/hovering, or the tab is hidden.
  useEffect(() => {
    if (images.length < 2 || reduceMotion) return undefined;
    const timer = window.setInterval(() => {
      if (document.hidden || Date.now() < pausedUntil.current) return;
      goTo((active + 1) % images.length);
    }, SLIDE_MS);
    return () => window.clearInterval(timer);
  }, [active, images.length, goTo, reduceMotion]);

  const pauseAutoSlide = () => {
    pausedUntil.current = Date.now() + PAUSE_AFTER_TOUCH_MS;
  };

  if (images.length === 0) {
    const { Icon } = rule;
    return (
      <div
        className="jdx-photo jdx-photo-fallback"
        style={{ background: `linear-gradient(135deg, ${rule.from}, ${rule.to})` }}
        role="img"
        aria-label={serviceName}
      >
        <Icon size={56} color="#ffffff" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div
      className="jdx-photo"
      role="group"
      aria-roledescription="carousel"
      aria-label={`${serviceName} pictures`}
      onMouseEnter={pauseAutoSlide}
      onTouchStart={pauseAutoSlide}
      onPointerDown={pauseAutoSlide}
    >
      <div
        className="jdx-photo-track"
        ref={trackRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          if (el.clientWidth > 0) setActive(Math.round(el.scrollLeft / el.clientWidth));
        }}
      >
        {images.map((name, i) => (
          <div className="jdx-slide" key={name}>
            <img
              src={`${IMG}${name}.webp`}
              alt={`${serviceName} ${i + 1} of ${images.length}`}
              loading={i === 0 ? 'eager' : 'lazy'}
              decoding="async"
              draggable={false}
              onError={() => setBroken((prev) => (prev.includes(name) ? prev : [...prev, name]))}
            />
          </div>
        ))}
      </div>

      {images.length > 1 && (
        <>
          <button
            type="button"
            className="jdx-arrow jdx-arrow-prev"
            aria-label="Previous picture"
            onClick={() => {
              pauseAutoSlide();
              goTo((active - 1 + images.length) % images.length);
            }}
          >
            <ChevronLeft size={20} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="jdx-arrow jdx-arrow-next"
            aria-label="Next picture"
            onClick={() => {
              pauseAutoSlide();
              goTo((active + 1) % images.length);
            }}
          >
            <ChevronRight size={20} aria-hidden="true" />
          </button>
        </>
      )}

      {images.length > 1 && (
        <div className="jdx-dots">
          {images.map((name, i) => (
            <button
              key={name}
              type="button"
              className={i === active ? 'jdx-dot is-active' : 'jdx-dot'}
              aria-label={`Show picture ${i + 1}`}
              aria-current={i === active}
              onClick={() => {
                pauseAutoSlide();
                goTo(i);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
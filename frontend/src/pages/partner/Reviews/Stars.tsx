import { useId } from 'react';

interface StarsProps {
  /** 0 to 5, decimals allowed (3.5 fills three and a half stars). */
  value: number;
  label?: string;
}

const STAR_PATH = 'M12 2.5l2.9 6.1 6.6.9-4.8 4.6 1.2 6.6L12 17.4l-5.9 3.3 1.2-6.6L2.5 9.5l6.6-.9z';

/**
 * Each star paints itself with a hard-stop gradient, so a partly filled star is exact and does not
 * depend on widths or overflow (the old overlay could show every star as full).
 */
export default function Stars({ value, label }: StarsProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const v = Math.max(0, Math.min(5, Number.isFinite(value) ? value : 0));
  return (
    <span className="rv-stars" role="img" aria-label={label ?? `Rated ${v.toFixed(1)} out of 5`}>
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.max(0, Math.min(1, v - i));
        const id = `rvs-${uid}-${i}`;
        const cut = `${Math.round(fill * 100)}%`;
        return (
          <svg key={i} viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" focusable="false">
            <defs>
              <linearGradient id={id} x1="0" x2="1" y1="0" y2="0">
                <stop offset="0%" style={{ stopColor: 'var(--rv-star)' }} />
                <stop offset={cut} style={{ stopColor: 'var(--rv-star)' }} />
                <stop offset={cut} style={{ stopColor: 'var(--rv-star-off)' }} />
                <stop offset="100%" style={{ stopColor: 'var(--rv-star-off)' }} />
              </linearGradient>
            </defs>
            <path d={STAR_PATH} fill={`url(#${id})`} />
          </svg>
        );
      })}
    </span>
  );
}

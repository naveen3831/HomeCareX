interface StarsProps {
  /** 0 to 5, decimals allowed (4.2 fills 84%). */
  value: number;
  label?: string;
}

const STAR_PATH = 'M12 2.5l2.9 6.1 6.6.9-4.8 4.6 1.2 6.6L12 17.4l-5.9 3.3 1.2-6.6L2.5 9.5l6.6-.9z';

function StarRow() {
  return (
    <>
      {[0, 1, 2, 3, 4].map((i) => (
        <svg key={i} viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" focusable="false">
          <path d={STAR_PATH} fill="currentColor" />
        </svg>
      ))}
    </>
  );
}

export default function Stars({ value, label }: StarsProps) {
  const pct = Math.max(0, Math.min(100, (value / 5) * 100));
  return (
    <span className="rv-stars" role="img" aria-label={label ?? `Rated ${value.toFixed(1)} out of 5`}>
      <span className="rv-stars-bg" aria-hidden="true">
        <StarRow />
      </span>
      <span className="rv-stars-fg" aria-hidden="true" style={{ width: `${pct}%` }}>
        <StarRow />
      </span>
    </span>
  );
}
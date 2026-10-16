import Stars from './Stars';
import type { ReviewSummary, StarKey } from './reviews.types';

const ORDER: StarKey[] = ['5', '4', '3', '2', '1'];

interface RatingSummaryProps {
  summary: ReviewSummary;
}

export default function RatingSummary({ summary }: RatingSummaryProps) {
  const { average, count, distribution } = summary;
  return (
    <section className="rv-summary" aria-labelledby="rv-summary-title">
      <h2 id="rv-summary-title" className="rv-sr-only">
        Overall rating
      </h2>
      <div className="rv-score">
        <p className="rv-average">{average.toFixed(1)}</p>
        <div className="rv-score-meta">
          <Stars value={average} />
          <p className="rv-muted">{count === 1 ? 'Based on 1 review' : `Based on ${count} reviews`}</p>
        </div>
      </div>

      <div className="rv-split-wrap">
        <div className="rv-split" aria-hidden="true">
          {ORDER.map((star) => {
            const n = distribution[star] ?? 0;
            return n > 0 ? <span key={star} className={`rv-seg rv-seg-${star}`} style={{ flexGrow: n }} /> : null;
          })}
        </div>
        <ul className="rv-dist" aria-label="Rating distribution">
          {ORDER.map((star) => {
            const n = distribution[star] ?? 0;
            return (
              <li key={star} className={`rv-dist-item${n === 0 ? ' rv-dist-zero' : ''}`}>
                <span className={`rv-swatch rv-seg-${star}`} aria-hidden="true" />
                <span className="rv-dist-star">{star}★</span>
                <span className="rv-dist-count">
                  {n}
                  <span className="rv-sr-only">{n === 1 ? ' review' : ' reviews'}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
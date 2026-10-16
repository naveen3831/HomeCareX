import Stars from './Stars';
import type { PartnerReview } from './reviews.types';

const formatDate = (iso: string): string => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

interface ReviewCardProps {
  review: PartnerReview;
}

export default function ReviewCard({ review }: ReviewCardProps) {
  const { customer, service, rating, comment, tags, verified, createdAt } = review;
  return (
    <article className="rv-review">
      <div className="rv-review-side">
        <time className="rv-date" dateTime={createdAt}>
          {formatDate(createdAt)}
        </time>
        {service ? <p className="rv-service">{service}</p> : null}
      </div>
      <div className="rv-review-body">
        {comment ? <p className="rv-comment">{comment}</p> : <p className="rv-comment rv-comment-empty">No written comment.</p>}
        <div className="rv-review-foot">
          <Stars value={rating} label={`${customer} rated ${rating} out of 5`} />
          <span className="rv-customer">{customer}</span>
          {verified ? <span className="rv-verified">✓ Verified job</span> : null}
        </div>
        {tags.length > 0 ? (
          <ul className="rv-tags" aria-label="Tags">
            {tags.map((t) => (
              <li key={t} className="rv-tag">
                {t}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </article>
  );
}
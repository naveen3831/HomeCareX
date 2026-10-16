import React, { useCallback, useEffect, useState } from 'react';
import http from '@/lib/http';
import './index.css';

type ReviewStatus = 'pending' | 'approved' | 'rejected';

interface Review {
  _id: string;
  customerId?: string;
  customerName?: string;
  customerEmail?: string;
  serviceId?: string;
  partnerId?: string;
  partnerName?: string;
  rating: number;
  message?: string;
  status: ReviewStatus;
  visible?: boolean;
  createdAt: string;
}

interface ReviewsResponse {
  reviews: Review[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  stats?: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
  };
}

export const AdminReviewsPage: React.FC = () => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadReviews = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await http.get('/admin/reviews');
      const payload: ReviewsResponse =
        response.data?.data ?? response.data;

      setReviews(payload.reviews ?? []);
      setStats(payload.stats ?? {
        total: payload.pagination?.total ?? 0,
        pending: 0,
        approved: 0,
        rejected: 0,
      });
    } catch {
      setError('Unable to load reviews. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReviews();
  }, [loadReviews]);

  const updateVisibility = async (
    review: Review,
    visible: boolean,
  ) => {
    setUpdatingId(review._id);
    setError('');

    try {
      await http.patch(
        `/admin/reviews/${encodeURIComponent(review._id)}/visibility`,
        { visible },
      );

      await loadReviews();
    } catch {
      setError(
        `Unable to ${visible ? 'restore' : 'hide'} this review. Please try again.`,
      );
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <main className="admin-reviews">
      <header className="admin-reviews__header">
        <div>
          <h1>Reviews moderation</h1>
          <p>Review customer feedback and manage public visibility.</p>
        </div>
        <button
          type="button"
          onClick={() => void loadReviews()}
          disabled={loading}
        >
          Refresh
        </button>
      </header>

      <section className="admin-reviews__stats" aria-label="Review statistics">
        <article className="admin-reviews__stat">
          <span>Total reviews</span>
          <strong>{stats.total}</strong>
        </article>
        <article className="admin-reviews__stat">
          <span>Pending</span>
          <strong>{stats.pending}</strong>
        </article>
        <article className="admin-reviews__stat">
          <span>Approved</span>
          <strong>{stats.approved}</strong>
        </article>
        <article className="admin-reviews__stat">
          <span>Rejected</span>
          <strong>{stats.rejected}</strong>
        </article>
      </section>

      {error && (
        <div className="admin-reviews__error" role="alert">
          {error}
          <button type="button" onClick={() => void loadReviews()}>
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <p role="status">Loading reviews...</p>
      ) : reviews.length === 0 ? (
        <p className="admin-reviews__empty">No reviews found.</p>
      ) : (
        <div className="admin-reviews__table-wrap">
          <table className="admin-reviews__table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Service</th>
                <th>Partner</th>
                <th>Rating</th>
                <th>Comment</th>
                <th>Status</th>
                <th>Visibility</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {reviews.map((review) => {
                const visible = review.visible !== false;

                return (
                  <tr key={review._id}>
                    <td>
                      {review.customerName || 'Unknown customer'}
                      {review.customerEmail && (
                        <small>{review.customerEmail}</small>
                      )}
                    </td>
                    <td>{review.serviceId || '—'}</td>
                    <td>{review.partnerName || review.partnerId || '—'}</td>
                    <td aria-label={`${review.rating} out of 5`}>
                      {'★'.repeat(Math.max(0, Math.min(5, review.rating)))}
                      {'☆'.repeat(5 - Math.max(0, Math.min(5, review.rating)))}
                      <span> ({review.rating}/5)</span>
                    </td>
                    <td>{review.message || 'No comment'}</td>
                    <td>{review.status}</td>
                    <td>{visible ? 'Visible' : 'Hidden'}</td>
                    <td>{new Date(review.createdAt).toLocaleDateString()}</td>
                    <td>
                      <button
                        type="button"
                        onClick={() => void updateVisibility(review, !visible)}
                        disabled={updatingId === review._id}
                        aria-label={`${visible ? 'Hide' : 'Restore'} review by ${review.customerName || 'customer'}`}
                      >
                        {updatingId === review._id
                          ? 'Saving...'
                          : visible
                            ? 'Hide'
                            : 'Restore'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
};

export default AdminReviewsPage;
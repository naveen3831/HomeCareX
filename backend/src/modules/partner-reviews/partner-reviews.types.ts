import type { ReviewPageMeta, ReviewSummaryDto } from '../reviews/reviews.types';

/** Overall rating for the signed-in partner: average (1 decimal), count and a zero-filled 1-5 distribution. */
export type PartnerReviewSummaryDto = ReviewSummaryDto;

/** One review as the partner sees it. No customer email or id; the customer name is shortened ("Ravi K."). */
export interface PartnerReviewDto {
  id: string;
  rating: number;
  comment: string;
  customer: string;
  /** Service name from the booking snapshot, else the service record, else null. */
  service: string | null;
  tags: string[];
  verified: boolean;
  createdAt: string;
}

export interface PartnerReviewsResult {
  reviews: PartnerReviewDto[];
  meta: ReviewPageMeta;
}

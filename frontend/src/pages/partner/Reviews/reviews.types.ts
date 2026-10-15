export type StarKey = '1' | '2' | '3' | '4' | '5';
export type StarDistribution = Record<StarKey, number>;

/** GET /partner/reviews/summary */
export interface ReviewSummary {
  average: number;
  count: number;
  distribution: StarDistribution;
}

/** One item of GET /partner/reviews */
export interface PartnerReview {
  id: string;
  rating: number;
  comment: string;
  customer: string;
  service: string | null;
  tags: string[];
  verified: boolean;
  createdAt: string;
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ReviewsPage {
  reviews: PartnerReview[];
  meta: PageMeta;
}
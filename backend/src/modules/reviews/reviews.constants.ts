export const REVIEW_PAGE_DEFAULT = 1;
export const REVIEW_PAGE_MAX = 1000;
export const REVIEW_LIMIT_DEFAULT = 10;
export const REVIEW_LIMIT_MAX = 50;

/** Star values in the order the distribution is reported (highest first). */
export const STAR_VALUES = [5, 4, 3, 2, 1] as const;

/** Quick-pick tags on the review form. Stored exactly as written. */
export const REVIEW_TAGS = ['Professional', 'On time', 'Good quality', 'Clean work'] as const;
export type ReviewTag = (typeof REVIEW_TAGS)[number];

export const REVIEW_COMMENT_MAX = 2000;

export const REVIEWS_CONSTANTS = { REVIEW_TAGS, REVIEW_COMMENT_MAX, REVIEW_PAGE_DEFAULT, REVIEW_PAGE_MAX, REVIEW_LIMIT_DEFAULT, REVIEW_LIMIT_MAX, STAR_VALUES };

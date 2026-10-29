/**
 * Client-side sanitising for catalog query params (JS-05).
 *
 * Everything that comes from the address bar (?q=, ?sort=, ?page= ...) is untrusted:
 * anyone can edit the URL by hand. These helpers turn any input into a value the API
 * and the UI can safely use, and never throw.
 */

/* ------------------------------- limits -------------------------------- */

export const QUERY_LIMITS = {
  q: 100,
  category: 80,
  page: 1000,
  limit: 50,
  defaultLimit: 12,
  pathSegment: 100,
} as const;

/** Sort values the API accepts (GET /services?sort=). */
export const API_SORTS = ['popular', 'rating', 'price-asc', 'price-desc', 'newest', 'relevance'] as const;
export type ApiSort = (typeof API_SORTS)[number];

/** Sort values the Services page dropdown shows (kept in the URL as-is). */
export const UI_SORTS = ['popular', 'price-low', 'price-high'] as const;
export type UiSort = (typeof UI_SORTS)[number];

const UI_TO_API_SORT: Record<UiSort, ApiSort> = {
  popular: 'popular',
  'price-low': 'price-asc',
  'price-high': 'price-desc',
};

/* ------------------------------ primitives ------------------------------ */

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001F\u007F\u2028\u2029]/g;

/** Trim, drop control characters, collapse whitespace and cap the length. */
export function cleanText(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  return value.replace(CONTROL_CHARS, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

/** Whole number >= min (and <= max), otherwise the fallback. Rejects "-1", "1e9", "1.5", "abc". */
export function toInt(value: unknown, fallback: number, min = 1, max = Number.MAX_SAFE_INTEGER): number {
  const text = typeof value === 'number' ? String(value) : typeof value === 'string' ? value.trim() : '';
  if (!/^\d{1,9}$/.test(text)) return fallback;
  const n = Number(text);
  if (n < min) return fallback;
  return Math.min(n, max);
}

/* ------------------------------- fields --------------------------------- */

export const sanitizePage = (value: unknown): number => toInt(value, 1, 1, QUERY_LIMITS.page);

export const sanitizeLimit = (value: unknown): number =>
  toInt(value, QUERY_LIMITS.defaultLimit, 1, QUERY_LIMITS.limit);

export const sanitizeSearchText = (value: unknown): string => cleanText(value, QUERY_LIMITS.q);

const CATEGORY_RE = /^[A-Za-z0-9][A-Za-z0-9 _&-]*$/;

const CATEGORY_ALIASES: Record<string, string> = {
  plumbing: 'electrical-plumbing',
  electrical: 'electrical-plumbing',
  'appliance-repair': 'appliance-repair-service',
  cleaning: 'home-cleaning',
};

export function sanitizeCategory(value: unknown): string {
  const text = cleanText(value, QUERY_LIMITS.category);
  if (!CATEGORY_RE.test(text)) return '';
  const lower = text.toLowerCase();
  return CATEGORY_ALIASES[lower] || text;
}

/** Indian pincode: exactly 6 digits, otherwise dropped. */
export function sanitizePincode(value: unknown): string {
  const text = typeof value === 'string' ? value.trim() : '';
  return /^\d{6}$/.test(text) ? text : '';
}

/** Sort as the dropdown knows it. Unknown values fall back to "popular". */
export function sanitizeUiSort(value: unknown): UiSort {
  if (typeof value === 'string') {
    if ((UI_SORTS as readonly string[]).includes(value)) return value as UiSort;
    if (value === 'price-asc' || value === 'price_asc') return 'price-low';
    if (value === 'price-desc' || value === 'price_desc') return 'price-high';
  }
  return 'popular';
}

/** Sort as the API wants it. Anything not on the allow-list becomes "popular". */
export function sanitizeApiSort(value: unknown): ApiSort {
  if (typeof value !== 'string') return 'popular';
  if ((API_SORTS as readonly string[]).includes(value)) return value as ApiSort;
  if ((UI_SORTS as readonly string[]).includes(value)) return UI_TO_API_SORT[value as UiSort];
  return 'popular';
}

export const uiSortToApi = (sort: UiSort): ApiSort => UI_TO_API_SORT[sort];

/* ----------------------- /services page URL -> state --------------------- */

export interface ServicesUrlState {
  q: string;
  category: string;
  sort: UiSort;
  page: number;
  pincode: string;
}

/** Reads the URL and returns safe values. `dirty` = something had to be changed. */
export function parseServicesQuery(params: URLSearchParams): ServicesUrlState & { dirty: boolean } {
  const state: ServicesUrlState = {
    q: sanitizeSearchText(params.get('q')),
    category: sanitizeCategory(params.get('category')),
    sort: sanitizeUiSort(params.get('sort')),
    page: sanitizePage(params.get('page')),
    pincode: sanitizePincode(params.get('pincode')),
  };

  const raw = {
    q: params.get('q'),
    category: params.get('category'),
    sort: params.get('sort'),
    page: params.get('page'),
    pincode: params.get('pincode'),
  };

  const dirty =
    (raw.q !== null && raw.q !== state.q) ||
    (raw.category !== null && raw.category !== state.category) ||
    (raw.sort !== null && raw.sort !== state.sort) ||
    (raw.page !== null && raw.page !== String(state.page)) ||
    (raw.pincode !== null && raw.pincode !== state.pincode);

  return { ...state, dirty };
}

/** The sanitised state as a URL query: defaults (sort=popular, page=1) and empty values are left out. */
export function toServicesSearchParams(state: ServicesUrlState, base?: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(base);
  const set = (key: string, value: string) => (value ? next.set(key, value) : next.delete(key));

  set('q', state.q);
  set('category', state.category);
  set('pincode', state.pincode);
  if (state.sort === 'popular') next.delete('sort');
  else next.set('sort', state.sort);
  if (state.page <= 1) next.delete('page');
  else next.set('page', String(state.page));
  return next;
}

/* --------------------------- API request params -------------------------- */

export interface RawServicesParams {
  q?: unknown;
  category?: unknown;
  rating?: unknown;
  minPrice?: unknown;
  maxPrice?: unknown;
  duration?: unknown;
  availability?: unknown;
  sort?: unknown;
  page?: unknown;
  limit?: unknown;
}

const finite = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? v : undefined;

/** The only params ever sent to GET /services. */
export function sanitizeServicesParams(params: RawServicesParams = {}): Record<string, string | number> {
  const out: Record<string, string | number> = {};

  const q = sanitizeSearchText(params.q);
  if (q) out.q = q;

  const category = sanitizeCategory(params.category);
  if (category) out.category = category;

  const rating = finite(params.rating);
  if (rating !== undefined && rating >= 1 && rating <= 5) out.rating = rating;

  let minPrice = finite(params.minPrice);
  let maxPrice = finite(params.maxPrice);
  if (minPrice !== undefined && (minPrice < 0 || minPrice > 10_000_000)) minPrice = undefined;
  if (maxPrice !== undefined && (maxPrice < 0 || maxPrice > 10_000_000)) maxPrice = undefined;
  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
    minPrice = undefined;
    maxPrice = undefined;
  }
  if (minPrice !== undefined) out.minPrice = minPrice;
  if (maxPrice !== undefined) out.maxPrice = maxPrice;

  const duration = finite(params.duration);
  if (duration !== undefined && Number.isInteger(duration) && duration > 0 && duration <= 1440) {
    out.duration = duration;
  }

  if (params.availability === 'today' || params.availability === 'tomorrow') {
    out.availability = params.availability;
  }

  out.sort = sanitizeApiSort(params.sort);
  out.page = sanitizePage(params.page);
  out.limit = sanitizeLimit(params.limit);
  return out;
}

/* ------------------------------ path segments ---------------------------- */

const SEGMENT_RE = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

/** A slug or id that is safe to put in /services/:slug. Returns '' when it is not. */
export function sanitizePathSegment(value: unknown): string {
  if (typeof value !== 'string') return '';
  const text = value.trim();
  if (!text || text.length > QUERY_LIMITS.pathSegment) return '';
  return SEGMENT_RE.test(text) ? text : '';
}

/* ------------------------------ safe text -------------------------------- */

/** Plain text for alt attributes: removes tags, control characters and runaway length. */
export function safeText(value: unknown, max = 160): string {
  if (typeof value !== 'string') return '';
  return cleanText(value.replace(/<[^>]*>?/g, ' '), max);
}

/** Alt text with a readable fallback when the API string is empty or only markup. */
export const safeAlt = (value: unknown, fallback: string): string => safeText(value) || safeText(fallback);
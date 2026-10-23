import { describe, expect, it } from 'vitest';
import {
  QUERY_LIMITS,
  parseServicesQuery,
  safeAlt,
  safeText,
  sanitizeCategory,
  sanitizePage,
  sanitizePathSegment,
  sanitizeServicesParams,
  toServicesSearchParams,
} from '../lib/querySanitize';

const parse = (qs: string) => parseServicesQuery(new URLSearchParams(qs));

describe('tampered query params: page', () => {
  it.each([
    ['-1', 1],
    ['0', 1],
    ['abc', 1],
    ['1.5', 1],
    ['1e9', 1],
    ['99999999999999999999', 1],
    ['', 1],
    ['3', 3],
    ['999999', QUERY_LIMITS.page],
  ])('page=%s -> %i', (raw, expected) => {
    expect(sanitizePage(raw)).toBe(expected);
    expect(parse(`page=${raw}`).page).toBe(expected);
  });
});

describe('tampered query params: sort', () => {
  it('keeps allowed sort values', () => {
    expect(parse('sort=price-low').sort).toBe('price-low');
    expect(parse('sort=price-high').sort).toBe('price-high');
  });

  it('maps API-style values to what the dropdown shows', () => {
    expect(parse('sort=price-asc').sort).toBe('price-low');
    expect(parse('sort=price_desc').sort).toBe('price-high');
  });

  it.each(['name; DROP TABLE services;--', '<script>alert(1)</script>', "' OR 1=1 --", '$ne', '__proto__'])(
    'falls back to popular for %s',
    (bad) => {
      expect(parse(`sort=${encodeURIComponent(bad)}`).sort).toBe('popular');
      expect(sanitizeServicesParams({ sort: bad }).sort).toBe('popular');
    },
  );
});

describe('tampered query params: q, category, pincode', () => {
  it('caps the search text length and strips control characters', () => {
    expect(parse(`q=${'a'.repeat(5000)}`).q).toHaveLength(QUERY_LIMITS.q);
    expect(parse('q=%00%0Aclean%09%20%20up').q).toBe('clean up');
  });

  it('drops categories that are not plain slugs', () => {
    expect(sanitizeCategory('home-cleaning')).toBe('home-cleaning');
    expect(sanitizeCategory('Cleaning')).toBe('Cleaning');
    expect(sanitizeCategory('../../etc/passwd')).toBe('');
    expect(sanitizeCategory('<img src=x onerror=alert(1)>')).toBe('');
    expect(sanitizeCategory("a' OR '1'='1")).toBe('');
    expect(sanitizeCategory('x'.repeat(500))).toHaveLength(QUERY_LIMITS.category);
  });

  it('keeps only a 6-digit pincode', () => {
    expect(parse('pincode=517501').pincode).toBe('517501');
    expect(parse('pincode=51750').pincode).toBe('');
    expect(parse('pincode=abcdef').pincode).toBe('');
    expect(parse('pincode=5175011').pincode).toBe('');
  });
});

describe('dirty flag and URL rewrite', () => {
  it('is false for a clean URL', () => {
    expect(parse('q=Cleaning&category=home-cleaning&sort=price-low&pincode=517501&page=2').dirty).toBe(false);
    expect(parse('').dirty).toBe(false);
  });

  it('is true when anything had to be changed', () => {
    expect(parse('page=-1').dirty).toBe(true);
    expect(parse('sort=evil').dirty).toBe(true);
    expect(parse(`q=${'a'.repeat(300)}`).dirty).toBe(true);
  });

  it('writes the sanitised state back without defaults or empty values', () => {
    const state = parse('page=-1&sort=evil&q=%20%20&pincode=12');
    const next = toServicesSearchParams(state, new URLSearchParams('page=-1&sort=evil&q=%20%20&pincode=12&utm=1'));
    expect(next.toString()).toBe('utm=1');
  });
});

describe('request params sent to GET /services', () => {
  it('rejects page=-1, limit=1000 and sort=injection', () => {
    expect(sanitizeServicesParams({ page: -1, limit: 1000, sort: 'injection' })).toEqual({
      sort: 'popular',
      page: 1,
      limit: QUERY_LIMITS.limit,
    });
  });

  it('drops unknown keys and non-finite or out-of-range numbers', () => {
    const out = sanitizeServicesParams({
      rating: 9,
      minPrice: Number.NaN,
      maxPrice: -5,
      duration: 1.5,
      availability: 'never',
      admin: true,
    } as never);
    expect(out).toEqual({ sort: 'popular', page: 1, limit: QUERY_LIMITS.defaultLimit });
  });

  it('drops an inverted price range', () => {
    const out = sanitizeServicesParams({ minPrice: 900, maxPrice: 100 });
    expect(out.minPrice).toBeUndefined();
    expect(out.maxPrice).toBeUndefined();
  });

  it('keeps valid values', () => {
    expect(
      sanitizeServicesParams({
        q: ' ac repair ', category: 'appliance-repair', rating: 4, minPrice: 100, maxPrice: 900,
        duration: 60, availability: 'today', sort: 'price-asc', page: 2, limit: 6,
      }),
    ).toEqual({
      q: 'ac repair', category: 'appliance-repair', rating: 4, minPrice: 100, maxPrice: 900,
      duration: 60, availability: 'today', sort: 'price-asc', page: 2, limit: 6,
    });
  });
});

describe('path segments (slug / id)', () => {
  it('accepts normal slugs and ids', () => {
    expect(sanitizePathSegment('ac-repair')).toBe('ac-repair');
    expect(sanitizePathSegment('64f1c2a9b3e4d5a6b7c8d9e0')).toBe('64f1c2a9b3e4d5a6b7c8d9e0');
  });

  it.each(['', ' ', '../admin', 'a/b', 'a b', '<b>x</b>', '%2e%2e', 'x'.repeat(101), undefined, 42])(
    'rejects %s',
    (bad) => expect(sanitizePathSegment(bad)).toBe(''),
  );
});

describe('safe text for API strings', () => {
  it('removes markup and control characters', () => {
    expect(safeText('<img src=x onerror=alert(1)>Deep clean')).toBe('Deep clean');
    expect(safeText('Line1\nLine2\u0000')).toBe('Line1 Line2');
    expect(safeText('a'.repeat(1000))).toHaveLength(160);
  });

  it('falls back when the API string is empty or only markup', () => {
    expect(safeAlt('', 'AC repair photo')).toBe('AC repair photo');
    expect(safeAlt('<script></script>', 'AC repair photo')).toBe('AC repair photo');
    expect(safeAlt(null, 'AC repair photo')).toBe('AC repair photo');
    expect(safeAlt('Technician at work', 'x')).toBe('Technician at work');
  });
});
export const isObjectId = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value);

/** Returns a valid Date or null. Accepts ISO strings and Date objects. */
export function parseDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value !== 'string' || !value.trim()) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

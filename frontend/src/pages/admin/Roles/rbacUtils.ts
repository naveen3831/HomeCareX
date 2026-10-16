import type { Permission } from '@/types/adminRbac';
import { LAST_SUPER_ADMIN_CODE, LAST_SUPER_ADMIN_MESSAGE } from './rbacPermissions';

/** `bookings` -> `Bookings`, `partner:jobs` -> `Partner · Jobs`, `audit_logs` -> `Audit logs`. */
export function humanize(text: string): string {
  const spaced = text.replace(/[_-]+/g, ' ').trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function resourceLabel(resource: string): string {
  return resource.split(':').map(humanize).join(' · ');
}

const ACTION_ORDER = ['view', 'read', 'create', 'update', 'delete', 'export', 'approve', 'assign'];

export function sortActions(actions: string[]): string[] {
  const rank = (a: string) => {
    const i = ACTION_ORDER.indexOf(a);
    return i === -1 ? ACTION_ORDER.length : i;
  };
  return [...actions].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

export interface PermissionMatrix {
  actions: string[];
  rows: Array<{ resource: string; label: string; keys: Record<string, string> }>;
}

/** Turns the flat permission list into resource rows x action columns. */
export function buildMatrix(permissions: Permission[]): PermissionMatrix {
  const byResource = new Map<string, Record<string, string>>();
  const actions = new Set<string>();
  for (const p of permissions) {
    actions.add(p.action);
    const row = byResource.get(p.resource) ?? {};
    row[p.action] = p.key;
    byResource.set(p.resource, row);
  }
  const rows = [...byResource.entries()]
    .map(([resource, keys]) => ({ resource, label: resourceLabel(resource), keys }))
    .sort((a, b) => a.label.localeCompare(b.label));
  return { actions: sortActions([...actions]), rows };
}

/**
 * Turns a set of keys on or off with one rule: editing anything on a resource needs `view`,
 * and removing `view` removes the rest of that row.
 */
export function applyKeys(matrix: PermissionMatrix, current: string[], keys: string[], on: boolean): string[] {
  const next = new Set(current);
  const rowOf = new Map<string, PermissionMatrix['rows'][number]>();
  matrix.rows.forEach((row) => Object.values(row.keys).forEach((k) => rowOf.set(k, row)));

  for (const key of keys) {
    const row = rowOf.get(key);
    if (on) {
      next.add(key);
      if (row?.keys.view) next.add(row.keys.view);
    } else {
      next.delete(key);
      if (row && row.keys.view === key) Object.values(row.keys).forEach((k) => next.delete(k));
    }
  }
  return [...next];
}

interface ApiErrorShape {
  response?: { data?: { message?: string; code?: string; error?: { message?: string; code?: string } } };
  message?: string;
}

export function errorCode(error: unknown): string | undefined {
  const data = (error as ApiErrorShape)?.response?.data;
  return data?.code ?? data?.error?.code;
}

/** Best human message from an axios error; the last-super-admin rule always gets the same wording. */
export function errorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (errorCode(error) === LAST_SUPER_ADMIN_CODE) return LAST_SUPER_ADMIN_MESSAGE;
  const data = (error as ApiErrorShape)?.response?.data;
  return data?.message ?? data?.error?.message ?? (error as ApiErrorShape)?.message ?? fallback;
}

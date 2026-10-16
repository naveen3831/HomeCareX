import React, { useMemo, useRef } from 'react';
import type { Permission } from '@/types/adminRbac';
import { applyKeys, buildMatrix, humanize } from './rbacUtils';
import { useDragScroll } from './useDragScroll';

interface PermissionGridProps {
  /** Every permission the API knows about (GET /admin/permissions). */
  permissions: Permission[];
  /** Selected permission keys. */
  value: string[];
  onChange?: (next: string[]) => void;
  /** System roles are shown but can't be edited. */
  readOnly?: boolean;
}

/** A checkbox that can show the "some selected" state. */
const TriCheckbox: React.FC<{
  checked: boolean;
  indeterminate: boolean;
  disabled?: boolean;
  label: string;
  onChange: () => void;
}> = ({ checked, indeterminate, disabled, label, onChange }) => (
  <input
    type="checkbox"
    className="rbac-check"
    aria-label={label}
    checked={checked}
    disabled={disabled}
    onChange={onChange}
    ref={(el) => {
      if (el) el.indeterminate = indeterminate && !checked;
    }}
  />
);

/**
 * Permission grid: one row per resource, one column per action.
 * Row and column headers select everything in that line. Editing a resource always keeps its
 * `view` permission on, and removing `view` clears the rest of the row.
 */
export const PermissionGrid: React.FC<PermissionGridProps> = ({ permissions, value, onChange, readOnly }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  useDragScroll(scrollRef);
  const matrix = useMemo(() => buildMatrix(permissions), [permissions]);
  const selected = useMemo(() => new Set(value), [value]);
  const allKeys = useMemo(() => matrix.rows.flatMap((r) => Object.values(r.keys)), [matrix]);

  const set = (keys: string[], on: boolean) => onChange?.(applyKeys(matrix, value, keys, on));
  const state = (keys: string[]) => {
    const n = keys.filter((k) => selected.has(k)).length;
    return { checked: keys.length > 0 && n === keys.length, indeterminate: n > 0 && n < keys.length };
  };

  if (matrix.rows.length === 0) {
    return <p className="rbac-muted">No permissions are available yet.</p>;
  }

  const all = state(allKeys);
  const selectedCount = allKeys.filter((k) => selected.has(k)).length;

  return (
    <div className="rbac-grid-wrap">
      <div className="rbac-grid-summary">
        <span aria-live="polite">
          {selectedCount} of {allKeys.length} permissions selected
        </span>
        {!readOnly && (
          <label className="rbac-inline">
            <TriCheckbox
              {...all}
              label="Select all permissions"
              onChange={() => set(allKeys, !all.checked)}
            />
            Select all
          </label>
        )}
      </div>

      <div className="rbac-grid-scroll" ref={scrollRef}>
        <table className="rbac-grid">
          <caption className="sr-only">Permissions by resource and action</caption>
          <thead>
            <tr>
              <th scope="col" className="rbac-grid__resource">Resource</th>
              {matrix.actions.map((action) => {
                const keys = matrix.rows.map((r) => r.keys[action]).filter(Boolean);
                const s = state(keys);
                return (
                  <th scope="col" key={action} className="rbac-grid__cell">
                    <span className="rbac-grid__action">{humanize(action)}</span>
                    {!readOnly && (
                      <TriCheckbox
                        {...s}
                        label={`Select every ${action} permission`}
                        onChange={() => set(keys, !s.checked)}
                      />
                    )}
                  </th>
                );
              })}
              {!readOnly && <th scope="col" className="rbac-grid__cell">All</th>}
            </tr>
          </thead>
          <tbody>
            {matrix.rows.map((row) => {
              const rowKeys = Object.values(row.keys);
              const rs = state(rowKeys);
              return (
                <tr key={row.resource}>
                  <th scope="row" className="rbac-grid__resource">{row.label}</th>
                  {matrix.actions.map((action) => {
                    const key = row.keys[action];
                    return (
                      <td key={action} className="rbac-grid__cell">
                        {key ? (
                          <input
                            type="checkbox"
                            className="rbac-check"
                            aria-label={`${row.label}: ${action}`}
                            checked={selected.has(key)}
                            disabled={readOnly}
                            onChange={(e) => set([key], e.target.checked)}
                          />
                        ) : (
                          <span className="rbac-grid__none" aria-hidden>–</span>
                        )}
                      </td>
                    );
                  })}
                  {!readOnly && (
                    <td className="rbac-grid__cell">
                      <TriCheckbox
                        {...rs}
                        label={`Select all ${row.label} permissions`}
                        onChange={() => set(rowKeys, !rs.checked)}
                      />
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="rbac-swipe-hint" aria-hidden>Swipe sideways for more actions</p>
    </div>
  );
};

export default PermissionGrid;
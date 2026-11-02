import React, { useEffect, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import './FilterPanel.css';

/**
 * Shared admin filter UI (same look as Admin > Pricing):
 * a "Filter" button next to the search box, and an inline panel with labelled fields.
 * Edits are drafts until "Apply Filters"; "Clear" resets the draft and the applied filters.
 */
export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterField {
  key: string;
  label: string;
  type?: 'select' | 'text' | 'date';
  /** Required for type "select". The first option should be the "All ..." one with value "". */
  options?: FilterOption[];
  placeholder?: string;
}

export type FilterValues = Record<string, string>;

interface ButtonProps {
  count: number;
  open: boolean;
  onClick: () => void;
}

export const FilterButton: React.FC<ButtonProps> = ({ count, open, onClick }) => (
  <button
    type="button"
    className={`hcx-fp-button${count > 0 ? ' hcx-fp-button--active' : ''}`}
    onClick={onClick}
    aria-expanded={open}
    aria-controls="hcx-filter-panel"
  >
    <SlidersHorizontal size={16} aria-hidden />
    <span>Filter</span>
    {count > 0 && <span className="hcx-fp-count">{count}</span>}
  </button>
);

interface PanelProps {
  open: boolean;
  onClose: () => void;
  fields: FilterField[];
  /** Currently applied values (keys not present count as ""). */
  values: FilterValues;
  onApply: (values: FilterValues) => void;
  /** Called by "Clear" in addition to resetting the draft. Defaults to applying empty values. */
  onClear?: () => void;
}

const emptyOf = (fields: FilterField[]): FilterValues =>
  Object.fromEntries(fields.map((f) => [f.key, '']));

export const FilterPanel: React.FC<PanelProps> = ({ open, onClose, fields, values, onApply, onClear }) => {
  const normalized = (v: FilterValues): FilterValues => ({ ...emptyOf(fields), ...v });
  const valuesKey = JSON.stringify(normalized(values));
  const [draft, setDraft] = useState<FilterValues>(() => normalized(values));

  // Re-sync the draft whenever the panel opens or the applied filters change from outside (e.g. a removed tag).
  useEffect(() => {
    setDraft(normalized(values));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, valuesKey]);

  if (!open) return null;

  const dirty = JSON.stringify(draft) !== valuesKey;
  const draftHasAny = fields.some((f) => draft[f.key] !== '');
  const appliedAny = fields.some((f) => normalized(values)[f.key] !== '');

  const clear = () => {
    setDraft(emptyOf(fields));
    if (onClear) onClear();
    else onApply(emptyOf(fields));
  };

  return (
    <section id="hcx-filter-panel" className="hcx-fp" aria-label="Filters">
      <div className="hcx-fp-header">
        <h3>Filters</h3>
        <button type="button" className="hcx-fp-close" onClick={onClose} aria-label="Close filters">×</button>
      </div>
      <div className="hcx-fp-body">
        <div className="hcx-fp-grid">
          {fields.map((f) => (
            <label key={f.key} className="hcx-fp-field">
              <span>{f.label}</span>
              {(f.type ?? 'select') === 'select' ? (
                <select value={draft[f.key] ?? ''} onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}>
                  {(f.options ?? []).map((o) => (
                    <option key={o.value || 'all'} value={o.value}>{o.label}</option>
                  ))}
                </select>
              ) : (
                <input
                  type={f.type === 'date' ? 'date' : 'text'}
                  value={draft[f.key] ?? ''}
                  placeholder={f.placeholder}
                  spellCheck={false}
                  onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                />
              )}
            </label>
          ))}
        </div>
      </div>
      <div className="hcx-fp-footer">
        <button type="button" className="hcx-fp-clear" onClick={clear} disabled={!draftHasAny && !appliedAny}>Clear</button>
        <button type="button" className="hcx-fp-apply" onClick={() => onApply(draft)} disabled={!dirty}>Apply Filters</button>
      </div>
    </section>
  );
};

export default FilterPanel;

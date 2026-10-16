import React from 'react';
import { Search, X } from 'lucide-react';

export interface StatItem {
  label: string;
  value: number | string;
  icon: React.ReactNode;
}

/** Summary cards at the top of a tab: 4 across on desktop, 2x2 on phones. */
export const RbacStats: React.FC<{ items: StatItem[]; label: string }> = ({ items, label }) => (
  <section className="rbac-stats" aria-label={label}>
    {items.map((s) => (
      <div className="rbac-stat" key={s.label}>
        <span className="rbac-stat__icon" aria-hidden>{s.icon}</span>
        <div className="rbac-stat__body">
          <span className="rbac-stat__label">{s.label}</span>
          <strong className="rbac-stat__value">{s.value}</strong>
        </div>
      </div>
    ))}
  </section>
);

interface SearchProps {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  label: string;
}

export const RbacSearch: React.FC<SearchProps> = ({ value, onChange, placeholder, label }) => (
  <label className="rbac-search">
    <Search size={16} aria-hidden />
    <input
      type="search"
      value={value}
      placeholder={placeholder}
      aria-label={label}
      onChange={(e) => onChange(e.target.value)}
    />
    {value && (
      <button type="button" className="rbac-search__clear" aria-label="Clear search" onClick={() => onChange('')}>
        <X size={14} />
      </button>
    )}
  </label>
);

export const initials = (name: string): string =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || '?';

/** Card heading used above the toolbar and table: title + one-line description, small count on the right. */
export const RbacBoardHeader: React.FC<{ title: string; description: string; meta?: React.ReactNode }> = ({ title, description, meta }) => (
  <header className="rbac-board__header">
    <div className="rbac-board__heading">
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
    {meta && <span className="rbac-board__meta">{meta}</span>}
  </header>
);
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { allAdminPages } from '@/config/adminNav';
import { useClickOutside } from '@/hooks/useClickOutside';

/** Search bar shown in the row below the header. */
export const AdminSearch: React.FC = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const searchRef = useClickOutside<HTMLDivElement>(query !== '', () => setQuery(''));

  const needle = query.trim().toLowerCase();
  const results = needle
    ? allAdminPages
        .filter((p) => p.label.toLowerCase().includes(needle) || p.groupName.toLowerCase().includes(needle))
        .slice(0, 8)
    : [];

  const go = (path: string) => {
    navigate(path);
    setQuery('');
    setActive(0);
  };

  const onSearchKey = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (results.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((i) => (i + 1) % results.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((i) => (i - 1 + results.length) % results.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      go(results[Math.min(active, results.length - 1)].path);
    }
  };

  return (
    <div className="topbar-search" ref={searchRef}>
      <Search className="topbar-search__icon" aria-hidden />
      <input
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
        }}
        onKeyDown={onSearchKey}
        placeholder="Search pages…"
        className="topbar-search__input"
        aria-label="Search admin pages"
        role="combobox"
        aria-expanded={results.length > 0}
        aria-controls="admin-search-results"
      />
      {needle && (
        <ul className="topbar-search__results" id="admin-search-results" role="listbox">
          {results.length === 0 ? (
            <li className="hcx-search-empty">No pages match “{query}”</li>
          ) : (
            results.map((page, i) => (
              <li key={page.path} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(page.path)}
                  className={`topbar-search__result-btn${i === active ? ' is-active' : ''}`}
                >
                  {page.label}
                  <span className="topbar-search__result-group">{page.groupName}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
};

export default AdminSearch;
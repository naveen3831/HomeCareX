import React from 'react';
import { Search, X } from 'lucide-react';
import { useUIStore } from '@/store/useUIStore';

interface PageSearchProps {
  placeholder: string;
  label?: string;
}

/** Search box that sits inside a page (under its title) and filters that page's own list. Shares text through the UI store; AdminLayout clears it on every route change. */
export const PageSearch: React.FC<PageSearchProps> = ({ placeholder, label = 'Search this page' }) => {
  const value = useUIStore((s) => s.pageSearch);
  const setValue = useUIStore((s) => s.setPageSearch);

  return (
    <div className="hcx-pagesearch">
      <Search className="hcx-pagesearch__icon" size={16} aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="hcx-pagesearch__input"
      />
      {value && (
        <button type="button" className="hcx-pagesearch__clear" onClick={() => setValue('')} aria-label="Clear search">
          <X size={14} aria-hidden />
        </button>
      )}
    </div>
  );
};

export default PageSearch;

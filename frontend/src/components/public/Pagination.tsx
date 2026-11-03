import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
}) => {
  if (totalPages <= 1) {
    return null;
  }

  const pages = Array.from(
    { length: totalPages },
    (_, index) => index + 1
  );

  return (
    <nav
      aria-label="Pagination"
      className="mt-8 mb-4 flex flex-wrap items-center justify-center gap-1.5"
    >
      {/* Previous */}
      <button
        type="button"
        disabled={currentPage === 1}
        onClick={() => onPageChange(currentPage - 1)}
        aria-label="Previous page"
        className="inline-flex h-9 items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-2xs transition hover:border-indigo-200 hover:bg-indigo-50/50 hover:text-indigo-600 disabled:pointer-events-none disabled:opacity-40"
      >
        <ChevronLeft size={14} />
        <span>Previous</span>
      </button>

      {/* Pages */}
      <div className="flex items-center gap-1">
        {pages.map((page) => {
          const isActive = currentPage === page;
          return (
            <button
              key={page}
              type="button"
              onClick={() => onPageChange(page)}
              aria-current={isActive ? "page" : undefined}
              className={`flex h-9 min-w-9 items-center justify-center rounded-xl px-2.5 text-xs font-bold transition-all duration-200 ${
                isActive
                  ? "bg-gradient-to-r from-[#4338ca] to-[#3730a3] text-white shadow-xs shadow-indigo-300/40"
                  : "border border-slate-200 bg-white text-slate-700 hover:border-indigo-200 hover:bg-indigo-50/50 hover:text-indigo-600"
              }`}
            >
              {page}
            </button>
          );
        })}
      </div>

      {/* Next */}
      <button
        type="button"
        disabled={currentPage === totalPages}
        onClick={() => onPageChange(currentPage + 1)}
        aria-label="Next page"
        className="inline-flex h-9 items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-2xs transition hover:border-indigo-200 hover:bg-indigo-50/50 hover:text-indigo-600 disabled:pointer-events-none disabled:opacity-40"
      >
        <span>Next</span>
        <ChevronRight size={14} />
      </button>
    </nav>
  );
};

export default Pagination;

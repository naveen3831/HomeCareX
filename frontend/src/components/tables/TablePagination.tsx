import React from "react";

import "./DataTable.css";

interface TablePaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions?: number[];
  /** Used for the select's id and aria-label, e.g. "bookings". */
  label?: string;
}

/** Footer for any list: rows per page, "Showing 1–10 of 42", Previous / Next. */
const TablePagination: React.FC<TablePaginationProps> = ({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50],
  label = "rows",
}) => {
  if (total === 0) return null;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const selectId = `${label.replace(/\s+/g, "-")}-page-size`;

  return (
    <div className="datatable-footer" role="navigation" aria-label={`${label} pagination`}>
      <div className="datatable-page-size">
        <label htmlFor={selectId}>Rows per page</label>

        <select
          id={selectId}
          value={pageSize}
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
        >
          {pageSizeOptions.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>

        <span className="datatable-range">
          Showing {from}–{to} of {total}
        </span>
      </div>

      <div className="datatable-pagination">
        <button type="button" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          Previous
        </button>

        <span>
          Page {page} of {totalPages}
        </span>

        <button type="button" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          Next
        </button>
      </div>
    </div>
  );
};

export default TablePagination;

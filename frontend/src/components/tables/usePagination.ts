import { useEffect, useMemo, useState } from "react";

interface Options {
  initialPageSize?: number;
  /** When this value changes (a search text, a filter) the list goes back to page 1. */
  resetKey?: unknown;
}

/** Client-side paging for a list that is already fully loaded. */
export function usePagination<T>(items: readonly T[], options: Options = {}) {
  const { initialPageSize = 10, resetKey } = options;

  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(initialPageSize);

  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  // Deleting the last row of the last page must not leave an empty page behind.
  const currentPage = Math.min(page, totalPages);

  useEffect(() => {
    setPage(1);
  }, [resetKey]);

  const pageItems = useMemo(
    () => items.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [items, currentPage, pageSize],
  );

  const setPageSize = (size: number) => {
    setPageSizeState(size);
    setPage(1);
  };

  return {
    pageItems,
    page: currentPage,
    pageSize,
    total,
    totalPages,
    setPage,
    setPageSize,
  };
}

export type Pager = ReturnType<typeof usePagination>;

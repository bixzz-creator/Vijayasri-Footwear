import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CatalogPaginationProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
}

export function CatalogPagination({
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  onPageChange,
}: CatalogPaginationProps) {
  if (totalPages <= 1) return null;

  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalItems);

  return (
    <nav className="nike-pagination" aria-label="Catalog pages">
      <span className="nike-pagination-meta">
        Showing {start}–{end} of {totalItems}
      </span>
      <div className="nike-pagination-controls">
        <button
          type="button"
          className="nike-pagination-btn"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft size={18} />
        </button>
        <span className="nike-pagination-current">
          Page {currentPage} / {totalPages}
        </span>
        <button
          type="button"
          className="nike-pagination-btn"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          aria-label="Next page"
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </nav>
  );
}

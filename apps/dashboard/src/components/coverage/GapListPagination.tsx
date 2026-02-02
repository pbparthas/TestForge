/**
 * GapListPagination Component
 * Paginated list of coverage gaps
 */

import { Card, Button } from '../ui';

interface CoverageGap {
  id: string;
  title: string;
  type: string;
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
  requirement?: string;
  suggestedAction: string;
  createdAt: string;
}

interface GapListPaginationProps {
  gaps: CoverageGap[];
  currentPage: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onGapClick?: (gap: CoverageGap) => void;
  loading?: boolean;
}

const RISK_STYLES = {
  critical: 'bg-red-100 text-red-700',
  high: 'bg-orange-100 text-orange-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-green-100 text-green-700',
};

export function GapListPagination({
  gaps,
  currentPage,
  pageSize,
  totalCount,
  onPageChange,
  onPageSizeChange,
  onGapClick,
  loading = false,
}: GapListPaginationProps) {
  const totalPages = Math.ceil(totalCount / pageSize);
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalCount);

  const pageSizeOptions = [10, 25, 50, 100];

  const getPageNumbers = () => {
    const pages: (number | 'ellipsis')[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('ellipsis');

      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) pages.push(i);

      if (currentPage < totalPages - 2) pages.push('ellipsis');
      pages.push(totalPages);
    }

    return pages;
  };

  if (loading) {
    return (
      <Card className="p-4">
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="animate-pulse flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
              <div className="h-4 w-16 bg-gray-200 rounded" />
              <div className="flex-1 h-4 bg-gray-200 rounded" />
              <div className="h-4 w-20 bg-gray-200 rounded" />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-700">Coverage Gaps</h3>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span>Show</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
          <span>per page</span>
        </div>
      </div>

      {gaps.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="font-medium">No coverage gaps found</p>
          <p className="text-sm mt-1">All requirements are covered by tests</p>
        </div>
      ) : (
        <>
          {/* Gap List */}
          <div className="space-y-2 mb-4">
            {gaps.map((gap) => (
              <div
                key={gap.id}
                onClick={() => onGapClick?.(gap)}
                className={`flex items-center gap-4 p-3 rounded-lg border border-gray-200 transition-colors ${
                  onGapClick ? 'cursor-pointer hover:bg-gray-50' : ''
                }`}
              >
                <span className={`px-2 py-0.5 text-xs rounded-full ${RISK_STYLES[gap.riskLevel]}`}>
                  {gap.riskLevel}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{gap.title}</p>
                  {gap.requirement && (
                    <p className="text-xs text-gray-500 truncate">Req: {gap.requirement}</p>
                  )}
                </div>
                <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                  {gap.type}
                </span>
                <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            ))}
          </div>

          {/* Pagination Controls */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-500">
              Showing {startItem} to {endItem} of {totalCount} gaps
            </p>

            <div className="flex items-center gap-1">
              <Button
                variant="secondary"
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-2 py-1"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Button>

              {getPageNumbers().map((page, index) =>
                page === 'ellipsis' ? (
                  <span key={`ellipsis-${index}`} className="px-2 text-gray-400">
                    ...
                  </span>
                ) : (
                  <button
                    key={page}
                    onClick={() => onPageChange(page)}
                    className={`px-3 py-1 text-sm rounded ${
                      currentPage === page
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {page}
                  </button>
                )
              )}

              <Button
                variant="secondary"
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-2 py-1"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Button>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}

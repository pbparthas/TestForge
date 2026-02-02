/**
 * VisualRegressionList Component
 * List of visual regression test results with filtering and bulk actions
 */

import { useState } from 'react';
import { Card, Button } from '../ui';

interface VisualRegression {
  id: string;
  testName: string;
  pageName: string;
  baselineUrl: string;
  actualUrl: string;
  diffUrl?: string;
  diffPercentage: number;
  status: 'pending' | 'approved' | 'rejected' | 'new_baseline';
  viewport: string;
  browser: string;
  createdAt: string;
}

interface VisualRegressionListProps {
  regressions: VisualRegression[];
  loading?: boolean;
  onSelect: (regression: VisualRegression) => void;
  onApprove: (ids: string[]) => void;
  onReject: (ids: string[]) => void;
  onSetNewBaseline: (ids: string[]) => void;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
}

const STATUS_STYLES = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  new_baseline: 'bg-blue-100 text-blue-700',
};

const STATUS_LABELS = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  new_baseline: 'New Baseline',
};

export function VisualRegressionList({
  regressions,
  loading = false,
  onSelect,
  onApprove,
  onReject,
  onSetNewBaseline,
  selectedIds = [],
  onSelectionChange,
}: VisualRegressionListProps) {
  const [filter, setFilter] = useState<VisualRegression['status'] | 'all'>('all');
  const [sortBy, setSortBy] = useState<'diff' | 'date' | 'name'>('diff');

  const filteredRegressions = regressions
    .filter((r) => filter === 'all' || r.status === filter)
    .sort((a, b) => {
      if (sortBy === 'diff') return b.diffPercentage - a.diffPercentage;
      if (sortBy === 'date') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return a.testName.localeCompare(b.testName);
    });

  const pendingCount = regressions.filter((r) => r.status === 'pending').length;

  const toggleSelection = (id: string) => {
    if (!onSelectionChange) return;
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter((i) => i !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  };

  const selectAll = () => {
    if (!onSelectionChange) return;
    const pendingIds = filteredRegressions
      .filter((r) => r.status === 'pending')
      .map((r) => r.id);
    onSelectionChange(pendingIds);
  };

  const clearSelection = () => {
    onSelectionChange?.([]);
  };

  const getDiffColor = (diff: number) => {
    if (diff === 0) return 'text-green-600';
    if (diff < 1) return 'text-yellow-600';
    if (diff < 5) return 'text-orange-600';
    return 'text-red-600';
  };

  if (loading) {
    return (
      <Card className="p-4">
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="animate-pulse flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
              <div className="w-16 h-12 bg-gray-200 rounded" />
              <div className="flex-1">
                <div className="h-4 w-48 bg-gray-200 rounded mb-2" />
                <div className="h-3 w-32 bg-gray-200 rounded" />
              </div>
              <div className="h-6 w-16 bg-gray-200 rounded" />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div>
          <h3 className="text-sm font-medium text-gray-700">Visual Regressions</h3>
          <p className="text-xs text-gray-500">
            {pendingCount} pending review · {regressions.length} total
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as VisualRegression['status'] | 'all')}
            className="px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="new_baseline">New Baseline</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="diff">Sort by Diff</option>
            <option value="date">Sort by Date</option>
            <option value="name">Sort by Name</option>
          </select>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedIds.length > 0 && (
        <div className="flex items-center justify-between px-4 py-2 bg-blue-50 border-b border-blue-200">
          <span className="text-sm text-blue-700">{selectedIds.length} selected</span>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => onApprove(selectedIds)}
              className="text-xs py-1 px-2 bg-green-600 hover:bg-green-700"
            >
              Approve All
            </Button>
            <Button
              onClick={() => onReject(selectedIds)}
              variant="secondary"
              className="text-xs py-1 px-2"
            >
              Reject All
            </Button>
            <Button
              onClick={() => onSetNewBaseline(selectedIds)}
              variant="secondary"
              className="text-xs py-1 px-2"
            >
              Set as Baseline
            </Button>
            <button
              onClick={clearSelection}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Selection Controls */}
      {onSelectionChange && filteredRegressions.some((r) => r.status === 'pending') && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-100">
          <button
            onClick={selectAll}
            className="text-xs text-blue-600 hover:text-blue-700"
          >
            Select all pending
          </button>
        </div>
      )}

      {/* List */}
      {filteredRegressions.length === 0 ? (
        <div className="p-8 text-center text-gray-500">
          <svg className="w-12 h-12 mx-auto mb-3 text-green-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="font-medium text-green-600">No visual regressions</p>
          <p className="text-sm mt-1">All screenshots match baselines</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
          {filteredRegressions.map((regression) => (
            <div
              key={regression.id}
              className={`flex items-center gap-4 p-4 transition-colors cursor-pointer ${
                selectedIds.includes(regression.id) ? 'bg-blue-50' : 'hover:bg-gray-50'
              }`}
              onClick={() => onSelect(regression)}
            >
              {/* Checkbox */}
              {onSelectionChange && regression.status === 'pending' && (
                <input
                  type="checkbox"
                  checked={selectedIds.includes(regression.id)}
                  onChange={(e) => {
                    e.stopPropagation();
                    toggleSelection(regression.id);
                  }}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              )}

              {/* Thumbnail */}
              <div className="relative flex-shrink-0">
                <img
                  src={regression.actualUrl}
                  alt={regression.testName}
                  className="w-20 h-14 object-cover rounded border border-gray-200"
                />
                {regression.diffPercentage > 0 && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs font-bold">!</span>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{regression.testName}</p>
                <p className="text-xs text-gray-500">{regression.pageName}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                  <span>{regression.viewport}</span>
                  <span>{regression.browser}</span>
                  <span>{new Date(regression.createdAt).toLocaleDateString()}</span>
                </div>
              </div>

              {/* Diff & Status */}
              <div className="flex items-center gap-3">
                <span className={`text-lg font-bold ${getDiffColor(regression.diffPercentage)}`}>
                  {regression.diffPercentage.toFixed(1)}%
                </span>
                <span className={`px-2 py-1 text-xs rounded ${STATUS_STYLES[regression.status]}`}>
                  {STATUS_LABELS[regression.status]}
                </span>
              </div>

              {/* Arrow */}
              <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

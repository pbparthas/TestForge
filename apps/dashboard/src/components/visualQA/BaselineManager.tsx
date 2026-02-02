/**
 * BaselineManager Component
 * Manage visual test baselines - view, update, delete
 */

import { useState } from 'react';
import { Card } from '../ui';

interface Baseline {
  id: string;
  pageName: string;
  viewport: string;
  browser: string;
  screenshotUrl: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}

interface BaselineManagerProps {
  baselines: Baseline[];
  loading?: boolean;
  onUpdate: (baselineId: string) => void;
  onDelete: (baselineId: string) => void;
  onViewHistory: (baselineId: string) => void;
  onPreview: (baseline: Baseline) => void;
}

export function BaselineManager({
  baselines,
  loading = false,
  onUpdate,
  onDelete,
  onViewHistory,
  onPreview,
}: BaselineManagerProps) {
  const [filter, setFilter] = useState('');
  const [groupBy, setGroupBy] = useState<'page' | 'viewport' | 'browser'>('page');

  const filteredBaselines = baselines.filter((b) =>
    b.pageName.toLowerCase().includes(filter.toLowerCase())
  );

  const groupedBaselines = filteredBaselines.reduce((groups, baseline) => {
    const key = baseline[groupBy === 'page' ? 'pageName' : groupBy];
    if (!groups[key]) groups[key] = [];
    groups[key].push(baseline);
    return groups;
  }, {} as Record<string, Baseline[]>);

  if (loading) {
    return (
      <Card className="p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="h-24 bg-gray-200 rounded-lg mb-2" />
              <div className="h-4 w-32 bg-gray-200 rounded" />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-gray-700">Baseline Manager</h3>
            <p className="text-xs text-gray-500">{baselines.length} baselines</p>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Search pages..."
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as typeof groupBy)}
              className="px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="page">Group by Page</option>
              <option value="viewport">Group by Viewport</option>
              <option value="browser">Group by Browser</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Baselines Grid */}
      {Object.keys(groupedBaselines).length === 0 ? (
        <Card className="p-8 text-center text-gray-500">
          <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="font-medium">No baselines found</p>
          <p className="text-sm mt-1">Run visual tests to create baselines</p>
        </Card>
      ) : (
        Object.entries(groupedBaselines).map(([group, items]) => (
          <Card key={group} className="overflow-hidden">
            <div className="p-3 bg-gray-50 border-b border-gray-200">
              <h4 className="text-sm font-medium text-gray-700">
                {group} ({items.length})
              </h4>
            </div>
            <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
              {items.map((baseline) => (
                <div
                  key={baseline.id}
                  className="group relative rounded-lg border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
                >
                  {/* Screenshot */}
                  <div
                    className="aspect-video bg-gray-100 cursor-pointer"
                    onClick={() => onPreview(baseline)}
                  >
                    <img
                      src={baseline.screenshotUrl}
                      alt={baseline.pageName}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Info */}
                  <div className="p-2">
                    <p className="text-xs font-medium text-gray-900 truncate">
                      {baseline.pageName}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                      <span>{baseline.viewport}</span>
                      <span>·</span>
                      <span>{baseline.browser}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      v{baseline.version} · {new Date(baseline.updatedAt).toLocaleDateString()}
                    </p>
                  </div>

                  {/* Hover Actions */}
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => onUpdate(baseline.id)}
                      className="p-1.5 bg-white rounded shadow hover:bg-gray-50"
                      title="Update baseline"
                    >
                      <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </button>
                    <button
                      onClick={() => onViewHistory(baseline.id)}
                      className="p-1.5 bg-white rounded shadow hover:bg-gray-50"
                      title="View history"
                    >
                      <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => onDelete(baseline.id)}
                      className="p-1.5 bg-white rounded shadow hover:bg-gray-50"
                      title="Delete baseline"
                    >
                      <svg className="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))
      )}
    </div>
  );
}

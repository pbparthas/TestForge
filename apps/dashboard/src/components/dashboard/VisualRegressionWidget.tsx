/**
 * VisualRegressionWidget Component
 * Regression count, trend chart (mini), quick review link
 */

import { Card, Button } from '../ui';

interface TrendPoint {
  date: string;
  count: number;
}

interface VisualRegressionWidgetProps {
  totalRegressions: number;
  pendingReview: number;
  approved: number;
  rejected: number;
  trend: TrendPoint[];
  loading?: boolean;
  onReview?: () => void;
  onRunTests?: () => void;
}

export function VisualRegressionWidget({
  totalRegressions,
  pendingReview,
  approved,
  rejected,
  trend,
  loading = false,
  onReview,
  onRunTests,
}: VisualRegressionWidgetProps) {
  if (loading) {
    return (
      <Card className="p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-4 w-32 bg-gray-200 rounded" />
          <div className="h-12 w-20 bg-gray-200 rounded" />
          <div className="h-16 bg-gray-200 rounded" />
        </div>
      </Card>
    );
  }

  // Calculate mini sparkline
  const maxCount = Math.max(...trend.map((t) => t.count), 1);
  const sparklinePoints = trend.map((point, i) => {
    const x = (i / (trend.length - 1 || 1)) * 100;
    const y = 100 - (point.count / maxCount) * 100;
    return `${x},${y}`;
  }).join(' ');

  const trendChange = trend.length >= 2
    ? (trend[trend.length - 1]?.count ?? 0) - (trend[trend.length - 2]?.count ?? 0)
    : 0;

  return (
    <Card className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-medium text-gray-700">Visual Regression</h3>
          <p className="text-xs text-gray-500">Screenshot comparison</p>
        </div>
        <div className="p-2 bg-pink-100 rounded-lg">
          <svg className="w-5 h-5 text-pink-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
      </div>

      {/* Main Stat with Trend */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-end gap-2">
            <p className="text-4xl font-bold text-gray-900">{totalRegressions}</p>
            {trendChange !== 0 && (
              <span className={`text-sm mb-1 ${trendChange > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {trendChange > 0 ? '+' : ''}{trendChange}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500">Total regressions</p>
        </div>

        {/* Mini Sparkline */}
        {trend.length > 1 && (
          <div className="w-20 h-10">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
              <polyline
                points={sparklinePoints}
                fill="none"
                stroke="#ec4899"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        )}
      </div>

      {/* Pending Review Alert */}
      {pendingReview > 0 && (
        <div className="mb-4 p-3 bg-pink-50 border border-pink-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-pink-500 rounded-full animate-pulse" />
              <span className="text-sm font-medium text-pink-800">
                {pendingReview} need review
              </span>
            </div>
            {onReview && (
              <button
                onClick={onReview}
                className="text-xs text-pink-700 hover:text-pink-900 font-medium"
              >
                Review →
              </button>
            )}
          </div>
        </div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="p-2 bg-yellow-50 rounded text-center">
          <p className="text-lg font-semibold text-yellow-600">{pendingReview}</p>
          <p className="text-xs text-yellow-500">Pending</p>
        </div>
        <div className="p-2 bg-green-50 rounded text-center">
          <p className="text-lg font-semibold text-green-600">{approved}</p>
          <p className="text-xs text-green-500">Approved</p>
        </div>
        <div className="p-2 bg-red-50 rounded text-center">
          <p className="text-lg font-semibold text-red-600">{rejected}</p>
          <p className="text-xs text-red-500">Rejected</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        {onReview && pendingReview > 0 && (
          <Button onClick={onReview} className="flex-1 text-xs py-1.5">
            Review All
          </Button>
        )}
        {onRunTests && (
          <Button variant="secondary" onClick={onRunTests} className="flex-1 text-xs py-1.5">
            Run Tests
          </Button>
        )}
      </div>
    </Card>
  );
}

/**
 * FlakyTestsWidget Component
 * Flaky test count, trend indicator, quick actions
 */

import { Card, Button } from '../ui';

interface FlakyTestsWidgetProps {
  totalFlaky: number;
  newThisWeek: number;
  resolvedThisWeek: number;
  trend: number; // percentage change
  topFlaky?: { name: string; score: number }[];
  loading?: boolean;
  onViewAll?: () => void;
  onQuarantine?: () => void;
}

export function FlakyTestsWidget({
  totalFlaky,
  newThisWeek,
  resolvedThisWeek,
  trend,
  topFlaky = [],
  loading = false,
  onViewAll,
  onQuarantine,
}: FlakyTestsWidgetProps) {
  if (loading) {
    return (
      <Card className="p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-4 w-32 bg-gray-200 rounded" />
          <div className="h-12 w-20 bg-gray-200 rounded" />
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-4 bg-gray-200 rounded" />
            ))}
          </div>
        </div>
      </Card>
    );
  }

  const trendColor = trend > 0 ? 'text-red-600' : trend < 0 ? 'text-green-600' : 'text-gray-500';
  const trendIcon = trend > 0 ? '↑' : trend < 0 ? '↓' : '→';

  return (
    <Card className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-medium text-gray-700">Flaky Tests</h3>
          <p className="text-xs text-gray-500">Tests with inconsistent results</p>
        </div>
        <div className="p-2 bg-orange-100 rounded-lg">
          <svg className="w-5 h-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
      </div>

      {/* Main Stat */}
      <div className="flex items-end gap-3 mb-4">
        <p className="text-4xl font-bold text-gray-900">{totalFlaky}</p>
        <div className={`flex items-center gap-1 text-sm ${trendColor} mb-1`}>
          <span>{trendIcon}</span>
          <span>{Math.abs(trend)}%</span>
        </div>
      </div>

      {/* Weekly Stats */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="p-2 bg-red-50 rounded-lg text-center">
          <p className="text-lg font-semibold text-red-600">+{newThisWeek}</p>
          <p className="text-xs text-red-500">New this week</p>
        </div>
        <div className="p-2 bg-green-50 rounded-lg text-center">
          <p className="text-lg font-semibold text-green-600">-{resolvedThisWeek}</p>
          <p className="text-xs text-green-500">Resolved</p>
        </div>
      </div>

      {/* Top Flaky Tests */}
      {topFlaky.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-medium text-gray-500 mb-2">Most Flaky</p>
          <div className="space-y-2">
            {topFlaky.slice(0, 3).map((test, index) => (
              <div key={index} className="flex items-center justify-between">
                <span className="text-xs text-gray-700 truncate max-w-[150px]">{test.name}</span>
                <span className={`text-xs font-medium ${
                  test.score >= 50 ? 'text-red-600' : test.score >= 25 ? 'text-orange-600' : 'text-yellow-600'
                }`}>
                  {test.score}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="flex gap-2">
        {onViewAll && (
          <Button variant="secondary" onClick={onViewAll} className="flex-1 text-xs py-1.5">
            View All
          </Button>
        )}
        {onQuarantine && (
          <Button variant="secondary" onClick={onQuarantine} className="flex-1 text-xs py-1.5">
            Quarantine
          </Button>
        )}
      </div>
    </Card>
  );
}

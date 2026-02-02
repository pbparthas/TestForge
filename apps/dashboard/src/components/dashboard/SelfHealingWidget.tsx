/**
 * SelfHealingWidget Component
 * Pending review count, auto-fixed count, time saved metric
 */

import { Card, Button } from '../ui';

interface SelfHealingWidgetProps {
  pendingReview: number;
  autoFixed: number;
  approved: number;
  rejected: number;
  timeSavedHours: number;
  successRate: number;
  loading?: boolean;
  onReviewPending?: () => void;
  onViewHistory?: () => void;
}

export function SelfHealingWidget({
  pendingReview,
  autoFixed,
  approved,
  rejected,
  timeSavedHours,
  successRate,
  loading = false,
  onReviewPending,
  onViewHistory,
}: SelfHealingWidgetProps) {
  if (loading) {
    return (
      <Card className="p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-4 w-32 bg-gray-200 rounded" />
          <div className="grid grid-cols-2 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded" />
            ))}
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-medium text-gray-700">Self-Healing</h3>
          <p className="text-xs text-gray-500">AI-powered test maintenance</p>
        </div>
        <div className="p-2 bg-emerald-100 rounded-lg">
          <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </div>
      </div>

      {/* Pending Review Alert */}
      {pendingReview > 0 && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
              <span className="text-sm font-medium text-yellow-800">
                {pendingReview} pending review
              </span>
            </div>
            {onReviewPending && (
              <button
                onClick={onReviewPending}
                className="text-xs text-yellow-700 hover:text-yellow-900 font-medium"
              >
                Review →
              </button>
            )}
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="p-3 bg-blue-50 rounded-lg text-center">
          <p className="text-2xl font-bold text-blue-600">{autoFixed}</p>
          <p className="text-xs text-blue-500">Auto-Fixed</p>
        </div>
        <div className="p-3 bg-green-50 rounded-lg text-center">
          <p className="text-2xl font-bold text-green-600">{approved}</p>
          <p className="text-xs text-green-500">Approved</p>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg text-center">
          <p className="text-2xl font-bold text-gray-600">{timeSavedHours}h</p>
          <p className="text-xs text-gray-500">Time Saved</p>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg text-center">
          <p className="text-2xl font-bold text-gray-600">{successRate}%</p>
          <p className="text-xs text-gray-500">Success Rate</p>
        </div>
      </div>

      {/* Success Rate Bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-gray-500">Approval Rate</span>
          <span className="text-gray-700">{approved} / {approved + rejected}</span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 rounded-full"
            style={{ width: `${(approved / (approved + rejected || 1)) * 100}%` }}
          />
        </div>
      </div>

      {/* View History */}
      {onViewHistory && (
        <Button variant="secondary" onClick={onViewHistory} className="w-full text-xs py-1.5">
          View History
        </Button>
      )}
    </Card>
  );
}

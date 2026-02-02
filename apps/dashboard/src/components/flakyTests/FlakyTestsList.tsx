/**
 * FlakyTestsList Component
 * List of flaky tests with details and actions
 */

import { useState } from 'react';
import { Card, Button } from '../ui';

interface FlakyTest {
  id: string;
  name: string;
  suiteName: string;
  flakinessScore: number;
  failureCount: number;
  totalRuns: number;
  lastFailure: string;
  status: 'investigating' | 'known_issue' | 'needs_fix' | 'quarantined' | 'resolved';
  assignee?: string;
  tags?: string[];
}

interface FlakyTestsListProps {
  tests: FlakyTest[];
  loading?: boolean;
  onTestClick?: (test: FlakyTest) => void;
  onStatusChange?: (testId: string, status: FlakyTest['status']) => void;
  onQuarantine?: (testId: string) => void;
}

const STATUS_OPTIONS: { value: FlakyTest['status']; label: string; color: string }[] = [
  { value: 'investigating', label: 'Investigating', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'known_issue', label: 'Known Issue', color: 'bg-purple-100 text-purple-700' },
  { value: 'needs_fix', label: 'Needs Fix', color: 'bg-red-100 text-red-700' },
  { value: 'quarantined', label: 'Quarantined', color: 'bg-gray-100 text-gray-700' },
  { value: 'resolved', label: 'Resolved', color: 'bg-green-100 text-green-700' },
];

export function FlakyTestsList({
  tests,
  loading = false,
  onTestClick,
  onStatusChange,
  onQuarantine,
}: FlakyTestsListProps) {
  const [sortBy, setSortBy] = useState<'score' | 'failures' | 'recent'>('score');
  const [filterStatus, setFilterStatus] = useState<FlakyTest['status'] | 'all'>('all');

  const filteredTests = tests
    .filter((test) => filterStatus === 'all' || test.status === filterStatus)
    .sort((a, b) => {
      if (sortBy === 'score') return b.flakinessScore - a.flakinessScore;
      if (sortBy === 'failures') return b.failureCount - a.failureCount;
      return new Date(b.lastFailure).getTime() - new Date(a.lastFailure).getTime();
    });

  const getScoreColor = (score: number) => {
    if (score >= 50) return 'text-red-600 bg-red-50';
    if (score >= 25) return 'text-orange-600 bg-orange-50';
    if (score >= 10) return 'text-yellow-600 bg-yellow-50';
    return 'text-green-600 bg-green-50';
  };

  if (loading) {
    return (
      <Card className="p-4">
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="animate-pulse flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
              <div className="h-10 w-10 bg-gray-200 rounded" />
              <div className="flex-1">
                <div className="h-4 w-48 bg-gray-200 rounded mb-2" />
                <div className="h-3 w-32 bg-gray-200 rounded" />
              </div>
              <div className="h-6 w-20 bg-gray-200 rounded" />
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
        <h3 className="text-sm font-medium text-gray-700">Flaky Tests ({filteredTests.length})</h3>
        <div className="flex items-center gap-3">
          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as FlakyTest['status'] | 'all')}
            className="px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Statuses</option>
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="score">Sort by Score</option>
            <option value="failures">Sort by Failures</option>
            <option value="recent">Sort by Recent</option>
          </select>
        </div>
      </div>

      {/* List */}
      {filteredTests.length === 0 ? (
        <div className="p-8 text-center text-gray-500">
          <svg className="w-12 h-12 mx-auto mb-3 text-green-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="font-medium text-green-600">No flaky tests found</p>
          <p className="text-sm mt-1">All tests are running consistently</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
          {filteredTests.map((test) => (
            <div
              key={test.id}
              className={`p-4 transition-colors ${onTestClick ? 'cursor-pointer hover:bg-gray-50' : ''}`}
              onClick={() => onTestClick?.(test)}
            >
              <div className="flex items-start gap-4">
                {/* Flakiness Score */}
                <div className={`flex-shrink-0 w-14 h-14 rounded-lg flex flex-col items-center justify-center ${getScoreColor(test.flakinessScore)}`}>
                  <span className="text-lg font-bold">{test.flakinessScore}</span>
                  <span className="text-xs">%</span>
                </div>

                {/* Test Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{test.name}</p>
                    {test.tags?.map((tag) => (
                      <span key={tag} className="px-1.5 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mb-2">{test.suiteName}</p>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>{test.failureCount} / {test.totalRuns} failed</span>
                    <span>Last: {new Date(test.lastFailure).toLocaleDateString()}</span>
                    {test.assignee && (
                      <span className="flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        {test.assignee}
                      </span>
                    )}
                  </div>
                </div>

                {/* Status & Actions */}
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  {onStatusChange ? (
                    <select
                      value={test.status}
                      onChange={(e) => onStatusChange(test.id, e.target.value as FlakyTest['status'])}
                      className={`px-2 py-1 text-xs rounded border-0 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        STATUS_OPTIONS.find((s) => s.value === test.status)?.color || 'bg-gray-100'
                      }`}
                    >
                      {STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  ) : (
                    <span className={`px-2 py-1 text-xs rounded ${
                      STATUS_OPTIONS.find((s) => s.value === test.status)?.color || 'bg-gray-100'
                    }`}>
                      {STATUS_OPTIONS.find((s) => s.value === test.status)?.label || test.status}
                    </span>
                  )}

                  {onQuarantine && test.status !== 'quarantined' && (
                    <Button
                      variant="secondary"
                      onClick={() => onQuarantine(test.id)}
                      className="text-xs py-1 px-2"
                      title="Quarantine test"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                      </svg>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

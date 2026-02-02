/**
 * ResultsTab Component
 * Execution history list, result details expansion
 */

import { useState } from 'react';
import { Card, Button, StatusBadge } from '../ui';

interface ExecutionResult {
  id: string;
  suiteId: string;
  suiteName: string;
  status: 'passed' | 'failed' | 'running' | 'pending';
  startedAt: string;
  completedAt?: string;
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    duration?: number;
  };
  profile: string;
  triggeredBy: string;
  failedTests?: Array<{
    name: string;
    error: string;
  }>;
}

interface ResultsTabProps {
  results: ExecutionResult[];
  loading?: boolean;
  onViewDetails: (resultId: string) => void;
  onRerun: (resultId: string) => void;
}

export function ResultsTab({ results, loading = false, onViewDetails, onRerun }: ResultsTabProps) {
  const [expandedResult, setExpandedResult] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'passed' | 'failed'>('all');

  const filteredResults = results.filter((r) => {
    if (filter === 'all') return true;
    return r.status === filter;
  });

  const formatDuration = (ms?: number) => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    const mins = Math.floor(ms / 60000);
    const secs = ((ms % 60000) / 1000).toFixed(0);
    return `${mins}m ${secs}s`;
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString();
  };

  if (loading) {
    return (
      <div className="text-center py-12 text-gray-500">Loading results...</div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <div className="flex items-center gap-2">
        {(['all', 'passed', 'failed'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
              filter === f
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f === 'all' ? 'All' : f === 'passed' ? 'Passed' : 'Failed'}
            <span className="ml-1 opacity-70">
              ({results.filter((r) => f === 'all' || r.status === f).length})
            </span>
          </button>
        ))}
      </div>

      {/* Results List */}
      {filteredResults.length === 0 ? (
        <Card className="p-8 text-center text-gray-500">
          <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p>No execution results found</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredResults.map((result) => (
            <Card key={result.id} className="overflow-hidden">
              <div
                className="p-4 cursor-pointer hover:bg-gray-50"
                onClick={() => setExpandedResult(expandedResult === result.id ? null : result.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <StatusBadge status={result.status} />
                    <div>
                      <p className="font-medium text-gray-900">{result.suiteName}</p>
                      <p className="text-xs text-gray-500">{formatDate(result.startedAt)}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-green-600">{result.summary.passed} passed</span>
                      <span className="text-red-600">{result.summary.failed} failed</span>
                      <span className="text-gray-500">{result.summary.skipped} skipped</span>
                    </div>
                    <span className="text-sm text-gray-500">
                      {formatDuration(result.summary.duration)}
                    </span>
                    <svg
                      className={`w-5 h-5 text-gray-400 transition-transform ${
                        expandedResult === result.id ? 'rotate-180' : ''
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Expanded Details */}
              {expandedResult === result.id && (
                <div className="px-4 pb-4 border-t border-gray-100 pt-4">
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500">Profile</p>
                      <p className="font-medium text-gray-900">{result.profile}</p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500">Triggered By</p>
                      <p className="font-medium text-gray-900">{result.triggeredBy}</p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500">Pass Rate</p>
                      <p className="font-medium text-gray-900">
                        {result.summary.total > 0
                          ? Math.round((result.summary.passed / result.summary.total) * 100)
                          : 0}
                        %
                      </p>
                    </div>
                  </div>

                  {/* Failed Tests */}
                  {result.failedTests && result.failedTests.length > 0 && (
                    <div className="mb-4">
                      <p className="text-sm font-medium text-red-600 mb-2">
                        Failed Tests ({result.failedTests.length})
                      </p>
                      <div className="space-y-2 max-h-[200px] overflow-y-auto">
                        {result.failedTests.map((test, i) => (
                          <div key={i} className="p-2 bg-red-50 rounded border border-red-100">
                            <p className="text-sm font-medium text-red-800">{test.name}</p>
                            <p className="text-xs text-red-600 font-mono truncate">{test.error}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end gap-2">
                    <Button variant="secondary" onClick={() => onRerun(result.id)}>
                      Rerun
                    </Button>
                    <Button onClick={() => onViewDetails(result.id)}>View Details</Button>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

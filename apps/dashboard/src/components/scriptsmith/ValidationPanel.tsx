/**
 * ValidationPanel Component
 * Displays errors, warnings, and info messages from script validation
 */

import { useState } from 'react';
import { Card } from '../ui';

interface ValidationIssue {
  id: string;
  type: 'error' | 'warning' | 'info';
  message: string;
  line?: number;
  column?: number;
  rule?: string;
  suggestion?: string;
}

interface ValidationPanelProps {
  issues: ValidationIssue[];
  loading?: boolean;
  onIssueClick?: (issue: ValidationIssue) => void;
  onAutoFix?: (issueId: string) => void;
  showCounts?: boolean;
}

const ISSUE_STYLES = {
  error: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    icon: 'text-red-500',
    text: 'text-red-700',
    badge: 'bg-red-100 text-red-700',
  },
  warning: {
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    icon: 'text-yellow-500',
    text: 'text-yellow-700',
    badge: 'bg-yellow-100 text-yellow-700',
  },
  info: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    icon: 'text-blue-500',
    text: 'text-blue-700',
    badge: 'bg-blue-100 text-blue-700',
  },
};

const ISSUE_ICONS = {
  error: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  warning: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  info: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

export function ValidationPanel({
  issues,
  loading = false,
  onIssueClick,
  onAutoFix,
  showCounts = true,
}: ValidationPanelProps) {
  const [filter, setFilter] = useState<'all' | 'error' | 'warning' | 'info'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const errorCount = issues.filter((i) => i.type === 'error').length;
  const warningCount = issues.filter((i) => i.type === 'warning').length;
  const infoCount = issues.filter((i) => i.type === 'info').length;

  const filteredIssues = filter === 'all'
    ? issues
    : issues.filter((i) => i.type === filter);

  if (loading) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-2 text-gray-500">
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-sm">Validating script...</span>
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 bg-gray-50 border-b border-gray-200">
        <h3 className="text-sm font-medium text-gray-700">Validation Results</h3>

        {showCounts && (
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 text-xs rounded-full ${ISSUE_STYLES.error.badge}`}>
              {errorCount} errors
            </span>
            <span className={`px-2 py-0.5 text-xs rounded-full ${ISSUE_STYLES.warning.badge}`}>
              {warningCount} warnings
            </span>
            <span className={`px-2 py-0.5 text-xs rounded-full ${ISSUE_STYLES.info.badge}`}>
              {infoCount} info
            </span>
          </div>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 p-2 bg-gray-50 border-b border-gray-200">
        {(['all', 'error', 'warning', 'info'] as const).map((type) => {
          const count = type === 'all' ? issues.length : issues.filter((i) => i.type === type).length;
          return (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`px-3 py-1 text-xs rounded transition-colors ${
                filter === type
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)} ({count})
            </button>
          );
        })}
      </div>

      {/* Issues List */}
      <div className="max-h-[400px] overflow-y-auto">
        {filteredIssues.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <svg className="w-12 h-12 mx-auto mb-3 text-green-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="font-medium text-green-600">No issues found</p>
            <p className="text-sm mt-1">Your script looks good!</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredIssues.map((issue) => {
              const styles = ISSUE_STYLES[issue.type];
              const isExpanded = expandedId === issue.id;

              return (
                <div
                  key={issue.id}
                  className={`p-3 transition-colors ${styles.bg} ${
                    onIssueClick ? 'cursor-pointer hover:opacity-90' : ''
                  }`}
                  onClick={() => {
                    onIssueClick?.(issue);
                    setExpandedId(isExpanded ? null : issue.id);
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 ${styles.icon}`}>
                      {ISSUE_ICONS[issue.type]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${styles.text}`}>{issue.message}</p>
                      <div className="flex items-center gap-3 mt-1">
                        {issue.line && (
                          <span className="text-xs text-gray-500">
                            Line {issue.line}{issue.column ? `:${issue.column}` : ''}
                          </span>
                        )}
                        {issue.rule && (
                          <span className="text-xs text-gray-400 font-mono">{issue.rule}</span>
                        )}
                      </div>

                      {/* Expanded Details */}
                      {isExpanded && issue.suggestion && (
                        <div className="mt-2 p-2 bg-white rounded border border-gray-200">
                          <p className="text-xs text-gray-600">
                            <strong>Suggestion:</strong> {issue.suggestion}
                          </p>
                          {onAutoFix && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onAutoFix(issue.id);
                              }}
                              className="mt-2 px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                            >
                              Apply Fix
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    <svg
                      className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}

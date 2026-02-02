/**
 * PatternDetailModal Component
 * Suggestion list with reasoning, risk assessment, approve/reject per suggestion
 */

import { useState } from 'react';
import { Button, StatusBadge } from '../ui';

interface Suggestion {
  id: string;
  type: 'locator' | 'timing' | 'assertion' | 'wait_strategy';
  description: string;
  reasoning: string;
  oldValue: string;
  newValue: string;
  confidence: number;
  riskLevel: 'low' | 'medium' | 'high';
  status: 'pending' | 'approved' | 'rejected';
}

interface PatternDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  testName: string;
  testCaseId: string;
  errorMessage: string;
  suggestions: Suggestion[];
  onApproveSuggestion: (suggestionId: string) => void;
  onRejectSuggestion: (suggestionId: string) => void;
  onApproveAll: () => void;
}

const riskColors = {
  low: 'bg-green-100 text-green-700 border-green-200',
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  high: 'bg-red-100 text-red-700 border-red-200',
};

const typeIcons = {
  locator: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  ),
  timing: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  assertion: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  wait_strategy: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  ),
};

export function PatternDetailModal({
  isOpen,
  onClose,
  testName,
  testCaseId,
  errorMessage,
  suggestions,
  onApproveSuggestion,
  onRejectSuggestion,
  onApproveAll,
}: PatternDetailModalProps) {
  const [expandedSuggestion, setExpandedSuggestion] = useState<string | null>(null);

  if (!isOpen) return null;

  const pendingSuggestions = suggestions.filter((s) => s.status === 'pending');
  const avgConfidence =
    suggestions.length > 0
      ? suggestions.reduce((sum, s) => sum + s.confidence, 0) / suggestions.length
      : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Self-Healing Analysis</h2>
              <p className="text-sm text-gray-500 mt-1 truncate max-w-md">{testName}</p>
              <p className="text-xs font-mono text-gray-400">{testCaseId}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Error Context */}
        <div className="p-4 bg-red-50 border-b border-red-100">
          <p className="text-xs text-red-600 font-medium mb-1">Original Error</p>
          <pre className="text-sm text-red-800 font-mono whitespace-pre-wrap">{errorMessage}</pre>
        </div>

        {/* Stats Bar */}
        <div className="flex items-center gap-6 p-4 bg-gray-50 border-b border-gray-200">
          <div>
            <p className="text-2xl font-bold text-gray-900">{suggestions.length}</p>
            <p className="text-xs text-gray-500">Suggestions</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-amber-600">{pendingSuggestions.length}</p>
            <p className="text-xs text-gray-500">Pending</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-indigo-600">{Math.round(avgConfidence * 100)}%</p>
            <p className="text-xs text-gray-500">Avg Confidence</p>
          </div>
          <div className="ml-auto">
            {pendingSuggestions.length > 0 && (
              <Button onClick={onApproveAll} className="bg-green-600 hover:bg-green-700">
                Approve All ({pendingSuggestions.length})
              </Button>
            )}
          </div>
        </div>

        {/* Suggestions List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {suggestions.map((suggestion) => (
            <div
              key={suggestion.id}
              className={`border rounded-lg overflow-hidden transition-all ${
                suggestion.status === 'approved'
                  ? 'border-green-200 bg-green-50'
                  : suggestion.status === 'rejected'
                  ? 'border-red-200 bg-red-50 opacity-60'
                  : 'border-gray-200'
              }`}
            >
              {/* Suggestion Header */}
              <div
                className="p-4 cursor-pointer hover:bg-gray-50"
                onClick={() =>
                  setExpandedSuggestion(expandedSuggestion === suggestion.id ? null : suggestion.id)
                }
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-gray-400">{typeIcons[suggestion.type]}</span>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{suggestion.description}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`px-2 py-0.5 text-xs rounded border ${riskColors[suggestion.riskLevel]}`}>
                          {suggestion.riskLevel} risk
                        </span>
                        <span className="text-xs text-gray-500">
                          {Math.round(suggestion.confidence * 100)}% confidence
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <StatusBadge status={suggestion.status} />
                    <svg
                      className={`w-5 h-5 text-gray-400 transition-transform ${
                        expandedSuggestion === suggestion.id ? 'rotate-180' : ''
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
              {expandedSuggestion === suggestion.id && (
                <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
                  {/* Reasoning */}
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <p className="text-xs text-blue-600 font-medium mb-1">Reasoning</p>
                    <p className="text-sm text-blue-800">{suggestion.reasoning}</p>
                  </div>

                  {/* Code Diff */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-red-50 rounded-lg">
                      <p className="text-xs text-red-600 font-medium mb-1">Before</p>
                      <pre className="text-xs font-mono text-red-800 overflow-x-auto">
                        {suggestion.oldValue}
                      </pre>
                    </div>
                    <div className="p-3 bg-green-50 rounded-lg">
                      <p className="text-xs text-green-600 font-medium mb-1">After</p>
                      <pre className="text-xs font-mono text-green-800 overflow-x-auto">
                        {suggestion.newValue}
                      </pre>
                    </div>
                  </div>

                  {/* Actions */}
                  {suggestion.status === 'pending' && (
                    <div className="flex justify-end gap-2 pt-2">
                      <Button
                        variant="secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRejectSuggestion(suggestion.id);
                        }}
                        className="text-red-600 border-red-200 hover:bg-red-50"
                      >
                        Reject
                      </Button>
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          onApproveSuggestion(suggestion.id);
                        }}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        Approve
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * ExecutionOutputModal Component
 * Display execution output with ANSI cleaning, screenshots, and stats
 */

import { useState } from 'react';
import { Button, StatusBadge } from '../ui';
import type { ExecutionStatus } from '../../hooks/useExecutionPolling';

interface ExecutionOutputModalProps {
  execution: ExecutionStatus;
  isOpen: boolean;
  onClose: () => void;
}

type Tab = 'output' | 'screenshots' | 'details';

// Parse ANSI for colored display
function parseAnsiLine(line: string): { text: string; className: string }[] {
  const parts: { text: string; className: string }[] = [];
  // eslint-disable-next-line no-control-regex
  const ansiRegex = /\x1b\[([0-9;]*)m/g;
  let lastIndex = 0;
  let currentClass = '';
  let match;

  while ((match = ansiRegex.exec(line)) !== null) {
    // Add text before this ANSI code
    if (match.index > lastIndex) {
      parts.push({
        text: line.slice(lastIndex, match.index),
        className: currentClass,
      });
    }

    // Parse ANSI code
    const code = match[1];
    if (code === '0' || code === '') {
      currentClass = '';
    } else if (code === '31' || code === '91') {
      currentClass = 'text-red-500';
    } else if (code === '32' || code === '92') {
      currentClass = 'text-green-500';
    } else if (code === '33' || code === '93') {
      currentClass = 'text-yellow-500';
    } else if (code === '34' || code === '94') {
      currentClass = 'text-blue-500';
    } else if (code === '35' || code === '95') {
      currentClass = 'text-purple-500';
    } else if (code === '36' || code === '96') {
      currentClass = 'text-cyan-500';
    } else if (code === '1') {
      currentClass = `${currentClass} font-bold`.trim();
    } else if (code === '2') {
      currentClass = `${currentClass} opacity-70`.trim();
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < line.length) {
    parts.push({
      text: line.slice(lastIndex),
      className: currentClass,
    });
  }

  return parts.length > 0 ? parts : [{ text: line, className: '' }];
}

export function ExecutionOutputModal({
  execution,
  isOpen,
  onClose,
}: ExecutionOutputModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>('output');
  const [selectedScreenshot, setSelectedScreenshot] = useState<string | null>(null);
  const [showRawAnsi, setShowRawAnsi] = useState(false);

  if (!isOpen) return null;

  const output = execution.output || [];
  const screenshots = execution.screenshots || [];
  const summary = execution.summary;

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    const mins = Math.floor(ms / 60000);
    const secs = ((ms % 60000) / 1000).toFixed(0);
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-gray-900">
              Execution Output
            </h2>
            <StatusBadge status={execution.status} />
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

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          {(['output', 'screenshots', 'details'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-gray-900 text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab === 'output' && `Output (${output.length} lines)`}
              {tab === 'screenshots' && `Screenshots (${screenshots.length})`}
              {tab === 'details' && 'Details'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {/* Output Tab */}
          {activeTab === 'output' && (
            <div className="h-full flex flex-col">
              <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
                <span className="text-xs text-gray-500">Console output</span>
                <label className="flex items-center gap-2 text-xs text-gray-500">
                  <input
                    type="checkbox"
                    checked={showRawAnsi}
                    onChange={(e) => setShowRawAnsi(e.target.checked)}
                    className="rounded"
                  />
                  Show raw ANSI
                </label>
              </div>
              <div className="flex-1 overflow-auto p-4 bg-gray-900">
                <pre className="text-sm font-mono">
                  {output.length === 0 ? (
                    <span className="text-gray-500">No output available</span>
                  ) : (
                    output.map((line, i) => (
                      <div key={i} className="leading-relaxed">
                        <span className="select-none text-gray-600 mr-3 inline-block w-8 text-right">
                          {i + 1}
                        </span>
                        {showRawAnsi ? (
                          <span className="text-gray-300">{line}</span>
                        ) : (
                          parseAnsiLine(line).map((part, j) => (
                            <span key={j} className={part.className || 'text-gray-300'}>
                              {part.text}
                            </span>
                          ))
                        )}
                      </div>
                    ))
                  )}
                </pre>
              </div>
            </div>
          )}

          {/* Screenshots Tab */}
          {activeTab === 'screenshots' && (
            <div className="h-full overflow-auto p-4">
              {screenshots.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p>No screenshots captured</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-4">
                    {screenshots.map((screenshot, i) => (
                      <button
                        key={i}
                        onClick={() => setSelectedScreenshot(screenshot.path)}
                        className="group relative aspect-video bg-gray-100 rounded-lg overflow-hidden border border-gray-200 hover:border-gray-400 transition-colors"
                      >
                        <img
                          src={screenshot.path}
                          alt={screenshot.name}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                          <span className="opacity-0 group-hover:opacity-100 text-white bg-black/50 px-2 py-1 rounded text-xs">
                            View
                          </span>
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-2 py-1">
                          <p className="text-xs text-white truncate">{screenshot.name}</p>
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Screenshot Lightbox */}
                  {selectedScreenshot && (
                    <div
                      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-8"
                      onClick={() => setSelectedScreenshot(null)}
                    >
                      <img
                        src={selectedScreenshot}
                        alt="Screenshot"
                        className="max-w-full max-h-full object-contain"
                      />
                      <button
                        onClick={() => setSelectedScreenshot(null)}
                        className="absolute top-4 right-4 p-2 text-white/70 hover:text-white"
                      >
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Details Tab */}
          {activeTab === 'details' && (
            <div className="h-full overflow-auto p-4">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500 mb-1">Execution ID</p>
                    <p className="font-mono text-sm text-gray-900">{execution.id}</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500 mb-1">Status</p>
                    <StatusBadge status={execution.status} />
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500 mb-1">Started At</p>
                    <p className="text-sm text-gray-900">
                      {execution.startedAt
                        ? new Date(execution.startedAt).toLocaleString()
                        : '-'}
                    </p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500 mb-1">Completed At</p>
                    <p className="text-sm text-gray-900">
                      {execution.completedAt
                        ? new Date(execution.completedAt).toLocaleString()
                        : '-'}
                    </p>
                  </div>
                </div>

                {execution.progress && (
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500 mb-2">Progress</p>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gray-900 transition-all"
                          style={{
                            width: `${(execution.progress.current / execution.progress.total) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="text-sm text-gray-600">
                        {execution.progress.current} / {execution.progress.total}
                      </span>
                    </div>
                    {execution.progress.currentTest && (
                      <p className="text-xs text-gray-500 mt-2">
                        Running: {execution.progress.currentTest}
                      </p>
                    )}
                  </div>
                )}

                {execution.error && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-xs text-red-600 font-medium mb-1">Error</p>
                    <pre className="text-sm text-red-700 whitespace-pre-wrap">
                      {execution.error}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {summary && (
          <div className="flex items-center justify-between p-4 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-900">{summary.total}</span>
                <span className="text-xs text-gray-500">Total</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-green-600">{summary.passed}</span>
                <span className="text-xs text-gray-500">Passed</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-red-600">{summary.failed}</span>
                <span className="text-xs text-gray-500">Failed</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-500">{summary.skipped}</span>
                <span className="text-xs text-gray-500">Skipped</span>
              </div>
              {summary.duration !== undefined && (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">
                    {formatDuration(summary.duration)}
                  </span>
                  <span className="text-xs text-gray-500">Duration</span>
                </div>
              )}
            </div>
            <Button onClick={onClose} variant="secondary">
              Close
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

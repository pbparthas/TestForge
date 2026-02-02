/**
 * FlakyTestDetails Component
 * Detailed view of a flaky test with failure history
 */

import { Card, Button } from '../ui';

interface FailureInstance {
  id: string;
  runId: string;
  timestamp: string;
  errorMessage: string;
  stackTrace?: string;
  screenshot?: string;
  duration: number;
  environment: string;
}

interface FlakyTestDetailsProps {
  testName: string;
  suiteName: string;
  flakinessScore: number;
  totalRuns: number;
  failureCount: number;
  passCount: number;
  failures: FailureInstance[];
  onClose?: () => void;
  onViewRun?: (runId: string) => void;
}

export function FlakyTestDetails({
  testName,
  suiteName,
  flakinessScore,
  totalRuns,
  failureCount,
  passCount,
  failures,
  onClose,
  onViewRun,
}: FlakyTestDetailsProps) {
  const passRate = totalRuns > 0 ? ((passCount / totalRuns) * 100).toFixed(1) : '0';

  const getScoreColor = (score: number) => {
    if (score >= 50) return 'text-red-600';
    if (score >= 25) return 'text-orange-600';
    if (score >= 10) return 'text-yellow-600';
    return 'text-green-600';
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{testName}</h2>
            <p className="text-sm text-gray-500">{suiteName}</p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mt-4">
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <p className={`text-2xl font-bold ${getScoreColor(flakinessScore)}`}>
              {flakinessScore}%
            </p>
            <p className="text-xs text-gray-500">Flakiness Score</p>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <p className="text-2xl font-bold text-gray-900">{totalRuns}</p>
            <p className="text-xs text-gray-500">Total Runs</p>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <p className="text-2xl font-bold text-red-600">{failureCount}</p>
            <p className="text-xs text-gray-500">Failures</p>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <p className="text-2xl font-bold text-green-600">{passRate}%</p>
            <p className="text-xs text-gray-500">Pass Rate</p>
          </div>
        </div>

        {/* Pass/Fail Bar */}
        <div className="mt-4">
          <div className="h-3 bg-gray-200 rounded-full overflow-hidden flex">
            <div
              className="bg-green-500"
              style={{ width: `${(passCount / totalRuns) * 100}%` }}
              title={`${passCount} passed`}
            />
            <div
              className="bg-red-500"
              style={{ width: `${(failureCount / totalRuns) * 100}%` }}
              title={`${failureCount} failed`}
            />
          </div>
          <div className="flex justify-between mt-1 text-xs text-gray-500">
            <span>{passCount} passed</span>
            <span>{failureCount} failed</span>
          </div>
        </div>
      </Card>

      {/* Failure History */}
      <Card className="p-4">
        <h3 className="text-sm font-medium text-gray-700 mb-3">
          Recent Failures ({failures.length})
        </h3>

        {failures.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No failure instances recorded</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {failures.map((failure) => (
              <div
                key={failure.id}
                className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">
                      {new Date(failure.timestamp).toLocaleString()}
                    </span>
                    <span className="px-1.5 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                      {failure.environment}
                    </span>
                    <span className="text-xs text-gray-400">
                      {(failure.duration / 1000).toFixed(2)}s
                    </span>
                  </div>
                  {onViewRun && (
                    <Button
                      variant="secondary"
                      onClick={() => onViewRun(failure.runId)}
                      className="text-xs py-1 px-2"
                    >
                      View Run
                    </Button>
                  )}
                </div>

                {/* Error Message */}
                <div className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700 font-mono">
                  {failure.errorMessage}
                </div>

                {/* Stack Trace (collapsed) */}
                {failure.stackTrace && (
                  <details className="mt-2">
                    <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                      View stack trace
                    </summary>
                    <pre className="mt-1 p-2 bg-gray-900 text-gray-100 rounded text-xs overflow-x-auto max-h-[200px]">
                      {failure.stackTrace}
                    </pre>
                  </details>
                )}

                {/* Screenshot */}
                {failure.screenshot && (
                  <div className="mt-2">
                    <img
                      src={failure.screenshot}
                      alt="Failure screenshot"
                      className="max-w-full h-auto rounded border border-gray-200"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Pattern Analysis */}
      <Card className="p-4">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Failure Pattern Analysis</h3>
        <div className="space-y-3">
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start gap-2">
              <svg className="w-5 h-5 text-yellow-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-yellow-800">Timing Issue Detected</p>
                <p className="text-xs text-yellow-700 mt-1">
                  This test appears to fail due to timing-related issues. Consider adding explicit waits or using retry logic.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500">Most Common Error</p>
              <p className="text-sm font-medium text-gray-900 mt-1 truncate">
                Element not found
              </p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500">Fails Most On</p>
              <p className="text-sm font-medium text-gray-900 mt-1">
                CI Environment
              </p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

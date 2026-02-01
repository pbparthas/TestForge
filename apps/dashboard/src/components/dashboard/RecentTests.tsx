/**
 * RecentTests Component
 * Table showing recent test executions with results
 */

import { cn } from '../../utils/cn';
import { CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';

export type TestResult = 'passed' | 'failed' | 'running' | 'skipped';

export interface RecentTest {
  id: string;
  name: string;
  suite?: string;
  result: TestResult;
  duration?: number;
  timestamp: string;
}

interface RecentTestsProps {
  tests: RecentTest[];
  maxItems?: number;
  onTestClick?: (test: RecentTest) => void;
  className?: string;
}

const resultConfig: Record<
  TestResult,
  { icon: React.ReactNode; color: string; bgColor: string; label: string }
> = {
  passed: {
    icon: <CheckCircle className="w-4 h-4" />,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    label: 'Passed',
  },
  failed: {
    icon: <XCircle className="w-4 h-4" />,
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    label: 'Failed',
  },
  running: {
    icon: <Clock className="w-4 h-4 animate-pulse" />,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    label: 'Running',
  },
  skipped: {
    icon: <AlertTriangle className="w-4 h-4" />,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100',
    label: 'Skipped',
  },
};

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export function RecentTests({
  tests,
  maxItems = 5,
  onTestClick,
  className,
}: RecentTestsProps) {
  const displayedTests = tests.slice(0, maxItems);

  if (displayedTests.length === 0) {
    return (
      <div className={cn('text-center py-8 text-gray-500', className)}>
        <p className="font-medium">No recent tests</p>
        <p className="text-sm mt-1">Run tests to see results here</p>
      </div>
    );
  }

  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
              Test
            </th>
            <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
              Result
            </th>
            <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
              Duration
            </th>
            <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
              When
            </th>
          </tr>
        </thead>
        <tbody>
          {displayedTests.map((test) => {
            const config = resultConfig[test.result];

            return (
              <tr
                key={test.id}
                className={cn(
                  'border-b border-gray-100 hover:bg-gray-50 transition-colors',
                  onTestClick && 'cursor-pointer'
                )}
                onClick={() => onTestClick?.(test)}
              >
                <td className="py-3 px-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900 truncate max-w-xs">
                      {test.name}
                    </p>
                    {test.suite && (
                      <p className="text-xs text-gray-500">{test.suite}</p>
                    )}
                  </div>
                </td>
                <td className="py-3 px-3">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                      config.bgColor,
                      config.color
                    )}
                  >
                    {config.icon}
                    {config.label}
                  </span>
                </td>
                <td className="py-3 px-3 text-sm text-gray-500">
                  {test.duration ? formatDuration(test.duration) : '-'}
                </td>
                <td className="py-3 px-3 text-sm text-gray-500 text-right">
                  {formatTimeAgo(test.timestamp)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

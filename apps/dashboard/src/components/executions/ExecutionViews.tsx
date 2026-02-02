/**
 * ExecutionViews Component
 * Run Tests view and History view for executions
 */

import { useState } from 'react';
import { Card, Button, StatusBadge, Badge } from '../ui';
import { ExecutionConfigPanel, defaultExecutionConfig } from './ExecutionConfigPanel';
import { WebhookIntegration } from './WebhookIntegration';
import { ExecutionOutputModal } from './ExecutionOutputModal';
import { useExecutionPolling, type ExecutionStatus } from '../../hooks/useExecutionPolling';
import type { ExecutionConfig } from '../../config/devices';
import { api } from '../../services/api';

interface Environment {
  id: string;
  name: string;
  baseUrl: string;
}

interface TestSuite {
  id: string;
  name: string;
  testCount: number;
}

interface Execution {
  id: string;
  status: string;
  triggerType: string;
  startedAt?: string;
  completedAt?: string;
  summary?: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    duration?: number;
  };
  environment?: { name: string };
  device?: string;
  browser?: string;
}

interface RunTestsViewProps {
  projectId: string;
  environments: Environment[];
  testSuites: TestSuite[];
  onExecutionStart: (executionId: string) => void;
}

export function RunTestsView({
  projectId,
  environments,
  testSuites,
  onExecutionStart,
}: RunTestsViewProps) {
  const [config, setConfig] = useState<ExecutionConfig>(defaultExecutionConfig);
  const [selectedSuiteId, setSelectedSuiteId] = useState<string | null>(null);
  const [isTriggering, setIsTriggering] = useState(false);

  const { execution, isPolling, startPolling, reset } = useExecutionPolling({
    onComplete: (exec) => {
      // Could show toast notification here
      console.log('Execution complete:', exec.status);
    },
  });

  const handleTrigger = async () => {
    setIsTriggering(true);
    try {
      const response = await api.post<{ data: { id: string } }>('/executions/trigger', {
        projectId,
        suiteId: selectedSuiteId,
        config: {
          device: config.deviceId,
          browser: config.browserId,
          headless: config.headless,
          environmentId: config.environmentId,
          parallel: config.parallel,
          timeout: config.timeout,
          retries: config.retries,
          customViewport: config.customViewport,
          webhookUrl: config.webhookUrl,
        },
      });
      const executionId = response.data.data?.id || (response.data as unknown as { id: string }).id;
      startPolling(executionId);
      onExecutionStart(executionId);
    } catch (error) {
      console.error('Failed to trigger execution:', error);
    } finally {
      setIsTriggering(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left Column - Config */}
      <div className="lg:col-span-2 space-y-6">
        <ExecutionConfigPanel
          config={config}
          onChange={setConfig}
          environments={environments}
          onTrigger={handleTrigger}
          isLoading={isTriggering || isPolling}
          disabled={isPolling}
        />

        <WebhookIntegration
          webhookUrl={config.webhookUrl || ''}
          onChange={(url) => setConfig({ ...config, webhookUrl: url })}
          disabled={isPolling}
        />
      </div>

      {/* Right Column - Suite Selection & Status */}
      <div className="space-y-6">
        {/* Test Suite Selection */}
        <Card className="p-4">
          <h4 className="text-sm font-medium text-gray-900 mb-3">Test Suite</h4>
          <div className="space-y-2">
            <button
              onClick={() => setSelectedSuiteId(null)}
              className={`w-full p-3 text-left rounded-lg border transition-all ${
                selectedSuiteId === null
                  ? 'border-gray-900 bg-gray-50 ring-1 ring-gray-900'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <p className="text-sm font-medium text-gray-900">All Tests</p>
              <p className="text-xs text-gray-500">Run all test cases in the project</p>
            </button>

            {testSuites.map((suite) => (
              <button
                key={suite.id}
                onClick={() => setSelectedSuiteId(suite.id)}
                className={`w-full p-3 text-left rounded-lg border transition-all ${
                  selectedSuiteId === suite.id
                    ? 'border-gray-900 bg-gray-50 ring-1 ring-gray-900'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-900">{suite.name}</p>
                  <Badge variant="default">{suite.testCount} tests</Badge>
                </div>
              </button>
            ))}

            {testSuites.length === 0 && (
              <p className="text-xs text-gray-500 text-center py-4">
                No test suites found. Create a suite to run specific tests.
              </p>
            )}
          </div>
        </Card>

        {/* Execution Status */}
        {execution && (
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-gray-900">Current Execution</h4>
              <StatusBadge status={execution.status} />
            </div>

            {execution.progress && (
              <div className="mb-4">
                <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                  <span>Progress</span>
                  <span>{execution.progress.current} / {execution.progress.total}</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gray-900 transition-all duration-300"
                    style={{
                      width: `${(execution.progress.current / execution.progress.total) * 100}%`,
                    }}
                  />
                </div>
                {execution.progress.currentTest && (
                  <p className="text-xs text-gray-500 mt-2 truncate">
                    Running: {execution.progress.currentTest}
                  </p>
                )}
              </div>
            )}

            {execution.summary && (
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="p-2 bg-gray-50 rounded">
                  <p className="text-lg font-semibold text-gray-900">{execution.summary.total}</p>
                  <p className="text-xs text-gray-500">Total</p>
                </div>
                <div className="p-2 bg-green-50 rounded">
                  <p className="text-lg font-semibold text-green-600">{execution.summary.passed}</p>
                  <p className="text-xs text-gray-500">Passed</p>
                </div>
                <div className="p-2 bg-red-50 rounded">
                  <p className="text-lg font-semibold text-red-600">{execution.summary.failed}</p>
                  <p className="text-xs text-gray-500">Failed</p>
                </div>
                <div className="p-2 bg-gray-50 rounded">
                  <p className="text-lg font-semibold text-gray-500">{execution.summary.skipped}</p>
                  <p className="text-xs text-gray-500">Skipped</p>
                </div>
              </div>
            )}

            {!isPolling && (
              <Button onClick={reset} variant="secondary" className="w-full mt-4">
                Clear
              </Button>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// History View
// ============================================================================

interface HistoryFilters {
  status: string;
  dateRange: 'today' | 'week' | 'month' | 'all';
  search: string;
}

interface HistoryViewProps {
  projectId: string;
  executions: Execution[];
  loading: boolean;
  onRefresh: () => void;
}

export function HistoryView({
  projectId: _projectId,
  executions,
  loading,
  onRefresh,
}: HistoryViewProps) {
  const [filters, setFilters] = useState<HistoryFilters>({
    status: 'all',
    dateRange: 'week',
    search: '',
  });
  const [selectedExecution, setSelectedExecution] = useState<ExecutionStatus | null>(null);
  const [showOutputModal, setShowOutputModal] = useState(false);

  const filteredExecutions = executions.filter((exec) => {
    // Status filter
    if (filters.status !== 'all' && exec.status !== filters.status) {
      return false;
    }

    // Date range filter
    if (filters.dateRange !== 'all' && exec.startedAt) {
      const execDate = new Date(exec.startedAt);
      const now = new Date();
      const diffDays = Math.floor((now.getTime() - execDate.getTime()) / (1000 * 60 * 60 * 24));

      if (filters.dateRange === 'today' && diffDays > 0) return false;
      if (filters.dateRange === 'week' && diffDays > 7) return false;
      if (filters.dateRange === 'month' && diffDays > 30) return false;
    }

    // Search filter
    if (filters.search) {
      const search = filters.search.toLowerCase();
      return (
        exec.id.toLowerCase().includes(search) ||
        exec.triggerType?.toLowerCase().includes(search)
      );
    }

    return true;
  });

  const handleViewOutput = async (exec: Execution) => {
    // Fetch full execution details including output
    try {
      const response = await api.get<{ data: ExecutionStatus }>(`/executions/${exec.id}`);
      setSelectedExecution(response.data.data || response.data as unknown as ExecutionStatus);
      setShowOutputModal(true);
    } catch (error) {
      console.error('Failed to fetch execution details:', error);
    }
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    const mins = Math.floor(ms / 60000);
    const secs = ((ms % 60000) / 1000).toFixed(0);
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Status Filter */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            >
              <option value="all">All Statuses</option>
              <option value="passed">Passed</option>
              <option value="failed">Failed</option>
              <option value="running">Running</option>
              <option value="pending">Pending</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {/* Date Range Filter */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Date Range</label>
            <select
              value={filters.dateRange}
              onChange={(e) => setFilters({ ...filters, dateRange: e.target.value as HistoryFilters['dateRange'] })}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            >
              <option value="today">Today</option>
              <option value="week">Last 7 days</option>
              <option value="month">Last 30 days</option>
              <option value="all">All time</option>
            </select>
          </div>

          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs text-gray-500 mb-1">Search</label>
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              placeholder="Search by ID or trigger type..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>

          {/* Refresh Button */}
          <div className="self-end">
            <Button onClick={onRefresh} variant="secondary" disabled={loading}>
              {loading ? 'Loading...' : 'Refresh'}
            </Button>
          </div>
        </div>
      </Card>

      {/* Executions Table */}
      <Card>
        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading executions...</div>
        ) : filteredExecutions.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p>No executions found</p>
            <p className="text-xs mt-1">Try adjusting your filters</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">ID</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Status</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Trigger</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Results</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Environment</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Started</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Duration</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredExecutions.map((exec) => (
                  <tr key={exec.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <span className="font-mono text-sm text-gray-600">{exec.id.slice(0, 8)}</span>
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={exec.status} />
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600 capitalize">
                      {exec.triggerType}
                    </td>
                    <td className="py-3 px-4">
                      {exec.summary ? (
                        <div className="flex gap-2 text-xs">
                          <span className="text-green-600">{exec.summary.passed} ✓</span>
                          <span className="text-red-600">{exec.summary.failed} ✗</span>
                          <span className="text-gray-500">{exec.summary.skipped} ⊘</span>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {exec.environment?.name || '-'}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-500">
                      {exec.startedAt ? new Date(exec.startedAt).toLocaleString() : '-'}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-500">
                      {formatDuration(exec.summary?.duration)}
                    </td>
                    <td className="py-3 px-4">
                      <Button
                        onClick={() => handleViewOutput(exec)}
                        variant="secondary"
                        className="text-xs py-1 px-2"
                      >
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Output Modal */}
      {selectedExecution && (
        <ExecutionOutputModal
          execution={selectedExecution}
          isOpen={showOutputModal}
          onClose={() => {
            setShowOutputModal(false);
            setSelectedExecution(null);
          }}
        />
      )}
    </div>
  );
}

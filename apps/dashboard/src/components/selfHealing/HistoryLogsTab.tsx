/**
 * HistoryLogsTab Component
 * Log table with cost tracking, action type filter, date range filter
 */

import { useState } from 'react';
import { Card, StatusBadge } from '../ui';

interface HealingLog {
  id: string;
  testCaseId: string;
  testName: string;
  actionType: 'locator_fix' | 'timing_fix' | 'assertion_fix' | 'auto_retry' | 'element_wait';
  status: 'pending' | 'approved' | 'rejected' | 'auto_applied';
  confidence: number;
  oldValue: string;
  newValue: string;
  costUsd: number;
  createdAt: string;
  appliedAt?: string;
  appliedBy?: string;
}

interface HistoryLogsTabProps {
  logs: HealingLog[];
  loading?: boolean;
  onViewDetails: (log: HealingLog) => void;
  onApprove: (logId: string) => void;
  onReject: (logId: string) => void;
}

const actionTypeLabels: Record<HealingLog['actionType'], string> = {
  locator_fix: 'Locator Fix',
  timing_fix: 'Timing Fix',
  assertion_fix: 'Assertion Fix',
  auto_retry: 'Auto Retry',
  element_wait: 'Element Wait',
};

const actionTypeColors: Record<HealingLog['actionType'], string> = {
  locator_fix: 'bg-orange-100 text-orange-700',
  timing_fix: 'bg-blue-100 text-blue-700',
  assertion_fix: 'bg-red-100 text-red-700',
  auto_retry: 'bg-purple-100 text-purple-700',
  element_wait: 'bg-cyan-100 text-cyan-700',
};

export function HistoryLogsTab({
  logs,
  loading = false,
  onViewDetails,
  onApprove,
  onReject,
}: HistoryLogsTabProps) {
  const [actionFilter, setActionFilter] = useState<HealingLog['actionType'] | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<HealingLog['status'] | 'all'>('all');
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'all'>('week');

  const filteredLogs = logs.filter((log) => {
    if (actionFilter !== 'all' && log.actionType !== actionFilter) return false;
    if (statusFilter !== 'all' && log.status !== statusFilter) return false;

    if (dateRange !== 'all') {
      const logDate = new Date(log.createdAt);
      const now = new Date();
      const diffDays = Math.floor((now.getTime() - logDate.getTime()) / (1000 * 60 * 60 * 24));
      if (dateRange === 'today' && diffDays > 0) return false;
      if (dateRange === 'week' && diffDays > 7) return false;
      if (dateRange === 'month' && diffDays > 30) return false;
    }

    return true;
  });

  const totalCost = filteredLogs.reduce((sum, log) => sum + log.costUsd, 0);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Action Type</label>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value as HealingLog['actionType'] | 'all')}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="all">All Actions</option>
              <option value="locator_fix">Locator Fix</option>
              <option value="timing_fix">Timing Fix</option>
              <option value="assertion_fix">Assertion Fix</option>
              <option value="auto_retry">Auto Retry</option>
              <option value="element_wait">Element Wait</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as HealingLog['status'] | 'all')}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="auto_applied">Auto Applied</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Date Range</label>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as typeof dateRange)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="today">Today</option>
              <option value="week">Last 7 days</option>
              <option value="month">Last 30 days</option>
              <option value="all">All time</option>
            </select>
          </div>

          <div className="ml-auto text-right">
            <p className="text-xs text-gray-500">Total AI Cost</p>
            <p className="text-lg font-semibold text-gray-900">${totalCost.toFixed(4)}</p>
          </div>
        </div>
      </Card>

      {/* Logs Table */}
      <Card>
        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading logs...</div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p>No healing logs found</p>
            <p className="text-sm mt-1">Try adjusting your filters</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Test Case</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Action</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Status</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Confidence</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Cost</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Date</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <p className="text-sm font-medium text-gray-900 truncate max-w-[200px]">
                        {log.testName}
                      </p>
                      <p className="text-xs text-gray-500 font-mono">{log.testCaseId.slice(0, 8)}</p>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 text-xs rounded-full ${actionTypeColors[log.actionType]}`}>
                        {actionTypeLabels[log.actionType]}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={log.status} />
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              log.confidence >= 0.9
                                ? 'bg-green-500'
                                : log.confidence >= 0.7
                                ? 'bg-yellow-500'
                                : 'bg-red-500'
                            }`}
                            style={{ width: `${log.confidence * 100}%` }}
                          />
                        </div>
                        <span className="text-sm text-gray-600">
                          {Math.round(log.confidence * 100)}%
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      ${log.costUsd.toFixed(4)}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-500">
                      {new Date(log.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => onViewDetails(log)}
                          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                          title="View Details"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                        {log.status === 'pending' && (
                          <>
                            <button
                              onClick={() => onApprove(log.id)}
                              className="p-1.5 text-green-500 hover:text-green-700 hover:bg-green-50 rounded"
                              title="Approve"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </button>
                            <button
                              onClick={() => onReject(log.id)}
                              className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                              title="Reject"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

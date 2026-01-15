/**
 * Executions Page
 */

import { useEffect, useState } from 'react';
import { useProjectStore } from '../stores/project';
import { api } from '../services/api';
import { Card, Button, StatusBadge } from '../components/ui';
import type { Execution } from '../types';

export function ExecutionsPage() {
  const { currentProject } = useProjectStore();
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);

  useEffect(() => {
    if (currentProject) {
      loadExecutions();
    }
  }, [currentProject]);

  const loadExecutions = async () => {
    if (!currentProject) return;
    setLoading(true);
    try {
      const response = await api.getExecutions(1, 20, currentProject.id);
      setExecutions(response.data.items || response.data);
    } catch (err) {
      console.error('Failed to load executions', err);
    } finally {
      setLoading(false);
    }
  };

  const triggerExecution = async () => {
    if (!currentProject) return;
    setTriggering(true);
    try {
      await api.triggerExecution(currentProject.id);
      await loadExecutions();
    } catch (err) {
      console.error('Failed to trigger execution', err);
    } finally {
      setTriggering(false);
    }
  };

  if (!currentProject) {
    return (
      <Card>
        <p className="text-gray-500 text-center py-8">Please select a project from the dashboard</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Executions</h1>
        <Button onClick={triggerExecution} isLoading={triggering}>
          Trigger Execution
        </Button>
      </div>

      <Card>
        {loading ? (
          <p className="text-center py-8 text-gray-500">Loading...</p>
        ) : executions.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">No executions yet</p>
            <Button className="mt-4" onClick={triggerExecution} isLoading={triggering}>
              Run First Execution
            </Button>
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
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Started</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Duration</th>
                </tr>
              </thead>
              <tbody>
                {executions.map((exec) => (
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
                          <span className="text-green-600">{exec.summary.passed} passed</span>
                          <span className="text-red-600">{exec.summary.failed} failed</span>
                          <span className="text-gray-500">{exec.summary.skipped} skipped</span>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-500">
                      {exec.startedAt ? new Date(exec.startedAt).toLocaleString() : '-'}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-500">
                      {exec.summary?.duration ? `${(exec.summary.duration / 1000).toFixed(1)}s` : '-'}
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

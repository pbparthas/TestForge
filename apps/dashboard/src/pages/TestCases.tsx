/**
 * Test Cases Page
 */

import { useEffect, useState } from 'react';
import { useProjectStore } from '../stores/project';
import { api } from '../services/api';
import { Card, Button, StatusBadge, PriorityBadge } from '../components/ui';
import type { TestCase } from '../types';

export function TestCasesPage() {
  const { currentProject } = useProjectStore();
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (currentProject) {
      loadTestCases();
    }
  }, [currentProject, page]);

  const loadTestCases = async () => {
    if (!currentProject) return;
    setLoading(true);
    try {
      const response = await api.getTestCases(page, 10, currentProject.id);
      setTestCases(response.data.items || response.data);
      setTotal(response.data.total || 0);
    } catch (err) {
      console.error('Failed to load test cases', err);
    } finally {
      setLoading(false);
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
        <h1 className="text-2xl font-bold text-gray-900">Test Cases</h1>
        <Button onClick={() => window.location.href = '/ai'}>Generate with AI</Button>
      </div>

      <Card>
        {loading ? (
          <p className="text-center py-8 text-gray-500">Loading...</p>
        ) : testCases.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">No test cases yet</p>
            <Button className="mt-4" onClick={() => window.location.href = '/ai'}>
              Generate Test Cases
            </Button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Title</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Type</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Priority</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Status</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {testCases.map((tc) => (
                    <tr key={tc.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div className="font-medium text-gray-900">{tc.title}</div>
                        {tc.description && (
                          <div className="text-sm text-gray-500 truncate max-w-md">{tc.description}</div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-gray-600 capitalize">{tc.type}</span>
                      </td>
                      <td className="py-3 px-4">
                        <PriorityBadge priority={tc.priority} />
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={tc.status} />
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-500">
                        {new Date(tc.updatedAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {total > 10 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-500">
                  Showing {(page - 1) * 10 + 1} - {Math.min(page * 10, total)} of {total}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page === 1}
                    onClick={() => setPage(p => p - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page * 10 >= total}
                    onClick={() => setPage(p => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}

/**
 * Coverage Page
 */

import { useEffect, useState } from 'react';
import { useProjectStore } from '../stores/project';
import { api } from '../services/api';
import { Card, Badge } from '../components/ui';
import type { CoverageData } from '../types';

export function CoveragePage() {
  const { currentProject } = useProjectStore();
  const [coverage, setCoverage] = useState<CoverageData | null>(null);
  const [gaps, setGaps] = useState<{ id: string; title: string; priority: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentProject) {
      loadCoverage();
    }
  }, [currentProject]);

  const loadCoverage = async () => {
    if (!currentProject) return;
    setLoading(true);
    try {
      const [coverageRes, gapsRes] = await Promise.all([
        api.getCoverage(currentProject.id),
        api.getCoverageGaps(currentProject.id),
      ]);
      setCoverage(coverageRes.data);
      setGaps(gapsRes.data?.requirements || []);
    } catch (err) {
      console.error('Failed to load coverage', err);
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

  if (loading) {
    return (
      <Card>
        <p className="text-center py-8 text-gray-500">Loading coverage data...</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Requirement Coverage</h1>

      {/* Coverage Summary */}
      <div className="grid grid-cols-3 gap-6">
        <Card>
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-blue-50 mb-4">
              <span className="text-3xl font-bold text-blue-600">
                {coverage?.coveragePercentage || 0}%
              </span>
            </div>
            <p className="text-lg font-medium text-gray-900">Overall Coverage</p>
            <p className="text-sm text-gray-500">
              {coverage?.coveredRequirements || 0} of {coverage?.totalRequirements || 0} requirements covered
            </p>
          </div>
        </Card>

        <Card title="Coverage by Priority">
          {coverage?.byPriority ? (
            <div className="space-y-3">
              {Object.entries(coverage.byPriority).map(([priority, data]) => (
                <div key={priority} className="flex items-center justify-between">
                  <span className="text-sm capitalize text-gray-700">{priority}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${getPriorityColor(priority)}`}
                        style={{ width: `${(data.covered / data.total) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 w-12">
                      {data.covered}/{data.total}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No priority data</p>
          )}
        </Card>

        <Card title="Quick Stats">
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Total Requirements</span>
              <span className="font-medium text-gray-900">{coverage?.totalRequirements || 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Covered</span>
              <span className="font-medium text-green-600">{coverage?.coveredRequirements || 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Gaps</span>
              <span className="font-medium text-red-600">{gaps.length}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Coverage Gaps */}
      <Card title="Coverage Gaps" actions={gaps.length > 0 && <Badge variant="danger">{gaps.length} uncovered</Badge>}>
        {gaps.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-green-600 font-medium">All requirements are covered!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {gaps.map((req) => (
              <div key={req.id} className="p-3 border border-red-200 bg-red-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900">{req.title}</span>
                  <Badge variant={req.priority === 'critical' ? 'danger' : req.priority === 'high' ? 'warning' : 'default'}>
                    {req.priority}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function getPriorityColor(priority: string): string {
  const colors: Record<string, string> = {
    critical: 'bg-red-500',
    high: 'bg-orange-500',
    medium: 'bg-blue-500',
    low: 'bg-gray-400',
  };
  return colors[priority] || 'bg-gray-400';
}

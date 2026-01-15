/**
 * Dashboard Page
 */

import { useEffect, useState } from 'react';
import { useProjectStore } from '../stores/project';
import { api } from '../services/api';
import { Card, Badge } from '../components/ui';
import type { Project, CoverageData, ExecutionSummary } from '../types';

export function DashboardPage() {
  const { currentProject, setCurrentProject } = useProjectStore();
  const [projects, setProjects] = useState<Project[]>([]);
  const [stats, setStats] = useState<{ coverage?: CoverageData; executions?: ExecutionSummary; bugs?: { open: number; total: number } }>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    if (currentProject) {
      loadProjectStats(currentProject.id);
    }
  }, [currentProject]);

  const loadProjects = async () => {
    try {
      const response = await api.getProjects();
      setProjects(response.data.items || response.data);
      if (!currentProject && response.data.items?.length > 0) {
        setCurrentProject(response.data.items[0]);
      }
    } catch (err) {
      console.error('Failed to load projects', err);
    } finally {
      setLoading(false);
    }
  };

  const loadProjectStats = async (projectId: string) => {
    try {
      const [coverageRes, execRes, bugRes] = await Promise.all([
        api.getCoverage(projectId).catch(() => null),
        api.getExecutionStats(projectId).catch(() => null),
        api.getBugStats(projectId).catch(() => null),
      ]);

      setStats({
        coverage: coverageRes?.data,
        executions: execRes?.data,
        bugs: bugRes?.data,
      });
    } catch (err) {
      console.error('Failed to load stats', err);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        {projects.length > 1 && (
          <select
            value={currentProject?.id || ''}
            onChange={(e) => {
              const proj = projects.find(p => p.id === e.target.value);
              if (proj) setCurrentProject(proj);
            }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard
          title="Coverage"
          value={stats.coverage ? `${stats.coverage.coveragePercentage}%` : '-'}
          subtitle={stats.coverage ? `${stats.coverage.coveredRequirements}/${stats.coverage.totalRequirements} requirements` : 'No data'}
          color="blue"
        />
        <StatCard
          title="Pass Rate"
          value={stats.executions ? `${Math.round((stats.executions.passed / stats.executions.total) * 100)}%` : '-'}
          subtitle={stats.executions ? `${stats.executions.passed}/${stats.executions.total} tests` : 'No data'}
          color="green"
        />
        <StatCard
          title="Open Bugs"
          value={stats.bugs?.open?.toString() || '0'}
          subtitle={stats.bugs ? `${stats.bugs.total} total` : 'No data'}
          color="red"
        />
        <StatCard
          title="Test Cases"
          value="-"
          subtitle="View all"
          color="purple"
        />
      </div>

      {/* Quick Actions */}
      <Card title="Quick Actions">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <QuickAction title="Generate Tests" description="Use AI to create test cases" href="/ai" />
          <QuickAction title="Run Execution" description="Trigger a test run" href="/executions" />
          <QuickAction title="View Coverage" description="Check requirement coverage" href="/coverage" />
          <QuickAction title="File Bug" description="Create a new bug report" href="/bugs" />
        </div>
      </Card>

      {/* Projects List */}
      {!currentProject && (
        <Card title="Select a Project">
          <div className="space-y-2">
            {projects.map((p) => (
              <button
                key={p.id}
                onClick={() => setCurrentProject(p)}
                className="w-full text-left p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="font-medium text-gray-900">{p.name}</div>
                {p.description && <div className="text-sm text-gray-500 mt-1">{p.description}</div>}
                <div className="flex gap-2 mt-2">
                  {p.framework && <Badge>{p.framework}</Badge>}
                  {p.language && <Badge variant="info">{p.language}</Badge>}
                </div>
              </button>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function StatCard({ title, value, subtitle, color }: { title: string; value: string; subtitle: string; color: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    red: 'bg-red-50 text-red-600',
    purple: 'bg-purple-50 text-purple-600',
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
      <p className="text-sm font-medium text-gray-600">{title}</p>
      <p className={`text-3xl font-bold mt-2 ${colors[color]?.split(' ')[1] || 'text-gray-900'}`}>{value}</p>
      <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
    </div>
  );
}

function QuickAction({ title, description, href }: { title: string; description: string; href: string }) {
  return (
    <a
      href={href}
      className="block p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
    >
      <div className="font-medium text-gray-900">{title}</div>
      <div className="text-sm text-gray-500 mt-1">{description}</div>
    </a>
  );
}

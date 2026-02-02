/**
 * Executions Page
 * Run Tests view and History view with real-time status updates
 */

import { useEffect, useState, useCallback } from 'react';
import { useProjectStore } from '../stores/project';
import { api } from '../services/api';
import { Card } from '../components/ui';
import { RunTestsView, HistoryView } from '../components/executions';

type ViewMode = 'run' | 'history';

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

export function ExecutionsPage() {
  const { currentProject } = useProjectStore();
  const [viewMode, setViewMode] = useState<ViewMode>('run');
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [testSuites, setTestSuites] = useState<TestSuite[]>([]);
  const [loading, setLoading] = useState(true);

  const loadExecutions = useCallback(async () => {
    if (!currentProject) return;
    try {
      const response = await api.getExecutions(1, 50, currentProject.id);
      const items = response.data?.data || response.data?.items || response.data || [];
      setExecutions(Array.isArray(items) ? items : []);
    } catch (err) {
      console.error('Failed to load executions', err);
    }
  }, [currentProject]);

  const loadEnvironments = useCallback(async () => {
    if (!currentProject) return;
    try {
      const response = await api.get<{ data: Environment[] }>('/environments', {
        projectId: currentProject.id,
      });
      const items = response.data?.data || response.data || [];
      setEnvironments(Array.isArray(items) ? items : []);
    } catch (err) {
      console.error('Failed to load environments', err);
      // Provide default environments for demo
      setEnvironments([
        { id: 'dev', name: 'Development', baseUrl: 'http://localhost:3000' },
        { id: 'staging', name: 'Staging', baseUrl: 'https://staging.example.com' },
        { id: 'prod', name: 'Production', baseUrl: 'https://example.com' },
      ]);
    }
  }, [currentProject]);

  const loadTestSuites = useCallback(async () => {
    if (!currentProject) return;
    try {
      const response = await api.getTestSuites(1, 20, currentProject.id);
      const items = response.data?.data || response.data?.items || response.data || [];
      setTestSuites(
        Array.isArray(items)
          ? items.map((s: { id: string; name: string; testCases?: unknown[] }) => ({
              id: s.id,
              name: s.name,
              testCount: s.testCases?.length || 0,
            }))
          : []
      );
    } catch (err) {
      console.error('Failed to load test suites', err);
    }
  }, [currentProject]);

  useEffect(() => {
    if (currentProject) {
      setLoading(true);
      Promise.all([loadExecutions(), loadEnvironments(), loadTestSuites()]).finally(() => {
        setLoading(false);
      });
    }
  }, [currentProject, loadExecutions, loadEnvironments, loadTestSuites]);

  const handleExecutionStart = (_executionId: string) => {
    // Refresh executions list
    loadExecutions();
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Executions</h1>
          <p className="text-sm text-gray-500 mt-1">
            Run tests and view execution history
          </p>
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg">
          <button
            onClick={() => setViewMode('run')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              viewMode === 'run'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Run Tests
            </span>
          </button>
          <button
            onClick={() => setViewMode('history')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              viewMode === 'history'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              History
            </span>
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{executions.length}</p>
              <p className="text-xs text-gray-500">Total Runs</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">
                {executions.filter((e) => e.status === 'passed').length}
              </p>
              <p className="text-xs text-gray-500">Passed</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">
                {executions.filter((e) => e.status === 'failed').length}
              </p>
              <p className="text-xs text-gray-500">Failed</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-600">
                {executions.filter((e) => e.status === 'running' || e.status === 'pending').length}
              </p>
              <p className="text-xs text-gray-500">Running</p>
            </div>
          </div>
        </Card>
      </div>

      {/* View Content */}
      {viewMode === 'run' ? (
        <RunTestsView
          projectId={currentProject.id}
          environments={environments}
          testSuites={testSuites}
          onExecutionStart={handleExecutionStart}
        />
      ) : (
        <HistoryView
          projectId={currentProject.id}
          executions={executions}
          loading={loading}
          onRefresh={loadExecutions}
        />
      )}
    </div>
  );
}

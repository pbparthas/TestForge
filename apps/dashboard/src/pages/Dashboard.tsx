/**
 * Dashboard Page
 * Rebuilt with tabs, charts, and analytics widgets
 */

import { useEffect, useState, useMemo } from 'react';
import { useProjectStore } from '../stores/project';
import { api } from '../services/api';
import { Card, Badge } from '../components/ui';
import {
  TestExecutionChart,
  CoverageDonutChart,
  StatusBarChart,
  TrendLineChart,
  StatsCard,
  ActivityFeed,
  QuickActions,
  RecentTests,
} from '../components/dashboard';
import type { ExecutionDataPoint, Activity, QuickAction, RecentTest } from '../components/dashboard';
import type { Project, CoverageData, ExecutionSummary } from '../types';
import {
  LayoutDashboard,
  BarChart3,
  Activity as ActivityIcon,
  TestTube,
  Bug,
  Shield,
  Play,
  Plus,
  FileText,
  Zap,
  TrendingUp,
} from 'lucide-react';
import { cn } from '../utils/cn';

type TabId = 'overview' | 'analytics' | 'activity';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ReactNode;
}

const tabs: Tab[] = [
  { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-4 h-4" /> },
  { id: 'analytics', label: 'Analytics', icon: <BarChart3 className="w-4 h-4" /> },
  { id: 'activity', label: 'Activity', icon: <ActivityIcon className="w-4 h-4" /> },
];

// Demo data generators
const generateExecutionData = (): ExecutionDataPoint[] => {
  const data: ExecutionDataPoint[] = [];
  const now = new Date();

  for (let i = 13; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);

    const total = 80 + Math.floor(Math.random() * 40);
    const passed = Math.floor(total * (0.7 + Math.random() * 0.25));
    const failed = Math.floor((total - passed) * 0.7);
    const skipped = total - passed - failed;

    data.push({
      date: date.toISOString(),
      passed,
      failed,
      skipped,
      total,
    });
  }

  return data;
};

const generateActivities = (): Activity[] => {
  const activities: Activity[] = [
    { id: '1', type: 'test_passed', title: 'Login flow tests passed', description: '12 tests in 45s', timestamp: new Date(Date.now() - 300000).toISOString(), user: 'Auto' },
    { id: '2', type: 'test_failed', title: 'API endpoint test failed', description: '/api/users/create - 500 error', timestamp: new Date(Date.now() - 900000).toISOString(), user: 'Auto' },
    { id: '3', type: 'test_created', title: 'New test case created', description: 'Checkout flow validation', timestamp: new Date(Date.now() - 1800000).toISOString(), user: 'Admin' },
    { id: '4', type: 'execution_started', title: 'Test execution started', description: 'Regression Suite - 48 tests', timestamp: new Date(Date.now() - 3600000).toISOString(), user: 'Admin' },
    { id: '5', type: 'bug_created', title: 'Bug filed from failure', description: 'Payment gateway timeout', timestamp: new Date(Date.now() - 7200000).toISOString(), user: 'Auto' },
    { id: '6', type: 'test_updated', title: 'Test case updated', description: 'Added new validation steps', timestamp: new Date(Date.now() - 14400000).toISOString(), user: 'Admin' },
    { id: '7', type: 'bug_fixed', title: 'Bug marked as fixed', description: 'Session timeout issue', timestamp: new Date(Date.now() - 28800000).toISOString(), user: 'Admin' },
    { id: '8', type: 'suite_created', title: 'New test suite created', description: 'Performance Tests', timestamp: new Date(Date.now() - 43200000).toISOString(), user: 'Admin' },
  ];
  return activities;
};

const generateRecentTests = (): RecentTest[] => [
  { id: '1', name: 'User authentication - valid credentials', suite: 'Auth Suite', result: 'passed', duration: 1250, timestamp: new Date(Date.now() - 120000).toISOString() },
  { id: '2', name: 'Product search - keyword match', suite: 'Search Suite', result: 'passed', duration: 890, timestamp: new Date(Date.now() - 180000).toISOString() },
  { id: '3', name: 'Checkout - payment processing', suite: 'E2E Suite', result: 'failed', duration: 3450, timestamp: new Date(Date.now() - 240000).toISOString() },
  { id: '4', name: 'API - rate limiting', suite: 'API Suite', result: 'passed', duration: 560, timestamp: new Date(Date.now() - 300000).toISOString() },
  { id: '5', name: 'File upload - large file', suite: 'Upload Suite', result: 'skipped', timestamp: new Date(Date.now() - 360000).toISOString() },
];

const generatePassRateTrend = () => {
  const data = [];
  const now = new Date();

  for (let i = 29; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    data.push({
      date: date.toISOString(),
      value: 75 + Math.floor(Math.random() * 20),
    });
  }

  return data;
};

export function DashboardPage() {
  const { currentProject, setCurrentProject } = useProjectStore();
  const [projects, setProjects] = useState<Project[]>([]);
  const [stats, setStats] = useState<{
    coverage?: CoverageData;
    executions?: ExecutionSummary;
    bugs?: { open: number; total: number };
  }>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  // Demo data
  const executionData = useMemo(() => generateExecutionData(), []);
  const activities = useMemo(() => generateActivities(), []);
  const recentTests = useMemo(() => generateRecentTests(), []);
  const passRateTrend = useMemo(() => generatePassRateTrend(), []);

  // Coverage chart data
  const coverageChartData = useMemo(() => [
    { name: 'Covered', value: stats.coverage?.coveredRequirements || 65, color: '#22c55e' },
    { name: 'Partial', value: 15, color: '#f59e0b' },
    { name: 'Not Covered', value: stats.coverage ? (stats.coverage.totalRequirements - stats.coverage.coveredRequirements) : 20, color: '#ef4444' },
  ], [stats.coverage]);

  // Status chart data
  const statusChartData = useMemo(() => [
    { name: 'Passed', value: stats.executions?.passed || 85, color: '#22c55e' },
    { name: 'Failed', value: stats.executions?.failed || 10, color: '#ef4444' },
    { name: 'Skipped', value: stats.executions?.skipped || 5, color: '#f59e0b' },
  ], [stats.executions]);

  // Quick actions
  const quickActions: QuickAction[] = [
    {
      id: 'generate',
      label: 'Generate Tests',
      description: 'AI-powered',
      icon: <Zap className="w-5 h-5" />,
      onClick: () => (window.location.href = '/ai'),
      bgColor: 'bg-purple-100',
      color: 'text-purple-600',
    },
    {
      id: 'run',
      label: 'Run Tests',
      description: 'Start execution',
      icon: <Play className="w-5 h-5" />,
      onClick: () => (window.location.href = '/executions'),
      bgColor: 'bg-green-100',
      color: 'text-green-600',
    },
    {
      id: 'create',
      label: 'New Test Case',
      description: 'Manual create',
      icon: <Plus className="w-5 h-5" />,
      onClick: () => (window.location.href = '/test-cases'),
      bgColor: 'bg-blue-100',
      color: 'text-blue-600',
    },
    {
      id: 'report',
      label: 'View Reports',
      description: 'Coverage & trends',
      icon: <FileText className="w-5 h-5" />,
      onClick: () => (window.location.href = '/coverage'),
      bgColor: 'bg-orange-100',
      color: 'text-orange-600',
    },
  ];

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
      const projectsList = response.data?.data || response.data?.items || response.data || [];
      setProjects(Array.isArray(projectsList) ? projectsList : []);
      if (!currentProject && projectsList.length > 0) {
        setCurrentProject(projectsList[0]);
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            {currentProject ? `Project: ${currentProject.name}` : 'Select a project to get started'}
          </p>
        </div>
        {projects.length > 1 && (
          <select
            value={currentProject?.id || ''}
            onChange={(e) => {
              const proj = projects.find(p => p.id === e.target.value);
              if (proj) setCurrentProject(proj);
            }}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all',
              activeTab === tab.id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard
              title="Test Cases"
              value="127"
              subtitle="12 new this week"
              icon={<TestTube className="w-6 h-6 text-blue-600" />}
              iconBgColor="bg-blue-100"
              trend={{ value: 8, isPositive: true, label: 'vs last week' }}
            />
            <StatsCard
              title="Pass Rate"
              value={stats.executions ? `${Math.round((stats.executions.passed / Math.max(stats.executions.total, 1)) * 100)}%` : '89%'}
              subtitle={stats.executions ? `${stats.executions.passed}/${stats.executions.total} tests` : '89/100 tests'}
              icon={<TrendingUp className="w-6 h-6 text-green-600" />}
              iconBgColor="bg-green-100"
              trend={{ value: 3, isPositive: true, label: 'vs last run' }}
            />
            <StatsCard
              title="Coverage"
              value={stats.coverage ? `${stats.coverage.coveragePercentage}%` : '78%'}
              subtitle={stats.coverage ? `${stats.coverage.coveredRequirements} requirements` : '65 requirements'}
              icon={<Shield className="w-6 h-6 text-purple-600" />}
              iconBgColor="bg-purple-100"
              trend={{ value: 5, isPositive: true, label: 'vs last week' }}
            />
            <StatsCard
              title="Open Bugs"
              value={stats.bugs?.open?.toString() || '12'}
              subtitle={stats.bugs ? `${stats.bugs.total} total` : '45 total'}
              icon={<Bug className="w-6 h-6 text-red-600" />}
              iconBgColor="bg-red-100"
              trend={{ value: -15, isPositive: true, label: 'vs last week' }}
            />
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Execution Trend */}
            <Card className="lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Test Execution Trend</h3>
                <span className="text-sm text-gray-500">Last 14 days</span>
              </div>
              <TestExecutionChart data={executionData} height={280} />
            </Card>

            {/* Coverage Donut */}
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Coverage Breakdown</h3>
              </div>
              <CoverageDonutChart
                data={coverageChartData}
                height={280}
                centerLabel="Coverage"
                centerValue={`${stats.coverage?.coveragePercentage || 78}%`}
              />
            </Card>
          </div>

          {/* Quick Actions & Recent Tests */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
              <QuickActions actions={quickActions} columns={2} />
            </Card>

            <Card>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Tests</h3>
              <RecentTests tests={recentTests} maxItems={5} />
            </Card>
          </div>
        </div>
      )}

      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {/* Analytics Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Pass Rate Trend</h3>
                <span className="text-sm text-gray-500">Last 30 days</span>
              </div>
              <TrendLineChart
                data={passRateTrend}
                height={250}
                color="#22c55e"
                showTarget={90}
                targetLabel="Target: 90%"
                yAxisSuffix="%"
                yAxisDomain={[50, 100]}
              />
            </Card>

            <Card>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Test Results Distribution</h3>
              </div>
              <StatusBarChart data={statusChartData} height={250} />
            </Card>
          </div>

          {/* Full Width Execution Chart */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Detailed Execution History</h3>
              <span className="text-sm text-gray-500">Last 14 days</span>
            </div>
            <TestExecutionChart data={executionData} height={350} />
          </Card>

          {/* Coverage and Status Side by Side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Requirement Coverage</h3>
              <CoverageDonutChart
                data={coverageChartData}
                height={300}
                centerLabel="Total"
                centerValue={stats.coverage?.totalRequirements || 100}
              />
            </Card>

            <Card>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Test Types by Status</h3>
              <StatusBarChart
                data={[
                  { name: 'Unit', value: 45, color: '#3b82f6' },
                  { name: 'Integration', value: 28, color: '#8b5cf6' },
                  { name: 'E2E', value: 15, color: '#06b6d4' },
                  { name: 'API', value: 12, color: '#f59e0b' },
                ]}
                height={300}
                layout="vertical"
              />
            </Card>
          </div>
        </div>
      )}

      {activeTab === 'activity' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Activity Feed */}
            <div className="lg:col-span-2">
              <Card>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
                <ActivityFeed activities={activities} maxItems={15} />
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Recent Tests */}
              <Card>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Latest Test Results</h3>
                <RecentTests tests={recentTests} maxItems={8} />
              </Card>

              {/* Quick Stats */}
              <Card>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Today's Summary</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Tests Run</span>
                    <span className="text-lg font-semibold text-gray-900">248</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Pass Rate</span>
                    <span className="text-lg font-semibold text-green-600">92%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Bugs Found</span>
                    <span className="text-lg font-semibold text-red-600">3</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Tests Created</span>
                    <span className="text-lg font-semibold text-blue-600">7</span>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* Projects List (when no project selected) */}
      {!currentProject && (
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Select a Project</h3>
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

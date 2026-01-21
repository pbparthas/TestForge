/**
 * Jenkins Integrations Page
 * Sprint 15: CI/CD Integration settings and build management
 */

import { useState, useEffect } from 'react';
import { useProjectStore } from '../stores/project';
import { api } from '../services/api';
import { cn } from '../utils/cn';
import {
  Settings2,
  Plus,
  Play,
  Trash2,
  Edit2,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  RefreshCw,
  ExternalLink,
  Terminal,
  Server,
  Activity,
} from 'lucide-react';

// =============================================================================
// Types
// =============================================================================

interface JenkinsIntegration {
  id: string;
  projectId: string;
  integrationName: string;
  serverUrl: string;
  username: string;
  jobPath: string;
  defaultEnvironment?: string;
  defaultBrowser?: string;
  buildParameters?: Record<string, unknown>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  builds?: JenkinsBuild[];
}

interface JenkinsBuild {
  id: string;
  integrationId: string;
  jenkinsBuildNumber: number;
  jenkinsBuildUrl: string;
  status: 'pending' | 'building' | 'success' | 'failure' | 'aborted';
  parameters?: Record<string, string>;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  totalTests?: number;
  passedTests?: number;
  failedTests?: number;
  consoleLogUrl?: string;
  createdAt: string;
}

// =============================================================================
// Components
// =============================================================================

function StatusBadge({ status }: { status: JenkinsBuild['status'] }) {
  const config = {
    pending: { color: 'bg-gray-100 text-gray-700', icon: Clock, label: 'Pending' },
    building: { color: 'bg-blue-100 text-blue-700', icon: Loader2, label: 'Building' },
    success: { color: 'bg-green-100 text-green-700', icon: CheckCircle, label: 'Success' },
    failure: { color: 'bg-red-100 text-red-700', icon: XCircle, label: 'Failed' },
    aborted: { color: 'bg-yellow-100 text-yellow-700', icon: XCircle, label: 'Aborted' },
  }[status];

  const Icon = config.icon;

  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full', config.color)}>
      <Icon className={cn('w-3 h-3', status === 'building' && 'animate-spin')} />
      {config.label}
    </span>
  );
}

function IntegrationCard({
  integration,
  onEdit,
  onDelete,
  onTrigger,
  onViewBuilds,
}: {
  integration: JenkinsIntegration;
  onEdit: () => void;
  onDelete: () => void;
  onTrigger: () => void;
  onViewBuilds: () => void;
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={cn(
            'w-10 h-10 rounded-lg flex items-center justify-center',
            integration.isActive ? 'bg-green-100' : 'bg-gray-100'
          )}>
            <Server className={cn('w-5 h-5', integration.isActive ? 'text-green-600' : 'text-gray-400')} />
          </div>
          <div>
            <h3 className="font-medium text-gray-900">{integration.integrationName}</h3>
            <p className="text-sm text-gray-500">{integration.serverUrl}</p>
          </div>
        </div>
        <span className={cn(
          'px-2 py-1 text-xs font-medium rounded-full',
          integration.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
        )}>
          {integration.isActive ? 'Active' : 'Inactive'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4 text-sm">
        <div>
          <span className="text-gray-500">Job Path:</span>
          <span className="ml-2 text-gray-900 font-mono text-xs">{integration.jobPath}</span>
        </div>
        <div>
          <span className="text-gray-500">User:</span>
          <span className="ml-2 text-gray-900">{integration.username}</span>
        </div>
        {integration.defaultEnvironment && (
          <div>
            <span className="text-gray-500">Env:</span>
            <span className="ml-2 text-gray-900">{integration.defaultEnvironment}</span>
          </div>
        )}
        {integration.defaultBrowser && (
          <div>
            <span className="text-gray-500">Browser:</span>
            <span className="ml-2 text-gray-900">{integration.defaultBrowser}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
        <button
          onClick={onTrigger}
          disabled={!integration.isActive}
          className={cn(
            'flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors',
            integration.isActive
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          )}
        >
          <Play className="w-4 h-4" />
          Trigger Build
        </button>
        <button
          onClick={onViewBuilds}
          className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <Activity className="w-4 h-4" />
          View Builds
        </button>
        <div className="flex-1" />
        <button
          onClick={onEdit}
          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
        >
          <Edit2 className="w-4 h-4" />
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function BuildRow({
  build,
  onPoll,
  onViewConsole,
}: {
  build: JenkinsBuild;
  onPoll: () => void;
  onViewConsole: () => void;
}) {
  const formatDuration = (ms?: number) => {
    if (!ms) return '-';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  const formatDate = (date?: string) => {
    if (!date) return '-';
    return new Date(date).toLocaleString();
  };

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-3 text-sm font-medium text-gray-900">
        #{build.jenkinsBuildNumber}
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={build.status} />
      </td>
      <td className="px-4 py-3 text-sm text-gray-500">
        {formatDate(build.startedAt)}
      </td>
      <td className="px-4 py-3 text-sm text-gray-500">
        {formatDuration(build.durationMs)}
      </td>
      <td className="px-4 py-3 text-sm">
        {build.totalTests !== null && build.totalTests !== undefined ? (
          <span>
            <span className="text-green-600">{build.passedTests}</span>
            {' / '}
            <span className="text-red-600">{build.failedTests}</span>
            {' / '}
            <span className="text-gray-600">{build.totalTests}</span>
          </span>
        ) : (
          <span className="text-gray-400">-</span>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-2">
          {(build.status === 'pending' || build.status === 'building') && (
            <button
              onClick={onPoll}
              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
              title="Refresh status"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onViewConsole}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
            title="View console log"
          >
            <Terminal className="w-4 h-4" />
          </button>
          <a
            href={build.jenkinsBuildUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
            title="Open in Jenkins"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </td>
    </tr>
  );
}

// =============================================================================
// Main Page
// =============================================================================

export function JenkinsIntegrationsPage() {
  const { currentProject } = useProjectStore();
  const [integrations, setIntegrations] = useState<JenkinsIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingIntegration, setEditingIntegration] = useState<JenkinsIntegration | null>(null);
  const [deletingIntegration, setDeletingIntegration] = useState<JenkinsIntegration | null>(null);
  const [viewBuildsIntegration, setViewBuildsIntegration] = useState<JenkinsIntegration | null>(null);
  const [consoleLogBuild, setConsoleLogBuild] = useState<JenkinsBuild | null>(null);
  const [consoleLog, setConsoleLog] = useState<string>('');

  // Form state
  const [formData, setFormData] = useState({
    integrationName: '',
    serverUrl: '',
    username: '',
    apiToken: '',
    jobPath: '',
    defaultEnvironment: '',
    defaultBrowser: '',
  });
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionResult, setConnectionResult] = useState<{ success: boolean; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Build history
  const [builds, setBuilds] = useState<JenkinsBuild[]>([]);
  const [buildsLoading, setBuildsLoading] = useState(false);

  // Load integrations
  useEffect(() => {
    if (currentProject?.id) {
      loadIntegrations();
    }
  }, [currentProject?.id]);

  const loadIntegrations = async () => {
    if (!currentProject?.id) return;

    try {
      setLoading(true);
      const result = await api.getProjectJenkinsIntegrations(currentProject.id);
      setIntegrations(result.data || []);
      setError(null);
    } catch (err) {
      setError('Failed to load integrations');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadBuilds = async (integrationId: string) => {
    try {
      setBuildsLoading(true);
      const result = await api.getJenkinsBuilds(integrationId, { limit: 20 });
      setBuilds(result.data || []);
    } catch (err) {
      console.error('Failed to load builds:', err);
    } finally {
      setBuildsLoading(false);
    }
  };

  const testConnection = async () => {
    try {
      setTestingConnection(true);
      setConnectionResult(null);
      const result = await api.testJenkinsConnection({
        serverUrl: formData.serverUrl,
        username: formData.username,
        apiToken: formData.apiToken,
      });
      setConnectionResult({
        success: result.data.success,
        message: result.data.success ? `Connected! ${result.data.version || ''}` : result.data.error || 'Connection failed',
      });
    } catch (err) {
      setConnectionResult({
        success: false,
        message: 'Connection test failed',
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProject?.id) return;

    try {
      setSubmitting(true);

      if (editingIntegration) {
        await api.updateJenkinsIntegration(editingIntegration.id, {
          integrationName: formData.integrationName,
          serverUrl: formData.serverUrl,
          username: formData.username,
          apiToken: formData.apiToken || undefined,
          jobPath: formData.jobPath,
          defaultEnvironment: formData.defaultEnvironment || undefined,
          defaultBrowser: formData.defaultBrowser || undefined,
        });
      } else {
        await api.createJenkinsIntegration({
          projectId: currentProject.id,
          integrationName: formData.integrationName,
          serverUrl: formData.serverUrl,
          username: formData.username,
          apiToken: formData.apiToken,
          jobPath: formData.jobPath,
          defaultEnvironment: formData.defaultEnvironment || undefined,
          defaultBrowser: formData.defaultBrowser || undefined,
        });
      }

      await loadIntegrations();
      closeModal();
    } catch (err) {
      console.error('Failed to save integration:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingIntegration) return;

    try {
      await api.deleteJenkinsIntegration(deletingIntegration.id);
      await loadIntegrations();
      setDeletingIntegration(null);
    } catch (err) {
      console.error('Failed to delete integration:', err);
    }
  };

  const handleTriggerBuild = async (integration: JenkinsIntegration) => {
    try {
      await api.triggerJenkinsBuild(integration.id, {
        environment: integration.defaultEnvironment,
        browser: integration.defaultBrowser,
      });
      // Open builds panel to see the new build
      setViewBuildsIntegration(integration);
      await loadBuilds(integration.id);
    } catch (err) {
      console.error('Failed to trigger build:', err);
    }
  };

  const handlePollBuild = async (buildId: string) => {
    try {
      const result = await api.pollJenkinsBuildStatus(buildId);
      // Update build in list
      setBuilds(prev => prev.map(b => b.id === buildId ? result.data : b));
    } catch (err) {
      console.error('Failed to poll build status:', err);
    }
  };

  const handleViewConsole = async (build: JenkinsBuild) => {
    try {
      setConsoleLogBuild(build);
      const result = await api.getJenkinsBuildConsoleLog(build.id);
      setConsoleLog(result.data?.log || 'No console log available');
    } catch (err) {
      setConsoleLog('Failed to load console log');
    }
  };

  const openEditModal = (integration: JenkinsIntegration) => {
    setEditingIntegration(integration);
    setFormData({
      integrationName: integration.integrationName,
      serverUrl: integration.serverUrl,
      username: integration.username,
      apiToken: '', // Don't show existing token
      jobPath: integration.jobPath,
      defaultEnvironment: integration.defaultEnvironment || '',
      defaultBrowser: integration.defaultBrowser || '',
    });
    setConnectionResult(null);
  };

  const openCreateModal = () => {
    setShowCreateModal(true);
    setFormData({
      integrationName: '',
      serverUrl: '',
      username: '',
      apiToken: '',
      jobPath: '',
      defaultEnvironment: '',
      defaultBrowser: '',
    });
    setConnectionResult(null);
  };

  const closeModal = () => {
    setShowCreateModal(false);
    setEditingIntegration(null);
    setConnectionResult(null);
  };

  if (!currentProject) {
    return (
      <div className="p-8 text-center text-gray-500">
        Please select a project to manage Jenkins integrations.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">CI/CD Integrations</h1>
          <p className="text-sm text-gray-500 mt-1">
            Connect Jenkins to automate test execution
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Integration
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        </div>
      )}

      {/* Integrations Grid */}
      {!loading && integrations.length === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
          <Settings2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No integrations yet</h3>
          <p className="text-gray-500 mb-4">Connect Jenkins to automate your test execution</p>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Integration
          </button>
        </div>
      )}

      {!loading && integrations.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {integrations.map(integration => (
            <IntegrationCard
              key={integration.id}
              integration={integration}
              onEdit={() => openEditModal(integration)}
              onDelete={() => setDeletingIntegration(integration)}
              onTrigger={() => handleTriggerBuild(integration)}
              onViewBuilds={() => {
                setViewBuildsIntegration(integration);
                loadBuilds(integration.id);
              }}
            />
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {(showCreateModal || editingIntegration) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingIntegration ? 'Edit Integration' : 'Add Jenkins Integration'}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Integration Name
                </label>
                <input
                  type="text"
                  value={formData.integrationName}
                  onChange={e => setFormData({ ...formData, integrationName: e.target.value })}
                  placeholder="e.g., Production CI"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Jenkins Server URL
                </label>
                <input
                  type="url"
                  value={formData.serverUrl}
                  onChange={e => setFormData({ ...formData, serverUrl: e.target.value })}
                  placeholder="https://jenkins.example.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={e => setFormData({ ...formData, username: e.target.value })}
                    placeholder="jenkins-user"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    API Token {editingIntegration && '(leave empty to keep)'}
                  </label>
                  <input
                    type="password"
                    value={formData.apiToken}
                    onChange={e => setFormData({ ...formData, apiToken: e.target.value })}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required={!editingIntegration}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Job Path
                </label>
                <input
                  type="text"
                  value={formData.jobPath}
                  onChange={e => setFormData({ ...formData, jobPath: e.target.value })}
                  placeholder="/job/my-pipeline"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Default Environment
                  </label>
                  <input
                    type="text"
                    value={formData.defaultEnvironment}
                    onChange={e => setFormData({ ...formData, defaultEnvironment: e.target.value })}
                    placeholder="staging"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Default Browser
                  </label>
                  <input
                    type="text"
                    value={formData.defaultBrowser}
                    onChange={e => setFormData({ ...formData, defaultBrowser: e.target.value })}
                    placeholder="chrome"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Test Connection */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={testConnection}
                  disabled={testingConnection || !formData.serverUrl || !formData.username || !formData.apiToken}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {testingConnection ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Activity className="w-4 h-4" />
                  )}
                  Test Connection
                </button>

                {connectionResult && (
                  <div className={cn(
                    'mt-2 p-2 rounded-lg text-sm',
                    connectionResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                  )}>
                    {connectionResult.success ? (
                      <span className="flex items-center gap-1">
                        <CheckCircle className="w-4 h-4" />
                        {connectionResult.message}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <XCircle className="w-4 h-4" />
                        {connectionResult.message}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : editingIntegration ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingIntegration && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Delete Integration</h2>
            <p className="text-gray-600 mb-4">
              Are you sure you want to delete &ldquo;{deletingIntegration.integrationName}&rdquo;?
              This will also delete all associated build history.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeletingIntegration(null)}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Build History Modal */}
      {viewBuildsIntegration && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Build History</h2>
                <p className="text-sm text-gray-500">{viewBuildsIntegration.integrationName}</p>
              </div>
              <button
                onClick={() => setViewBuildsIntegration(null)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {buildsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                </div>
              ) : builds.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  No builds yet. Trigger a build to get started.
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Build</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Started</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Duration</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tests (P/F/T)</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {builds.map(build => (
                      <BuildRow
                        key={build.id}
                        build={build}
                        onPoll={() => handlePollBuild(build.id)}
                        onViewConsole={() => handleViewConsole(build)}
                      />
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Console Log Modal */}
      {consoleLogBuild && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Console Log</h2>
                <p className="text-sm text-gray-500">Build #{consoleLogBuild.jenkinsBuildNumber}</p>
              </div>
              <button
                onClick={() => setConsoleLogBuild(null)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-4 bg-gray-900">
              <pre className="text-sm text-green-400 font-mono whitespace-pre-wrap">
                {consoleLog || 'Loading...'}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default JenkinsIntegrationsPage;

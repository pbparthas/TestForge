/**
 * Git Integration Settings Page
 * Configure repository URL, SSH key, branches, and test connection
 */

import { useEffect, useState } from 'react';
import { useProjectStore } from '../stores/project';
import { api } from '../services/api';
import { Card, Badge, Button, Input } from '../components/ui';

interface GitIntegration {
  id: string;
  projectId: string;
  repositoryUrl: string;
  defaultBranch: string;
  developBranch: string;
  workspacePath: string;
  isActive: boolean;
  lastSyncedAt: string | null;
  createdAt: string;
}

export function GitSettingsPage() {
  const { currentProject } = useProjectStore();

  const [integration, setIntegration] = useState<GitIntegration | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message?: string } | null>(null);

  // Form state
  const [repoUrl, setRepoUrl] = useState('');
  const [sshKey, setSshKey] = useState('');
  const [defaultBranch, setDefaultBranch] = useState('main');
  const [developBranch, setDevelopBranch] = useState('develop');

  useEffect(() => {
    if (!currentProject) return;
    loadIntegration();
  }, [currentProject]);

  const loadIntegration = async () => {
    if (!currentProject) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.getGitIntegration(currentProject.id);
      if (res.data) {
        setIntegration(res.data);
        setRepoUrl(res.data.repositoryUrl || '');
        setDefaultBranch(res.data.defaultBranch || 'main');
        setDevelopBranch(res.data.developBranch || 'develop');
      }
    } catch {
      // No integration yet — that's fine, show the create form
      setIntegration(null);
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async () => {
    if (!repoUrl || !sshKey) {
      setError('Repository URL and SSH key are required to test connection');
      return;
    }

    setTesting(true);
    setTestResult(null);
    setError(null);
    try {
      const res = await api.testGitConnection(
        integration?.id || 'new',
        repoUrl,
        sshKey
      );
      setTestResult(res.data);
    } catch (err) {
      setTestResult({ success: false, message: err instanceof Error ? err.message : 'Connection failed' });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!currentProject || !repoUrl || !sshKey) {
      setError('Repository URL and SSH key are required');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await api.createGitIntegration({
        projectId: currentProject.id,
        repositoryUrl: repoUrl,
        sshKey,
        defaultBranch,
        developBranch,
      });
      setIntegration(res.data);
      setSshKey(''); // Clear SSH key from form after save
      setSuccess('Git integration configured successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save integration');
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async () => {
    if (!currentProject) return;
    setError(null);
    setSuccess(null);
    try {
      const res = await api.syncFromGit(currentProject.id);
      setSuccess(`Sync complete: ${res.data.updated} updated, ${res.data.created} created`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
    }
  };

  if (!currentProject) {
    return (
      <div className="p-8">
        <Card>
          <p className="text-gray-500">Please select a project to configure Git integration.</p>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Git Integration</h1>
        <p className="text-gray-600 mt-1">
          Connect a Git repository to sync test scripts with version control
        </p>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-md p-3 text-sm text-green-700">
          {success}
        </div>
      )}

      {/* Status Card */}
      {integration && (
        <Card className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-sm font-semibold text-gray-700">Connection Status</h2>
                <Badge variant={integration.isActive ? 'success' : 'danger'}>
                  {integration.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <p className="text-sm text-gray-500 font-mono">{integration.repositoryUrl}</p>
              <p className="text-xs text-gray-400 mt-1">
                Branches: {integration.developBranch} &rarr; {integration.defaultBranch}
                {integration.lastSyncedAt && (
                  <> | Last synced: {new Date(integration.lastSyncedAt).toLocaleString()}</>
                )}
              </p>
            </div>
            <Button size="sm" variant="secondary" onClick={handleSync}>
              Sync Now
            </Button>
          </div>
        </Card>
      )}

      {/* Configuration Form */}
      <Card>
        <div className="space-y-5">
          <h2 className="text-lg font-semibold text-gray-900">
            {integration ? 'Update Configuration' : 'Setup Git Integration'}
          </h2>

          <Input
            label="Repository URL (SSH)"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            placeholder="git@github.com:org/test-scripts.git"
          />

          <div className="w-full">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              SSH Private Key
            </label>
            <textarea
              value={sshKey}
              onChange={(e) => setSshKey(e.target.value)}
              placeholder={integration ? '(key stored securely — paste new key to update)' : '-----BEGIN OPENSSH PRIVATE KEY-----\n...\n-----END OPENSSH PRIVATE KEY-----'}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={4}
            />
            <p className="mt-1 text-xs text-gray-400">
              The SSH key is encrypted at rest and never exposed in API responses.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Main Branch"
              value={defaultBranch}
              onChange={(e) => setDefaultBranch(e.target.value)}
              placeholder="main"
            />
            <Input
              label="Develop Branch"
              value={developBranch}
              onChange={(e) => setDevelopBranch(e.target.value)}
              placeholder="develop"
            />
          </div>

          {/* Test Connection Result */}
          {testResult && (
            <div className={`p-3 rounded-md text-sm ${
              testResult.success
                ? 'bg-green-50 border border-green-200 text-green-700'
                : 'bg-red-50 border border-red-200 text-red-700'
            }`}>
              {testResult.success ? 'Connection successful' : `Connection failed: ${testResult.message || 'Unknown error'}`}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            <Button
              variant="secondary"
              onClick={handleTestConnection}
              disabled={testing || !repoUrl || !sshKey}
            >
              {testing ? 'Testing...' : 'Test Connection'}
            </Button>
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={saving || !repoUrl || !sshKey}
            >
              {saving ? 'Saving...' : integration ? 'Update Integration' : 'Create Integration'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

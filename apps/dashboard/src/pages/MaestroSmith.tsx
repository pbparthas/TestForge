/**
 * MaestroSmith Page
 * AI-powered Maestro YAML flow generation for Flutter mobile automation
 *
 * Features:
 * - Registry sync from GitLab
 * - Widget browser with search
 * - Flow generation from test cases or descriptions
 * - YAML editor with validation
 * - Command reference
 */

import { useState, useEffect } from 'react';
import { useProjectStore } from '../stores/project';
import { api } from '../services/api';
import { Card, Button, Input } from '../components/ui';
import {
  Smartphone,
  RefreshCw,
  Loader2,
  Check,
  AlertCircle,
  Copy,
  Download,
  Search,
  Settings,
  FileText,
  Code,
  Wand2,
  ChevronRight,
  ChevronDown,
  Info,
  Database,
  Edit3,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

interface MaestroConfig {
  enabled: boolean;
  gitlab: {
    host: string;
    projectId: string;
    branch: string;
    jobName: string;
    artifactPath: string;
    accessToken: string;
  };
  defaultAppId: string;
}

interface RegistryStatus {
  cached: boolean;
  version?: string;
  widgetCount?: number;
  fetchedAt?: string;
  appId?: string;
}

interface RegistryWidget {
  eventName: string;
  file: string;
  type?: string;
}

interface MaestroCommand {
  name: string;
  description: string;
  example: string;
}

interface GeneratedFlow {
  name: string;
  yaml: string;
  appId: string;
  commands: string[];
  warnings: string[];
}

interface TestStep {
  order: number;
  action: string;
  expected: string;
}

type TabId = 'generate' | 'widgets' | 'config' | 'reference';

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function MaestroSmithPage() {
  const { currentProject } = useProjectStore();
  const [activeTab, setActiveTab] = useState<TabId>('generate');

  // Config state
  const [config, setConfig] = useState<MaestroConfig>({
    enabled: true,
    gitlab: {
      host: 'https://gitlab.com',
      projectId: '',
      branch: 'main',
      jobName: 'extract-maestro-registry',
      artifactPath: 'maestro_registry.json',
      accessToken: '',
    },
    defaultAppId: 'com.bankbazaar.app',
  });
  const [configSaving, setConfigSaving] = useState(false);
  const [configSaved, setConfigSaved] = useState(false);

  // Registry state
  const [registryStatus, setRegistryStatus] = useState<RegistryStatus | null>(null);
  const [widgets, setWidgets] = useState<RegistryWidget[]>([]);
  const [widgetSearch, setWidgetSearch] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Generation state
  const [inputMethod, setInputMethod] = useState<'test_case' | 'description'>('description');
  const [description, setDescription] = useState('');
  const [testCaseTitle, setTestCaseTitle] = useState('');
  const [testCaseSteps, setTestCaseSteps] = useState<TestStep[]>([
    { order: 1, action: '', expected: '' },
  ]);
  const [includeAssertions, setIncludeAssertions] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generatedFlow, setGeneratedFlow] = useState<GeneratedFlow | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // Edit state
  const [editInstruction, setEditInstruction] = useState('');
  const [editing, setEditing] = useState(false);

  // Validation state
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  } | null>(null);

  // Commands reference
  const [commands, setCommands] = useState<MaestroCommand[]>([]);
  const [expandedCommands, setExpandedCommands] = useState<Set<string>>(new Set());

  // Load registry status and commands on mount
  useEffect(() => {
    if (currentProject) {
      loadRegistryStatus();
      loadCommands();
    }
  }, [currentProject]);

  const loadRegistryStatus = async () => {
    if (!currentProject) return;
    try {
      const response = await api.getMaestroRegistryStatus(currentProject.id);
      setRegistryStatus(response.data);
      if (response.data.cached) {
        loadWidgets();
      }
    } catch {
      // Registry not configured yet
    }
  };

  const loadWidgets = async (query?: string) => {
    if (!currentProject) return;
    try {
      const response = await api.getMaestroWidgets(currentProject.id, query);
      setWidgets(response.data || []);
    } catch {
      setWidgets([]);
    }
  };

  const loadCommands = async () => {
    try {
      const response = await api.getMaestroCommands();
      setCommands(response.data || []);
    } catch {
      // Ignore
    }
  };

  const saveConfig = async () => {
    if (!currentProject) return;
    setConfigSaving(true);
    setConfigSaved(false);

    try {
      await api.setMaestroConfig(currentProject.id, config);
      setConfigSaved(true);
      setTimeout(() => setConfigSaved(false), 3000);
    } catch (err) {
      console.error('Failed to save config:', err);
    } finally {
      setConfigSaving(false);
    }
  };

  const syncRegistry = async () => {
    if (!currentProject) return;
    setSyncing(true);
    setSyncError(null);

    try {
      const response = await api.syncMaestroRegistry(currentProject.id);
      if (response.data.success) {
        await loadRegistryStatus();
        await loadWidgets();
      } else {
        setSyncError(response.data.error || 'Sync failed');
      }
    } catch (err) {
      setSyncError((err as Error).message);
    } finally {
      setSyncing(false);
    }
  };

  const generateFlow = async () => {
    if (!currentProject) return;
    setGenerating(true);
    setGenerateError(null);
    setGeneratedFlow(null);

    try {
      const input: Parameters<typeof api.generateMaestroFlow>[0] = {
        inputMethod,
        options: {
          appId: config.defaultAppId,
          projectId: currentProject.id,
          includeAssertions,
        },
      };

      if (inputMethod === 'description') {
        input.description = description;
      } else {
        input.testCase = {
          title: testCaseTitle,
          steps: testCaseSteps.filter(s => s.action.trim()),
        };
      }

      const response = await api.generateMaestroFlow(input);
      setGeneratedFlow(response.data);
    } catch (err) {
      setGenerateError((err as Error).message);
    } finally {
      setGenerating(false);
    }
  };

  const editFlow = async () => {
    if (!currentProject || !generatedFlow) return;
    setEditing(true);

    try {
      const response = await api.editMaestroFlow({
        existingYaml: generatedFlow.yaml,
        instruction: editInstruction,
        projectId: currentProject.id,
      });
      setGeneratedFlow({
        ...generatedFlow,
        yaml: response.data.yaml,
        warnings: response.data.warnings || [],
      });
      setEditInstruction('');
    } catch (err) {
      setGenerateError((err as Error).message);
    } finally {
      setEditing(false);
    }
  };

  const validateYaml = async () => {
    if (!generatedFlow) return;
    setValidating(true);

    try {
      const response = await api.validateMaestroYaml(generatedFlow.yaml, currentProject?.id);
      setValidationResult({
        valid: response.data.valid,
        errors: response.data.errors || [],
        warnings: response.data.warnings || [],
      });
    } catch (err) {
      setValidationResult({
        valid: false,
        errors: [(err as Error).message],
        warnings: [],
      });
    } finally {
      setValidating(false);
    }
  };

  const copyYaml = () => {
    if (generatedFlow) {
      navigator.clipboard.writeText(generatedFlow.yaml);
    }
  };

  const downloadYaml = () => {
    if (generatedFlow) {
      const blob = new Blob([generatedFlow.yaml], { type: 'text/yaml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = generatedFlow.name;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const addStep = () => {
    setTestCaseSteps([
      ...testCaseSteps,
      { order: testCaseSteps.length + 1, action: '', expected: '' },
    ]);
  };

  const updateStep = (index: number, field: 'action' | 'expected', value: string) => {
    setTestCaseSteps(prev => prev.map((step, i) =>
      i === index ? { ...step, [field]: value } : step
    ));
  };

  const removeStep = (index: number) => {
    if (testCaseSteps.length > 1) {
      const newSteps = testCaseSteps.filter((_, i) => i !== index);
      setTestCaseSteps(newSteps.map((s, i) => ({ ...s, order: i + 1 })));
    }
  };

  const toggleCommand = (name: string) => {
    const newExpanded = new Set(expandedCommands);
    if (newExpanded.has(name)) {
      newExpanded.delete(name);
    } else {
      newExpanded.add(name);
    }
    setExpandedCommands(newExpanded);
  };

  // Filter widgets by search
  const filteredWidgets = widgetSearch
    ? widgets.filter(w =>
        w.eventName.toLowerCase().includes(widgetSearch.toLowerCase()) ||
        w.file.toLowerCase().includes(widgetSearch.toLowerCase())
      )
    : widgets;

  if (!currentProject) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Select a project to use MaestroSmith
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-100 rounded-lg">
            <Smartphone className="w-6 h-6 text-orange-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">MaestroSmith</h1>
            <p className="text-sm text-gray-500">Generate Maestro YAML flows for Flutter automation</p>
          </div>
        </div>

        {/* Registry Status Badge */}
        {registryStatus?.cached && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 rounded-full text-sm">
            <Database className="w-4 h-4" />
            <span>{registryStatus.widgetCount} widgets</span>
            <span className="text-green-500">v{registryStatus.version?.slice(0, 7)}</span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-lg w-fit">
        {[
          { id: 'generate' as TabId, label: 'Generate', icon: <Wand2 className="w-4 h-4" /> },
          { id: 'widgets' as TabId, label: 'Widgets', icon: <Search className="w-4 h-4" /> },
          { id: 'config' as TabId, label: 'Config', icon: <Settings className="w-4 h-4" /> },
          { id: 'reference' as TabId, label: 'Reference', icon: <Info className="w-4 h-4" /> },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-white text-orange-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'generate' && (
        <div className="grid grid-cols-2 gap-6">
          {/* Left: Input */}
          <div className="space-y-4">
            <Card className="p-4">
              <h3 className="font-medium mb-4">Input Method</h3>
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setInputMethod('description')}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                    inputMethod === 'description'
                      ? 'bg-orange-100 text-orange-700 border-2 border-orange-300'
                      : 'bg-gray-100 text-gray-600 border-2 border-transparent'
                  }`}
                >
                  <FileText className="w-4 h-4 inline mr-2" />
                  Description
                </button>
                <button
                  onClick={() => setInputMethod('test_case')}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                    inputMethod === 'test_case'
                      ? 'bg-orange-100 text-orange-700 border-2 border-orange-300'
                      : 'bg-gray-100 text-gray-600 border-2 border-transparent'
                  }`}
                >
                  <Code className="w-4 h-4 inline mr-2" />
                  Test Case
                </button>
              </div>

              {inputMethod === 'description' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Describe the test flow
                  </label>
                  <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="e.g., Test user login with mobile number, enter OTP, and verify dashboard is shown"
                    className="w-full h-32 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Test Title</label>
                    <Input
                      value={testCaseTitle}
                      onChange={e => setTestCaseTitle(e.target.value)}
                      placeholder="e.g., User Login"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Steps</label>
                    <div className="space-y-2">
                      {testCaseSteps.map((step, index) => (
                        <div key={index} className="flex gap-2 items-start">
                          <span className="text-xs text-gray-500 mt-2 w-4">{step.order}.</span>
                          <Input
                            value={step.action}
                            onChange={e => updateStep(index, 'action', e.target.value)}
                            placeholder="Action"
                            className="flex-1"
                          />
                          <Input
                            value={step.expected}
                            onChange={e => updateStep(index, 'expected', e.target.value)}
                            placeholder="Expected"
                            className="flex-1"
                          />
                          <button
                            onClick={() => removeStep(index)}
                            className="p-2 text-gray-400 hover:text-red-500"
                          >
                            &times;
                          </button>
                        </div>
                      ))}
                    </div>
                    <Button size="sm" variant="ghost" onClick={addStep} className="mt-2">
                      + Add Step
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 mt-4">
                <input
                  type="checkbox"
                  id="includeAssertions"
                  checked={includeAssertions}
                  onChange={e => setIncludeAssertions(e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="includeAssertions" className="text-sm text-gray-600">
                  Include assertions
                </label>
              </div>

              <Button
                onClick={generateFlow}
                disabled={generating || (inputMethod === 'description' ? !description : !testCaseTitle)}
                className="w-full mt-4 bg-orange-600 hover:bg-orange-700"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate Flow
                  </>
                )}
              </Button>

              {generateError && (
                <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  {generateError}
                </div>
              )}
            </Card>

            {/* Edit Section */}
            {generatedFlow && (
              <Card className="p-4">
                <h3 className="font-medium mb-3">Edit Flow</h3>
                <div className="flex gap-2">
                  <Input
                    value={editInstruction}
                    onChange={e => setEditInstruction(e.target.value)}
                    placeholder="e.g., Add timeout wait for dashboard"
                    className="flex-1"
                  />
                  <Button onClick={editFlow} disabled={editing || !editInstruction}>
                    {editing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Edit3 className="w-4 h-4" />}
                  </Button>
                </div>
              </Card>
            )}
          </div>

          {/* Right: Output */}
          <div className="space-y-4">
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium">Generated YAML</h3>
                {generatedFlow && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={validateYaml} disabled={validating}>
                      {validating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={copyYaml}>
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={downloadYaml}>
                      <Download className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>

              {generatedFlow ? (
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm overflow-x-auto max-h-96 overflow-y-auto">
                  {generatedFlow.yaml}
                </pre>
              ) : (
                <div className="bg-gray-100 rounded-lg p-8 text-center text-gray-500">
                  <Code className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>Generated YAML will appear here</p>
                </div>
              )}

              {/* Validation Results */}
              {validationResult && (
                <div className={`mt-4 p-3 rounded-lg ${validationResult.valid ? 'bg-green-50' : 'bg-red-50'}`}>
                  <div className={`flex items-center gap-2 font-medium ${validationResult.valid ? 'text-green-700' : 'text-red-700'}`}>
                    {validationResult.valid ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    {validationResult.valid ? 'Valid YAML' : 'Invalid YAML'}
                  </div>
                  {validationResult.errors.length > 0 && (
                    <ul className="mt-2 text-sm text-red-600 list-disc list-inside">
                      {validationResult.errors.map((e, i) => <li key={i}>{e}</li>)}
                    </ul>
                  )}
                  {validationResult.warnings.length > 0 && (
                    <ul className="mt-2 text-sm text-amber-600 list-disc list-inside">
                      {validationResult.warnings.map((w, i) => <li key={i}>{w}</li>)}
                    </ul>
                  )}
                </div>
              )}

              {/* Warnings */}
              {generatedFlow && generatedFlow.warnings.length > 0 && (
                <div className="mt-4 p-3 bg-amber-50 rounded-lg">
                  <div className="flex items-center gap-2 text-amber-700 font-medium mb-2">
                    <AlertTriangle className="w-4 h-4" />
                    Warnings
                  </div>
                  <ul className="text-sm text-amber-600 list-disc list-inside">
                    {generatedFlow.warnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              )}

              {/* Commands Used */}
              {generatedFlow && generatedFlow.commands.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1">
                  {generatedFlow.commands.map(cmd => (
                    <span key={cmd} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                      {cmd}
                    </span>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {activeTab === 'widgets' && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium">Widget Registry</h3>
            <Button onClick={syncRegistry} disabled={syncing} size="sm">
              {syncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              Sync from GitLab
            </Button>
          </div>

          {syncError && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5" />
              {syncError}
            </div>
          )}

          <div className="mb-4 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search widgets by eventName or file..."
              value={widgetSearch}
              onChange={e => {
                setWidgetSearch(e.target.value);
                loadWidgets(e.target.value);
              }}
              className="pl-9"
            />
          </div>

          {filteredWidgets.length > 0 ? (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-600">eventName</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-600">File</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-600">Type</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-600">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredWidgets.slice(0, 50).map((widget, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-mono text-orange-600">{widget.eventName}</td>
                      <td className="px-4 py-2 text-gray-500">{widget.file}</td>
                      <td className="px-4 py-2">
                        <span className="px-2 py-0.5 bg-gray-100 rounded text-xs">{widget.type || '-'}</span>
                      </td>
                      <td className="px-4 py-2">
                        <button
                          onClick={() => navigator.clipboard.writeText(`tapOn:\n    id: ${widget.eventName}`)}
                          className="text-gray-400 hover:text-orange-600"
                          title="Copy selector"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredWidgets.length > 50 && (
                <div className="p-2 bg-gray-50 text-center text-sm text-gray-500">
                  Showing 50 of {filteredWidgets.length} widgets
                </div>
              )}
            </div>
          ) : registryStatus?.cached ? (
            <div className="text-center py-8 text-gray-500">
              No widgets found matching your search
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Database className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No registry cached. Click "Sync from GitLab" to fetch widgets.</p>
            </div>
          )}
        </Card>
      )}

      {activeTab === 'config' && (
        <Card className="p-4 max-w-2xl">
          <h3 className="font-medium mb-4">GitLab Configuration</h3>

          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="enabled"
                checked={config.enabled}
                onChange={e => setConfig({ ...config, enabled: e.target.checked })}
                className="rounded"
              />
              <label htmlFor="enabled" className="text-sm font-medium">Enable MaestroSmith</label>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">GitLab Host</label>
                <Input
                  value={config.gitlab.host}
                  onChange={e => setConfig({ ...config, gitlab: { ...config.gitlab, host: e.target.value } })}
                  placeholder="https://gitlab.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Project ID</label>
                <Input
                  value={config.gitlab.projectId}
                  onChange={e => setConfig({ ...config, gitlab: { ...config.gitlab, projectId: e.target.value } })}
                  placeholder="12345678"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
                <Input
                  value={config.gitlab.branch}
                  onChange={e => setConfig({ ...config, gitlab: { ...config.gitlab, branch: e.target.value } })}
                  placeholder="main"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CI Job Name</label>
                <Input
                  value={config.gitlab.jobName}
                  onChange={e => setConfig({ ...config, gitlab: { ...config.gitlab, jobName: e.target.value } })}
                  placeholder="extract-maestro-registry"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Artifact Path</label>
                <Input
                  value={config.gitlab.artifactPath}
                  onChange={e => setConfig({ ...config, gitlab: { ...config.gitlab, artifactPath: e.target.value } })}
                  placeholder="maestro_registry.json"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Access Token</label>
                <Input
                  type="password"
                  value={config.gitlab.accessToken}
                  onChange={e => setConfig({ ...config, gitlab: { ...config.gitlab, accessToken: e.target.value } })}
                  placeholder="glpat-xxxx"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Default App ID</label>
              <Input
                value={config.defaultAppId}
                onChange={e => setConfig({ ...config, defaultAppId: e.target.value })}
                placeholder="com.example.app"
              />
            </div>

            <Button onClick={saveConfig} disabled={configSaving}>
              {configSaving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : configSaved ? (
                <Check className="w-4 h-4 mr-2" />
              ) : (
                <Settings className="w-4 h-4 mr-2" />
              )}
              {configSaved ? 'Saved!' : 'Save Configuration'}
            </Button>
          </div>
        </Card>
      )}

      {activeTab === 'reference' && (
        <Card className="p-4">
          <h3 className="font-medium mb-4">Maestro Command Reference</h3>

          <div className="space-y-2">
            {commands.map(cmd => (
              <div key={cmd.name} className="border rounded-lg">
                <button
                  onClick={() => toggleCommand(cmd.name)}
                  className="w-full flex items-center justify-between p-3 hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-orange-600">{cmd.name}</span>
                    <span className="text-sm text-gray-500">{cmd.description}</span>
                  </div>
                  {expandedCommands.has(cmd.name) ? (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  )}
                </button>
                {expandedCommands.has(cmd.name) && (
                  <div className="px-3 pb-3">
                    <pre className="bg-gray-900 text-gray-100 p-3 rounded text-sm overflow-x-auto">
                      {cmd.example}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

export default MaestroSmithPage;

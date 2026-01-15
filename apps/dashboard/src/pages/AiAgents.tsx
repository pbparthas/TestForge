/**
 * AI Agents Page
 */

import { useState } from 'react';
import { useProjectStore } from '../stores/project';
import { api } from '../services/api';
import { Card, Button, Input } from '../components/ui';

type AgentTab = 'testweaver' | 'scriptsmith' | 'usage';

export function AiAgentsPage() {
  const { currentProject } = useProjectStore();
  const [activeTab, setActiveTab] = useState<AgentTab>('testweaver');

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
        <h1 className="text-2xl font-bold text-gray-900">AI Agents</h1>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4">
          {[
            { id: 'testweaver', label: 'TestWeaver' },
            { id: 'scriptsmith', label: 'ScriptSmith' },
            { id: 'usage', label: 'Usage & Costs' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as AgentTab)}
              className={`py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'testweaver' && <TestWeaverPanel projectId={currentProject.id} />}
      {activeTab === 'scriptsmith' && <ScriptSmithPanel projectId={currentProject.id} />}
      {activeTab === 'usage' && <UsagePanel projectId={currentProject.id} />}
    </div>
  );
}

function TestWeaverPanel({ projectId }: { projectId: string }) {
  const [specification, setSpecification] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ testCases?: unknown[] } | null>(null);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    if (!specification.trim()) return;
    setLoading(true);
    setError('');
    try {
      const response = await api.generateTestCases(projectId, specification);
      setResult(response.data);
    } catch (err) {
      setError('Failed to generate test cases');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card title="TestWeaver - Generate Test Cases">
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Describe a feature or requirement in natural language, and TestWeaver will generate comprehensive test cases.
        </p>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Feature Specification
          </label>
          <textarea
            value={specification}
            onChange={(e) => setSpecification(e.target.value)}
            placeholder="Describe the feature you want to test..."
            className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button onClick={handleGenerate} isLoading={loading}>
          Generate Test Cases
        </Button>

        {result?.testCases && (
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-3">Generated Test Cases</h4>
            <pre className="text-xs text-gray-700 overflow-auto max-h-96">
              {JSON.stringify(result.testCases, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </Card>
  );
}

function ScriptSmithPanel({ projectId }: { projectId: string }) {
  const [title, setTitle] = useState('');
  const [steps, setSteps] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ script?: string } | null>(null);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    if (!title.trim()) return;
    setLoading(true);
    setError('');
    try {
      const stepsArray = steps.split('\n').filter(s => s.trim()).map((action, i) => ({
        order: i + 1,
        action: action.trim(),
      }));
      const response = await api.generateScript(projectId, { title, steps: stepsArray });
      setResult(response.data);
    } catch (err) {
      setError('Failed to generate script');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card title="ScriptSmith - Generate Automation Scripts">
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Provide a test case and ScriptSmith will generate automation scripts using your project's framework.
        </p>

        <Input
          label="Test Case Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g., User Login Flow"
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Test Steps (one per line)
          </label>
          <textarea
            value={steps}
            onChange={(e) => setSteps(e.target.value)}
            placeholder="Navigate to login page&#10;Enter username&#10;Enter password&#10;Click login button&#10;Verify dashboard loads"
            className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button onClick={handleGenerate} isLoading={loading}>
          Generate Script
        </Button>

        {result?.script && (
          <div className="mt-6 p-4 bg-gray-900 rounded-lg">
            <h4 className="font-medium text-white mb-3">Generated Script</h4>
            <pre className="text-xs text-green-400 overflow-auto max-h-96">
              {result.script}
            </pre>
          </div>
        )}
      </div>
    </Card>
  );
}

function UsagePanel({ projectId }: { projectId: string }) {
  const [usage, setUsage] = useState<{
    totalCalls?: number;
    totalTokens?: number;
    totalCostUsd?: number;
    totalCostInr?: number;
    byAgent?: Record<string, { calls: number; tokens: number; costUsd: number }>;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const loadUsage = async () => {
    setLoading(true);
    try {
      const response = await api.getAiUsageSummary(projectId);
      setUsage(response.data);
    } catch (err) {
      console.error('Failed to load usage', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card title="AI Usage & Costs">
      <div className="space-y-4">
        <Button onClick={loadUsage} isLoading={loading} variant="secondary">
          Load Usage Data
        </Button>

        {usage && (
          <div className="space-y-6">
            {/* Summary */}
            <div className="grid grid-cols-4 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-gray-900">{usage.totalCalls || 0}</p>
                <p className="text-sm text-gray-600">Total Calls</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-gray-900">{(usage.totalTokens || 0).toLocaleString()}</p>
                <p className="text-sm text-gray-600">Total Tokens</p>
              </div>
              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-2xl font-bold text-blue-700">${(usage.totalCostUsd || 0).toFixed(2)}</p>
                <p className="text-sm text-blue-600">Cost (USD)</p>
              </div>
              <div className="p-4 bg-green-50 rounded-lg">
                <p className="text-2xl font-bold text-green-700">₹{(usage.totalCostInr || 0).toFixed(2)}</p>
                <p className="text-sm text-green-600">Cost (INR)</p>
              </div>
            </div>

            {/* By Agent */}
            {usage.byAgent && Object.keys(usage.byAgent).length > 0 && (
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Usage by Agent</h4>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2 px-4 text-sm font-medium text-gray-600">Agent</th>
                        <th className="text-right py-2 px-4 text-sm font-medium text-gray-600">Calls</th>
                        <th className="text-right py-2 px-4 text-sm font-medium text-gray-600">Tokens</th>
                        <th className="text-right py-2 px-4 text-sm font-medium text-gray-600">Cost (USD)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(usage.byAgent).map(([agent, data]) => (
                        <tr key={agent} className="border-b border-gray-100">
                          <td className="py-2 px-4 text-sm text-gray-900 capitalize">{agent.replace('_', ' ')}</td>
                          <td className="py-2 px-4 text-sm text-gray-600 text-right">{data.calls}</td>
                          <td className="py-2 px-4 text-sm text-gray-600 text-right">{data.tokens.toLocaleString()}</td>
                          <td className="py-2 px-4 text-sm text-gray-600 text-right">${data.costUsd.toFixed(4)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

/**
 * AI Agents Page
 * All 6 AI agents: TestWeaver, ScriptSmith, Framework, Self-Healing, FlowPilot, CodeGuardian
 */

import { useState } from 'react';
import { useProjectStore } from '../stores/project';
import { api } from '../services/api';
import { Card, Button, Input } from '../components/ui';
import {
  Sparkles,
  Code,
  Wrench,
  HeartPulse,
  Workflow,
  Shield,
  BarChart3,
} from 'lucide-react';

type AgentTab = 'testweaver' | 'scriptsmith' | 'framework' | 'selfhealing' | 'flowpilot' | 'codeguardian' | 'usage';

const tabs = [
  { id: 'testweaver', label: 'TestWeaver', icon: Sparkles, description: 'Generate test cases from specifications' },
  { id: 'scriptsmith', label: 'ScriptSmith', icon: Code, description: 'Generate automation scripts' },
  { id: 'framework', label: 'Framework', icon: Wrench, description: 'Analyze and review code' },
  { id: 'selfhealing', label: 'Self-Healing', icon: HeartPulse, description: 'Diagnose and fix test failures' },
  { id: 'flowpilot', label: 'FlowPilot', icon: Workflow, description: 'Generate API tests' },
  { id: 'codeguardian', label: 'CodeGuardian', icon: Shield, description: 'Generate unit tests' },
  { id: 'usage', label: 'Usage', icon: BarChart3, description: 'Track AI usage and costs' },
];

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
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI Agents</h1>
          <p className="text-sm text-gray-500 mt-1">AI-powered test automation tools</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 overflow-x-auto">
        <nav className="flex gap-1 min-w-max">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as AgentTab)}
                className={`flex items-center gap-2 py-3 px-4 border-b-2 text-sm font-medium transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'testweaver' && <TestWeaverPanel projectId={currentProject.id} />}
      {activeTab === 'scriptsmith' && <ScriptSmithPanel projectId={currentProject.id} />}
      {activeTab === 'framework' && <FrameworkPanel projectId={currentProject.id} />}
      {activeTab === 'selfhealing' && <SelfHealingPanel projectId={currentProject.id} />}
      {activeTab === 'flowpilot' && <FlowPilotPanel projectId={currentProject.id} />}
      {activeTab === 'codeguardian' && <CodeGuardianPanel projectId={currentProject.id} />}
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
            placeholder="Describe the feature you want to test...&#10;&#10;Example: User login with email and password. Should validate email format, check password requirements, handle invalid credentials, and redirect to dashboard on success."
            className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button onClick={handleGenerate} isLoading={loading}>
          <Sparkles className="w-4 h-4 mr-2" />
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
          <Code className="w-4 h-4 mr-2" />
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

function FrameworkPanel({ projectId }: { projectId: string }) {
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('typescript');
  const [reviewType, setReviewType] = useState('best_practices');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ analysis?: unknown; suggestions?: unknown[] } | null>(null);
  const [error, setError] = useState('');

  const handleAnalyze = async () => {
    if (!code.trim()) return;
    setLoading(true);
    setError('');
    try {
      const response = await api.reviewCode(projectId, code, language, reviewType);
      setResult(response.data);
    } catch (err) {
      setError('Failed to analyze code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card title="Framework Agent - Code Analysis & Review">
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Paste your test code for analysis. Get suggestions for improvements, best practices, and optimization.
        </p>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Language</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="typescript">TypeScript</option>
              <option value="javascript">JavaScript</option>
              <option value="python">Python</option>
              <option value="java">Java</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Review Type</label>
            <select
              value={reviewType}
              onChange={(e) => setReviewType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="best_practices">Best Practices</option>
              <option value="performance">Performance</option>
              <option value="security">Security</option>
              <option value="maintainability">Maintainability</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Code to Analyze</label>
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Paste your test code here..."
            className="w-full h-48 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button onClick={handleAnalyze} isLoading={loading}>
          <Wrench className="w-4 h-4 mr-2" />
          Analyze Code
        </Button>

        {result && (
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-3">Analysis Result</h4>
            <pre className="text-xs text-gray-700 overflow-auto max-h-96">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </Card>
  );
}

function SelfHealingPanel({ projectId }: { projectId: string }) {
  const [testCaseId, setTestCaseId] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [oldLocator, setOldLocator] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ diagnosis?: unknown; fix?: unknown } | null>(null);
  const [error, setError] = useState('');

  const handleDiagnose = async () => {
    if (!errorMessage.trim()) return;
    setLoading(true);
    setError('');
    try {
      const response = await api.diagnoseFailure(projectId, testCaseId, errorMessage);
      setResult(response.data);
    } catch (err) {
      setError('Failed to diagnose failure');
    } finally {
      setLoading(false);
    }
  };

  const handleFix = async () => {
    if (!oldLocator.trim()) return;
    setLoading(true);
    setError('');
    try {
      const response = await api.fixLocator(projectId, testCaseId, oldLocator);
      setResult(response.data);
    } catch (err) {
      setError('Failed to fix locator');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card title="Self-Healing Agent - Diagnose & Fix Failures">
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Analyze test failures and automatically suggest fixes for broken locators or flaky tests.
        </p>

        <Input
          label="Test Case ID (optional)"
          value={testCaseId}
          onChange={(e) => setTestCaseId(e.target.value)}
          placeholder="Enter test case ID"
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Error Message</label>
          <textarea
            value={errorMessage}
            onChange={(e) => setErrorMessage(e.target.value)}
            placeholder="Paste the error message from your failed test..."
            className="w-full h-24 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <Button onClick={handleDiagnose} isLoading={loading} variant="secondary">
          <HeartPulse className="w-4 h-4 mr-2" />
          Diagnose Failure
        </Button>

        <hr className="border-gray-200" />

        <Input
          label="Broken Locator"
          value={oldLocator}
          onChange={(e) => setOldLocator(e.target.value)}
          placeholder="e.g., #login-button or [data-testid='submit']"
        />

        <Button onClick={handleFix} isLoading={loading}>
          <HeartPulse className="w-4 h-4 mr-2" />
          Fix Locator
        </Button>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {result && (
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-3">Result</h4>
            <pre className="text-xs text-gray-700 overflow-auto max-h-96">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </Card>
  );
}

function FlowPilotPanel({ projectId }: { projectId: string }) {
  const [openApiSpec, setOpenApiSpec] = useState('');
  const [userFlow, setUserFlow] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ tests?: unknown[]; chain?: unknown } | null>(null);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    if (!openApiSpec.trim()) return;
    setLoading(true);
    setError('');
    try {
      const response = await api.generateApiTests(projectId, openApiSpec);
      setResult(response.data);
    } catch (err) {
      setError('Failed to generate API tests');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateChain = async () => {
    if (!userFlow.trim()) return;
    setLoading(true);
    setError('');
    try {
      // Simple example endpoints
      const endpoints = [
        { method: 'POST', path: '/auth/login', description: 'Login user' },
        { method: 'GET', path: '/users/me', description: 'Get current user' },
      ];
      const response = await api.generateApiChain(projectId, userFlow, endpoints);
      setResult(response.data);
    } catch (err) {
      setError('Failed to generate API chain');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card title="FlowPilot - API Test Generation">
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Generate API tests from OpenAPI specifications or describe user flows for chained API testing.
        </p>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            OpenAPI Specification (JSON/YAML)
          </label>
          <textarea
            value={openApiSpec}
            onChange={(e) => setOpenApiSpec(e.target.value)}
            placeholder="Paste your OpenAPI spec here..."
            className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <Button onClick={handleGenerate} isLoading={loading}>
          <Workflow className="w-4 h-4 mr-2" />
          Generate API Tests
        </Button>

        <hr className="border-gray-200" />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            User Flow Description
          </label>
          <textarea
            value={userFlow}
            onChange={(e) => setUserFlow(e.target.value)}
            placeholder="Describe the user flow, e.g.: User logs in, views profile, updates email, logs out"
            className="w-full h-24 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <Button onClick={handleGenerateChain} isLoading={loading} variant="secondary">
          <Workflow className="w-4 h-4 mr-2" />
          Generate API Chain
        </Button>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {result && (
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-3">Generated Tests</h4>
            <pre className="text-xs text-gray-700 overflow-auto max-h-96">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </Card>
  );
}

function CodeGuardianPanel({ projectId }: { projectId: string }) {
  const [sourceCode, setSourceCode] = useState('');
  const [language, setLanguage] = useState('typescript');
  const [framework, setFramework] = useState('vitest');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ tests?: string; analysis?: unknown } | null>(null);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    if (!sourceCode.trim()) return;
    setLoading(true);
    setError('');
    try {
      const response = await api.generateUnitTests(projectId, sourceCode, language, framework);
      setResult(response.data);
    } catch (err) {
      setError('Failed to generate unit tests');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card title="CodeGuardian - Unit Test Generation">
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Paste your source code and CodeGuardian will generate comprehensive unit tests with mocks and edge cases.
        </p>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Language</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="typescript">TypeScript</option>
              <option value="javascript">JavaScript</option>
              <option value="python">Python</option>
              <option value="java">Java</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Test Framework</label>
            <select
              value={framework}
              onChange={(e) => setFramework(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="vitest">Vitest</option>
              <option value="jest">Jest</option>
              <option value="pytest">Pytest</option>
              <option value="junit">JUnit</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Source Code</label>
          <textarea
            value={sourceCode}
            onChange={(e) => setSourceCode(e.target.value)}
            placeholder="Paste your source code here (function, class, or module)..."
            className="w-full h-48 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button onClick={handleGenerate} isLoading={loading}>
          <Shield className="w-4 h-4 mr-2" />
          Generate Unit Tests
        </Button>

        {result?.tests && (
          <div className="mt-6 p-4 bg-gray-900 rounded-lg">
            <h4 className="font-medium text-white mb-3">Generated Unit Tests</h4>
            <pre className="text-xs text-green-400 overflow-auto max-h-96">
              {result.tests}
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
          <BarChart3 className="w-4 h-4 mr-2" />
          Load Usage Data
        </Button>

        {usage && (
          <div className="space-y-6">
            {/* Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                          <td className="py-2 px-4 text-sm text-gray-900 capitalize">{agent.replace(/_/g, ' ')}</td>
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

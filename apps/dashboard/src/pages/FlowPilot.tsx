/**
 * FlowPilot Page
 * AI-powered API test generation from OpenAPI specs
 */

import { useState } from 'react';
import { useProjectStore } from '../stores/project';
import { api } from '../services/api';
import { Card, Button } from '../components/ui';
import { Compass, FileJson, Play, Upload, Copy, Check, RefreshCw } from 'lucide-react';

export function FlowPilotPage() {
  const { currentProject } = useProjectStore();
  const [activeTab, setActiveTab] = useState<'generate' | 'validate'>('generate');

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
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center">
            <Compass className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">FlowPilot</h1>
            <p className="text-sm text-gray-500">AI-powered API test generation from OpenAPI/Swagger specs</p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab('generate')}
            className={`flex items-center gap-2 py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
              activeTab === 'generate'
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <FileJson className="w-4 h-4" />
            Generate Tests
          </button>
          <button
            onClick={() => setActiveTab('validate')}
            className={`flex items-center gap-2 py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
              activeTab === 'validate'
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Play className="w-4 h-4" />
            Validate Flow
          </button>
        </nav>
      </div>

      {activeTab === 'generate' && <GeneratePanel projectId={currentProject.id} />}
      {activeTab === 'validate' && <ValidatePanel projectId={currentProject.id} />}
    </div>
  );
}

function GeneratePanel({ projectId }: { projectId: string }) {
  const [openApiSpec, setOpenApiSpec] = useState('');
  const [selectedEndpoints, setSelectedEndpoints] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ tests?: Array<{ endpoint: string; method: string; testCode: string }> } | null>(null);
  const [error, setError] = useState('');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleGenerate = async () => {
    if (!openApiSpec.trim()) return;
    setLoading(true);
    setError('');
    try {
      const response = await api.generateApiTests(
        projectId,
        openApiSpec,
        selectedEndpoints.length > 0 ? selectedEndpoints : undefined
      );
      setResult(response.data);
    } catch (err) {
      setError('Failed to generate API tests');
    } finally {
      setLoading(false);
    }
  };

  const copyTest = (index: number) => {
    if (!result?.tests?.[index]) return;
    navigator.clipboard.writeText(result.tests[index].testCode);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setOpenApiSpec(content);
    };
    reader.readAsText(file);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Input Panel */}
      <Card title="OpenAPI Specification">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <label className="flex-1">
              <input
                type="file"
                accept=".json,.yaml,.yml"
                onChange={handleFileUpload}
                className="hidden"
              />
              <div className="flex items-center justify-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-orange-400 hover:bg-orange-50 transition-colors">
                <Upload className="w-4 h-4 text-gray-500" />
                <span className="text-sm text-gray-600">Upload OpenAPI file</span>
              </div>
            </label>
          </div>

          <div className="text-center text-xs text-gray-400">or paste directly below</div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              OpenAPI/Swagger JSON or YAML
            </label>
            <textarea
              value={openApiSpec}
              onChange={(e) => setOpenApiSpec(e.target.value)}
              placeholder={`{
  "openapi": "3.0.0",
  "info": { "title": "My API", "version": "1.0.0" },
  "paths": {
    "/users": {
      "get": { ... },
      "post": { ... }
    }
  }
}`}
              className="w-full h-56 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Filter Endpoints (optional, comma-separated)
            </label>
            <input
              type="text"
              value={selectedEndpoints.join(', ')}
              onChange={(e) => setSelectedEndpoints(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
              placeholder="/users, /auth/login, /products"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button onClick={handleGenerate} isLoading={loading} className="w-full bg-orange-600 hover:bg-orange-700">
            <Compass className="w-4 h-4 mr-2" />
            Generate API Tests
          </Button>
        </div>
      </Card>

      {/* Output Panel */}
      <Card title="Generated API Tests">
        {result?.tests && result.tests.length > 0 ? (
          <div className="space-y-4 max-h-[500px] overflow-auto">
            {result.tests.map((test, index) => (
              <div key={index} className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                      test.method === 'GET' ? 'bg-green-100 text-green-700' :
                      test.method === 'POST' ? 'bg-blue-100 text-blue-700' :
                      test.method === 'PUT' ? 'bg-yellow-100 text-yellow-700' :
                      test.method === 'DELETE' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {test.method}
                    </span>
                    <span className="text-sm font-mono text-gray-700">{test.endpoint}</span>
                  </div>
                  <button
                    onClick={() => copyTest(index)}
                    className="p-1 text-gray-400 hover:text-gray-600"
                    title="Copy test"
                  >
                    {copiedIndex === index ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <div className="bg-gray-900 p-3 overflow-auto max-h-48">
                  <pre className="text-xs text-green-400 font-mono">
                    {test.testCode}
                  </pre>
                </div>
              </div>
            ))}
            <Button variant="secondary" className="w-full">
              Save All to Scripts
            </Button>
          </div>
        ) : (
          <div className="text-center py-16 text-gray-500">
            <FileJson className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>Generated API tests will appear here</p>
            <p className="text-sm mt-1">Upload or paste an OpenAPI spec</p>
          </div>
        )}
      </Card>
    </div>
  );
}

function ValidatePanel({ projectId }: { projectId: string }) {
  const [apiFlow, setApiFlow] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    valid?: boolean;
    steps?: Array<{ endpoint: string; status: 'passed' | 'failed'; message: string }>;
  } | null>(null);
  const [error, setError] = useState('');

  const handleValidate = async () => {
    if (!apiFlow.trim()) return;
    setLoading(true);
    setError('');
    try {
      const response = await api.validateApiFlow(projectId, apiFlow, baseUrl || undefined);
      setResult(response.data);
    } catch (err) {
      setError('Failed to validate API flow');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card title="API Flow Definition">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Base URL (optional)
            </label>
            <input
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.example.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              API Flow (YAML or JSON)
            </label>
            <textarea
              value={apiFlow}
              onChange={(e) => setApiFlow(e.target.value)}
              placeholder={`steps:
  - name: Create User
    method: POST
    endpoint: /users
    body: { "name": "Test", "email": "test@example.com" }
    expect:
      status: 201
      save:
        userId: response.id

  - name: Get User
    method: GET
    endpoint: /users/{{userId}}
    expect:
      status: 200
      body:
        name: "Test"`}
              className="w-full h-64 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button onClick={handleValidate} isLoading={loading} className="w-full bg-orange-600 hover:bg-orange-700">
            <RefreshCw className="w-4 h-4 mr-2" />
            Validate Flow
          </Button>
        </div>
      </Card>

      <Card title="Validation Results">
        {result ? (
          <div className="space-y-4">
            <div className={`p-4 rounded-lg ${result.valid ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${result.valid ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className={`font-medium ${result.valid ? 'text-green-800' : 'text-red-800'}`}>
                  {result.valid ? 'Flow Valid' : 'Flow Invalid'}
                </span>
              </div>
            </div>

            {result.steps && result.steps.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-gray-900">Step Results</h4>
                {result.steps.map((step, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg border ${
                      step.status === 'passed'
                        ? 'bg-green-50 border-green-200'
                        : 'bg-red-50 border-red-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${step.status === 'passed' ? 'bg-green-500' : 'bg-red-500'}`} />
                      <span className="text-sm font-mono">{step.endpoint}</span>
                    </div>
                    <p className="mt-1 text-sm text-gray-600">{step.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-16 text-gray-500">
            <Play className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>Validation results will appear here</p>
            <p className="text-sm mt-1">Define an API flow and click Validate</p>
          </div>
        )}
      </Card>
    </div>
  );
}

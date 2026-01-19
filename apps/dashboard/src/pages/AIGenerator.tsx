/**
 * AI Generator (TestWeaver) Page
 * AI-powered test case generation from requirements
 */

import { useState } from 'react';
import { useProjectStore } from '../stores/project';
import { api } from '../services/api';
import { Card, Button } from '../components/ui';
import { Wand2, FileText, Sparkles, RefreshCw, Copy, Check } from 'lucide-react';

export function AIGeneratorPage() {
  const { currentProject } = useProjectStore();
  const [activeTab, setActiveTab] = useState<'generate' | 'evolve'>('generate');

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
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center">
            <Wand2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">TestWeaver AI</h1>
            <p className="text-sm text-gray-500">Generate test cases from requirements using AI</p>
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
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            Generate Tests
          </button>
          <button
            onClick={() => setActiveTab('evolve')}
            className={`flex items-center gap-2 py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
              activeTab === 'evolve'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <RefreshCw className="w-4 h-4" />
            Evolve Tests
          </button>
        </nav>
      </div>

      {activeTab === 'generate' && <GeneratePanel projectId={currentProject.id} />}
      {activeTab === 'evolve' && <EvolvePanel projectId={currentProject.id} />}
    </div>
  );
}

function GeneratePanel({ projectId }: { projectId: string }) {
  const [requirement, setRequirement] = useState('');
  const [context, setContext] = useState('');
  const [testType, setTestType] = useState('functional');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ testCases?: Array<{ title: string; steps: string[]; expected: string }> } | null>(null);
  const [error, setError] = useState('');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleGenerate = async () => {
    if (!requirement.trim()) return;
    setLoading(true);
    setError('');
    try {
      const response = await api.generateTestCases(projectId, requirement, context || undefined);
      setResult(response.data);
    } catch (err) {
      setError('Failed to generate test cases');
    } finally {
      setLoading(false);
    }
  };

  const copyTestCase = (index: number) => {
    if (!result?.testCases?.[index]) return;
    const tc = result.testCases[index];
    const text = `Title: ${tc.title}\n\nSteps:\n${tc.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\nExpected: ${tc.expected}`;
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Input Panel */}
      <Card title="Requirement Input">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Requirement Description
            </label>
            <textarea
              value={requirement}
              onChange={(e) => setRequirement(e.target.value)}
              placeholder="Describe the feature or requirement you want to test...&#10;&#10;Example: Users should be able to login with email and password. The system should validate credentials and redirect to dashboard on success."
              className="w-full h-40 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Test Type
            </label>
            <select
              value={testType}
              onChange={(e) => setTestType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="functional">Functional Tests</option>
              <option value="integration">Integration Tests</option>
              <option value="e2e">End-to-End Tests</option>
              <option value="regression">Regression Tests</option>
              <option value="smoke">Smoke Tests</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Additional Context (Optional)
            </label>
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Any additional context, constraints, or specific scenarios to consider..."
              className="w-full h-24 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button onClick={handleGenerate} isLoading={loading} className="w-full bg-blue-600 hover:bg-blue-700">
            <Sparkles className="w-4 h-4 mr-2" />
            Generate Test Cases
          </Button>
        </div>
      </Card>

      {/* Output Panel */}
      <Card title="Generated Test Cases">
        {result?.testCases && result.testCases.length > 0 ? (
          <div className="space-y-4 max-h-[500px] overflow-auto">
            {result.testCases.map((tc, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-medium text-gray-900">{tc.title}</h4>
                  <button
                    onClick={() => copyTestCase(index)}
                    className="p-1 text-gray-400 hover:text-gray-600"
                    title="Copy test case"
                  >
                    {copiedIndex === index ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <div className="mt-2 space-y-2">
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase">Steps</p>
                    <ol className="mt-1 text-sm text-gray-700 list-decimal list-inside">
                      {tc.steps.map((step, i) => (
                        <li key={i}>{step}</li>
                      ))}
                    </ol>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase">Expected Result</p>
                    <p className="mt-1 text-sm text-gray-700">{tc.expected}</p>
                  </div>
                </div>
              </div>
            ))}
            <Button variant="secondary" className="w-full">
              Save All to Test Cases
            </Button>
          </div>
        ) : (
          <div className="text-center py-16 text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>Generated test cases will appear here</p>
            <p className="text-sm mt-1">Enter a requirement and click Generate</p>
          </div>
        )}
      </Card>
    </div>
  );
}

function EvolvePanel({ projectId }: { projectId: string }) {
  const [existingTests, setExistingTests] = useState('');
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ evolvedTests?: Array<{ title: string; changes: string }> } | null>(null);
  const [error, setError] = useState('');

  const handleEvolve = async () => {
    if (!existingTests.trim() || !feedback.trim()) return;
    setLoading(true);
    setError('');
    try {
      const response = await api.evolveTestCases(projectId, existingTests, feedback);
      setResult(response.data);
    } catch (err) {
      setError('Failed to evolve test cases');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card title="Existing Tests">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Paste your existing test cases
            </label>
            <textarea
              value={existingTests}
              onChange={(e) => setExistingTests(e.target.value)}
              placeholder="Paste your existing test cases here...&#10;&#10;TC-001: Login with valid credentials&#10;Steps:&#10;1. Navigate to login page&#10;2. Enter valid email&#10;3. Enter valid password&#10;4. Click login button&#10;Expected: User is redirected to dashboard"
              className="w-full h-48 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Evolution Feedback
            </label>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="What changes or improvements do you want?&#10;&#10;Examples:&#10;- Add negative test cases&#10;- Include edge cases for empty fields&#10;- Add performance assertions&#10;- Make tests more specific"
              className="w-full h-24 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button onClick={handleEvolve} isLoading={loading} className="w-full bg-blue-600 hover:bg-blue-700">
            <RefreshCw className="w-4 h-4 mr-2" />
            Evolve Test Cases
          </Button>
        </div>
      </Card>

      <Card title="Evolved Tests">
        {result?.evolvedTests && result.evolvedTests.length > 0 ? (
          <div className="space-y-4 max-h-[400px] overflow-auto">
            {result.evolvedTests.map((test, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4 bg-green-50">
                <h4 className="font-medium text-gray-900">{test.title}</h4>
                <p className="mt-2 text-sm text-gray-600">{test.changes}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 text-gray-500">
            <RefreshCw className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>Evolved tests will appear here</p>
            <p className="text-sm mt-1">Paste existing tests and provide feedback</p>
          </div>
        )}
      </Card>
    </div>
  );
}

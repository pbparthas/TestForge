/**
 * Self-Healing Page
 * AI-powered test failure diagnosis and auto-fix
 */

import { useState } from 'react';
import { useProjectStore } from '../stores/project';
import { api } from '../services/api';
import { Card, Button, Input } from '../components/ui';
import { Heart, AlertTriangle, Wrench, Search, CheckCircle, XCircle, Lightbulb } from 'lucide-react';

export function SelfHealingPage() {
  const { currentProject } = useProjectStore();
  const [activeTab, setActiveTab] = useState<'diagnose' | 'fix'>('diagnose');

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
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center">
            <Heart className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Self-Healing</h1>
            <p className="text-sm text-gray-500">AI-powered test failure diagnosis and auto-fix</p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab('diagnose')}
            className={`flex items-center gap-2 py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
              activeTab === 'diagnose'
                ? 'border-red-500 text-red-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Search className="w-4 h-4" />
            Diagnose Failure
          </button>
          <button
            onClick={() => setActiveTab('fix')}
            className={`flex items-center gap-2 py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
              activeTab === 'fix'
                ? 'border-red-500 text-red-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Wrench className="w-4 h-4" />
            Fix Locator
          </button>
        </nav>
      </div>

      {activeTab === 'diagnose' && <DiagnosePanel projectId={currentProject.id} />}
      {activeTab === 'fix' && <FixLocatorPanel projectId={currentProject.id} />}
    </div>
  );
}

function DiagnosePanel({ projectId }: { projectId: string }) {
  const [testCaseId, setTestCaseId] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [stackTrace, setStackTrace] = useState('');
  const [screenshot, setScreenshot] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    diagnosis?: {
      category: string;
      rootCause: string;
      confidence: number;
      suggestions: string[];
    };
    autoFix?: {
      available: boolean;
      description: string;
      code?: string;
    };
  } | null>(null);
  const [error, setError] = useState('');

  const handleDiagnose = async () => {
    if (!errorMessage.trim()) return;
    setLoading(true);
    setError('');
    try {
      const response = await api.diagnoseFailure(projectId, testCaseId || 'unknown', errorMessage, screenshot || undefined);
      setResult(response.data);
    } catch (err) {
      setError('Failed to diagnose failure');
    } finally {
      setLoading(false);
    }
  };

  const categoryIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'locator':
        return <Search className="w-5 h-5 text-orange-500" />;
      case 'timing':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'assertion':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'environment':
        return <Wrench className="w-5 h-5 text-blue-500" />;
      default:
        return <AlertTriangle className="w-5 h-5 text-gray-500" />;
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Input Panel */}
      <Card title="Failure Details">
        <div className="space-y-4">
          <Input
            label="Test Case ID (optional)"
            value={testCaseId}
            onChange={(e) => setTestCaseId(e.target.value)}
            placeholder="TC-001"
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Error Message
            </label>
            <textarea
              value={errorMessage}
              onChange={(e) => setErrorMessage(e.target.value)}
              placeholder={"TimeoutError: Locator.click: Timeout 30000ms exceeded\n\nCall log:\n  - waiting for locator('button[data-testid=\"submit\"]')\n  - locator resolved to element\n  - attempting click action"}
              className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Stack Trace (optional)
            </label>
            <textarea
              value={stackTrace}
              onChange={(e) => setStackTrace(e.target.value)}
              placeholder={"at LoginPage.submit (/tests/pages/login.ts:45:12)\nat tests/login.spec.ts:23:5"}
              className="w-full h-24 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Screenshot URL (optional)
            </label>
            <input
              type="text"
              value={screenshot}
              onChange={(e) => setScreenshot(e.target.value)}
              placeholder="https://storage.example.com/screenshots/failure-123.png"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button onClick={handleDiagnose} isLoading={loading} className="w-full bg-red-600 hover:bg-red-700">
            <Search className="w-4 h-4 mr-2" />
            Diagnose Failure
          </Button>
        </div>
      </Card>

      {/* Output Panel */}
      <Card title="Diagnosis">
        {result?.diagnosis ? (
          <div className="space-y-4">
            {/* Category & Confidence */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                {categoryIcon(result.diagnosis.category)}
                <div>
                  <p className="text-sm font-medium text-gray-900">{result.diagnosis.category} Issue</p>
                  <p className="text-xs text-gray-500">Detected failure type</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-gray-900">{Math.round(result.diagnosis.confidence * 100)}%</p>
                <p className="text-xs text-gray-500">Confidence</p>
              </div>
            </div>

            {/* Root Cause */}
            <div className="p-4 bg-red-50 rounded-lg border border-red-200">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-800">Root Cause</p>
                  <p className="text-sm text-red-700 mt-1">{result.diagnosis.rootCause}</p>
                </div>
              </div>
            </div>

            {/* Suggestions */}
            {result.diagnosis.suggestions.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Lightbulb className="w-4 h-4 text-yellow-500" />
                  <h4 className="font-medium text-gray-900">Suggestions</h4>
                </div>
                <ul className="space-y-2">
                  {result.diagnosis.suggestions.map((suggestion, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm text-gray-600 p-2 bg-yellow-50 rounded">
                      <span className="text-yellow-600 font-medium">{index + 1}.</span>
                      {suggestion}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Auto-Fix Available */}
            {result.autoFix?.available && (
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span className="font-medium text-green-800">Auto-Fix Available</span>
                </div>
                <p className="text-sm text-green-700">{result.autoFix.description}</p>
                {result.autoFix.code && (
                  <div className="mt-2 bg-gray-900 rounded p-2">
                    <pre className="text-xs text-green-400 font-mono">{result.autoFix.code}</pre>
                  </div>
                )}
                <Button className="mt-3 bg-green-600 hover:bg-green-700 text-sm">
                  Apply Auto-Fix
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-16 text-gray-500">
            <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>Diagnosis will appear here</p>
            <p className="text-sm mt-1">Paste error details and click Diagnose</p>
          </div>
        )}
      </Card>
    </div>
  );
}

function FixLocatorPanel({ projectId }: { projectId: string }) {
  const [testCaseId, setTestCaseId] = useState('');
  const [oldLocator, setOldLocator] = useState('');
  const [pageHtml, setPageHtml] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    newLocator?: string;
    alternatives?: string[];
    explanation?: string;
  } | null>(null);
  const [error, setError] = useState('');

  const handleFix = async () => {
    if (!oldLocator.trim()) return;
    setLoading(true);
    setError('');
    try {
      const response = await api.fixLocator(projectId, testCaseId || 'unknown', oldLocator, pageHtml || undefined);
      setResult(response.data);
    } catch (err) {
      setError('Failed to fix locator');
    } finally {
      setLoading(false);
    }
  };

  const copyLocator = (locator: string) => {
    navigator.clipboard.writeText(locator);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Input Panel */}
      <Card title="Broken Locator">
        <div className="space-y-4">
          <Input
            label="Test Case ID (optional)"
            value={testCaseId}
            onChange={(e) => setTestCaseId(e.target.value)}
            placeholder="TC-001"
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Old/Broken Locator
            </label>
            <textarea
              value={oldLocator}
              onChange={(e) => setOldLocator(e.target.value)}
              placeholder="button[data-testid='submit-btn']&#10;&#10;or&#10;&#10;//button[@class='btn-primary' and contains(text(), 'Submit')]"
              className="w-full h-24 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Page HTML Snippet (optional, helps improve accuracy)
            </label>
            <textarea
              value={pageHtml}
              onChange={(e) => setPageHtml(e.target.value)}
              placeholder='<form class="login-form">&#10;  <button type="submit" class="btn btn-primary" id="login-btn">&#10;    Log In&#10;  </button>&#10;</form>'
              className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button onClick={handleFix} isLoading={loading} className="w-full bg-red-600 hover:bg-red-700">
            <Wrench className="w-4 h-4 mr-2" />
            Find New Locator
          </Button>
        </div>
      </Card>

      {/* Output Panel */}
      <Card title="Fixed Locator">
        {result?.newLocator ? (
          <div className="space-y-4">
            {/* Primary Recommendation */}
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span className="font-medium text-green-800">Recommended Locator</span>
                </div>
                <button
                  onClick={() => copyLocator(result.newLocator!)}
                  className="text-xs text-green-600 hover:text-green-800"
                >
                  Copy
                </button>
              </div>
              <div className="bg-gray-900 rounded p-3">
                <code className="text-sm text-green-400 font-mono">{result.newLocator}</code>
              </div>
            </div>

            {/* Explanation */}
            {result.explanation && (
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-700">{result.explanation}</p>
              </div>
            )}

            {/* Alternatives */}
            {result.alternatives && result.alternatives.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Alternative Locators</h4>
                <div className="space-y-2">
                  {result.alternatives.map((alt, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                    >
                      <code className="text-sm font-mono text-gray-700">{alt}</code>
                      <button
                        onClick={() => copyLocator(alt)}
                        className="text-xs text-gray-500 hover:text-gray-700"
                      >
                        Copy
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Button className="w-full bg-green-600 hover:bg-green-700">
              Apply to Test Case
            </Button>
          </div>
        ) : (
          <div className="text-center py-16 text-gray-500">
            <Wrench className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>Fixed locator will appear here</p>
            <p className="text-sm mt-1">Paste broken locator and click Fix</p>
          </div>
        )}
      </Card>
    </div>
  );
}

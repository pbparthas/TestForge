/**
 * CodeGuardian Page
 * AI-powered unit test generation
 */

import { useState } from 'react';
import { useProjectStore } from '../stores/project';
import { api } from '../services/api';
import { Card, Button } from '../components/ui';
import { Shield, Code, FileCode, Zap, Copy, Check } from 'lucide-react';

export function CodeGuardianPage() {
  const { currentProject } = useProjectStore();
  const [activeTab, setActiveTab] = useState<'generate' | 'analyze'>('generate');

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
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">CodeGuardian</h1>
            <p className="text-sm text-gray-500">AI-powered unit test generation and code analysis</p>
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
                ? 'border-green-500 text-green-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Zap className="w-4 h-4" />
            Generate Unit Tests
          </button>
          <button
            onClick={() => setActiveTab('analyze')}
            className={`flex items-center gap-2 py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
              activeTab === 'analyze'
                ? 'border-green-500 text-green-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Code className="w-4 h-4" />
            Code Analysis
          </button>
        </nav>
      </div>

      {activeTab === 'generate' && <GeneratePanel projectId={currentProject.id} />}
      {activeTab === 'analyze' && <AnalyzePanel projectId={currentProject.id} />}
    </div>
  );
}

function GeneratePanel({ projectId }: { projectId: string }) {
  const [sourceCode, setSourceCode] = useState('');
  const [language, setLanguage] = useState('typescript');
  const [framework, setFramework] = useState('vitest');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ tests?: string; coverage?: string } | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

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

  const copyTests = () => {
    if (!result?.tests) return;
    navigator.clipboard.writeText(result.tests);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Input Panel */}
      <Card title="Source Code">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Language
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="typescript">TypeScript</option>
                <option value="javascript">JavaScript</option>
                <option value="python">Python</option>
                <option value="java">Java</option>
                <option value="csharp">C#</option>
                <option value="go">Go</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Test Framework
              </label>
              <select
                value={framework}
                onChange={(e) => setFramework(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="vitest">Vitest</option>
                <option value="jest">Jest</option>
                <option value="mocha">Mocha</option>
                <option value="pytest">Pytest</option>
                <option value="junit">JUnit</option>
                <option value="xunit">xUnit</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Paste your code
            </label>
            <textarea
              value={sourceCode}
              onChange={(e) => setSourceCode(e.target.value)}
              placeholder={`// Paste your function or class here...\n\nexport function calculateTotal(items: Item[]): number {\n  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);\n}`}
              className="w-full h-64 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button onClick={handleGenerate} isLoading={loading} className="w-full bg-green-600 hover:bg-green-700">
            <Zap className="w-4 h-4 mr-2" />
            Generate Unit Tests
          </Button>
        </div>
      </Card>

      {/* Output Panel */}
      <Card title="Generated Tests">
        {result?.tests ? (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button
                onClick={copyTests}
                className="flex items-center gap-1 px-3 py-1 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-md"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-green-500" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy
                  </>
                )}
              </button>
            </div>
            <div className="bg-gray-900 rounded-lg p-4 overflow-auto max-h-[450px]">
              <pre className="text-sm text-green-400 font-mono whitespace-pre-wrap">
                {result.tests}
              </pre>
            </div>
            {result.coverage && (
              <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                <p className="text-sm font-medium text-green-800">Estimated Coverage</p>
                <p className="text-sm text-green-600">{result.coverage}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-16 text-gray-500">
            <FileCode className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>Generated tests will appear here</p>
            <p className="text-sm mt-1">Paste your code and click Generate</p>
          </div>
        )}
      </Card>
    </div>
  );
}

function AnalyzePanel({ projectId }: { projectId: string }) {
  const [codeSnippet, setCodeSnippet] = useState('');
  const [language, setLanguage] = useState('typescript');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    issues?: Array<{ type: string; severity: string; message: string; line?: number }>;
    suggestions?: string[];
    testability?: string;
  } | null>(null);
  const [error, setError] = useState('');

  const handleAnalyze = async () => {
    if (!codeSnippet.trim()) return;
    setLoading(true);
    setError('');
    try {
      const response = await api.analyzeFramework(projectId, codeSnippet, language);
      setResult(response.data);
    } catch (err) {
      setError('Failed to analyze code');
    } finally {
      setLoading(false);
    }
  };

  const severityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'critical': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card title="Code to Analyze">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Language
            </label>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Code Snippet
            </label>
            <textarea
              value={codeSnippet}
              onChange={(e) => setCodeSnippet(e.target.value)}
              placeholder="// Paste code for analysis..."
              className="w-full h-64 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button onClick={handleAnalyze} isLoading={loading} className="w-full bg-green-600 hover:bg-green-700">
            <Code className="w-4 h-4 mr-2" />
            Analyze Code
          </Button>
        </div>
      </Card>

      <Card title="Analysis Results">
        {result ? (
          <div className="space-y-4 max-h-[500px] overflow-auto">
            {result.testability && (
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm font-medium text-blue-800">Testability Score</p>
                <p className="text-sm text-blue-600">{result.testability}</p>
              </div>
            )}

            {result.issues && result.issues.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Issues Found</h4>
                <div className="space-y-2">
                  {result.issues.map((issue, index) => (
                    <div key={index} className="p-3 border border-gray-200 rounded-lg">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 text-xs rounded-full ${severityColor(issue.severity)}`}>
                          {issue.severity}
                        </span>
                        <span className="text-xs text-gray-500">{issue.type}</span>
                        {issue.line && <span className="text-xs text-gray-400">Line {issue.line}</span>}
                      </div>
                      <p className="mt-1 text-sm text-gray-700">{issue.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.suggestions && result.suggestions.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Suggestions</h4>
                <ul className="space-y-1">
                  {result.suggestions.map((suggestion, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm text-gray-600">
                      <span className="text-green-500 mt-1">+</span>
                      {suggestion}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-16 text-gray-500">
            <Code className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>Analysis results will appear here</p>
            <p className="text-sm mt-1">Paste code and click Analyze</p>
          </div>
        )}
      </Card>
    </div>
  );
}

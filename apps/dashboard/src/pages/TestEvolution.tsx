/**
 * Test Evolution Page
 * Track test health, coverage evolution, stale tests, and risk scoring
 */

import { useState, useCallback } from 'react';
import { useProjectStore } from '../stores/project';
import { api } from '../services/api';
import { Card, Button } from '../components/ui';
import {
  AlertTriangle,
  AlertCircle, Copy, Check, ChevronDown, ChevronRight,
  Upload, Trash2, TrendingUp, TrendingDown, Minus,
  BarChart3, Target, Lightbulb, Heart, Clock,
  Shield, RefreshCw,
} from 'lucide-react';

type TabType = 'health' | 'coverage' | 'stale' | 'risk';

// Types for test evolution
type HealthStatus = 'healthy' | 'warning' | 'critical';
type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
type TestStatus = 'passed' | 'failed' | 'skipped' | 'flaky';

interface TestData {
  id: string;
  name: string;
  file: string;
  suite?: string;
  status?: TestStatus;
  duration?: number;
  lastRun?: string;
  createdAt?: string;
  updatedAt?: string;
  tags?: string[];
}

interface ExecutionHistory {
  testId: string;
  timestamp: string;
  status: TestStatus;
  duration: number;
  error?: string;
}

interface CoverageData {
  file: string;
  lines: { covered: number; total: number };
  branches: { covered: number; total: number };
  functions: { covered: number; total: number };
  statements: { covered: number; total: number };
}

interface TestHealthOutput {
  overall: {
    status: HealthStatus;
    score: number;
    totalTests: number;
    passingTests: number;
    failingTests: number;
    flakyTests: number;
    skippedTests: number;
  };
  metrics: {
    passRate: number;
    avgDuration: number;
    flakyRate: number;
    reliability: number;
    mttr: string; // Mean Time To Repair
  };
  trends: {
    passRateTrend: 'improving' | 'stable' | 'declining';
    durationTrend: 'improving' | 'stable' | 'declining';
    flakyTrend: 'improving' | 'stable' | 'declining';
  };
  problemTests: Array<{
    id: string;
    name: string;
    issue: string;
    severity: RiskLevel;
    suggestion: string;
  }>;
  flakyTests: Array<{
    id: string;
    name: string;
    flakyRate: number;
    recentResults: TestStatus[];
    possibleCauses: string[];
  }>;
  recommendations: string[];
}

interface CoverageEvolutionOutput {
  current: {
    overall: number;
    lines: number;
    branches: number;
    functions: number;
    statements: number;
  };
  history: Array<{
    date: string;
    overall: number;
    lines: number;
    branches: number;
  }>;
  changes: {
    trend: 'improving' | 'stable' | 'declining';
    weeklyChange: number;
    monthlyChange: number;
  };
  uncoveredAreas: Array<{
    file: string;
    coverage: number;
    uncoveredLines: number[];
    priority: RiskLevel;
    reason: string;
  }>;
  goals: {
    target: number;
    current: number;
    gap: number;
    estimatedEffort: string;
    suggestedFiles: string[];
  };
  recommendations: string[];
}

interface StaleTestsOutput {
  summary: {
    totalStale: number;
    totalTests: number;
    stalePercentage: number;
    averageAge: string;
  };
  staleTests: Array<{
    id: string;
    name: string;
    file: string;
    lastModified: string;
    lastRun?: string;
    age: string;
    reason: string;
    action: 'update' | 'delete' | 'review';
    priority: RiskLevel;
    relatedCode?: string[];
  }>;
  categories: {
    outdatedAssertions: number;
    deadCode: number;
    missingCoverage: number;
    duplicates: number;
    orphaned: number;
  };
  impact: {
    maintenanceCost: string;
    falsePositiveRisk: number;
    coverageImpact: number;
  };
  recommendations: string[];
}

interface RiskScoringOutput {
  overall: {
    riskScore: number;
    riskLevel: RiskLevel;
    summary: string;
  };
  dimensions: {
    coverage: { score: number; weight: number; issues: string[] };
    stability: { score: number; weight: number; issues: string[] };
    complexity: { score: number; weight: number; issues: string[] };
    freshness: { score: number; weight: number; issues: string[] };
    maintainability: { score: number; weight: number; issues: string[] };
  };
  riskAreas: Array<{
    area: string;
    riskScore: number;
    riskLevel: RiskLevel;
    factors: string[];
    impact: string;
    mitigation: string;
  }>;
  prioritizedActions: Array<{
    action: string;
    impact: number;
    effort: 'low' | 'medium' | 'high';
    priority: number;
  }>;
  trends: {
    direction: 'improving' | 'stable' | 'worsening';
    weeklyChange: number;
    riskHistory: Array<{ date: string; score: number }>;
  };
  recommendations: string[];
}

// Color mappings
const healthColors: Record<HealthStatus, string> = {
  healthy: 'bg-green-100 text-green-700 border-green-200',
  warning: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  critical: 'bg-red-100 text-red-700 border-red-200',
};

const riskColors: Record<RiskLevel, string> = {
  low: 'bg-green-100 text-green-700 border-green-200',
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  high: 'bg-orange-100 text-orange-700 border-orange-200',
  critical: 'bg-red-100 text-red-700 border-red-200',
};

const statusColors: Record<TestStatus, string> = {
  passed: 'bg-green-500',
  failed: 'bg-red-500',
  skipped: 'bg-gray-400',
  flaky: 'bg-yellow-500',
};

const actionColors: Record<string, string> = {
  update: 'bg-blue-100 text-blue-700',
  delete: 'bg-red-100 text-red-700',
  review: 'bg-yellow-100 text-yellow-700',
};

export function TestEvolutionPage() {
  const { currentProject } = useProjectStore();
  const [activeTab, setActiveTab] = useState<TabType>('health');

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
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
            <RefreshCw className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Test Evolution</h1>
            <p className="text-sm text-gray-500">Track test health, coverage, stale tests, and risk scoring</p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab('health')}
            className={`flex items-center gap-2 py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
              activeTab === 'health'
                ? 'border-purple-500 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Heart className="w-4 h-4" />
            Test Health
          </button>
          <button
            onClick={() => setActiveTab('coverage')}
            className={`flex items-center gap-2 py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
              activeTab === 'coverage'
                ? 'border-purple-500 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Coverage Evolution
          </button>
          <button
            onClick={() => setActiveTab('stale')}
            className={`flex items-center gap-2 py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
              activeTab === 'stale'
                ? 'border-purple-500 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Clock className="w-4 h-4" />
            Stale Tests
          </button>
          <button
            onClick={() => setActiveTab('risk')}
            className={`flex items-center gap-2 py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
              activeTab === 'risk'
                ? 'border-purple-500 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            Risk Scoring
          </button>
        </nav>
      </div>

      {activeTab === 'health' && <TestHealthPanel projectId={currentProject.id} />}
      {activeTab === 'coverage' && <CoverageEvolutionPanel projectId={currentProject.id} />}
      {activeTab === 'stale' && <StaleTestsPanel projectId={currentProject.id} />}
      {activeTab === 'risk' && <RiskScoringPanel projectId={currentProject.id} />}
    </div>
  );
}

// JSON Input Component
function JsonInput({
  value,
  onChange,
  onClear,
  label,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  label: string;
  placeholder: string;
}) {
  const fileInputRef = { current: null as HTMLInputElement | null };

  const handleFileUpload = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      onChange(content);
    };
    reader.readAsText(file);
  }, [onChange]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file && file.name.endsWith('.json')) {
        handleFileUpload(file);
      }
    },
    [handleFileUpload]
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">
          {label}
        </label>
        {value && (
          <button
            onClick={onClear}
            className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
          >
            <Trash2 className="w-3 h-3" />
            Clear
          </button>
        )}
      </div>

      {!value ? (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-purple-400 transition-colors"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="w-10 h-10 mx-auto text-gray-400 mb-2" />
          <p className="text-sm text-gray-600">Drag & drop JSON file or click to upload</p>
          <p className="text-xs text-gray-400 mt-1">Or paste JSON below</p>
          <input
            ref={(el) => { fileInputRef.current = el; }}
            type="file"
            accept=".json"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
          />
        </div>
      ) : null}

      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={value ? '' : placeholder}
        className="w-full h-48 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-500"
      />
    </div>
  );
}

// Risk Badge Component
function RiskBadge({ level }: { level: RiskLevel }) {
  return (
    <span className={`px-2 py-1 rounded text-xs font-medium border ${riskColors[level]}`}>
      {level}
    </span>
  );
}

// Trend Indicator Component
function TrendIndicator({ trend, type = 'default' }: { trend: 'improving' | 'stable' | 'declining' | 'worsening'; type?: 'default' | 'inverse' }) {
  const isPositive = type === 'inverse'
    ? (trend === 'declining' || trend === 'worsening')
    : (trend === 'improving');
  const isNegative = type === 'inverse'
    ? (trend === 'improving')
    : (trend === 'declining' || trend === 'worsening');

  if (isPositive) {
    return <TrendingUp className="w-4 h-4 text-green-500" />;
  }
  if (isNegative) {
    return <TrendingDown className="w-4 h-4 text-red-500" />;
  }
  return <Minus className="w-4 h-4 text-gray-400" />;
}

// Score Indicator Component
function ScoreIndicator({ score, label, size = 'default' }: { score: number; label?: string; size?: 'default' | 'small' }) {
  const color = score >= 80 ? 'text-green-500' : score >= 60 ? 'text-yellow-500' : 'text-red-500';
  const dimensions = size === 'small' ? 'w-10 h-10' : 'w-12 h-12';
  const radius = size === 'small' ? 16 : 20;
  const center = size === 'small' ? 20 : 24;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="flex items-center gap-2">
      <div className={`relative ${dimensions}`}>
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx={center}
            cy={center}
            r={radius}
            stroke="currentColor"
            strokeWidth="4"
            fill="none"
            className="text-gray-200"
          />
          <circle
            cx={center}
            cy={center}
            r={radius}
            stroke="currentColor"
            strokeWidth="4"
            fill="none"
            strokeDasharray={`${(score / 100) * circumference} ${circumference}`}
            className={color}
          />
        </svg>
        <span className={`absolute inset-0 flex items-center justify-center ${size === 'small' ? 'text-xs' : 'text-xs'} font-bold`}>
          {score}
        </span>
      </div>
      {label && <div className="text-xs text-gray-600">{label}</div>}
    </div>
  );
}

// Copy Button Component
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
      title="Copy to clipboard"
    >
      {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
    </button>
  );
}

// ============================================================================
// Test Health Panel
// ============================================================================

function TestHealthPanel({ projectId }: { projectId: string }) {
  const [testsJson, setTestsJson] = useState('');
  const [historyJson, setHistoryJson] = useState('');
  const [includeFlaky, setIncludeFlaky] = useState(true);
  const [timeWindow, setTimeWindow] = useState(30);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TestHealthOutput | null>(null);
  const [error, setError] = useState('');

  const handleAnalyze = async () => {
    if (!testsJson.trim()) {
      setError('Please provide tests JSON');
      return;
    }

    let tests: TestData[];
    let history: ExecutionHistory[] | undefined;

    try {
      tests = JSON.parse(testsJson);
    } catch {
      setError('Invalid tests JSON format');
      return;
    }

    if (historyJson.trim()) {
      try {
        history = JSON.parse(historyJson);
      } catch {
        setError('Invalid execution history JSON format');
        return;
      }
    }

    setLoading(true);
    setError('');
    try {
      const response = await api.post<{ data: TestHealthOutput }>('/test-evolution/health', {
        projectId,
        tests,
        history,
        options: {
          includeFlaky,
          timeWindow,
        },
      });
      setResult(response.data.data);
    } catch (err) {
      setError('Failed to analyze test health');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Input Panel */}
      <Card title="Test Health Analysis">
        <div className="space-y-4">
          <JsonInput
            value={testsJson}
            onChange={setTestsJson}
            onClear={() => setTestsJson('')}
            label="Tests JSON"
            placeholder='[{"id": "test-1", "name": "should login", "file": "auth.test.ts", "status": "passed", "duration": 150}]'
          />

          <JsonInput
            value={historyJson}
            onChange={setHistoryJson}
            onClear={() => setHistoryJson('')}
            label="Execution History JSON (optional)"
            placeholder='[{"testId": "test-1", "timestamp": "2024-01-15", "status": "passed", "duration": 150}]'
          />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Time Window (days)
              </label>
              <input
                type="number"
                min={7}
                max={90}
                value={timeWindow}
                onChange={(e) => setTimeWindow(parseInt(e.target.value) || 30)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={includeFlaky}
                  onChange={(e) => setIncludeFlaky(e.target.checked)}
                  className="rounded border-gray-300 text-purple-500 focus:ring-purple-500"
                />
                <span className="text-sm text-gray-700">Analyze flaky tests</span>
              </label>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          <Button
            onClick={handleAnalyze}
            isLoading={loading}
            disabled={!testsJson.trim()}
            className="w-full bg-purple-600 hover:bg-purple-700"
          >
            <Heart className="w-4 h-4 mr-2" />
            Analyze Test Health
          </Button>
        </div>
      </Card>

      {/* Output Panel */}
      <Card title="Health Results">
        {result ? (
          <div className="space-y-4 max-h-[600px] overflow-auto">
            {/* Overall Health */}
            <div className={`p-4 rounded-lg ${healthColors[result.overall.status]}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Heart className="w-5 h-5" />
                  <span className="text-lg font-bold">Test Suite Health</span>
                </div>
                <ScoreIndicator score={result.overall.score} />
              </div>
              <div className="grid grid-cols-5 gap-2">
                <div className="text-center">
                  <p className="text-xl font-bold">{result.overall.totalTests}</p>
                  <p className="text-xs">Total</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-green-700">{result.overall.passingTests}</p>
                  <p className="text-xs">Passing</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-red-700">{result.overall.failingTests}</p>
                  <p className="text-xs">Failing</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-yellow-700">{result.overall.flakyTests}</p>
                  <p className="text-xs">Flaky</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-gray-600">{result.overall.skippedTests}</p>
                  <p className="text-xs">Skipped</p>
                </div>
              </div>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-3 gap-2">
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-500">Pass Rate</p>
                  <TrendIndicator trend={result.trends.passRateTrend} />
                </div>
                <p className="text-xl font-bold text-gray-900">{result.metrics.passRate}%</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-500">Avg Duration</p>
                  <TrendIndicator trend={result.trends.durationTrend} type="inverse" />
                </div>
                <p className="text-xl font-bold text-gray-900">{result.metrics.avgDuration}ms</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-500">Reliability</p>
                  <span className="text-xs text-gray-500">MTTR: {result.metrics.mttr}</span>
                </div>
                <p className="text-xl font-bold text-gray-900">{result.metrics.reliability}%</p>
              </div>
            </div>

            {/* Flaky Tests */}
            {result.flakyTests.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase mb-2">Flaky Tests</p>
                <div className="space-y-2">
                  {result.flakyTests.map((test, i) => (
                    <FlakyTestCard key={i} test={test} />
                  ))}
                </div>
              </div>
            )}

            {/* Problem Tests */}
            {result.problemTests.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase mb-2">Problem Tests</p>
                <div className="space-y-2">
                  {result.problemTests.map((test, i) => (
                    <div key={i} className="p-3 bg-red-50 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium">{test.name}</span>
                        <RiskBadge level={test.severity} />
                      </div>
                      <p className="text-xs text-gray-700">{test.issue}</p>
                      <p className="text-xs text-green-700 mt-1">{test.suggestion}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recommendations */}
            {result.recommendations.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase mb-2">Recommendations</p>
                <ul className="space-y-1">
                  {result.recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <Lightbulb className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Copy JSON */}
            <div className="flex justify-end pt-2 border-t border-gray-200">
              <div className="flex items-center gap-1 text-sm text-gray-500">
                <span>Copy results</span>
                <CopyButton text={JSON.stringify(result, null, 2)} />
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-16 text-gray-500">
            <Heart className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>Test health results will appear here</p>
            <p className="text-sm mt-1">Provide test data and analyze</p>
          </div>
        )}
      </Card>
    </div>
  );
}

function FlakyTestCard({ test }: { test: TestHealthOutput['flakyTests'][0] }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-yellow-200 rounded-lg bg-yellow-50">
      <div
        className="flex items-center gap-2 p-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <button className="text-gray-400">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{test.name}</p>
        </div>
        <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs font-medium">
          {test.flakyRate}% flaky
        </span>
      </div>

      {expanded && (
        <div className="px-9 pb-3 space-y-3">
          <div>
            <p className="text-xs text-gray-500 mb-1">Recent Results</p>
            <div className="flex gap-1">
              {test.recentResults.map((status, i) => (
                <div key={i} className={`w-4 h-4 rounded ${statusColors[status]}`} title={status} />
              ))}
            </div>
          </div>

          {test.possibleCauses.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-1">Possible Causes</p>
              <ul className="space-y-1">
                {test.possibleCauses.map((cause, i) => (
                  <li key={i} className="text-xs text-gray-600 flex items-start gap-1">
                    <span className="text-yellow-500">-</span> {cause}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Coverage Evolution Panel
// ============================================================================

function CoverageEvolutionPanel({ projectId }: { projectId: string }) {
  const [coverageJson, setCoverageJson] = useState('');
  const [targetCoverage, setTargetCoverage] = useState(80);
  const [includeHistory, setIncludeHistory] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CoverageEvolutionOutput | null>(null);
  const [error, setError] = useState('');

  const handleAnalyze = async () => {
    if (!coverageJson.trim()) {
      setError('Please provide coverage data JSON');
      return;
    }

    let coverageData: CoverageData[];
    try {
      coverageData = JSON.parse(coverageJson);
    } catch {
      setError('Invalid coverage JSON format');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await api.post<{ data: CoverageEvolutionOutput }>('/test-evolution/coverage', {
        projectId,
        coverageData,
        options: {
          targetCoverage,
          includeHistory,
        },
      });
      setResult(response.data.data);
    } catch (err) {
      setError('Failed to analyze coverage evolution');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Input Panel */}
      <Card title="Coverage Evolution Analysis">
        <div className="space-y-4">
          <JsonInput
            value={coverageJson}
            onChange={setCoverageJson}
            onClear={() => setCoverageJson('')}
            label="Coverage Data JSON"
            placeholder='[{"file": "src/utils.ts", "lines": {"covered": 80, "total": 100}, "branches": {"covered": 15, "total": 20}}]'
          />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Target Coverage (%)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={targetCoverage}
                onChange={(e) => setTargetCoverage(parseInt(e.target.value) || 80)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={includeHistory}
                  onChange={(e) => setIncludeHistory(e.target.checked)}
                  className="rounded border-gray-300 text-purple-500 focus:ring-purple-500"
                />
                <span className="text-sm text-gray-700">Include historical data</span>
              </label>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          <Button
            onClick={handleAnalyze}
            isLoading={loading}
            disabled={!coverageJson.trim()}
            className="w-full bg-purple-600 hover:bg-purple-700"
          >
            <BarChart3 className="w-4 h-4 mr-2" />
            Analyze Coverage Evolution
          </Button>
        </div>
      </Card>

      {/* Output Panel */}
      <Card title="Coverage Evolution Results">
        {result ? (
          <div className="space-y-4 max-h-[600px] overflow-auto">
            {/* Current Coverage */}
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium">Current Coverage</span>
                <div className="flex items-center gap-2">
                  <ScoreIndicator score={Math.round(result.current.overall)} />
                  <TrendIndicator trend={result.changes.trend} />
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2">
                <div className="text-center">
                  <p className="text-lg font-bold text-gray-900">{result.current.lines}%</p>
                  <p className="text-xs text-gray-500">Lines</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-gray-900">{result.current.branches}%</p>
                  <p className="text-xs text-gray-500">Branches</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-gray-900">{result.current.functions}%</p>
                  <p className="text-xs text-gray-500">Functions</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-gray-900">{result.current.statements}%</p>
                  <p className="text-xs text-gray-500">Statements</p>
                </div>
              </div>
            </div>

            {/* Changes */}
            <div className="grid grid-cols-2 gap-4">
              <div className={`p-3 rounded-lg ${result.changes.weeklyChange >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                <p className="text-xs text-gray-500">Weekly Change</p>
                <p className={`text-lg font-bold ${result.changes.weeklyChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {result.changes.weeklyChange >= 0 ? '+' : ''}{result.changes.weeklyChange}%
                </p>
              </div>
              <div className={`p-3 rounded-lg ${result.changes.monthlyChange >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                <p className="text-xs text-gray-500">Monthly Change</p>
                <p className={`text-lg font-bold ${result.changes.monthlyChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {result.changes.monthlyChange >= 0 ? '+' : ''}{result.changes.monthlyChange}%
                </p>
              </div>
            </div>

            {/* Goals */}
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-xs font-medium text-gray-500 uppercase mb-2">Coverage Goal</p>
              <div className="flex items-center gap-2 mb-2">
                <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500"
                    style={{ width: `${(result.goals.current / result.goals.target) * 100}%` }}
                  />
                </div>
                <span className="text-sm font-medium">{result.goals.current}% / {result.goals.target}%</span>
              </div>
              <p className="text-xs text-gray-600">
                Gap: {result.goals.gap}% | Estimated effort: {result.goals.estimatedEffort}
              </p>
              {result.goals.suggestedFiles.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs text-gray-500">Priority files:</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {result.goals.suggestedFiles.slice(0, 5).map((file, i) => (
                      <span key={i} className="px-2 py-0.5 bg-white rounded text-xs font-mono">
                        {file}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Uncovered Areas */}
            {result.uncoveredAreas.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase mb-2">Uncovered Areas</p>
                <div className="space-y-2">
                  {result.uncoveredAreas.map((area, i) => (
                    <div key={i} className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium font-mono">{area.file}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">{area.coverage}%</span>
                          <RiskBadge level={area.priority} />
                        </div>
                      </div>
                      <p className="text-xs text-gray-600">{area.reason}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        Uncovered lines: {area.uncoveredLines.slice(0, 5).join(', ')}
                        {area.uncoveredLines.length > 5 && ` +${area.uncoveredLines.length - 5} more`}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recommendations */}
            {result.recommendations.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase mb-2">Recommendations</p>
                <ul className="space-y-1">
                  {result.recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <Target className="w-4 h-4 text-purple-500 flex-shrink-0 mt-0.5" />
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Copy JSON */}
            <div className="flex justify-end pt-2 border-t border-gray-200">
              <div className="flex items-center gap-1 text-sm text-gray-500">
                <span>Copy results</span>
                <CopyButton text={JSON.stringify(result, null, 2)} />
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-16 text-gray-500">
            <BarChart3 className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>Coverage evolution results will appear here</p>
            <p className="text-sm mt-1">Provide coverage data and analyze</p>
          </div>
        )}
      </Card>
    </div>
  );
}

// ============================================================================
// Stale Tests Panel
// ============================================================================

function StaleTestsPanel({ projectId }: { projectId: string }) {
  const [testsJson, setTestsJson] = useState('');
  const [staleThreshold, setStaleThreshold] = useState(90);
  const [includeOrphans, setIncludeOrphans] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<StaleTestsOutput | null>(null);
  const [error, setError] = useState('');

  const handleAnalyze = async () => {
    if (!testsJson.trim()) {
      setError('Please provide tests JSON');
      return;
    }

    let tests: TestData[];
    try {
      tests = JSON.parse(testsJson);
    } catch {
      setError('Invalid tests JSON format');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await api.post<{ data: StaleTestsOutput }>('/test-evolution/stale', {
        projectId,
        tests,
        options: {
          staleThreshold,
          includeOrphans,
        },
      });
      setResult(response.data.data);
    } catch (err) {
      setError('Failed to analyze stale tests');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Input Panel */}
      <Card title="Stale Tests Analysis">
        <div className="space-y-4">
          <JsonInput
            value={testsJson}
            onChange={setTestsJson}
            onClear={() => setTestsJson('')}
            label="Tests JSON"
            placeholder='[{"id": "test-1", "name": "should login", "file": "auth.test.ts", "lastModified": "2023-06-15", "lastRun": "2023-09-01"}]'
          />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Stale Threshold (days)
              </label>
              <input
                type="number"
                min={30}
                max={365}
                value={staleThreshold}
                onChange={(e) => setStaleThreshold(parseInt(e.target.value) || 90)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={includeOrphans}
                  onChange={(e) => setIncludeOrphans(e.target.checked)}
                  className="rounded border-gray-300 text-purple-500 focus:ring-purple-500"
                />
                <span className="text-sm text-gray-700">Include orphaned tests</span>
              </label>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          <Button
            onClick={handleAnalyze}
            isLoading={loading}
            disabled={!testsJson.trim()}
            className="w-full bg-purple-600 hover:bg-purple-700"
          >
            <Clock className="w-4 h-4 mr-2" />
            Find Stale Tests
          </Button>
        </div>
      </Card>

      {/* Output Panel */}
      <Card title="Stale Tests Results">
        {result ? (
          <div className="space-y-4 max-h-[600px] overflow-auto">
            {/* Summary */}
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="grid grid-cols-4 gap-2 text-center">
                <div>
                  <p className="text-2xl font-bold text-orange-600">{result.summary.totalStale}</p>
                  <p className="text-xs text-gray-500">Stale Tests</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{result.summary.totalTests}</p>
                  <p className="text-xs text-gray-500">Total Tests</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-yellow-600">{result.summary.stalePercentage}%</p>
                  <p className="text-xs text-gray-500">Stale Rate</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-gray-600">{result.summary.averageAge}</p>
                  <p className="text-xs text-gray-500">Avg Age</p>
                </div>
              </div>
            </div>

            {/* Categories */}
            <div className="grid grid-cols-5 gap-2">
              <div className="p-2 bg-yellow-50 rounded-lg text-center">
                <p className="text-lg font-bold text-yellow-700">{result.categories.outdatedAssertions}</p>
                <p className="text-xs text-gray-600">Outdated</p>
              </div>
              <div className="p-2 bg-red-50 rounded-lg text-center">
                <p className="text-lg font-bold text-red-700">{result.categories.deadCode}</p>
                <p className="text-xs text-gray-600">Dead Code</p>
              </div>
              <div className="p-2 bg-blue-50 rounded-lg text-center">
                <p className="text-lg font-bold text-blue-700">{result.categories.missingCoverage}</p>
                <p className="text-xs text-gray-600">Missing</p>
              </div>
              <div className="p-2 bg-purple-50 rounded-lg text-center">
                <p className="text-lg font-bold text-purple-700">{result.categories.duplicates}</p>
                <p className="text-xs text-gray-600">Duplicates</p>
              </div>
              <div className="p-2 bg-gray-100 rounded-lg text-center">
                <p className="text-lg font-bold text-gray-700">{result.categories.orphaned}</p>
                <p className="text-xs text-gray-600">Orphaned</p>
              </div>
            </div>

            {/* Impact */}
            <div className="p-4 bg-orange-50 rounded-lg">
              <p className="text-xs font-medium text-gray-500 uppercase mb-2">Impact Analysis</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-sm font-bold text-orange-700">{result.impact.maintenanceCost}</p>
                  <p className="text-xs text-gray-600">Maintenance Cost</p>
                </div>
                <div>
                  <p className="text-sm font-bold text-red-700">{result.impact.falsePositiveRisk}%</p>
                  <p className="text-xs text-gray-600">False Positive Risk</p>
                </div>
                <div>
                  <p className="text-sm font-bold text-blue-700">{result.impact.coverageImpact}%</p>
                  <p className="text-xs text-gray-600">Coverage Impact</p>
                </div>
              </div>
            </div>

            {/* Stale Tests List */}
            {result.staleTests.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase mb-2">Stale Tests</p>
                <div className="space-y-2">
                  {result.staleTests.slice(0, 10).map((test, i) => (
                    <StaleTestCard key={i} test={test} />
                  ))}
                  {result.staleTests.length > 10 && (
                    <p className="text-xs text-gray-500 text-center">
                      +{result.staleTests.length - 10} more stale tests
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Recommendations */}
            {result.recommendations.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase mb-2">Recommendations</p>
                <ul className="space-y-1">
                  {result.recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <Target className="w-4 h-4 text-purple-500 flex-shrink-0 mt-0.5" />
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Copy JSON */}
            <div className="flex justify-end pt-2 border-t border-gray-200">
              <div className="flex items-center gap-1 text-sm text-gray-500">
                <span>Copy results</span>
                <CopyButton text={JSON.stringify(result, null, 2)} />
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-16 text-gray-500">
            <Clock className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>Stale tests analysis will appear here</p>
            <p className="text-sm mt-1">Provide test data and analyze</p>
          </div>
        )}
      </Card>
    </div>
  );
}

function StaleTestCard({ test }: { test: StaleTestsOutput['staleTests'][0] }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-gray-200 rounded-lg bg-gray-50">
      <div
        className="flex items-center gap-2 p-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <button className="text-gray-400">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{test.name}</p>
          <p className="text-xs text-gray-500">{test.file}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${actionColors[test.action]}`}>
            {test.action}
          </span>
          <RiskBadge level={test.priority} />
        </div>
      </div>

      {expanded && (
        <div className="px-9 pb-3 space-y-3 border-t border-gray-200 pt-3">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2 bg-white rounded">
              <p className="text-gray-500">Last Modified</p>
              <p className="font-medium">{test.lastModified}</p>
            </div>
            <div className="p-2 bg-white rounded">
              <p className="text-gray-500">Age</p>
              <p className="font-medium">{test.age}</p>
            </div>
          </div>

          <div>
            <p className="text-xs text-gray-500 mb-1">Reason</p>
            <p className="text-xs text-gray-700">{test.reason}</p>
          </div>

          {test.relatedCode && test.relatedCode.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-1">Related Code</p>
              <div className="flex flex-wrap gap-1">
                {test.relatedCode.map((code, i) => (
                  <span key={i} className="px-2 py-0.5 bg-white rounded text-xs font-mono">
                    {code}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Risk Scoring Panel
// ============================================================================

function RiskScoringPanel({ projectId }: { projectId: string }) {
  const [testsJson, setTestsJson] = useState('');
  const [coverageJson, setCoverageJson] = useState('');
  const [historyJson, setHistoryJson] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RiskScoringOutput | null>(null);
  const [error, setError] = useState('');

  const handleAnalyze = async () => {
    if (!testsJson.trim()) {
      setError('Please provide tests JSON');
      return;
    }

    let tests: TestData[];
    let coverageData: CoverageData[] | undefined;
    let history: ExecutionHistory[] | undefined;

    try {
      tests = JSON.parse(testsJson);
    } catch {
      setError('Invalid tests JSON format');
      return;
    }

    if (coverageJson.trim()) {
      try {
        coverageData = JSON.parse(coverageJson);
      } catch {
        setError('Invalid coverage JSON format');
        return;
      }
    }

    if (historyJson.trim()) {
      try {
        history = JSON.parse(historyJson);
      } catch {
        setError('Invalid history JSON format');
        return;
      }
    }

    setLoading(true);
    setError('');
    try {
      const response = await api.post<{ data: RiskScoringOutput }>('/test-evolution/risk', {
        projectId,
        tests,
        coverageData,
        history,
      });
      setResult(response.data.data);
    } catch (err) {
      setError('Failed to calculate risk scores');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Input Panel */}
      <Card title="Risk Scoring Analysis">
        <div className="space-y-4">
          <JsonInput
            value={testsJson}
            onChange={setTestsJson}
            onClear={() => setTestsJson('')}
            label="Tests JSON *"
            placeholder='[{"id": "test-1", "name": "should login", "file": "auth.test.ts", "status": "passed"}]'
          />

          <JsonInput
            value={coverageJson}
            onChange={setCoverageJson}
            onClear={() => setCoverageJson('')}
            label="Coverage Data JSON (optional)"
            placeholder='[{"file": "src/utils.ts", "lines": {"covered": 80, "total": 100}}]'
          />

          <JsonInput
            value={historyJson}
            onChange={setHistoryJson}
            onClear={() => setHistoryJson('')}
            label="Execution History JSON (optional)"
            placeholder='[{"testId": "test-1", "timestamp": "2024-01-15", "status": "passed", "duration": 150}]'
          />

          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          <Button
            onClick={handleAnalyze}
            isLoading={loading}
            disabled={!testsJson.trim()}
            className="w-full bg-purple-600 hover:bg-purple-700"
          >
            <AlertTriangle className="w-4 h-4 mr-2" />
            Calculate Risk Scores
          </Button>
        </div>
      </Card>

      {/* Output Panel */}
      <Card title="Risk Scoring Results">
        {result ? (
          <div className="space-y-4 max-h-[600px] overflow-auto">
            {/* Overall Risk */}
            <div className={`p-4 rounded-lg ${riskColors[result.overall.riskLevel]}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  <span className="text-lg font-bold">Overall Risk</span>
                </div>
                <div className="flex items-center gap-2">
                  <ScoreIndicator score={100 - result.overall.riskScore} label="" />
                  <TrendIndicator trend={result.trends.direction} type="inverse" />
                </div>
              </div>
              <p className="text-sm">{result.overall.summary}</p>
            </div>

            {/* Risk Dimensions */}
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase mb-2">Risk Dimensions</p>
              <div className="space-y-2">
                {Object.entries(result.dimensions).map(([key, dim]) => (
                  <div key={key} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium capitalize">{key}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">Weight: {dim.weight}%</span>
                        <ScoreIndicator score={dim.score} size="small" />
                      </div>
                    </div>
                    {dim.issues.length > 0 && (
                      <ul className="space-y-1">
                        {dim.issues.map((issue, i) => (
                          <li key={i} className="text-xs text-gray-600 flex items-start gap-1">
                            <span className="text-red-400">-</span> {issue}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Risk Areas */}
            {result.riskAreas.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase mb-2">Risk Areas</p>
                <div className="space-y-2">
                  {result.riskAreas.map((area, i) => (
                    <div key={i} className="p-3 bg-orange-50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">{area.area}</span>
                        <RiskBadge level={area.riskLevel} />
                      </div>
                      <div className="flex flex-wrap gap-1 mb-2">
                        {area.factors.map((factor, j) => (
                          <span key={j} className="px-2 py-0.5 bg-white rounded text-xs">
                            {factor}
                          </span>
                        ))}
                      </div>
                      <p className="text-xs text-gray-700 mb-1"><strong>Impact:</strong> {area.impact}</p>
                      <p className="text-xs text-green-700"><strong>Mitigation:</strong> {area.mitigation}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Prioritized Actions */}
            {result.prioritizedActions.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase mb-2">Prioritized Actions</p>
                <div className="space-y-2">
                  {result.prioritizedActions.map((action, i) => (
                    <div key={i} className="p-3 bg-blue-50 rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                          Priority #{action.priority}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          action.effort === 'low' ? 'bg-green-100 text-green-700' :
                          action.effort === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {action.effort} effort
                        </span>
                      </div>
                      <p className="text-sm font-medium">{action.action}</p>
                      <p className="text-xs text-gray-500 mt-1">Impact: -{action.impact}% risk</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recommendations */}
            {result.recommendations.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase mb-2">Recommendations</p>
                <ul className="space-y-1">
                  {result.recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <Shield className="w-4 h-4 text-purple-500 flex-shrink-0 mt-0.5" />
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Copy JSON */}
            <div className="flex justify-end pt-2 border-t border-gray-200">
              <div className="flex items-center gap-1 text-sm text-gray-500">
                <span>Copy results</span>
                <CopyButton text={JSON.stringify(result, null, 2)} />
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-16 text-gray-500">
            <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>Risk scoring results will appear here</p>
            <p className="text-sm mt-1">Provide test data and analyze</p>
          </div>
        )}
      </Card>
    </div>
  );
}

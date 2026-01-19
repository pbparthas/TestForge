/**
 * Bug Patterns Page
 * Analyze bug patterns, find root causes, predict bug-prone areas
 */

import { useState, useCallback } from 'react';
import { useProjectStore } from '../stores/project';
import { api } from '../services/api';
import { Card, Button } from '../components/ui';
import {
  Bug, Search, AlertTriangle, FileText, Layers,
  AlertCircle, Copy, Check, ChevronDown, ChevronRight,
  Upload, Trash2, TrendingUp, TrendingDown, Minus,
  BarChart3, Target, Lightbulb,
} from 'lucide-react';

type TabType = 'patterns' | 'rootcause' | 'predictions' | 'report' | 'cluster';

// Types from bugpattern agent
type BugSeverity = 'critical' | 'high' | 'medium' | 'low';
type BugStatus = 'open' | 'in_progress' | 'resolved' | 'closed' | 'wontfix';

interface BugData {
  id: string;
  title: string;
  description: string;
  status: BugStatus;
  severity: BugSeverity;
  component: string;
  stackTrace?: string;
  steps?: string[];
  environment?: {
    os?: string;
    browser?: string;
    version?: string;
    device?: string;
  };
  createdAt: string;
  labels?: string[];
  assignee?: string;
  reporter?: string;
}

interface TestFailure {
  testId: string;
  name: string;
  error: string;
  stackTrace?: string;
  duration: number;
  retries: number;
  file?: string;
  line?: number;
}

interface CodeChange {
  file: string;
  additions: number;
  deletions: number;
  author: string;
  date: string;
  commitMessage: string;
  commitHash?: string;
  filesChanged?: string[];
}

interface PatternAnalysisOutput {
  patterns: Array<{
    id: string;
    name: string;
    description: string;
    frequency: number;
    affectedComponents: string[];
    examples: string[];
    severity: BugSeverity;
    trend: 'increasing' | 'stable' | 'decreasing';
  }>;
  categories: Array<{
    name: string;
    count: number;
    percentage: number;
    bugs: string[];
  }>;
  correlations: Array<{
    factor1: string;
    factor2: string;
    strength: number;
    explanation: string;
  }>;
  severityDistribution: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  trends: {
    totalBugs: number;
    openBugs: number;
    avgResolutionTime: string;
    hotspotComponents: string[];
    recentSpike: boolean;
    spikeReason?: string;
  };
  insights: string[];
  recommendations: string[];
}

interface RootCauseOutput {
  rootCause: {
    type: string;
    description: string;
    confidence: number;
    evidence: string[];
  };
  contributing_factors: Array<{
    factor: string;
    impact: 'high' | 'medium' | 'low';
    explanation: string;
  }>;
  suggestedFix: {
    description: string;
    steps: string[];
    complexity: 'trivial' | 'simple' | 'moderate' | 'complex';
    estimatedEffort: string;
  };
  relatedBugs: string[];
  preventionStrategies: string[];
}

interface BugPredictionOutput {
  predictions: Array<{
    file: string;
    riskScore: number;
    riskLevel: BugSeverity;
    reasons: string[];
    historicalBugCount: number;
    recentChangeVelocity: number;
    recommendations: string[];
  }>;
  overallRisk: {
    score: number;
    level: BugSeverity;
    summary: string;
  };
  hotspots: Array<{
    area: string;
    risk: number;
    topContributors: string[];
  }>;
  suggestedTestFocus: string[];
  mitigationStrategies: string[];
}

interface BugReportOutput {
  executiveSummary: {
    totalBugs: number;
    openBugs: number;
    criticalBugs: number;
    avgAge: string;
    healthScore: number;
    healthStatus: 'healthy' | 'warning' | 'critical';
    keyFindings: string[];
  };
  charts: {
    severityBreakdown: Array<{ label: string; value: number }>;
    statusBreakdown: Array<{ label: string; value: number }>;
    componentBreakdown: Array<{ label: string; value: number }>;
    trendOverTime: Array<{ date: string; opened: number; closed: number }>;
    topAuthors: Array<{ author: string; bugs: number }>;
  };
  topIssues: Array<{
    id: string;
    title: string;
    severity: string;
    age: string;
    impact: string;
  }>;
  recommendations: Array<{
    priority: 'high' | 'medium' | 'low';
    action: string;
    expectedImpact: string;
    effort: string;
  }>;
  reportDate: string;
}

interface BugClusterOutput {
  clusters: Array<{
    id: string;
    name: string;
    theme: string;
    bugs: string[];
    size: number;
    avgSeverity: number;
    commonCharacteristics: string[];
    suggestedPriority: BugSeverity;
    triageRecommendation: string;
  }>;
  similarityMatrix: Array<{
    bug1: string;
    bug2: string;
    similarity: number;
    sharedAttributes: string[];
  }>;
  outliers: Array<{
    bugId: string;
    reason: string;
    specialAttention: boolean;
  }>;
  triageOrder: string[];
  insights: string[];
}

// Severity badge colors
const severityColors: Record<BugSeverity, string> = {
  critical: 'bg-red-100 text-red-700 border-red-200',
  high: 'bg-orange-100 text-orange-700 border-orange-200',
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  low: 'bg-gray-100 text-gray-700 border-gray-200',
};

const severityBgColors: Record<BugSeverity, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-gray-400',
};

// Health status colors
const healthColors: Record<string, string> = {
  healthy: 'text-green-600 bg-green-100',
  warning: 'text-yellow-600 bg-yellow-100',
  critical: 'text-red-600 bg-red-100',
};

// Impact colors
const impactColors: Record<string, string> = {
  high: 'text-red-600',
  medium: 'text-yellow-600',
  low: 'text-gray-600',
};

export function BugPatternsPage() {
  const { currentProject } = useProjectStore();
  const [activeTab, setActiveTab] = useState<TabType>('patterns');

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
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center">
            <Bug className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Bug Pattern Analyzer</h1>
            <p className="text-sm text-gray-500">Analyze patterns, find root causes, predict bug-prone areas</p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab('patterns')}
            className={`flex items-center gap-2 py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
              activeTab === 'patterns'
                ? 'border-red-500 text-red-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Patterns
          </button>
          <button
            onClick={() => setActiveTab('rootcause')}
            className={`flex items-center gap-2 py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
              activeTab === 'rootcause'
                ? 'border-red-500 text-red-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Search className="w-4 h-4" />
            Root Cause
          </button>
          <button
            onClick={() => setActiveTab('predictions')}
            className={`flex items-center gap-2 py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
              activeTab === 'predictions'
                ? 'border-red-500 text-red-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            Predictions
          </button>
          <button
            onClick={() => setActiveTab('report')}
            className={`flex items-center gap-2 py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
              activeTab === 'report'
                ? 'border-red-500 text-red-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <FileText className="w-4 h-4" />
            Report
          </button>
          <button
            onClick={() => setActiveTab('cluster')}
            className={`flex items-center gap-2 py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
              activeTab === 'cluster'
                ? 'border-red-500 text-red-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Layers className="w-4 h-4" />
            Cluster
          </button>
        </nav>
      </div>

      {activeTab === 'patterns' && <PatternsPanel projectId={currentProject.id} />}
      {activeTab === 'rootcause' && <RootCausePanel projectId={currentProject.id} />}
      {activeTab === 'predictions' && <PredictionsPanel projectId={currentProject.id} />}
      {activeTab === 'report' && <ReportPanel projectId={currentProject.id} />}
      {activeTab === 'cluster' && <ClusterPanel projectId={currentProject.id} />}
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
          className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-red-400 transition-colors"
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
        className="w-full h-48 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-500"
      />
    </div>
  );
}

// Severity Badge Component
function SeverityBadge({ severity }: { severity: BugSeverity }) {
  return (
    <span className={`px-2 py-1 rounded text-xs font-medium border ${severityColors[severity]}`}>
      {severity}
    </span>
  );
}

// Trend Indicator Component
function TrendIndicator({ trend }: { trend: 'increasing' | 'stable' | 'decreasing' }) {
  if (trend === 'increasing') {
    return <TrendingUp className="w-4 h-4 text-red-500" />;
  }
  if (trend === 'decreasing') {
    return <TrendingDown className="w-4 h-4 text-green-500" />;
  }
  return <Minus className="w-4 h-4 text-gray-400" />;
}

// Confidence Indicator Component
function ConfidenceIndicator({ confidence }: { confidence: number }) {
  const color = confidence >= 80 ? 'bg-green-500' : confidence >= 60 ? 'bg-yellow-500' : 'bg-orange-500';
  return (
    <div className="flex items-center gap-2">
      <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${confidence}%` }} />
      </div>
      <span className="text-xs text-gray-600">{confidence}%</span>
    </div>
  );
}

// Risk Score Component
function RiskScore({ score, level }: { score: number; level: BugSeverity }) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative w-12 h-12">
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx="24"
            cy="24"
            r="20"
            stroke="currentColor"
            strokeWidth="4"
            fill="none"
            className="text-gray-200"
          />
          <circle
            cx="24"
            cy="24"
            r="20"
            stroke="currentColor"
            strokeWidth="4"
            fill="none"
            strokeDasharray={`${(score / 100) * 126} 126`}
            className={level === 'critical' ? 'text-red-500' : level === 'high' ? 'text-orange-500' : level === 'medium' ? 'text-yellow-500' : 'text-green-500'}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">
          {score}
        </span>
      </div>
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
// Patterns Panel
// ============================================================================

function PatternsPanel({ projectId }: { projectId: string }) {
  const [bugsJson, setBugsJson] = useState('');
  const [timeRangeFrom, setTimeRangeFrom] = useState('');
  const [timeRangeTo, setTimeRangeTo] = useState('');
  const [components, setComponents] = useState('');
  const [severities, setSeverities] = useState<BugSeverity[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PatternAnalysisOutput | null>(null);
  const [error, setError] = useState('');

  const handleAnalyze = async () => {
    if (!bugsJson.trim()) {
      setError('Please provide bugs JSON');
      return;
    }

    let parsedBugs: BugData[];
    try {
      parsedBugs = JSON.parse(bugsJson);
    } catch {
      setError('Invalid JSON format');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await api.post<{ data: PatternAnalysisOutput }>('/bug-patterns/analyze', {
        projectId,
        bugs: parsedBugs,
        options: {
          timeRange: timeRangeFrom && timeRangeTo ? { from: timeRangeFrom, to: timeRangeTo } : undefined,
          components: components ? components.split(',').map(c => c.trim()) : undefined,
          severities: severities.length > 0 ? severities : undefined,
        },
      });
      setResult(response.data.data);
    } catch (err) {
      setError('Failed to analyze patterns');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const toggleSeverity = (severity: BugSeverity) => {
    setSeverities(prev =>
      prev.includes(severity)
        ? prev.filter(s => s !== severity)
        : [...prev, severity]
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Input Panel */}
      <Card title="Pattern Analysis">
        <div className="space-y-4">
          <JsonInput
            value={bugsJson}
            onChange={setBugsJson}
            onClear={() => setBugsJson('')}
            label="Bugs JSON"
            placeholder='[{"id": "BUG-001", "title": "Login fails", "description": "...", "status": "open", "severity": "high", "component": "auth", "createdAt": "2024-01-15"}]'
          />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                From Date
              </label>
              <input
                type="date"
                value={timeRangeFrom}
                onChange={(e) => setTimeRangeFrom(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                To Date
              </label>
              <input
                type="date"
                value={timeRangeTo}
                onChange={(e) => setTimeRangeTo(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Components (comma-separated)
            </label>
            <input
              type="text"
              value={components}
              onChange={(e) => setComponents(e.target.value)}
              placeholder="auth, payments, users"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Severity Filter
            </label>
            <div className="flex flex-wrap gap-2">
              {(['critical', 'high', 'medium', 'low'] as BugSeverity[]).map(severity => (
                <button
                  key={severity}
                  onClick={() => toggleSeverity(severity)}
                  className={`px-3 py-1 rounded text-xs font-medium border transition-colors ${
                    severities.includes(severity)
                      ? severityColors[severity]
                      : 'bg-white text-gray-500 border-gray-300 hover:border-gray-400'
                  }`}
                >
                  {severity}
                </button>
              ))}
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
            disabled={!bugsJson.trim()}
            className="w-full bg-red-600 hover:bg-red-700"
          >
            <BarChart3 className="w-4 h-4 mr-2" />
            Analyze Patterns
          </Button>
        </div>
      </Card>

      {/* Output Panel */}
      <Card title="Analysis Results">
        {result ? (
          <div className="space-y-4 max-h-[600px] overflow-auto">
            {/* Severity Distribution */}
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase mb-2">Severity Distribution</p>
              <div className="flex h-8 rounded-lg overflow-hidden">
                {result.severityDistribution.critical > 0 && (
                  <div
                    className="bg-red-500 flex items-center justify-center text-white text-xs font-medium"
                    style={{ width: `${(result.severityDistribution.critical / result.trends.totalBugs) * 100}%` }}
                  >
                    {result.severityDistribution.critical}
                  </div>
                )}
                {result.severityDistribution.high > 0 && (
                  <div
                    className="bg-orange-500 flex items-center justify-center text-white text-xs font-medium"
                    style={{ width: `${(result.severityDistribution.high / result.trends.totalBugs) * 100}%` }}
                  >
                    {result.severityDistribution.high}
                  </div>
                )}
                {result.severityDistribution.medium > 0 && (
                  <div
                    className="bg-yellow-500 flex items-center justify-center text-white text-xs font-medium"
                    style={{ width: `${(result.severityDistribution.medium / result.trends.totalBugs) * 100}%` }}
                  >
                    {result.severityDistribution.medium}
                  </div>
                )}
                {result.severityDistribution.low > 0 && (
                  <div
                    className="bg-gray-400 flex items-center justify-center text-white text-xs font-medium"
                    style={{ width: `${(result.severityDistribution.low / result.trends.totalBugs) * 100}%` }}
                  >
                    {result.severityDistribution.low}
                  </div>
                )}
              </div>
              <div className="flex gap-4 mt-2 text-xs text-gray-600">
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-500 rounded" /> Critical</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-orange-500 rounded" /> High</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-yellow-500 rounded" /> Medium</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-gray-400 rounded" /> Low</span>
              </div>
            </div>

            {/* Trends Summary */}
            <div className="grid grid-cols-3 gap-2">
              <div className="p-3 bg-gray-50 rounded-lg text-center">
                <p className="text-2xl font-bold text-gray-900">{result.trends.totalBugs}</p>
                <p className="text-xs text-gray-500">Total Bugs</p>
              </div>
              <div className="p-3 bg-red-50 rounded-lg text-center">
                <p className="text-2xl font-bold text-red-600">{result.trends.openBugs}</p>
                <p className="text-xs text-gray-500">Open Bugs</p>
              </div>
              <div className="p-3 bg-green-50 rounded-lg text-center">
                <p className="text-lg font-bold text-green-600">{result.trends.avgResolutionTime}</p>
                <p className="text-xs text-gray-500">Avg Resolution</p>
              </div>
            </div>

            {/* Patterns */}
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase mb-2">Detected Patterns</p>
              <div className="space-y-2">
                {result.patterns.map((pattern) => (
                  <div key={pattern.id} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{pattern.name}</span>
                        <SeverityBadge severity={pattern.severity} />
                        <TrendIndicator trend={pattern.trend} />
                      </div>
                      <span className="text-sm text-gray-600">{pattern.frequency} occurrences</span>
                    </div>
                    <p className="text-xs text-gray-600 mb-2">{pattern.description}</p>
                    <div className="flex flex-wrap gap-1">
                      {pattern.affectedComponents.map(comp => (
                        <span key={comp} className="px-2 py-0.5 bg-gray-200 rounded text-xs">
                          {comp}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Insights */}
            {result.insights.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase mb-2">Insights</p>
                <ul className="space-y-1">
                  {result.insights.map((insight, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <Lightbulb className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                      {insight}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recommendations */}
            {result.recommendations.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase mb-2">Recommendations</p>
                <ul className="space-y-1">
                  {result.recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <Target className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
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
            <p>Pattern analysis results will appear here</p>
            <p className="text-sm mt-1">Paste bugs JSON and analyze</p>
          </div>
        )}
      </Card>
    </div>
  );
}

// ============================================================================
// Root Cause Panel
// ============================================================================

function RootCausePanel({ projectId }: { projectId: string }) {
  const [testId, setTestId] = useState('');
  const [testName, setTestName] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [stackTrace, setStackTrace] = useState('');
  const [codeChangesJson, setCodeChangesJson] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RootCauseOutput | null>(null);
  const [error, setError] = useState('');

  const handleAnalyze = async () => {
    if (!testId.trim() || !testName.trim() || !errorMessage.trim()) {
      setError('Please provide test ID, name, and error message');
      return;
    }

    let codeChanges: CodeChange[] | undefined;
    if (codeChangesJson.trim()) {
      try {
        codeChanges = JSON.parse(codeChangesJson);
      } catch {
        setError('Invalid code changes JSON format');
        return;
      }
    }

    const failure: TestFailure = {
      testId,
      name: testName,
      error: errorMessage,
      stackTrace: stackTrace || undefined,
      duration: 0,
      retries: 0,
    };

    setLoading(true);
    setError('');
    try {
      const response = await api.post<{ data: RootCauseOutput }>('/bug-patterns/root-cause', {
        projectId,
        failure,
        context: codeChanges,
      });
      setResult(response.data.data);
    } catch (err) {
      setError('Failed to analyze root cause');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const complexityColors: Record<string, string> = {
    trivial: 'bg-green-100 text-green-700',
    simple: 'bg-blue-100 text-blue-700',
    moderate: 'bg-yellow-100 text-yellow-700',
    complex: 'bg-red-100 text-red-700',
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Input Panel */}
      <Card title="Root Cause Analysis">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Test ID *
              </label>
              <input
                type="text"
                value={testId}
                onChange={(e) => setTestId(e.target.value)}
                placeholder="TEST-001"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Test Name *
              </label>
              <input
                type="text"
                value={testName}
                onChange={(e) => setTestName(e.target.value)}
                placeholder="should login successfully"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Error Message *
            </label>
            <input
              type="text"
              value={errorMessage}
              onChange={(e) => setErrorMessage(e.target.value)}
              placeholder="Expected element to be visible"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Stack Trace (optional)
            </label>
            <textarea
              value={stackTrace}
              onChange={(e) => setStackTrace(e.target.value)}
              placeholder="Error: Element not found&#10;    at LoginPage.submit (/src/pages/login.ts:45)&#10;    at ..."
              className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Recent Code Changes (optional JSON)
            </label>
            <textarea
              value={codeChangesJson}
              onChange={(e) => setCodeChangesJson(e.target.value)}
              placeholder='[{"file": "src/auth.ts", "additions": 50, "deletions": 10, "author": "dev@example.com", "date": "2024-01-15", "commitMessage": "Refactor auth flow"}]'
              className="w-full h-24 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-500"
            />
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
            disabled={!testId.trim() || !testName.trim() || !errorMessage.trim()}
            className="w-full bg-red-600 hover:bg-red-700"
          >
            <Search className="w-4 h-4 mr-2" />
            Find Root Cause
          </Button>
        </div>
      </Card>

      {/* Output Panel */}
      <Card title="Root Cause Results">
        {result ? (
          <div className="space-y-4 max-h-[600px] overflow-auto">
            {/* Root Cause */}
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-red-800">Root Cause</span>
                <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium">
                  {result.rootCause.type.replace('_', ' ')}
                </span>
              </div>
              <p className="text-sm text-gray-700 mb-3">{result.rootCause.description}</p>
              <div className="mb-3">
                <p className="text-xs text-gray-500 mb-1">Confidence</p>
                <ConfidenceIndicator confidence={result.rootCause.confidence} />
              </div>
              {result.rootCause.evidence.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Evidence</p>
                  <ul className="space-y-1">
                    {result.rootCause.evidence.map((ev, i) => (
                      <li key={i} className="text-xs text-gray-600 flex items-start gap-1">
                        <span className="text-red-400">-</span> {ev}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Contributing Factors */}
            {result.contributing_factors.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase mb-2">Contributing Factors</p>
                <div className="space-y-2">
                  {result.contributing_factors.map((factor, i) => (
                    <div key={i} className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium">{factor.factor}</span>
                        <span className={`px-2 py-0.5 rounded text-xs ${impactColors[factor.impact]}`}>
                          {factor.impact} impact
                        </span>
                      </div>
                      <p className="text-xs text-gray-600">{factor.explanation}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Suggested Fix */}
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-green-800">Suggested Fix</span>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${complexityColors[result.suggestedFix.complexity]}`}>
                    {result.suggestedFix.complexity}
                  </span>
                  <span className="text-xs text-gray-500">{result.suggestedFix.estimatedEffort}</span>
                </div>
              </div>
              <p className="text-sm text-gray-700 mb-3">{result.suggestedFix.description}</p>
              <div>
                <p className="text-xs text-gray-500 mb-1">Steps</p>
                <ol className="space-y-1">
                  {result.suggestedFix.steps.map((step, i) => (
                    <li key={i} className="text-xs text-gray-600 flex items-start gap-2">
                      <span className="text-green-600 font-medium">{i + 1}.</span> {step}
                    </li>
                  ))}
                </ol>
              </div>
            </div>

            {/* Prevention Strategies */}
            {result.preventionStrategies.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase mb-2">Prevention Strategies</p>
                <ul className="space-y-1">
                  {result.preventionStrategies.map((strategy, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <Target className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                      {strategy}
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
            <Search className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>Root cause analysis will appear here</p>
            <p className="text-sm mt-1">Provide test failure details and analyze</p>
          </div>
        )}
      </Card>
    </div>
  );
}

// ============================================================================
// Predictions Panel
// ============================================================================

function PredictionsPanel({ projectId }: { projectId: string }) {
  const [codeChangesJson, setCodeChangesJson] = useState('');
  const [historicalBugsJson, setHistoricalBugsJson] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BugPredictionOutput | null>(null);
  const [error, setError] = useState('');

  const handlePredict = async () => {
    if (!codeChangesJson.trim()) {
      setError('Please provide code changes JSON');
      return;
    }

    let codeChanges: CodeChange[];
    let historicalBugs: BugData[] | undefined;

    try {
      codeChanges = JSON.parse(codeChangesJson);
    } catch {
      setError('Invalid code changes JSON format');
      return;
    }

    if (historicalBugsJson.trim()) {
      try {
        historicalBugs = JSON.parse(historicalBugsJson);
      } catch {
        setError('Invalid historical bugs JSON format');
        return;
      }
    }

    setLoading(true);
    setError('');
    try {
      const response = await api.post<{ data: BugPredictionOutput }>('/bug-patterns/predict', {
        projectId,
        codeChanges,
        historicalBugs,
      });
      setResult(response.data.data);
    } catch (err) {
      setError('Failed to generate predictions');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Input Panel */}
      <Card title="Bug Predictions">
        <div className="space-y-4">
          <JsonInput
            value={codeChangesJson}
            onChange={setCodeChangesJson}
            onClear={() => setCodeChangesJson('')}
            label="Code Changes JSON *"
            placeholder='[{"file": "src/auth/login.ts", "additions": 150, "deletions": 20, "author": "dev@example.com", "date": "2024-01-15", "commitMessage": "Refactor auth flow"}]'
          />

          <JsonInput
            value={historicalBugsJson}
            onChange={setHistoricalBugsJson}
            onClear={() => setHistoricalBugsJson('')}
            label="Historical Bugs JSON (optional)"
            placeholder='[{"id": "BUG-001", "title": "Login fails", "severity": "high", "component": "auth", "status": "resolved", "createdAt": "2024-01-10"}]'
          />

          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          <Button
            onClick={handlePredict}
            isLoading={loading}
            disabled={!codeChangesJson.trim()}
            className="w-full bg-red-600 hover:bg-red-700"
          >
            <AlertTriangle className="w-4 h-4 mr-2" />
            Predict Bug-Prone Areas
          </Button>
        </div>
      </Card>

      {/* Output Panel */}
      <Card title="Prediction Results">
        {result ? (
          <div className="space-y-4 max-h-[600px] overflow-auto">
            {/* Overall Risk */}
            <div className={`p-4 rounded-lg ${
              result.overallRisk.level === 'critical' ? 'bg-red-50 border border-red-200' :
              result.overallRisk.level === 'high' ? 'bg-orange-50 border border-orange-200' :
              result.overallRisk.level === 'medium' ? 'bg-yellow-50 border border-yellow-200' :
              'bg-green-50 border border-green-200'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Overall Risk Assessment</span>
                <RiskScore score={result.overallRisk.score} level={result.overallRisk.level} />
              </div>
              <p className="text-sm text-gray-700">{result.overallRisk.summary}</p>
            </div>

            {/* File Predictions */}
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase mb-2">File Risk Predictions</p>
              <div className="space-y-2">
                {result.predictions.map((prediction, i) => (
                  <PredictionCard key={i} prediction={prediction} />
                ))}
              </div>
            </div>

            {/* Hotspots */}
            {result.hotspots.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase mb-2">Risk Hotspots</p>
                <div className="space-y-2">
                  {result.hotspots.map((hotspot, i) => (
                    <div key={i} className="p-3 bg-orange-50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">{hotspot.area}</span>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          hotspot.risk >= 80 ? 'bg-red-100 text-red-700' :
                          hotspot.risk >= 60 ? 'bg-orange-100 text-orange-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                          Risk: {hotspot.risk}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {hotspot.topContributors.map((contributor, j) => (
                          <span key={j} className="px-2 py-0.5 bg-white rounded text-xs text-gray-600">
                            {contributor}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Suggested Test Focus */}
            {result.suggestedTestFocus.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase mb-2">Suggested Test Focus</p>
                <div className="flex flex-wrap gap-2">
                  {result.suggestedTestFocus.map((focus, i) => (
                    <span key={i} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                      {focus}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Mitigation Strategies */}
            {result.mitigationStrategies.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase mb-2">Mitigation Strategies</p>
                <ul className="space-y-1">
                  {result.mitigationStrategies.map((strategy, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <Target className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      {strategy}
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
            <p>Bug predictions will appear here</p>
            <p className="text-sm mt-1">Provide code changes and predict</p>
          </div>
        )}
      </Card>
    </div>
  );
}

function PredictionCard({ prediction }: { prediction: BugPredictionOutput['predictions'][0] }) {
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
          <p className="text-sm font-medium truncate">{prediction.file}</p>
        </div>
        <RiskScore score={prediction.riskScore} level={prediction.riskLevel} />
      </div>

      {expanded && (
        <div className="px-9 pb-3 space-y-3">
          <div>
            <p className="text-xs text-gray-500 mb-1">Risk Reasons</p>
            <ul className="space-y-1">
              {prediction.reasons.map((reason, i) => (
                <li key={i} className="text-xs text-gray-600 flex items-start gap-1">
                  <span className="text-red-400">-</span> {reason}
                </li>
              ))}
            </ul>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2 bg-white rounded">
              <p className="text-gray-500">Historical Bugs</p>
              <p className="font-medium">{prediction.historicalBugCount}</p>
            </div>
            <div className="p-2 bg-white rounded">
              <p className="text-gray-500">Change Velocity</p>
              <p className="font-medium">{prediction.recentChangeVelocity}</p>
            </div>
          </div>

          {prediction.recommendations.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-1">Recommendations</p>
              <ul className="space-y-1">
                {prediction.recommendations.map((rec, i) => (
                  <li key={i} className="text-xs text-green-700 flex items-start gap-1">
                    <Check className="w-3 h-3 mt-0.5" /> {rec}
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
// Report Panel
// ============================================================================

function ReportPanel({ projectId }: { projectId: string }) {
  const [bugsJson, setBugsJson] = useState('');
  const [format, setFormat] = useState<'detailed' | 'summary' | 'executive'>('detailed');
  const [includeCharts, setIncludeCharts] = useState(true);
  const [focusAreas, setFocusAreas] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BugReportOutput | null>(null);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    if (!bugsJson.trim()) {
      setError('Please provide bugs JSON');
      return;
    }

    let parsedBugs: BugData[];
    try {
      parsedBugs = JSON.parse(bugsJson);
    } catch {
      setError('Invalid JSON format');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await api.post<{ data: BugReportOutput }>('/bug-patterns/report', {
        projectId,
        bugs: parsedBugs,
        options: {
          format,
          includeCharts,
          focusAreas: focusAreas ? focusAreas.split(',').map(a => a.trim()) : undefined,
        },
      });
      setResult(response.data.data);
    } catch (err) {
      setError('Failed to generate report');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Input Panel */}
      <Card title="Bug Report Generation">
        <div className="space-y-4">
          <JsonInput
            value={bugsJson}
            onChange={setBugsJson}
            onClear={() => setBugsJson('')}
            label="Bugs JSON"
            placeholder='[{"id": "BUG-001", "title": "Login fails", "description": "...", "status": "open", "severity": "high", "component": "auth", "createdAt": "2024-01-15"}]'
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Report Format
            </label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as typeof format)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="detailed">Detailed</option>
              <option value="summary">Summary</option>
              <option value="executive">Executive</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Focus Areas (comma-separated)
            </label>
            <input
              type="text"
              value={focusAreas}
              onChange={(e) => setFocusAreas(e.target.value)}
              placeholder="auth, security, performance"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={includeCharts}
              onChange={(e) => setIncludeCharts(e.target.checked)}
              className="rounded border-gray-300 text-red-500 focus:ring-red-500"
            />
            <span className="text-sm text-gray-700">Include chart data</span>
          </label>

          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          <Button
            onClick={handleGenerate}
            isLoading={loading}
            disabled={!bugsJson.trim()}
            className="w-full bg-red-600 hover:bg-red-700"
          >
            <FileText className="w-4 h-4 mr-2" />
            Generate Report
          </Button>
        </div>
      </Card>

      {/* Output Panel */}
      <Card title="Bug Analysis Report">
        {result ? (
          <div className="space-y-4 max-h-[600px] overflow-auto">
            {/* Executive Summary */}
            <div className={`p-4 rounded-lg ${healthColors[result.executiveSummary.healthStatus]}`}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium">Health Score</span>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold">{result.executiveSummary.healthScore}</span>
                  <span className="px-2 py-1 rounded text-xs font-medium capitalize">
                    {result.executiveSummary.healthStatus}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2 mb-3">
                <div className="text-center">
                  <p className="text-xl font-bold">{result.executiveSummary.totalBugs}</p>
                  <p className="text-xs">Total</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold">{result.executiveSummary.openBugs}</p>
                  <p className="text-xs">Open</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold">{result.executiveSummary.criticalBugs}</p>
                  <p className="text-xs">Critical</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold">{result.executiveSummary.avgAge}</p>
                  <p className="text-xs">Avg Age</p>
                </div>
              </div>

              {result.executiveSummary.keyFindings.length > 0 && (
                <div>
                  <p className="text-xs font-medium mb-1">Key Findings</p>
                  <ul className="space-y-1">
                    {result.executiveSummary.keyFindings.map((finding, i) => (
                      <li key={i} className="text-xs flex items-start gap-1">
                        <span>-</span> {finding}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Charts Data */}
            {includeCharts && (
              <div className="grid grid-cols-2 gap-3">
                {/* Severity Breakdown */}
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs font-medium text-gray-500 mb-2">By Severity</p>
                  <div className="space-y-1">
                    {result.charts.severityBreakdown.map((item) => (
                      <div key={item.label} className="flex items-center gap-2">
                        <span className={`w-3 h-3 rounded ${severityBgColors[item.label.toLowerCase() as BugSeverity] || 'bg-gray-400'}`} />
                        <span className="text-xs flex-1">{item.label}</span>
                        <span className="text-xs font-medium">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Status Breakdown */}
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs font-medium text-gray-500 mb-2">By Status</p>
                  <div className="space-y-1">
                    {result.charts.statusBreakdown.map((item) => (
                      <div key={item.label} className="flex items-center gap-2">
                        <span className="text-xs flex-1">{item.label}</span>
                        <span className="text-xs font-medium">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Component Breakdown */}
                <div className="p-3 bg-gray-50 rounded-lg col-span-2">
                  <p className="text-xs font-medium text-gray-500 mb-2">By Component</p>
                  <div className="flex flex-wrap gap-2">
                    {result.charts.componentBreakdown.map((item) => (
                      <span key={item.label} className="px-2 py-1 bg-white rounded text-xs">
                        {item.label}: <span className="font-medium">{item.value}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Top Issues */}
            {result.topIssues.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase mb-2">Top Issues</p>
                <div className="space-y-2">
                  {result.topIssues.map((issue) => (
                    <div key={issue.id} className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-gray-500">{issue.id}</span>
                        <SeverityBadge severity={issue.severity as BugSeverity} />
                        <span className="text-xs text-gray-500">{issue.age}</span>
                      </div>
                      <p className="text-sm font-medium">{issue.title}</p>
                      <p className="text-xs text-gray-600">{issue.impact}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recommendations */}
            {result.recommendations.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase mb-2">Recommendations</p>
                <div className="space-y-2">
                  {result.recommendations.map((rec, i) => (
                    <div key={i} className="p-3 bg-blue-50 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          rec.priority === 'high' ? 'bg-red-100 text-red-700' :
                          rec.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {rec.priority}
                        </span>
                        <span className="text-xs text-gray-500">Effort: {rec.effort}</span>
                      </div>
                      <p className="text-sm font-medium">{rec.action}</p>
                      <p className="text-xs text-gray-600">{rec.expectedImpact}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Copy JSON */}
            <div className="flex justify-end pt-2 border-t border-gray-200">
              <div className="flex items-center gap-1 text-sm text-gray-500">
                <span>Copy report</span>
                <CopyButton text={JSON.stringify(result, null, 2)} />
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-16 text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>Bug analysis report will appear here</p>
            <p className="text-sm mt-1">Provide bugs JSON and generate</p>
          </div>
        )}
      </Card>
    </div>
  );
}

// ============================================================================
// Cluster Panel
// ============================================================================

function ClusterPanel({ projectId }: { projectId: string }) {
  const [bugsJson, setBugsJson] = useState('');
  const [minClusterSize, setMinClusterSize] = useState(2);
  const [similarityThreshold, setSimilarityThreshold] = useState(70);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BugClusterOutput | null>(null);
  const [error, setError] = useState('');

  const handleCluster = async () => {
    if (!bugsJson.trim()) {
      setError('Please provide bugs JSON');
      return;
    }

    let parsedBugs: BugData[];
    try {
      parsedBugs = JSON.parse(bugsJson);
    } catch {
      setError('Invalid JSON format');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await api.post<{ data: BugClusterOutput }>('/bug-patterns/cluster', {
        projectId,
        bugs: parsedBugs,
        options: {
          minClusterSize,
          similarityThreshold,
        },
      });
      setResult(response.data.data);
    } catch (err) {
      setError('Failed to cluster bugs');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Input Panel */}
      <Card title="Bug Clustering">
        <div className="space-y-4">
          <JsonInput
            value={bugsJson}
            onChange={setBugsJson}
            onClear={() => setBugsJson('')}
            label="Bugs JSON"
            placeholder='[{"id": "BUG-001", "title": "Login fails", "description": "...", "status": "open", "severity": "high", "component": "auth", "createdAt": "2024-01-15"}]'
          />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Min Cluster Size
              </label>
              <input
                type="number"
                min={1}
                value={minClusterSize}
                onChange={(e) => setMinClusterSize(parseInt(e.target.value) || 2)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Similarity Threshold (%)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={similarityThreshold}
                onChange={(e) => setSimilarityThreshold(parseInt(e.target.value) || 70)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          <Button
            onClick={handleCluster}
            isLoading={loading}
            disabled={!bugsJson.trim()}
            className="w-full bg-red-600 hover:bg-red-700"
          >
            <Layers className="w-4 h-4 mr-2" />
            Cluster Bugs
          </Button>
        </div>
      </Card>

      {/* Output Panel */}
      <Card title="Clustering Results">
        {result ? (
          <div className="space-y-4 max-h-[600px] overflow-auto">
            {/* Clusters */}
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase mb-2">Bug Clusters ({result.clusters.length})</p>
              <div className="space-y-2">
                {result.clusters.map((cluster) => (
                  <ClusterCard key={cluster.id} cluster={cluster} />
                ))}
              </div>
            </div>

            {/* Triage Order */}
            {result.triageOrder.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase mb-2">Recommended Triage Order</p>
                <div className="flex flex-wrap gap-1">
                  {result.triageOrder.map((bugId, i) => (
                    <span key={bugId} className="px-2 py-1 bg-gray-100 rounded text-xs">
                      <span className="text-gray-400 mr-1">{i + 1}.</span>
                      {bugId}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Outliers */}
            {result.outliers.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase mb-2">Outliers</p>
                <div className="space-y-2">
                  {result.outliers.map((outlier) => (
                    <div
                      key={outlier.bugId}
                      className={`p-3 rounded-lg ${outlier.specialAttention ? 'bg-yellow-50 border border-yellow-200' : 'bg-gray-50'}`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-mono">{outlier.bugId}</span>
                        {outlier.specialAttention && (
                          <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs">
                            Needs Attention
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-600">{outlier.reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Insights */}
            {result.insights.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase mb-2">Insights</p>
                <ul className="space-y-1">
                  {result.insights.map((insight, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <Lightbulb className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                      {insight}
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
            <Layers className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>Clustering results will appear here</p>
            <p className="text-sm mt-1">Provide bugs JSON and cluster</p>
          </div>
        )}
      </Card>
    </div>
  );
}

function ClusterCard({ cluster }: { cluster: BugClusterOutput['clusters'][0] }) {
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
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{cluster.name}</span>
            <SeverityBadge severity={cluster.suggestedPriority} />
            <span className="text-xs text-gray-500">{cluster.size} bugs</span>
          </div>
          <p className="text-xs text-gray-600 truncate">{cluster.theme}</p>
        </div>
      </div>

      {expanded && (
        <div className="px-9 pb-3 space-y-3 border-t border-gray-200 pt-3">
          <div>
            <p className="text-xs text-gray-500 mb-1">Bugs in Cluster</p>
            <div className="flex flex-wrap gap-1">
              {cluster.bugs.map((bugId) => (
                <span key={bugId} className="px-2 py-0.5 bg-white rounded text-xs font-mono">
                  {bugId}
                </span>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs text-gray-500 mb-1">Common Characteristics</p>
            <div className="flex flex-wrap gap-1">
              {cluster.commonCharacteristics.map((char, i) => (
                <span key={i} className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                  {char}
                </span>
              ))}
            </div>
          </div>

          <div className="p-2 bg-green-50 rounded">
            <p className="text-xs text-gray-500 mb-1">Triage Recommendation</p>
            <p className="text-xs text-green-700">{cluster.triageRecommendation}</p>
          </div>
        </div>
      )}
    </div>
  );
}

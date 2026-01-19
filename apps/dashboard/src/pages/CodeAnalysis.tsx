/**
 * Code Analysis Page
 * Analyze code complexity, architecture, best practices, and technical debt
 */

import { useState, useCallback } from 'react';
import { useProjectStore } from '../stores/project';
import { api } from '../services/api';
import { Card, Button } from '../components/ui';
import {
  Code, Activity, Layers,
  AlertCircle, Copy, Check, ChevronDown, ChevronRight,
  Upload, Trash2, TrendingUp, TrendingDown, Minus,
  Target, Lightbulb, Shield,
  Clock, Archive,
} from 'lucide-react';

type TabType = 'complexity' | 'architecture' | 'bestpractices' | 'technicaldebt';

// Types for code analysis
type ComplexityLevel = 'low' | 'medium' | 'high' | 'critical';
type SeverityLevel = 'info' | 'warning' | 'error' | 'critical';

interface CodeFile {
  path: string;
  content: string;
  language?: string;
}

interface ComplexityOutput {
  files: Array<{
    path: string;
    metrics: {
      cyclomaticComplexity: number;
      cognitiveComplexity: number;
      linesOfCode: number;
      maintainabilityIndex: number;
      halsteadDifficulty: number;
    };
    functions: Array<{
      name: string;
      complexity: number;
      level: ComplexityLevel;
      startLine: number;
      endLine: number;
      suggestions: string[];
    }>;
    level: ComplexityLevel;
  }>;
  summary: {
    totalFiles: number;
    avgComplexity: number;
    avgMaintainability: number;
    criticalFunctions: number;
    totalLinesOfCode: number;
  };
  hotspots: Array<{
    path: string;
    function: string;
    complexity: number;
    reason: string;
  }>;
  recommendations: string[];
}

interface ArchitectureOutput {
  layers: Array<{
    name: string;
    modules: string[];
    dependencies: string[];
    violations: string[];
  }>;
  dependencies: {
    graph: Array<{ from: string; to: string; weight: number }>;
    circularDependencies: string[][];
    unusedDependencies: string[];
    missingDependencies: string[];
  };
  patterns: {
    detected: Array<{
      name: string;
      location: string;
      confidence: number;
    }>;
    violations: Array<{
      pattern: string;
      location: string;
      issue: string;
      suggestion: string;
    }>;
  };
  metrics: {
    cohesion: number;
    coupling: number;
    abstractness: number;
    instability: number;
  };
  recommendations: string[];
}

interface BestPracticesOutput {
  violations: Array<{
    id: string;
    rule: string;
    severity: SeverityLevel;
    file: string;
    line: number;
    message: string;
    suggestion: string;
    category: string;
  }>;
  categories: Array<{
    name: string;
    violations: number;
    percentage: number;
  }>;
  summary: {
    totalViolations: number;
    criticalCount: number;
    errorCount: number;
    warningCount: number;
    infoCount: number;
    score: number;
  };
  topIssues: Array<{
    rule: string;
    count: number;
    impact: string;
  }>;
  recommendations: string[];
}

interface TechnicalDebtOutput {
  items: Array<{
    id: string;
    type: 'code_smell' | 'bug_risk' | 'security' | 'performance' | 'maintainability';
    file: string;
    line?: number;
    description: string;
    effort: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    tags: string[];
  }>;
  summary: {
    totalDebt: string;
    debtRatio: number;
    healthScore: number;
    categories: Record<string, { count: number; effort: string }>;
  };
  trends: {
    direction: 'increasing' | 'stable' | 'decreasing';
    recentChanges: Array<{
      date: string;
      added: number;
      resolved: number;
    }>;
  };
  prioritizedActions: Array<{
    action: string;
    impact: string;
    effort: string;
    priority: 'high' | 'medium' | 'low';
  }>;
  recommendations: string[];
}

// Color mappings
const complexityColors: Record<ComplexityLevel, string> = {
  low: 'bg-green-100 text-green-700 border-green-200',
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  high: 'bg-orange-100 text-orange-700 border-orange-200',
  critical: 'bg-red-100 text-red-700 border-red-200',
};

const severityColors: Record<SeverityLevel, string> = {
  info: 'bg-blue-100 text-blue-700 border-blue-200',
  warning: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  error: 'bg-orange-100 text-orange-700 border-orange-200',
  critical: 'bg-red-100 text-red-700 border-red-200',
};

const priorityColors: Record<string, string> = {
  low: 'bg-gray-100 text-gray-700',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
};

const debtTypeColors: Record<string, string> = {
  code_smell: 'bg-yellow-100 text-yellow-700',
  bug_risk: 'bg-red-100 text-red-700',
  security: 'bg-purple-100 text-purple-700',
  performance: 'bg-blue-100 text-blue-700',
  maintainability: 'bg-green-100 text-green-700',
};

export function CodeAnalysisPage() {
  const { currentProject } = useProjectStore();
  const [activeTab, setActiveTab] = useState<TabType>('complexity');

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
            <Code className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Code Analysis</h1>
            <p className="text-sm text-gray-500">Analyze complexity, architecture, best practices, and technical debt</p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab('complexity')}
            className={`flex items-center gap-2 py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
              activeTab === 'complexity'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Activity className="w-4 h-4" />
            Complexity
          </button>
          <button
            onClick={() => setActiveTab('architecture')}
            className={`flex items-center gap-2 py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
              activeTab === 'architecture'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Layers className="w-4 h-4" />
            Architecture
          </button>
          <button
            onClick={() => setActiveTab('bestpractices')}
            className={`flex items-center gap-2 py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
              activeTab === 'bestpractices'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Shield className="w-4 h-4" />
            Best Practices
          </button>
          <button
            onClick={() => setActiveTab('technicaldebt')}
            className={`flex items-center gap-2 py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
              activeTab === 'technicaldebt'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Archive className="w-4 h-4" />
            Technical Debt
          </button>
        </nav>
      </div>

      {activeTab === 'complexity' && <ComplexityPanel projectId={currentProject.id} />}
      {activeTab === 'architecture' && <ArchitecturePanel projectId={currentProject.id} />}
      {activeTab === 'bestpractices' && <BestPracticesPanel projectId={currentProject.id} />}
      {activeTab === 'technicaldebt' && <TechnicalDebtPanel projectId={currentProject.id} />}
    </div>
  );
}

// JSON/Code Input Component
function CodeInput({
  value,
  onChange,
  onClear,
  label,
  placeholder,
  acceptTypes = '.json,.ts,.tsx,.js,.jsx,.py,.java',
}: {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  label: string;
  placeholder: string;
  acceptTypes?: string;
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
      if (file) {
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
          className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 transition-colors"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="w-10 h-10 mx-auto text-gray-400 mb-2" />
          <p className="text-sm text-gray-600">Drag & drop file or click to upload</p>
          <p className="text-xs text-gray-400 mt-1">Or paste code/JSON below</p>
          <input
            ref={(el) => { fileInputRef.current = el; }}
            type="file"
            accept={acceptTypes}
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
          />
        </div>
      ) : null}

      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={value ? '' : placeholder}
        className="w-full h-48 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}

// Complexity Badge Component
function ComplexityBadge({ level }: { level: ComplexityLevel }) {
  return (
    <span className={`px-2 py-1 rounded text-xs font-medium border ${complexityColors[level]}`}>
      {level}
    </span>
  );
}

// Severity Badge Component
function SeverityBadge({ severity }: { severity: SeverityLevel }) {
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

// Score Indicator Component
function ScoreIndicator({ score, label }: { score: number; label: string }) {
  const color = score >= 80 ? 'text-green-500' : score >= 60 ? 'text-yellow-500' : 'text-red-500';

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
            className={color}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">
          {score}
        </span>
      </div>
      <div className="text-xs text-gray-600">{label}</div>
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
// Complexity Panel
// ============================================================================

function ComplexityPanel({ projectId }: { projectId: string }) {
  const [codeJson, setCodeJson] = useState('');
  const [language, setLanguage] = useState('typescript');
  const [includeMetrics, setIncludeMetrics] = useState(true);
  const [thresholds, setThresholds] = useState({ cyclomatic: 10, cognitive: 15 });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ComplexityOutput | null>(null);
  const [error, setError] = useState('');

  const handleAnalyze = async () => {
    if (!codeJson.trim()) {
      setError('Please provide code or files JSON');
      return;
    }

    let files: CodeFile[];
    try {
      // Try to parse as JSON array of files
      files = JSON.parse(codeJson);
    } catch {
      // If not JSON, treat as single file content
      files = [{ path: 'input.ts', content: codeJson, language }];
    }

    setLoading(true);
    setError('');
    try {
      const response = await api.post<{ data: ComplexityOutput }>('/code-analysis/complexity', {
        projectId,
        files,
        options: {
          language,
          includeMetrics,
          thresholds,
        },
      });
      setResult(response.data.data);
    } catch (err) {
      setError('Failed to analyze complexity');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Input Panel */}
      <Card title="Complexity Analysis">
        <div className="space-y-4">
          <CodeInput
            value={codeJson}
            onChange={setCodeJson}
            onClear={() => setCodeJson('')}
            label="Code or Files JSON"
            placeholder={'// Paste code directly or JSON:\n[{"path": "src/utils.ts", "content": "function foo() {...}"}]'}
          />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Language
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="typescript">TypeScript</option>
                <option value="javascript">JavaScript</option>
                <option value="python">Python</option>
                <option value="java">Java</option>
                <option value="go">Go</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cyclomatic Threshold
              </label>
              <input
                type="number"
                min={1}
                value={thresholds.cyclomatic}
                onChange={(e) => setThresholds(t => ({ ...t, cyclomatic: parseInt(e.target.value) || 10 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={includeMetrics}
              onChange={(e) => setIncludeMetrics(e.target.checked)}
              className="rounded border-gray-300 text-blue-500 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Include detailed metrics</span>
          </label>

          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          <Button
            onClick={handleAnalyze}
            isLoading={loading}
            disabled={!codeJson.trim()}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            <Activity className="w-4 h-4 mr-2" />
            Analyze Complexity
          </Button>
        </div>
      </Card>

      {/* Output Panel */}
      <Card title="Complexity Results">
        {result ? (
          <div className="space-y-4 max-h-[600px] overflow-auto">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-2">
              <div className="p-3 bg-gray-50 rounded-lg text-center">
                <p className="text-2xl font-bold text-gray-900">{result.summary.totalFiles}</p>
                <p className="text-xs text-gray-500">Files</p>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg text-center">
                <p className="text-2xl font-bold text-blue-600">{result.summary.avgComplexity.toFixed(1)}</p>
                <p className="text-xs text-gray-500">Avg Complexity</p>
              </div>
              <div className="p-3 bg-red-50 rounded-lg text-center">
                <p className="text-2xl font-bold text-red-600">{result.summary.criticalFunctions}</p>
                <p className="text-xs text-gray-500">Critical</p>
              </div>
            </div>

            {/* Maintainability Score */}
            <div className="flex justify-center">
              <ScoreIndicator score={Math.round(result.summary.avgMaintainability)} label="Maintainability Index" />
            </div>

            {/* Hotspots */}
            {result.hotspots.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase mb-2">Complexity Hotspots</p>
                <div className="space-y-2">
                  {result.hotspots.map((hotspot, i) => (
                    <div key={i} className="p-3 bg-red-50 rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium font-mono">{hotspot.function}</span>
                        <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium">
                          {hotspot.complexity}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600">{hotspot.path}</p>
                      <p className="text-xs text-red-600 mt-1">{hotspot.reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* File Analysis */}
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase mb-2">File Analysis</p>
              <div className="space-y-2">
                {result.files.map((file, i) => (
                  <FileComplexityCard key={i} file={file} />
                ))}
              </div>
            </div>

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
            <Activity className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>Complexity analysis results will appear here</p>
            <p className="text-sm mt-1">Paste code and analyze</p>
          </div>
        )}
      </Card>
    </div>
  );
}

function FileComplexityCard({ file }: { file: ComplexityOutput['files'][0] }) {
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
          <p className="text-sm font-medium truncate font-mono">{file.path}</p>
        </div>
        <ComplexityBadge level={file.level} />
      </div>

      {expanded && (
        <div className="px-9 pb-3 space-y-3">
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="p-2 bg-white rounded">
              <p className="text-gray-500">Cyclomatic</p>
              <p className="font-medium">{file.metrics.cyclomaticComplexity}</p>
            </div>
            <div className="p-2 bg-white rounded">
              <p className="text-gray-500">Cognitive</p>
              <p className="font-medium">{file.metrics.cognitiveComplexity}</p>
            </div>
            <div className="p-2 bg-white rounded">
              <p className="text-gray-500">LOC</p>
              <p className="font-medium">{file.metrics.linesOfCode}</p>
            </div>
          </div>

          {file.functions.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-1">Functions</p>
              <div className="space-y-1">
                {file.functions.map((fn, i) => (
                  <div key={i} className="flex items-center justify-between text-xs p-2 bg-white rounded">
                    <span className="font-mono">{fn.name}</span>
                    <ComplexityBadge level={fn.level} />
                  </div>
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
// Architecture Panel
// ============================================================================

function ArchitecturePanel({ projectId }: { projectId: string }) {
  const [codeJson, setCodeJson] = useState('');
  const [analyzePatterns, setAnalyzePatterns] = useState(true);
  const [checkDependencies, setCheckDependencies] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ArchitectureOutput | null>(null);
  const [error, setError] = useState('');

  const handleAnalyze = async () => {
    if (!codeJson.trim()) {
      setError('Please provide project structure or files JSON');
      return;
    }

    let files: CodeFile[];
    try {
      files = JSON.parse(codeJson);
    } catch {
      setError('Invalid JSON format');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await api.post<{ data: ArchitectureOutput }>('/code-analysis/architecture', {
        projectId,
        files,
        options: {
          analyzePatterns,
          checkDependencies,
        },
      });
      setResult(response.data.data);
    } catch (err) {
      setError('Failed to analyze architecture');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const metricsColor = (value: number, type: 'cohesion' | 'coupling') => {
    if (type === 'cohesion') {
      return value >= 0.7 ? 'text-green-600' : value >= 0.4 ? 'text-yellow-600' : 'text-red-600';
    }
    return value <= 0.3 ? 'text-green-600' : value <= 0.6 ? 'text-yellow-600' : 'text-red-600';
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Input Panel */}
      <Card title="Architecture Analysis">
        <div className="space-y-4">
          <CodeInput
            value={codeJson}
            onChange={setCodeJson}
            onClear={() => setCodeJson('')}
            label="Project Structure JSON"
            placeholder='[{"path": "src/services/user.ts", "content": "import { db } from ../db..."}]'
          />

          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={analyzePatterns}
                onChange={(e) => setAnalyzePatterns(e.target.checked)}
                className="rounded border-gray-300 text-blue-500 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Analyze design patterns</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={checkDependencies}
                onChange={(e) => setCheckDependencies(e.target.checked)}
                className="rounded border-gray-300 text-blue-500 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Check dependencies</span>
            </label>
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
            disabled={!codeJson.trim()}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            <Layers className="w-4 h-4 mr-2" />
            Analyze Architecture
          </Button>
        </div>
      </Card>

      {/* Output Panel */}
      <Card title="Architecture Results">
        {result ? (
          <div className="space-y-4 max-h-[600px] overflow-auto">
            {/* Metrics */}
            <div className="grid grid-cols-4 gap-2">
              <div className="p-3 bg-gray-50 rounded-lg text-center">
                <p className={`text-xl font-bold ${metricsColor(result.metrics.cohesion, 'cohesion')}`}>
                  {(result.metrics.cohesion * 100).toFixed(0)}%
                </p>
                <p className="text-xs text-gray-500">Cohesion</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg text-center">
                <p className={`text-xl font-bold ${metricsColor(result.metrics.coupling, 'coupling')}`}>
                  {(result.metrics.coupling * 100).toFixed(0)}%
                </p>
                <p className="text-xs text-gray-500">Coupling</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg text-center">
                <p className="text-xl font-bold text-gray-900">{(result.metrics.abstractness * 100).toFixed(0)}%</p>
                <p className="text-xs text-gray-500">Abstractness</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg text-center">
                <p className="text-xl font-bold text-gray-900">{(result.metrics.instability * 100).toFixed(0)}%</p>
                <p className="text-xs text-gray-500">Instability</p>
              </div>
            </div>

            {/* Circular Dependencies */}
            {result.dependencies.circularDependencies.length > 0 && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm font-medium text-red-800 mb-2">Circular Dependencies Detected</p>
                <div className="space-y-1">
                  {result.dependencies.circularDependencies.map((cycle, i) => (
                    <div key={i} className="text-xs text-red-700 font-mono">
                      {cycle.join(' -> ')} {'->'} {cycle[0]}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Layers */}
            {result.layers.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase mb-2">Architecture Layers</p>
                <div className="space-y-2">
                  {result.layers.map((layer, i) => (
                    <div key={i} className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">{layer.name}</span>
                        {layer.violations.length > 0 && (
                          <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs">
                            {layer.violations.length} violations
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {layer.modules.map((mod, j) => (
                          <span key={j} className="px-2 py-0.5 bg-white rounded text-xs font-mono">
                            {mod}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Detected Patterns */}
            {result.patterns.detected.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase mb-2">Detected Patterns</p>
                <div className="flex flex-wrap gap-2">
                  {result.patterns.detected.map((pattern, i) => (
                    <span key={i} className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                      {pattern.name} ({Math.round(pattern.confidence * 100)}%)
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Pattern Violations */}
            {result.patterns.violations.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase mb-2">Pattern Violations</p>
                <div className="space-y-2">
                  {result.patterns.violations.map((violation, i) => (
                    <div key={i} className="p-3 bg-yellow-50 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium">{violation.pattern}</span>
                        <span className="text-xs text-gray-500 font-mono">{violation.location}</span>
                      </div>
                      <p className="text-xs text-gray-700">{violation.issue}</p>
                      <p className="text-xs text-green-700 mt-1">{violation.suggestion}</p>
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
            <Layers className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>Architecture analysis results will appear here</p>
            <p className="text-sm mt-1">Provide project structure and analyze</p>
          </div>
        )}
      </Card>
    </div>
  );
}

// ============================================================================
// Best Practices Panel
// ============================================================================

function BestPracticesPanel({ projectId }: { projectId: string }) {
  const [codeJson, setCodeJson] = useState('');
  const [language, setLanguage] = useState('typescript');
  const [rulesets, setRulesets] = useState<string[]>(['recommended']);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BestPracticesOutput | null>(null);
  const [error, setError] = useState('');

  const handleAnalyze = async () => {
    if (!codeJson.trim()) {
      setError('Please provide code or files JSON');
      return;
    }

    let files: CodeFile[];
    try {
      files = JSON.parse(codeJson);
    } catch {
      files = [{ path: 'input.ts', content: codeJson, language }];
    }

    setLoading(true);
    setError('');
    try {
      const response = await api.post<{ data: BestPracticesOutput }>('/code-analysis/best-practices', {
        projectId,
        files,
        options: {
          language,
          rulesets,
        },
      });
      setResult(response.data.data);
    } catch (err) {
      setError('Failed to analyze best practices');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const toggleRuleset = (ruleset: string) => {
    setRulesets(prev =>
      prev.includes(ruleset)
        ? prev.filter(r => r !== ruleset)
        : [...prev, ruleset]
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Input Panel */}
      <Card title="Best Practices Analysis">
        <div className="space-y-4">
          <CodeInput
            value={codeJson}
            onChange={setCodeJson}
            onClear={() => setCodeJson('')}
            label="Code or Files JSON"
            placeholder={'// Paste code directly or JSON array'}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Language
            </label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="typescript">TypeScript</option>
              <option value="javascript">JavaScript</option>
              <option value="python">Python</option>
              <option value="java">Java</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rulesets
            </label>
            <div className="flex flex-wrap gap-2">
              {['recommended', 'strict', 'security', 'performance', 'accessibility'].map(ruleset => (
                <button
                  key={ruleset}
                  onClick={() => toggleRuleset(ruleset)}
                  className={`px-3 py-1 rounded text-xs font-medium border transition-colors ${
                    rulesets.includes(ruleset)
                      ? 'bg-blue-100 text-blue-700 border-blue-200'
                      : 'bg-white text-gray-500 border-gray-300 hover:border-gray-400'
                  }`}
                >
                  {ruleset}
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
            disabled={!codeJson.trim()}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            <Shield className="w-4 h-4 mr-2" />
            Check Best Practices
          </Button>
        </div>
      </Card>

      {/* Output Panel */}
      <Card title="Best Practices Results">
        {result ? (
          <div className="space-y-4 max-h-[600px] overflow-auto">
            {/* Score */}
            <div className="flex justify-center">
              <ScoreIndicator score={result.summary.score} label="Code Quality Score" />
            </div>

            {/* Summary */}
            <div className="grid grid-cols-4 gap-2">
              <div className="p-2 bg-red-50 rounded-lg text-center">
                <p className="text-lg font-bold text-red-600">{result.summary.criticalCount}</p>
                <p className="text-xs text-gray-500">Critical</p>
              </div>
              <div className="p-2 bg-orange-50 rounded-lg text-center">
                <p className="text-lg font-bold text-orange-600">{result.summary.errorCount}</p>
                <p className="text-xs text-gray-500">Error</p>
              </div>
              <div className="p-2 bg-yellow-50 rounded-lg text-center">
                <p className="text-lg font-bold text-yellow-600">{result.summary.warningCount}</p>
                <p className="text-xs text-gray-500">Warning</p>
              </div>
              <div className="p-2 bg-blue-50 rounded-lg text-center">
                <p className="text-lg font-bold text-blue-600">{result.summary.infoCount}</p>
                <p className="text-xs text-gray-500">Info</p>
              </div>
            </div>

            {/* Categories */}
            {result.categories.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase mb-2">By Category</p>
                <div className="space-y-2">
                  {result.categories.map((cat, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-xs flex-1">{cat.name}</span>
                      <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500"
                          style={{ width: `${cat.percentage}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-600 w-8">{cat.violations}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top Issues */}
            {result.topIssues.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase mb-2">Top Issues</p>
                <div className="space-y-2">
                  {result.topIssues.map((issue, i) => (
                    <div key={i} className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{issue.rule}</span>
                        <span className="px-2 py-1 bg-gray-200 rounded text-xs">{issue.count}x</span>
                      </div>
                      <p className="text-xs text-gray-600 mt-1">{issue.impact}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Violations */}
            {result.violations.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase mb-2">Violations</p>
                <div className="space-y-2">
                  {result.violations.slice(0, 10).map((violation, i) => (
                    <div key={i} className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <SeverityBadge severity={violation.severity} />
                        <span className="text-xs font-mono text-gray-500">{violation.file}:{violation.line}</span>
                      </div>
                      <p className="text-sm text-gray-700">{violation.message}</p>
                      <p className="text-xs text-green-700 mt-1">{violation.suggestion}</p>
                    </div>
                  ))}
                  {result.violations.length > 10 && (
                    <p className="text-xs text-gray-500 text-center">
                      +{result.violations.length - 10} more violations
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
            <Shield className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>Best practices analysis will appear here</p>
            <p className="text-sm mt-1">Paste code and analyze</p>
          </div>
        )}
      </Card>
    </div>
  );
}

// ============================================================================
// Technical Debt Panel
// ============================================================================

function TechnicalDebtPanel({ projectId }: { projectId: string }) {
  const [codeJson, setCodeJson] = useState('');
  const [includeHistory, setIncludeHistory] = useState(false);
  const [debtTypes, setDebtTypes] = useState<string[]>(['code_smell', 'bug_risk', 'maintainability']);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TechnicalDebtOutput | null>(null);
  const [error, setError] = useState('');

  const handleAnalyze = async () => {
    if (!codeJson.trim()) {
      setError('Please provide code or files JSON');
      return;
    }

    let files: CodeFile[];
    try {
      files = JSON.parse(codeJson);
    } catch {
      files = [{ path: 'input.ts', content: codeJson }];
    }

    setLoading(true);
    setError('');
    try {
      const response = await api.post<{ data: TechnicalDebtOutput }>('/code-analysis/technical-debt', {
        projectId,
        files,
        options: {
          includeHistory,
          debtTypes,
        },
      });
      setResult(response.data.data);
    } catch (err) {
      setError('Failed to analyze technical debt');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const toggleDebtType = (type: string) => {
    setDebtTypes(prev =>
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Input Panel */}
      <Card title="Technical Debt Analysis">
        <div className="space-y-4">
          <CodeInput
            value={codeJson}
            onChange={setCodeJson}
            onClear={() => setCodeJson('')}
            label="Code or Files JSON"
            placeholder={'// Paste code directly or JSON array'}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Debt Types
            </label>
            <div className="flex flex-wrap gap-2">
              {['code_smell', 'bug_risk', 'security', 'performance', 'maintainability'].map(type => (
                <button
                  key={type}
                  onClick={() => toggleDebtType(type)}
                  className={`px-3 py-1 rounded text-xs font-medium border transition-colors ${
                    debtTypes.includes(type)
                      ? debtTypeColors[type]
                      : 'bg-white text-gray-500 border-gray-300 hover:border-gray-400'
                  }`}
                >
                  {type.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={includeHistory}
              onChange={(e) => setIncludeHistory(e.target.checked)}
              className="rounded border-gray-300 text-blue-500 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Include historical trends</span>
          </label>

          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          <Button
            onClick={handleAnalyze}
            isLoading={loading}
            disabled={!codeJson.trim()}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            <Archive className="w-4 h-4 mr-2" />
            Analyze Technical Debt
          </Button>
        </div>
      </Card>

      {/* Output Panel */}
      <Card title="Technical Debt Results">
        {result ? (
          <div className="space-y-4 max-h-[600px] overflow-auto">
            {/* Summary */}
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs text-gray-500">Total Debt</p>
                  <p className="text-2xl font-bold text-gray-900">{result.summary.totalDebt}</p>
                </div>
                <div className="flex items-center gap-2">
                  <ScoreIndicator score={result.summary.healthScore} label="Health" />
                  <TrendIndicator trend={result.trends.direction} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Debt Ratio:</span>
                <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${
                      result.summary.debtRatio <= 10 ? 'bg-green-500' :
                      result.summary.debtRatio <= 25 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${Math.min(result.summary.debtRatio, 100)}%` }}
                  />
                </div>
                <span className="text-xs font-medium">{result.summary.debtRatio}%</span>
              </div>
            </div>

            {/* Category Breakdown */}
            <div className="grid grid-cols-5 gap-2">
              {Object.entries(result.summary.categories).map(([cat, data]) => (
                <div key={cat} className={`p-2 rounded-lg text-center ${debtTypeColors[cat] || 'bg-gray-100'}`}>
                  <p className="text-lg font-bold">{data.count}</p>
                  <p className="text-xs truncate">{cat.replace('_', ' ')}</p>
                </div>
              ))}
            </div>

            {/* Prioritized Actions */}
            {result.prioritizedActions.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase mb-2">Prioritized Actions</p>
                <div className="space-y-2">
                  {result.prioritizedActions.map((action, i) => (
                    <div key={i} className="p-3 bg-blue-50 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${priorityColors[action.priority]}`}>
                          {action.priority}
                        </span>
                        <span className="text-xs text-gray-500">Effort: {action.effort}</span>
                      </div>
                      <p className="text-sm font-medium">{action.action}</p>
                      <p className="text-xs text-gray-600">{action.impact}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Debt Items */}
            {result.items.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase mb-2">Debt Items ({result.items.length})</p>
                <div className="space-y-2">
                  {result.items.slice(0, 10).map((item, i) => (
                    <div key={i} className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${debtTypeColors[item.type]}`}>
                          {item.type.replace('_', ' ')}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${priorityColors[item.priority]}`}>
                          {item.priority}
                        </span>
                        <span className="text-xs text-gray-500 font-mono">{item.file}</span>
                      </div>
                      <p className="text-sm text-gray-700">{item.description}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Clock className="w-3 h-3 text-gray-400" />
                        <span className="text-xs text-gray-500">{item.effort}</span>
                        <div className="flex gap-1">
                          {item.tags.map((tag, j) => (
                            <span key={j} className="px-2 py-0.5 bg-gray-200 rounded text-xs">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                  {result.items.length > 10 && (
                    <p className="text-xs text-gray-500 text-center">
                      +{result.items.length - 10} more items
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
                      <Target className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
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
            <Archive className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>Technical debt analysis will appear here</p>
            <p className="text-sm mt-1">Paste code and analyze</p>
          </div>
        )}
      </Card>
    </div>
  );
}

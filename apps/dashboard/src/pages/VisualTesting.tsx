/**
 * Visual Testing Page
 * Visual regression testing, element detection, and test generation
 */

import { useState, useRef, useCallback } from 'react';
import { useProjectStore } from '../stores/project';
import { api } from '../services/api';
import { Card, Button } from '../components/ui';
import {
  Eye, Image, Layers, FileCode, AlertCircle, Check,
  Copy, ChevronDown, ChevronRight, X, Search,
  AlertTriangle, Target, Zap,
} from 'lucide-react';

type TabType = 'compare' | 'analyze' | 'detect' | 'generate';

// Types from visual analysis agent
type DifferenceSeverity = 'low' | 'medium' | 'high' | 'critical';
type DifferenceCategory = 'layout' | 'color' | 'typography' | 'spacing' | 'content' | 'visibility' | 'size' | 'position' | 'missing' | 'added';

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface VisualDifference {
  id: string;
  category: DifferenceCategory;
  severity: DifferenceSeverity;
  description: string;
  baselineRegion?: BoundingBox;
  currentRegion?: BoundingBox;
  confidence: number;
  suggestion?: string;
}

interface CompareOutput {
  match: boolean;
  similarityScore: number;
  differences: VisualDifference[];
  summary: {
    totalDifferences: number;
    bySeverity: Record<DifferenceSeverity, number>;
    byCategory: Record<string, number>;
    criticalCount: number;
  };
  recommendation: 'pass' | 'review' | 'fail';
  analysisNotes: string;
}

interface RegressionAnalysisOutput {
  type: 'intentional_change' | 'regression' | 'environment_difference' | 'data_difference' | 'timing_issue' | 'unknown';
  confidence: number;
  reasoning: string;
  requiresHumanReview: boolean;
  suggestedAction: 'accept' | 'reject' | 'investigate' | 'update_baseline';
  impact: {
    userExperience: 'none' | 'minor' | 'moderate' | 'major';
    functionality: 'none' | 'minor' | 'moderate' | 'major';
    accessibility: 'none' | 'minor' | 'moderate' | 'major';
  };
  relatedAreas?: string[];
}

interface DetectedElement {
  type: string;
  boundingBox: BoundingBox;
  confidence: number;
  text?: string;
  state?: string;
  accessibility?: {
    hasLabel: boolean;
    suggestedLabel?: string;
    role?: string;
    issues?: string[];
  };
  suggestedSelector?: string;
  suggestedAction?: string;
}

interface DetectElementsOutput {
  elements: DetectedElement[];
  pageStructure: {
    hasHeader: boolean;
    hasFooter: boolean;
    hasNavigation: boolean;
    hasSidebar: boolean;
    mainContentArea?: BoundingBox;
  };
  summary: {
    totalElements: number;
    byType: Record<string, number>;
    averageConfidence: number;
    accessibilityIssues: number;
  };
  pageDescription: string;
}

interface VisualTestStep {
  order: number;
  action: string;
  target?: string;
  data?: string;
  visualAssertions: Array<{
    type: string;
    target: { selector?: string; region?: BoundingBox; elementDescription?: string };
    expected: string;
    tolerance?: number;
  }>;
  waitCondition?: string;
}

interface GeneratedVisualTestCase {
  title: string;
  description: string;
  preconditions: string;
  steps: VisualTestStep[];
  expectedVisualState: string;
  priority: string;
  type: string;
  tags: string[];
  baselineRegions?: Array<{ name: string; region: BoundingBox; tolerance: number }>;
  viewports?: Array<{ width: number; height: number; name: string }>;
}

interface GenerateVisualTestCaseOutput {
  testCases: GeneratedVisualTestCase[];
  summary: {
    total: number;
    byPriority: Record<string, number>;
    byType: Record<string, number>;
    totalAssertions: number;
  };
  baselineConfig: {
    captureFullPage: boolean;
    regions: Array<{ name: string; selector: string; tolerance: number }>;
    ignoreRegions: Array<{ reason: string; selector: string }>;
  };
}

interface ScreenshotData {
  base64: string;
  mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
}

export function VisualTestingPage() {
  const { currentProject } = useProjectStore();
  const [activeTab, setActiveTab] = useState<TabType>('compare');

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
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
            <Eye className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Visual Testing</h1>
            <p className="text-sm text-gray-500">Visual regression testing and UI element detection</p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab('compare')}
            className={`flex items-center gap-2 py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
              activeTab === 'compare'
                ? 'border-emerald-500 text-emerald-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Layers className="w-4 h-4" />
            Compare
          </button>
          <button
            onClick={() => setActiveTab('analyze')}
            className={`flex items-center gap-2 py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
              activeTab === 'analyze'
                ? 'border-emerald-500 text-emerald-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Search className="w-4 h-4" />
            Analyze
          </button>
          <button
            onClick={() => setActiveTab('detect')}
            className={`flex items-center gap-2 py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
              activeTab === 'detect'
                ? 'border-emerald-500 text-emerald-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Target className="w-4 h-4" />
            Detect Elements
          </button>
          <button
            onClick={() => setActiveTab('generate')}
            className={`flex items-center gap-2 py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
              activeTab === 'generate'
                ? 'border-emerald-500 text-emerald-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <FileCode className="w-4 h-4" />
            Generate Tests
          </button>
        </nav>
      </div>

      {activeTab === 'compare' && <ComparePanel projectId={currentProject.id} />}
      {activeTab === 'analyze' && <AnalyzePanel projectId={currentProject.id} />}
      {activeTab === 'detect' && <DetectPanel projectId={currentProject.id} />}
      {activeTab === 'generate' && <GeneratePanel projectId={currentProject.id} />}
    </div>
  );
}

// Severity badge colors
const severityColors: Record<DifferenceSeverity, string> = {
  critical: 'bg-red-100 text-red-700 border-red-200',
  high: 'bg-orange-100 text-orange-700 border-orange-200',
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  low: 'bg-gray-100 text-gray-600 border-gray-200',
};

const severityIcons: Record<DifferenceSeverity, React.ReactNode> = {
  critical: <AlertCircle className="w-3 h-3" />,
  high: <AlertTriangle className="w-3 h-3" />,
  medium: <AlertTriangle className="w-3 h-3" />,
  low: null,
};

// Image upload dropzone component
function ImageDropzone({
  label,
  image,
  onImageUpload,
  onRemove,
}: {
  label: string;
  image: ScreenshotData | null;
  onImageUpload: (file: File) => void;
  onRemove: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) {
        onImageUpload(file);
      }
    },
    [onImageUpload]
  );

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
          image ? 'border-green-300 bg-green-50' : 'border-gray-300 hover:border-emerald-400'
        }`}
        onClick={() => fileInputRef.current?.click()}
      >
        {image ? (
          <div className="space-y-2">
            <img
              src={`data:${image.mediaType};base64,${image.base64}`}
              alt={label}
              className="max-h-40 mx-auto rounded"
            />
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              className="text-sm text-red-500 hover:text-red-700 flex items-center gap-1 mx-auto"
            >
              <X className="w-3 h-3" />
              Remove
            </button>
          </div>
        ) : (
          <>
            <Image className="w-10 h-10 mx-auto text-gray-400 mb-2" />
            <p className="text-sm text-gray-600">Drag & drop or click to upload</p>
            <p className="text-xs text-gray-400 mt-1">PNG, JPG, WEBP</p>
          </>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && onImageUpload(e.target.files[0])}
        />
      </div>
    </div>
  );
}

// Compare Panel - Upload baseline and current screenshots
function ComparePanel({ projectId }: { projectId: string }) {
  const [baseline, setBaseline] = useState<ScreenshotData | null>(null);
  const [current, setCurrent] = useState<ScreenshotData | null>(null);
  const [context, setContext] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CompareOutput | null>(null);
  const [error, setError] = useState('');

  const handleImageUpload = useCallback(
    (file: File, type: 'baseline' | 'current') => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = (e.target?.result as string)?.split(',')[1];
        if (!base64) return;
        const mediaType = file.type as ScreenshotData['mediaType'];
        const data: ScreenshotData = { base64, mediaType };
        if (type === 'baseline') {
          setBaseline(data);
        } else {
          setCurrent(data);
        }
      };
      reader.readAsDataURL(file);
    },
    []
  );

  const handleCompare = async () => {
    if (!baseline || !current) {
      setError('Please upload both baseline and current screenshots');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await api.post<{ data: CompareOutput }>('/visual/compare', {
        projectId,
        baseline: { base64: baseline.base64, mediaType: baseline.mediaType },
        current: { base64: current.base64, mediaType: current.mediaType },
        context: context || undefined,
      });
      setResult(response.data.data);
    } catch (err) {
      setError('Failed to compare screenshots');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Input Panel */}
      <Card title="Screenshot Comparison">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <ImageDropzone
              label="Baseline (Expected)"
              image={baseline}
              onImageUpload={(file) => handleImageUpload(file, 'baseline')}
              onRemove={() => setBaseline(null)}
            />
            <ImageDropzone
              label="Current (Actual)"
              image={current}
              onImageUpload={(file) => handleImageUpload(file, 'current')}
              onRemove={() => setCurrent(null)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Context (optional)
            </label>
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Describe what you're comparing (e.g., 'Login page after recent header changes')"
              className="w-full h-20 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          <Button
            onClick={handleCompare}
            isLoading={loading}
            disabled={!baseline || !current}
            className="w-full bg-emerald-600 hover:bg-emerald-700"
          >
            <Layers className="w-4 h-4 mr-2" />
            Compare Screenshots
          </Button>
        </div>
      </Card>

      {/* Results Panel */}
      <Card title="Comparison Results">
        {result ? (
          <div className="space-y-4">
            {/* Summary */}
            <div className={`p-4 rounded-lg ${
              result.recommendation === 'pass' ? 'bg-green-50 border border-green-200' :
              result.recommendation === 'review' ? 'bg-yellow-50 border border-yellow-200' :
              'bg-red-50 border border-red-200'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">
                  {result.match ? 'Images Match' : 'Differences Found'}
                </span>
                <span className={`px-2 py-1 rounded text-xs font-medium uppercase ${
                  result.recommendation === 'pass' ? 'bg-green-100 text-green-700' :
                  result.recommendation === 'review' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {result.recommendation}
                </span>
              </div>
              <div className="text-sm text-gray-600">
                Similarity: {Math.round(result.similarityScore * 100)}%
              </div>
            </div>

            {/* Severity breakdown */}
            <div className="flex gap-2 flex-wrap">
              {(Object.entries(result.summary.bySeverity) as Array<[DifferenceSeverity, number]>)
                .filter(([, count]) => count > 0)
                .map(([severity, count]) => (
                  <span
                    key={severity}
                    className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 border ${severityColors[severity]}`}
                  >
                    {severityIcons[severity]}
                    {count} {severity}
                  </span>
                ))}
            </div>

            {/* Differences List */}
            <div className="space-y-2 max-h-[300px] overflow-auto">
              {result.differences.map((diff) => (
                <DifferenceCard key={diff.id} difference={diff} />
              ))}
            </div>

            {/* Analysis Notes */}
            {result.analysisNotes && (
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs font-medium text-gray-500 uppercase mb-1">Analysis Notes</p>
                <p className="text-sm text-gray-700">{result.analysisNotes}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-16 text-gray-500">
            <Layers className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>Comparison results will appear here</p>
            <p className="text-sm mt-1">Upload screenshots and compare</p>
          </div>
        )}
      </Card>
    </div>
  );
}

function DifferenceCard({ difference }: { difference: VisualDifference }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`border rounded-lg ${severityColors[difference.severity]}`}>
      <div
        className="flex items-start gap-2 p-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <button className="mt-1 text-gray-400">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded text-xs font-medium border ${severityColors[difference.severity]}`}>
                {difference.severity}
              </span>
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                {difference.category}
              </span>
            </div>
            <span className="text-xs text-gray-400">
              {Math.round(difference.confidence * 100)}% confident
            </span>
          </div>
          <p className="text-sm text-gray-700 mt-1">{difference.description}</p>
        </div>
      </div>

      {expanded && difference.suggestion && (
        <div className="px-9 pb-3">
          <div className="p-2 bg-white/50 rounded border border-current/20">
            <p className="text-xs font-medium text-gray-500">Suggestion</p>
            <p className="text-sm text-gray-700 mt-1">{difference.suggestion}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// Analyze Panel - Analyze a specific difference for regression vs intentional
function AnalyzePanel({ projectId }: { projectId: string }) {
  const [baseline, setBaseline] = useState<ScreenshotData | null>(null);
  const [current, setCurrent] = useState<ScreenshotData | null>(null);
  const [differenceDescription, setDifferenceDescription] = useState('');
  const [changeContext, setChangeContext] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RegressionAnalysisOutput | null>(null);
  const [error, setError] = useState('');

  const handleImageUpload = useCallback(
    (file: File, type: 'baseline' | 'current') => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = (e.target?.result as string)?.split(',')[1];
        if (!base64) return;
        const mediaType = file.type as ScreenshotData['mediaType'];
        const data: ScreenshotData = { base64, mediaType };
        if (type === 'baseline') {
          setBaseline(data);
        } else {
          setCurrent(data);
        }
      };
      reader.readAsDataURL(file);
    },
    []
  );

  const handleAnalyze = async () => {
    if (!baseline || !current || !differenceDescription.trim()) {
      setError('Please upload both screenshots and describe the difference');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await api.post<{ data: RegressionAnalysisOutput }>('/visual/analyze-regression', {
        projectId,
        baseline: { base64: baseline.base64, mediaType: baseline.mediaType },
        current: { base64: current.base64, mediaType: current.mediaType },
        difference: {
          id: 'manual-1',
          category: 'content',
          severity: 'medium',
          description: differenceDescription,
          confidence: 1.0,
        },
        changeContext: changeContext || undefined,
      });
      setResult(response.data.data);
    } catch (err) {
      setError('Failed to analyze regression');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const typeColors: Record<RegressionAnalysisOutput['type'], string> = {
    intentional_change: 'bg-green-100 text-green-700',
    regression: 'bg-red-100 text-red-700',
    environment_difference: 'bg-blue-100 text-blue-700',
    data_difference: 'bg-purple-100 text-purple-700',
    timing_issue: 'bg-orange-100 text-orange-700',
    unknown: 'bg-gray-100 text-gray-700',
  };

  const actionColors: Record<RegressionAnalysisOutput['suggestedAction'], string> = {
    accept: 'bg-green-500 text-white',
    reject: 'bg-red-500 text-white',
    investigate: 'bg-yellow-500 text-white',
    update_baseline: 'bg-blue-500 text-white',
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Input Panel */}
      <Card title="Regression Analysis">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <ImageDropzone
              label="Baseline"
              image={baseline}
              onImageUpload={(file) => handleImageUpload(file, 'baseline')}
              onRemove={() => setBaseline(null)}
            />
            <ImageDropzone
              label="Current"
              image={current}
              onImageUpload={(file) => handleImageUpload(file, 'current')}
              onRemove={() => setCurrent(null)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Difference Description *
            </label>
            <textarea
              value={differenceDescription}
              onChange={(e) => setDifferenceDescription(e.target.value)}
              placeholder="Describe the visual difference you want to analyze (e.g., 'Button color changed from blue to green')"
              className="w-full h-20 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Change Context (optional)
            </label>
            <textarea
              value={changeContext}
              onChange={(e) => setChangeContext(e.target.value)}
              placeholder="PR description, commit message, or any context about recent changes"
              className="w-full h-20 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
            disabled={!baseline || !current || !differenceDescription.trim()}
            className="w-full bg-emerald-600 hover:bg-emerald-700"
          >
            <Search className="w-4 h-4 mr-2" />
            Analyze Regression
          </Button>
        </div>
      </Card>

      {/* Results Panel */}
      <Card title="Analysis Results">
        {result ? (
          <div className="space-y-4">
            {/* Type & Action */}
            <div className="flex items-center justify-between">
              <span className={`px-3 py-1.5 rounded-lg text-sm font-medium ${typeColors[result.type]}`}>
                {result.type.replace(/_/g, ' ')}
              </span>
              <span className={`px-3 py-1.5 rounded-lg text-sm font-medium ${actionColors[result.suggestedAction]}`}>
                {result.suggestedAction.replace(/_/g, ' ')}
              </span>
            </div>

            {/* Confidence */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Confidence:</span>
              <div className="flex-1 bg-gray-200 rounded-full h-2">
                <div
                  className="bg-emerald-500 h-2 rounded-full"
                  style={{ width: `${result.confidence * 100}%` }}
                />
              </div>
              <span className="text-sm font-medium">{Math.round(result.confidence * 100)}%</span>
            </div>

            {/* Reasoning */}
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs font-medium text-gray-500 uppercase mb-1">Reasoning</p>
              <p className="text-sm text-gray-700">{result.reasoning}</p>
            </div>

            {/* Impact */}
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase mb-2">Impact Assessment</p>
              <div className="grid grid-cols-3 gap-2">
                {(Object.entries(result.impact) as Array<[string, string]>).map(([area, level]) => (
                  <div key={area} className="p-2 bg-gray-50 rounded text-center">
                    <p className="text-xs text-gray-500 capitalize">{area.replace(/([A-Z])/g, ' $1')}</p>
                    <p className={`text-sm font-medium ${
                      level === 'none' ? 'text-green-600' :
                      level === 'minor' ? 'text-yellow-600' :
                      level === 'moderate' ? 'text-orange-600' :
                      'text-red-600'
                    }`}>
                      {level}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Human Review Flag */}
            {result.requiresHumanReview && (
              <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-yellow-600" />
                <span className="text-sm text-yellow-700">Requires human review</span>
              </div>
            )}

            {/* Related Areas */}
            {result.relatedAreas && result.relatedAreas.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase mb-2">Related Areas</p>
                <div className="flex flex-wrap gap-1">
                  {result.relatedAreas.map((area) => (
                    <span key={area} className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                      {area}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-16 text-gray-500">
            <Search className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>Analysis results will appear here</p>
            <p className="text-sm mt-1">Upload screenshots and describe the difference</p>
          </div>
        )}
      </Card>
    </div>
  );
}

// Detect Elements Panel
function DetectPanel({ projectId }: { projectId: string }) {
  const [screenshot, setScreenshot] = useState<ScreenshotData | null>(null);
  const [context, setContext] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DetectElementsOutput | null>(null);
  const [error, setError] = useState('');

  const handleImageUpload = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = (e.target?.result as string)?.split(',')[1];
      if (!base64) return;
      const mediaType = file.type as ScreenshotData['mediaType'];
      setScreenshot({ base64, mediaType });
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDetect = async () => {
    if (!screenshot) {
      setError('Please upload a screenshot');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await api.post<{ data: DetectElementsOutput }>('/visual/detect-elements', {
        projectId,
        screenshot: { base64: screenshot.base64, mediaType: screenshot.mediaType },
        context: context || undefined,
        detectNested: true,
        minConfidence: 0.7,
      });
      setResult(response.data.data);
    } catch (err) {
      setError('Failed to detect elements');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Input Panel */}
      <Card title="Element Detection">
        <div className="space-y-4">
          <ImageDropzone
            label="Screenshot"
            image={screenshot}
            onImageUpload={handleImageUpload}
            onRemove={() => setScreenshot(null)}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Page Context (optional)
            </label>
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Describe the page (e.g., 'User profile settings page')"
              className="w-full h-20 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          <Button
            onClick={handleDetect}
            isLoading={loading}
            disabled={!screenshot}
            className="w-full bg-emerald-600 hover:bg-emerald-700"
          >
            <Target className="w-4 h-4 mr-2" />
            Detect Elements
          </Button>
        </div>
      </Card>

      {/* Results Panel */}
      <Card title="Detected Elements">
        {result ? (
          <div className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-4 gap-2">
              <div className="p-2 bg-gray-50 rounded text-center">
                <p className="text-xl font-bold text-gray-900">{result.summary.totalElements}</p>
                <p className="text-xs text-gray-500">Elements</p>
              </div>
              <div className="p-2 bg-gray-50 rounded text-center">
                <p className="text-xl font-bold text-emerald-600">
                  {Math.round(result.summary.averageConfidence * 100)}%
                </p>
                <p className="text-xs text-gray-500">Avg Confidence</p>
              </div>
              <div className="p-2 bg-gray-50 rounded text-center">
                <p className="text-xl font-bold text-blue-600">
                  {Object.keys(result.summary.byType).length}
                </p>
                <p className="text-xs text-gray-500">Types</p>
              </div>
              <div className="p-2 bg-gray-50 rounded text-center">
                <p className={`text-xl font-bold ${result.summary.accessibilityIssues > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                  {result.summary.accessibilityIssues}
                </p>
                <p className="text-xs text-gray-500">A11y Issues</p>
              </div>
            </div>

            {/* Page Description */}
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
              <p className="text-sm text-emerald-700">{result.pageDescription}</p>
            </div>

            {/* Page Structure */}
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase mb-2">Page Structure</p>
              <div className="flex flex-wrap gap-2">
                {result.pageStructure.hasHeader && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">Header</span>
                )}
                {result.pageStructure.hasFooter && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">Footer</span>
                )}
                {result.pageStructure.hasNavigation && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">Navigation</span>
                )}
                {result.pageStructure.hasSidebar && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">Sidebar</span>
                )}
              </div>
            </div>

            {/* Elements by Type */}
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase mb-2">Elements by Type</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(result.summary.byType).map(([type, count]) => (
                  <span key={type} className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                    {type}: {count}
                  </span>
                ))}
              </div>
            </div>

            {/* Elements List */}
            <div className="space-y-2 max-h-[250px] overflow-auto">
              {result.elements.map((element, index) => (
                <ElementCard key={index} element={element} />
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-16 text-gray-500">
            <Target className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>Detected elements will appear here</p>
            <p className="text-sm mt-1">Upload a screenshot to detect UI elements</p>
          </div>
        )}
      </Card>
    </div>
  );
}

function ElementCard({ element }: { element: DetectedElement }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const copySelector = () => {
    if (element.suggestedSelector) {
      navigator.clipboard.writeText(element.suggestedSelector);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg bg-gray-50">
      <div
        className="flex items-start gap-2 p-2 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <button className="mt-0.5 text-gray-400">
          {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-xs font-medium">
              {element.type}
            </span>
            {element.text && (
              <span className="text-xs text-gray-600 truncate">"{element.text}"</span>
            )}
            {element.state && element.state !== 'default' && (
              <span className="px-1.5 py-0.5 bg-purple-100 text-purple-600 rounded text-xs">
                {element.state}
              </span>
            )}
          </div>
        </div>
        <span className="text-xs text-gray-400">{Math.round(element.confidence * 100)}%</span>
      </div>

      {expanded && (
        <div className="px-6 pb-2 space-y-2">
          {element.suggestedSelector && (
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-gray-100 px-2 py-1 rounded font-mono">
                {element.suggestedSelector}
              </code>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  copySelector();
                }}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
          )}
          {element.suggestedAction && (
            <p className="text-xs text-gray-500">
              Action: <span className="text-gray-700">{element.suggestedAction}</span>
            </p>
          )}
          {element.accessibility?.issues && element.accessibility.issues.length > 0 && (
            <div className="text-xs">
              <span className="text-orange-600">A11y Issues:</span>
              <ul className="ml-2 mt-1">
                {element.accessibility.issues.map((issue, i) => (
                  <li key={i} className="text-orange-700">{issue}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Generate Tests Panel
function GeneratePanel({ projectId }: { projectId: string }) {
  const [screenshot, setScreenshot] = useState<ScreenshotData | null>(null);
  const [feature, setFeature] = useState('');
  const [includeResponsive, setIncludeResponsive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GenerateVisualTestCaseOutput | null>(null);
  const [error, setError] = useState('');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleImageUpload = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = (e.target?.result as string)?.split(',')[1];
      if (!base64) return;
      const mediaType = file.type as ScreenshotData['mediaType'];
      setScreenshot({ base64, mediaType });
    };
    reader.readAsDataURL(file);
  }, []);

  const handleGenerate = async () => {
    if (!screenshot) {
      setError('Please upload a screenshot');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await api.post<{ data: GenerateVisualTestCaseOutput }>('/visual/generate-test-case', {
        projectId,
        screenshot: { base64: screenshot.base64, mediaType: screenshot.mediaType },
        feature: feature || undefined,
        includeResponsive,
        maxTestCases: 5,
      });
      setResult(response.data.data);
    } catch (err) {
      setError('Failed to generate test cases');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const copyTestCase = (index: number) => {
    if (!result?.testCases?.[index]) return;
    const tc = result.testCases[index];
    const text = `Title: ${tc.title}\nDescription: ${tc.description}\nPreconditions: ${tc.preconditions}\n\nSteps:\n${tc.steps.map(s => `${s.order}. ${s.action}${s.target ? ` (${s.target})` : ''}`).join('\n')}\n\nExpected Visual State: ${tc.expectedVisualState}\nPriority: ${tc.priority}\nType: ${tc.type}`;
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Input Panel */}
      <Card title="Generate Visual Tests">
        <div className="space-y-4">
          <ImageDropzone
            label="Screenshot"
            image={screenshot}
            onImageUpload={handleImageUpload}
            onRemove={() => setScreenshot(null)}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Feature Name (optional)
            </label>
            <input
              type="text"
              value={feature}
              onChange={(e) => setFeature(e.target.value)}
              placeholder="e.g., User Login, Product Checkout"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="include-responsive"
              checked={includeResponsive}
              onChange={(e) => setIncludeResponsive(e.target.checked)}
              className="rounded border-gray-300 text-emerald-500 focus:ring-emerald-500"
            />
            <label htmlFor="include-responsive" className="text-sm text-gray-700">
              Include responsive viewport testing
            </label>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          <Button
            onClick={handleGenerate}
            isLoading={loading}
            disabled={!screenshot}
            className="w-full bg-emerald-600 hover:bg-emerald-700"
          >
            <Zap className="w-4 h-4 mr-2" />
            Generate Test Cases
          </Button>
        </div>
      </Card>

      {/* Results Panel */}
      <Card title="Generated Test Cases">
        {result?.testCases && result.testCases.length > 0 ? (
          <div className="space-y-4">
            {/* Summary */}
            <div className="flex flex-wrap gap-2 pb-3 border-b border-gray-200">
              <span className="px-2 py-1 bg-gray-100 rounded text-xs font-medium">
                {result.summary.total} test cases
              </span>
              <span className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded text-xs">
                {result.summary.totalAssertions} assertions
              </span>
              {Object.entries(result.summary.byPriority).map(([priority, count]) => (
                <span key={priority} className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs">
                  {priority}: {count}
                </span>
              ))}
            </div>

            {/* Test Cases */}
            <div className="space-y-3 max-h-[400px] overflow-auto">
              {result.testCases.map((tc, index) => (
                <VisualTestCaseCard
                  key={index}
                  testCase={tc}
                  copied={copiedIndex === index}
                  onCopy={() => copyTestCase(index)}
                />
              ))}
            </div>

            {/* Baseline Config */}
            {result.baselineConfig && (
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs font-medium text-gray-500 uppercase mb-2">Baseline Configuration</p>
                <div className="text-xs space-y-1">
                  <p>
                    <span className="text-gray-500">Full Page:</span>{' '}
                    {result.baselineConfig.captureFullPage ? 'Yes' : 'No'}
                  </p>
                  {result.baselineConfig.regions.length > 0 && (
                    <p>
                      <span className="text-gray-500">Regions:</span>{' '}
                      {result.baselineConfig.regions.map(r => r.name).join(', ')}
                    </p>
                  )}
                  {result.baselineConfig.ignoreRegions.length > 0 && (
                    <p>
                      <span className="text-gray-500">Ignore:</span>{' '}
                      {result.baselineConfig.ignoreRegions.map(r => r.reason).join(', ')}
                    </p>
                  )}
                </div>
              </div>
            )}

            <Button variant="secondary" className="w-full">
              Save All to Test Cases
            </Button>
          </div>
        ) : (
          <div className="text-center py-16 text-gray-500">
            <FileCode className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>Generated test cases will appear here</p>
            <p className="text-sm mt-1">Upload a screenshot and generate</p>
          </div>
        )}
      </Card>
    </div>
  );
}

function VisualTestCaseCard({
  testCase,
  copied,
  onCopy,
}: {
  testCase: GeneratedVisualTestCase;
  copied: boolean;
  onCopy: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const priorityColors: Record<string, string> = {
    critical: 'bg-red-100 text-red-700',
    high: 'bg-orange-100 text-orange-700',
    medium: 'bg-yellow-100 text-yellow-700',
    low: 'bg-green-100 text-green-700',
  };

  return (
    <div className="border border-gray-200 rounded-lg bg-gray-50">
      <div
        className="flex items-start gap-2 p-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <button className="mt-1 text-gray-400">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h4 className="font-medium text-gray-900 text-sm">{testCase.title}</h4>
            <div className="flex items-center gap-2 shrink-0">
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${priorityColors[testCase.priority] || 'bg-gray-100'}`}>
                {testCase.priority}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCopy();
                }}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">{testCase.description}</p>
          <div className="flex gap-1 mt-1">
            <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded text-xs">
              {testCase.type}
            </span>
            {testCase.tags.slice(0, 2).map((tag) => (
              <span key={tag} className="px-1.5 py-0.5 bg-gray-200 text-gray-600 rounded text-xs">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="px-3 pb-3 pt-0 pl-9 space-y-3">
          {testCase.preconditions && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase">Preconditions</p>
              <p className="text-sm text-gray-700 mt-1">{testCase.preconditions}</p>
            </div>
          )}
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase">Steps</p>
            <ol className="mt-1 space-y-1">
              {testCase.steps.map((step) => (
                <li key={step.order} className="text-sm text-gray-700">
                  <span className="text-gray-400">{step.order}.</span> {step.action}
                  {step.target && <span className="text-emerald-600 ml-1">({step.target})</span>}
                  {step.visualAssertions.length > 0 && (
                    <span className="ml-2 text-xs text-purple-600">
                      [{step.visualAssertions.length} assertions]
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase">Expected Visual State</p>
            <p className="text-sm text-gray-700 mt-1">{testCase.expectedVisualState}</p>
          </div>
          {testCase.viewports && testCase.viewports.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase">Viewports</p>
              <div className="flex gap-1 mt-1">
                {testCase.viewports.map((vp) => (
                  <span key={vp.name} className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                    {vp.name} ({vp.width}x{vp.height})
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

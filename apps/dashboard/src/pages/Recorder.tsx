/**
 * Recorder Page
 * Convert browser recordings to automation scripts
 */

import { useState, useCallback } from 'react';
import { useProjectStore } from '../stores/project';
import { api } from '../services/api';
import { Card, Button } from '../components/ui';
import {
  Video, Code, Wand2, Shield, Zap,
  AlertCircle, Copy, Check, ChevronDown, ChevronRight,
  Upload, FileJson, Trash2, Settings,
} from 'lucide-react';

type TabType = 'convert' | 'optimize' | 'assertions' | 'pipeline';

// Types from recorder agent
type AutomationFramework = 'playwright' | 'cypress' | 'selenium';
type OutputLanguage = 'typescript' | 'javascript' | 'python' | 'java' | 'csharp';

interface RecordedAction {
  id: string;
  type: string;
  timestamp: number;
  target: Record<string, unknown>;
  value?: string;
  metadata?: Record<string, unknown>;
}

interface Recording {
  id: string;
  name?: string;
  url: string;
  viewport: { width: number; height: number };
  browser: string;
  actions: RecordedAction[];
  duration: number;
  recordedAt: string;
}

interface GeneratedScript {
  name: string;
  code: string;
  language: OutputLanguage;
  framework: AutomationFramework;
  pageObjects?: Array<{ name: string; code: string }>;
  utilities?: Array<{ name: string; code: string }>;
  dependencies: string[];
  notes?: string[];
}

interface OptimizedRecording {
  recording: Recording;
  removedActions: RecordedAction[];
  modifiedActions: Array<{
    original: RecordedAction;
    modified: RecordedAction;
    reason: string;
  }>;
  addedActions: RecordedAction[];
  suggestions: Array<{
    actionIds: string[];
    type: string;
    description: string;
    priority: string;
    applied: boolean;
  }>;
  summary: {
    originalActionCount: number;
    optimizedActionCount: number;
    removedCount: number;
    modifiedCount: number;
    addedCount: number;
    estimatedTimeReduction: number;
  };
}

interface GeneratedAssertion {
  afterActionId: string;
  type: string;
  target?: Record<string, unknown>;
  expectedValue?: string;
  description: string;
  confidence: number;
  code: {
    playwright?: string;
    cypress?: string;
    selenium?: string;
  };
}

interface AssertionResult {
  assertions: GeneratedAssertion[];
  summary: {
    total: number;
    byType: Record<string, number>;
    averageConfidence: number;
  };
}

interface PipelineResult {
  script: GeneratedScript;
  optimization?: OptimizedRecording;
  assertions?: AssertionResult;
}

// Framework badges
const frameworkColors: Record<AutomationFramework, string> = {
  playwright: 'bg-green-100 text-green-700 border-green-200',
  cypress: 'bg-teal-100 text-teal-700 border-teal-200',
  selenium: 'bg-orange-100 text-orange-700 border-orange-200',
};

const languageColors: Record<OutputLanguage, string> = {
  typescript: 'bg-blue-100 text-blue-700 border-blue-200',
  javascript: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  python: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  java: 'bg-red-100 text-red-700 border-red-200',
  csharp: 'bg-purple-100 text-purple-700 border-purple-200',
};

export function RecorderPage() {
  const { currentProject } = useProjectStore();
  const [activeTab, setActiveTab] = useState<TabType>('convert');

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
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
            <Video className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Recorder</h1>
            <p className="text-sm text-gray-500">Convert browser recordings to automation scripts</p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab('convert')}
            className={`flex items-center gap-2 py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
              activeTab === 'convert'
                ? 'border-purple-500 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Code className="w-4 h-4" />
            Convert
          </button>
          <button
            onClick={() => setActiveTab('optimize')}
            className={`flex items-center gap-2 py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
              activeTab === 'optimize'
                ? 'border-purple-500 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Wand2 className="w-4 h-4" />
            Optimize
          </button>
          <button
            onClick={() => setActiveTab('assertions')}
            className={`flex items-center gap-2 py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
              activeTab === 'assertions'
                ? 'border-purple-500 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Shield className="w-4 h-4" />
            Assertions
          </button>
          <button
            onClick={() => setActiveTab('pipeline')}
            className={`flex items-center gap-2 py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
              activeTab === 'pipeline'
                ? 'border-purple-500 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Zap className="w-4 h-4" />
            Full Pipeline
          </button>
        </nav>
      </div>

      {activeTab === 'convert' && <ConvertPanel projectId={currentProject.id} />}
      {activeTab === 'optimize' && <OptimizePanel projectId={currentProject.id} />}
      {activeTab === 'assertions' && <AssertionsPanel projectId={currentProject.id} />}
      {activeTab === 'pipeline' && <PipelinePanel projectId={currentProject.id} />}
    </div>
  );
}

// Recording Input Component
function RecordingInput({
  recording,
  onRecordingChange,
  onClear,
}: {
  recording: string;
  onRecordingChange: (value: string) => void;
  onClear: () => void;
}) {
  const fileInputRef = { current: null as HTMLInputElement | null };

  const handleFileUpload = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      onRecordingChange(content);
    };
    reader.readAsText(file);
  }, [onRecordingChange]);

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
          Recording JSON
        </label>
        {recording && (
          <button
            onClick={onClear}
            className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
          >
            <Trash2 className="w-3 h-3" />
            Clear
          </button>
        )}
      </div>

      {!recording ? (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-purple-400 transition-colors"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="w-10 h-10 mx-auto text-gray-400 mb-2" />
          <p className="text-sm text-gray-600">Drag & drop JSON file or click to upload</p>
          <p className="text-xs text-gray-400 mt-1">Or paste recording JSON below</p>
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
        value={recording}
        onChange={(e) => onRecordingChange(e.target.value)}
        placeholder={recording ? '' : '{"id": "rec-1", "url": "https://example.com", "viewport": {"width": 1920, "height": 1080}, "browser": "chromium", "actions": [...], "duration": 5000}'}
        className="w-full h-48 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-500"
      />
    </div>
  );
}

// Code Output Component
function CodeOutput({
  code,
  language,
  framework,
  onCopy,
  copied,
}: {
  code: string;
  language?: OutputLanguage;
  framework?: AutomationFramework;
  onCopy: () => void;
  copied: boolean;
}) {
  return (
    <div className="space-y-3">
      {(language || framework) && (
        <div className="flex gap-2">
          {framework && (
            <span className={`px-2 py-1 rounded text-xs font-medium border ${frameworkColors[framework]}`}>
              {framework}
            </span>
          )}
          {language && (
            <span className={`px-2 py-1 rounded text-xs font-medium border ${languageColors[language]}`}>
              {language}
            </span>
          )}
        </div>
      )}
      <div className="relative">
        <div className="bg-gray-900 rounded-lg p-4 overflow-auto max-h-[400px]">
          <pre className="text-sm text-green-400 font-mono whitespace-pre-wrap">
            {code}
          </pre>
        </div>
        <button
          onClick={onCopy}
          className="absolute top-2 right-2 p-2 bg-gray-800 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
          title="Copy to clipboard"
        >
          {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

// Convert Panel
function ConvertPanel({ projectId }: { projectId: string }) {
  const [recording, setRecording] = useState('');
  const [framework, setFramework] = useState<AutomationFramework>('playwright');
  const [language, setLanguage] = useState<OutputLanguage>('typescript');
  const [includePageObjects, setIncludePageObjects] = useState(false);
  const [includeComments, setIncludeComments] = useState(true);
  const [selectorPreference, setSelectorPreference] = useState<string>('role');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GeneratedScript | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const handleConvert = async () => {
    if (!recording.trim()) {
      setError('Please provide a recording JSON');
      return;
    }

    let parsedRecording: Recording;
    try {
      parsedRecording = JSON.parse(recording);
    } catch {
      setError('Invalid JSON format');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await api.post<{ data: GeneratedScript }>('/recorder/convert', {
        projectId,
        recording: parsedRecording,
        options: {
          framework,
          language,
          includePageObjects,
          includeComments,
          selectorPreference: [selectorPreference, 'testid', 'text', 'css'],
        },
      });
      setResult(response.data.data);
    } catch (err) {
      setError('Failed to convert recording');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (result?.code) {
      navigator.clipboard.writeText(result.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Input Panel */}
      <Card title="Recording Input">
        <div className="space-y-4">
          <RecordingInput
            recording={recording}
            onRecordingChange={setRecording}
            onClear={() => setRecording('')}
          />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Framework
              </label>
              <select
                value={framework}
                onChange={(e) => setFramework(e.target.value as AutomationFramework)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="playwright">Playwright</option>
                <option value="cypress">Cypress</option>
                <option value="selenium">Selenium</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Language
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as OutputLanguage)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="typescript">TypeScript</option>
                <option value="javascript">JavaScript</option>
                <option value="python">Python</option>
                <option value="java">Java</option>
                <option value="csharp">C#</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Selector Preference
            </label>
            <select
              value={selectorPreference}
              onChange={(e) => setSelectorPreference(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="role">Role (Accessibility)</option>
              <option value="testid">Test ID</option>
              <option value="text">Text Content</option>
              <option value="css">CSS Selector</option>
              <option value="xpath">XPath</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={includePageObjects}
                onChange={(e) => setIncludePageObjects(e.target.checked)}
                className="rounded border-gray-300 text-purple-500 focus:ring-purple-500"
              />
              <span className="text-sm text-gray-700">Include Page Objects</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={includeComments}
                onChange={(e) => setIncludeComments(e.target.checked)}
                className="rounded border-gray-300 text-purple-500 focus:ring-purple-500"
              />
              <span className="text-sm text-gray-700">Include Comments</span>
            </label>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          <Button
            onClick={handleConvert}
            isLoading={loading}
            disabled={!recording.trim()}
            className="w-full bg-purple-600 hover:bg-purple-700"
          >
            <Code className="w-4 h-4 mr-2" />
            Convert to Script
          </Button>
        </div>
      </Card>

      {/* Output Panel */}
      <Card title="Generated Script">
        {result?.code ? (
          <div className="space-y-4">
            <CodeOutput
              code={result.code}
              language={result.language}
              framework={result.framework}
              onCopy={copyToClipboard}
              copied={copied}
            />

            {result.dependencies.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase mb-2">Dependencies</p>
                <div className="flex flex-wrap gap-1">
                  {result.dependencies.map((dep) => (
                    <span key={dep} className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs font-mono">
                      {dep}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {result.notes && result.notes.length > 0 && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-xs font-medium text-yellow-700 uppercase mb-1">Notes</p>
                <ul className="text-sm text-yellow-700 list-disc list-inside">
                  {result.notes.map((note, i) => (
                    <li key={i}>{note}</li>
                  ))}
                </ul>
              </div>
            )}

            {result.pageObjects && result.pageObjects.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase mb-2">Page Objects</p>
                {result.pageObjects.map((po) => (
                  <PageObjectCard key={po.name} pageObject={po} />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-16 text-gray-500">
            <Code className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>Generated script will appear here</p>
            <p className="text-sm mt-1">Paste recording JSON and convert</p>
          </div>
        )}
      </Card>
    </div>
  );
}

function PageObjectCard({ pageObject }: { pageObject: { name: string; code: string } }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyCode = () => {
    navigator.clipboard.writeText(pageObject.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="border border-gray-200 rounded-lg mb-2">
      <div
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          <FileJson className="w-4 h-4 text-purple-500" />
          <span className="text-sm font-medium">{pageObject.name}</span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            copyCode();
          }}
          className="p-1 text-gray-400 hover:text-gray-600"
        >
          {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
      {expanded && (
        <div className="border-t border-gray-200 p-3 bg-gray-900 rounded-b-lg">
          <pre className="text-sm text-green-400 font-mono overflow-auto max-h-64">
            {pageObject.code}
          </pre>
        </div>
      )}
    </div>
  );
}

// Optimize Panel
function OptimizePanel({ projectId }: { projectId: string }) {
  const [recording, setRecording] = useState('');
  const [removeDuplicates, setRemoveDuplicates] = useState(true);
  const [mergeTypeActions, setMergeTypeActions] = useState(true);
  const [removeUnnecessaryScrolls, setRemoveUnnecessaryScrolls] = useState(true);
  const [improveSelectors, setImproveSelectors] = useState(true);
  const [addSmartWaits, setAddSmartWaits] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<OptimizedRecording | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const handleOptimize = async () => {
    if (!recording.trim()) {
      setError('Please provide a recording JSON');
      return;
    }

    let parsedRecording: Recording;
    try {
      parsedRecording = JSON.parse(recording);
    } catch {
      setError('Invalid JSON format');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await api.post<{ data: OptimizedRecording }>('/recorder/optimize', {
        projectId,
        recording: parsedRecording,
        options: {
          removeDuplicates,
          mergeTypeActions,
          removeUnnecessaryScrolls,
          improveSelectors,
          addSmartWaits,
        },
      });
      setResult(response.data.data);
    } catch (err) {
      setError('Failed to optimize recording');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const copyOptimized = () => {
    if (result?.recording) {
      navigator.clipboard.writeText(JSON.stringify(result.recording, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Input Panel */}
      <Card title="Recording Optimization">
        <div className="space-y-4">
          <RecordingInput
            recording={recording}
            onRecordingChange={setRecording}
            onClear={() => setRecording('')}
          />

          <div className="p-3 bg-gray-50 rounded-lg space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <Settings className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Optimization Options</span>
            </div>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={removeDuplicates}
                onChange={(e) => setRemoveDuplicates(e.target.checked)}
                className="rounded border-gray-300 text-purple-500 focus:ring-purple-500"
              />
              <span className="text-sm text-gray-700">Remove duplicate actions</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={mergeTypeActions}
                onChange={(e) => setMergeTypeActions(e.target.checked)}
                className="rounded border-gray-300 text-purple-500 focus:ring-purple-500"
              />
              <span className="text-sm text-gray-700">Merge consecutive type actions</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={removeUnnecessaryScrolls}
                onChange={(e) => setRemoveUnnecessaryScrolls(e.target.checked)}
                className="rounded border-gray-300 text-purple-500 focus:ring-purple-500"
              />
              <span className="text-sm text-gray-700">Remove unnecessary scrolls</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={improveSelectors}
                onChange={(e) => setImproveSelectors(e.target.checked)}
                className="rounded border-gray-300 text-purple-500 focus:ring-purple-500"
              />
              <span className="text-sm text-gray-700">Improve selector robustness</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={addSmartWaits}
                onChange={(e) => setAddSmartWaits(e.target.checked)}
                className="rounded border-gray-300 text-purple-500 focus:ring-purple-500"
              />
              <span className="text-sm text-gray-700">Add smart waits</span>
            </label>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          <Button
            onClick={handleOptimize}
            isLoading={loading}
            disabled={!recording.trim()}
            className="w-full bg-purple-600 hover:bg-purple-700"
          >
            <Wand2 className="w-4 h-4 mr-2" />
            Optimize Recording
          </Button>
        </div>
      </Card>

      {/* Output Panel */}
      <Card title="Optimization Results">
        {result ? (
          <div className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-2">
              <div className="p-3 bg-gray-50 rounded-lg text-center">
                <p className="text-2xl font-bold text-gray-900">{result.summary.originalActionCount}</p>
                <p className="text-xs text-gray-500">Original</p>
              </div>
              <div className="p-3 bg-green-50 rounded-lg text-center">
                <p className="text-2xl font-bold text-green-600">{result.summary.optimizedActionCount}</p>
                <p className="text-xs text-gray-500">Optimized</p>
              </div>
              <div className="p-3 bg-purple-50 rounded-lg text-center">
                <p className="text-2xl font-bold text-purple-600">{result.summary.estimatedTimeReduction}%</p>
                <p className="text-xs text-gray-500">Time Saved</p>
              </div>
            </div>

            {/* Changes breakdown */}
            <div className="flex flex-wrap gap-2">
              {result.summary.removedCount > 0 && (
                <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs">
                  {result.summary.removedCount} removed
                </span>
              )}
              {result.summary.modifiedCount > 0 && (
                <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs">
                  {result.summary.modifiedCount} modified
                </span>
              )}
              {result.summary.addedCount > 0 && (
                <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
                  {result.summary.addedCount} added
                </span>
              )}
            </div>

            {/* Suggestions */}
            {result.suggestions.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase mb-2">Optimizations Applied</p>
                <div className="space-y-2 max-h-[200px] overflow-auto">
                  {result.suggestions.map((suggestion, i) => (
                    <div
                      key={i}
                      className={`p-2 rounded text-sm ${
                        suggestion.applied ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-600'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {suggestion.applied && <Check className="w-3 h-3" />}
                        <span className={`px-1.5 py-0.5 rounded text-xs ${
                          suggestion.priority === 'high' ? 'bg-red-100 text-red-600' :
                          suggestion.priority === 'medium' ? 'bg-yellow-100 text-yellow-600' :
                          'bg-gray-100 text-gray-500'
                        }`}>
                          {suggestion.priority}
                        </span>
                        <span>{suggestion.description}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Optimized JSON */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-gray-500 uppercase">Optimized Recording</p>
                <button
                  onClick={copyOptimized}
                  className="text-xs text-purple-600 hover:text-purple-700 flex items-center gap-1"
                >
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copied ? 'Copied!' : 'Copy JSON'}
                </button>
              </div>
              <div className="bg-gray-900 rounded-lg p-3 overflow-auto max-h-[200px]">
                <pre className="text-xs text-green-400 font-mono">
                  {JSON.stringify(result.recording, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-16 text-gray-500">
            <Wand2 className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>Optimization results will appear here</p>
            <p className="text-sm mt-1">Paste recording JSON and optimize</p>
          </div>
        )}
      </Card>
    </div>
  );
}

// Assertions Panel
function AssertionsPanel({ projectId }: { projectId: string }) {
  const [recording, setRecording] = useState('');
  const [hints, setHints] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AssertionResult | null>(null);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    if (!recording.trim()) {
      setError('Please provide a recording JSON');
      return;
    }

    let parsedRecording: Recording;
    try {
      parsedRecording = JSON.parse(recording);
    } catch {
      setError('Invalid JSON format');
      return;
    }

    const parsedHints = hints.trim()
      ? hints.split('\n').filter(h => h.trim()).map(h => ({ description: h.trim() }))
      : undefined;

    setLoading(true);
    setError('');
    try {
      const response = await api.post<{ data: AssertionResult }>('/recorder/assertions', {
        projectId,
        recording: parsedRecording,
        hints: parsedHints,
      });
      setResult(response.data.data);
    } catch (err) {
      setError('Failed to generate assertions');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Input Panel */}
      <Card title="Assertion Generation">
        <div className="space-y-4">
          <RecordingInput
            recording={recording}
            onRecordingChange={setRecording}
            onClear={() => setRecording('')}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Assertion Hints (optional, one per line)
            </label>
            <textarea
              value={hints}
              onChange={(e) => setHints(e.target.value)}
              placeholder="Verify login success message appears&#10;Check user profile is visible&#10;Ensure form submits successfully"
              className="w-full h-24 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
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
            disabled={!recording.trim()}
            className="w-full bg-purple-600 hover:bg-purple-700"
          >
            <Shield className="w-4 h-4 mr-2" />
            Generate Assertions
          </Button>
        </div>
      </Card>

      {/* Output Panel */}
      <Card title="Generated Assertions">
        {result ? (
          <div className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-2">
              <div className="p-3 bg-purple-50 rounded-lg text-center">
                <p className="text-2xl font-bold text-purple-600">{result.summary.total}</p>
                <p className="text-xs text-gray-500">Total Assertions</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg text-center">
                <p className="text-2xl font-bold text-gray-900">{Object.keys(result.summary.byType).length}</p>
                <p className="text-xs text-gray-500">Types</p>
              </div>
              <div className="p-3 bg-green-50 rounded-lg text-center">
                <p className="text-2xl font-bold text-green-600">{Math.round(result.summary.averageConfidence * 100)}%</p>
                <p className="text-xs text-gray-500">Avg Confidence</p>
              </div>
            </div>

            {/* Type breakdown */}
            <div className="flex flex-wrap gap-2">
              {Object.entries(result.summary.byType).map(([type, count]) => (
                <span key={type} className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs">
                  {type}: {count}
                </span>
              ))}
            </div>

            {/* Assertions List */}
            <div className="space-y-2 max-h-[350px] overflow-auto">
              {result.assertions.map((assertion, index) => (
                <AssertionCard key={index} assertion={assertion} />
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-16 text-gray-500">
            <Shield className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>Generated assertions will appear here</p>
            <p className="text-sm mt-1">Paste recording JSON and generate</p>
          </div>
        )}
      </Card>
    </div>
  );
}

function AssertionCard({ assertion }: { assertion: GeneratedAssertion }) {
  const [expanded, setExpanded] = useState(false);
  const [copiedFramework, setCopiedFramework] = useState<string | null>(null);

  const copyCode = (framework: string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedFramework(framework);
    setTimeout(() => setCopiedFramework(null), 2000);
  };

  const confidenceColor = assertion.confidence >= 0.9 ? 'text-green-600' :
    assertion.confidence >= 0.7 ? 'text-yellow-600' : 'text-orange-600';

  return (
    <div className="border border-gray-200 rounded-lg bg-gray-50">
      <div
        className="flex items-start gap-2 p-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <button className="mt-0.5 text-gray-400">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-medium">
              {assertion.type}
            </span>
            <span className={`text-xs ${confidenceColor}`}>
              {Math.round(assertion.confidence * 100)}% confident
            </span>
          </div>
          <p className="text-sm text-gray-700 mt-1">{assertion.description}</p>
        </div>
      </div>

      {expanded && (
        <div className="px-9 pb-3 space-y-2">
          {Object.entries(assertion.code).map(([framework, code]) => (
            code && (
              <div key={framework} className="flex items-start gap-2">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                  frameworkColors[framework as AutomationFramework] || 'bg-gray-100 text-gray-600'
                }`}>
                  {framework}
                </span>
                <code className="flex-1 text-xs bg-gray-900 text-green-400 px-2 py-1 rounded font-mono overflow-auto">
                  {code}
                </code>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    copyCode(framework, code);
                  }}
                  className="p-1 text-gray-400 hover:text-gray-600"
                >
                  {copiedFramework === framework ? (
                    <Check className="w-3 h-3 text-green-500" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
              </div>
            )
          ))}
        </div>
      )}
    </div>
  );
}

// Pipeline Panel
function PipelinePanel({ projectId }: { projectId: string }) {
  const [recording, setRecording] = useState('');
  const [framework, setFramework] = useState<AutomationFramework>('playwright');
  const [language, setLanguage] = useState<OutputLanguage>('typescript');
  const [skipOptimization, setSkipOptimization] = useState(false);
  const [skipAssertions, setSkipAssertions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const handleProcess = async () => {
    if (!recording.trim()) {
      setError('Please provide a recording JSON');
      return;
    }

    let parsedRecording: Recording;
    try {
      parsedRecording = JSON.parse(recording);
    } catch {
      setError('Invalid JSON format');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await api.post<{ data: PipelineResult }>('/recorder/process', {
        projectId,
        recording: parsedRecording,
        options: {
          conversion: {
            framework,
            language,
            includeComments: true,
          },
          skipOptimization,
          skipAssertions,
        },
      });
      setResult(response.data.data);
    } catch (err) {
      setError('Failed to process recording');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (result?.script?.code) {
      navigator.clipboard.writeText(result.script.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Input Panel */}
      <Card title="Full Pipeline">
        <div className="space-y-4">
          <RecordingInput
            recording={recording}
            onRecordingChange={setRecording}
            onClear={() => setRecording('')}
          />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Framework
              </label>
              <select
                value={framework}
                onChange={(e) => setFramework(e.target.value as AutomationFramework)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="playwright">Playwright</option>
                <option value="cypress">Cypress</option>
                <option value="selenium">Selenium</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Language
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as OutputLanguage)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="typescript">TypeScript</option>
                <option value="javascript">JavaScript</option>
                <option value="python">Python</option>
                <option value="java">Java</option>
                <option value="csharp">C#</option>
              </select>
            </div>
          </div>

          <div className="p-3 bg-gray-50 rounded-lg space-y-2">
            <p className="text-sm font-medium text-gray-700">Pipeline Steps</p>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={!skipOptimization}
                onChange={(e) => setSkipOptimization(!e.target.checked)}
                className="rounded border-gray-300 text-purple-500 focus:ring-purple-500"
              />
              <span className="text-sm text-gray-700">Optimize recording</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={!skipAssertions}
                onChange={(e) => setSkipAssertions(!e.target.checked)}
                className="rounded border-gray-300 text-purple-500 focus:ring-purple-500"
              />
              <span className="text-sm text-gray-700">Generate assertions</span>
            </label>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          <Button
            onClick={handleProcess}
            isLoading={loading}
            disabled={!recording.trim()}
            className="w-full bg-purple-600 hover:bg-purple-700"
          >
            <Zap className="w-4 h-4 mr-2" />
            Process Recording
          </Button>
        </div>
      </Card>

      {/* Output Panel */}
      <Card title="Pipeline Results">
        {result ? (
          <div className="space-y-4">
            {/* Pipeline summary */}
            <div className="flex flex-wrap gap-2 pb-3 border-b border-gray-200">
              <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs flex items-center gap-1">
                <Check className="w-3 h-3" />
                Script Generated
              </span>
              {result.optimization && (
                <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  Optimized ({result.optimization.summary.removedCount} removed)
                </span>
              )}
              {result.assertions && (
                <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  {result.assertions.summary.total} Assertions
                </span>
              )}
            </div>

            {/* Generated Script */}
            <CodeOutput
              code={result.script.code}
              language={result.script.language}
              framework={result.script.framework}
              onCopy={copyToClipboard}
              copied={copied}
            />

            {result.script.dependencies.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase mb-2">Dependencies</p>
                <div className="flex flex-wrap gap-1">
                  {result.script.dependencies.map((dep) => (
                    <span key={dep} className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs font-mono">
                      {dep}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={copyToClipboard}>
                <Copy className="w-4 h-4 mr-2" />
                Copy Script
              </Button>
              <Button variant="secondary" className="flex-1">
                Save to Scripts
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-16 text-gray-500">
            <Zap className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>Pipeline results will appear here</p>
            <p className="text-sm mt-1">Optimize, add assertions, and generate script</p>
          </div>
        )}
      </Card>
    </div>
  );
}

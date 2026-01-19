/**
 * AI Generator (TestWeaver) Page
 * AI-powered test case generation from requirements
 * Sprint 8: Added screenshot, file upload, multi-turn, batch, AI mapping
 */

import { useState, useRef, useCallback } from 'react';
import { useProjectStore } from '../stores/project';
import { api } from '../services/api';
import { Card, Button } from '../components/ui';
import {
  Wand2, FileText, Sparkles, RefreshCw, Copy, Check,
  Upload, Image, MessageSquare, Layers, Tag, X,
  ChevronDown, ChevronRight, AlertCircle
} from 'lucide-react';

type InputMethod = 'specification' | 'natural_language' | 'screenshot' | 'file_upload' | 'conversation';

interface GeneratedTestCase {
  title: string;
  description: string;
  preconditions: string;
  steps: Array<{ order: number; action: string; expected: string }>;
  expectedResult: string;
  priority: string;
  type: string;
  tags: string[];
}

interface AIMapping {
  product?: string;
  partner?: string;
  module?: string;
  confidence: { product: number; partner: number; module: number };
  suggestedTags: string[];
}

interface GenerateResult {
  testCases: GeneratedTestCase[];
  summary: {
    total: number;
    byPriority: Record<string, number>;
    byType: Record<string, number>;
  };
  mapping?: AIMapping;
}

export function AIGeneratorPage() {
  const { currentProject } = useProjectStore();
  const [activeTab, setActiveTab] = useState<'generate' | 'evolve' | 'batch'>('generate');

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
            onClick={() => setActiveTab('batch')}
            className={`flex items-center gap-2 py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
              activeTab === 'batch'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Layers className="w-4 h-4" />
            Batch Generate
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
      {activeTab === 'batch' && <BatchPanel projectId={currentProject.id} />}
      {activeTab === 'evolve' && <EvolvePanel projectId={currentProject.id} />}
    </div>
  );
}

function GeneratePanel({ projectId }: { projectId: string }) {
  const [inputMethod, setInputMethod] = useState<InputMethod>('natural_language');
  const [requirement, setRequirement] = useState('');
  const [testTypes, setTestTypes] = useState<string[]>(['functional']);
  const [includeMapping, setIncludeMapping] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [error, setError] = useState('');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Screenshot state
  const [screenshot, setScreenshot] = useState<{ base64: string; mediaType: string } | null>(null);
  const [screenshotContext, setScreenshotContext] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // File upload state
  const [uploadedFile, setUploadedFile] = useState<{ content: string; fileName: string; mimeType: string } | null>(null);

  // Conversation state
  const [conversation, setConversation] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [newMessage, setNewMessage] = useState('');

  const handleScreenshotUpload = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = (e.target?.result as string)?.split(',')[1];
      if (!base64) return;
      const mediaType = file.type as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
      setScreenshot({ base64, mediaType });
    };
    reader.readAsDataURL(file);
  }, []);

  const handleFileUpload = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const mimeType = file.type || 'text/plain';
      setUploadedFile({ content, fileName: file.name, mimeType });
    };
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;

    if (inputMethod === 'screenshot' && file.type.startsWith('image/')) {
      handleScreenshotUpload(file);
    } else if (inputMethod === 'file_upload') {
      handleFileUpload(file);
    }
  }, [inputMethod, handleScreenshotUpload, handleFileUpload]);

  const addConversationMessage = () => {
    if (!newMessage.trim()) return;
    setConversation(prev => [...prev, { role: 'user', content: newMessage }]);
    setNewMessage('');
  };

  const handleGenerate = async () => {
    setLoading(true);
    setError('');
    try {
      const payload: Record<string, unknown> = {
        projectId,
        inputMethod,
        options: {
          testTypes,
          includeMapping,
          includeNegativeCases: true,
          includeEdgeCases: true,
        },
      };

      if (inputMethod === 'natural_language' || inputMethod === 'specification') {
        if (!requirement.trim()) {
          setError('Please enter a requirement');
          setLoading(false);
          return;
        }
        payload.specification = requirement;
      } else if (inputMethod === 'screenshot') {
        if (!screenshot) {
          setError('Please upload a screenshot');
          setLoading(false);
          return;
        }
        payload.screenshot = {
          base64: screenshot.base64,
          mediaType: screenshot.mediaType,
          context: screenshotContext || undefined,
        };
      } else if (inputMethod === 'file_upload') {
        if (!uploadedFile) {
          setError('Please upload a file');
          setLoading(false);
          return;
        }
        payload.fileUpload = {
          content: uploadedFile.content,
          fileName: uploadedFile.fileName,
          mimeType: uploadedFile.mimeType,
        };
      } else if (inputMethod === 'conversation') {
        if (conversation.length === 0) {
          setError('Please add at least one message');
          setLoading(false);
          return;
        }
        payload.conversation = conversation;
      }

      const response = await api.post<{ data: GenerateResult }>('/ai/test-weaver/generate', payload);
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
    const text = `Title: ${tc.title}\nDescription: ${tc.description}\nPreconditions: ${tc.preconditions}\n\nSteps:\n${tc.steps.map(s => `${s.order}. ${s.action} → ${s.expected}`).join('\n')}\n\nExpected Result: ${tc.expectedResult}\nPriority: ${tc.priority}\nType: ${tc.type}`;
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const inputMethods: Array<{ id: InputMethod; label: string; icon: React.ReactNode; description: string }> = [
    { id: 'natural_language', label: 'Text', icon: <FileText className="w-4 h-4" />, description: 'Describe requirements in natural language' },
    { id: 'screenshot', label: 'Screenshot', icon: <Image className="w-4 h-4" />, description: 'Upload UI screenshot for analysis' },
    { id: 'file_upload', label: 'File', icon: <Upload className="w-4 h-4" />, description: 'Upload CSV, JSON, or text file' },
    { id: 'conversation', label: 'Chat', icon: <MessageSquare className="w-4 h-4" />, description: 'Multi-turn conversation with AI' },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Input Panel */}
      <Card title="Test Case Generation">
        <div className="space-y-4">
          {/* Input Method Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Input Method</label>
            <div className="grid grid-cols-2 gap-2">
              {inputMethods.map(method => (
                <button
                  key={method.id}
                  onClick={() => setInputMethod(method.id)}
                  className={`flex items-center gap-2 p-3 rounded-lg border text-left transition-all ${
                    inputMethod === method.id
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300 text-gray-600'
                  }`}
                >
                  {method.icon}
                  <div>
                    <p className="text-sm font-medium">{method.label}</p>
                    <p className="text-xs text-gray-500">{method.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Dynamic Input Based on Method */}
          {(inputMethod === 'natural_language' || inputMethod === 'specification') && (
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
          )}

          {inputMethod === 'screenshot' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Upload Screenshot
              </label>
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                  screenshot ? 'border-green-300 bg-green-50' : 'border-gray-300 hover:border-blue-400'
                }`}
                onClick={() => fileInputRef.current?.click()}
              >
                {screenshot ? (
                  <div className="space-y-2">
                    <img
                      src={`data:${screenshot.mediaType};base64,${screenshot.base64}`}
                      alt="Uploaded screenshot"
                      className="max-h-48 mx-auto rounded"
                    />
                    <button
                      onClick={(e) => { e.stopPropagation(); setScreenshot(null); }}
                      className="text-sm text-red-500 hover:text-red-700"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <>
                    <Image className="w-12 h-12 mx-auto text-gray-400 mb-2" />
                    <p className="text-sm text-gray-600">Drag & drop or click to upload</p>
                    <p className="text-xs text-gray-400">PNG, JPG, GIF, WEBP</p>
                  </>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleScreenshotUpload(e.target.files[0])}
                />
              </div>
              <textarea
                value={screenshotContext}
                onChange={(e) => setScreenshotContext(e.target.value)}
                placeholder="Additional context about the screenshot (optional)..."
                className="w-full mt-2 h-20 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {inputMethod === 'file_upload' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Upload File
              </label>
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                  uploadedFile ? 'border-green-300 bg-green-50' : 'border-gray-300 hover:border-blue-400'
                }`}
                onClick={() => document.getElementById('file-upload')?.click()}
              >
                {uploadedFile ? (
                  <div className="space-y-2">
                    <FileText className="w-12 h-12 mx-auto text-green-500" />
                    <p className="text-sm text-gray-700 font-medium">{uploadedFile.fileName}</p>
                    <p className="text-xs text-gray-500">{uploadedFile.content.length} characters</p>
                    <button
                      onClick={(e) => { e.stopPropagation(); setUploadedFile(null); }}
                      className="text-sm text-red-500 hover:text-red-700"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload className="w-12 h-12 mx-auto text-gray-400 mb-2" />
                    <p className="text-sm text-gray-600">Drag & drop or click to upload</p>
                    <p className="text-xs text-gray-400">CSV, JSON, TXT, MD</p>
                  </>
                )}
                <input
                  id="file-upload"
                  type="file"
                  accept=".csv,.json,.txt,.md"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                />
              </div>
            </div>
          )}

          {inputMethod === 'conversation' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Multi-turn Conversation
              </label>
              <div className="border border-gray-300 rounded-lg">
                <div className="max-h-48 overflow-auto p-3 space-y-2">
                  {conversation.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">
                      Start a conversation to generate test cases
                    </p>
                  ) : (
                    conversation.map((msg, i) => (
                      <div
                        key={i}
                        className={`flex items-start gap-2 ${msg.role === 'user' ? 'justify-end' : ''}`}
                      >
                        <div
                          className={`max-w-[80%] px-3 py-2 rounded-lg text-sm ${
                            msg.role === 'user'
                              ? 'bg-blue-500 text-white'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {msg.content}
                        </div>
                        <button
                          onClick={() => setConversation(prev => prev.filter((_, idx) => idx !== i))}
                          className="p-1 text-gray-400 hover:text-red-500"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
                <div className="flex gap-2 p-2 border-t border-gray-200">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addConversationMessage()}
                    placeholder="Type your message..."
                    className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <Button onClick={addConversationMessage} variant="secondary" size="sm">
                    Add
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Test Types */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Test Types</label>
            <div className="flex flex-wrap gap-2">
              {['functional', 'integration', 'e2e', 'api'].map(type => (
                <button
                  key={type}
                  onClick={() => setTestTypes(prev =>
                    prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
                  )}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    testTypes.includes(type)
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* AI Mapping Toggle */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="include-mapping"
              checked={includeMapping}
              onChange={(e) => setIncludeMapping(e.target.checked)}
              className="rounded border-gray-300 text-blue-500 focus:ring-blue-500"
            />
            <label htmlFor="include-mapping" className="text-sm text-gray-700">
              Include AI mapping (product, module, tags)
            </label>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          <Button onClick={handleGenerate} isLoading={loading} className="w-full bg-blue-600 hover:bg-blue-700">
            <Sparkles className="w-4 h-4 mr-2" />
            Generate Test Cases
          </Button>
        </div>
      </Card>

      {/* Output Panel */}
      <Card title="Generated Test Cases">
        {result?.testCases && result.testCases.length > 0 ? (
          <div className="space-y-4">
            {/* Summary */}
            <div className="flex flex-wrap gap-2 pb-3 border-b border-gray-200">
              <span className="px-2 py-1 bg-gray-100 rounded text-xs font-medium">
                {result.summary.total} test cases
              </span>
              {Object.entries(result.summary.byPriority).map(([priority, count]) => (
                <span key={priority} className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs">
                  {priority}: {count}
                </span>
              ))}
            </div>

            {/* AI Mapping */}
            {result.mapping && (
              <div className="p-3 bg-purple-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Tag className="w-4 h-4 text-purple-600" />
                  <span className="text-sm font-medium text-purple-700">AI Mapping</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  {result.mapping.product && (
                    <div>
                      <span className="text-gray-500">Product:</span>{' '}
                      <span className="font-medium">{result.mapping.product}</span>
                      <span className="text-gray-400 ml-1">
                        ({Math.round(result.mapping.confidence.product * 100)}%)
                      </span>
                    </div>
                  )}
                  {result.mapping.module && (
                    <div>
                      <span className="text-gray-500">Module:</span>{' '}
                      <span className="font-medium">{result.mapping.module}</span>
                      <span className="text-gray-400 ml-1">
                        ({Math.round(result.mapping.confidence.module * 100)}%)
                      </span>
                    </div>
                  )}
                </div>
                {result.mapping.suggestedTags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {result.mapping.suggestedTags.map(tag => (
                      <span key={tag} className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Test Cases */}
            <div className="space-y-3 max-h-[400px] overflow-auto">
              {result.testCases.map((tc, index) => (
                <TestCaseCard
                  key={index}
                  testCase={tc}
                  index={index}
                  copied={copiedIndex === index}
                  onCopy={() => copyTestCase(index)}
                />
              ))}
            </div>

            <Button variant="secondary" className="w-full">
              Save All to Test Cases
            </Button>
          </div>
        ) : (
          <div className="text-center py-16 text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>Generated test cases will appear here</p>
            <p className="text-sm mt-1">Select an input method and generate</p>
          </div>
        )}
      </Card>
    </div>
  );
}

function TestCaseCard({
  testCase,
  copied,
  onCopy
}: {
  testCase: GeneratedTestCase;
  index?: number;
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
                onClick={(e) => { e.stopPropagation(); onCopy(); }}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">{testCase.description}</p>
          <div className="flex gap-1 mt-1">
            {testCase.tags.slice(0, 3).map(tag => (
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
                <li key={step.order} className="text-sm text-gray-700 flex gap-2">
                  <span className="text-gray-400 shrink-0">{step.order}.</span>
                  <span>{step.action} → <span className="text-green-600">{step.expected}</span></span>
                </li>
              ))}
            </ol>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase">Expected Result</p>
            <p className="text-sm text-gray-700 mt-1">{testCase.expectedResult}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function BatchPanel({ projectId }: { projectId: string }) {
  const [specifications, setSpecifications] = useState<Array<{ id: string; content: string }>>([
    { id: '1', content: '' }
  ]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    results: Array<{ id: string; success: boolean; output?: GenerateResult; error?: string }>;
    summary: { total: number; successful: number; failed: number; totalTestCases: number };
  } | null>(null);
  const [error, setError] = useState('');

  const addSpecification = () => {
    setSpecifications(prev => [...prev, { id: String(Date.now()), content: '' }]);
  };

  const removeSpecification = (id: string) => {
    if (specifications.length === 1) return;
    setSpecifications(prev => prev.filter(s => s.id !== id));
  };

  const updateSpecification = (id: string, content: string) => {
    setSpecifications(prev => prev.map(s => s.id === id ? { ...s, content } : s));
  };

  const handleBatchGenerate = async () => {
    const validSpecs = specifications.filter(s => s.content.trim());
    if (validSpecs.length === 0) {
      setError('Please add at least one specification');
      return;
    }

    setLoading(true);
    setError('');
    try {
      type BatchResult = {
        results: Array<{ id: string; success: boolean; output?: GenerateResult; error?: string }>;
        summary: { total: number; successful: number; failed: number; totalTestCases: number };
      };
      const response = await api.post<{ data: BatchResult }>('/ai/test-weaver/batch', {
        projectId,
        specifications: validSpecs.map(s => ({
          id: s.id,
          content: s.content,
          inputMethod: 'natural_language',
        })),
        options: {
          includeNegativeCases: true,
          includeEdgeCases: true,
        },
      });
      setResult(response.data.data);
    } catch (err) {
      setError('Failed to batch generate test cases');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card title="Batch Specifications">
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Add multiple requirements to generate test cases in batch
          </p>

          <div className="space-y-3 max-h-[400px] overflow-auto">
            {specifications.map((spec, index) => (
              <div key={spec.id} className="flex gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-gray-500">#{index + 1}</span>
                  </div>
                  <textarea
                    value={spec.content}
                    onChange={(e) => updateSpecification(spec.id, e.target.value)}
                    placeholder="Enter requirement..."
                    className="w-full h-24 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button
                  onClick={() => removeSpecification(spec.id)}
                  className="p-2 text-gray-400 hover:text-red-500 self-start mt-6"
                  disabled={specifications.length === 1}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <Button variant="secondary" onClick={addSpecification} className="w-full">
            Add Another Specification
          </Button>

          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          <Button onClick={handleBatchGenerate} isLoading={loading} className="w-full bg-blue-600 hover:bg-blue-700">
            <Layers className="w-4 h-4 mr-2" />
            Generate All ({specifications.filter(s => s.content.trim()).length})
          </Button>
        </div>
      </Card>

      <Card title="Batch Results">
        {result ? (
          <div className="space-y-4">
            {/* Summary */}
            <div className="flex gap-3 p-3 bg-gray-50 rounded-lg">
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900">{result.summary.total}</p>
                <p className="text-xs text-gray-500">Total</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{result.summary.successful}</p>
                <p className="text-xs text-gray-500">Success</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-600">{result.summary.failed}</p>
                <p className="text-xs text-gray-500">Failed</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">{result.summary.totalTestCases}</p>
                <p className="text-xs text-gray-500">Test Cases</p>
              </div>
            </div>

            {/* Results */}
            <div className="space-y-3 max-h-[350px] overflow-auto">
              {result.results.map((r, index) => (
                <div
                  key={r.id}
                  className={`p-3 rounded-lg border ${
                    r.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Specification #{index + 1}</span>
                    {r.success ? (
                      <span className="text-xs text-green-600">
                        {r.output?.testCases.length} test cases
                      </span>
                    ) : (
                      <span className="text-xs text-red-600">{r.error}</span>
                    )}
                  </div>
                  {r.success && r.output && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {r.output.testCases.slice(0, 3).map((tc, i) => (
                        <span key={i} className="px-2 py-0.5 bg-white rounded text-xs text-gray-600">
                          {tc.title}
                        </span>
                      ))}
                      {r.output.testCases.length > 3 && (
                        <span className="text-xs text-gray-400">
                          +{r.output.testCases.length - 3} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-16 text-gray-500">
            <Layers className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>Batch results will appear here</p>
            <p className="text-sm mt-1">Add specifications and generate</p>
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

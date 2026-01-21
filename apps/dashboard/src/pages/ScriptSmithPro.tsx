/**
 * ScriptSmith Pro Page
 * Sprint 13: Session-based 4-step wizard for AI-powered script generation
 *
 * Workflow:
 * 1. Choose Method - Select input method (record, upload, screenshot, describe, edit)
 * 2. Provide Input - Different UI based on selected method
 * 3. Transform & Review - AI generates script, user reviews
 * 4. Save to Framework - Save generated files to project
 */

import { useState, useEffect } from 'react';
import { useProjectStore } from '../stores/project';
import { api } from '../services/api';
import { Card, Button, Input } from '../components/ui';
import {
  Sparkles,
  Code,
  FileCode,
  Wand2,
  Video,
  Upload,
  Camera,
  MessageSquare,
  Edit3,
  ChevronRight,
  ChevronLeft,
  Check,
  Save,
  FolderOpen,
  Loader2,
  AlertCircle,
  Copy,
  RefreshCw,
  Trash2,
  Settings,
} from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

type InputMethod = 'record' | 'upload' | 'screenshot' | 'describe' | 'edit';
type SessionStatus = 'created' | 'input_received' | 'analyzing' | 'transforming' | 'reviewing' | 'completed' | 'failed';

interface ScriptSmithSession {
  id: string;
  inputMethod: InputMethod;
  status: SessionStatus;
  rawInput: Record<string, unknown> | null;
  transformedScript: string | null;
  frameworkAnalysis: Record<string, unknown> | null;
  costEstimate: number | null;
  projectPath: string | null;
  deviceType: string | null;
  deviceConfig: Record<string, unknown> | null;
  files: ScriptSmithFile[];
  createdAt: string;
  updatedAt: string;
}

interface ScriptSmithFile {
  id: string;
  filePath: string;
  fileType: 'test' | 'page_object' | 'utility' | 'fixture' | 'config';
  content: string;
  imports: string[];
  exports: string[];
}

interface TransformOptions {
  framework: 'playwright' | 'cypress';
  language: 'typescript' | 'javascript';
  includePageObjects: boolean;
  extractUtilities: boolean;
  waitStrategy: 'minimal' | 'standard' | 'conservative';
  selectorPreference: 'role' | 'testid' | 'text' | 'css';
}

const WIZARD_STEPS = [
  { id: 1, name: 'Choose Method', description: 'Select how to provide input' },
  { id: 2, name: 'Provide Input', description: 'Enter your test details' },
  { id: 3, name: 'Transform & Review', description: 'Review generated script' },
  { id: 4, name: 'Save to Framework', description: 'Save to your project' },
];

const INPUT_METHODS: { id: InputMethod; name: string; description: string; icon: React.ReactNode }[] = [
  { id: 'record', name: 'Record', description: 'Record browser actions', icon: <Video className="w-6 h-6" /> },
  { id: 'upload', name: 'Upload', description: 'Upload HAR/trace file', icon: <Upload className="w-6 h-6" /> },
  { id: 'screenshot', name: 'Screenshot', description: 'Annotate screenshots', icon: <Camera className="w-6 h-6" /> },
  { id: 'describe', name: 'Describe', description: 'Describe in natural language', icon: <MessageSquare className="w-6 h-6" /> },
  { id: 'edit', name: 'Edit', description: 'Edit existing script', icon: <Edit3 className="w-6 h-6" /> },
];

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function ScriptSmithProPage() {
  const { currentProject } = useProjectStore();
  const [currentStep, setCurrentStep] = useState(1);
  const [session, setSession] = useState<ScriptSmithSession | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<InputMethod | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Transform options
  const [transformOptions, setTransformOptions] = useState<TransformOptions>({
    framework: 'playwright',
    language: 'typescript',
    includePageObjects: true,
    extractUtilities: true,
    waitStrategy: 'standard',
    selectorPreference: 'testid',
  });

  // Session history
  const [sessions, setSessions] = useState<ScriptSmithSession[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Load user's sessions
  useEffect(() => {
    if (currentProject) {
      loadSessions();
    }
  }, [currentProject]);

  const loadSessions = async () => {
    try {
      const response = await api.getScriptSmithSessions({ projectId: currentProject?.id, limit: 10 });
      setSessions(response.data?.data || []);
    } catch {
      // Ignore - sessions list is optional
    }
  };

  const startNewSession = async (method: InputMethod) => {
    if (!currentProject) return;
    setLoading(true);
    setError(null);

    try {
      const response = await api.createScriptSmithSession({
        projectId: currentProject.id,
        inputMethod: method,
      });
      setSession(response.data);
      setSelectedMethod(method);
      setCurrentStep(2);
    } catch (err) {
      setError('Failed to create session');
    } finally {
      setLoading(false);
    }
  };

  const resumeSession = async (existingSession: ScriptSmithSession) => {
    setSession(existingSession);
    setSelectedMethod(existingSession.inputMethod);

    // Determine which step to resume at based on status
    switch (existingSession.status) {
      case 'created':
        setCurrentStep(2);
        break;
      case 'input_received':
      case 'analyzing':
      case 'transforming':
        setCurrentStep(3);
        break;
      case 'reviewing':
        setCurrentStep(3);
        break;
      case 'completed':
        setCurrentStep(4);
        break;
      default:
        setCurrentStep(2);
    }
    setShowHistory(false);
  };

  const deleteSession = async (sessionId: string) => {
    try {
      await api.deleteScriptSmithSession(sessionId);
      setSessions(sessions.filter(s => s.id !== sessionId));
      if (session?.id === sessionId) {
        resetWizard();
      }
    } catch {
      setError('Failed to delete session');
    }
  };

  const resetWizard = () => {
    setCurrentStep(1);
    setSession(null);
    setSelectedMethod(null);
    setError(null);
  };

  if (!currentProject) {
    return (
      <Card>
        <p className="text-gray-500 text-center py-8">Please select a project from the dashboard</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">ScriptSmith Pro</h1>
            <p className="text-sm text-gray-500">AI-powered test automation script generation</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => setShowHistory(!showHistory)}
            className="text-sm"
          >
            <FolderOpen className="w-4 h-4 mr-2" />
            {showHistory ? 'Hide History' : 'Session History'}
          </Button>
          {session && (
            <Button variant="secondary" onClick={resetWizard} className="text-sm">
              <RefreshCw className="w-4 h-4 mr-2" />
              New Session
            </Button>
          )}
        </div>
      </div>

      {/* Session History Panel */}
      {showHistory && (
        <Card title="Recent Sessions">
          {sessions.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No previous sessions</p>
          ) : (
            <div className="space-y-2">
              {sessions.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    {INPUT_METHODS.find(m => m.id === s.inputMethod)?.icon}
                    <div>
                      <p className="font-medium text-sm capitalize">{s.inputMethod} Session</p>
                      <p className="text-xs text-gray-500">
                        {new Date(s.createdAt).toLocaleString()} - <StatusBadge status={s.status} />
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="secondary" onClick={() => resumeSession(s)}>
                      Resume
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteSession(s.id)}
                      className="text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Step Progress Indicator */}
      <StepProgress currentStep={currentStep} steps={WIZARD_STEPS} />

      {/* Error Display */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700">
            &times;
          </button>
        </div>
      )}

      {/* Step Content */}
      {currentStep === 1 && (
        <ChooseMethodStep
          methods={INPUT_METHODS}
          selectedMethod={selectedMethod}
          onSelect={startNewSession}
          loading={loading}
        />
      )}

      {currentStep === 2 && session && selectedMethod && (
        <ProvideInputStep
          session={session}
          method={selectedMethod}
          onBack={() => setCurrentStep(1)}
          onNext={(updatedSession) => {
            setSession(updatedSession);
            setCurrentStep(3);
          }}
          setError={setError}
        />
      )}

      {currentStep === 3 && session && (
        <TransformReviewStep
          session={session}
          projectId={currentProject.id}
          options={transformOptions}
          setOptions={setTransformOptions}
          onBack={() => setCurrentStep(2)}
          onNext={(updatedSession) => {
            setSession(updatedSession);
            setCurrentStep(4);
          }}
          setError={setError}
        />
      )}

      {currentStep === 4 && session && (
        <SaveStep
          session={session}
          onBack={() => setCurrentStep(3)}
          onComplete={() => {
            loadSessions();
            resetWizard();
          }}
          setError={setError}
        />
      )}
    </div>
  );
}

// =============================================================================
// STEP PROGRESS INDICATOR
// =============================================================================

function StepProgress({ currentStep, steps }: { currentStep: number; steps: typeof WIZARD_STEPS }) {
  return (
    <nav aria-label="Progress">
      <ol className="flex items-center">
        {steps.map((step, index) => (
          <li key={step.id} className={`relative ${index !== steps.length - 1 ? 'flex-1' : ''}`}>
            <div className="flex items-center">
              <div
                className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                  step.id < currentStep
                    ? 'bg-purple-600 border-purple-600'
                    : step.id === currentStep
                    ? 'bg-white border-purple-600'
                    : 'bg-white border-gray-300'
                }`}
              >
                {step.id < currentStep ? (
                  <Check className="w-5 h-5 text-white" />
                ) : (
                  <span
                    className={`text-sm font-medium ${
                      step.id === currentStep ? 'text-purple-600' : 'text-gray-500'
                    }`}
                  >
                    {step.id}
                  </span>
                )}
              </div>
              <div className="ml-3 hidden sm:block">
                <p
                  className={`text-sm font-medium ${
                    step.id <= currentStep ? 'text-purple-600' : 'text-gray-500'
                  }`}
                >
                  {step.name}
                </p>
                <p className="text-xs text-gray-500">{step.description}</p>
              </div>
              {index !== steps.length - 1 && (
                <div
                  className={`hidden sm:block flex-1 h-0.5 mx-4 ${
                    step.id < currentStep ? 'bg-purple-600' : 'bg-gray-300'
                  }`}
                />
              )}
            </div>
          </li>
        ))}
      </ol>
    </nav>
  );
}

// =============================================================================
// STEP 1: CHOOSE METHOD
// =============================================================================

function ChooseMethodStep({
  methods,
  selectedMethod,
  onSelect,
  loading,
}: {
  methods: typeof INPUT_METHODS;
  selectedMethod: InputMethod | null;
  onSelect: (method: InputMethod) => void;
  loading: boolean;
}) {
  return (
    <Card title="Choose Input Method" subtitle="How would you like to provide your test input?">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {methods.map((method) => (
          <button
            key={method.id}
            onClick={() => onSelect(method.id)}
            disabled={loading}
            className={`flex flex-col items-center gap-3 p-6 rounded-lg border-2 transition-all ${
              selectedMethod === method.id
                ? 'border-purple-500 bg-purple-50'
                : 'border-gray-200 hover:border-purple-300 hover:bg-gray-50'
            } ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <div
              className={`p-3 rounded-full ${
                selectedMethod === method.id ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {method.icon}
            </div>
            <div className="text-center">
              <p className="font-medium text-gray-900">{method.name}</p>
              <p className="text-xs text-gray-500 mt-1">{method.description}</p>
            </div>
          </button>
        ))}
      </div>
      {loading && (
        <div className="flex items-center justify-center mt-6">
          <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
          <span className="ml-2 text-gray-600">Creating session...</span>
        </div>
      )}
    </Card>
  );
}

// =============================================================================
// STEP 2: PROVIDE INPUT
// =============================================================================

function ProvideInputStep({
  session,
  method,
  onBack,
  onNext,
  setError,
}: {
  session: ScriptSmithSession;
  method: InputMethod;
  onBack: () => void;
  onNext: (session: ScriptSmithSession) => void;
  setError: (error: string | null) => void;
}) {
  const [loading, setLoading] = useState(false);

  // Input state varies by method
  const [description, setDescription] = useState('');
  const [existingScript, setExistingScript] = useState('');
  const [editInstruction, setEditInstruction] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [screenshots, setScreenshots] = useState<File[]>([]);

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);

    try {
      let input: Record<string, unknown> = {};

      switch (method) {
        case 'describe':
          if (!description.trim()) {
            setError('Please provide a description');
            setLoading(false);
            return;
          }
          input = { description };
          break;

        case 'edit':
          if (!existingScript.trim() || !editInstruction.trim()) {
            setError('Please provide both script and edit instructions');
            setLoading(false);
            return;
          }
          input = { existingScript, editInstruction };
          break;

        case 'upload':
          if (!file) {
            setError('Please upload a file');
            setLoading(false);
            return;
          }
          // For demo: read file content
          const fileContent = await file.text();
          input = { fileName: file.name, fileContent };
          break;

        case 'screenshot':
          if (screenshots.length === 0) {
            setError('Please upload at least one screenshot');
            setLoading(false);
            return;
          }
          // For demo: just use file names
          input = { screenshots: screenshots.map(s => s.name) };
          break;

        case 'record':
          // Recording would be done via browser extension
          // For demo, allow continuing without recording
          input = { recording: { actions: [], note: 'Demo mode - no recording' } };
          break;
      }

      const response = await api.updateScriptSmithSessionInput(session.id, input);
      onNext(response.data);
    } catch (err) {
      setError('Failed to update input');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card
      title={`Provide ${INPUT_METHODS.find(m => m.id === method)?.name} Input`}
      subtitle={INPUT_METHODS.find(m => m.id === method)?.description}
    >
      <div className="space-y-6">
        {method === 'describe' && (
          <DescribeInput description={description} setDescription={setDescription} />
        )}

        {method === 'edit' && (
          <EditInput
            existingScript={existingScript}
            setExistingScript={setExistingScript}
            editInstruction={editInstruction}
            setEditInstruction={setEditInstruction}
          />
        )}

        {method === 'upload' && <UploadInput file={file} setFile={setFile} />}

        {method === 'screenshot' && (
          <ScreenshotInput screenshots={screenshots} setScreenshots={setScreenshots} />
        )}

        {method === 'record' && <RecordInput />}

        <div className="flex justify-between pt-4 border-t">
          <Button variant="secondary" onClick={onBack}>
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <Button onClick={handleSubmit} isLoading={loading} className="bg-purple-600 hover:bg-purple-700">
            Continue
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </Card>
  );
}

function DescribeInput({
  description,
  setDescription,
}: {
  description: string;
  setDescription: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Describe your test in natural language
      </label>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Example: Create a test that logs into the application with username 'testuser' and password 'test123', then verifies the dashboard displays a welcome message. After that, navigate to the settings page and update the user's email address."
        className="w-full h-48 px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
      />
      <p className="mt-2 text-xs text-gray-500">
        Be as specific as possible. Include user actions, expected outcomes, and any test data.
      </p>
    </div>
  );
}

function EditInput({
  existingScript,
  setExistingScript,
  editInstruction,
  setEditInstruction,
}: {
  existingScript: string;
  setExistingScript: (v: string) => void;
  editInstruction: string;
  setEditInstruction: (v: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Paste your existing script
        </label>
        <textarea
          value={existingScript}
          onChange={(e) => setExistingScript(e.target.value)}
          placeholder="// Paste your test script here..."
          className="w-full h-48 px-4 py-3 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          What would you like to change?
        </label>
        <textarea
          value={editInstruction}
          onChange={(e) => setEditInstruction(e.target.value)}
          placeholder="Example: Add error handling, convert to Page Object pattern, add retry logic for flaky selectors..."
          className="w-full h-24 px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
      </div>
    </div>
  );
}

function UploadInput({ file, setFile }: { file: File | null; setFile: (f: File | null) => void }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Upload HAR or Trace File
      </label>
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-purple-400 transition-colors">
        <input
          type="file"
          accept=".har,.json,.zip"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="hidden"
          id="file-upload"
        />
        <label htmlFor="file-upload" className="cursor-pointer">
          <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          {file ? (
            <p className="text-purple-600 font-medium">{file.name}</p>
          ) : (
            <>
              <p className="text-gray-600">Click to upload or drag and drop</p>
              <p className="text-xs text-gray-500 mt-1">HAR, Playwright Trace, or JSON files</p>
            </>
          )}
        </label>
      </div>
    </div>
  );
}

function ScreenshotInput({
  screenshots,
  setScreenshots,
}: {
  screenshots: File[];
  setScreenshots: (f: File[]) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Upload Screenshots to Annotate
      </label>
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-purple-400 transition-colors">
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => setScreenshots(Array.from(e.target.files || []))}
          className="hidden"
          id="screenshot-upload"
        />
        <label htmlFor="screenshot-upload" className="cursor-pointer">
          <Camera className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          {screenshots.length > 0 ? (
            <p className="text-purple-600 font-medium">{screenshots.length} file(s) selected</p>
          ) : (
            <>
              <p className="text-gray-600">Click to upload screenshots</p>
              <p className="text-xs text-gray-500 mt-1">PNG, JPG, or WebP images</p>
            </>
          )}
        </label>
      </div>
      {screenshots.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {screenshots.map((s, i) => (
            <span key={i} className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm">
              {s.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function RecordInput() {
  return (
    <div className="text-center py-8">
      <Video className="w-16 h-16 mx-auto text-gray-400 mb-4" />
      <h3 className="text-lg font-medium text-gray-900 mb-2">Browser Recording</h3>
      <p className="text-gray-500 mb-6 max-w-md mx-auto">
        To record browser actions, install the TestForge browser extension and start recording.
      </p>
      <div className="flex justify-center gap-4">
        <Button variant="secondary" disabled>
          Install Chrome Extension
        </Button>
        <Button variant="secondary" disabled>
          Install Firefox Extension
        </Button>
      </div>
      <p className="mt-4 text-sm text-gray-500">
        For this demo, you can continue without recording.
      </p>
    </div>
  );
}

// =============================================================================
// STEP 3: TRANSFORM & REVIEW
// =============================================================================

function TransformReviewStep({
  session,
  projectId,
  options,
  setOptions,
  onBack,
  onNext,
  setError,
}: {
  session: ScriptSmithSession;
  projectId: string;
  options: TransformOptions;
  setOptions: (o: TransformOptions) => void;
  onBack: () => void;
  onNext: (session: ScriptSmithSession) => void;
  setError: (error: string | null) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [transformedSession, setTransformedSession] = useState<ScriptSmithSession | null>(
    session.status === 'reviewing' ? session : null
  );
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [showOptions, setShowOptions] = useState(false);

  const handleTransform = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.transformScriptSmithSession(session.id, projectId, options);
      setTransformedSession(response.data);
    } catch (err) {
      setError('Failed to transform input');
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = () => {
    if (transformedSession) {
      onNext(transformedSession);
    }
  };

  return (
    <div className="space-y-6">
      {/* Options Panel */}
      <Card>
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-gray-900">Transform Options</h3>
          <Button variant="ghost" size="sm" onClick={() => setShowOptions(!showOptions)}>
            <Settings className="w-4 h-4 mr-2" />
            {showOptions ? 'Hide Options' : 'Show Options'}
          </Button>
        </div>

        {showOptions && (
          <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Framework</label>
              <select
                value={options.framework}
                onChange={(e) => setOptions({ ...options, framework: e.target.value as 'playwright' | 'cypress' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="playwright">Playwright</option>
                <option value="cypress">Cypress</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Language</label>
              <select
                value={options.language}
                onChange={(e) => setOptions({ ...options, language: e.target.value as 'typescript' | 'javascript' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="typescript">TypeScript</option>
                <option value="javascript">JavaScript</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Wait Strategy</label>
              <select
                value={options.waitStrategy}
                onChange={(e) => setOptions({ ...options, waitStrategy: e.target.value as 'minimal' | 'standard' | 'conservative' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="minimal">Minimal</option>
                <option value="standard">Standard</option>
                <option value="conservative">Conservative</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Selector Preference</label>
              <select
                value={options.selectorPreference}
                onChange={(e) => setOptions({ ...options, selectorPreference: e.target.value as 'role' | 'testid' | 'text' | 'css' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="role">Role-based</option>
                <option value="testid">data-testid</option>
                <option value="text">Text content</option>
                <option value="css">CSS selectors</option>
              </select>
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={options.includePageObjects}
                  onChange={(e) => setOptions({ ...options, includePageObjects: e.target.checked })}
                  className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                <span className="text-sm text-gray-700">Page Objects</span>
              </label>
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={options.extractUtilities}
                  onChange={(e) => setOptions({ ...options, extractUtilities: e.target.checked })}
                  className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                <span className="text-sm text-gray-700">Extract Utilities</span>
              </label>
            </div>
          </div>
        )}

        {!transformedSession && (
          <div className="mt-4">
            <Button onClick={handleTransform} isLoading={loading} className="bg-purple-600 hover:bg-purple-700">
              <Wand2 className="w-4 h-4 mr-2" />
              Transform to Script
            </Button>
          </div>
        )}
      </Card>

      {/* Loading State */}
      {loading && (
        <Card>
          <div className="text-center py-12">
            <Loader2 className="w-12 h-12 animate-spin text-purple-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Generating Script</h3>
            <p className="text-gray-500">AI is transforming your input into test automation code...</p>
          </div>
        </Card>
      )}

      {/* Generated Files */}
      {transformedSession && transformedSession.files && transformedSession.files.length > 0 && (
        <Card title="Generated Files" subtitle={`${transformedSession.files.length} file(s) generated`}>
          <div className="flex gap-4">
            {/* File List */}
            <div className="w-64 border-r border-gray-200 pr-4">
              {transformedSession.files.map((file, index) => (
                <button
                  key={file.id}
                  onClick={() => setSelectedFileIndex(index)}
                  className={`w-full text-left px-3 py-2 rounded-lg mb-1 flex items-center gap-2 ${
                    index === selectedFileIndex
                      ? 'bg-purple-100 text-purple-700'
                      : 'hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  <FileTypeBadge type={file.fileType} />
                  <span className="text-sm truncate">{file.filePath.split('/').pop()}</span>
                </button>
              ))}
            </div>

            {/* File Content */}
            <div className="flex-1">
              {(() => {
                const selectedFile = transformedSession.files[selectedFileIndex];
                if (!selectedFile) return null;
                return (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm text-gray-500">{selectedFile.filePath}</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigator.clipboard.writeText(selectedFile.content)}
                      >
                        <Copy className="w-4 h-4 mr-1" />
                        Copy
                      </Button>
                    </div>
                    <div className="bg-gray-900 rounded-lg p-4 overflow-auto max-h-[400px]">
                      <pre className="text-sm text-green-400 font-mono whitespace-pre-wrap">
                        {selectedFile.content}
                      </pre>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Cost Estimate */}
          {transformedSession.costEstimate && (
            <div className="mt-4 p-3 bg-gray-50 rounded-lg flex items-center justify-between">
              <span className="text-sm text-gray-600">Estimated AI Cost</span>
              <span className="font-medium">${Number(transformedSession.costEstimate).toFixed(4)}</span>
            </div>
          )}
        </Card>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="secondary" onClick={onBack}>
          <ChevronLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <Button
          onClick={handleContinue}
          disabled={!transformedSession}
          className="bg-purple-600 hover:bg-purple-700"
        >
          Continue to Save
          <ChevronRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}

// =============================================================================
// STEP 4: SAVE TO FRAMEWORK
// =============================================================================

function SaveStep({
  session,
  onBack,
  onComplete,
  setError,
}: {
  session: ScriptSmithSession;
  onBack: () => void;
  onComplete: () => void;
  setError: (error: string | null) => void;
}) {
  const [targetDir, setTargetDir] = useState(session.projectPath || './tests');
  const [overwrite, setOverwrite] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedFiles, setSavedFiles] = useState<string[]>([]);
  const [skippedFiles, setSkippedFiles] = useState<string[]>([]);

  const handleSave = async () => {
    if (!targetDir.trim()) {
      setError('Please specify a target directory');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await api.saveScriptSmithSession(session.id, targetDir, overwrite);
      setSavedFiles(response.data?.savedFiles || []);
      setSkippedFiles(response.data?.skipped || []);
      setSaved(true);
    } catch (err) {
      setError('Failed to save files');
    } finally {
      setLoading(false);
    }
  };

  if (saved) {
    return (
      <Card>
        <div className="text-center py-12">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Files Saved Successfully!</h3>
          <p className="text-gray-500 mb-6">
            {savedFiles.length} file(s) saved{skippedFiles.length > 0 && `, ${skippedFiles.length} skipped (already exist)`}.
          </p>

          {savedFiles.length > 0 && (
            <div className="max-w-md mx-auto mb-6 text-left">
              <p className="text-sm font-medium text-gray-700 mb-2">Saved files:</p>
              <ul className="space-y-1">
                {savedFiles.map((file, index) => (
                  <li key={index} className="text-sm text-gray-600 flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-green-500" />
                    {file}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {skippedFiles.length > 0 && (
            <div className="max-w-md mx-auto mb-6 text-left">
              <p className="text-sm font-medium text-gray-700 mb-2">Skipped (already exist):</p>
              <ul className="space-y-1">
                {skippedFiles.map((file, index) => (
                  <li key={index} className="text-sm text-gray-400 flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-gray-400" />
                    {file}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex justify-center gap-4">
            <Button variant="secondary" onClick={onComplete}>
              Start New Session
            </Button>
            <Button onClick={onComplete} className="bg-purple-600 hover:bg-purple-700">
              <Check className="w-4 h-4 mr-2" />
              Done
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card title="Save to Framework" subtitle="Choose where to save the generated files">
        <div className="space-y-6">
          <Input
            label="Target Directory"
            value={targetDir}
            onChange={(e) => setTargetDir(e.target.value)}
            placeholder="./tests"
          />

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={overwrite}
              onChange={(e) => setOverwrite(e.target.checked)}
              className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
            />
            <span className="text-sm text-gray-700">Overwrite existing files</span>
          </label>

          {/* File Preview */}
          {session.files && session.files.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Files to be saved:</p>
              <ul className="space-y-2">
                {session.files.map((file) => (
                  <li
                    key={file.id}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                  >
                    <FileTypeBadge type={file.fileType} />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{file.filePath}</p>
                      <p className="text-xs text-gray-500 capitalize">{file.fileType.replace('_', ' ')}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Card>

      <div className="flex justify-between">
        <Button variant="secondary" onClick={onBack}>
          <ChevronLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <Button onClick={handleSave} isLoading={loading} className="bg-purple-600 hover:bg-purple-700">
          <Save className="w-4 h-4 mr-2" />
          Save Files
        </Button>
      </div>
    </div>
  );
}

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

function StatusBadge({ status }: { status: SessionStatus }) {
  const colors: Record<SessionStatus, string> = {
    created: 'bg-gray-100 text-gray-700',
    input_received: 'bg-blue-100 text-blue-700',
    analyzing: 'bg-yellow-100 text-yellow-700',
    transforming: 'bg-purple-100 text-purple-700',
    reviewing: 'bg-indigo-100 text-indigo-700',
    completed: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700',
  };

  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[status]}`}>
      {status.replace('_', ' ')}
    </span>
  );
}

function FileTypeBadge({ type }: { type: ScriptSmithFile['fileType'] }) {
  const icons: Record<ScriptSmithFile['fileType'], React.ReactNode> = {
    test: <Code className="w-4 h-4 text-green-600" />,
    page_object: <FileCode className="w-4 h-4 text-blue-600" />,
    utility: <Wand2 className="w-4 h-4 text-purple-600" />,
    fixture: <FolderOpen className="w-4 h-4 text-orange-600" />,
    config: <Settings className="w-4 h-4 text-gray-600" />,
  };

  return icons[type] || <FileCode className="w-4 h-4 text-gray-400" />;
}

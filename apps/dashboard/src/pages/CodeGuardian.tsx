/**
 * CodeGuardian Page
 * AI-powered unit test generation with session-based workflow
 */

import { useState, useCallback } from 'react';
import { useProjectStore } from '../stores/project';
import { api } from '../services/api';
import { Card, Button } from '../components/ui';
import { Shield, FileCode, FolderTree, TestTube, Percent, Plus, PanelLeftClose, PanelLeft } from 'lucide-react';
import {
  SessionWizard,
  WizardNavigation,
  SessionSidebar,
  CodeUpload,
  FunctionBrowser,
  TestViewer,
  ExportModal,
  getNextStep,
  getPreviousStep,
} from '../components/codeGuardian';
import type {
  WizardStep,
  CodeGuardianSession,
  UploadedFile,
  FileWithFunctions,
  ParsedFunction,
  GeneratedTest,
  ExportFormat,
} from '../components/codeGuardian';

// Mock function parser (in production, this would be a proper AST parser)
function parseCodeFunctions(file: UploadedFile): ParsedFunction[] {
  const functions: ParsedFunction[] = [];
  const lines = file.content.split('\n');

  // Simple regex-based parsing for demo
  const functionPatterns = [
    /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)(?:\s*:\s*([^{]+))?/g,
    /(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*(?::\s*([^=]+))?\s*=>/g,
  ];

  let lineNum = 0;
  for (const line of lines) {
    lineNum++;
    for (const pattern of functionPatterns) {
      pattern.lastIndex = 0;
      const match = pattern.exec(line);
      if (match && match[1]) {
        const funcName = match[1];
        functions.push({
          id: `${file.id}-${funcName}-${lineNum}`,
          name: funcName,
          signature: line.trim(),
          startLine: lineNum,
          endLine: lineNum + 10, // Simplified
          isAsync: line.includes('async'),
          isExported: line.includes('export'),
          parameters: match[2] ? match[2].split(',').map(p => {
            const parts = p.trim().split(':').map(s => s.trim());
            return { name: parts[0] || '', type: parts[1] };
          }) : [],
          returnType: match[3]?.trim(),
        });
      }
    }
  }

  return functions;
}

export function CodeGuardianPage() {
  const { currentProject } = useProjectStore();

  // Session state
  const [sessions, setSessions] = useState<CodeGuardianSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  // Wizard state
  const [currentStep, setCurrentStep] = useState<WizardStep>('setup');
  const [completedSteps, setCompletedSteps] = useState<WizardStep[]>([]);

  // Setup step state
  const [language, setLanguage] = useState<CodeGuardianSession['language']>('typescript');
  const [framework, setFramework] = useState('vitest');

  // Files step state
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);

  // Functions step state
  const [filesWithFunctions, setFilesWithFunctions] = useState<FileWithFunctions[]>([]);
  const [selectedFunctionIds, setSelectedFunctionIds] = useState<string[]>([]);

  // Generate step state
  const [generatedTests, setGeneratedTests] = useState<GeneratedTest[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  // Export state
  const [showExportModal, setShowExportModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Sidebar collapsed state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const activeSession = sessions.find(s => s.id === activeSessionId);

  const handleNewSession = () => {
    const newSession: CodeGuardianSession = {
      id: `session-${Date.now()}`,
      name: `Session ${sessions.length + 1}`,
      language: 'typescript',
      framework: 'vitest',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metrics: { files: 0, functions: 0, testsGenerated: 0, avgCoverage: 0 },
    };
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
    resetWizard();
  };

  const resetWizard = () => {
    setCurrentStep('setup');
    setCompletedSteps([]);
    setLanguage('typescript');
    setFramework('vitest');
    setUploadedFiles([]);
    setFilesWithFunctions([]);
    setSelectedFunctionIds([]);
    setGeneratedTests([]);
  };

  const handleFilesChange = useCallback((files: UploadedFile[]) => {
    setUploadedFiles(files);
    // Parse functions from successfully uploaded files
    const parsed = files
      .filter(f => f.status === 'success' && f.content)
      .map(file => ({
        file,
        functions: parseCodeFunctions(file),
        isExpanded: true,
      }));
    setFilesWithFunctions(parsed);
  }, []);

  const handleExpandFile = (fileId: string) => {
    setFilesWithFunctions(prev => prev.map(f =>
      f.file.id === fileId ? { ...f, isExpanded: !f.isExpanded } : f
    ));
  };

  const handleGenerate = async () => {
    if (!currentProject || selectedFunctionIds.length === 0) return;

    setIsGenerating(true);
    try {
      // Get selected functions' code
      const selectedFunctions: { name: string; code: string }[] = [];
      for (const fileWithFns of filesWithFunctions) {
        for (const fn of fileWithFns.functions) {
          if (selectedFunctionIds.includes(fn.id)) {
            // Extract function code (simplified - in production use proper AST)
            const startIndex = fileWithFns.file.content.indexOf(fn.signature);
            const endIndex = startIndex + 500; // Simplified
            selectedFunctions.push({
              name: fn.name,
              code: fileWithFns.file.content.slice(startIndex, endIndex),
            });
          }
        }
      }

      // Generate tests for each function
      const tests: GeneratedTest[] = [];
      for (const fn of selectedFunctions) {
        try {
          const response = await api.generateUnitTests(
            currentProject.id,
            fn.code,
            language,
            framework
          );
          tests.push({
            id: `test-${Date.now()}-${fn.name}`,
            functionId: fn.name,
            functionName: fn.name,
            code: response.data?.tests || '// No tests generated',
            testCount: (response.data?.tests?.match(/it\(|test\(/g) || []).length || 1,
            coverage: parseInt(response.data?.coverage || '75'),
            isEditing: false,
          });
        } catch {
          tests.push({
            id: `test-${Date.now()}-${fn.name}`,
            functionId: fn.name,
            functionName: fn.name,
            code: `// Error generating tests for ${fn.name}`,
            testCount: 0,
            coverage: 0,
            isEditing: false,
          });
        }
      }

      setGeneratedTests(tests);
      setCompletedSteps(prev => [...prev, 'generate']);
      setCurrentStep('export');

      // Update session metrics
      if (activeSessionId) {
        setSessions(prev => prev.map(s =>
          s.id === activeSessionId ? {
            ...s,
            metrics: {
              ...s.metrics,
              testsGenerated: tests.reduce((sum, t) => sum + t.testCount, 0),
              avgCoverage: tests.reduce((sum, t) => sum + t.coverage, 0) / tests.length,
            },
            updatedAt: new Date().toISOString(),
          } : s
        ));
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleTestUpdate = (testId: string, newCode: string) => {
    setGeneratedTests(prev => prev.map(t =>
      t.id === testId ? { ...t, code: newCode } : t
    ));
  };

  const handleToggleEdit = (testId: string) => {
    setGeneratedTests(prev => prev.map(t =>
      t.id === testId ? { ...t, isEditing: !t.isEditing } : t
    ));
  };

  const handleExport = async (format: ExportFormat, targetDirectory: string) => {
    setIsExporting(true);
    try {
      // In production, this would call an API to save files
      console.log('Exporting tests:', { format, targetDirectory, tests: generatedTests });

      // Update session status
      if (activeSessionId) {
        setSessions(prev => prev.map(s =>
          s.id === activeSessionId ? { ...s, status: 'completed', updatedAt: new Date().toISOString() } : s
        ));
      }

      setCompletedSteps(prev => [...prev, 'export']);
    } finally {
      setIsExporting(false);
    }
  };

  const canContinue = (): boolean => {
    switch (currentStep) {
      case 'setup':
        return !!language && !!framework;
      case 'files':
        return uploadedFiles.filter(f => f.status === 'success').length > 0;
      case 'functions':
        return selectedFunctionIds.length > 0;
      case 'generate':
        return generatedTests.length > 0;
      case 'export':
        return true;
      default:
        return false;
    }
  };

  const handleContinue = () => {
    if (currentStep === 'generate' && generatedTests.length === 0) {
      handleGenerate();
      return;
    }

    if (currentStep === 'export') {
      setShowExportModal(true);
      return;
    }

    // Mark current step as completed and move to next
    if (!completedSteps.includes(currentStep)) {
      setCompletedSteps(prev => [...prev, currentStep]);
    }

    // Update session with current state
    if (activeSessionId && currentStep === 'files') {
      setSessions(prev => prev.map(s =>
        s.id === activeSessionId ? {
          ...s,
          language,
          framework,
          metrics: {
            ...s.metrics,
            files: uploadedFiles.filter(f => f.status === 'success').length,
            functions: filesWithFunctions.reduce((sum, f) => sum + f.functions.length, 0),
          },
          updatedAt: new Date().toISOString(),
        } : s
      ));
    }

    const next = getNextStep(currentStep);
    if (next) setCurrentStep(next);
  };

  const handleBack = () => {
    const prev = getPreviousStep(currentStep);
    if (prev) setCurrentStep(prev);
  };

  const handleStepClick = (step: WizardStep) => {
    if (completedSteps.includes(step) || step === currentStep) {
      setCurrentStep(step);
    }
  };

  if (!currentProject) {
    return (
      <Card>
        <p className="text-gray-500 text-center py-8">Please select a project from the dashboard</p>
      </Card>
    );
  }

  // Stats for header
  const totalFiles = uploadedFiles.filter(f => f.status === 'success').length;
  const totalFunctions = filesWithFunctions.reduce((sum, f) => sum + f.functions.length, 0);
  const totalTests = generatedTests.reduce((sum, t) => sum + t.testCount, 0);
  const avgCoverage = generatedTests.length > 0
    ? generatedTests.reduce((sum, t) => sum + t.coverage, 0) / generatedTests.length
    : 0;

  return (
    <div className="flex h-[calc(100vh-8rem)]">
      {/* Sidebar */}
      <SessionSidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSessionSelect={setActiveSessionId}
        onNewSession={handleNewSession}
        isCollapsed={sidebarCollapsed}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarCollapsed(prev => !prev)}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {sidebarCollapsed ? (
                <PanelLeft className="w-5 h-5" />
              ) : (
                <PanelLeftClose className="w-5 h-5" />
              )}
            </button>
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">CodeGuardian</h1>
              <p className="text-sm text-gray-500">
                {activeSession ? activeSession.name : 'AI-powered unit test generation'}
              </p>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
              <FileCode className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-medium">{totalFiles}</span>
              <span className="text-xs text-gray-500">Files</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
              <FolderTree className="w-4 h-4 text-purple-500" />
              <span className="text-sm font-medium">{totalFunctions}</span>
              <span className="text-xs text-gray-500">Functions</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
              <TestTube className="w-4 h-4 text-green-500" />
              <span className="text-sm font-medium">{totalTests}</span>
              <span className="text-xs text-gray-500">Tests</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
              <Percent className="w-4 h-4 text-orange-500" />
              <span className="text-sm font-medium">{avgCoverage.toFixed(0)}%</span>
              <span className="text-xs text-gray-500">Coverage</span>
            </div>
          </div>
        </div>

        {/* Wizard Progress */}
        {activeSessionId && (
          <div className="px-6 py-6 pb-12 bg-gray-50 border-b border-gray-200">
            <SessionWizard
              currentStep={currentStep}
              onStepClick={handleStepClick}
              completedSteps={completedSteps}
            />
          </div>
        )}

        {/* Step Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {!activeSessionId ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <Shield className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <h2 className="text-xl font-semibold text-gray-900 mb-2">No Active Session</h2>
                <p className="text-gray-500 mb-6">Create a new session to start generating tests</p>
                <Button onClick={handleNewSession} className="bg-green-600 hover:bg-green-700">
                  <Plus className="w-4 h-4 mr-2" />
                  New Session
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* Setup Step */}
              {currentStep === 'setup' && (
                <Card title="Session Setup" subtitle="Configure language and test framework">
                  <div className="grid grid-cols-2 gap-6 max-w-xl">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Programming Language
                      </label>
                      <select
                        value={language}
                        onChange={(e) => setLanguage(e.target.value as CodeGuardianSession['language'])}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
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
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Test Framework
                      </label>
                      <select
                        value={framework}
                        onChange={(e) => setFramework(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
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
                </Card>
              )}

              {/* Files Step */}
              {currentStep === 'files' && (
                <Card title="Upload Source Files" subtitle="Drag and drop your source code files">
                  <CodeUpload
                    files={uploadedFiles}
                    onFilesChange={handleFilesChange}
                    acceptedLanguages={[language]}
                    maxFileSize={1024 * 1024}
                    maxFiles={20}
                  />
                </Card>
              )}

              {/* Functions Step */}
              {currentStep === 'functions' && (
                <Card title="Select Functions" subtitle="Choose which functions to generate tests for">
                  <FunctionBrowser
                    filesWithFunctions={filesWithFunctions}
                    selectedFunctionIds={selectedFunctionIds}
                    onSelectionChange={setSelectedFunctionIds}
                    onExpandFile={handleExpandFile}
                  />
                </Card>
              )}

              {/* Generate Step */}
              {currentStep === 'generate' && (
                <Card title="Generated Tests" subtitle="Review and edit your generated tests">
                  <TestViewer
                    tests={generatedTests}
                    onTestUpdate={handleTestUpdate}
                    onToggleEdit={handleToggleEdit}
                  />
                </Card>
              )}

              {/* Export Step */}
              {currentStep === 'export' && (
                <Card title="Export Tests" subtitle="Save your tests to the project">
                  <TestViewer
                    tests={generatedTests}
                    onTestUpdate={handleTestUpdate}
                    onToggleEdit={handleToggleEdit}
                  />
                </Card>
              )}
            </>
          )}
        </div>

        {/* Wizard Navigation */}
        {activeSessionId && (
          <div className="px-6 py-4 bg-white border-t border-gray-200">
            <WizardNavigation
              currentStep={currentStep}
              onBack={handleBack}
              onContinue={handleContinue}
              canContinue={canContinue()}
              isGenerating={isGenerating}
              isExporting={isExporting}
            />
          </div>
        )}
      </div>

      {/* Export Modal */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        tests={generatedTests}
        language={language}
        framework={framework}
        onExport={handleExport}
      />
    </div>
  );
}

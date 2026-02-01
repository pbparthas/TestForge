/**
 * TestViewer Component
 * Display generated tests with syntax highlighting and edit capability
 */

import { useState } from 'react';
import { cn } from '../../utils/cn';
import { Copy, Check, Edit2, Save, X, FileCode, ChevronDown, ChevronRight } from 'lucide-react';

export interface GeneratedTest {
  id: string;
  functionId: string;
  functionName: string;
  code: string;
  testCount: number;
  coverage: number;
  isEditing: boolean;
}

interface TestViewerProps {
  tests: GeneratedTest[];
  onTestUpdate: (testId: string, newCode: string) => void;
  onToggleEdit: (testId: string) => void;
}

export function TestViewer({ tests, onTestUpdate, onToggleEdit }: TestViewerProps) {
  const [expandedTests, setExpandedTests] = useState<Set<string>>(new Set(tests.map(t => t.id)));
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});

  const toggleExpand = (testId: string) => {
    setExpandedTests(prev => {
      const next = new Set(prev);
      if (next.has(testId)) {
        next.delete(testId);
      } else {
        next.add(testId);
      }
      return next;
    });
  };

  const copyCode = async (test: GeneratedTest) => {
    await navigator.clipboard.writeText(test.code);
    setCopiedId(test.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleEdit = (test: GeneratedTest) => {
    setEditValues(prev => ({ ...prev, [test.id]: test.code }));
    onToggleEdit(test.id);
  };

  const handleSave = (test: GeneratedTest) => {
    const newCode = editValues[test.id];
    if (newCode !== undefined) {
      onTestUpdate(test.id, newCode);
    }
    onToggleEdit(test.id);
  };

  const handleCancel = (test: GeneratedTest) => {
    setEditValues(prev => {
      const next = { ...prev };
      delete next[test.id];
      return next;
    });
    onToggleEdit(test.id);
  };

  const copyAllTests = async () => {
    const allCode = tests.map(t => `// Tests for ${t.functionName}\n${t.code}`).join('\n\n');
    await navigator.clipboard.writeText(allCode);
    setCopiedId('all');
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (tests.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <FileCode className="w-12 h-12 mx-auto mb-4 text-gray-300" />
        <p className="font-medium">No tests generated yet</p>
        <p className="text-sm mt-1">Select functions and click Generate to create tests</p>
      </div>
    );
  }

  const totalTests = tests.reduce((sum, t) => sum + t.testCount, 0);
  const avgCoverage = tests.reduce((sum, t) => sum + t.coverage, 0) / tests.length;

  return (
    <div className="space-y-4">
      {/* Summary Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <span className="text-2xl font-bold text-gray-900">{totalTests}</span>
            <span className="text-sm text-gray-500 ml-1">tests generated</span>
          </div>
          <div className="h-8 border-l border-gray-200" />
          <div>
            <span className="text-2xl font-bold text-green-600">{avgCoverage.toFixed(0)}%</span>
            <span className="text-sm text-gray-500 ml-1">avg coverage</span>
          </div>
        </div>

        <button
          onClick={copyAllTests}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
        >
          {copiedId === 'all' ? (
            <>
              <Check className="w-4 h-4 text-green-500" />
              Copied All!
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              Copy All Tests
            </>
          )}
        </button>
      </div>

      {/* Test Cards */}
      <div className="space-y-3">
        {tests.map(test => (
          <div
            key={test.id}
            className="border border-gray-200 rounded-lg overflow-hidden"
          >
            {/* Test Header */}
            <div
              className="flex items-center justify-between px-4 py-3 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
              onClick={() => toggleExpand(test.id)}
            >
              <div className="flex items-center gap-3">
                {expandedTests.has(test.id) ? (
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                )}
                <FileCode className="w-5 h-5 text-purple-500" />
                <span className="font-medium text-gray-900">{test.functionName}</span>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-500">
                  {test.testCount} tests
                </span>
                <span className={cn(
                  'px-2 py-0.5 text-xs rounded-full font-medium',
                  test.coverage >= 80 ? 'bg-green-100 text-green-700' :
                  test.coverage >= 50 ? 'bg-yellow-100 text-yellow-700' :
                  'bg-red-100 text-red-700'
                )}>
                  {test.coverage}% coverage
                </span>
              </div>
            </div>

            {/* Test Code */}
            {expandedTests.has(test.id) && (
              <div className="relative">
                {/* Action Buttons */}
                <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
                  {test.isEditing ? (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSave(test);
                        }}
                        className="p-1.5 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                        title="Save"
                      >
                        <Save className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCancel(test);
                        }}
                        className="p-1.5 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
                        title="Cancel"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(test);
                        }}
                        className="p-1.5 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          copyCode(test);
                        }}
                        className="p-1.5 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors"
                        title="Copy"
                      >
                        {copiedId === test.id ? (
                          <Check className="w-4 h-4 text-green-400" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </>
                  )}
                </div>

                {/* Code Display / Editor */}
                {test.isEditing ? (
                  <textarea
                    value={editValues[test.id] ?? test.code}
                    onChange={(e) => setEditValues(prev => ({ ...prev, [test.id]: e.target.value }))}
                    className="w-full h-80 p-4 bg-gray-900 text-green-400 font-mono text-sm focus:outline-none resize-none"
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <div className="bg-gray-900 p-4 overflow-auto max-h-80">
                    <pre className="text-sm text-green-400 font-mono whitespace-pre-wrap">
                      {test.code}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

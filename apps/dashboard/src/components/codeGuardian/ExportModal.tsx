/**
 * ExportModal Component
 * Export format selection, target directory input, and file preview
 */

import { useState } from 'react';
import { cn } from '../../utils/cn';
import { X, Download, FolderOpen, FileCode, Check, Copy, Info } from 'lucide-react';
import { Button } from '../ui';
import type { GeneratedTest } from './TestViewer';

export type ExportFormat = 'single-file' | 'per-function' | 'clipboard';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  tests: GeneratedTest[];
  language: string;
  framework: string;
  onExport: (format: ExportFormat, targetDirectory: string) => Promise<void>;
}

const formatDescriptions: Record<ExportFormat, { title: string; description: string }> = {
  'single-file': {
    title: 'Single File',
    description: 'All tests in one file (tests.spec.ts)',
  },
  'per-function': {
    title: 'Per Function',
    description: 'Separate test file for each function',
  },
  'clipboard': {
    title: 'Copy to Clipboard',
    description: 'Copy all tests to clipboard',
  },
};

const frameworkExtensions: Record<string, string> = {
  vitest: '.spec.ts',
  jest: '.test.ts',
  mocha: '.test.ts',
  pytest: '_test.py',
  junit: 'Test.java',
  xunit: 'Tests.cs',
};

export function ExportModal({
  isOpen,
  onClose,
  tests,
  language,
  framework,
  onExport,
}: ExportModalProps) {
  const [format, setFormat] = useState<ExportFormat>('single-file');
  const [targetDirectory, setTargetDirectory] = useState('./tests');
  const [isExporting, setIsExporting] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const fileExtension = frameworkExtensions[framework] || '.test.ts';
  const totalTests = tests.reduce((sum, t) => sum + t.testCount, 0);

  const getPreviewFiles = (): { name: string; lines: number }[] => {
    if (format === 'clipboard') {
      return [{ name: 'Clipboard', lines: tests.reduce((sum, t) => sum + t.code.split('\n').length, 0) }];
    }

    if (format === 'single-file') {
      const totalLines = tests.reduce((sum, t) => sum + t.code.split('\n').length + 3, 10);
      return [{ name: `all-tests${fileExtension}`, lines: totalLines }];
    }

    return tests.map(t => ({
      name: `${t.functionName}${fileExtension}`,
      lines: t.code.split('\n').length + 5,
    }));
  };

  const previewFiles = getPreviewFiles();

  const handleExport = async () => {
    if (format === 'clipboard') {
      const allCode = tests.map(t => `// Tests for ${t.functionName}\n${t.code}`).join('\n\n');
      await navigator.clipboard.writeText(allCode);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
        onClose();
      }, 1500);
      return;
    }

    setIsExporting(true);
    try {
      await onExport(format, targetDirectory);
      onClose();
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <Download className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Export Tests</h2>
                <p className="text-sm text-gray-500">
                  {totalTests} tests from {tests.length} functions
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Format Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Export Format
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(formatDescriptions) as ExportFormat[]).map(fmt => (
                  <button
                    key={fmt}
                    onClick={() => setFormat(fmt)}
                    className={cn(
                      'p-3 border rounded-lg text-left transition-colors',
                      format === fmt
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-200 hover:border-gray-300'
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {fmt === 'clipboard' ? (
                        <Copy className="w-4 h-4 text-gray-500" />
                      ) : fmt === 'single-file' ? (
                        <FileCode className="w-4 h-4 text-gray-500" />
                      ) : (
                        <FolderOpen className="w-4 h-4 text-gray-500" />
                      )}
                      <span className={cn(
                        'text-sm font-medium',
                        format === fmt ? 'text-green-700' : 'text-gray-900'
                      )}>
                        {formatDescriptions[fmt].title}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">
                      {formatDescriptions[fmt].description}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Target Directory (not for clipboard) */}
            {format !== 'clipboard' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Target Directory
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={targetDirectory}
                    onChange={(e) => setTargetDirectory(e.target.value)}
                    placeholder="./tests"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <button
                    className="px-3 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
                    title="Browse (not available in browser)"
                  >
                    <FolderOpen className="w-5 h-5" />
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-400 flex items-center gap-1">
                  <Info className="w-3 h-3" />
                  Relative to project root
                </p>
              </div>
            )}

            {/* File Preview */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Files to Create
              </label>
              <div className="bg-gray-50 rounded-lg border border-gray-200 p-3 max-h-40 overflow-y-auto">
                {previewFiles.map((file, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between py-1.5 px-2 hover:bg-gray-100 rounded"
                  >
                    <div className="flex items-center gap-2">
                      <FileCode className="w-4 h-4 text-blue-500" />
                      <span className="text-sm font-mono text-gray-700">
                        {format !== 'clipboard' && `${targetDirectory}/`}
                        {file.name}
                      </span>
                    </div>
                    <span className="text-xs text-gray-400">
                      ~{file.lines} lines
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Framework Info */}
            <div className="flex items-center gap-4 p-3 bg-blue-50 rounded-lg">
              <Info className="w-5 h-5 text-blue-500 flex-shrink-0" />
              <div className="text-sm">
                <span className="text-gray-600">Tests formatted for </span>
                <span className="font-medium text-gray-900">{framework}</span>
                <span className="text-gray-600"> ({language})</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleExport}
              isLoading={isExporting}
              className="bg-green-600 hover:bg-green-700"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Copied!
                </>
              ) : format === 'clipboard' ? (
                <>
                  <Copy className="w-4 h-4 mr-2" />
                  Copy to Clipboard
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Export Tests
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

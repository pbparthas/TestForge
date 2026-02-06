/**
 * CodeEditor Component
 * Monaco-powered code editor with copy/download toolbar
 */

import { useState } from 'react';
import { Card, Button } from '../ui';
import { MonacoEditor } from '../monaco/MonacoEditor';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language?: 'typescript' | 'javascript' | 'python' | 'java' | 'csharp' | 'yaml';
  readOnly?: boolean;
  height?: string;
  showLineNumbers?: boolean;
  onCopy?: () => void;
  onDownload?: () => void;
  onSave?: (value: string) => void;
}

const LANGUAGE_LABELS: Record<string, string> = {
  typescript: 'TypeScript',
  javascript: 'JavaScript',
  python: 'Python',
  java: 'Java',
  csharp: 'C#',
  yaml: 'YAML',
};

export function CodeEditor({
  value,
  onChange,
  language = 'typescript',
  readOnly = false,
  height = '400px',
  onCopy,
  onDownload,
  onSave,
}: CodeEditorProps) {
  const [copied, setCopied] = useState(false);

  const lines = value.split('\n');

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    onCopy?.();
  };

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <div className="w-3 h-3 rounded-full bg-green-500" />
          </div>
          <span className="text-xs text-gray-400 ml-2">{LANGUAGE_LABELS[language]}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={handleCopy}
            className="text-xs py-1 px-2 bg-gray-700 hover:bg-gray-600 text-gray-300 border-gray-600"
          >
            {copied ? (
              <>
                <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Copied
              </>
            ) : (
              <>
                <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy
              </>
            )}
          </Button>
          {onDownload && (
            <Button
              variant="secondary"
              onClick={onDownload}
              className="text-xs py-1 px-2 bg-gray-700 hover:bg-gray-600 text-gray-300 border-gray-600"
            >
              <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download
            </Button>
          )}
        </div>
      </div>

      {/* Monaco Editor */}
      <MonacoEditor
        value={value}
        onChange={onChange}
        language={language}
        readOnly={readOnly}
        height={height}
        onSave={onSave}
      />

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-t border-gray-700 text-xs text-gray-400">
        <span>{lines.length} lines</span>
        <span>{value.length} characters</span>
      </div>
    </Card>
  );
}

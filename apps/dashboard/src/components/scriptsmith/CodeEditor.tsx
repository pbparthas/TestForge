/**
 * CodeEditor Component
 * Syntax-highlighted code editor with basic editing capabilities
 * Uses a textarea with syntax highlighting overlay for simplicity
 * (Monaco can be added later via dynamic import for full features)
 */

import { useState, useRef } from 'react';
import { Card, Button } from '../ui';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language?: 'typescript' | 'javascript' | 'python' | 'java' | 'csharp';
  readOnly?: boolean;
  height?: string;
  showLineNumbers?: boolean;
  onCopy?: () => void;
  onDownload?: () => void;
}

const LANGUAGE_LABELS: Record<string, string> = {
  typescript: 'TypeScript',
  javascript: 'JavaScript',
  python: 'Python',
  java: 'Java',
  csharp: 'C#',
};

export function CodeEditor({
  value,
  onChange,
  language = 'typescript',
  readOnly = false,
  height = '400px',
  showLineNumbers = true,
  onCopy,
  onDownload,
}: CodeEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [copied, setCopied] = useState(false);

  const lines = value.split('\n');

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    onCopy?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const newValue = value.substring(0, start) + '  ' + value.substring(end);
        onChange(newValue);
        // Set cursor position after the inserted spaces
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = start + 2;
        }, 0);
      }
    }
  };

  // Sync scroll between textarea and line numbers
  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    const lineNumbers = document.getElementById('line-numbers');
    if (lineNumbers) {
      lineNumbers.scrollTop = e.currentTarget.scrollTop;
    }
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

      {/* Editor Body */}
      <div className="flex bg-gray-900" style={{ height }}>
        {/* Line Numbers */}
        {showLineNumbers && (
          <div
            id="line-numbers"
            className="flex-shrink-0 py-3 px-3 text-right text-gray-500 text-sm font-mono select-none overflow-hidden bg-gray-850"
            style={{ minWidth: '50px' }}
          >
            {lines.map((_, i) => (
              <div key={i} className="leading-6">
                {i + 1}
              </div>
            ))}
          </div>
        )}

        {/* Code Area */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onScroll={handleScroll}
            readOnly={readOnly}
            spellCheck={false}
            className="absolute inset-0 w-full h-full p-3 bg-transparent text-gray-100 font-mono text-sm leading-6 resize-none focus:outline-none"
            style={{ caretColor: '#fff' }}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-t border-gray-700 text-xs text-gray-400">
        <span>{lines.length} lines</span>
        <span>{value.length} characters</span>
      </div>
    </Card>
  );
}

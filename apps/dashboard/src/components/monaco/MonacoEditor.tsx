/**
 * Monaco Editor Wrapper
 * Full-featured code editor powered by VS Code's Monaco
 */

import { useRef, useCallback } from 'react';
import Editor, { type OnMount, type OnChange } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';

interface MonacoEditorProps {
  value: string;
  onChange?: (value: string) => void;
  language?: string;
  readOnly?: boolean;
  height?: string;
  onSave?: (value: string) => void;
}

const LANGUAGE_MAP: Record<string, string> = {
  typescript: 'typescript',
  javascript: 'javascript',
  python: 'python',
  java: 'java',
  csharp: 'csharp',
  yaml: 'yaml',
};

export function MonacoEditor({
  value,
  onChange,
  language = 'typescript',
  readOnly = false,
  height = '400px',
  onSave,
}: MonacoEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  const handleMount: OnMount = useCallback((editor) => {
    editorRef.current = editor;

    // Ctrl+S / Cmd+S shortcut
    if (onSave) {
      editor.addCommand(
        // Monaco KeyMod.CtrlCmd | Monaco KeyCode.KeyS
        2048 | 49, // CtrlCmd + S
        () => {
          const currentValue = editor.getValue();
          onSave(currentValue);
        }
      );
    }
  }, [onSave]);

  const handleChange: OnChange = useCallback((newValue) => {
    if (onChange && newValue !== undefined) {
      onChange(newValue);
    }
  }, [onChange]);

  return (
    <div className="border border-gray-700 rounded-lg overflow-hidden">
      <Editor
        height={height}
        language={LANGUAGE_MAP[language] || language}
        value={value}
        onChange={handleChange}
        onMount={handleMount}
        theme="vs-dark"
        options={{
          readOnly,
          minimap: { enabled: false },
          fontSize: 14,
          lineNumbers: 'on',
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          tabSize: 2,
          automaticLayout: true,
          padding: { top: 8 },
        }}
      />
    </div>
  );
}

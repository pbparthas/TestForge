/**
 * Monaco Diff Editor
 * Side-by-side diff viewer for code review (main vs develop)
 */

import { useRef, useCallback } from 'react';
import { DiffEditor, type DiffOnMount } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';

interface MonacoDiffEditorProps {
  original: string;
  modified: string;
  language?: string;
  filename?: string;
  height?: string;
  onAddComment?: (lineNumber: number) => void;
}

function countChanges(original: string, modified: string): { additions: number; deletions: number } {
  const origLines = original.split('\n');
  const modLines = modified.split('\n');
  const origSet = new Set(origLines);
  const modSet = new Set(modLines);

  const additions = modLines.filter(l => !origSet.has(l)).length;
  const deletions = origLines.filter(l => !modSet.has(l)).length;

  return { additions, deletions };
}

export function MonacoDiffEditor({
  original,
  modified,
  language = 'typescript',
  filename,
  height = '500px',
  onAddComment,
}: MonacoDiffEditorProps) {
  const diffEditorRef = useRef<editor.IStandaloneDiffEditor | null>(null);

  const handleMount: DiffOnMount = useCallback((editor) => {
    diffEditorRef.current = editor;

    if (onAddComment) {
      const modifiedEditor = editor.getModifiedEditor();
      modifiedEditor.onMouseDown((e) => {
        if (e.target.position && e.target.type === 2) { // GUTTER_LINE_NUMBERS
          onAddComment(e.target.position.lineNumber);
        }
      });
    }
  }, [onAddComment]);

  const { additions, deletions } = countChanges(original, modified);

  return (
    <div className="border border-gray-700 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-3">
          {filename && (
            <span className="text-sm text-gray-300 font-mono">{filename}</span>
          )}
          <span className="text-xs font-medium text-gray-500">
            main &larr; develop
          </span>
        </div>
        <div className="flex items-center gap-2">
          {additions > 0 && (
            <span className="text-xs font-medium text-green-400">+{additions}</span>
          )}
          {deletions > 0 && (
            <span className="text-xs font-medium text-red-400">-{deletions}</span>
          )}
        </div>
      </div>

      {/* Diff Editor */}
      <DiffEditor
        height={height}
        language={language}
        original={original}
        modified={modified}
        onMount={handleMount}
        theme="vs-dark"
        options={{
          readOnly: true,
          renderSideBySide: true,
          minimap: { enabled: false },
          fontSize: 14,
          scrollBeyondLastLine: false,
          automaticLayout: true,
          padding: { top: 8 },
        }}
      />
    </div>
  );
}

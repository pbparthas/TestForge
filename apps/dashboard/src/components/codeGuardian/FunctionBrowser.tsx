/**
 * FunctionBrowser Component
 * Tree view of uploaded files with function selection and signature preview
 */

import { useState, useMemo } from 'react';
import { cn } from '../../utils/cn';
import { ChevronDown, ChevronRight, File, FolderTree, Square, CheckSquare, Code } from 'lucide-react';
import type { UploadedFile } from './CodeUpload';

export interface ParsedFunction {
  id: string;
  name: string;
  signature: string;
  startLine: number;
  endLine: number;
  complexity?: number;
  isAsync: boolean;
  isExported: boolean;
  parameters: { name: string; type?: string }[];
  returnType?: string;
}

export interface FileWithFunctions {
  file: UploadedFile;
  functions: ParsedFunction[];
  isExpanded: boolean;
}

interface FunctionBrowserProps {
  filesWithFunctions: FileWithFunctions[];
  selectedFunctionIds: string[];
  onSelectionChange: (functionIds: string[]) => void;
  onExpandFile: (fileId: string) => void;
}

export function FunctionBrowser({
  filesWithFunctions,
  selectedFunctionIds,
  onSelectionChange,
  onExpandFile,
}: FunctionBrowserProps) {
  const [hoveredFunctionId, setHoveredFunctionId] = useState<string | null>(null);

  const allFunctionIds = useMemo(() =>
    filesWithFunctions.flatMap(f => f.functions.map(fn => fn.id)),
    [filesWithFunctions]
  );

  const totalFunctions = allFunctionIds.length;
  const selectedCount = selectedFunctionIds.length;

  const toggleSelectAll = () => {
    if (selectedCount === totalFunctions) {
      onSelectionChange([]);
    } else {
      onSelectionChange(allFunctionIds);
    }
  };

  const toggleFunction = (functionId: string) => {
    if (selectedFunctionIds.includes(functionId)) {
      onSelectionChange(selectedFunctionIds.filter(id => id !== functionId));
    } else {
      onSelectionChange([...selectedFunctionIds, functionId]);
    }
  };

  const toggleFile = (fileId: string) => {
    const fileFunctions = filesWithFunctions
      .find(f => f.file.id === fileId)
      ?.functions.map(fn => fn.id) || [];

    const allSelected = fileFunctions.every(id => selectedFunctionIds.includes(id));

    if (allSelected) {
      onSelectionChange(selectedFunctionIds.filter(id => !fileFunctions.includes(id)));
    } else {
      const newSelection = new Set([...selectedFunctionIds, ...fileFunctions]);
      onSelectionChange(Array.from(newSelection));
    }
  };

  const hoveredFunction = useMemo(() => {
    if (!hoveredFunctionId) return null;
    for (const file of filesWithFunctions) {
      const fn = file.functions.find(f => f.id === hoveredFunctionId);
      if (fn) return fn;
    }
    return null;
  }, [hoveredFunctionId, filesWithFunctions]);

  if (filesWithFunctions.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <FolderTree className="w-12 h-12 mx-auto mb-4 text-gray-300" />
        <p className="font-medium">No files uploaded yet</p>
        <p className="text-sm mt-1">Upload source files to browse functions</p>
      </div>
    );
  }

  return (
    <div className="flex gap-4 h-full">
      {/* Tree View */}
      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <button
              onClick={toggleSelectAll}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
            >
              {selectedCount === totalFunctions ? (
                <CheckSquare className="w-4 h-4 text-green-600" />
              ) : selectedCount > 0 ? (
                <div className="w-4 h-4 border-2 border-green-600 rounded flex items-center justify-center">
                  <div className="w-2 h-2 bg-green-600 rounded-sm" />
                </div>
              ) : (
                <Square className="w-4 h-4 text-gray-400" />
              )}
            </button>
            <span className="text-sm font-medium text-gray-700">
              {selectedCount} of {totalFunctions} functions selected
            </span>
          </div>
        </div>

        {/* File Tree */}
        <div className="space-y-1 max-h-[400px] overflow-y-auto">
          {filesWithFunctions.map(({ file, functions, isExpanded }) => {
            const fileFunctionIds = functions.map(fn => fn.id);
            const fileSelectedCount = fileFunctionIds.filter(id => selectedFunctionIds.includes(id)).length;
            const allFileSelected = fileSelectedCount === functions.length;
            const someFileSelected = fileSelectedCount > 0 && !allFileSelected;

            return (
              <div key={file.id} className="rounded-lg border border-gray-200 overflow-hidden">
                {/* File Header */}
                <div
                  className="flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors"
                  onClick={() => onExpandFile(file.id)}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFile(file.id);
                    }}
                    className="p-0.5"
                  >
                    {allFileSelected ? (
                      <CheckSquare className="w-4 h-4 text-green-600" />
                    ) : someFileSelected ? (
                      <div className="w-4 h-4 border-2 border-green-600 rounded flex items-center justify-center">
                        <div className="w-2 h-2 bg-green-600 rounded-sm" />
                      </div>
                    ) : (
                      <Square className="w-4 h-4 text-gray-400" />
                    )}
                  </button>

                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-500" />
                  )}

                  <File className="w-4 h-4 text-blue-500" />

                  <span className="text-sm font-medium text-gray-900 truncate flex-1">
                    {file.name}
                  </span>

                  <span className="text-xs text-gray-400">
                    {fileSelectedCount}/{functions.length}
                  </span>
                </div>

                {/* Functions */}
                {isExpanded && (
                  <div className="divide-y divide-gray-100">
                    {functions.map(fn => (
                      <div
                        key={fn.id}
                        className={cn(
                          'flex items-center gap-2 px-3 py-2 pl-10 cursor-pointer transition-colors',
                          selectedFunctionIds.includes(fn.id)
                            ? 'bg-green-50'
                            : 'hover:bg-gray-50',
                          hoveredFunctionId === fn.id && 'bg-blue-50'
                        )}
                        onClick={() => toggleFunction(fn.id)}
                        onMouseEnter={() => setHoveredFunctionId(fn.id)}
                        onMouseLeave={() => setHoveredFunctionId(null)}
                      >
                        {selectedFunctionIds.includes(fn.id) ? (
                          <CheckSquare className="w-4 h-4 text-green-600 flex-shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        )}

                        <Code className="w-4 h-4 text-purple-500 flex-shrink-0" />

                        <span className="text-sm text-gray-700 truncate flex-1">
                          {fn.name}
                        </span>

                        <div className="flex items-center gap-1 flex-shrink-0">
                          {fn.isAsync && (
                            <span className="px-1 py-0.5 bg-purple-100 text-purple-700 text-[10px] rounded">
                              async
                            </span>
                          )}
                          {fn.isExported && (
                            <span className="px-1 py-0.5 bg-blue-100 text-blue-700 text-[10px] rounded">
                              export
                            </span>
                          )}
                          {fn.complexity && fn.complexity > 10 && (
                            <span className="px-1 py-0.5 bg-orange-100 text-orange-700 text-[10px] rounded">
                              complex
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Signature Preview */}
      <div className="w-72 flex-shrink-0 bg-gray-900 rounded-lg p-4 overflow-hidden">
        <h4 className="text-xs font-medium text-gray-400 uppercase mb-3">
          Function Preview
        </h4>
        {hoveredFunction ? (
          <div className="space-y-3">
            <div>
              <span className="text-xs text-gray-500">Signature</span>
              <pre className="text-sm text-green-400 font-mono mt-1 whitespace-pre-wrap break-all">
                {hoveredFunction.signature}
              </pre>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-gray-500">Lines</span>
                <p className="text-gray-300">
                  {hoveredFunction.startLine} - {hoveredFunction.endLine}
                </p>
              </div>
              {hoveredFunction.complexity && (
                <div>
                  <span className="text-gray-500">Complexity</span>
                  <p className={cn(
                    hoveredFunction.complexity > 10 ? 'text-orange-400' : 'text-gray-300'
                  )}>
                    {hoveredFunction.complexity}
                  </p>
                </div>
              )}
            </div>

            {hoveredFunction.parameters.length > 0 && (
              <div>
                <span className="text-xs text-gray-500">Parameters</span>
                <div className="mt-1 space-y-1">
                  {hoveredFunction.parameters.map((param, i) => (
                    <div key={i} className="text-xs">
                      <span className="text-blue-400">{param.name}</span>
                      {param.type && (
                        <span className="text-gray-500">: {param.type}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {hoveredFunction.returnType && (
              <div>
                <span className="text-xs text-gray-500">Returns</span>
                <p className="text-xs text-yellow-400">{hoveredFunction.returnType}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center text-gray-500 py-8">
            <Code className="w-8 h-8 mx-auto mb-2 text-gray-600" />
            <p className="text-sm">Hover over a function to preview</p>
          </div>
        )}
      </div>
    </div>
  );
}

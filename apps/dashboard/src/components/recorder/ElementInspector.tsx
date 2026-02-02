/**
 * ElementInspector Component
 * Element highlighting and selector generation
 */

import { useState } from 'react';
import { Card, Button } from '../ui';

interface ElementInfo {
  tagName: string;
  id?: string;
  className?: string;
  text?: string;
  attributes: Record<string, string>;
  rect: { x: number; y: number; width: number; height: number };
  xpath?: string;
  cssSelector?: string;
  testId?: string;
}

interface GeneratedSelector {
  type: 'id' | 'testId' | 'css' | 'xpath' | 'text' | 'role';
  value: string;
  confidence: number;
  recommended?: boolean;
}

interface ElementInspectorProps {
  element?: ElementInfo;
  selectors: GeneratedSelector[];
  onSelectorSelect: (selector: GeneratedSelector) => void;
  onClose?: () => void;
  isInspecting?: boolean;
  onToggleInspect?: () => void;
}

const SELECTOR_TYPE_LABELS: Record<GeneratedSelector['type'], string> = {
  id: 'ID',
  testId: 'Test ID',
  css: 'CSS',
  xpath: 'XPath',
  text: 'Text',
  role: 'Role',
};

const SELECTOR_TYPE_COLORS: Record<GeneratedSelector['type'], string> = {
  id: 'bg-green-100 text-green-700',
  testId: 'bg-blue-100 text-blue-700',
  css: 'bg-purple-100 text-purple-700',
  xpath: 'bg-orange-100 text-orange-700',
  text: 'bg-yellow-100 text-yellow-700',
  role: 'bg-cyan-100 text-cyan-700',
};

export function ElementInspector({
  element,
  selectors,
  onSelectorSelect,
  onClose,
  isInspecting = false,
  onToggleInspect,
}: ElementInspectorProps) {
  const [copiedSelector, setCopiedSelector] = useState<string | null>(null);

  const handleCopy = async (selector: GeneratedSelector) => {
    await navigator.clipboard.writeText(selector.value);
    setCopiedSelector(selector.value);
    setTimeout(() => setCopiedSelector(null), 2000);
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return 'text-green-600';
    if (confidence >= 0.7) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <h3 className="text-sm font-medium text-gray-700">Element Inspector</h3>
        </div>
        <div className="flex items-center gap-2">
          {onToggleInspect && (
            <Button
              variant={isInspecting ? 'primary' : 'secondary'}
              onClick={onToggleInspect}
              className="text-xs py-1 px-2"
            >
              {isInspecting ? (
                <>
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse mr-1" />
                  Inspecting
                </>
              ) : (
                'Start Inspect'
              )}
            </Button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-600 rounded"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {!element ? (
        <div className="p-8 text-center text-gray-500">
          <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
          </svg>
          <p className="font-medium">No element selected</p>
          <p className="text-sm mt-1">
            {isInspecting ? 'Click on any element to inspect' : 'Start inspecting to select an element'}
          </p>
        </div>
      ) : (
        <div className="p-4 space-y-4">
          {/* Element Info */}
          <div>
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Element</h4>
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-mono rounded">
                  {element.tagName.toLowerCase()}
                </span>
                {element.id && (
                  <span className="text-xs text-gray-500">#{element.id}</span>
                )}
              </div>
              {element.text && (
                <p className="text-sm text-gray-600 truncate">
                  "{element.text.slice(0, 50)}{element.text.length > 50 ? '...' : ''}"
                </p>
              )}
              {element.className && (
                <p className="text-xs text-gray-400 font-mono truncate mt-1">
                  .{element.className.split(' ').join('.')}
                </p>
              )}
            </div>
          </div>

          {/* Attributes */}
          {Object.keys(element.attributes).length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Attributes</h4>
              <div className="space-y-1 max-h-[120px] overflow-y-auto">
                {Object.entries(element.attributes).map(([key, value]) => (
                  <div key={key} className="flex items-center gap-2 text-xs">
                    <span className="text-gray-500">{key}:</span>
                    <span className="text-gray-700 font-mono truncate">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Position */}
          <div>
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Position</h4>
            <div className="grid grid-cols-4 gap-2 text-xs">
              <div className="text-center p-2 bg-gray-50 rounded">
                <p className="text-gray-500">X</p>
                <p className="font-mono">{Math.round(element.rect.x)}</p>
              </div>
              <div className="text-center p-2 bg-gray-50 rounded">
                <p className="text-gray-500">Y</p>
                <p className="font-mono">{Math.round(element.rect.y)}</p>
              </div>
              <div className="text-center p-2 bg-gray-50 rounded">
                <p className="text-gray-500">W</p>
                <p className="font-mono">{Math.round(element.rect.width)}</p>
              </div>
              <div className="text-center p-2 bg-gray-50 rounded">
                <p className="text-gray-500">H</p>
                <p className="font-mono">{Math.round(element.rect.height)}</p>
              </div>
            </div>
          </div>

          {/* Generated Selectors */}
          <div>
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Selectors</h4>
            <div className="space-y-2">
              {selectors.map((selector, index) => (
                <div
                  key={index}
                  className={`p-2 rounded-lg border transition-colors cursor-pointer ${
                    selector.recommended
                      ? 'border-green-300 bg-green-50'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                  onClick={() => onSelectorSelect(selector)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-1.5 py-0.5 text-xs rounded ${SELECTOR_TYPE_COLORS[selector.type]}`}>
                        {SELECTOR_TYPE_LABELS[selector.type]}
                      </span>
                      {selector.recommended && (
                        <span className="text-xs text-green-600 font-medium">Recommended</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs ${getConfidenceColor(selector.confidence)}`}>
                        {Math.round(selector.confidence * 100)}%
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopy(selector);
                        }}
                        className="p-1 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100"
                      >
                        {copiedSelector === selector.value ? (
                          <svg className="w-3 h-3 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                  <p className="text-xs font-mono text-gray-600 truncate">{selector.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

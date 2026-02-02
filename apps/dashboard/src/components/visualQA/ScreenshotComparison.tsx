/**
 * ScreenshotComparison Component
 * Side-by-side, overlay, and slider comparison modes for visual regression
 */

import { useState } from 'react';
import { Card, Button } from '../ui';

type ComparisonMode = 'side-by-side' | 'overlay' | 'slider' | 'diff';

interface ScreenshotComparisonProps {
  baselineUrl: string;
  actualUrl: string;
  diffUrl?: string;
  baselineLabel?: string;
  actualLabel?: string;
  diffPercentage?: number;
  onApprove?: () => void;
  onReject?: () => void;
}

export function ScreenshotComparison({
  baselineUrl,
  actualUrl,
  diffUrl,
  baselineLabel = 'Baseline',
  actualLabel = 'Actual',
  diffPercentage,
  onApprove,
  onReject,
}: ScreenshotComparisonProps) {
  const [mode, setMode] = useState<ComparisonMode>('side-by-side');
  const [sliderPosition, setSliderPosition] = useState(50);
  const [overlayOpacity, setOverlayOpacity] = useState(50);
  const [zoom, setZoom] = useState(100);

  const handleSliderMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    setSliderPosition(Math.max(0, Math.min(100, x)));
  };

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center gap-4">
          {/* Mode Selector */}
          <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
            {([
              { value: 'side-by-side', label: 'Side by Side' },
              { value: 'overlay', label: 'Overlay' },
              { value: 'slider', label: 'Slider' },
              { value: 'diff', label: 'Diff' },
            ] as const).map((m) => (
              <button
                key={m.value}
                onClick={() => setMode(m.value)}
                disabled={m.value === 'diff' && !diffUrl}
                className={`px-3 py-1 text-xs rounded transition-colors ${
                  mode === m.value
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900 disabled:opacity-50'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Diff Percentage */}
          {diffPercentage !== undefined && (
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${
              diffPercentage === 0
                ? 'bg-green-100 text-green-700'
                : diffPercentage < 1
                ? 'bg-yellow-100 text-yellow-700'
                : 'bg-red-100 text-red-700'
            }`}>
              {diffPercentage.toFixed(2)}% difference
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Zoom */}
          <select
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value={50}>50%</option>
            <option value={75}>75%</option>
            <option value={100}>100%</option>
            <option value={150}>150%</option>
            <option value={200}>200%</option>
          </select>

          {/* Actions */}
          {onApprove && (
            <Button onClick={onApprove} className="text-xs bg-green-600 hover:bg-green-700">
              <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Approve
            </Button>
          )}
          {onReject && (
            <Button onClick={onReject} variant="secondary" className="text-xs">
              <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Reject
            </Button>
          )}
        </div>
      </div>

      {/* Mode-specific controls */}
      {mode === 'overlay' && (
        <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 border-b border-gray-200">
          <span className="text-xs text-gray-500">Opacity:</span>
          <input
            type="range"
            min="0"
            max="100"
            value={overlayOpacity}
            onChange={(e) => setOverlayOpacity(Number(e.target.value))}
            className="flex-1 max-w-xs"
          />
          <span className="text-xs text-gray-600">{overlayOpacity}%</span>
        </div>
      )}

      {/* Comparison View */}
      <div className="bg-gray-100 overflow-auto" style={{ maxHeight: '600px' }}>
        {mode === 'side-by-side' && (
          <div className="flex gap-4 p-4">
            <div className="flex-1">
              <p className="text-xs font-medium text-gray-500 mb-2">{baselineLabel}</p>
              <img
                src={baselineUrl}
                alt={baselineLabel}
                className="border border-gray-300 rounded"
                style={{ width: `${zoom}%` }}
              />
            </div>
            <div className="flex-1">
              <p className="text-xs font-medium text-gray-500 mb-2">{actualLabel}</p>
              <img
                src={actualUrl}
                alt={actualLabel}
                className="border border-gray-300 rounded"
                style={{ width: `${zoom}%` }}
              />
            </div>
          </div>
        )}

        {mode === 'overlay' && (
          <div className="relative p-4">
            <img
              src={baselineUrl}
              alt={baselineLabel}
              className="border border-gray-300 rounded"
              style={{ width: `${zoom}%` }}
            />
            <img
              src={actualUrl}
              alt={actualLabel}
              className="absolute top-4 left-4 border border-gray-300 rounded"
              style={{ width: `${zoom}%`, opacity: overlayOpacity / 100 }}
            />
          </div>
        )}

        {mode === 'slider' && (
          <div
            className="relative p-4 cursor-ew-resize"
            onMouseMove={handleSliderMove}
          >
            <div className="relative overflow-hidden rounded border border-gray-300">
              <img
                src={actualUrl}
                alt={actualLabel}
                style={{ width: `${zoom}%` }}
              />
              <div
                className="absolute top-0 left-0 h-full overflow-hidden"
                style={{ width: `${sliderPosition}%` }}
              >
                <img
                  src={baselineUrl}
                  alt={baselineLabel}
                  style={{ width: `${(100 / sliderPosition) * zoom}%` }}
                />
              </div>
              {/* Slider Line */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-blue-500"
                style={{ left: `${sliderPosition}%` }}
              >
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                  </svg>
                </div>
              </div>
            </div>
            <div className="flex justify-between mt-2 text-xs text-gray-500">
              <span>{baselineLabel}</span>
              <span>{actualLabel}</span>
            </div>
          </div>
        )}

        {mode === 'diff' && diffUrl && (
          <div className="p-4">
            <p className="text-xs font-medium text-gray-500 mb-2">Difference Highlight</p>
            <img
              src={diffUrl}
              alt="Diff"
              className="border border-gray-300 rounded"
              style={{ width: `${zoom}%` }}
            />
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-t border-gray-200 text-xs text-gray-500">
        <span>Drag to compare | Scroll to pan</span>
        <span>Zoom: {zoom}%</span>
      </div>
    </Card>
  );
}

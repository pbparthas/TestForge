/**
 * VisualAssertionCapture Component
 * Region selection, screenshot capture, threshold setting for visual assertions
 */

import { useState, useRef } from 'react';
import { Card, Button } from '../ui';

interface CapturedRegion {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  screenshot?: string;
  threshold: number;
}

interface VisualAssertionCaptureProps {
  screenshotUrl?: string;
  regions: CapturedRegion[];
  onRegionAdd: (region: Omit<CapturedRegion, 'id'>) => void;
  onRegionUpdate: (regionId: string, updates: Partial<CapturedRegion>) => void;
  onRegionDelete: (regionId: string) => void;
  onCaptureScreenshot?: () => void;
  isCapturing?: boolean;
}

export function VisualAssertionCapture({
  screenshotUrl,
  regions,
  onRegionAdd,
  onRegionUpdate,
  onRegionDelete,
  onCaptureScreenshot,
  isCapturing = false,
}: VisualAssertionCaptureProps) {
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [drawCurrent, setDrawCurrent] = useState<{ x: number; y: number } | null>(null);
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const [newRegionName, setNewRegionName] = useState('');
  const [defaultThreshold, setDefaultThreshold] = useState(0.95);
  const imageRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!screenshotUrl || !imageRef.current) return;

    const rect = imageRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setIsDrawing(true);
    setDrawStart({ x, y });
    setDrawCurrent({ x, y });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawing || !imageRef.current) return;

    const rect = imageRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const y = Math.max(0, Math.min(e.clientY - rect.top, rect.height));

    setDrawCurrent({ x, y });
  };

  const handleMouseUp = () => {
    if (!isDrawing || !drawStart || !drawCurrent) {
      setIsDrawing(false);
      return;
    }

    const minX = Math.min(drawStart.x, drawCurrent.x);
    const minY = Math.min(drawStart.y, drawCurrent.y);
    const width = Math.abs(drawCurrent.x - drawStart.x);
    const height = Math.abs(drawCurrent.y - drawStart.y);

    // Only create region if it has meaningful size
    if (width > 10 && height > 10) {
      onRegionAdd({
        name: newRegionName || `Region ${regions.length + 1}`,
        x: minX,
        y: minY,
        width,
        height,
        threshold: defaultThreshold,
      });
      setNewRegionName('');
    }

    setIsDrawing(false);
    setDrawStart(null);
    setDrawCurrent(null);
  };

  const getDrawRect = () => {
    if (!drawStart || !drawCurrent) return null;

    return {
      left: Math.min(drawStart.x, drawCurrent.x),
      top: Math.min(drawStart.y, drawCurrent.y),
      width: Math.abs(drawCurrent.x - drawStart.x),
      height: Math.abs(drawCurrent.y - drawStart.y),
    };
  };

  const drawRect = getDrawRect();

  return (
    <div className="space-y-4">
      {/* Controls */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-gray-700">Visual Assertion Capture</h3>
          {onCaptureScreenshot && (
            <Button
              onClick={onCaptureScreenshot}
              disabled={isCapturing}
              className="text-xs"
            >
              {isCapturing ? (
                <>
                  <svg className="w-4 h-4 mr-1 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Capturing...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  </svg>
                  Capture Screenshot
                </>
              )}
            </Button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Region Name</label>
            <input
              type="text"
              value={newRegionName}
              onChange={(e) => setNewRegionName(e.target.value)}
              placeholder="e.g., Header, Login Button"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Default Threshold: {(defaultThreshold * 100).toFixed(0)}%
            </label>
            <input
              type="range"
              min="0.5"
              max="1"
              step="0.01"
              value={defaultThreshold}
              onChange={(e) => setDefaultThreshold(Number(e.target.value))}
              className="w-full"
            />
          </div>
        </div>
      </Card>

      {/* Screenshot Canvas */}
      <Card className="overflow-hidden">
        {!screenshotUrl ? (
          <div className="p-12 text-center text-gray-500 bg-gray-50">
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="font-medium">No screenshot captured</p>
            <p className="text-sm mt-1">Capture a screenshot to start drawing assertion regions</p>
          </div>
        ) : (
          <div
            ref={imageRef}
            className="relative cursor-crosshair select-none"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={() => setIsDrawing(false)}
          >
            <img
              src={screenshotUrl}
              alt="Screenshot"
              className="w-full"
              draggable={false}
            />

            {/* Existing Regions */}
            {regions.map((region) => (
              <div
                key={region.id}
                className={`absolute border-2 ${
                  selectedRegionId === region.id
                    ? 'border-blue-500 bg-blue-200/30'
                    : 'border-green-500 bg-green-200/20'
                }`}
                style={{
                  left: region.x,
                  top: region.y,
                  width: region.width,
                  height: region.height,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedRegionId(region.id);
                }}
              >
                <div className="absolute -top-6 left-0 px-1 py-0.5 bg-green-500 text-white text-xs rounded whitespace-nowrap">
                  {region.name}
                </div>
              </div>
            ))}

            {/* Drawing Rectangle */}
            {isDrawing && drawRect && (
              <div
                className="absolute border-2 border-dashed border-blue-500 bg-blue-200/30"
                style={{
                  left: drawRect.left,
                  top: drawRect.top,
                  width: drawRect.width,
                  height: drawRect.height,
                }}
              />
            )}
          </div>
        )}
      </Card>

      {/* Regions List */}
      {regions.length > 0 && (
        <Card className="p-4">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Captured Regions ({regions.length})</h4>
          <div className="space-y-2">
            {regions.map((region) => (
              <div
                key={region.id}
                className={`p-3 rounded-lg border transition-colors ${
                  selectedRegionId === region.id
                    ? 'border-blue-300 bg-blue-50'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
                onClick={() => setSelectedRegionId(region.id)}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-900">{region.name}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRegionDelete(region.id);
                    }}
                    className="p-1 text-gray-400 hover:text-red-600 rounded hover:bg-red-50"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span>
                    Position: {Math.round(region.x)}, {Math.round(region.y)}
                  </span>
                  <span>
                    Size: {Math.round(region.width)} x {Math.round(region.height)}
                  </span>
                </div>
                <div className="mt-2">
                  <label className="text-xs text-gray-500">
                    Threshold: {(region.threshold * 100).toFixed(0)}%
                  </label>
                  <input
                    type="range"
                    min="0.5"
                    max="1"
                    step="0.01"
                    value={region.threshold}
                    onChange={(e) => onRegionUpdate(region.id, { threshold: Number(e.target.value) })}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full"
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Instructions */}
      <Card className="p-3 bg-blue-50 border-blue-200">
        <div className="flex items-start gap-2">
          <svg className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-xs text-blue-700">
            <p className="font-medium">How to use:</p>
            <ol className="mt-1 space-y-0.5 list-decimal list-inside">
              <li>Capture a screenshot of the page</li>
              <li>Click and drag on the image to select regions</li>
              <li>Adjust threshold for each region (higher = stricter matching)</li>
              <li>Regions will be used for visual regression testing</li>
            </ol>
          </div>
        </div>
      </Card>
    </div>
  );
}

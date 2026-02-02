/**
 * VisualTestRunner Component
 * Configure and run visual regression tests
 */

import { useState } from 'react';
import { Card, Button } from '../ui';

interface Viewport {
  name: string;
  width: number;
  height: number;
}

interface Browser {
  id: string;
  name: string;
  icon: string;
}

interface VisualTestRunnerProps {
  pages: { id: string; name: string; url: string }[];
  viewports: Viewport[];
  browsers: Browser[];
  onRun: (config: {
    pageIds: string[];
    viewports: string[];
    browsers: string[];
    updateBaseline: boolean;
  }) => void;
  isRunning?: boolean;
  progress?: { current: number; total: number; currentPage?: string };
}

export function VisualTestRunner({
  pages,
  viewports,
  browsers,
  onRun,
  isRunning = false,
  progress,
}: VisualTestRunnerProps) {
  const [selectedPages, setSelectedPages] = useState<string[]>([]);
  const [selectedViewports, setSelectedViewports] = useState<string[]>(['Desktop']);
  const [selectedBrowsers, setSelectedBrowsers] = useState<string[]>(['chromium']);
  const [updateBaseline, setUpdateBaseline] = useState(false);

  const togglePage = (pageId: string) => {
    setSelectedPages((prev) =>
      prev.includes(pageId)
        ? prev.filter((id) => id !== pageId)
        : [...prev, pageId]
    );
  };

  const toggleViewport = (name: string) => {
    setSelectedViewports((prev) =>
      prev.includes(name)
        ? prev.filter((n) => n !== name)
        : [...prev, name]
    );
  };

  const toggleBrowser = (id: string) => {
    setSelectedBrowsers((prev) =>
      prev.includes(id)
        ? prev.filter((i) => i !== id)
        : [...prev, id]
    );
  };

  const selectAllPages = () => setSelectedPages(pages.map((p) => p.id));
  const clearPages = () => setSelectedPages([]);

  const totalTests = selectedPages.length * selectedViewports.length * selectedBrowsers.length;

  const handleRun = () => {
    onRun({
      pageIds: selectedPages,
      viewports: selectedViewports,
      browsers: selectedBrowsers,
      updateBaseline,
    });
  };

  return (
    <div className="space-y-4">
      {/* Pages Selection */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-gray-700">Pages to Test</h3>
          <div className="flex items-center gap-2 text-xs">
            <button onClick={selectAllPages} className="text-blue-600 hover:text-blue-700">
              Select all
            </button>
            <span className="text-gray-300">|</span>
            <button onClick={clearPages} className="text-gray-500 hover:text-gray-700">
              Clear
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-[200px] overflow-y-auto">
          {pages.map((page) => (
            <label
              key={page.id}
              className={`flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors ${
                selectedPages.includes(page.id)
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <input
                type="checkbox"
                checked={selectedPages.includes(page.id)}
                onChange={() => togglePage(page.id)}
                className="rounded border-gray-300 text-blue-600"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{page.name}</p>
                <p className="text-xs text-gray-500 truncate">{page.url}</p>
              </div>
            </label>
          ))}
        </div>
      </Card>

      {/* Viewports */}
      <Card className="p-4">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Viewports</h3>
        <div className="flex flex-wrap gap-2">
          {viewports.map((viewport) => (
            <button
              key={viewport.name}
              onClick={() => toggleViewport(viewport.name)}
              className={`px-3 py-2 rounded-lg border text-sm transition-colors ${
                selectedViewports.includes(viewport.name)
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 hover:bg-gray-50 text-gray-700'
              }`}
            >
              <span className="font-medium">{viewport.name}</span>
              <span className="text-xs text-gray-500 ml-1">
                ({viewport.width}x{viewport.height})
              </span>
            </button>
          ))}
        </div>
      </Card>

      {/* Browsers */}
      <Card className="p-4">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Browsers</h3>
        <div className="flex flex-wrap gap-2">
          {browsers.map((browser) => (
            <button
              key={browser.id}
              onClick={() => toggleBrowser(browser.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
                selectedBrowsers.includes(browser.id)
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 hover:bg-gray-50 text-gray-700'
              }`}
            >
              <span>{browser.icon}</span>
              <span className="font-medium">{browser.name}</span>
            </button>
          ))}
        </div>
      </Card>

      {/* Options */}
      <Card className="p-4">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Options</h3>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={updateBaseline}
            onChange={(e) => setUpdateBaseline(e.target.checked)}
            className="rounded border-gray-300 text-blue-600"
          />
          <div>
            <span className="text-sm text-gray-700">Update baselines</span>
            <p className="text-xs text-gray-500">Replace current baselines with new screenshots</p>
          </div>
        </label>
      </Card>

      {/* Run Button */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-700">
              {totalTests} test{totalTests !== 1 ? 's' : ''} will be run
            </p>
            <p className="text-xs text-gray-500">
              {selectedPages.length} page(s) × {selectedViewports.length} viewport(s) × {selectedBrowsers.length} browser(s)
            </p>
          </div>
          <Button
            onClick={handleRun}
            disabled={isRunning || totalTests === 0}
            className="min-w-[120px]"
          >
            {isRunning ? (
              <>
                <svg className="w-4 h-4 mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Running...
              </>
            ) : (
              <>
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Run Tests
              </>
            )}
          </Button>
        </div>

        {/* Progress */}
        {isRunning && progress && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-gray-600">{progress.currentPage || 'Starting...'}</span>
              <span className="text-gray-500">
                {progress.current} / {progress.total}
              </span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

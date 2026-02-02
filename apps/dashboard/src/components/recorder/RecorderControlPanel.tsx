/**
 * RecorderControlPanel Component
 * Start/Stop/Pause/Resume buttons, timer display, status indicator
 */

import { useState, useEffect, useRef } from 'react';
import { Card, Button } from '../ui';

type RecordingStatus = 'idle' | 'recording' | 'paused' | 'stopped';

interface RecorderControlPanelProps {
  status: RecordingStatus;
  onStart: () => void;
  onStop: () => void;
  onPause: () => void;
  onResume: () => void;
  onClear: () => void;
  actionCount: number;
  targetUrl?: string;
  onUrlChange?: (url: string) => void;
}

export function RecorderControlPanel({
  status,
  onStart,
  onStop,
  onPause,
  onResume,
  onClear,
  actionCount,
  targetUrl = '',
  onUrlChange,
}: RecorderControlPanelProps) {
  const [elapsedTime, setElapsedTime] = useState(0);
  const [url, setUrl] = useState(targetUrl);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (status === 'recording') {
      timerRef.current = setInterval(() => {
        setElapsedTime((prev) => prev + 1);
      }, 1000);
    } else if (status === 'idle' || status === 'stopped') {
      setElapsedTime(0);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [status]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUrlChange?.(url);
  };

  const statusColors = {
    idle: 'bg-gray-400',
    recording: 'bg-red-500 animate-pulse',
    paused: 'bg-yellow-500',
    stopped: 'bg-gray-500',
  };

  const statusLabels = {
    idle: 'Ready',
    recording: 'Recording',
    paused: 'Paused',
    stopped: 'Stopped',
  };

  return (
    <Card className="p-4">
      {/* URL Input */}
      <form onSubmit={handleUrlSubmit} className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Target URL</label>
        <div className="flex gap-2">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            disabled={status === 'recording' || status === 'paused'}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
          />
          <Button
            type="submit"
            variant="secondary"
            disabled={status === 'recording' || status === 'paused' || !url}
          >
            Set
          </Button>
        </div>
      </form>

      {/* Status & Timer */}
      <div className="flex items-center justify-between mb-4 p-3 bg-gray-50 rounded-lg">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${statusColors[status]}`} />
          <span className="text-sm font-medium text-gray-700">{statusLabels[status]}</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-center">
            <p className="text-2xl font-mono font-bold text-gray-900">{formatTime(elapsedTime)}</p>
            <p className="text-xs text-gray-500">Duration</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">{actionCount}</p>
            <p className="text-xs text-gray-500">Actions</p>
          </div>
        </div>
      </div>

      {/* Control Buttons */}
      <div className="flex items-center gap-2">
        {status === 'idle' || status === 'stopped' ? (
          <Button onClick={onStart} disabled={!url} className="flex-1">
            <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" />
            </svg>
            Start Recording
          </Button>
        ) : status === 'recording' ? (
          <>
            <Button onClick={onPause} variant="secondary" className="flex-1">
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Pause
            </Button>
            <Button onClick={onStop} className="flex-1 bg-red-600 hover:bg-red-700">
              <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="6" width="12" height="12" rx="1" />
              </svg>
              Stop
            </Button>
          </>
        ) : status === 'paused' ? (
          <>
            <Button onClick={onResume} className="flex-1">
              <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
              Resume
            </Button>
            <Button onClick={onStop} className="flex-1 bg-red-600 hover:bg-red-700">
              <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="6" width="12" height="12" rx="1" />
              </svg>
              Stop
            </Button>
          </>
        ) : null}

        {(status === 'stopped' || (status === 'idle' && actionCount > 0)) && (
          <Button onClick={onClear} variant="secondary">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </Button>
        )}
      </div>

      {/* Recording Tips */}
      {status === 'recording' && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start gap-2">
            <svg className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-xs text-red-700">
              <p className="font-medium">Recording in progress</p>
              <ul className="mt-1 space-y-0.5 text-red-600">
                <li>Click elements to record interactions</li>
                <li>Type to record input actions</li>
                <li>Right-click for assertion menu</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

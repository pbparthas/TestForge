/**
 * ActionTimeline Component
 * Real-time action list with edit/delete and reorder capability
 */

import { useState } from 'react';
import { Card } from '../ui';

interface RecordedAction {
  id: string;
  type: 'click' | 'type' | 'navigate' | 'scroll' | 'hover' | 'select' | 'assert' | 'wait' | 'screenshot';
  selector?: string;
  value?: string;
  description: string;
  timestamp: number;
  screenshot?: string;
}

interface ActionTimelineProps {
  actions: RecordedAction[];
  onActionEdit: (actionId: string, updates: Partial<RecordedAction>) => void;
  onActionDelete: (actionId: string) => void;
  onActionReorder: (actionId: string, direction: 'up' | 'down') => void;
  onActionSelect?: (action: RecordedAction) => void;
  selectedActionId?: string;
  isRecording?: boolean;
}

const ACTION_ICONS: Record<RecordedAction['type'], JSX.Element> = {
  click: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
    </svg>
  ),
  type: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  ),
  navigate: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
    </svg>
  ),
  scroll: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
    </svg>
  ),
  hover: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" />
    </svg>
  ),
  select: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
    </svg>
  ),
  assert: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  wait: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  screenshot: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
};

const ACTION_COLORS: Record<RecordedAction['type'], string> = {
  click: 'bg-blue-100 text-blue-700',
  type: 'bg-purple-100 text-purple-700',
  navigate: 'bg-green-100 text-green-700',
  scroll: 'bg-gray-100 text-gray-700',
  hover: 'bg-orange-100 text-orange-700',
  select: 'bg-cyan-100 text-cyan-700',
  assert: 'bg-emerald-100 text-emerald-700',
  wait: 'bg-yellow-100 text-yellow-700',
  screenshot: 'bg-pink-100 text-pink-700',
};

export function ActionTimeline({
  actions,
  onActionEdit,
  onActionDelete,
  onActionReorder,
  onActionSelect,
  selectedActionId,
  isRecording = false,
}: ActionTimelineProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const handleEditStart = (action: RecordedAction) => {
    setEditingId(action.id);
    setEditValue(action.value || action.selector || '');
  };

  const handleEditSave = (actionId: string) => {
    onActionEdit(actionId, { value: editValue });
    setEditingId(null);
    setEditValue('');
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditValue('');
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between p-3 bg-gray-50 border-b border-gray-200">
        <h3 className="text-sm font-medium text-gray-700">Recorded Actions</h3>
        <span className="text-xs text-gray-500">{actions.length} actions</span>
      </div>

      {actions.length === 0 ? (
        <div className="p-8 text-center text-gray-500">
          <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
          </svg>
          <p className="font-medium">No actions recorded yet</p>
          <p className="text-sm mt-1">Start recording to capture user interactions</p>
        </div>
      ) : (
        <div className="max-h-[500px] overflow-y-auto">
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200" />

            {actions.map((action, index) => (
              <div
                key={action.id}
                className={`relative flex items-start gap-3 p-3 border-b border-gray-100 transition-colors ${
                  selectedActionId === action.id ? 'bg-blue-50' : 'hover:bg-gray-50'
                } ${onActionSelect ? 'cursor-pointer' : ''}`}
                onClick={() => onActionSelect?.(action)}
              >
                {/* Timeline dot */}
                <div className={`relative z-10 p-2 rounded-lg ${ACTION_COLORS[action.type]}`}>
                  {ACTION_ICONS[action.type]}
                </div>

                {/* Action content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 capitalize">
                      {action.type}
                    </span>
                    <span className="text-xs text-gray-400">
                      {formatTimestamp(action.timestamp)}
                    </span>
                  </div>

                  {editingId === action.id ? (
                    <div className="mt-1 flex items-center gap-2">
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleEditSave(action.id);
                          if (e.key === 'Escape') handleEditCancel();
                        }}
                      />
                      <button
                        onClick={() => handleEditSave(action.id)}
                        className="p-1 text-green-600 hover:bg-green-50 rounded"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </button>
                      <button
                        onClick={handleEditCancel}
                        className="p-1 text-gray-400 hover:bg-gray-100 rounded"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm text-gray-600 truncate">{action.description}</p>
                      {action.selector && (
                        <p className="text-xs text-gray-400 font-mono truncate mt-0.5">
                          {action.selector}
                        </p>
                      )}
                    </>
                  )}
                </div>

                {/* Action buttons */}
                {!isRecording && editingId !== action.id && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onActionReorder(action.id, 'up');
                      }}
                      disabled={index === 0}
                      className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded disabled:opacity-30"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onActionReorder(action.id, 'down');
                      }}
                      disabled={index === actions.length - 1}
                      className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded disabled:opacity-30"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditStart(action);
                      }}
                      className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onActionDelete(action.id);
                      }}
                      className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            ))}

            {/* Recording indicator */}
            {isRecording && (
              <div className="flex items-center gap-3 p-3 bg-red-50">
                <div className="relative z-10 p-2 rounded-lg bg-red-100">
                  <div className="w-4 h-4 rounded-full bg-red-500 animate-pulse" />
                </div>
                <span className="text-sm text-red-600">Recording...</span>
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

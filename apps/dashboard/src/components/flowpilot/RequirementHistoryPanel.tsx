/**
 * RequirementHistoryPanel Component
 * Slide-over panel showing change history for a requirement
 */

import { cn } from '../../utils/cn';
import { X, History, Clock, User, ArrowRight } from 'lucide-react';
import type { ApiRequirement } from './RequirementsTable';

interface RequirementHistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  requirement: ApiRequirement | null;
}

const methodColors: Record<string, string> = {
  GET: 'bg-blue-100 text-blue-700',
  POST: 'bg-green-100 text-green-700',
  PUT: 'bg-yellow-100 text-yellow-700',
  DELETE: 'bg-red-100 text-red-700',
  PATCH: 'bg-purple-100 text-purple-700',
};

export function RequirementHistoryPanel({
  isOpen,
  onClose,
  requirement,
}: RequirementHistoryPanelProps) {
  if (!isOpen || !requirement) return null;

  const history = requirement.history || [];

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getFieldLabel = (field: string): string => {
    const labels: Record<string, string> = {
      method: 'HTTP Method',
      endpoint: 'Endpoint',
      title: 'Title',
      description: 'Description',
      type: 'Type',
      priority: 'Priority',
      status: 'Status',
    };
    return labels[field] || field;
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 transition-opacity"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 flex max-w-full pl-10">
        <div className="w-screen max-w-md">
          <div className="flex h-full flex-col bg-white shadow-xl">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                    <History className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Change History</h2>
                    <p className="text-sm text-gray-500">{requirement.title}</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Requirement Info */}
              <div className="mt-4 flex items-center gap-3">
                <span className={cn(
                  'px-2 py-1 text-xs font-bold rounded',
                  methodColors[requirement.method] || 'bg-gray-100 text-gray-700'
                )}>
                  {requirement.method}
                </span>
                <code className="text-sm font-mono text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                  {requirement.endpoint}
                </code>
              </div>
            </div>

            {/* History List */}
            <div className="flex-1 overflow-y-auto p-6">
              {history.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <History className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p className="font-medium">No changes recorded</p>
                  <p className="text-sm mt-1">Changes will appear here when the requirement is modified</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {history.map((entry) => (
                    <div
                      key={entry.id}
                      className="relative pl-6 pb-4 border-l-2 border-gray-200 last:border-l-transparent"
                    >
                      {/* Timeline dot */}
                      <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-white border-2 border-purple-400" />

                      {/* Entry content */}
                      <div className="bg-gray-50 rounded-lg p-4">
                        {/* Timestamp and user */}
                        <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDate(entry.timestamp)}
                          </div>
                          <div className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {entry.user}
                          </div>
                        </div>

                        {/* Change details */}
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-gray-700">
                            {getFieldLabel(entry.field)} changed
                          </p>
                          <div className="flex items-center gap-2 text-sm">
                            <span className="px-2 py-0.5 bg-red-50 text-red-700 rounded line-through">
                              {entry.oldValue || '(empty)'}
                            </span>
                            <ArrowRight className="w-4 h-4 text-gray-400" />
                            <span className="px-2 py-0.5 bg-green-50 text-green-700 rounded">
                              {entry.newValue || '(empty)'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Creation entry */}
                  <div className="relative pl-6">
                    <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-green-500" />
                    <div className="bg-green-50 rounded-lg p-4">
                      <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(requirement.createdAt)}
                      </div>
                      <p className="text-sm font-medium text-green-700">
                        Requirement created by {requirement.createdBy}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">
                  {history.length} change{history.length !== 1 ? 's' : ''} recorded
                </span>
                <span className="text-gray-500">
                  Last updated: {formatDate(requirement.updatedAt)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

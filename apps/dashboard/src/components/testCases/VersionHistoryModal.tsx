/**
 * VersionHistoryModal Component
 * Shows version history for a test case with diff view and restore capability
 */

import { useState } from 'react';
import { cn } from '../../utils/cn';
import {
  X,
  History,
  Clock,
  User,
  RotateCcw,
  ChevronRight,
  Eye,
  GitCompare,
  CheckCircle,
} from 'lucide-react';
import type { TestCase } from '../../types';

export interface TestCaseVersion {
  id: string;
  version: number;
  testCaseId: string;
  title: string;
  description?: string;
  type: 'manual' | 'automated' | 'hybrid';
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'draft' | 'active' | 'archived';
  steps: { order: number; action: string; expected?: string }[];
  expectedResult?: string;
  createdAt: string;
  createdBy: string;
  changeNote?: string;
}

export interface VersionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  testCase: TestCase | null;
  versions: TestCaseVersion[];
  onRestore: (version: TestCaseVersion) => void;
  isRestoring: boolean;
}

type ViewMode = 'list' | 'compare';

export function VersionHistoryModal({
  isOpen,
  onClose,
  testCase,
  versions,
  onRestore,
  isRestoring,
}: VersionHistoryModalProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedVersion, setSelectedVersion] = useState<TestCaseVersion | null>(null);
  const [compareVersions, setCompareVersions] = useState<{
    left: TestCaseVersion | null;
    right: TestCaseVersion | null;
  }>({ left: null, right: null });

  if (!isOpen || !testCase) return null;

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

  const handleVersionSelect = (version: TestCaseVersion) => {
    if (viewMode === 'compare') {
      if (!compareVersions.left) {
        setCompareVersions({ ...compareVersions, left: version });
      } else if (!compareVersions.right) {
        setCompareVersions({ ...compareVersions, right: version });
      }
    } else {
      setSelectedVersion(version);
    }
  };

  const clearCompare = () => {
    setCompareVersions({ left: null, right: null });
  };

  const renderDiff = (oldValue: string | undefined, newValue: string | undefined) => {
    if (oldValue === newValue) {
      return <span className="text-gray-600">{newValue || '(empty)'}</span>;
    }
    return (
      <div className="space-y-1">
        {oldValue && (
          <div className="text-red-600 line-through bg-red-50 px-2 py-1 rounded text-sm">
            {oldValue}
          </div>
        )}
        {newValue && (
          <div className="text-green-600 bg-green-50 px-2 py-1 rounded text-sm">
            {newValue}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-4 md:inset-10 bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
              <History className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Version History</h2>
              <p className="text-sm text-gray-500">{testCase.title}</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => {
                  setViewMode('list');
                  clearCompare();
                }}
                className={cn(
                  'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                  viewMode === 'list'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                )}
              >
                <Eye className="w-4 h-4 inline-block mr-1" />
                View
              </button>
              <button
                onClick={() => {
                  setViewMode('compare');
                  setSelectedVersion(null);
                }}
                className={cn(
                  'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                  viewMode === 'compare'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                )}
              >
                <GitCompare className="w-4 h-4 inline-block mr-1" />
                Compare
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Version List */}
          <div className="w-80 border-r border-gray-200 overflow-y-auto">
            <div className="p-4">
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">
                {versions.length} Version{versions.length !== 1 ? 's' : ''}
              </h3>

              {viewMode === 'compare' && (
                <div className="mb-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
                  Select two versions to compare
                  {(compareVersions.left || compareVersions.right) && (
                    <button
                      onClick={clearCompare}
                      className="ml-2 text-blue-600 hover:text-blue-800 underline"
                    >
                      Clear
                    </button>
                  )}
                </div>
              )}

              <div className="space-y-2">
                {versions.map((version, index) => {
                  const isSelected =
                    viewMode === 'list'
                      ? selectedVersion?.id === version.id
                      : compareVersions.left?.id === version.id ||
                        compareVersions.right?.id === version.id;

                  return (
                    <button
                      key={version.id}
                      onClick={() => handleVersionSelect(version)}
                      className={cn(
                        'w-full text-left p-3 rounded-lg border transition-all',
                        isSelected
                          ? 'bg-blue-50 border-blue-200 ring-2 ring-blue-500'
                          : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-900">
                          Version {version.version}
                        </span>
                        {index === 0 && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded">
                            Current
                          </span>
                        )}
                        {viewMode === 'compare' && isSelected && (
                          <CheckCircle className="w-4 h-4 text-blue-600" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Clock className="w-3 h-3" />
                        {formatDate(version.createdAt)}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                        <User className="w-3 h-3" />
                        {version.createdBy}
                      </div>
                      {version.changeNote && (
                        <p className="mt-2 text-xs text-gray-600 italic">
                          "{version.changeNote}"
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>

              {versions.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <History className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p className="font-medium">No version history</p>
                  <p className="text-sm mt-1">Changes will be tracked here</p>
                </div>
              )}
            </div>
          </div>

          {/* Version Detail / Compare View */}
          <div className="flex-1 overflow-y-auto p-6">
            {viewMode === 'list' && selectedVersion && (
              <div className="max-w-3xl">
                {/* Version Header */}
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">
                      Version {selectedVersion.version}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {formatDate(selectedVersion.createdAt)} by {selectedVersion.createdBy}
                    </p>
                  </div>
                  {selectedVersion.version !== versions[0]?.version && (
                    <button
                      onClick={() => onRestore(selectedVersion)}
                      disabled={isRestoring}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      <RotateCcw className="w-4 h-4" />
                      {isRestoring ? 'Restoring...' : 'Restore This Version'}
                    </button>
                  )}
                </div>

                {/* Version Content */}
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Title</label>
                    <p className="text-gray-900">{selectedVersion.title}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Description</label>
                    <p className="text-gray-900">{selectedVersion.description || '(none)'}</p>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">Type</label>
                      <span className="capitalize text-gray-900">{selectedVersion.type}</span>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">Priority</label>
                      <span className="capitalize text-gray-900">{selectedVersion.priority}</span>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">Status</label>
                      <span className="capitalize text-gray-900">{selectedVersion.status}</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-2">Test Steps</label>
                    <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                      {selectedVersion.steps.map((step, i) => (
                        <div key={i} className="flex gap-3">
                          <span className="text-sm font-medium text-gray-400 w-6">{step.order}.</span>
                          <span className="text-sm text-gray-700">{step.action}</span>
                        </div>
                      ))}
                      {selectedVersion.steps.length === 0 && (
                        <p className="text-sm text-gray-500">(no steps)</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Expected Result</label>
                    <p className="text-gray-900">{selectedVersion.expectedResult || '(none)'}</p>
                  </div>
                </div>
              </div>
            )}

            {viewMode === 'compare' && compareVersions.left && compareVersions.right && (
              <div className="max-w-4xl">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">
                  Comparing Version {compareVersions.left.version} → Version {compareVersions.right.version}
                </h3>

                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">
                        Title (v{compareVersions.left.version})
                      </label>
                      <p className="text-gray-900 bg-gray-50 p-2 rounded">{compareVersions.left.title}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">
                        Title (v{compareVersions.right.version})
                      </label>
                      {renderDiff(compareVersions.left.title, compareVersions.right.title)}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">
                        Priority (v{compareVersions.left.version})
                      </label>
                      <p className="text-gray-900 bg-gray-50 p-2 rounded capitalize">{compareVersions.left.priority}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">
                        Priority (v{compareVersions.right.version})
                      </label>
                      {renderDiff(compareVersions.left.priority, compareVersions.right.priority)}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">
                        Steps (v{compareVersions.left.version})
                      </label>
                      <div className="bg-gray-50 rounded-lg p-3 text-sm">
                        {compareVersions.left.steps.map((s, i) => (
                          <div key={i}>{s.order}. {s.action}</div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">
                        Steps (v{compareVersions.right.version})
                      </label>
                      <div className="bg-gray-50 rounded-lg p-3 text-sm">
                        {compareVersions.right.steps.map((s, i) => (
                          <div key={i}>{s.order}. {s.action}</div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {viewMode === 'list' && !selectedVersion && (
              <div className="flex items-center justify-center h-full text-gray-500">
                <div className="text-center">
                  <ChevronRight className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p className="font-medium">Select a version to view details</p>
                </div>
              </div>
            )}

            {viewMode === 'compare' && (!compareVersions.left || !compareVersions.right) && (
              <div className="flex items-center justify-center h-full text-gray-500">
                <div className="text-center">
                  <GitCompare className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p className="font-medium">Select two versions to compare</p>
                  <p className="text-sm mt-1">
                    {compareVersions.left ? '1 of 2 selected' : '0 of 2 selected'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * LinkTestCaseModal Component
 * Dual-panel: Available vs Linked, search and filter, drag-drop linking
 */

import { useState } from 'react';
import { Button, StatusBadge } from '../ui';

interface TestCase {
  id: string;
  title: string;
  status: 'passed' | 'failed' | 'pending' | 'skipped';
  suiteId?: string;
  suiteName?: string;
}

interface LinkTestCaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  requirementTitle: string;
  availableTestCases: TestCase[];
  linkedTestCases: TestCase[];
  onLink: (testCaseIds: string[]) => void;
  onUnlink: (testCaseIds: string[]) => void;
}

export function LinkTestCaseModal({
  isOpen,
  onClose,
  requirementTitle,
  availableTestCases,
  linkedTestCases,
  onLink,
  onUnlink,
}: LinkTestCaseModalProps) {
  const [searchAvailable, setSearchAvailable] = useState('');
  const [searchLinked, setSearchLinked] = useState('');
  const [selectedAvailable, setSelectedAvailable] = useState<string[]>([]);
  const [selectedLinked, setSelectedLinked] = useState<string[]>([]);

  if (!isOpen) return null;

  const filteredAvailable = availableTestCases.filter(
    (tc) =>
      tc.title.toLowerCase().includes(searchAvailable.toLowerCase()) ||
      tc.suiteName?.toLowerCase().includes(searchAvailable.toLowerCase())
  );

  const filteredLinked = linkedTestCases.filter(
    (tc) =>
      tc.title.toLowerCase().includes(searchLinked.toLowerCase()) ||
      tc.suiteName?.toLowerCase().includes(searchLinked.toLowerCase())
  );

  const handleLinkSelected = () => {
    if (selectedAvailable.length > 0) {
      onLink(selectedAvailable);
      setSelectedAvailable([]);
    }
  };

  const handleUnlinkSelected = () => {
    if (selectedLinked.length > 0) {
      onUnlink(selectedLinked);
      setSelectedLinked([]);
    }
  };

  const toggleAvailableSelection = (id: string) => {
    setSelectedAvailable((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleLinkedSelection = (id: string) => {
    setSelectedLinked((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const selectAllAvailable = () => {
    if (selectedAvailable.length === filteredAvailable.length) {
      setSelectedAvailable([]);
    } else {
      setSelectedAvailable(filteredAvailable.map((tc) => tc.id));
    }
  };

  const selectAllLinked = () => {
    if (selectedLinked.length === filteredLinked.length) {
      setSelectedLinked([]);
    } else {
      setSelectedLinked(filteredLinked.map((tc) => tc.id));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Link Test Cases</h2>
              <p className="text-sm text-gray-500 truncate max-w-md">
                Requirement: {requirementTitle}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Dual Panel */}
        <div className="flex-1 flex overflow-hidden">
          {/* Available Test Cases */}
          <div className="flex-1 flex flex-col border-r border-gray-200">
            <div className="p-3 bg-gray-50 border-b border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-700">
                  Available ({availableTestCases.length})
                </h3>
                <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedAvailable.length === filteredAvailable.length && filteredAvailable.length > 0}
                    onChange={selectAllAvailable}
                    className="rounded border-gray-300 text-blue-600"
                  />
                  Select all
                </label>
              </div>
              <input
                type="text"
                value={searchAvailable}
                onChange={(e) => setSearchAvailable(e.target.value)}
                placeholder="Search available..."
                className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {filteredAvailable.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-sm">
                  No available test cases
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredAvailable.map((tc) => (
                    <div
                      key={tc.id}
                      onClick={() => toggleAvailableSelection(tc.id)}
                      className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                        selectedAvailable.includes(tc.id)
                          ? 'bg-blue-50 border border-blue-200'
                          : 'hover:bg-gray-50 border border-transparent'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedAvailable.includes(tc.id)}
                        onChange={() => toggleAvailableSelection(tc.id)}
                        className="rounded border-gray-300 text-blue-600"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{tc.title}</p>
                        {tc.suiteName && (
                          <p className="text-xs text-gray-500 truncate">{tc.suiteName}</p>
                        )}
                      </div>
                      <StatusBadge status={tc.status} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col items-center justify-center gap-2 p-2 bg-gray-50">
            <Button
              onClick={handleLinkSelected}
              disabled={selectedAvailable.length === 0}
              className="px-3 py-2"
              title="Link selected"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Button>
            <Button
              onClick={handleUnlinkSelected}
              disabled={selectedLinked.length === 0}
              variant="secondary"
              className="px-3 py-2"
              title="Unlink selected"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Button>
          </div>

          {/* Linked Test Cases */}
          <div className="flex-1 flex flex-col">
            <div className="p-3 bg-gray-50 border-b border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-700">
                  Linked ({linkedTestCases.length})
                </h3>
                <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedLinked.length === filteredLinked.length && filteredLinked.length > 0}
                    onChange={selectAllLinked}
                    className="rounded border-gray-300 text-blue-600"
                  />
                  Select all
                </label>
              </div>
              <input
                type="text"
                value={searchLinked}
                onChange={(e) => setSearchLinked(e.target.value)}
                placeholder="Search linked..."
                className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {filteredLinked.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-sm">
                  No linked test cases
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredLinked.map((tc) => (
                    <div
                      key={tc.id}
                      onClick={() => toggleLinkedSelection(tc.id)}
                      className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                        selectedLinked.includes(tc.id)
                          ? 'bg-blue-50 border border-blue-200'
                          : 'hover:bg-gray-50 border border-transparent'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedLinked.includes(tc.id)}
                        onChange={() => toggleLinkedSelection(tc.id)}
                        className="rounded border-gray-300 text-blue-600"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{tc.title}</p>
                        {tc.suiteName && (
                          <p className="text-xs text-gray-500 truncate">{tc.suiteName}</p>
                        )}
                      </div>
                      <StatusBadge status={tc.status} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 flex justify-between items-center">
          <p className="text-sm text-gray-500">
            {selectedAvailable.length > 0 && `${selectedAvailable.length} available selected`}
            {selectedAvailable.length > 0 && selectedLinked.length > 0 && ' · '}
            {selectedLinked.length > 0 && `${selectedLinked.length} linked selected`}
          </p>
          <Button variant="secondary" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}

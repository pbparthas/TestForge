/**
 * TraceabilityMatrixModal Component
 * Matrix grid (requirements vs test cases), color-coded coverage, export to CSV
 */

import { useState } from 'react';
import { Button } from '../ui';

interface Requirement {
  id: string;
  externalId?: string;
  title: string;
}

interface TestCase {
  id: string;
  title: string;
  status: 'passed' | 'failed' | 'pending' | 'skipped';
}

interface Link {
  requirementId: string;
  testCaseId: string;
}

interface TraceabilityMatrixModalProps {
  isOpen: boolean;
  onClose: () => void;
  requirements: Requirement[];
  testCases: TestCase[];
  links: Link[];
  onLinkToggle: (requirementId: string, testCaseId: string) => void;
}

export function TraceabilityMatrixModal({
  isOpen,
  onClose,
  requirements,
  testCases,
  links,
  onLinkToggle,
}: TraceabilityMatrixModalProps) {
  const [search, setSearch] = useState('');
  const [showOnlyUnlinked, setShowOnlyUnlinked] = useState(false);

  if (!isOpen) return null;

  const isLinked = (reqId: string, tcId: string) =>
    links.some((l) => l.requirementId === reqId && l.testCaseId === tcId);

  const getRequirementCoverage = (reqId: string) => {
    const linkedTcs = links.filter((l) => l.requirementId === reqId);
    if (linkedTcs.length === 0) return 'none';
    const passedCount = linkedTcs.filter((l) => {
      const tc = testCases.find((t) => t.id === l.testCaseId);
      return tc?.status === 'passed';
    }).length;
    if (passedCount === linkedTcs.length) return 'full';
    if (passedCount > 0) return 'partial';
    return 'failing';
  };

  const filteredRequirements = requirements.filter((r) => {
    if (search) {
      const s = search.toLowerCase();
      if (!r.title.toLowerCase().includes(s) && !r.externalId?.toLowerCase().includes(s)) {
        return false;
      }
    }
    if (showOnlyUnlinked) {
      const hasLinks = links.some((l) => l.requirementId === r.id);
      if (hasLinks) return false;
    }
    return true;
  });

  const filteredTestCases = testCases.filter((tc) => {
    if (search) {
      return tc.title.toLowerCase().includes(search.toLowerCase());
    }
    return true;
  });

  const exportToCsv = () => {
    const headers = ['Requirement', ...filteredTestCases.map((tc) => tc.title)];
    const rows = filteredRequirements.map((req) => [
      req.externalId || req.title,
      ...filteredTestCases.map((tc) => (isLinked(req.id, tc.id) ? 'X' : '')),
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'traceability-matrix.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const coverageColors = {
    full: 'bg-green-500',
    partial: 'bg-yellow-500',
    failing: 'bg-red-500',
    none: 'bg-gray-300',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Traceability Matrix</h2>
            <p className="text-sm text-gray-500">
              {requirements.length} requirements × {testCases.length} test cases
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={exportToCsv}>
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export CSV
            </Button>
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

        {/* Filters */}
        <div className="flex items-center gap-4 p-4 border-b border-gray-200">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search requirements or test cases..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={showOnlyUnlinked}
              onChange={(e) => setShowOnlyUnlinked(e.target.checked)}
              className="rounded border-gray-300 text-blue-600"
            />
            Show unlinked only
          </label>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 px-4 py-2 bg-gray-50 border-b border-gray-200 text-xs">
          <span className="text-gray-500">Coverage:</span>
          <span className="flex items-center gap-1">
            <span className={`w-3 h-3 rounded ${coverageColors.full}`} />
            Full (all pass)
          </span>
          <span className="flex items-center gap-1">
            <span className={`w-3 h-3 rounded ${coverageColors.partial}`} />
            Partial
          </span>
          <span className="flex items-center gap-1">
            <span className={`w-3 h-3 rounded ${coverageColors.failing}`} />
            Failing
          </span>
          <span className="flex items-center gap-1">
            <span className={`w-3 h-3 rounded ${coverageColors.none}`} />
            No coverage
          </span>
        </div>

        {/* Matrix */}
        <div className="flex-1 overflow-auto">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 bg-white z-10">
              <tr>
                <th className="sticky left-0 bg-gray-100 p-2 text-left text-xs font-medium text-gray-600 border-b border-r border-gray-200 min-w-[200px]">
                  Requirement
                </th>
                {filteredTestCases.map((tc) => (
                  <th
                    key={tc.id}
                    className="p-2 text-left text-xs font-medium text-gray-600 border-b border-gray-200 min-w-[120px] max-w-[150px]"
                    title={tc.title}
                  >
                    <div className="truncate">{tc.title}</div>
                    <span
                      className={`inline-block w-2 h-2 rounded-full mt-1 ${
                        tc.status === 'passed'
                          ? 'bg-green-500'
                          : tc.status === 'failed'
                          ? 'bg-red-500'
                          : 'bg-gray-300'
                      }`}
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRequirements.map((req) => {
                const coverage = getRequirementCoverage(req.id);
                return (
                  <tr key={req.id} className="hover:bg-gray-50">
                    <td className="sticky left-0 bg-white p-2 border-b border-r border-gray-200">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${coverageColors[coverage]}`} />
                        <div>
                          {req.externalId && (
                            <span className="text-xs font-mono text-gray-400 mr-1">
                              {req.externalId}
                            </span>
                          )}
                          <span className="text-sm font-medium text-gray-900 truncate block max-w-[180px]">
                            {req.title}
                          </span>
                        </div>
                      </div>
                    </td>
                    {filteredTestCases.map((tc) => {
                      const linked = isLinked(req.id, tc.id);
                      return (
                        <td
                          key={tc.id}
                          className="p-2 border-b border-gray-200 text-center cursor-pointer hover:bg-gray-100"
                          onClick={() => onLinkToggle(req.id, tc.id)}
                        >
                          {linked ? (
                            <span
                              className={`inline-flex items-center justify-center w-6 h-6 rounded ${
                                tc.status === 'passed'
                                  ? 'bg-green-100 text-green-600'
                                  : tc.status === 'failed'
                                  ? 'bg-red-100 text-red-600'
                                  : 'bg-blue-100 text-blue-600'
                              }`}
                            >
                              ✓
                            </span>
                          ) : (
                            <span className="inline-flex items-center justify-center w-6 h-6 text-gray-300">
                              -
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 flex justify-between items-center">
          <p className="text-sm text-gray-500">
            Click cells to link/unlink requirements and test cases
          </p>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

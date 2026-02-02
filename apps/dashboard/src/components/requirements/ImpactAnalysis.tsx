/**
 * ImpactAnalysis Component
 * Downstream dependencies, affected test cases list
 */

import { Card, StatusBadge } from '../ui';

interface Requirement {
  id: string;
  externalId?: string;
  title: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

interface TestCase {
  id: string;
  title: string;
  status: 'passed' | 'failed' | 'pending' | 'skipped';
  lastRun?: string;
}

interface ImpactAnalysisProps {
  requirement: Requirement;
  linkedTestCases: TestCase[];
  dependentRequirements: Requirement[];
  onViewTestCase: (testCaseId: string) => void;
  onViewRequirement: (requirementId: string) => void;
}

export function ImpactAnalysis({
  requirement,
  linkedTestCases,
  dependentRequirements,
  onViewTestCase,
  onViewRequirement,
}: ImpactAnalysisProps) {
  const passedTests = linkedTestCases.filter((tc) => tc.status === 'passed').length;
  const failedTests = linkedTestCases.filter((tc) => tc.status === 'failed').length;
  const coveragePercentage = linkedTestCases.length > 0 ? (passedTests / linkedTestCases.length) * 100 : 0;

  const priorityColors = {
    low: 'bg-gray-100 text-gray-700',
    medium: 'bg-blue-100 text-blue-700',
    high: 'bg-orange-100 text-orange-700',
    critical: 'bg-red-100 text-red-700',
  };

  return (
    <div className="space-y-4">
      {/* Requirement Header */}
      <Card className="p-4">
        <div className="flex items-start justify-between">
          <div>
            {requirement.externalId && (
              <span className="text-xs font-mono text-gray-400">{requirement.externalId}</span>
            )}
            <h3 className="text-lg font-semibold text-gray-900">{requirement.title}</h3>
          </div>
          <span className={`px-2 py-1 text-xs rounded-full ${priorityColors[requirement.priority]}`}>
            {requirement.priority}
          </span>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-4 mt-4">
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <p className="text-2xl font-bold text-gray-900">{linkedTestCases.length}</p>
            <p className="text-xs text-gray-500">Linked Tests</p>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <p className="text-2xl font-bold text-green-600">{Math.round(coveragePercentage)}%</p>
            <p className="text-xs text-gray-500">Pass Rate</p>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <p className="text-2xl font-bold text-gray-600">{dependentRequirements.length}</p>
            <p className="text-xs text-gray-500">Dependencies</p>
          </div>
        </div>
      </Card>

      {/* Linked Test Cases */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-medium text-gray-900">Linked Test Cases</h4>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-green-600">{passedTests} passed</span>
            <span className="text-red-600">{failedTests} failed</span>
          </div>
        </div>

        {linkedTestCases.length === 0 ? (
          <div className="text-center py-6 text-gray-500">
            <p>No test cases linked</p>
            <p className="text-sm mt-1">Link test cases to track coverage</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {linkedTestCases.map((tc) => (
              <div
                key={tc.id}
                onClick={() => onViewTestCase(tc.id)}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">{tc.title}</p>
                  {tc.lastRun && (
                    <p className="text-xs text-gray-500">
                      Last run: {new Date(tc.lastRun).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <StatusBadge status={tc.status} />
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Dependent Requirements */}
      {dependentRequirements.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h4 className="font-medium text-gray-900">Impact Analysis</h4>
          </div>

          <p className="text-sm text-gray-600 mb-3">
            Changes to this requirement may affect the following:
          </p>

          <div className="space-y-2">
            {dependentRequirements.map((req) => (
              <div
                key={req.id}
                onClick={() => onViewRequirement(req.id)}
                className="flex items-center justify-between p-3 border border-amber-200 bg-amber-50 rounded-lg cursor-pointer hover:bg-amber-100 transition-colors"
              >
                <div>
                  {req.externalId && (
                    <span className="text-xs font-mono text-amber-600 mr-2">{req.externalId}</span>
                  )}
                  <span className="text-sm font-medium text-gray-900">{req.title}</span>
                </div>
                <span className={`px-2 py-0.5 text-xs rounded ${priorityColors[req.priority]}`}>
                  {req.priority}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-3 p-3 bg-amber-100 rounded-lg">
            <p className="text-xs text-amber-800">
              <strong>Total Impact:</strong> {linkedTestCases.length} test cases and{' '}
              {dependentRequirements.length} dependent requirements may be affected by changes.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}

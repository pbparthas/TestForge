/**
 * ExecuteTab Component
 * Suite selection, execution profile dropdown, run button
 */

import { useState } from 'react';
import { Card, Button } from '../ui';

interface TestSuite {
  id: string;
  name: string;
  description?: string;
  testCount: number;
  status: string;
}

interface ExecutionProfile {
  id: string;
  name: string;
  description?: string;
  device: string;
  browser: string;
  parallel: number;
  headless: boolean;
}

interface ExecuteTabProps {
  suites: TestSuite[];
  profiles: ExecutionProfile[];
  onExecute: (suiteIds: string[], profileId: string) => void;
  isExecuting?: boolean;
}

export function ExecuteTab({ suites, profiles, onExecute, isExecuting = false }: ExecuteTabProps) {
  const [selectedSuites, setSelectedSuites] = useState<string[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<string>(profiles[0]?.id || '');
  const [selectAll, setSelectAll] = useState(false);

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedSuites([]);
    } else {
      setSelectedSuites(suites.map((s) => s.id));
    }
    setSelectAll(!selectAll);
  };

  const handleToggleSuite = (suiteId: string) => {
    setSelectedSuites((prev) =>
      prev.includes(suiteId) ? prev.filter((id) => id !== suiteId) : [...prev, suiteId]
    );
  };

  const handleExecute = () => {
    if (selectedSuites.length > 0 && selectedProfile) {
      onExecute(selectedSuites, selectedProfile);
    }
  };

  const totalTests = suites
    .filter((s) => selectedSuites.includes(s.id))
    .reduce((sum, s) => sum + s.testCount, 0);

  const selectedProfileData = profiles.find((p) => p.id === selectedProfile);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Suite Selection */}
      <div className="lg:col-span-2">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-gray-900">Select Test Suites</h3>
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={selectAll}
                onChange={handleSelectAll}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              Select All
            </label>
          </div>

          {suites.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              <p>No test suites found</p>
              <p className="text-sm mt-1">Create a suite first to execute tests</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {suites.map((suite) => (
                <label
                  key={suite.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedSuites.includes(suite.id)
                      ? 'border-blue-200 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedSuites.includes(suite.id)}
                    onChange={() => handleToggleSuite(suite.id)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{suite.name}</p>
                    {suite.description && (
                      <p className="text-sm text-gray-500 truncate">{suite.description}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">{suite.testCount}</p>
                    <p className="text-xs text-gray-500">tests</p>
                  </div>
                </label>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Execution Config */}
      <div className="space-y-4">
        <Card className="p-4">
          <h3 className="font-medium text-gray-900 mb-4">Execution Profile</h3>

          <select
            value={selectedProfile}
            onChange={(e) => setSelectedProfile(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
          >
            {profiles.length === 0 ? (
              <option value="">No profiles available</option>
            ) : (
              profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.name}
                </option>
              ))
            )}
          </select>

          {selectedProfileData && (
            <div className="p-3 bg-gray-50 rounded-lg space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Device</span>
                <span className="font-medium">{selectedProfileData.device}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Browser</span>
                <span className="font-medium">{selectedProfileData.browser}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Parallel</span>
                <span className="font-medium">{selectedProfileData.parallel} workers</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Headless</span>
                <span className="font-medium">{selectedProfileData.headless ? 'Yes' : 'No'}</span>
              </div>
            </div>
          )}
        </Card>

        <Card className="p-4">
          <h3 className="font-medium text-gray-900 mb-3">Summary</h3>
          <div className="space-y-2 mb-4">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Selected Suites</span>
              <span className="font-medium">{selectedSuites.length}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Total Tests</span>
              <span className="font-medium">{totalTests}</span>
            </div>
          </div>

          <Button
            onClick={handleExecute}
            disabled={selectedSuites.length === 0 || !selectedProfile}
            isLoading={isExecuting}
            className="w-full"
          >
            {isExecuting ? 'Executing...' : `Run ${totalTests} Tests`}
          </Button>

          {selectedSuites.length === 0 && (
            <p className="text-xs text-amber-600 mt-2 text-center">
              Select at least one suite to execute
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}

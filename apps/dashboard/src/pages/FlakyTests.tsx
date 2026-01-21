/**
 * Flaky Tests Page
 * Sprint 14: Dashboard for managing flaky tests with AI analysis
 */

import { useEffect, useState } from 'react';
import { useProjectStore } from '../stores/project';
import { api } from '../services/api';
import { Card, Badge, Button, Input } from '../components/ui';

// Types
interface FlakyTest {
  id: string;
  testName: string;
  testId: string;
  scriptId: string | null;
  flakinessScore: number;
  totalRuns: number;
  passCount: number;
  failCount: number;
  passRate: number;
  isQuarantined: boolean;
  quarantinedAt: string | null;
  quarantineReason: string | null;
  patternType: string | null;
  fixStatus: 'open' | 'investigating' | 'fixed' | 'wont_fix';
}

interface FlakySummary {
  totalFlaky: number;
  quarantined: number;
  investigating: number;
  fixed: number;
  avgScore: number;
  worstOffenders: FlakyTest[];
}

interface FlakyPattern {
  patternType: string;
  description: string;
  severity: string;
  affectedTestIds: string[];
  confidence: number;
  suggestedFix: string | null;
}

interface FlakyTrend {
  date: string;
  totalFlaky: number;
  newFlaky: number;
  fixed: number;
  quarantined: number;
  avgScore: number;
}

// Pattern type colors
const PATTERN_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  timing: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Timing' },
  race_condition: { bg: 'bg-red-100', text: 'text-red-800', label: 'Race Condition' },
  flaky_selector: { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Flaky Selector' },
  network: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Network' },
  state_dependent: { bg: 'bg-orange-100', text: 'text-orange-800', label: 'State Dependent' },
  environment: { bg: 'bg-green-100', text: 'text-green-800', label: 'Environment' },
  data_dependent: { bg: 'bg-pink-100', text: 'text-pink-800', label: 'Data Dependent' },
  unknown: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Unknown' },
};

// Fix status colors
const FIX_STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  open: { bg: 'bg-red-100', text: 'text-red-800', label: 'Open' },
  investigating: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Investigating' },
  fixed: { bg: 'bg-green-100', text: 'text-green-800', label: 'Fixed' },
  wont_fix: { bg: 'bg-gray-100', text: 'text-gray-800', label: "Won't Fix" },
};

export function FlakyTestsPage() {
  const { currentProject } = useProjectStore();
  const [flakyTests, setFlakyTests] = useState<FlakyTest[]>([]);
  const [summary, setSummary] = useState<FlakySummary | null>(null);
  const [patterns, setPatterns] = useState<FlakyPattern[]>([]);
  const [trends, setTrends] = useState<FlakyTrend[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [patternFilter, setPatternFilter] = useState<string>('all');
  const [selectedTest, setSelectedTest] = useState<FlakyTest | null>(null);
  const [showQuarantineModal, setShowQuarantineModal] = useState(false);
  const [quarantineReason, setQuarantineReason] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'tests' | 'patterns' | 'trends'>('overview');

  useEffect(() => {
    if (currentProject) {
      loadData();
    }
  }, [currentProject]);

  const loadData = async () => {
    if (!currentProject) return;
    setLoading(true);
    try {
      const [testsRes, summaryRes, patternsRes, trendsRes] = await Promise.all([
        api.getFlakyTests(currentProject.id),
        api.getFlakyTestSummary(currentProject.id),
        api.getFlakyPatterns(currentProject.id),
        api.getFlakyTestTrends(currentProject.id, 14),
      ]);
      setFlakyTests(testsRes.data || []);
      setSummary(summaryRes.data || null);
      setPatterns(patternsRes.data || []);
      setTrends(trendsRes.data || []);
    } catch (err) {
      console.error('Failed to load flaky test data', err);
    } finally {
      setLoading(false);
    }
  };

  const handleQuarantine = async (test: FlakyTest) => {
    setSelectedTest(test);
    setShowQuarantineModal(true);
  };

  const confirmQuarantine = async () => {
    if (!selectedTest || !quarantineReason.trim()) return;
    try {
      await api.quarantineTest(selectedTest.id, quarantineReason);
      setShowQuarantineModal(false);
      setQuarantineReason('');
      loadData();
    } catch (err) {
      console.error('Failed to quarantine test', err);
    }
  };

  const handleUnquarantine = async (test: FlakyTest) => {
    try {
      await api.unquarantineTest(test.id);
      loadData();
    } catch (err) {
      console.error('Failed to unquarantine test', err);
    }
  };

  const handleMarkFixed = async (test: FlakyTest) => {
    try {
      await api.markTestAsFixed(test.id);
      loadData();
    } catch (err) {
      console.error('Failed to mark test as fixed', err);
    }
  };

  const filteredTests = flakyTests.filter(test => {
    if (filter === 'quarantined' && !test.isQuarantined) return false;
    if (filter === 'open' && test.fixStatus !== 'open') return false;
    if (filter === 'investigating' && test.fixStatus !== 'investigating') return false;
    if (filter === 'fixed' && test.fixStatus !== 'fixed') return false;
    if (patternFilter !== 'all' && test.patternType !== patternFilter) return false;
    return true;
  });

  if (!currentProject) {
    return (
      <Card>
        <p className="text-gray-500 text-center py-8">Please select a project from the dashboard</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Flaky Tests</h1>
          <p className="text-gray-500 mt-1">Monitor and manage test flakiness</p>
        </div>
        <Button onClick={loadData} variant="secondary" disabled={loading}>
          {loading ? 'Loading...' : 'Refresh'}
        </Button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          {(['overview', 'tests', 'patterns', 'trends'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-2 px-1 border-b-2 font-medium text-sm capitalize ${
                activeTab === tab
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && summary && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-5 gap-4">
            <SummaryCard
              label="Total Flaky"
              value={summary.totalFlaky}
              color="bg-red-50 text-red-700"
            />
            <SummaryCard
              label="Quarantined"
              value={summary.quarantined}
              color="bg-yellow-50 text-yellow-700"
            />
            <SummaryCard
              label="Investigating"
              value={summary.investigating}
              color="bg-blue-50 text-blue-700"
            />
            <SummaryCard
              label="Fixed"
              value={summary.fixed}
              color="bg-green-50 text-green-700"
            />
            <SummaryCard
              label="Avg Score"
              value={`${summary.avgScore}%`}
              color="bg-purple-50 text-purple-700"
            />
          </div>

          {/* Worst Offenders */}
          <Card>
            <h3 className="text-lg font-semibold mb-4">Worst Offenders</h3>
            {summary.worstOffenders.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No flaky tests found</p>
            ) : (
              <div className="space-y-3">
                {summary.worstOffenders.slice(0, 5).map(test => (
                  <div
                    key={test.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{test.testName}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {test.patternType && (
                          <PatternBadge pattern={test.patternType} />
                        )}
                        <FixStatusBadge status={test.fixStatus} />
                        {test.isQuarantined && (
                          <Badge variant="warning">Quarantined</Badge>
                        )}
                      </div>
                    </div>
                    <FlakinessScore score={test.flakinessScore} />
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Pattern Distribution */}
          {patterns.length > 0 && (
            <Card>
              <h3 className="text-lg font-semibold mb-4">Pattern Distribution</h3>
              <div className="grid grid-cols-4 gap-4">
                {patterns.map(pattern => (
                  <div
                    key={pattern.patternType}
                    className={`p-4 rounded-lg ${PATTERN_COLORS[pattern.patternType]?.bg || 'bg-gray-100'}`}
                  >
                    <p className="font-semibold">{PATTERN_COLORS[pattern.patternType]?.label || pattern.patternType}</p>
                    <p className="text-2xl font-bold">{pattern.affectedTestIds.length}</p>
                    <p className="text-sm opacity-75">tests affected</p>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Tests Tab */}
      {activeTab === 'tests' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex gap-4">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="all">All Tests</option>
              <option value="quarantined">Quarantined</option>
              <option value="open">Open</option>
              <option value="investigating">Investigating</option>
              <option value="fixed">Fixed</option>
            </select>
            <select
              value={patternFilter}
              onChange={(e) => setPatternFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="all">All Patterns</option>
              {Object.entries(PATTERN_COLORS).map(([key, val]) => (
                <option key={key} value={key}>{val.label}</option>
              ))}
            </select>
          </div>

          {/* Test List */}
          <Card>
            {loading ? (
              <p className="text-center py-8 text-gray-500">Loading...</p>
            ) : filteredTests.length === 0 ? (
              <p className="text-center py-8 text-gray-500">No flaky tests found</p>
            ) : (
              <div className="space-y-4">
                {filteredTests.map(test => (
                  <FlakyTestRow
                    key={test.id}
                    test={test}
                    onQuarantine={() => handleQuarantine(test)}
                    onUnquarantine={() => handleUnquarantine(test)}
                    onMarkFixed={() => handleMarkFixed(test)}
                  />
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Patterns Tab */}
      {activeTab === 'patterns' && (
        <div className="space-y-4">
          {patterns.length === 0 ? (
            <Card>
              <p className="text-gray-500 text-center py-8">No patterns detected yet</p>
            </Card>
          ) : (
            patterns.map(pattern => (
              <Card key={pattern.patternType}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <PatternBadge pattern={pattern.patternType} />
                      <SeverityBadge severity={pattern.severity} />
                    </div>
                    <p className="mt-2 text-gray-700">{pattern.description}</p>
                    {pattern.suggestedFix && (
                      <div className="mt-3 p-3 bg-green-50 rounded-lg">
                        <p className="text-sm font-medium text-green-800">Suggested Fix</p>
                        <p className="text-sm text-green-700">{pattern.suggestedFix}</p>
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-gray-900">{pattern.affectedTestIds.length}</p>
                    <p className="text-sm text-gray-500">tests affected</p>
                    <p className="text-xs text-gray-400">{pattern.confidence}% confidence</p>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Trends Tab */}
      {activeTab === 'trends' && (
        <div className="space-y-4">
          <Card>
            <h3 className="text-lg font-semibold mb-4">14-Day Trend</h3>
            {trends.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No trend data available</p>
            ) : (
              <div className="space-y-2">
                {/* Simple table view of trends */}
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead>
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">New</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Fixed</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Quarantined</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Avg Score</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {trends.map(trend => (
                        <tr key={trend.date}>
                          <td className="px-3 py-2 text-sm text-gray-900">{trend.date}</td>
                          <td className="px-3 py-2 text-sm text-right text-gray-900">{trend.totalFlaky}</td>
                          <td className="px-3 py-2 text-sm text-right text-red-600">+{trend.newFlaky}</td>
                          <td className="px-3 py-2 text-sm text-right text-green-600">{trend.fixed}</td>
                          <td className="px-3 py-2 text-sm text-right text-yellow-600">{trend.quarantined}</td>
                          <td className="px-3 py-2 text-sm text-right text-gray-900">{trend.avgScore}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Quarantine Modal */}
      {showQuarantineModal && selectedTest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Quarantine Test</h3>
            <p className="text-gray-600 mb-4">
              Quarantining "{selectedTest.testName}" will exclude it from test runs until fixed.
            </p>
            <Input
              label="Reason for quarantine"
              value={quarantineReason}
              onChange={(e) => setQuarantineReason(e.target.value)}
              placeholder="e.g., Consistently failing due to timing issues"
            />
            <div className="flex justify-end gap-3 mt-6">
              <Button variant="secondary" onClick={() => setShowQuarantineModal(false)}>
                Cancel
              </Button>
              <Button onClick={confirmQuarantine} disabled={!quarantineReason.trim()}>
                Quarantine
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Sub-components

function SummaryCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className={`p-4 rounded-lg ${color}`}>
      <p className="text-sm font-medium">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}

function FlakinessScore({ score }: { score: number }) {
  let color = 'text-green-600';
  if (score >= 80) color = 'text-red-600';
  else if (score >= 50) color = 'text-yellow-600';
  else if (score >= 25) color = 'text-orange-500';

  return (
    <div className="text-right">
      <p className={`text-2xl font-bold ${color}`}>{score}%</p>
      <p className="text-xs text-gray-500">flakiness</p>
    </div>
  );
}

function PatternBadge({ pattern }: { pattern: string }) {
  const config = PATTERN_COLORS[pattern] ?? PATTERN_COLORS.unknown!;
  return (
    <span className={`px-2 py-1 text-xs font-medium rounded ${config.bg} ${config.text}`}>
      {config.label}
    </span>
  );
}

function FixStatusBadge({ status }: { status: string }) {
  const config = FIX_STATUS_COLORS[status] ?? FIX_STATUS_COLORS.open!;
  return (
    <span className={`px-2 py-1 text-xs font-medium rounded ${config.bg} ${config.text}`}>
      {config.label}
    </span>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    critical: 'bg-red-600 text-white',
    high: 'bg-red-100 text-red-800',
    medium: 'bg-yellow-100 text-yellow-800',
    low: 'bg-green-100 text-green-800',
  };
  return (
    <span className={`px-2 py-1 text-xs font-medium rounded ${colors[severity] || colors.medium}`}>
      {severity.charAt(0).toUpperCase() + severity.slice(1)}
    </span>
  );
}

function FlakyTestRow({
  test,
  onQuarantine,
  onUnquarantine,
  onMarkFixed,
}: {
  test: FlakyTest;
  onQuarantine: () => void;
  onUnquarantine: () => void;
  onMarkFixed: () => void;
}) {
  return (
    <div className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-gray-900">{test.testName}</h3>
            {test.isQuarantined && (
              <Badge variant="warning">Quarantined</Badge>
            )}
          </div>
          <div className="flex items-center gap-4 mt-2">
            {test.patternType && <PatternBadge pattern={test.patternType} />}
            <FixStatusBadge status={test.fixStatus} />
            <span className="text-xs text-gray-500">
              {test.totalRuns} runs | {test.passRate.toFixed(1)}% pass rate
            </span>
          </div>
          {test.quarantineReason && (
            <p className="text-sm text-gray-500 mt-2 italic">
              Reason: {test.quarantineReason}
            </p>
          )}
        </div>
        <div className="flex items-center gap-4">
          <FlakinessScore score={test.flakinessScore} />
          <div className="flex flex-col gap-1">
            {test.isQuarantined ? (
              <Button size="sm" variant="secondary" onClick={onUnquarantine}>
                Unquarantine
              </Button>
            ) : (
              <Button size="sm" variant="secondary" onClick={onQuarantine}>
                Quarantine
              </Button>
            )}
            {test.fixStatus !== 'fixed' && (
              <Button size="sm" variant="primary" onClick={onMarkFixed}>
                Mark Fixed
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

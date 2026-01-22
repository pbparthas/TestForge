/**
 * Reports & Quality Gates Page
 * Sprint 17: Report generation, templates, scheduling, and quality gates
 */

import { useEffect, useState } from 'react';
import { useProjectStore } from '../stores/project';
import { api } from '../services/api';
import { Card, Badge, Button, Input } from '../components/ui';

// Types
interface Report {
  id: string;
  projectId: string;
  type: 'execution_summary' | 'coverage' | 'flaky_analysis' | 'trend' | 'ai_cost' | 'custom';
  format: 'pdf' | 'excel' | 'json';
  status: 'pending' | 'generating' | 'completed' | 'failed';
  title: string;
  description: string | null;
  filePath: string | null;
  fileSize: number | null;
  generatedAt: string | null;
  error: string | null;
  createdAt: string;
}

interface ReportTemplate {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  type: string;
  isDefault: boolean;
  createdAt: string;
}

interface ReportSchedule {
  id: string;
  projectId: string;
  name: string;
  cronExpression: string;
  format: string;
  isActive: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  template: ReportTemplate;
}

interface QualityGate {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  isActive: boolean;
  failOnBreach: boolean;
  conditions: QualityGateCondition[];
}

interface QualityGateCondition {
  id: string;
  metric: string;
  operator: string;
  threshold: number;
  severity: string;
  description: string | null;
}

interface QualityGateSummary {
  totalEvaluations: number;
  passedCount: number;
  failedCount: number;
  warningCount: number;
  passRate: number;
  recentTrend: 'improving' | 'declining' | 'stable';
  topFailingConditions: { metric: string; failCount: number }[];
}

// Report type colors
const REPORT_TYPE_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  execution_summary: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Execution' },
  coverage: { bg: 'bg-green-100', text: 'text-green-800', label: 'Coverage' },
  flaky_analysis: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Flaky' },
  trend: { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Trend' },
  ai_cost: { bg: 'bg-orange-100', text: 'text-orange-800', label: 'AI Cost' },
  custom: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Custom' },
};

// Status colors
const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending: { bg: 'bg-gray-100', text: 'text-gray-800' },
  generating: { bg: 'bg-blue-100', text: 'text-blue-800' },
  completed: { bg: 'bg-green-100', text: 'text-green-800' },
  failed: { bg: 'bg-red-100', text: 'text-red-800' },
};

// Metric labels
const METRIC_LABELS: Record<string, string> = {
  pass_rate: 'Pass Rate',
  coverage: 'Coverage',
  flakiness: 'Flakiness',
  duration: 'Duration',
  failed_count: 'Failed Tests',
  critical_failures: 'Critical Failures',
};

export function ReportsPage() {
  const { currentProject } = useProjectStore();
  const [reports, setReports] = useState<Report[]>([]);
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [schedules, setSchedules] = useState<ReportSchedule[]>([]);
  const [qualityGates, setQualityGates] = useState<QualityGate[]>([]);
  const [summary, setSummary] = useState<QualityGateSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'reports' | 'templates' | 'schedules' | 'quality-gates'>('reports');
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showQualityGateModal, setShowQualityGateModal] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Generate report form state
  const [reportType, setReportType] = useState<string>('execution_summary');
  const [reportFormat, setReportFormat] = useState<string>('pdf');
  const [reportTitle, setReportTitle] = useState('');
  const [trendDays, setTrendDays] = useState(30);

  // Quality gate form state
  const [gateName, setGateName] = useState('');
  const [gateDescription, setGateDescription] = useState('');
  const [gateConditions, setGateConditions] = useState<Array<{
    metric: string;
    operator: string;
    threshold: number;
    severity: string;
  }>>([{ metric: 'pass_rate', operator: 'gte', threshold: 90, severity: 'error' }]);

  useEffect(() => {
    if (currentProject) {
      loadData();
    }
  }, [currentProject]);

  const loadData = async () => {
    if (!currentProject) return;
    setLoading(true);
    try {
      const [reportsRes, templatesRes, schedulesRes, gatesRes, summaryRes] = await Promise.all([
        api.getReports({ projectId: currentProject.id, limit: 20 }),
        api.getReportTemplates(currentProject.id),
        api.getReportSchedules(currentProject.id),
        api.getProjectQualityGates(currentProject.id),
        api.getQualityGateSummary(currentProject.id, 30),
      ]);
      setReports(reportsRes.data?.data || []);
      setTemplates(templatesRes.data || []);
      setSchedules(schedulesRes.data || []);
      setQualityGates(gatesRes.data || []);
      setSummary(summaryRes.data || null);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReport = async () => {
    if (!currentProject) return;
    setGenerating(true);
    try {
      await api.generateReport({
        projectId: currentProject.id,
        type: reportType as Report['type'],
        format: reportFormat as Report['format'],
        title: reportTitle || `${REPORT_TYPE_COLORS[reportType]?.label || reportType} Report`,
        parameters: { trendDays },
      });
      setShowGenerateModal(false);
      setReportTitle('');
      loadData();
    } catch (error) {
      console.error('Failed to generate report:', error);
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadReport = async (report: Report) => {
    try {
      const response = await api.downloadReport(report.id);
      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${report.title}.${report.format === 'excel' ? 'xlsx' : report.format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Failed to download report:', error);
    }
  };

  const handleDeleteReport = async (id: string) => {
    if (!confirm('Are you sure you want to delete this report?')) return;
    try {
      await api.deleteReport(id);
      loadData();
    } catch (error) {
      console.error('Failed to delete report:', error);
    }
  };

  const handleCreateQualityGate = async () => {
    if (!currentProject || !gateName) return;
    try {
      await api.createQualityGate({
        projectId: currentProject.id,
        name: gateName,
        description: gateDescription || undefined,
        conditions: gateConditions.map(c => ({
          metric: c.metric as 'pass_rate' | 'coverage' | 'flakiness' | 'duration' | 'failed_count' | 'critical_failures',
          operator: c.operator as 'gte' | 'lte' | 'gt' | 'lt' | 'eq',
          threshold: c.threshold,
          severity: c.severity as 'error' | 'warning',
        })),
      });
      setShowQualityGateModal(false);
      setGateName('');
      setGateDescription('');
      setGateConditions([{ metric: 'pass_rate', operator: 'gte', threshold: 90, severity: 'error' }]);
      loadData();
    } catch (error) {
      console.error('Failed to create quality gate:', error);
    }
  };

  const handleSetDefaultGate = async (id: string) => {
    try {
      await api.setDefaultQualityGate(id);
      loadData();
    } catch (error) {
      console.error('Failed to set default:', error);
    }
  };

  const handleDeleteQualityGate = async (id: string) => {
    if (!confirm('Are you sure you want to delete this quality gate?')) return;
    try {
      await api.deleteQualityGate(id);
      loadData();
    } catch (error) {
      console.error('Failed to delete quality gate:', error);
    }
  };

  const addCondition = () => {
    setGateConditions([...gateConditions, { metric: 'pass_rate', operator: 'gte', threshold: 80, severity: 'error' }]);
  };

  const removeCondition = (index: number) => {
    setGateConditions(gateConditions.filter((_, i) => i !== index));
  };

  const updateCondition = (index: number, field: keyof typeof gateConditions[number], value: string | number) => {
    const updated = [...gateConditions];
    const condition = updated[index];
    if (!condition) return;
    if (field === 'threshold') {
      condition.threshold = typeof value === 'number' ? value : parseFloat(value) || 0;
    } else {
      (condition as Record<string, string | number>)[field] = value;
    }
    setGateConditions(updated);
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleString();
  };

  if (!currentProject) {
    return (
      <div className="p-8">
        <Card>
          <p className="text-gray-500">Please select a project to view reports.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports & Quality Gates</h1>
          <p className="text-gray-600 mt-1">Generate reports and manage quality thresholds</p>
        </div>
        <div className="flex gap-2">
          {activeTab === 'reports' && (
            <Button onClick={() => setShowGenerateModal(true)}>Generate Report</Button>
          )}
          {activeTab === 'quality-gates' && (
            <Button onClick={() => setShowQualityGateModal(true)}>Create Quality Gate</Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        {[
          { id: 'reports', label: 'Reports', count: reports.length },
          { id: 'templates', label: 'Templates', count: templates.length },
          { id: 'schedules', label: 'Schedules', count: schedules.length },
          { id: 'quality-gates', label: 'Quality Gates', count: qualityGates.length },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`px-4 py-2 font-medium text-sm border-b-2 -mb-px flex items-center gap-2 ${
              activeTab === tab.id
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
            <span className={`px-2 py-0.5 rounded-full text-xs ${
              activeTab === tab.id ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-500">Loading...</p>
        </div>
      ) : (
        <>
          {/* Reports Tab */}
          {activeTab === 'reports' && (
            <div className="space-y-4">
              {reports.length === 0 ? (
                <Card>
                  <p className="text-gray-500 text-center py-8">No reports yet. Generate your first report!</p>
                </Card>
              ) : (
                reports.map((report) => (
                  <Card key={report.id}>
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium text-gray-900">{report.title}</h3>
                          <Badge className={`${REPORT_TYPE_COLORS[report.type]?.bg} ${REPORT_TYPE_COLORS[report.type]?.text}`}>
                            {REPORT_TYPE_COLORS[report.type]?.label || report.type}
                          </Badge>
                          <Badge className={`${STATUS_COLORS[report.status]?.bg} ${STATUS_COLORS[report.status]?.text}`}>
                            {report.status}
                          </Badge>
                          <Badge variant="default" className="uppercase text-xs">{report.format}</Badge>
                        </div>
                        <div className="text-sm text-gray-500 flex gap-4">
                          <span>Created: {formatDate(report.createdAt)}</span>
                          {report.generatedAt && <span>Generated: {formatDate(report.generatedAt)}</span>}
                          {report.fileSize && <span>Size: {formatFileSize(report.fileSize)}</span>}
                        </div>
                        {report.error && (
                          <p className="text-sm text-red-600 mt-1">{report.error}</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {report.status === 'completed' && (
                          <Button variant="secondary" size="sm" onClick={() => handleDownloadReport(report)}>
                            Download
                          </Button>
                        )}
                        <Button variant="secondary" size="sm" onClick={() => handleDeleteReport(report.id)}>
                          Delete
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          )}

          {/* Templates Tab */}
          {activeTab === 'templates' && (
            <div className="space-y-4">
              {templates.length === 0 ? (
                <Card>
                  <p className="text-gray-500 text-center py-8">No templates created yet.</p>
                </Card>
              ) : (
                templates.map((template) => (
                  <Card key={template.id}>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium text-gray-900">{template.name}</h3>
                          <Badge className={`${REPORT_TYPE_COLORS[template.type]?.bg} ${REPORT_TYPE_COLORS[template.type]?.text}`}>
                            {REPORT_TYPE_COLORS[template.type]?.label || template.type}
                          </Badge>
                          {template.isDefault && <Badge variant="default">Default</Badge>}
                        </div>
                        {template.description && (
                          <p className="text-sm text-gray-500">{template.description}</p>
                        )}
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          )}

          {/* Schedules Tab */}
          {activeTab === 'schedules' && (
            <div className="space-y-4">
              {schedules.length === 0 ? (
                <Card>
                  <p className="text-gray-500 text-center py-8">No scheduled reports.</p>
                </Card>
              ) : (
                schedules.map((schedule) => (
                  <Card key={schedule.id}>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium text-gray-900">{schedule.name}</h3>
                          <Badge variant="default">{schedule.cronExpression}</Badge>
                          <Badge variant={schedule.isActive ? 'default' : 'info'}>
                            {schedule.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                        <div className="text-sm text-gray-500 flex gap-4">
                          <span>Template: {schedule.template?.name}</span>
                          <span>Format: {schedule.format.toUpperCase()}</span>
                          {schedule.lastRunAt && <span>Last run: {formatDate(schedule.lastRunAt)}</span>}
                          {schedule.nextRunAt && <span>Next run: {formatDate(schedule.nextRunAt)}</span>}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          )}

          {/* Quality Gates Tab */}
          {activeTab === 'quality-gates' && (
            <div className="space-y-6">
              {/* Summary Card */}
              {summary && (
                <Card>
                  <h3 className="font-medium text-gray-900 mb-4">Quality Gate Summary (Last 30 Days)</h3>
                  <div className="grid grid-cols-5 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-900">{summary.totalEvaluations}</div>
                      <div className="text-sm text-gray-500">Evaluations</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{summary.passedCount}</div>
                      <div className="text-sm text-gray-500">Passed</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">{summary.failedCount}</div>
                      <div className="text-sm text-gray-500">Failed</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-yellow-600">{summary.warningCount}</div>
                      <div className="text-sm text-gray-500">Warnings</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">{summary.passRate}%</div>
                      <div className="text-sm text-gray-500">Pass Rate</div>
                    </div>
                  </div>
                  {summary.topFailingConditions.length > 0 && (
                    <div className="mt-4 pt-4 border-t">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Top Failing Conditions</h4>
                      <div className="flex gap-2 flex-wrap">
                        {summary.topFailingConditions.map((c, i) => (
                          <Badge key={i} variant="info">
                            {METRIC_LABELS[c.metric] || c.metric}: {c.failCount} failures
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </Card>
              )}

              {/* Quality Gates List */}
              {qualityGates.length === 0 ? (
                <Card>
                  <p className="text-gray-500 text-center py-8">No quality gates configured. Create one to enforce quality thresholds.</p>
                </Card>
              ) : (
                qualityGates.map((gate) => (
                  <Card key={gate.id}>
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium text-gray-900">{gate.name}</h3>
                          {gate.isDefault && <Badge className="bg-blue-100 text-blue-800">Default</Badge>}
                          <Badge variant={gate.isActive ? 'default' : 'info'}>
                            {gate.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                          {gate.failOnBreach && (
                            <Badge variant="default" className="text-red-600 border-red-200">Fail on Breach</Badge>
                          )}
                        </div>
                        {gate.description && (
                          <p className="text-sm text-gray-500">{gate.description}</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {!gate.isDefault && (
                          <Button variant="secondary" size="sm" onClick={() => handleSetDefaultGate(gate.id)}>
                            Set Default
                          </Button>
                        )}
                        <Button variant="secondary" size="sm" onClick={() => handleDeleteQualityGate(gate.id)}>
                          Delete
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-gray-700">Conditions</h4>
                      {gate.conditions.map((condition, i) => (
                        <div key={condition.id || i} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                          <Badge variant="default" className={condition.severity === 'error' ? 'border-red-200 text-red-700' : 'border-yellow-200 text-yellow-700'}>
                            {condition.severity}
                          </Badge>
                          <span className="text-sm text-gray-700">
                            {METRIC_LABELS[condition.metric] || condition.metric}
                          </span>
                          <span className="text-sm text-gray-500">
                            {condition.operator === 'gte' ? '>=' :
                             condition.operator === 'lte' ? '<=' :
                             condition.operator === 'gt' ? '>' :
                             condition.operator === 'lt' ? '<' : '='}
                          </span>
                          <span className="font-medium text-gray-900">
                            {condition.threshold}
                            {['pass_rate', 'coverage', 'flakiness'].includes(condition.metric) ? '%' : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  </Card>
                ))
              )}
            </div>
          )}
        </>
      )}

      {/* Generate Report Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Generate Report</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Report Type</label>
                <select
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="execution_summary">Execution Summary</option>
                  <option value="coverage">Coverage Report</option>
                  <option value="flaky_analysis">Flaky Test Analysis</option>
                  <option value="trend">Trend Report</option>
                  <option value="ai_cost">AI Cost Report</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Format</label>
                <select
                  value={reportFormat}
                  onChange={(e) => setReportFormat(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="pdf">PDF</option>
                  <option value="excel">Excel</option>
                  <option value="json">JSON</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title (optional)</label>
                <Input
                  value={reportTitle}
                  onChange={(e) => setReportTitle(e.target.value)}
                  placeholder="Auto-generated if empty"
                />
              </div>
              {reportType === 'trend' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Trend Period (days)</label>
                  <Input
                    type="number"
                    value={trendDays}
                    onChange={(e) => setTrendDays(parseInt(e.target.value) || 30)}
                    min={1}
                    max={365}
                  />
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="secondary" onClick={() => setShowGenerateModal(false)}>Cancel</Button>
              <Button onClick={handleGenerateReport} disabled={generating}>
                {generating ? 'Generating...' : 'Generate'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Create Quality Gate Modal */}
      {showQualityGateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <Card className="w-full max-w-2xl m-4">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Create Quality Gate</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <Input
                  value={gateName}
                  onChange={(e) => setGateName(e.target.value)}
                  placeholder="e.g., Production Release Gate"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <Input
                  value={gateDescription}
                  onChange={(e) => setGateDescription(e.target.value)}
                  placeholder="Optional description"
                />
              </div>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-gray-700">Conditions</label>
                  <Button variant="secondary" size="sm" onClick={addCondition}>Add Condition</Button>
                </div>
                <div className="space-y-2">
                  {gateConditions.map((condition, index) => (
                    <div key={index} className="flex gap-2 items-center p-2 bg-gray-50 rounded">
                      <select
                        value={condition.metric}
                        onChange={(e) => updateCondition(index, 'metric', e.target.value)}
                        className="px-2 py-1 border border-gray-300 rounded text-sm"
                      >
                        <option value="pass_rate">Pass Rate</option>
                        <option value="coverage">Coverage</option>
                        <option value="flakiness">Flakiness</option>
                        <option value="duration">Duration (ms)</option>
                        <option value="failed_count">Failed Tests</option>
                        <option value="critical_failures">Critical Failures</option>
                      </select>
                      <select
                        value={condition.operator}
                        onChange={(e) => updateCondition(index, 'operator', e.target.value)}
                        className="px-2 py-1 border border-gray-300 rounded text-sm"
                      >
                        <option value="gte">&gt;=</option>
                        <option value="lte">&lt;=</option>
                        <option value="gt">&gt;</option>
                        <option value="lt">&lt;</option>
                        <option value="eq">=</option>
                      </select>
                      <input
                        type="number"
                        value={condition.threshold}
                        onChange={(e) => updateCondition(index, 'threshold', parseFloat(e.target.value) || 0)}
                        className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                      />
                      <select
                        value={condition.severity}
                        onChange={(e) => updateCondition(index, 'severity', e.target.value)}
                        className="px-2 py-1 border border-gray-300 rounded text-sm"
                      >
                        <option value="error">Error</option>
                        <option value="warning">Warning</option>
                      </select>
                      {gateConditions.length > 1 && (
                        <button
                          onClick={() => removeCondition(index)}
                          className="text-red-600 hover:text-red-800"
                        >
                          X
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="secondary" onClick={() => setShowQualityGateModal(false)}>Cancel</Button>
              <Button onClick={handleCreateQualityGate} disabled={!gateName}>
                Create
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

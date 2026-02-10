/**
 * Report Service Types
 * All interfaces and type exports for report generation, templates, and scheduling
 */

import type {
  ReportType,
  ReportFormat,
  ReportStatus,
} from '@prisma/client';

// ============================================================================
// INPUT TYPES
// ============================================================================

export interface GenerateReportInput {
  projectId: string;
  type: ReportType;
  format?: ReportFormat;
  title?: string;
  description?: string;
  executionId?: string;
  templateId?: string;
  parameters?: ReportParameters;
  createdById?: string;
}

export interface ReportParameters {
  dateRange?: { startDate: string; endDate: string };
  suiteIds?: string[];
  environmentIds?: string[];
  includeFlaky?: boolean;
  includeCoverage?: boolean;
  includeTrends?: boolean;
  trendDays?: number;
  groupBy?: 'day' | 'week' | 'month';
}

export interface CreateTemplateInput {
  projectId: string;
  name: string;
  description?: string;
  type: ReportType;
  config: TemplateConfig;
  isDefault?: boolean;
  createdById?: string;
}

export interface TemplateConfig {
  sections: ReportSection[];
  filters?: ReportFilters;
  styling?: ReportStyling;
}

export interface ReportSection {
  id: string;
  type: 'summary' | 'chart' | 'table' | 'text' | 'coverage_matrix' | 'flaky_list' | 'trend_graph';
  title: string;
  enabled: boolean;
  config?: Record<string, unknown>;
}

export interface ReportFilters {
  excludeSkipped?: boolean;
  minPassRate?: number;
  maxFlakiness?: number;
  testTypes?: string[];
  priorities?: string[];
}

export interface ReportStyling {
  logo?: string;
  primaryColor?: string;
  showPageNumbers?: boolean;
  showTimestamp?: boolean;
}

export interface CreateScheduleInput {
  projectId: string;
  templateId: string;
  name: string;
  cronExpression: string;
  timezone?: string;
  format?: ReportFormat;
  parameters?: ReportParameters;
  recipients?: string[];
  createdById?: string;
}

export interface FindReportsParams {
  page: number;
  limit: number;
  projectId?: string;
  type?: ReportType;
  status?: ReportStatus;
  startDate?: Date;
  endDate?: Date;
}

// ============================================================================
// REPORT DATA TYPES
// ============================================================================

export interface ReportData {
  metadata: ReportMetadata;
  summary?: ExecutionSummaryData;
  coverage?: CoverageData;
  flaky?: FlakyData;
  trends?: TrendData;
  aiCosts?: AiCostData;
}

export interface ReportMetadata {
  reportId: string;
  projectName: string;
  generatedAt: Date;
  parameters?: ReportParameters;
  executionId?: string;
}

export interface ExecutionSummaryData {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  error: number;
  passRate: number;
  duration: number;
  environment?: string;
  suite?: string;
  results: ResultItem[];
}

export interface ResultItem {
  testCaseId: string;
  testCaseName: string;
  status: string;
  duration: number;
  errorMessage?: string;
}

export interface CoverageData {
  totalRequirements: number;
  coveredRequirements: number;
  coveragePercent: number;
  byPriority: { priority: string; total: number; covered: number }[];
  gaps: { requirementId: string; title: string; priority: string }[];
}

export interface FlakyData {
  totalFlaky: number;
  quarantined: number;
  topFlaky: FlakyItem[];
  byPattern: { pattern: string; count: number }[];
}

export interface FlakyItem {
  testName: string;
  flakinessScore: number;
  pattern: string;
  lastFailure?: Date;
}

export interface TrendData {
  period: string;
  dataPoints: TrendPoint[];
  averagePassRate: number;
  trend: 'improving' | 'declining' | 'stable';
}

export interface TrendPoint {
  date: string;
  passRate: number;
  totalTests: number;
  executions: number;
}

export interface AiCostData {
  totalCostUsd: number;
  totalCostInr: number;
  byAgent: { agent: string; costUsd: number; calls: number }[];
  byDay: { date: string; costUsd: number }[];
}

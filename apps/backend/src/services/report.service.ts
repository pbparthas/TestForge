/**
 * Report Service
 * Generates, schedules, and exports reports in PDF/Excel/JSON formats
 */

import type {
  Report,
  ReportTemplate,
  ReportSchedule,
  ReportType,
  ReportFormat,
  ReportStatus,
  Prisma,
} from '@prisma/client';
import { prisma } from '../utils/prisma.js';
import { NotFoundError } from '../errors/index.js';
import { logger } from '../utils/logger.js';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';

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

// ============================================================================
// SERVICE CLASS
// ============================================================================

const REPORT_STORAGE_PATH = process.env.REPORT_STORAGE_PATH ?? './reports';

export class ReportService {
  // ============================================================================
  // REPORT CRUD
  // ============================================================================

  async generate(input: GenerateReportInput): Promise<Report> {
    const project = await prisma.project.findUnique({ where: { id: input.projectId } });
    if (!project) throw new NotFoundError('Project', input.projectId);

    // Create report record
    const report = await prisma.report.create({
      data: {
        projectId: input.projectId,
        executionId: input.executionId,
        templateId: input.templateId,
        type: input.type,
        format: input.format ?? 'pdf',
        status: 'pending',
        title: input.title ?? `${input.type.replace('_', ' ')} Report`,
        description: input.description,
        parameters: input.parameters as unknown as Prisma.InputJsonValue,
        createdById: input.createdById,
      },
    });

    // Generate report asynchronously
    this.generateAsync(report.id).catch(err => {
      logger.error({ reportId: report.id, error: err }, 'Report generation failed');
    });

    return report;
  }

  private async generateAsync(reportId: string): Promise<void> {
    try {
      // Mark as generating
      await prisma.report.update({
        where: { id: reportId },
        data: { status: 'generating' },
      });

      const report = await prisma.report.findUnique({
        where: { id: reportId },
        include: { project: true, execution: true },
      });
      if (!report) throw new NotFoundError('Report', reportId);

      // Generate report data
      const data = await this.generateReportData(report);

      // Export to file based on format
      let filePath: string;
      if (report.format === 'pdf') {
        filePath = await this.exportToPdf(report, data);
      } else if (report.format === 'excel') {
        filePath = await this.exportToExcel(report, data);
      } else {
        filePath = await this.exportToJson(report, data);
      }

      // Update report with results
      const stats = fs.statSync(filePath);
      await prisma.report.update({
        where: { id: reportId },
        data: {
          status: 'completed',
          filePath,
          fileSize: stats.size,
          data: data as unknown as Prisma.InputJsonValue,
          generatedAt: new Date(),
        },
      });

      logger.info({ reportId, filePath }, 'Report generated successfully');
    } catch (error) {
      await prisma.report.update({
        where: { id: reportId },
        data: {
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
      throw error;
    }
  }

  async findById(id: string): Promise<Report> {
    const report = await prisma.report.findUnique({
      where: { id },
      include: { project: true, execution: true, template: true },
    });
    if (!report) throw new NotFoundError('Report', id);
    return report;
  }

  async findAll(params: FindReportsParams) {
    const { page, limit, projectId, type, status, startDate, endDate } = params;
    const where: Prisma.ReportWhereInput = {};

    if (projectId) where.projectId = projectId;
    if (type) where.type = type;
    if (status) where.status = status;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      prisma.report.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { project: true },
      }),
      prisma.report.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async delete(id: string): Promise<void> {
    const report = await prisma.report.findUnique({ where: { id } });
    if (!report) throw new NotFoundError('Report', id);

    // Delete file if exists
    if (report.filePath && fs.existsSync(report.filePath)) {
      fs.unlinkSync(report.filePath);
    }

    await prisma.report.delete({ where: { id } });
    logger.info({ reportId: id }, 'Report deleted');
  }

  async download(id: string): Promise<{ filePath: string; fileName: string; mimeType: string }> {
    const report = await prisma.report.findUnique({ where: { id } });
    if (!report) throw new NotFoundError('Report', id);
    if (!report.filePath || !fs.existsSync(report.filePath)) {
      throw new Error('Report file not found');
    }

    const mimeTypes: Record<ReportFormat, string> = {
      pdf: 'application/pdf',
      excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      json: 'application/json',
    };

    const extensions: Record<ReportFormat, string> = {
      pdf: 'pdf',
      excel: 'xlsx',
      json: 'json',
    };

    return {
      filePath: report.filePath,
      fileName: `${report.title.replace(/[^a-zA-Z0-9]/g, '_')}.${extensions[report.format]}`,
      mimeType: mimeTypes[report.format],
    };
  }

  // ============================================================================
  // TEMPLATE CRUD
  // ============================================================================

  async createTemplate(input: CreateTemplateInput): Promise<ReportTemplate> {
    if (input.isDefault) {
      await prisma.reportTemplate.updateMany({
        where: { projectId: input.projectId, type: input.type, isDefault: true },
        data: { isDefault: false },
      });
    }

    return prisma.reportTemplate.create({
      data: {
        projectId: input.projectId,
        name: input.name,
        description: input.description,
        type: input.type,
        config: input.config as unknown as Prisma.InputJsonValue,
        isDefault: input.isDefault ?? false,
        createdById: input.createdById,
      },
    });
  }

  async updateTemplate(id: string, input: Partial<CreateTemplateInput>): Promise<ReportTemplate> {
    const template = await prisma.reportTemplate.findUnique({ where: { id } });
    if (!template) throw new NotFoundError('ReportTemplate', id);

    if (input.isDefault) {
      await prisma.reportTemplate.updateMany({
        where: { projectId: template.projectId, type: template.type, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    return prisma.reportTemplate.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description,
        config: input.config as unknown as Prisma.InputJsonValue,
        isDefault: input.isDefault,
      },
    });
  }

  async findTemplateById(id: string): Promise<ReportTemplate> {
    const template = await prisma.reportTemplate.findUnique({ where: { id } });
    if (!template) throw new NotFoundError('ReportTemplate', id);
    return template;
  }

  async findTemplates(projectId: string): Promise<ReportTemplate[]> {
    return prisma.reportTemplate.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteTemplate(id: string): Promise<void> {
    const template = await prisma.reportTemplate.findUnique({ where: { id } });
    if (!template) throw new NotFoundError('ReportTemplate', id);
    await prisma.reportTemplate.delete({ where: { id } });
  }

  // ============================================================================
  // SCHEDULING
  // ============================================================================

  async createSchedule(input: CreateScheduleInput): Promise<ReportSchedule> {
    const nextRunAt = this.calculateNextRun(input.cronExpression);

    return prisma.reportSchedule.create({
      data: {
        projectId: input.projectId,
        templateId: input.templateId,
        name: input.name,
        cronExpression: input.cronExpression,
        timezone: input.timezone ?? 'UTC',
        format: input.format ?? 'pdf',
        parameters: input.parameters as unknown as Prisma.InputJsonValue,
        recipients: input.recipients ?? [],
        createdById: input.createdById,
        nextRunAt,
      },
    });
  }

  async updateSchedule(id: string, input: Partial<CreateScheduleInput>): Promise<ReportSchedule> {
    const schedule = await prisma.reportSchedule.findUnique({ where: { id } });
    if (!schedule) throw new NotFoundError('ReportSchedule', id);

    const nextRunAt = input.cronExpression
      ? this.calculateNextRun(input.cronExpression)
      : undefined;

    return prisma.reportSchedule.update({
      where: { id },
      data: {
        name: input.name,
        cronExpression: input.cronExpression,
        timezone: input.timezone,
        format: input.format,
        parameters: input.parameters as unknown as Prisma.InputJsonValue,
        recipients: input.recipients,
        nextRunAt,
      },
    });
  }

  async findScheduleById(id: string): Promise<ReportSchedule> {
    const schedule = await prisma.reportSchedule.findUnique({
      where: { id },
      include: { template: true },
    });
    if (!schedule) throw new NotFoundError('ReportSchedule', id);
    return schedule;
  }

  async findSchedules(projectId: string): Promise<ReportSchedule[]> {
    return prisma.reportSchedule.findMany({
      where: { projectId },
      include: { template: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteSchedule(id: string): Promise<void> {
    const schedule = await prisma.reportSchedule.findUnique({ where: { id } });
    if (!schedule) throw new NotFoundError('ReportSchedule', id);
    await prisma.reportSchedule.delete({ where: { id } });
  }

  async runScheduledReports(): Promise<void> {
    const now = new Date();
    const dueSchedules = await prisma.reportSchedule.findMany({
      where: {
        isActive: true,
        nextRunAt: { lte: now },
      },
      include: { template: true },
    });

    for (const schedule of dueSchedules) {
      try {
        const report = await this.generate({
          projectId: schedule.projectId,
          type: schedule.template.type,
          format: schedule.format,
          templateId: schedule.templateId,
          parameters: schedule.parameters as ReportParameters,
        });

        // Update schedule
        await prisma.reportSchedule.update({
          where: { id: schedule.id },
          data: {
            lastRunAt: now,
            nextRunAt: this.calculateNextRun(schedule.cronExpression),
            reportId: report.id,
          },
        });

        logger.info({ scheduleId: schedule.id, reportId: report.id }, 'Scheduled report generated');
      } catch (error) {
        logger.error({ scheduleId: schedule.id, error }, 'Failed to run scheduled report');
      }
    }
  }

  // ============================================================================
  // DATA GENERATION (PRIVATE)
  // ============================================================================

  private async generateReportData(report: Report & { project: { name: string } }): Promise<ReportData> {
    const metadata: ReportMetadata = {
      reportId: report.id,
      projectName: report.project.name,
      generatedAt: new Date(),
      parameters: report.parameters as ReportParameters,
      executionId: report.executionId ?? undefined,
    };

    const data: ReportData = { metadata };
    const params = report.parameters as ReportParameters ?? {};

    switch (report.type) {
      case 'execution_summary':
        if (report.executionId) {
          data.summary = await this.generateExecutionSummary(report.executionId);
        }
        break;

      case 'coverage':
        data.coverage = await this.generateCoverageData(report.projectId);
        break;

      case 'flaky_analysis':
        data.flaky = await this.generateFlakyData(report.projectId);
        break;

      case 'trend':
        data.trends = await this.generateTrendData(report.projectId, params.trendDays ?? 30);
        break;

      case 'ai_cost':
        data.aiCosts = await this.generateAiCostData(report.projectId, params);
        break;

      case 'custom':
        // Custom reports include all data based on template config
        data.summary = report.executionId
          ? await this.generateExecutionSummary(report.executionId)
          : undefined;
        data.coverage = await this.generateCoverageData(report.projectId);
        data.flaky = await this.generateFlakyData(report.projectId);
        data.trends = await this.generateTrendData(report.projectId, params.trendDays ?? 30);
        break;
    }

    return data;
  }

  private async generateExecutionSummary(executionId: string): Promise<ExecutionSummaryData> {
    const execution = await prisma.execution.findUnique({
      where: { id: executionId },
      include: {
        results: { include: { testCase: true } },
        suite: true,
        environment: true,
      },
    });

    if (!execution) throw new NotFoundError('Execution', executionId);

    const results = execution.results;
    const passed = results.filter(r => r.status === 'passed').length;
    const failed = results.filter(r => r.status === 'failed').length;
    const skipped = results.filter(r => r.status === 'skipped').length;
    const error = results.filter(r => r.status === 'error').length;
    const total = results.length;
    const totalDuration = results.reduce((sum, r) => sum + (r.durationMs ?? 0), 0);

    return {
      total,
      passed,
      failed,
      skipped,
      error,
      passRate: total > 0 ? Math.round((passed / total) * 100) : 0,
      duration: totalDuration,
      environment: execution.environment?.name,
      suite: execution.suite?.name,
      results: results.map(r => ({
        testCaseId: r.testCaseId ?? '',
        testCaseName: r.testCase?.title ?? 'Unknown',
        status: r.status,
        duration: r.durationMs ?? 0,
        errorMessage: r.errorMessage ?? undefined,
      })),
    };
  }

  private async generateCoverageData(projectId: string): Promise<CoverageData> {
    const requirements = await prisma.requirement.findMany({
      where: { projectId, status: 'active' },
      include: { testCases: true },
    });

    const byPriority: Record<string, { total: number; covered: number }> = {
      critical: { total: 0, covered: 0 },
      high: { total: 0, covered: 0 },
      medium: { total: 0, covered: 0 },
      low: { total: 0, covered: 0 },
    };

    const gaps: CoverageData['gaps'] = [];

    for (const req of requirements) {
      const priority = req.priority;
      byPriority[priority].total++;
      if (req.testCases.length > 0) {
        byPriority[priority].covered++;
      } else {
        gaps.push({
          requirementId: req.id,
          title: req.title,
          priority: req.priority,
        });
      }
    }

    const totalRequirements = requirements.length;
    const coveredRequirements = requirements.filter(r => r.testCases.length > 0).length;

    return {
      totalRequirements,
      coveredRequirements,
      coveragePercent: totalRequirements > 0
        ? Math.round((coveredRequirements / totalRequirements) * 100)
        : 100,
      byPriority: Object.entries(byPriority).map(([priority, data]) => ({
        priority,
        ...data,
      })),
      gaps,
    };
  }

  private async generateFlakyData(projectId: string): Promise<FlakyData> {
    const flakyTests = await prisma.flakyTest.findMany({
      where: { projectId },
      orderBy: { flakinessScore: 'desc' },
    });

    const patterns = await prisma.flakyPattern.findMany({
      where: { projectId },
    });

    const byPattern: Record<string, number> = {};
    for (const pattern of patterns) {
      byPattern[pattern.patternType] = (byPattern[pattern.patternType] ?? 0) + 1;
    }

    return {
      totalFlaky: flakyTests.length,
      quarantined: flakyTests.filter(t => t.isQuarantined).length,
      topFlaky: flakyTests.slice(0, 10).map(t => ({
        testName: t.testName,
        flakinessScore: Number(t.flakinessScore),
        pattern: t.patternType ?? 'unknown',
        lastFailure: t.lastFailAt ?? undefined,
      })),
      byPattern: Object.entries(byPattern).map(([pattern, count]) => ({ pattern, count })),
    };
  }

  private async generateTrendData(projectId: string, days: number): Promise<TrendData> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const executions = await prisma.execution.findMany({
      where: {
        projectId,
        status: 'completed',
        createdAt: { gte: startDate },
      },
      include: { results: true },
      orderBy: { createdAt: 'asc' },
    });

    // Group by date
    const byDate: Record<string, { passRate: number[]; totalTests: number; executions: number }> = {};

    for (const exec of executions) {
      const date = exec.createdAt.toISOString().split('T')[0];
      if (!byDate[date]) {
        byDate[date] = { passRate: [], totalTests: 0, executions: 0 };
      }

      const results = exec.results;
      const passed = results.filter(r => r.status === 'passed').length;
      const total = results.length;

      byDate[date].passRate.push(total > 0 ? (passed / total) * 100 : 100);
      byDate[date].totalTests += total;
      byDate[date].executions++;
    }

    const dataPoints: TrendPoint[] = Object.entries(byDate).map(([date, data]) => ({
      date,
      passRate: Math.round(data.passRate.reduce((a, b) => a + b, 0) / data.passRate.length),
      totalTests: data.totalTests,
      executions: data.executions,
    }));

    const avgPassRate = dataPoints.length > 0
      ? Math.round(dataPoints.reduce((sum, p) => sum + p.passRate, 0) / dataPoints.length)
      : 100;

    // Calculate trend
    let trend: 'improving' | 'declining' | 'stable' = 'stable';
    if (dataPoints.length >= 2) {
      const mid = Math.floor(dataPoints.length / 2);
      const firstHalfAvg = dataPoints.slice(0, mid).reduce((s, p) => s + p.passRate, 0) / mid;
      const secondHalfAvg = dataPoints.slice(mid).reduce((s, p) => s + p.passRate, 0) / (dataPoints.length - mid);
      if (secondHalfAvg > firstHalfAvg + 5) trend = 'improving';
      else if (secondHalfAvg < firstHalfAvg - 5) trend = 'declining';
    }

    return {
      period: `${days} days`,
      dataPoints,
      averagePassRate: avgPassRate,
      trend,
    };
  }

  private async generateAiCostData(projectId: string, params: ReportParameters): Promise<AiCostData> {
    const startDate = params.dateRange?.startDate
      ? new Date(params.dateRange.startDate)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const usage = await prisma.aiUsage.findMany({
      where: {
        projectId,
        createdAt: { gte: startDate },
      },
    });

    const byAgent: Record<string, { costUsd: number; calls: number }> = {};
    const byDay: Record<string, number> = {};

    let totalCostUsd = 0;
    let totalCostInr = 0;

    for (const u of usage) {
      const costUsd = Number(u.costUsd);
      totalCostUsd += costUsd;
      totalCostInr += Number(u.costInr);

      if (!byAgent[u.agent]) {
        byAgent[u.agent] = { costUsd: 0, calls: 0 };
      }
      byAgent[u.agent].costUsd += costUsd;
      byAgent[u.agent].calls++;

      const date = u.createdAt.toISOString().split('T')[0];
      byDay[date] = (byDay[date] ?? 0) + costUsd;
    }

    return {
      totalCostUsd: Math.round(totalCostUsd * 100) / 100,
      totalCostInr: Math.round(totalCostInr * 100) / 100,
      byAgent: Object.entries(byAgent).map(([agent, data]) => ({
        agent,
        costUsd: Math.round(data.costUsd * 100) / 100,
        calls: data.calls,
      })),
      byDay: Object.entries(byDay).map(([date, costUsd]) => ({
        date,
        costUsd: Math.round(costUsd * 100) / 100,
      })),
    };
  }

  // ============================================================================
  // EXPORT METHODS (PRIVATE)
  // ============================================================================

  private async exportToPdf(report: Report, data: ReportData): Promise<string> {
    const dir = path.join(REPORT_STORAGE_PATH, report.projectId, this.getYearMonth());
    fs.mkdirSync(dir, { recursive: true });

    const filePath = path.join(dir, `${report.id}.pdf`);
    const doc = new PDFDocument({ margin: 50 });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // Header
    doc.fontSize(24).text(report.title, { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Generated: ${data.metadata.generatedAt.toISOString()}`, { align: 'center' });
    doc.fontSize(12).text(`Project: ${data.metadata.projectName}`, { align: 'center' });
    doc.moveDown(2);

    // Execution Summary
    if (data.summary) {
      doc.fontSize(16).text('Execution Summary', { underline: true });
      doc.moveDown();
      doc.fontSize(12);
      doc.text(`Total Tests: ${data.summary.total}`);
      doc.text(`Passed: ${data.summary.passed} (${data.summary.passRate}%)`);
      doc.text(`Failed: ${data.summary.failed}`);
      doc.text(`Skipped: ${data.summary.skipped}`);
      doc.text(`Duration: ${Math.round(data.summary.duration / 1000)}s`);
      if (data.summary.environment) doc.text(`Environment: ${data.summary.environment}`);
      if (data.summary.suite) doc.text(`Suite: ${data.summary.suite}`);
      doc.moveDown(2);
    }

    // Coverage
    if (data.coverage) {
      doc.fontSize(16).text('Test Coverage', { underline: true });
      doc.moveDown();
      doc.fontSize(12);
      doc.text(`Coverage: ${data.coverage.coveragePercent}%`);
      doc.text(`Requirements: ${data.coverage.coveredRequirements}/${data.coverage.totalRequirements}`);
      doc.moveDown();

      if (data.coverage.gaps.length > 0) {
        doc.text('Coverage Gaps:', { underline: true });
        for (const gap of data.coverage.gaps.slice(0, 10)) {
          doc.text(`  - [${gap.priority}] ${gap.title}`);
        }
        if (data.coverage.gaps.length > 10) {
          doc.text(`  ... and ${data.coverage.gaps.length - 10} more`);
        }
      }
      doc.moveDown(2);
    }

    // Flaky Tests
    if (data.flaky) {
      doc.fontSize(16).text('Flaky Test Analysis', { underline: true });
      doc.moveDown();
      doc.fontSize(12);
      doc.text(`Total Flaky: ${data.flaky.totalFlaky}`);
      doc.text(`Quarantined: ${data.flaky.quarantined}`);
      doc.moveDown();

      if (data.flaky.topFlaky.length > 0) {
        doc.text('Top Flaky Tests:', { underline: true });
        for (const flaky of data.flaky.topFlaky.slice(0, 5)) {
          doc.text(`  - ${flaky.testName} (Score: ${flaky.flakinessScore}%)`);
        }
      }
      doc.moveDown(2);
    }

    // Trends
    if (data.trends) {
      doc.fontSize(16).text('Trend Analysis', { underline: true });
      doc.moveDown();
      doc.fontSize(12);
      doc.text(`Period: ${data.trends.period}`);
      doc.text(`Average Pass Rate: ${data.trends.averagePassRate}%`);
      doc.text(`Trend: ${data.trends.trend}`);
      doc.moveDown(2);
    }

    // AI Costs
    if (data.aiCosts) {
      doc.fontSize(16).text('AI Usage & Costs', { underline: true });
      doc.moveDown();
      doc.fontSize(12);
      doc.text(`Total Cost: $${data.aiCosts.totalCostUsd} (₹${data.aiCosts.totalCostInr})`);
      doc.moveDown();
      doc.text('By Agent:');
      for (const agent of data.aiCosts.byAgent) {
        doc.text(`  - ${agent.agent}: $${agent.costUsd} (${agent.calls} calls)`);
      }
    }

    doc.end();

    return new Promise((resolve, reject) => {
      stream.on('finish', () => resolve(filePath));
      stream.on('error', reject);
    });
  }

  private async exportToExcel(report: Report, data: ReportData): Promise<string> {
    const dir = path.join(REPORT_STORAGE_PATH, report.projectId, this.getYearMonth());
    fs.mkdirSync(dir, { recursive: true });

    const filePath = path.join(dir, `${report.id}.xlsx`);
    const workbook = new ExcelJS.Workbook();

    // Summary Sheet
    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.columns = [
      { header: 'Metric', key: 'metric', width: 30 },
      { header: 'Value', key: 'value', width: 30 },
    ];
    summarySheet.addRow({ metric: 'Report Title', value: report.title });
    summarySheet.addRow({ metric: 'Project', value: data.metadata.projectName });
    summarySheet.addRow({ metric: 'Generated At', value: data.metadata.generatedAt.toISOString() });

    // Execution Results Sheet
    if (data.summary) {
      summarySheet.addRow({ metric: '', value: '' });
      summarySheet.addRow({ metric: 'Execution Summary', value: '' });
      summarySheet.addRow({ metric: 'Total Tests', value: data.summary.total });
      summarySheet.addRow({ metric: 'Passed', value: data.summary.passed });
      summarySheet.addRow({ metric: 'Failed', value: data.summary.failed });
      summarySheet.addRow({ metric: 'Skipped', value: data.summary.skipped });
      summarySheet.addRow({ metric: 'Pass Rate', value: `${data.summary.passRate}%` });

      const resultsSheet = workbook.addWorksheet('Test Results');
      resultsSheet.columns = [
        { header: 'Test Case', key: 'testCase', width: 40 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Duration (ms)', key: 'duration', width: 15 },
        { header: 'Error', key: 'error', width: 50 },
      ];
      for (const result of data.summary.results) {
        resultsSheet.addRow({
          testCase: result.testCaseName,
          status: result.status,
          duration: result.duration,
          error: result.errorMessage ?? '',
        });
      }
    }

    // Coverage Sheet
    if (data.coverage) {
      const coverageSheet = workbook.addWorksheet('Coverage');
      coverageSheet.columns = [
        { header: 'Priority', key: 'priority', width: 15 },
        { header: 'Total', key: 'total', width: 15 },
        { header: 'Covered', key: 'covered', width: 15 },
        { header: 'Coverage %', key: 'percent', width: 15 },
      ];
      for (const row of data.coverage.byPriority) {
        coverageSheet.addRow({
          priority: row.priority,
          total: row.total,
          covered: row.covered,
          percent: row.total > 0 ? Math.round((row.covered / row.total) * 100) : 100,
        });
      }

      if (data.coverage.gaps.length > 0) {
        const gapsSheet = workbook.addWorksheet('Coverage Gaps');
        gapsSheet.columns = [
          { header: 'Requirement', key: 'title', width: 50 },
          { header: 'Priority', key: 'priority', width: 15 },
          { header: 'ID', key: 'id', width: 40 },
        ];
        for (const gap of data.coverage.gaps) {
          gapsSheet.addRow({
            title: gap.title,
            priority: gap.priority,
            id: gap.requirementId,
          });
        }
      }
    }

    // Flaky Tests Sheet
    if (data.flaky && data.flaky.topFlaky.length > 0) {
      const flakySheet = workbook.addWorksheet('Flaky Tests');
      flakySheet.columns = [
        { header: 'Test Name', key: 'testName', width: 40 },
        { header: 'Flakiness Score', key: 'score', width: 20 },
        { header: 'Pattern', key: 'pattern', width: 20 },
        { header: 'Last Failure', key: 'lastFailure', width: 25 },
      ];
      for (const flaky of data.flaky.topFlaky) {
        flakySheet.addRow({
          testName: flaky.testName,
          score: flaky.flakinessScore,
          pattern: flaky.pattern,
          lastFailure: flaky.lastFailure?.toISOString() ?? '',
        });
      }
    }

    // Trends Sheet
    if (data.trends && data.trends.dataPoints.length > 0) {
      const trendsSheet = workbook.addWorksheet('Trends');
      trendsSheet.columns = [
        { header: 'Date', key: 'date', width: 15 },
        { header: 'Pass Rate', key: 'passRate', width: 15 },
        { header: 'Total Tests', key: 'totalTests', width: 15 },
        { header: 'Executions', key: 'executions', width: 15 },
      ];
      for (const point of data.trends.dataPoints) {
        trendsSheet.addRow(point);
      }
    }

    // AI Costs Sheet
    if (data.aiCosts) {
      const costsSheet = workbook.addWorksheet('AI Costs');
      costsSheet.columns = [
        { header: 'Agent', key: 'agent', width: 25 },
        { header: 'Cost (USD)', key: 'costUsd', width: 15 },
        { header: 'Calls', key: 'calls', width: 15 },
      ];
      for (const agent of data.aiCosts.byAgent) {
        costsSheet.addRow(agent);
      }
    }

    await workbook.xlsx.writeFile(filePath);
    return filePath;
  }

  private async exportToJson(report: Report, data: ReportData): Promise<string> {
    const dir = path.join(REPORT_STORAGE_PATH, report.projectId, this.getYearMonth());
    fs.mkdirSync(dir, { recursive: true });

    const filePath = path.join(dir, `${report.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return filePath;
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  private calculateNextRun(cronExpression: string): Date {
    // Simple cron parser - for production use node-cron or croner
    // This is a simplified implementation
    const now = new Date();
    const parts = cronExpression.split(' ');

    // Default to 1 hour from now if parsing fails
    if (parts.length !== 5) {
      return new Date(now.getTime() + 60 * 60 * 1000);
    }

    // Very basic: just add 1 day for daily schedules
    // For production, use a proper cron library
    return new Date(now.getTime() + 24 * 60 * 60 * 1000);
  }

  private getYearMonth(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
}

export const reportService = new ReportService();

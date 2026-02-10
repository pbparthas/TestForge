/**
 * Report Data Generators
 * Methods that generate report data (execution summary, coverage, flaky, trends, AI costs)
 */

import type { Report } from '@prisma/client';
import { prisma } from '../../utils/prisma.js';
import { NotFoundError } from '../../errors/index.js';
import type {
  ReportData,
  ReportMetadata,
  ReportParameters,
  ExecutionSummaryData,
  CoverageData,
  FlakyData,
  TrendData,
  TrendPoint,
  AiCostData,
} from './types.js';

export class ReportDataGenerator {
  async generateReportData(report: Report & { project: { name: string } }): Promise<ReportData> {
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

  async generateExecutionSummary(executionId: string): Promise<ExecutionSummaryData> {
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

  async generateCoverageData(projectId: string): Promise<CoverageData> {
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

  async generateFlakyData(projectId: string): Promise<FlakyData> {
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

  async generateTrendData(projectId: string, days: number): Promise<TrendData> {
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

  async generateAiCostData(projectId: string, params: ReportParameters): Promise<AiCostData> {
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
}

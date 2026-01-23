/**
 * Dashboard Service
 * Handles executive dashboard aggregation and metrics
 */

import type { DashboardMetric, DashboardSnapshot, MetricType, MetricPeriod, ResultStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../utils/prisma.js';
import { NotFoundError } from '../errors/index.js';

// =============================================================================
// TYPES
// =============================================================================

export interface RecordMetricInput {
  projectId?: string;
  name: string;
  type: MetricType;
  value: number;
  previousValue?: number;
  period: MetricPeriod;
  periodStart: Date;
  periodEnd: Date;
  metadata?: Record<string, unknown>;
}

export interface GetMetricsParams {
  projectId?: string;
  name?: string;
  type?: MetricType;
  period?: MetricPeriod;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}

export interface CreateSnapshotInput {
  projectId?: string;
  data: Record<string, unknown>;
  createdById?: string;
}

export interface ExecutionSummary {
  totalExecutions: number;
  recentExecutions: number;
  resultsByStatus: Record<string, number>;
  averageDuration?: number;
}

export interface AICostSummary {
  totalCostUsd: number;
  totalRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  averageCostPerRequest: number;
}

export interface DashboardData {
  passRate: number;
  testCoverage: number;
  flakinessScore: number;
  executionSummary: ExecutionSummary;
  aiCostSummary: AICostSummary;
  openBugs: number;
  generatedAt: Date;
}

export interface GlobalSummary {
  totalProjects: number;
  totalTestCases: number;
  totalExecutions: number;
  totalBugs: number;
  activeUsers?: number;
}

export interface TrendDataPoint {
  date: Date;
  value: number;
}

// =============================================================================
// SERVICE
// =============================================================================

export class DashboardService {
  // ===========================================================================
  // METRIC OPERATIONS
  // ===========================================================================

  /**
   * Record a dashboard metric
   */
  async recordMetric(input: RecordMetricInput): Promise<DashboardMetric> {
    let changePercent: number | undefined;

    if (input.previousValue !== undefined && input.previousValue !== 0) {
      changePercent = ((input.value - input.previousValue) / input.previousValue) * 100;
    }

    const metric = await prisma.dashboardMetric.create({
      data: {
        projectId: input.projectId,
        name: input.name,
        type: input.type,
        value: new Decimal(input.value),
        previousValue: input.previousValue !== undefined ? new Decimal(input.previousValue) : undefined,
        changePercent: changePercent !== undefined ? new Decimal(changePercent) : undefined,
        period: input.period,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        metadata: input.metadata ?? undefined,
      },
    });

    return metric;
  }

  /**
   * Get metrics with filters
   */
  async getMetrics(params: GetMetricsParams): Promise<DashboardMetric[]> {
    const where: Record<string, unknown> = {};

    if (params.projectId) where.projectId = params.projectId;
    if (params.name) where.name = params.name;
    if (params.type) where.type = params.type;
    if (params.period) where.period = params.period;
    if (params.startDate) where.periodStart = { gte: params.startDate };
    if (params.endDate) where.periodEnd = { lte: params.endDate };

    return prisma.dashboardMetric.findMany({
      where,
      orderBy: { periodEnd: 'desc' },
      take: params.limit,
    });
  }

  /**
   * Get latest metric by name
   */
  async getMetricByName(name: string, projectId?: string): Promise<DashboardMetric | null> {
    const metrics = await prisma.dashboardMetric.findMany({
      where: { name, projectId },
      orderBy: { periodEnd: 'desc' },
      take: 1,
    });

    return metrics[0] || null;
  }

  /**
   * Get trend data for a metric
   */
  async getTrendData(
    name: string,
    projectId?: string,
    days = 30
  ): Promise<TrendDataPoint[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const metrics = await prisma.dashboardMetric.findMany({
      where: {
        name,
        projectId,
        periodStart: { gte: startDate },
      },
      orderBy: { periodStart: 'asc' },
    });

    return metrics.map(m => ({
      date: m.periodStart,
      value: Number(m.value),
    }));
  }

  // ===========================================================================
  // SNAPSHOT OPERATIONS
  // ===========================================================================

  /**
   * Create a dashboard snapshot
   */
  async createSnapshot(input: CreateSnapshotInput): Promise<DashboardSnapshot> {
    const snapshot = await prisma.dashboardSnapshot.create({
      data: {
        projectId: input.projectId,
        snapshotAt: new Date(),
        data: input.data,
        createdById: input.createdById,
      },
    });

    return snapshot;
  }

  /**
   * Get snapshots for a project
   */
  async getSnapshots(projectId?: string, limit = 10): Promise<DashboardSnapshot[]> {
    return prisma.dashboardSnapshot.findMany({
      where: { projectId },
      orderBy: { snapshotAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Get latest snapshot
   */
  async getLatestSnapshot(projectId?: string): Promise<DashboardSnapshot | null> {
    const snapshots = await prisma.dashboardSnapshot.findMany({
      where: { projectId },
      orderBy: { snapshotAt: 'desc' },
      take: 1,
    });

    return snapshots[0] || null;
  }

  /**
   * Get snapshot by ID
   */
  async getSnapshotById(id: string): Promise<DashboardSnapshot> {
    const snapshot = await prisma.dashboardSnapshot.findUnique({
      where: { id },
    });

    if (!snapshot) {
      throw new NotFoundError('DashboardSnapshot', id);
    }

    return snapshot;
  }

  // ===========================================================================
  // CALCULATED METRICS
  // ===========================================================================

  /**
   * Calculate pass rate for a project
   */
  async calculatePassRate(projectId?: string, days = 30): Promise<number> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const where: Record<string, unknown> = {
      createdAt: { gte: startDate },
    };

    if (projectId) {
      where.execution = { projectId };
    }

    const [total, passed] = await Promise.all([
      prisma.executionResult.count({ where }),
      prisma.executionResult.count({
        where: { ...where, status: 'passed' },
      }),
    ]);

    if (total === 0) return 0;
    return Math.round((passed / total) * 100);
  }

  /**
   * Calculate test coverage (test cases with requirements)
   */
  async calculateTestCoverage(projectId?: string): Promise<number> {
    const where: Record<string, unknown> = {};
    if (projectId) where.projectId = projectId;

    const [total, withRequirement] = await Promise.all([
      prisma.testCase.count({ where }),
      prisma.testCase.count({
        where: { ...where, requirementId: { not: null } },
      }),
    ]);

    if (total === 0) return 0;
    return Math.round((withRequirement / total) * 100);
  }

  /**
   * Calculate flakiness score
   */
  async calculateFlakinessScore(projectId?: string): Promise<number> {
    const where: Record<string, unknown> = {};
    if (projectId) where.projectId = projectId;

    const [flakyCount, totalTests] = await Promise.all([
      prisma.flakyTest.count({ where }),
      prisma.testCase.count({ where }),
    ]);

    if (totalTests === 0) return 0;
    return Math.round((flakyCount / totalTests) * 100);
  }

  /**
   * Get execution summary
   */
  async getExecutionSummary(projectId?: string, days = 30): Promise<ExecutionSummary> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const where: Record<string, unknown> = {};
    if (projectId) where.projectId = projectId;

    const recentWhere = { ...where, createdAt: { gte: startDate } };

    const [totalExecutions, recentExecutions, resultsByStatus] = await Promise.all([
      prisma.execution.count({ where }),
      prisma.execution.count({ where: recentWhere }),
      prisma.executionResult.groupBy({
        by: ['status'],
        where: { execution: recentWhere },
        _count: { status: true },
      }),
    ]);

    const statusMap: Record<string, number> = {};
    for (const item of resultsByStatus) {
      statusMap[item.status] = item._count.status;
    }

    return {
      totalExecutions,
      recentExecutions,
      resultsByStatus: statusMap,
    };
  }

  /**
   * Get AI cost summary
   */
  async getAICostSummary(projectId?: string, days = 30): Promise<AICostSummary> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const where: Record<string, unknown> = {
      createdAt: { gte: startDate },
    };
    if (projectId) where.projectId = projectId;

    const result = await prisma.aiUsage.aggregate({
      where,
      _sum: {
        costUsd: true,
        inputTokens: true,
        outputTokens: true,
      },
      _count: { id: true },
    });

    const totalCostUsd = Number(result._sum.costUsd || 0);
    const totalRequests = result._count.id || 0;

    return {
      totalCostUsd,
      totalRequests,
      totalInputTokens: result._sum.inputTokens || 0,
      totalOutputTokens: result._sum.outputTokens || 0,
      averageCostPerRequest: totalRequests > 0 ? totalCostUsd / totalRequests : 0,
    };
  }

  /**
   * Get open bugs count
   */
  async getOpenBugsCount(projectId?: string): Promise<number> {
    const where: Record<string, unknown> = {
      status: { in: ['open', 'in_progress'] },
    };
    if (projectId) where.projectId = projectId;

    return prisma.bug.count({ where });
  }

  // ===========================================================================
  // DASHBOARD GENERATION
  // ===========================================================================

  /**
   * Generate complete dashboard data
   */
  async generateDashboardData(projectId?: string, days = 30): Promise<DashboardData> {
    const [
      passRate,
      testCoverage,
      flakinessScore,
      executionSummary,
      aiCostSummary,
      openBugs,
    ] = await Promise.all([
      this.calculatePassRate(projectId, days),
      this.calculateTestCoverage(projectId),
      this.calculateFlakinessScore(projectId),
      this.getExecutionSummary(projectId, days),
      this.getAICostSummary(projectId, days),
      this.getOpenBugsCount(projectId),
    ]);

    return {
      passRate,
      testCoverage,
      flakinessScore,
      executionSummary,
      aiCostSummary,
      openBugs,
      generatedAt: new Date(),
    };
  }

  /**
   * Generate and save dashboard snapshot
   */
  async generateAndSaveSnapshot(
    projectId?: string,
    createdById?: string
  ): Promise<DashboardSnapshot> {
    const data = await this.generateDashboardData(projectId);

    return this.createSnapshot({
      projectId,
      data,
      createdById,
    });
  }

  /**
   * Get global summary across all projects
   */
  async getGlobalSummary(): Promise<GlobalSummary> {
    const [totalProjects, totalTestCases, totalExecutions, totalBugs] = await Promise.all([
      prisma.project.count(),
      prisma.testCase.count(),
      prisma.execution.count(),
      prisma.bug.count(),
    ]);

    return {
      totalProjects,
      totalTestCases,
      totalExecutions,
      totalBugs,
    };
  }

  // ===========================================================================
  // MAINTENANCE
  // ===========================================================================

  /**
   * Cleanup old metrics
   */
  async cleanupOldMetrics(retentionDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await prisma.dashboardMetric.deleteMany({
      where: {
        periodEnd: { lt: cutoffDate },
      },
    });

    return result.count;
  }

  /**
   * Cleanup old snapshots
   */
  async cleanupOldSnapshots(retentionDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await prisma.dashboardSnapshot.deleteMany({
      where: {
        snapshotAt: { lt: cutoffDate },
      },
    });

    return result.count;
  }

  /**
   * Record daily metrics for a project
   */
  async recordDailyMetrics(projectId: string): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [passRate, testCoverage, flakinessScore] = await Promise.all([
      this.calculatePassRate(projectId, 1),
      this.calculateTestCoverage(projectId),
      this.calculateFlakinessScore(projectId),
    ]);

    // Get previous values
    const [prevPassRate, prevCoverage, prevFlakiness] = await Promise.all([
      this.getMetricByName('pass_rate', projectId),
      this.getMetricByName('test_coverage', projectId),
      this.getMetricByName('flakiness_score', projectId),
    ]);

    await Promise.all([
      this.recordMetric({
        projectId,
        name: 'pass_rate',
        type: 'percentage',
        value: passRate,
        previousValue: prevPassRate ? Number(prevPassRate.value) : undefined,
        period: 'daily',
        periodStart: today,
        periodEnd: tomorrow,
      }),
      this.recordMetric({
        projectId,
        name: 'test_coverage',
        type: 'percentage',
        value: testCoverage,
        previousValue: prevCoverage ? Number(prevCoverage.value) : undefined,
        period: 'daily',
        periodStart: today,
        periodEnd: tomorrow,
      }),
      this.recordMetric({
        projectId,
        name: 'flakiness_score',
        type: 'percentage',
        value: flakinessScore,
        previousValue: prevFlakiness ? Number(prevFlakiness.value) : undefined,
        period: 'daily',
        periodStart: today,
        periodEnd: tomorrow,
      }),
    ]);
  }
}

// Export singleton instance
export const dashboardService = new DashboardService();

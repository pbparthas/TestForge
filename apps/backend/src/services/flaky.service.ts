/**
 * Flaky Test Service
 * Sprint 14: Detection, scoring, quarantine, and trending for flaky tests
 *
 * Calculates flakiness scores from execution history and provides
 * tools for managing flaky tests (quarantine, fix tracking, patterns).
 */

import type {
  FlakyTest,
  FlakyPattern,
  FlakyPatternType,
  FlakyFixStatus,
  FlakyPatternSeverity,
  Prisma,
} from '@prisma/client';
import { prisma } from '../utils/prisma.js';
import { NotFoundError, ValidationError } from '../errors/index.js';

// =============================================================================
// TYPES
// =============================================================================

export interface FlakyTestMetrics {
  id: string;
  testId: string;
  testName: string;
  scriptId: string | null;
  flakinessScore: number; // 0-100 (100 = always flaky)
  totalRuns: number;
  passCount: number;
  failCount: number;
  passRate: number;
  recentResults: Array<{ executionId: string; passed: boolean; timestamp: Date }>;
  isQuarantined: boolean;
  quarantinedAt: Date | null;
  quarantineReason: string | null;
  patternType: FlakyPatternType | null;
  fixStatus: FlakyFixStatus;
}

export interface FlakyCauseAnalysis {
  testId: string;
  rootCauses: Array<{
    cause: string;
    confidence: number;
    evidence: string[];
    suggestedFix: string;
  }>;
  patterns: FlakyPattern[];
  aiAnalysis: string | null;
}

export interface FlakyTrend {
  date: string;
  totalFlaky: number;
  newFlaky: number;
  fixed: number;
  quarantined: number;
  avgScore: number;
}

export interface UpdateFromExecutionResult {
  updated: number;
  newFlaky: number;
  autoQuarantined: number;
}

export interface FlakyTestFilters {
  projectId: string;
  threshold?: number;
  isQuarantined?: boolean;
  fixStatus?: FlakyFixStatus;
  patternType?: FlakyPatternType;
}

// =============================================================================
// CONSTANTS
// =============================================================================

// Flakiness score threshold for auto-quarantine
const AUTO_QUARANTINE_THRESHOLD = 80;

// Minimum runs required before calculating flakiness
const MIN_RUNS_FOR_CALCULATION = 3;

// Recent results window (number of executions to consider)
const RECENT_RESULTS_WINDOW = 20;

// =============================================================================
// SERVICE
// =============================================================================

export class FlakyTestService {
  /**
   * Update flaky test metrics from a completed execution
   * Called after each execution completes
   */
  async updateMetricsFromExecution(
    executionId: string,
    autoQuarantineThreshold = AUTO_QUARANTINE_THRESHOLD
  ): Promise<UpdateFromExecutionResult> {
    const execution = await prisma.execution.findUnique({
      where: { id: executionId },
      include: {
        results: {
          include: {
            testCase: true,
            script: true,
          },
        },
      },
    });

    if (!execution) {
      throw new NotFoundError('Execution', executionId);
    }

    let updated = 0;
    let newFlaky = 0;
    let autoQuarantined = 0;

    for (const result of execution.results) {
      if (!result.testCaseId) continue;

      const testName = result.testCase?.title || result.script?.name || 'Unknown';
      const passed = result.status === 'passed';

      // Find or create flaky test record
      let flakyTest = await prisma.flakyTest.findFirst({
        where: {
          projectId: execution.projectId,
          testCaseId: result.testCaseId,
          scriptId: result.scriptId,
        },
      });

      if (!flakyTest) {
        // Create new record
        flakyTest = await prisma.flakyTest.create({
          data: {
            projectId: execution.projectId,
            testCaseId: result.testCaseId,
            scriptId: result.scriptId,
            testName,
            totalRuns: 1,
            passCount: passed ? 1 : 0,
            failCount: passed ? 0 : 1,
            lastPassAt: passed ? new Date() : null,
            lastFailAt: passed ? null : new Date(),
            flakinessScore: 0,
          },
        });
        newFlaky++;
      } else {
        // Update existing record
        const newTotalRuns = flakyTest.totalRuns + 1;
        const newPassCount = flakyTest.passCount + (passed ? 1 : 0);
        const newFailCount = flakyTest.failCount + (passed ? 0 : 1);

        // Calculate flakiness score
        const flakinessScore = this.calculateFlakinessScore(
          newTotalRuns,
          newPassCount,
          newFailCount
        );

        // Update the record
        flakyTest = await prisma.flakyTest.update({
          where: { id: flakyTest.id },
          data: {
            totalRuns: newTotalRuns,
            passCount: newPassCount,
            failCount: newFailCount,
            flakinessScore,
            lastPassAt: passed ? new Date() : flakyTest.lastPassAt,
            lastFailAt: passed ? flakyTest.lastFailAt : new Date(),
          },
        });

        updated++;

        // Auto-quarantine if above threshold
        if (
          flakinessScore >= autoQuarantineThreshold &&
          !flakyTest.isQuarantined &&
          newTotalRuns >= MIN_RUNS_FOR_CALCULATION
        ) {
          await this.quarantineTest(
            flakyTest.id,
            null, // System auto-quarantine
            `Auto-quarantined: flakiness score ${flakinessScore}% exceeds threshold ${autoQuarantineThreshold}%`
          );
          autoQuarantined++;
        }
      }
    }

    return { updated, newFlaky, autoQuarantined };
  }

  /**
   * Calculate flakiness score
   * Score is based on the variance between passes and fails
   * A test that always passes or always fails has score 0
   * A test that passes 50% of the time has max score 100
   */
  calculateFlakinessScore(
    totalRuns: number,
    passCount: number,
    failCount: number
  ): number {
    if (totalRuns < MIN_RUNS_FOR_CALCULATION) {
      return 0;
    }

    const passRate = passCount / totalRuns;
    // Score is highest when passRate is 0.5 (50/50)
    // Uses a quadratic formula: 4 * passRate * (1 - passRate) * 100
    // This gives 0 when passRate is 0 or 1, and 100 when passRate is 0.5
    const score = 4 * passRate * (1 - passRate) * 100;
    return Math.round(score * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Get flaky tests for a project
   */
  async getFlakyTests(filters: FlakyTestFilters): Promise<FlakyTestMetrics[]> {
    const where: Prisma.FlakyTestWhereInput = {
      projectId: filters.projectId,
    };

    if (filters.threshold !== undefined) {
      where.flakinessScore = { gte: filters.threshold };
    }
    if (filters.isQuarantined !== undefined) {
      where.isQuarantined = filters.isQuarantined;
    }
    if (filters.fixStatus) {
      where.fixStatus = filters.fixStatus;
    }
    if (filters.patternType) {
      where.patternType = filters.patternType;
    }

    const flakyTests = await prisma.flakyTest.findMany({
      where,
      orderBy: { flakinessScore: 'desc' },
    });

    // Get recent execution results for each test
    const metrics: FlakyTestMetrics[] = [];
    for (const ft of flakyTests) {
      const recentResults = await this.getRecentResults(
        ft.testCaseId,
        ft.scriptId,
        RECENT_RESULTS_WINDOW
      );

      metrics.push({
        id: ft.id,
        testId: ft.testCaseId || ft.id,
        testName: ft.testName,
        scriptId: ft.scriptId,
        flakinessScore: Number(ft.flakinessScore),
        totalRuns: ft.totalRuns,
        passCount: ft.passCount,
        failCount: ft.failCount,
        passRate: ft.totalRuns > 0 ? (ft.passCount / ft.totalRuns) * 100 : 0,
        recentResults,
        isQuarantined: ft.isQuarantined,
        quarantinedAt: ft.quarantinedAt,
        quarantineReason: ft.quarantineReason,
        patternType: ft.patternType,
        fixStatus: ft.fixStatus,
      });
    }

    return metrics;
  }

  /**
   * Get a single flaky test by ID
   */
  async getFlakyTestById(id: string): Promise<FlakyTest> {
    const flakyTest = await prisma.flakyTest.findUnique({
      where: { id },
    });
    if (!flakyTest) {
      throw new NotFoundError('FlakyTest', id);
    }
    return flakyTest;
  }

  /**
   * Quarantine a flaky test
   */
  async quarantineTest(
    flakyTestId: string,
    userId: string | null,
    reason: string
  ): Promise<FlakyTest> {
    const flakyTest = await this.getFlakyTestById(flakyTestId);

    if (flakyTest.isQuarantined) {
      throw new ValidationError('Test is already quarantined');
    }

    return prisma.flakyTest.update({
      where: { id: flakyTestId },
      data: {
        isQuarantined: true,
        quarantinedAt: new Date(),
        quarantinedById: userId,
        quarantineReason: reason,
      },
    });
  }

  /**
   * Unquarantine a flaky test
   */
  async unquarantineTest(flakyTestId: string, _userId: string): Promise<FlakyTest> {
    const flakyTest = await this.getFlakyTestById(flakyTestId);

    if (!flakyTest.isQuarantined) {
      throw new ValidationError('Test is not quarantined');
    }

    return prisma.flakyTest.update({
      where: { id: flakyTestId },
      data: {
        isQuarantined: false,
        quarantinedAt: null,
        quarantinedById: null,
        quarantineReason: null,
      },
    });
  }

  /**
   * Mark a flaky test as fixed
   */
  async markAsFixed(flakyTestId: string, userId: string): Promise<FlakyTest> {
    const flakyTest = await this.getFlakyTestById(flakyTestId);

    if (flakyTest.fixStatus === 'fixed') {
      throw new ValidationError('Test is already marked as fixed');
    }

    return prisma.flakyTest.update({
      where: { id: flakyTestId },
      data: {
        fixStatus: 'fixed',
        fixedAt: new Date(),
        fixedById: userId,
        // Also unquarantine if it was quarantined
        isQuarantined: false,
        quarantinedAt: null,
        quarantinedById: null,
        quarantineReason: null,
      },
    });
  }

  /**
   * Update fix status
   */
  async updateFixStatus(
    flakyTestId: string,
    status: FlakyFixStatus,
    userId?: string
  ): Promise<FlakyTest> {
    await this.getFlakyTestById(flakyTestId);

    const data: Prisma.FlakyTestUpdateInput = { fixStatus: status };
    if (status === 'fixed' && userId) {
      data.fixedAt = new Date();
      data.fixedById = userId;
    }

    return prisma.flakyTest.update({
      where: { id: flakyTestId },
      data,
    });
  }

  /**
   * Update pattern type for a flaky test
   */
  async updatePatternType(
    flakyTestId: string,
    patternType: FlakyPatternType
  ): Promise<FlakyTest> {
    await this.getFlakyTestById(flakyTestId);

    return prisma.flakyTest.update({
      where: { id: flakyTestId },
      data: { patternType },
    });
  }

  /**
   * Store root cause analysis results
   */
  async storeRootCauseAnalysis(
    flakyTestId: string,
    analysis: FlakyCauseAnalysis
  ): Promise<FlakyTest> {
    await this.getFlakyTestById(flakyTestId);

    return prisma.flakyTest.update({
      where: { id: flakyTestId },
      data: {
        rootCauseAnalysis: analysis as unknown as Prisma.InputJsonValue,
        patternType: analysis.patterns[0]?.patternType || null,
      },
    });
  }

  /**
   * Get flaky test trends over time
   */
  async getTrends(projectId: string, days = 30): Promise<FlakyTrend[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get daily snapshots
    const trends: FlakyTrend[] = [];
    const currentDate = new Date(startDate);

    while (currentDate <= new Date()) {
      const dayStart = new Date(currentDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(currentDate);
      dayEnd.setHours(23, 59, 59, 999);

      // Count tests with score > 0 as of this day
      const flakyTests = await prisma.flakyTest.findMany({
        where: {
          projectId,
          createdAt: { lte: dayEnd },
          flakinessScore: { gt: 0 },
        },
      });

      const quarantinedCount = flakyTests.filter(t => t.isQuarantined).length;
      const fixedCount = flakyTests.filter(
        t => t.fixStatus === 'fixed' && t.fixedAt && t.fixedAt <= dayEnd
      ).length;
      const avgScore =
        flakyTests.length > 0
          ? flakyTests.reduce((sum, t) => sum + Number(t.flakinessScore), 0) /
            flakyTests.length
          : 0;

      // New flaky tests on this day
      const newFlaky = await prisma.flakyTest.count({
        where: {
          projectId,
          createdAt: { gte: dayStart, lte: dayEnd },
          flakinessScore: { gt: 0 },
        },
      });

      trends.push({
        date: dayStart.toISOString().split('T')[0] as string,
        totalFlaky: flakyTests.length,
        newFlaky,
        fixed: fixedCount,
        quarantined: quarantinedCount,
        avgScore: Math.round(avgScore * 100) / 100,
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return trends;
  }

  /**
   * Get quarantined tests
   */
  async getQuarantinedTests(projectId: string): Promise<FlakyTestMetrics[]> {
    return this.getFlakyTests({ projectId, isQuarantined: true });
  }

  /**
   * Get project flaky test summary
   */
  async getProjectSummary(projectId: string): Promise<{
    totalFlaky: number;
    quarantined: number;
    investigating: number;
    fixed: number;
    avgScore: number;
    worstOffenders: FlakyTestMetrics[];
  }> {
    const allFlaky = await prisma.flakyTest.findMany({
      where: { projectId, flakinessScore: { gt: 0 } },
    });

    const quarantined = allFlaky.filter(t => t.isQuarantined).length;
    const investigating = allFlaky.filter(t => t.fixStatus === 'investigating').length;
    const fixed = allFlaky.filter(t => t.fixStatus === 'fixed').length;
    const avgScore =
      allFlaky.length > 0
        ? allFlaky.reduce((sum, t) => sum + Number(t.flakinessScore), 0) / allFlaky.length
        : 0;

    // Get top 5 worst offenders
    const worstOffenders = await this.getFlakyTests({
      projectId,
      threshold: 0,
    });

    return {
      totalFlaky: allFlaky.length,
      quarantined,
      investigating,
      fixed,
      avgScore: Math.round(avgScore * 100) / 100,
      worstOffenders: worstOffenders.slice(0, 5),
    };
  }

  /**
   * Create a flaky pattern
   */
  async createPattern(
    projectId: string,
    patternType: FlakyPatternType,
    description: string,
    severity: FlakyPatternSeverity,
    affectedTestIds: string[],
    confidence: number,
    suggestedFix?: string
  ): Promise<FlakyPattern> {
    return prisma.flakyPattern.create({
      data: {
        projectId,
        patternType,
        description,
        severity,
        affectedTestIds,
        confidence,
        suggestedFix,
      },
    });
  }

  /**
   * Get patterns for a project
   */
  async getPatterns(projectId: string): Promise<FlakyPattern[]> {
    return prisma.flakyPattern.findMany({
      where: { projectId },
      orderBy: { detectedAt: 'desc' },
    });
  }

  /**
   * Reset flaky test metrics (for testing or after major changes)
   */
  async resetMetrics(flakyTestId: string): Promise<FlakyTest> {
    await this.getFlakyTestById(flakyTestId);

    return prisma.flakyTest.update({
      where: { id: flakyTestId },
      data: {
        totalRuns: 0,
        passCount: 0,
        failCount: 0,
        flakinessScore: 0,
        lastPassAt: null,
        lastFailAt: null,
      },
    });
  }

  // =============================================================================
  // PRIVATE HELPERS
  // =============================================================================

  private async getRecentResults(
    testCaseId: string | null,
    scriptId: string | null,
    limit: number
  ): Promise<Array<{ executionId: string; passed: boolean; timestamp: Date }>> {
    if (!testCaseId && !scriptId) return [];

    const results = await prisma.executionResult.findMany({
      where: {
        testCaseId: testCaseId || undefined,
        scriptId: scriptId || undefined,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        executionId: true,
        status: true,
        createdAt: true,
      },
    });

    return results.map(r => ({
      executionId: r.executionId,
      passed: r.status === 'passed',
      timestamp: r.createdAt,
    }));
  }
}

export const flakyTestService = new FlakyTestService();

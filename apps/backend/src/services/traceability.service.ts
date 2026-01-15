/**
 * Traceability Service
 * Tracks requirement → test case → execution → bug relationships
 */

import { prisma } from '../utils/prisma.js';
import { NotFoundError } from '../errors/index.js';

export interface RequirementCoverage {
  requirementId: string;
  requirementTitle: string;
  externalId: string | null;
  testCaseCount: number;
  automatedCount: number;
  executedCount: number;
  passedCount: number;
  failedCount: number;
  coverageStatus: 'covered' | 'partial' | 'uncovered';
  lastExecutedAt: Date | null;
}

export interface ProjectCoverage {
  totalRequirements: number;
  coveredRequirements: number;
  partialRequirements: number;
  uncoveredRequirements: number;
  coveragePercentage: number;
  totalTestCases: number;
  automatedTestCases: number;
  automationPercentage: number;
}

export interface TraceabilityChain {
  requirement: {
    id: string;
    title: string;
    externalId: string | null;
    status: string;
  };
  testCases: Array<{
    id: string;
    title: string;
    isAutomated: boolean;
    lastResult: {
      status: string;
      executedAt: Date;
    } | null;
  }>;
  executions: Array<{
    id: string;
    status: string;
    triggeredAt: Date;
    passRate: number;
  }>;
  bugs: Array<{
    id: string;
    title: string;
    status: string;
    externalId: string | null;
  }>;
}

export interface CoverageGap {
  type: 'no_tests' | 'no_automation' | 'no_execution' | 'failing';
  requirementId: string;
  requirementTitle: string;
  severity: 'high' | 'medium' | 'low';
  recommendation: string;
}

export class TraceabilityService {
  async getProjectCoverage(projectId: string): Promise<ProjectCoverage> {
    const [requirements, testCases] = await Promise.all([
      prisma.requirement.findMany({
        where: { projectId, status: 'active' },
        include: { testCases: { select: { id: true, isAutomated: true } } },
      }),
      prisma.testCase.findMany({
        where: { projectId, status: 'active' },
        select: { id: true, isAutomated: true },
      }),
    ]);

    const totalRequirements = requirements.length;
    const coveredRequirements = requirements.filter(r => r.testCases.length > 0).length;
    const partialRequirements = requirements.filter(r =>
      r.testCases.length > 0 && r.testCases.some(tc => !tc.isAutomated)
    ).length;
    const uncoveredRequirements = requirements.filter(r => r.testCases.length === 0).length;

    const totalTestCases = testCases.length;
    const automatedTestCases = testCases.filter(tc => tc.isAutomated).length;

    return {
      totalRequirements,
      coveredRequirements,
      partialRequirements,
      uncoveredRequirements,
      coveragePercentage: totalRequirements > 0
        ? Math.round((coveredRequirements / totalRequirements) * 100)
        : 0,
      totalTestCases,
      automatedTestCases,
      automationPercentage: totalTestCases > 0
        ? Math.round((automatedTestCases / totalTestCases) * 100)
        : 0,
    };
  }

  async getRequirementCoverage(projectId: string): Promise<RequirementCoverage[]> {
    const requirements = await prisma.requirement.findMany({
      where: { projectId, status: 'active' },
      include: {
        testCases: {
          include: {
            results: {
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    });

    return requirements.map(req => {
      const testCases = req.testCases;
      const automatedCount = testCases.filter(tc => tc.isAutomated).length;
      const executedTestCases = testCases.filter(tc => tc.results.length > 0);
      const passedCount = testCases.filter(tc =>
        tc.results[0]?.status === 'passed'
      ).length;
      const failedCount = testCases.filter(tc =>
        tc.results[0]?.status === 'failed' || tc.results[0]?.status === 'error'
      ).length;

      const lastExecutedAt = executedTestCases.length > 0
        ? new Date(Math.max(...executedTestCases.map(tc => tc.results[0]?.createdAt.getTime() ?? 0)))
        : null;

      let coverageStatus: 'covered' | 'partial' | 'uncovered';
      if (testCases.length === 0) {
        coverageStatus = 'uncovered';
      } else if (automatedCount === testCases.length && executedTestCases.length > 0) {
        coverageStatus = 'covered';
      } else {
        coverageStatus = 'partial';
      }

      return {
        requirementId: req.id,
        requirementTitle: req.title,
        externalId: req.externalId,
        testCaseCount: testCases.length,
        automatedCount,
        executedCount: executedTestCases.length,
        passedCount,
        failedCount,
        coverageStatus,
        lastExecutedAt,
      };
    });
  }

  async getTraceabilityChain(requirementId: string): Promise<TraceabilityChain> {
    const requirement = await prisma.requirement.findUnique({
      where: { id: requirementId },
      include: {
        testCases: {
          include: {
            results: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              include: { execution: true },
            },
            bugs: true,
          },
        },
      },
    });

    if (!requirement) throw new NotFoundError('Requirement', requirementId);

    const testCases = requirement.testCases.map(tc => ({
      id: tc.id,
      title: tc.title,
      isAutomated: tc.isAutomated,
      lastResult: tc.results[0] ? {
        status: tc.results[0].status,
        executedAt: tc.results[0].createdAt,
      } : null,
    }));

    // Get unique executions from test results
    const executionMap = new Map<string, { id: string; status: string; triggeredAt: Date; results: string[] }>();
    for (const tc of requirement.testCases) {
      for (const result of tc.results) {
        if (!executionMap.has(result.executionId)) {
          executionMap.set(result.executionId, {
            id: result.executionId,
            status: result.execution.status,
            triggeredAt: result.execution.createdAt,
            results: [],
          });
        }
        executionMap.get(result.executionId)!.results.push(result.status);
      }
    }

    const executions = Array.from(executionMap.values()).map(e => ({
      id: e.id,
      status: e.status,
      triggeredAt: e.triggeredAt,
      passRate: Math.round((e.results.filter(r => r === 'passed').length / e.results.length) * 100),
    }));

    // Get all bugs linked to test cases
    const bugs = requirement.testCases.flatMap(tc => tc.bugs).map(bug => ({
      id: bug.id,
      title: bug.title,
      status: bug.status,
      externalId: bug.externalId,
    }));

    return {
      requirement: {
        id: requirement.id,
        title: requirement.title,
        externalId: requirement.externalId,
        status: requirement.status,
      },
      testCases,
      executions,
      bugs,
    };
  }

  async getCoverageGaps(projectId: string): Promise<CoverageGap[]> {
    const requirements = await prisma.requirement.findMany({
      where: { projectId, status: 'active' },
      include: {
        testCases: {
          include: {
            results: { orderBy: { createdAt: 'desc' }, take: 1 },
          },
        },
      },
    });

    const gaps: CoverageGap[] = [];

    for (const req of requirements) {
      // No test cases
      if (req.testCases.length === 0) {
        gaps.push({
          type: 'no_tests',
          requirementId: req.id,
          requirementTitle: req.title,
          severity: req.priority === 'critical' || req.priority === 'high' ? 'high' : 'medium',
          recommendation: 'Create test cases for this requirement',
        });
        continue;
      }

      // No automation
      const automatedCount = req.testCases.filter(tc => tc.isAutomated).length;
      if (automatedCount === 0) {
        gaps.push({
          type: 'no_automation',
          requirementId: req.id,
          requirementTitle: req.title,
          severity: 'medium',
          recommendation: 'Automate existing test cases',
        });
      }

      // No recent execution
      const executedRecently = req.testCases.some(tc => {
        const lastResult = tc.results[0];
        if (!lastResult) return false;
        const daysSinceExecution = (Date.now() - lastResult.createdAt.getTime()) / (1000 * 60 * 60 * 24);
        return daysSinceExecution < 7;
      });

      if (!executedRecently && automatedCount > 0) {
        gaps.push({
          type: 'no_execution',
          requirementId: req.id,
          requirementTitle: req.title,
          severity: 'low',
          recommendation: 'Execute automated tests for this requirement',
        });
      }

      // Failing tests
      const failingTests = req.testCases.filter(tc =>
        tc.results[0]?.status === 'failed' || tc.results[0]?.status === 'error'
      );
      if (failingTests.length > 0) {
        gaps.push({
          type: 'failing',
          requirementId: req.id,
          requirementTitle: req.title,
          severity: 'high',
          recommendation: `Fix ${failingTests.length} failing test(s)`,
        });
      }
    }

    return gaps.sort((a, b) => {
      const severityOrder = { high: 0, medium: 1, low: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }
}

export const traceabilityService = new TraceabilityService();

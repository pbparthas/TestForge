/**
 * Traceability Service Tests
 * Tests requirement -> test case -> execution -> bug traceability
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    requirement: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    testCase: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('../../../src/utils/prisma.js', () => ({ prisma: mockPrisma }));

import { TraceabilityService } from '../../../src/services/traceability.service.js';
import { NotFoundError } from '../../../src/errors/index.js';

describe('TraceabilityService', () => {
  let service: TraceabilityService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TraceabilityService();
  });

  // ---------------------------------------------------------------------------
  // getProjectCoverage
  // ---------------------------------------------------------------------------
  describe('getProjectCoverage', () => {
    it('should return all zeros for an empty project', async () => {
      mockPrisma.requirement.findMany.mockResolvedValue([]);
      mockPrisma.testCase.findMany.mockResolvedValue([]);

      const result = await service.getProjectCoverage('proj-empty');

      expect(result).toEqual({
        totalRequirements: 0,
        coveredRequirements: 0,
        partialRequirements: 0,
        uncoveredRequirements: 0,
        coveragePercentage: 0,
        totalTestCases: 0,
        automatedTestCases: 0,
        automationPercentage: 0,
      });
      expect(mockPrisma.requirement.findMany).toHaveBeenCalledWith({
        where: { projectId: 'proj-empty', status: 'active' },
        include: { testCases: { select: { id: true, isAutomated: true } } },
      });
      expect(mockPrisma.testCase.findMany).toHaveBeenCalledWith({
        where: { projectId: 'proj-empty', status: 'active' },
        select: { id: true, isAutomated: true },
      });
    });

    it('should return 100% coverage when all requirements have test cases', async () => {
      mockPrisma.requirement.findMany.mockResolvedValue([
        { id: 'req-1', testCases: [{ id: 'tc-1', isAutomated: true }] },
        { id: 'req-2', testCases: [{ id: 'tc-2', isAutomated: true }] },
      ]);
      mockPrisma.testCase.findMany.mockResolvedValue([
        { id: 'tc-1', isAutomated: true },
        { id: 'tc-2', isAutomated: true },
      ]);

      const result = await service.getProjectCoverage('proj-1');

      expect(result.totalRequirements).toBe(2);
      expect(result.coveredRequirements).toBe(2);
      expect(result.uncoveredRequirements).toBe(0);
      expect(result.coveragePercentage).toBe(100);
    });

    it('should compute mixed coverage correctly', async () => {
      mockPrisma.requirement.findMany.mockResolvedValue([
        { id: 'req-1', testCases: [{ id: 'tc-1', isAutomated: true }] },
        { id: 'req-2', testCases: [{ id: 'tc-2', isAutomated: false }] },
        { id: 'req-3', testCases: [] },
        { id: 'req-4', testCases: [] },
      ]);
      mockPrisma.testCase.findMany.mockResolvedValue([
        { id: 'tc-1', isAutomated: true },
        { id: 'tc-2', isAutomated: false },
      ]);

      const result = await service.getProjectCoverage('proj-1');

      expect(result.totalRequirements).toBe(4);
      expect(result.coveredRequirements).toBe(2);
      expect(result.uncoveredRequirements).toBe(2);
      // partialRequirements = requirements that have test cases AND at least one non-automated
      // req-2 has tc-2 (isAutomated:false) so it counts as partial
      expect(result.partialRequirements).toBe(1);
      expect(result.coveragePercentage).toBe(50); // 2/4 = 50%
    });

    it('should compute automation percentage from test cases', async () => {
      mockPrisma.requirement.findMany.mockResolvedValue([
        { id: 'req-1', testCases: [{ id: 'tc-1', isAutomated: true }] },
      ]);
      mockPrisma.testCase.findMany.mockResolvedValue([
        { id: 'tc-1', isAutomated: true },
        { id: 'tc-2', isAutomated: false },
        { id: 'tc-3', isAutomated: true },
        { id: 'tc-4', isAutomated: false },
      ]);

      const result = await service.getProjectCoverage('proj-1');

      expect(result.totalTestCases).toBe(4);
      expect(result.automatedTestCases).toBe(2);
      expect(result.automationPercentage).toBe(50); // 2/4 = 50%
    });
  });

  // ---------------------------------------------------------------------------
  // getRequirementCoverage
  // ---------------------------------------------------------------------------
  describe('getRequirementCoverage', () => {
    it('should return uncovered status for requirement with no test cases', async () => {
      mockPrisma.requirement.findMany.mockResolvedValue([
        {
          id: 'req-1',
          title: 'Login Feature',
          externalId: 'JIRA-100',
          testCases: [],
        },
      ]);

      const result = await service.getRequirementCoverage('proj-1');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        requirementId: 'req-1',
        requirementTitle: 'Login Feature',
        externalId: 'JIRA-100',
        testCaseCount: 0,
        automatedCount: 0,
        executedCount: 0,
        passedCount: 0,
        failedCount: 0,
        coverageStatus: 'uncovered',
        lastExecutedAt: null,
      });
    });

    it('should return covered status when all test cases are automated and executed', async () => {
      const executionDate = new Date('2026-02-07T12:00:00Z');
      mockPrisma.requirement.findMany.mockResolvedValue([
        {
          id: 'req-1',
          title: 'Login Feature',
          externalId: 'JIRA-100',
          testCases: [
            {
              id: 'tc-1',
              isAutomated: true,
              results: [{ status: 'passed', createdAt: executionDate }],
            },
            {
              id: 'tc-2',
              isAutomated: true,
              results: [{ status: 'passed', createdAt: new Date('2026-02-06T10:00:00Z') }],
            },
          ],
        },
      ]);

      const result = await service.getRequirementCoverage('proj-1');

      expect(result[0].coverageStatus).toBe('covered');
      expect(result[0].automatedCount).toBe(2);
      expect(result[0].executedCount).toBe(2);
      expect(result[0].passedCount).toBe(2);
      expect(result[0].failedCount).toBe(0);
      expect(result[0].lastExecutedAt).toEqual(executionDate);
    });

    it('should return partial status when some test cases are not automated', async () => {
      mockPrisma.requirement.findMany.mockResolvedValue([
        {
          id: 'req-1',
          title: 'Signup Feature',
          externalId: null,
          testCases: [
            {
              id: 'tc-1',
              isAutomated: true,
              results: [{ status: 'passed', createdAt: new Date('2026-02-05T08:00:00Z') }],
            },
            {
              id: 'tc-2',
              isAutomated: false,
              results: [],
            },
          ],
        },
      ]);

      const result = await service.getRequirementCoverage('proj-1');

      expect(result[0].coverageStatus).toBe('partial');
      expect(result[0].testCaseCount).toBe(2);
      expect(result[0].automatedCount).toBe(1);
      expect(result[0].executedCount).toBe(1);
    });

    it('should compute passedCount and failedCount from latest result status', async () => {
      mockPrisma.requirement.findMany.mockResolvedValue([
        {
          id: 'req-1',
          title: 'Payment Feature',
          externalId: 'JIRA-200',
          testCases: [
            {
              id: 'tc-1',
              isAutomated: true,
              results: [{ status: 'passed', createdAt: new Date('2026-02-07T10:00:00Z') }],
            },
            {
              id: 'tc-2',
              isAutomated: true,
              results: [{ status: 'failed', createdAt: new Date('2026-02-07T11:00:00Z') }],
            },
            {
              id: 'tc-3',
              isAutomated: true,
              results: [{ status: 'error', createdAt: new Date('2026-02-07T09:00:00Z') }],
            },
          ],
        },
      ]);

      const result = await service.getRequirementCoverage('proj-1');

      expect(result[0].passedCount).toBe(1);
      expect(result[0].failedCount).toBe(2); // 'failed' + 'error' both count
    });

    it('should compute lastExecutedAt from the most recent result', async () => {
      const oldest = new Date('2026-01-01T00:00:00Z');
      const middle = new Date('2026-02-01T00:00:00Z');
      const newest = new Date('2026-02-07T18:30:00Z');

      mockPrisma.requirement.findMany.mockResolvedValue([
        {
          id: 'req-1',
          title: 'Dashboard Feature',
          externalId: null,
          testCases: [
            { id: 'tc-1', isAutomated: true, results: [{ status: 'passed', createdAt: oldest }] },
            { id: 'tc-2', isAutomated: true, results: [{ status: 'passed', createdAt: newest }] },
            { id: 'tc-3', isAutomated: true, results: [{ status: 'failed', createdAt: middle }] },
          ],
        },
      ]);

      const result = await service.getRequirementCoverage('proj-1');

      expect(result[0].lastExecutedAt).toEqual(newest);
    });
  });

  // ---------------------------------------------------------------------------
  // getTraceabilityChain
  // ---------------------------------------------------------------------------
  describe('getTraceabilityChain', () => {
    it('should throw NotFoundError for non-existent requirement', async () => {
      mockPrisma.requirement.findUnique.mockResolvedValue(null);

      await expect(service.getTraceabilityChain('req-nonexistent'))
        .rejects
        .toThrow(NotFoundError);
    });

    it('should return full chain with testCases, executions, and bugs', async () => {
      const execDate = new Date('2026-02-07T15:00:00Z');
      const resultDate = new Date('2026-02-07T15:05:00Z');

      mockPrisma.requirement.findUnique.mockResolvedValue({
        id: 'req-1',
        title: 'Login Feature',
        externalId: 'JIRA-123',
        status: 'active',
        testCases: [
          {
            id: 'tc-1',
            title: 'Test valid login',
            isAutomated: true,
            results: [
              {
                status: 'passed',
                createdAt: resultDate,
                executionId: 'exec-1',
                execution: { id: 'exec-1', status: 'completed', createdAt: execDate },
              },
            ],
            bugs: [
              { id: 'bug-1', title: 'Login fails on Safari', status: 'open', externalId: null },
            ],
          },
        ],
      });

      const result = await service.getTraceabilityChain('req-1');

      expect(result.requirement).toEqual({
        id: 'req-1',
        title: 'Login Feature',
        externalId: 'JIRA-123',
        status: 'active',
      });

      expect(result.testCases).toEqual([
        {
          id: 'tc-1',
          title: 'Test valid login',
          isAutomated: true,
          lastResult: { status: 'passed', executedAt: resultDate },
        },
      ]);

      expect(result.executions).toEqual([
        {
          id: 'exec-1',
          status: 'completed',
          triggeredAt: execDate,
          passRate: 100,
        },
      ]);

      expect(result.bugs).toEqual([
        { id: 'bug-1', title: 'Login fails on Safari', status: 'open', externalId: null },
      ]);
    });

    it('should compute execution passRate correctly', async () => {
      // Two test cases referencing the same execution, one passed and one failed
      const execDate = new Date('2026-02-07T14:00:00Z');
      mockPrisma.requirement.findUnique.mockResolvedValue({
        id: 'req-1',
        title: 'Checkout Flow',
        externalId: null,
        status: 'active',
        testCases: [
          {
            id: 'tc-1',
            title: 'Test add to cart',
            isAutomated: true,
            results: [
              {
                status: 'passed',
                createdAt: new Date('2026-02-07T14:01:00Z'),
                executionId: 'exec-1',
                execution: { id: 'exec-1', status: 'completed', createdAt: execDate },
              },
            ],
            bugs: [],
          },
          {
            id: 'tc-2',
            title: 'Test payment',
            isAutomated: true,
            results: [
              {
                status: 'failed',
                createdAt: new Date('2026-02-07T14:02:00Z'),
                executionId: 'exec-1',
                execution: { id: 'exec-1', status: 'completed', createdAt: execDate },
              },
            ],
            bugs: [],
          },
        ],
      });

      const result = await service.getTraceabilityChain('req-1');

      // exec-1 has 2 results: 1 passed, 1 failed -> passRate = 50%
      expect(result.executions).toHaveLength(1);
      expect(result.executions[0].passRate).toBe(50);
    });

    it('should deduplicate executions across multiple test results', async () => {
      const execDate1 = new Date('2026-02-06T10:00:00Z');
      const execDate2 = new Date('2026-02-07T10:00:00Z');

      mockPrisma.requirement.findUnique.mockResolvedValue({
        id: 'req-1',
        title: 'Search Feature',
        externalId: null,
        status: 'active',
        testCases: [
          {
            id: 'tc-1',
            title: 'Test basic search',
            isAutomated: true,
            results: [
              {
                status: 'passed',
                createdAt: new Date('2026-02-07T10:01:00Z'),
                executionId: 'exec-2',
                execution: { id: 'exec-2', status: 'completed', createdAt: execDate2 },
              },
            ],
            bugs: [],
          },
          {
            id: 'tc-2',
            title: 'Test advanced search',
            isAutomated: true,
            results: [
              {
                status: 'passed',
                createdAt: new Date('2026-02-07T10:02:00Z'),
                executionId: 'exec-2',
                execution: { id: 'exec-2', status: 'completed', createdAt: execDate2 },
              },
            ],
            bugs: [],
          },
          {
            id: 'tc-3',
            title: 'Test filter search',
            isAutomated: true,
            results: [
              {
                status: 'failed',
                createdAt: new Date('2026-02-06T10:01:00Z'),
                executionId: 'exec-1',
                execution: { id: 'exec-1', status: 'completed', createdAt: execDate1 },
              },
            ],
            bugs: [],
          },
        ],
      });

      const result = await service.getTraceabilityChain('req-1');

      // Should have 2 unique executions, not 3
      expect(result.executions).toHaveLength(2);
      const execIds = result.executions.map(e => e.id);
      expect(execIds).toContain('exec-1');
      expect(execIds).toContain('exec-2');

      // exec-2 has 2 passed results -> 100%
      const exec2 = result.executions.find(e => e.id === 'exec-2')!;
      expect(exec2.passRate).toBe(100);

      // exec-1 has 1 failed result -> 0%
      const exec1 = result.executions.find(e => e.id === 'exec-1')!;
      expect(exec1.passRate).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // getCoverageGaps
  // ---------------------------------------------------------------------------
  describe('getCoverageGaps', () => {
    it('should identify no_tests gap for requirements with zero test cases', async () => {
      mockPrisma.requirement.findMany.mockResolvedValue([
        {
          id: 'req-1',
          title: 'Untested Feature',
          priority: 'medium',
          testCases: [],
        },
      ]);

      const result = await service.getCoverageGaps('proj-1');

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        type: 'no_tests',
        requirementId: 'req-1',
        requirementTitle: 'Untested Feature',
        severity: 'medium',
        recommendation: 'Create test cases for this requirement',
      });
    });

    it('should identify no_automation gap for requirements with no automated tests', async () => {
      // Has test cases but none are automated, and no results -> also triggers no_execution
      mockPrisma.requirement.findMany.mockResolvedValue([
        {
          id: 'req-1',
          title: 'Manual Only Feature',
          priority: 'low',
          testCases: [
            { id: 'tc-1', isAutomated: false, results: [] },
            { id: 'tc-2', isAutomated: false, results: [] },
          ],
        },
      ]);

      const result = await service.getCoverageGaps('proj-1');

      const noAutoGap = result.find(g => g.type === 'no_automation');
      expect(noAutoGap).toBeDefined();
      expect(noAutoGap!.severity).toBe('medium');
      expect(noAutoGap!.recommendation).toBe('Automate existing test cases');
    });

    it('should identify no_execution gap for automated tests not run in 7 days', async () => {
      const staleDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000); // 10 days ago
      mockPrisma.requirement.findMany.mockResolvedValue([
        {
          id: 'req-1',
          title: 'Stale Feature',
          priority: 'medium',
          testCases: [
            {
              id: 'tc-1',
              isAutomated: true,
              results: [{ status: 'passed', createdAt: staleDate }],
            },
          ],
        },
      ]);

      const result = await service.getCoverageGaps('proj-1');

      const noExecGap = result.find(g => g.type === 'no_execution');
      expect(noExecGap).toBeDefined();
      expect(noExecGap!.severity).toBe('low');
      expect(noExecGap!.recommendation).toBe('Execute automated tests for this requirement');
    });

    it('should identify failing gap for tests with failed or error results', async () => {
      const recentDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000); // 1 day ago
      mockPrisma.requirement.findMany.mockResolvedValue([
        {
          id: 'req-1',
          title: 'Broken Feature',
          priority: 'high',
          testCases: [
            {
              id: 'tc-1',
              isAutomated: true,
              results: [{ status: 'failed', createdAt: recentDate }],
            },
            {
              id: 'tc-2',
              isAutomated: true,
              results: [{ status: 'error', createdAt: recentDate }],
            },
            {
              id: 'tc-3',
              isAutomated: true,
              results: [{ status: 'passed', createdAt: recentDate }],
            },
          ],
        },
      ]);

      const result = await service.getCoverageGaps('proj-1');

      const failingGap = result.find(g => g.type === 'failing');
      expect(failingGap).toBeDefined();
      expect(failingGap!.severity).toBe('high');
      expect(failingGap!.recommendation).toBe('Fix 2 failing test(s)');
    });

    it('should assign high severity for critical/high priority requirements with no tests', async () => {
      mockPrisma.requirement.findMany.mockResolvedValue([
        { id: 'req-crit', title: 'Critical Feature', priority: 'critical', testCases: [] },
        { id: 'req-high', title: 'High Priority Feature', priority: 'high', testCases: [] },
        { id: 'req-low', title: 'Low Priority Feature', priority: 'low', testCases: [] },
      ]);

      const result = await service.getCoverageGaps('proj-1');

      const critGap = result.find(g => g.requirementId === 'req-crit')!;
      const highGap = result.find(g => g.requirementId === 'req-high')!;
      const lowGap = result.find(g => g.requirementId === 'req-low')!;

      expect(critGap.severity).toBe('high');
      expect(highGap.severity).toBe('high');
      expect(lowGap.severity).toBe('medium');
    });

    it('should sort results by severity (high first, then medium, then low)', async () => {
      const staleDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      const recentDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);

      mockPrisma.requirement.findMany.mockResolvedValue([
        // This will produce no_execution (severity: low) since it has automated tests + stale results
        {
          id: 'req-stale',
          title: 'Stale Execution',
          priority: 'medium',
          testCases: [
            { id: 'tc-1', isAutomated: true, results: [{ status: 'passed', createdAt: staleDate }] },
          ],
        },
        // This will produce no_tests (severity: high) since critical priority + no test cases
        {
          id: 'req-critical',
          title: 'Critical No Tests',
          priority: 'critical',
          testCases: [],
        },
        // This will produce no_automation (severity: medium) since no automated tests
        {
          id: 'req-manual',
          title: 'Manual Tests',
          priority: 'low',
          testCases: [
            { id: 'tc-2', isAutomated: false, results: [{ status: 'passed', createdAt: recentDate }] },
          ],
        },
      ]);

      const result = await service.getCoverageGaps('proj-1');

      // Verify the ordering: high first, medium second, low last
      expect(result.length).toBeGreaterThanOrEqual(3);
      expect(result[0].severity).toBe('high');
      expect(result[result.length - 1].severity).toBe('low');

      // Verify no severity ordering violations
      const severityOrder = { high: 0, medium: 1, low: 2 };
      for (let i = 1; i < result.length; i++) {
        expect(severityOrder[result[i].severity]).toBeGreaterThanOrEqual(
          severityOrder[result[i - 1].severity]
        );
      }
    });
  });
});

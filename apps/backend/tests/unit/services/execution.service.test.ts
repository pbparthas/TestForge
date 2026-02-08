/**
 * Execution Service Tests
 * Covers: state machine (trigger/start/complete/cancel), CRUD, retryFailed,
 * triggerSelfHealing, and getProjectStats
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const { mockPrisma, mockLogger, mockSelfHealingAgent } = vi.hoisted(() => ({
  mockPrisma: {
    execution: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    executionResult: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
  mockLogger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
  mockSelfHealingAgent: {
    diagnose: vi.fn(),
  },
}));

vi.mock('../../../src/utils/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../../../src/utils/logger.js', () => ({ logger: mockLogger }));
vi.mock('../../../src/agents/selfhealing.agent.js', () => ({ selfHealingAgent: mockSelfHealingAgent }));

import { ExecutionService } from '../../../src/services/execution.service.js';

describe('ExecutionService', () => {
  let service: ExecutionService;

  const now = new Date();

  const mockExecution = {
    id: 'exec-1',
    projectId: 'proj-1',
    suiteId: 'suite-1',
    environmentId: 'env-1',
    triggerType: 'manual',
    triggeredById: 'user-1',
    status: 'pending',
    startedAt: null,
    completedAt: null,
    summary: null,
    createdAt: now,
    updatedAt: now,
    results: [],
    suite: null,
    environment: null,
  };

  const mockPassedResult = {
    id: 'result-1',
    executionId: 'exec-1',
    testCaseId: 'tc-1',
    scriptId: null,
    status: 'passed',
    durationMs: 5000,
    errorMessage: null,
    errorStack: null,
    screenshots: [],
    videoUrl: null,
    logs: null,
    selfHealingApplied: false,
    createdAt: now,
  };

  const mockFailedResult = {
    id: 'result-2',
    executionId: 'exec-1',
    testCaseId: 'tc-2',
    scriptId: null,
    status: 'failed',
    durationMs: 3000,
    errorMessage: 'Element not found',
    errorStack: 'Error: Element not found\n    at ...',
    screenshots: [],
    videoUrl: null,
    logs: null,
    selfHealingApplied: false,
    createdAt: now,
  };

  const mockErrorResult = {
    id: 'result-3',
    executionId: 'exec-1',
    testCaseId: 'tc-3',
    scriptId: null,
    status: 'error',
    durationMs: 1000,
    errorMessage: 'Timeout exceeded',
    errorStack: null,
    screenshots: [],
    videoUrl: null,
    logs: null,
    selfHealingApplied: false,
    createdAt: now,
  };

  const mockDiagnosisResponse = {
    data: {
      diagnosis: { type: 'selector_changed' },
      suggestedFixes: [{ autoApplicable: true, confidence: 90, fix: 'Updated selector to #new-btn' }],
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ExecutionService();
  });

  // ---------------------------------------------------------------------------
  // State Machine
  // ---------------------------------------------------------------------------

  describe('trigger', () => {
    it('should create an execution with status=pending and log info', async () => {
      mockPrisma.execution.create.mockResolvedValue({ ...mockExecution });

      const result = await service.trigger({
        projectId: 'proj-1',
        suiteId: 'suite-1',
        environmentId: 'env-1',
        triggerType: 'manual',
        triggeredById: 'user-1',
      });

      expect(result.status).toBe('pending');
      expect(mockPrisma.execution.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          projectId: 'proj-1',
          suiteId: 'suite-1',
          environmentId: 'env-1',
          triggerType: 'manual',
          triggeredById: 'user-1',
          status: 'pending',
        }),
      });
      expect(mockLogger.info).toHaveBeenCalledWith(
        { executionId: 'exec-1', projectId: 'proj-1' },
        'Execution triggered',
      );
    });
  });

  describe('start', () => {
    it('should update execution to running with startedAt', async () => {
      mockPrisma.execution.findUnique.mockResolvedValue({ ...mockExecution });
      const runningExec = { ...mockExecution, status: 'running', startedAt: now };
      mockPrisma.execution.update.mockResolvedValue(runningExec);

      const result = await service.start('exec-1');

      expect(result.status).toBe('running');
      expect(mockPrisma.execution.update).toHaveBeenCalledWith({
        where: { id: 'exec-1' },
        data: { status: 'running', startedAt: expect.any(Date) },
      });
    });

    it('should throw NotFoundError if execution does not exist', async () => {
      mockPrisma.execution.findUnique.mockResolvedValue(null);

      await expect(service.start('nonexistent')).rejects.toThrow(
        "Execution with id 'nonexistent' not found",
      );
    });
  });

  describe('complete', () => {
    it('should set status=completed when all results passed', async () => {
      const execWithResults = {
        ...mockExecution,
        results: [mockPassedResult, { ...mockPassedResult, id: 'result-4', testCaseId: 'tc-4' }],
      };
      mockPrisma.execution.findUnique.mockResolvedValue(execWithResults);
      const completedExec = { ...mockExecution, status: 'completed', completedAt: now };
      mockPrisma.execution.update.mockResolvedValue(completedExec);

      const result = await service.complete('exec-1');

      expect(result.status).toBe('completed');
      expect(mockPrisma.execution.update).toHaveBeenCalledWith({
        where: { id: 'exec-1' },
        data: {
          status: 'completed',
          completedAt: expect.any(Date),
          summary: expect.objectContaining({
            total: 2,
            passed: 2,
            failed: 0,
            skipped: 0,
            error: 0,
            passRate: 100,
          }),
        },
      });
    });

    it('should set status=failed when any result is failed or error', async () => {
      const execWithResults = {
        ...mockExecution,
        results: [mockPassedResult, mockFailedResult, mockErrorResult],
      };
      mockPrisma.execution.findUnique.mockResolvedValue(execWithResults);
      const failedExec = { ...mockExecution, status: 'failed', completedAt: now };
      mockPrisma.execution.update.mockResolvedValue(failedExec);

      const result = await service.complete('exec-1');

      expect(result.status).toBe('failed');
      expect(mockPrisma.execution.update).toHaveBeenCalledWith({
        where: { id: 'exec-1' },
        data: {
          status: 'failed',
          completedAt: expect.any(Date),
          summary: expect.objectContaining({
            total: 3,
            passed: 1,
            failed: 1,
            error: 1,
            passRate: 33,
            totalDurationMs: 9000,
          }),
        },
      });
    });

    it('should throw NotFoundError if execution does not exist', async () => {
      mockPrisma.execution.findUnique.mockResolvedValue(null);

      await expect(service.complete('nonexistent')).rejects.toThrow(
        "Execution with id 'nonexistent' not found",
      );
    });
  });

  describe('cancel', () => {
    it('should set status=cancelled with completedAt', async () => {
      mockPrisma.execution.findUnique.mockResolvedValue({ ...mockExecution });
      const cancelledExec = { ...mockExecution, status: 'cancelled', completedAt: now };
      mockPrisma.execution.update.mockResolvedValue(cancelledExec);

      const result = await service.cancel('exec-1');

      expect(result.status).toBe('cancelled');
      expect(mockPrisma.execution.update).toHaveBeenCalledWith({
        where: { id: 'exec-1' },
        data: { status: 'cancelled', completedAt: expect.any(Date) },
      });
    });

    it('should throw NotFoundError if execution does not exist', async () => {
      mockPrisma.execution.findUnique.mockResolvedValue(null);

      await expect(service.cancel('nonexistent')).rejects.toThrow(
        "Execution with id 'nonexistent' not found",
      );
    });
  });

  // ---------------------------------------------------------------------------
  // CRUD
  // ---------------------------------------------------------------------------

  describe('findById', () => {
    it('should return execution with results, suite, and environment', async () => {
      mockPrisma.execution.findUnique.mockResolvedValue({ ...mockExecution, results: [mockPassedResult] });

      const result = await service.findById('exec-1');

      expect(result.id).toBe('exec-1');
      expect(result.results).toHaveLength(1);
      expect(mockPrisma.execution.findUnique).toHaveBeenCalledWith({
        where: { id: 'exec-1' },
        include: { results: true, suite: true, environment: true },
      });
    });

    it('should throw NotFoundError if execution not found', async () => {
      mockPrisma.execution.findUnique.mockResolvedValue(null);

      await expect(service.findById('nonexistent')).rejects.toThrow(
        "Execution with id 'nonexistent' not found",
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated executions with all filters applied', async () => {
      mockPrisma.execution.findMany.mockResolvedValue([mockExecution]);
      mockPrisma.execution.count.mockResolvedValue(1);

      const result = await service.findAll({
        page: 1,
        limit: 10,
        projectId: 'proj-1',
        suiteId: 'suite-1',
        status: 'pending' as any,
        triggerType: 'manual' as any,
      });

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.totalPages).toBe(1);

      const expectedWhere = {
        projectId: 'proj-1',
        suiteId: 'suite-1',
        status: 'pending',
        triggerType: 'manual',
      };
      expect(mockPrisma.execution.findMany).toHaveBeenCalledWith({
        where: expectedWhere,
        skip: 0,
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: { suite: true, environment: true },
      });
      expect(mockPrisma.execution.count).toHaveBeenCalledWith({ where: expectedWhere });
    });
  });

  describe('recordResult', () => {
    it('should create an execution result with all fields', async () => {
      mockPrisma.executionResult.create.mockResolvedValue({ ...mockFailedResult });

      const input = {
        executionId: 'exec-1',
        testCaseId: 'tc-2',
        status: 'failed' as const,
        durationMs: 3000,
        errorMessage: 'Element not found',
        errorStack: 'Error: Element not found\n    at ...',
        screenshots: ['screenshot1.png'],
        videoUrl: 'https://video.url/rec.mp4',
        logs: 'Step 1: Navigate to page...',
      };

      const result = await service.recordResult(input);

      expect(result.executionId).toBe('exec-1');
      expect(mockPrisma.executionResult.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          executionId: 'exec-1',
          testCaseId: 'tc-2',
          status: 'failed',
          durationMs: 3000,
          errorMessage: 'Element not found',
          errorStack: 'Error: Element not found\n    at ...',
          screenshots: ['screenshot1.png'],
          videoUrl: 'https://video.url/rec.mp4',
          logs: 'Step 1: Navigate to page...',
        }),
      });
    });
  });

  describe('getResults', () => {
    it('should return results for an execution ordered by createdAt asc', async () => {
      mockPrisma.executionResult.findMany.mockResolvedValue([mockPassedResult, mockFailedResult]);

      const results = await service.getResults('exec-1');

      expect(results).toHaveLength(2);
      expect(mockPrisma.executionResult.findMany).toHaveBeenCalledWith({
        where: { executionId: 'exec-1' },
        include: { testCase: true, script: true },
        orderBy: { createdAt: 'asc' },
      });
    });
  });

  // ---------------------------------------------------------------------------
  // retryFailed
  // ---------------------------------------------------------------------------

  describe('retryFailed', () => {
    it('should create a new execution with failed test case IDs', async () => {
      // findById is called internally -- mock findUnique with includes
      mockPrisma.execution.findUnique.mockResolvedValue({
        ...mockExecution,
        results: [mockPassedResult, mockFailedResult, mockErrorResult],
      });

      const retryExec = { ...mockExecution, id: 'exec-retry-1' };
      mockPrisma.execution.create.mockResolvedValue(retryExec);

      const result = await service.retryFailed('exec-1', 'user-1');

      expect(result.id).toBe('exec-retry-1');
      // The trigger call should include testCaseIds from failed/error results
      expect(mockPrisma.execution.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          projectId: 'proj-1',
          suiteId: 'suite-1',
          triggerType: 'manual',
          triggeredById: 'user-1',
          status: 'pending',
        }),
      });
      expect(mockLogger.info).toHaveBeenCalledWith(
        { originalId: 'exec-1', retryId: 'exec-retry-1' },
        'Retry execution created',
      );
    });

    it('should throw error when no failed tests to retry', async () => {
      mockPrisma.execution.findUnique.mockResolvedValue({
        ...mockExecution,
        results: [mockPassedResult],
      });

      await expect(service.retryFailed('exec-1')).rejects.toThrow('No failed tests to retry');
    });
  });

  // ---------------------------------------------------------------------------
  // triggerSelfHealing
  // ---------------------------------------------------------------------------

  describe('triggerSelfHealing', () => {
    it('should call diagnose, mark selfHealingApplied=true, and return diagnosis', async () => {
      mockPrisma.executionResult.findUnique.mockResolvedValue({ ...mockFailedResult });
      mockSelfHealingAgent.diagnose.mockResolvedValue(mockDiagnosisResponse);
      mockPrisma.executionResult.update.mockResolvedValue({
        ...mockFailedResult,
        selfHealingApplied: true,
      });

      const result = await service.triggerSelfHealing('result-2', 'const btn = page.locator("#old-btn");');

      expect(result.diagnosis).toEqual(mockDiagnosisResponse.data);
      expect(result.fixed).toBe(true);
      expect(mockSelfHealingAgent.diagnose).toHaveBeenCalledWith({
        errorMessage: 'Element not found',
        errorStack: 'Error: Element not found\n    at ...',
        failedCode: 'const btn = page.locator("#old-btn");',
      });
      expect(mockPrisma.executionResult.update).toHaveBeenCalledWith({
        where: { id: 'result-2' },
        data: { selfHealingApplied: true },
      });
      expect(mockLogger.info).toHaveBeenCalledWith(
        { resultId: 'result-2', diagnosisType: 'selector_changed' },
        'Self-healing triggered',
      );
    });

    it('should throw NotFoundError if result does not exist', async () => {
      mockPrisma.executionResult.findUnique.mockResolvedValue(null);

      await expect(
        service.triggerSelfHealing('nonexistent', 'some code'),
      ).rejects.toThrow("ExecutionResult with id 'nonexistent' not found");
    });

    it('should throw error if result status is not failed', async () => {
      mockPrisma.executionResult.findUnique.mockResolvedValue({ ...mockPassedResult });

      await expect(
        service.triggerSelfHealing('result-1', 'some code'),
      ).rejects.toThrow('Can only trigger self-healing for failed results');
    });
  });

  // ---------------------------------------------------------------------------
  // getProjectStats
  // ---------------------------------------------------------------------------

  describe('getProjectStats', () => {
    it('should calculate stats over the specified number of days', async () => {
      const completedExec = {
        ...mockExecution,
        id: 'exec-c1',
        status: 'completed',
        results: [mockPassedResult, { ...mockPassedResult, id: 'result-5' }],
      };
      const failedExec = {
        ...mockExecution,
        id: 'exec-f1',
        status: 'failed',
        results: [mockPassedResult, mockFailedResult],
      };
      mockPrisma.execution.findMany.mockResolvedValue([completedExec, failedExec]);

      const stats = await service.getProjectStats('proj-1', 14);

      expect(stats.totalExecutions).toBe(2);
      expect(stats.completedExecutions).toBe(1);
      expect(stats.failedExecutions).toBe(1);
      // Aggregated across all results: 3 passed, 1 failed = 4 total
      expect(stats.total).toBe(4);
      expect(stats.passed).toBe(3);
      expect(stats.failed).toBe(1);
      expect(stats.passRate).toBe(75);
      expect(stats.averagePassRate).toBe(75);
      expect(stats.totalDurationMs).toBe(18000); // 5000 * 3 + 3000

      expect(mockPrisma.execution.findMany).toHaveBeenCalledWith({
        where: {
          projectId: 'proj-1',
          createdAt: { gte: expect.any(Date) },
        },
        include: { results: true },
      });
    });
  });
});

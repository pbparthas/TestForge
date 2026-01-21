/**
 * Flaky Test Service Unit Tests
 * Sprint 14: Tests for flaky test detection, scoring, and management
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// All mocks must be hoisted
const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    flakyTest: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    flakyPattern: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    execution: {
      findUnique: vi.fn(),
    },
    executionResult: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('../../../src/utils/prisma.js', () => ({ prisma: mockPrisma }));

import { FlakyTestService } from '../../../src/services/flaky.service.js';
import { NotFoundError, ValidationError } from '../../../src/errors/index.js';

describe('FlakyTestService', () => {
  let service: FlakyTestService;

  const mockProject = { id: 'project-123' };
  const mockUser = { id: 'user-123' };

  const mockFlakyTest = {
    id: 'flaky-123',
    projectId: mockProject.id,
    testCaseId: 'testcase-123',
    scriptId: 'script-123',
    testName: 'Test Login Flow',
    flakinessScore: 50,
    totalRuns: 10,
    passCount: 5,
    failCount: 5,
    lastPassAt: new Date(),
    lastFailAt: new Date(),
    isQuarantined: false,
    quarantinedAt: null,
    quarantinedById: null,
    quarantineReason: null,
    patternType: null,
    rootCauseAnalysis: null,
    fixStatus: 'open' as const,
    fixedAt: null,
    fixedById: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockExecution = {
    id: 'exec-123',
    projectId: mockProject.id,
    results: [
      {
        testCaseId: 'testcase-123',
        scriptId: 'script-123',
        status: 'passed',
        testCase: { title: 'Test Login' },
        script: { name: 'login.spec.ts' },
      },
      {
        testCaseId: 'testcase-456',
        scriptId: 'script-456',
        status: 'failed',
        testCase: { title: 'Test Checkout' },
        script: { name: 'checkout.spec.ts' },
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new FlakyTestService();
  });

  // ==========================================================================
  // FLAKINESS SCORE CALCULATION
  // ==========================================================================

  describe('calculateFlakinessScore', () => {
    it('should return 0 for less than 3 runs', () => {
      const score = service.calculateFlakinessScore(2, 1, 1);
      expect(score).toBe(0);
    });

    it('should return 0 for all passes', () => {
      const score = service.calculateFlakinessScore(10, 10, 0);
      expect(score).toBe(0);
    });

    it('should return 0 for all failures', () => {
      const score = service.calculateFlakinessScore(10, 0, 10);
      expect(score).toBe(0);
    });

    it('should return 100 for 50/50 pass/fail ratio', () => {
      const score = service.calculateFlakinessScore(10, 5, 5);
      expect(score).toBe(100);
    });

    it('should return ~75 for 75% pass rate', () => {
      const score = service.calculateFlakinessScore(100, 75, 25);
      expect(score).toBe(75);
    });

    it('should return ~75 for 25% pass rate', () => {
      const score = service.calculateFlakinessScore(100, 25, 75);
      expect(score).toBe(75);
    });
  });

  // ==========================================================================
  // UPDATE METRICS FROM EXECUTION
  // ==========================================================================

  describe('updateMetricsFromExecution', () => {
    it('should create new flaky records for new tests', async () => {
      mockPrisma.execution.findUnique.mockResolvedValue(mockExecution);
      mockPrisma.flakyTest.findFirst.mockResolvedValue(null);
      mockPrisma.flakyTest.create.mockResolvedValue(mockFlakyTest);

      const result = await service.updateMetricsFromExecution('exec-123');

      expect(result.newFlaky).toBe(2);
      expect(mockPrisma.flakyTest.create).toHaveBeenCalledTimes(2);
    });

    it('should update existing flaky records', async () => {
      // Use data that keeps flakiness score below auto-quarantine threshold (80)
      // totalRuns: 10, passCount: 9, failCount: 1 => passRate = 90% => score = 4*0.9*0.1*100 = 36%
      const lowFlakyTest = {
        ...mockFlakyTest,
        totalRuns: 10,
        passCount: 9,
        failCount: 1,
        flakinessScore: 36,
      };

      mockPrisma.execution.findUnique.mockResolvedValue({
        ...mockExecution,
        results: [mockExecution.results[0]],
      });
      mockPrisma.flakyTest.findFirst.mockResolvedValue(lowFlakyTest);
      // After update: totalRuns: 11, passCount: 10 => passRate = 90.9% => score = 4*0.909*0.091*100 = 33%
      mockPrisma.flakyTest.update.mockResolvedValue({
        ...lowFlakyTest,
        totalRuns: 11,
        passCount: 10,
        flakinessScore: 33,
      });

      const result = await service.updateMetricsFromExecution('exec-123');

      expect(result.updated).toBe(1);
      expect(mockPrisma.flakyTest.update).toHaveBeenCalled();
    });

    it('should throw NotFoundError for invalid execution', async () => {
      mockPrisma.execution.findUnique.mockResolvedValue(null);

      await expect(
        service.updateMetricsFromExecution('invalid')
      ).rejects.toThrow(NotFoundError);
    });

    it('should auto-quarantine tests above threshold', async () => {
      const highFlakyTest = {
        ...mockFlakyTest,
        totalRuns: 9,
        passCount: 5,
        failCount: 4,
        flakinessScore: 70,
        isQuarantined: false,
      };

      mockPrisma.execution.findUnique.mockResolvedValue({
        ...mockExecution,
        results: [mockExecution.results[0]],
      });
      mockPrisma.flakyTest.findFirst.mockResolvedValue(highFlakyTest);
      mockPrisma.flakyTest.update.mockResolvedValue({
        ...highFlakyTest,
        totalRuns: 10,
        passCount: 6,
        flakinessScore: 96, // Above 80 threshold
      });
      mockPrisma.flakyTest.findUnique.mockResolvedValue({
        ...highFlakyTest,
        flakinessScore: 96,
      });

      const result = await service.updateMetricsFromExecution('exec-123', 80);

      expect(result.autoQuarantined).toBe(1);
    });
  });

  // ==========================================================================
  // GET FLAKY TESTS
  // ==========================================================================

  describe('getFlakyTests', () => {
    it('should return flaky tests for project', async () => {
      mockPrisma.flakyTest.findMany.mockResolvedValue([mockFlakyTest]);
      mockPrisma.executionResult.findMany.mockResolvedValue([]);

      const result = await service.getFlakyTests({ projectId: mockProject.id });

      expect(result).toHaveLength(1);
      expect(result[0]?.testName).toBe('Test Login Flow');
    });

    it('should filter by threshold', async () => {
      mockPrisma.flakyTest.findMany.mockResolvedValue([mockFlakyTest]);
      mockPrisma.executionResult.findMany.mockResolvedValue([]);

      await service.getFlakyTests({ projectId: mockProject.id, threshold: 40 });

      expect(mockPrisma.flakyTest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            flakinessScore: { gte: 40 },
          }),
        })
      );
    });

    it('should filter by quarantine status', async () => {
      mockPrisma.flakyTest.findMany.mockResolvedValue([]);
      mockPrisma.executionResult.findMany.mockResolvedValue([]);

      await service.getFlakyTests({
        projectId: mockProject.id,
        isQuarantined: true,
      });

      expect(mockPrisma.flakyTest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isQuarantined: true,
          }),
        })
      );
    });
  });

  // ==========================================================================
  // QUARANTINE
  // ==========================================================================

  describe('quarantineTest', () => {
    it('should quarantine a test', async () => {
      mockPrisma.flakyTest.findUnique.mockResolvedValue(mockFlakyTest);
      mockPrisma.flakyTest.update.mockResolvedValue({
        ...mockFlakyTest,
        isQuarantined: true,
        quarantinedAt: new Date(),
        quarantinedById: mockUser.id,
        quarantineReason: 'Too flaky',
      });

      const result = await service.quarantineTest(
        mockFlakyTest.id,
        mockUser.id,
        'Too flaky'
      );

      expect(result.isQuarantined).toBe(true);
      expect(mockPrisma.flakyTest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isQuarantined: true,
            quarantineReason: 'Too flaky',
          }),
        })
      );
    });

    it('should reject quarantine if already quarantined', async () => {
      mockPrisma.flakyTest.findUnique.mockResolvedValue({
        ...mockFlakyTest,
        isQuarantined: true,
      });

      await expect(
        service.quarantineTest(mockFlakyTest.id, mockUser.id, 'Reason')
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('unquarantineTest', () => {
    it('should unquarantine a test', async () => {
      mockPrisma.flakyTest.findUnique.mockResolvedValue({
        ...mockFlakyTest,
        isQuarantined: true,
      });
      mockPrisma.flakyTest.update.mockResolvedValue({
        ...mockFlakyTest,
        isQuarantined: false,
      });

      const result = await service.unquarantineTest(mockFlakyTest.id, mockUser.id);

      expect(result.isQuarantined).toBe(false);
    });

    it('should reject if not quarantined', async () => {
      mockPrisma.flakyTest.findUnique.mockResolvedValue(mockFlakyTest);

      await expect(
        service.unquarantineTest(mockFlakyTest.id, mockUser.id)
      ).rejects.toThrow(ValidationError);
    });
  });

  // ==========================================================================
  // FIX STATUS
  // ==========================================================================

  describe('markAsFixed', () => {
    it('should mark test as fixed and unquarantine', async () => {
      mockPrisma.flakyTest.findUnique.mockResolvedValue({
        ...mockFlakyTest,
        isQuarantined: true,
      });
      mockPrisma.flakyTest.update.mockResolvedValue({
        ...mockFlakyTest,
        fixStatus: 'fixed',
        fixedAt: new Date(),
        fixedById: mockUser.id,
        isQuarantined: false,
      });

      const result = await service.markAsFixed(mockFlakyTest.id, mockUser.id);

      expect(result.fixStatus).toBe('fixed');
      expect(result.isQuarantined).toBe(false);
    });

    it('should reject if already fixed', async () => {
      mockPrisma.flakyTest.findUnique.mockResolvedValue({
        ...mockFlakyTest,
        fixStatus: 'fixed',
      });

      await expect(
        service.markAsFixed(mockFlakyTest.id, mockUser.id)
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('updateFixStatus', () => {
    it('should update fix status', async () => {
      mockPrisma.flakyTest.findUnique.mockResolvedValue(mockFlakyTest);
      mockPrisma.flakyTest.update.mockResolvedValue({
        ...mockFlakyTest,
        fixStatus: 'investigating',
      });

      const result = await service.updateFixStatus(
        mockFlakyTest.id,
        'investigating'
      );

      expect(result.fixStatus).toBe('investigating');
    });
  });

  // ==========================================================================
  // PATTERNS
  // ==========================================================================

  describe('updatePatternType', () => {
    it('should update pattern type', async () => {
      mockPrisma.flakyTest.findUnique.mockResolvedValue(mockFlakyTest);
      mockPrisma.flakyTest.update.mockResolvedValue({
        ...mockFlakyTest,
        patternType: 'timing',
      });

      const result = await service.updatePatternType(mockFlakyTest.id, 'timing');

      expect(result.patternType).toBe('timing');
    });
  });

  describe('createPattern', () => {
    it('should create a flaky pattern', async () => {
      const mockPattern = {
        id: 'pattern-123',
        projectId: mockProject.id,
        patternType: 'timing',
        description: 'Timing issues detected',
        severity: 'high',
        affectedTestIds: ['test-1', 'test-2'],
        confidence: 85,
        suggestedFix: 'Add explicit waits',
        detectedAt: new Date(),
      };

      mockPrisma.flakyPattern.create.mockResolvedValue(mockPattern);

      const result = await service.createPattern(
        mockProject.id,
        'timing',
        'Timing issues detected',
        'high',
        ['test-1', 'test-2'],
        85,
        'Add explicit waits'
      );

      expect(result.patternType).toBe('timing');
      expect(result.severity).toBe('high');
    });
  });

  // ==========================================================================
  // SUMMARY & TRENDS
  // ==========================================================================

  describe('getProjectSummary', () => {
    it('should return project summary', async () => {
      mockPrisma.flakyTest.findMany.mockResolvedValue([
        { ...mockFlakyTest, flakinessScore: 50 },
        { ...mockFlakyTest, id: 'flaky-456', flakinessScore: 75, isQuarantined: true },
      ]);
      mockPrisma.executionResult.findMany.mockResolvedValue([]);

      const result = await service.getProjectSummary(mockProject.id);

      expect(result.totalFlaky).toBe(2);
      expect(result.quarantined).toBe(1);
      expect(result.avgScore).toBeCloseTo(62.5);
    });
  });

  describe('getQuarantinedTests', () => {
    it('should return only quarantined tests', async () => {
      mockPrisma.flakyTest.findMany.mockResolvedValue([
        { ...mockFlakyTest, isQuarantined: true },
      ]);
      mockPrisma.executionResult.findMany.mockResolvedValue([]);

      const result = await service.getQuarantinedTests(mockProject.id);

      expect(result).toHaveLength(1);
      expect(mockPrisma.flakyTest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isQuarantined: true,
          }),
        })
      );
    });
  });

  // ==========================================================================
  // RESET
  // ==========================================================================

  describe('resetMetrics', () => {
    it('should reset flaky test metrics', async () => {
      mockPrisma.flakyTest.findUnique.mockResolvedValue(mockFlakyTest);
      mockPrisma.flakyTest.update.mockResolvedValue({
        ...mockFlakyTest,
        totalRuns: 0,
        passCount: 0,
        failCount: 0,
        flakinessScore: 0,
      });

      const result = await service.resetMetrics(mockFlakyTest.id);

      expect(result.totalRuns).toBe(0);
      expect(result.flakinessScore).toBe(0);
    });
  });
});

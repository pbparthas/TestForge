/**
 * Quality Gate Service Unit Tests
 * Sprint 17: Tests for quality gate creation, evaluation, and project summaries
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// All mocks must be hoisted
const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    qualityGate: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    qualityGateCondition: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    qualityGateEvaluation: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    execution: {
      findUnique: vi.fn(),
    },
    executionResult: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    requirement: {
      count: vi.fn(),
    },
    flakyTest: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock('../../../src/utils/prisma.js', () => ({ prisma: mockPrisma }));

import { QualityGateService } from '../../../src/services/qualitygate.service.js';
import { NotFoundError } from '../../../src/errors/index.js';

describe('QualityGateService', () => {
  let service: QualityGateService;

  const mockProject = { id: 'project-123', name: 'Test Project' };
  const mockUser = { id: 'user-123' };

  const mockConditions = [
    {
      id: 'cond-1',
      qualityGateId: 'gate-123',
      metric: 'pass_rate' as const,
      operator: 'gte',
      threshold: 80,
      severity: 'error',
      description: 'Pass rate must be at least 80%',
      orderIndex: 0,
    },
    {
      id: 'cond-2',
      qualityGateId: 'gate-123',
      metric: 'coverage' as const,
      operator: 'gte',
      threshold: 70,
      severity: 'warning',
      description: 'Coverage should be at least 70%',
      orderIndex: 1,
    },
  ];

  const mockQualityGate = {
    id: 'gate-123',
    projectId: mockProject.id,
    name: 'Default Quality Gate',
    description: 'Standard quality checks',
    isDefault: true,
    isActive: true,
    failOnBreach: true,
    createdById: mockUser.id,
    createdAt: new Date(),
    updatedAt: new Date(),
    conditions: mockConditions,
  };

  const mockExecution = {
    id: 'exec-123',
    projectId: mockProject.id,
    status: 'completed',
    startedAt: new Date(Date.now() - 60000),
    completedAt: new Date(),
    project: mockProject,
    results: [
      { id: 'res-1', status: 'passed', testCase: { priority: 'high' } },
      { id: 'res-2', status: 'passed', testCase: { priority: 'medium' } },
      { id: 'res-3', status: 'failed', testCase: { priority: 'critical' } },
      { id: 'res-4', status: 'passed', testCase: { priority: 'low' } },
    ],
  };

  const mockEvaluation = {
    id: 'eval-123',
    qualityGateId: 'gate-123',
    executionId: 'exec-123',
    projectId: mockProject.id,
    status: 'passed',
    results: [],
    summary: 'Quality gate passed',
    evaluatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new QualityGateService();
  });

  // ==========================================================================
  // CREATE
  // ==========================================================================

  describe('create', () => {
    it('should create a quality gate with conditions', async () => {
      mockPrisma.qualityGate.create.mockResolvedValue(mockQualityGate);

      const result = await service.create({
        projectId: mockProject.id,
        name: 'Default Quality Gate',
        description: 'Standard quality checks',
        isDefault: true,
        conditions: [
          { metric: 'pass_rate', operator: 'gte', threshold: 80, severity: 'error' },
          { metric: 'coverage', operator: 'gte', threshold: 70, severity: 'warning' },
        ],
        createdById: mockUser.id,
      });

      expect(mockPrisma.qualityGate.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          projectId: mockProject.id,
          name: 'Default Quality Gate',
          isDefault: true,
          failOnBreach: true,
          conditions: {
            create: expect.arrayContaining([
              expect.objectContaining({ metric: 'pass_rate', operator: 'gte', threshold: 80 }),
            ]),
          },
        }),
        include: { conditions: { orderBy: { orderIndex: 'asc' } } },
      });
      expect(result).toEqual(mockQualityGate);
    });

    it('should unset other defaults when creating a default gate', async () => {
      mockPrisma.qualityGate.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.qualityGate.create.mockResolvedValue(mockQualityGate);

      await service.create({
        projectId: mockProject.id,
        name: 'New Default Gate',
        isDefault: true,
        conditions: [{ metric: 'pass_rate', operator: 'gte', threshold: 90 }],
      });

      expect(mockPrisma.qualityGate.updateMany).toHaveBeenCalledWith({
        where: { projectId: mockProject.id, isDefault: true },
        data: { isDefault: false },
      });
    });

    it('should not unset defaults when creating non-default gate', async () => {
      mockPrisma.qualityGate.create.mockResolvedValue({ ...mockQualityGate, isDefault: false });

      await service.create({
        projectId: mockProject.id,
        name: 'Secondary Gate',
        isDefault: false,
        conditions: [{ metric: 'pass_rate', operator: 'gte', threshold: 70 }],
      });

      expect(mockPrisma.qualityGate.updateMany).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // UPDATE
  // ==========================================================================

  describe('update', () => {
    it('should update a quality gate', async () => {
      mockPrisma.qualityGate.findUnique.mockResolvedValue(mockQualityGate);
      mockPrisma.qualityGate.update.mockResolvedValue({
        ...mockQualityGate,
        name: 'Updated Gate',
      });

      const result = await service.update('gate-123', {
        name: 'Updated Gate',
      });

      expect(mockPrisma.qualityGate.update).toHaveBeenCalledWith({
        where: { id: 'gate-123' },
        data: expect.objectContaining({ name: 'Updated Gate' }),
        include: { conditions: { orderBy: { orderIndex: 'asc' } } },
      });
      expect(result.name).toBe('Updated Gate');
    });

    it('should replace conditions when provided', async () => {
      mockPrisma.qualityGate.findUnique.mockResolvedValue(mockQualityGate);
      mockPrisma.qualityGateCondition.deleteMany.mockResolvedValue({ count: 2 });
      mockPrisma.qualityGateCondition.createMany.mockResolvedValue({ count: 1 });
      mockPrisma.qualityGate.update.mockResolvedValue(mockQualityGate);

      await service.update('gate-123', {
        conditions: [{ metric: 'flakiness', operator: 'lte', threshold: 10 }],
      });

      expect(mockPrisma.qualityGateCondition.deleteMany).toHaveBeenCalledWith({
        where: { qualityGateId: 'gate-123' },
      });
      expect(mockPrisma.qualityGateCondition.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ metric: 'flakiness', operator: 'lte', threshold: 10 }),
        ]),
      });
    });

    it('should throw NotFoundError for invalid gate', async () => {
      mockPrisma.qualityGate.findUnique.mockResolvedValue(null);

      await expect(service.update('invalid', { name: 'Test' })).rejects.toThrow(NotFoundError);
    });

    it('should unset other defaults when setting as default', async () => {
      mockPrisma.qualityGate.findUnique.mockResolvedValue({ ...mockQualityGate, isDefault: false });
      mockPrisma.qualityGate.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.qualityGate.update.mockResolvedValue(mockQualityGate);

      await service.update('gate-123', { isDefault: true });

      expect(mockPrisma.qualityGate.updateMany).toHaveBeenCalledWith({
        where: { projectId: mockProject.id, isDefault: true, id: { not: 'gate-123' } },
        data: { isDefault: false },
      });
    });
  });

  // ==========================================================================
  // FIND BY ID
  // ==========================================================================

  describe('findById', () => {
    it('should return quality gate with conditions', async () => {
      mockPrisma.qualityGate.findUnique.mockResolvedValue(mockQualityGate);

      const result = await service.findById('gate-123');

      expect(mockPrisma.qualityGate.findUnique).toHaveBeenCalledWith({
        where: { id: 'gate-123' },
        include: { conditions: { orderBy: { orderIndex: 'asc' } } },
      });
      expect(result).toEqual(mockQualityGate);
      expect(result.conditions).toHaveLength(2);
    });

    it('should throw NotFoundError for invalid gate', async () => {
      mockPrisma.qualityGate.findUnique.mockResolvedValue(null);

      await expect(service.findById('invalid')).rejects.toThrow(NotFoundError);
    });
  });

  // ==========================================================================
  // FIND ALL
  // ==========================================================================

  describe('findAll', () => {
    it('should return paginated quality gates', async () => {
      mockPrisma.qualityGate.findMany.mockResolvedValue([mockQualityGate]);
      mockPrisma.qualityGate.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.totalPages).toBe(1);
    });

    it('should filter by projectId', async () => {
      mockPrisma.qualityGate.findMany.mockResolvedValue([mockQualityGate]);
      mockPrisma.qualityGate.count.mockResolvedValue(1);

      await service.findAll({ page: 1, limit: 10, projectId: mockProject.id });

      expect(mockPrisma.qualityGate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { projectId: mockProject.id },
        })
      );
    });

    it('should filter by isActive status', async () => {
      mockPrisma.qualityGate.findMany.mockResolvedValue([mockQualityGate]);
      mockPrisma.qualityGate.count.mockResolvedValue(1);

      await service.findAll({ page: 1, limit: 10, isActive: true });

      expect(mockPrisma.qualityGate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true },
        })
      );
    });
  });

  // ==========================================================================
  // FIND BY PROJECT
  // ==========================================================================

  describe('findByProject', () => {
    it('should return all quality gates for a project', async () => {
      mockPrisma.qualityGate.findMany.mockResolvedValue([mockQualityGate]);

      const result = await service.findByProject(mockProject.id);

      expect(mockPrisma.qualityGate.findMany).toHaveBeenCalledWith({
        where: { projectId: mockProject.id },
        include: { conditions: { orderBy: { orderIndex: 'asc' } } },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toHaveLength(1);
    });
  });

  // ==========================================================================
  // FIND DEFAULT
  // ==========================================================================

  describe('findDefault', () => {
    it('should return default quality gate for project', async () => {
      mockPrisma.qualityGate.findFirst.mockResolvedValue(mockQualityGate);

      const result = await service.findDefault(mockProject.id);

      expect(mockPrisma.qualityGate.findFirst).toHaveBeenCalledWith({
        where: { projectId: mockProject.id, isDefault: true, isActive: true },
        include: { conditions: { orderBy: { orderIndex: 'asc' } } },
      });
      expect(result).toEqual(mockQualityGate);
    });

    it('should return null when no default exists', async () => {
      mockPrisma.qualityGate.findFirst.mockResolvedValue(null);

      const result = await service.findDefault(mockProject.id);

      expect(result).toBeNull();
    });
  });

  // ==========================================================================
  // DELETE
  // ==========================================================================

  describe('delete', () => {
    it('should delete a quality gate', async () => {
      mockPrisma.qualityGate.findUnique.mockResolvedValue(mockQualityGate);
      mockPrisma.qualityGate.delete.mockResolvedValue(mockQualityGate);

      await service.delete('gate-123');

      expect(mockPrisma.qualityGate.delete).toHaveBeenCalledWith({
        where: { id: 'gate-123' },
      });
    });

    it('should throw NotFoundError for invalid gate', async () => {
      mockPrisma.qualityGate.findUnique.mockResolvedValue(null);

      await expect(service.delete('invalid')).rejects.toThrow(NotFoundError);
    });
  });

  // ==========================================================================
  // SET DEFAULT
  // ==========================================================================

  describe('setDefault', () => {
    it('should set a gate as default and unset others', async () => {
      mockPrisma.qualityGate.findUnique.mockResolvedValue({ ...mockQualityGate, isDefault: false });
      mockPrisma.qualityGate.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.qualityGate.update.mockResolvedValue(mockQualityGate);

      const result = await service.setDefault('gate-123');

      expect(mockPrisma.qualityGate.updateMany).toHaveBeenCalledWith({
        where: { projectId: mockProject.id, isDefault: true },
        data: { isDefault: false },
      });
      expect(mockPrisma.qualityGate.update).toHaveBeenCalledWith({
        where: { id: 'gate-123' },
        data: { isDefault: true },
        include: { conditions: { orderBy: { orderIndex: 'asc' } } },
      });
      expect(result.isDefault).toBe(true);
    });

    it('should throw NotFoundError for invalid gate', async () => {
      mockPrisma.qualityGate.findUnique.mockResolvedValue(null);

      await expect(service.setDefault('invalid')).rejects.toThrow(NotFoundError);
    });
  });

  // ==========================================================================
  // EVALUATE
  // ==========================================================================

  describe('evaluate', () => {
    beforeEach(() => {
      // Setup common mocks for evaluate tests
      mockPrisma.executionResult.findMany.mockResolvedValue(mockExecution.results);
      mockPrisma.requirement.count.mockResolvedValue(10);
      mockPrisma.flakyTest.findFirst.mockResolvedValue(null);
      mockPrisma.executionResult.count.mockResolvedValue(1);
    });

    it('should evaluate execution against quality gate and pass', async () => {
      mockPrisma.execution.findUnique.mockResolvedValue(mockExecution);
      mockPrisma.qualityGate.findUnique.mockResolvedValue(mockQualityGate);
      mockPrisma.qualityGateEvaluation.upsert.mockResolvedValue(mockEvaluation);

      // Mock pass rate calculation: 3 passed, 1 failed = 75%
      // With threshold 80%, this should fail the pass_rate condition
      const gateWith70Threshold = {
        ...mockQualityGate,
        conditions: [
          { ...mockConditions[0], threshold: 70 }, // 70% pass rate threshold
          mockConditions[1],
        ],
      };
      mockPrisma.qualityGate.findUnique.mockResolvedValue(gateWith70Threshold);

      const result = await service.evaluate({
        executionId: 'exec-123',
        qualityGateId: 'gate-123',
      });

      expect(result.executionId).toBe('exec-123');
      expect(result.qualityGateName).toBe('Default Quality Gate');
      expect(result.conditionResults).toHaveLength(2);
    });

    it('should use default quality gate when none specified', async () => {
      mockPrisma.execution.findUnique.mockResolvedValue(mockExecution);
      mockPrisma.qualityGate.findFirst.mockResolvedValue(mockQualityGate);
      mockPrisma.qualityGateEvaluation.upsert.mockResolvedValue(mockEvaluation);

      await service.evaluate({ executionId: 'exec-123' });

      expect(mockPrisma.qualityGate.findFirst).toHaveBeenCalledWith({
        where: { projectId: mockProject.id, isDefault: true, isActive: true },
        include: { conditions: { orderBy: { orderIndex: 'asc' } } },
      });
    });

    it('should return skipped status when no quality gate configured', async () => {
      mockPrisma.execution.findUnique.mockResolvedValue(mockExecution);
      mockPrisma.qualityGate.findFirst.mockResolvedValue(null);

      const result = await service.evaluate({ executionId: 'exec-123' });

      expect(result.status).toBe('skipped');
      expect(result.overallPassed).toBe(true);
      expect(result.summary).toBe('No quality gate configured for this project');
    });

    it('should throw NotFoundError for invalid execution', async () => {
      mockPrisma.execution.findUnique.mockResolvedValue(null);

      await expect(
        service.evaluate({ executionId: 'invalid' })
      ).rejects.toThrow(NotFoundError);
    });

    it('should calculate metrics and store evaluation', async () => {
      mockPrisma.execution.findUnique.mockResolvedValue(mockExecution);
      mockPrisma.qualityGate.findUnique.mockResolvedValue(mockQualityGate);
      mockPrisma.qualityGateEvaluation.upsert.mockResolvedValue(mockEvaluation);

      await service.evaluate({
        executionId: 'exec-123',
        qualityGateId: 'gate-123',
      });

      expect(mockPrisma.qualityGateEvaluation.upsert).toHaveBeenCalledWith({
        where: {
          qualityGateId_executionId: {
            qualityGateId: 'gate-123',
            executionId: 'exec-123',
          },
        },
        create: expect.objectContaining({
          qualityGateId: 'gate-123',
          executionId: 'exec-123',
          projectId: mockProject.id,
        }),
        update: expect.objectContaining({
          evaluatedAt: expect.any(Date),
        }),
      });
    });
  });

  // ==========================================================================
  // GET EVALUATION
  // ==========================================================================

  describe('getEvaluation', () => {
    it('should return evaluation by execution and gate ID', async () => {
      mockPrisma.qualityGateEvaluation.findUnique.mockResolvedValue(mockEvaluation);

      const result = await service.getEvaluation('exec-123', 'gate-123');

      expect(mockPrisma.qualityGateEvaluation.findUnique).toHaveBeenCalledWith({
        where: { qualityGateId_executionId: { qualityGateId: 'gate-123', executionId: 'exec-123' } },
      });
      expect(result).toEqual(mockEvaluation);
    });

    it('should return latest evaluation when gate ID not specified', async () => {
      mockPrisma.qualityGateEvaluation.findFirst.mockResolvedValue(mockEvaluation);

      const result = await service.getEvaluation('exec-123');

      expect(mockPrisma.qualityGateEvaluation.findFirst).toHaveBeenCalledWith({
        where: { executionId: 'exec-123' },
        orderBy: { evaluatedAt: 'desc' },
      });
      expect(result).toEqual(mockEvaluation);
    });
  });

  // ==========================================================================
  // GET EXECUTION EVALUATIONS
  // ==========================================================================

  describe('getExecutionEvaluations', () => {
    it('should return all evaluations for an execution', async () => {
      mockPrisma.qualityGateEvaluation.findMany.mockResolvedValue([mockEvaluation]);

      const result = await service.getExecutionEvaluations('exec-123');

      expect(mockPrisma.qualityGateEvaluation.findMany).toHaveBeenCalledWith({
        where: { executionId: 'exec-123' },
        include: { qualityGate: true },
        orderBy: { evaluatedAt: 'desc' },
      });
      expect(result).toHaveLength(1);
    });
  });

  // ==========================================================================
  // GET PROJECT SUMMARY
  // ==========================================================================

  describe('getProjectSummary', () => {
    it('should return summary with trend analysis', async () => {
      const evaluations = [
        { ...mockEvaluation, status: 'passed', results: [] },
        { ...mockEvaluation, id: 'eval-2', status: 'failed', results: [] },
        { ...mockEvaluation, id: 'eval-3', status: 'passed', results: [] },
        { ...mockEvaluation, id: 'eval-4', status: 'warning', results: [] },
      ];
      mockPrisma.qualityGateEvaluation.findMany.mockResolvedValue(evaluations);

      const result = await service.getProjectSummary(mockProject.id);

      expect(result.projectId).toBe(mockProject.id);
      expect(result.totalEvaluations).toBe(4);
      expect(result.passedCount).toBe(2);
      expect(result.failedCount).toBe(1);
      expect(result.warningCount).toBe(1);
      expect(result.passRate).toBe(50);
      expect(['improving', 'declining', 'stable']).toContain(result.recentTrend);
    });

    it('should calculate top failing conditions', async () => {
      const evaluations = [
        {
          ...mockEvaluation,
          status: 'failed',
          results: [
            { metric: 'pass_rate', passed: false, severity: 'error' },
            { metric: 'coverage', passed: false, severity: 'error' },
          ],
        },
        {
          ...mockEvaluation,
          id: 'eval-2',
          status: 'failed',
          results: [{ metric: 'pass_rate', passed: false, severity: 'error' }],
        },
      ];
      mockPrisma.qualityGateEvaluation.findMany.mockResolvedValue(evaluations);

      const result = await service.getProjectSummary(mockProject.id);

      expect(result.topFailingConditions).toBeDefined();
      expect(result.topFailingConditions.length).toBeGreaterThan(0);
      expect(result.topFailingConditions[0].metric).toBe('pass_rate');
      expect(result.topFailingConditions[0].failCount).toBe(2);
    });

    it('should return zero passRate for no evaluations', async () => {
      mockPrisma.qualityGateEvaluation.findMany.mockResolvedValue([]);

      const result = await service.getProjectSummary(mockProject.id);

      expect(result.totalEvaluations).toBe(0);
      expect(result.passRate).toBe(0);
    });

    it('should use custom days parameter', async () => {
      mockPrisma.qualityGateEvaluation.findMany.mockResolvedValue([]);

      await service.getProjectSummary(mockProject.id, 7);

      expect(mockPrisma.qualityGateEvaluation.findMany).toHaveBeenCalledWith({
        where: {
          projectId: mockProject.id,
          evaluatedAt: { gte: expect.any(Date) },
        },
        orderBy: { evaluatedAt: 'asc' },
      });
    });
  });
});

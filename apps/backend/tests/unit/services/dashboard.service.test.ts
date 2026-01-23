/**
 * Dashboard Service Tests (TDD - RED phase)
 * Tests for executive dashboard aggregation operations
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { DashboardMetric, DashboardSnapshot, MetricType, MetricPeriod } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

// Mock Prisma client - must be hoisted with vi.hoisted
const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    dashboardMetric: {
      create: vi.fn(),
      createMany: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
    dashboardSnapshot: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    execution: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    executionResult: {
      count: vi.fn(),
      groupBy: vi.fn(),
    },
    testCase: {
      count: vi.fn(),
    },
    bug: {
      count: vi.fn(),
    },
    flakyTest: {
      count: vi.fn(),
    },
    aiUsage: {
      aggregate: vi.fn(),
    },
    project: {
      count: vi.fn(),
    },
  },
}));

vi.mock('../../../src/utils/prisma.js', () => ({
  prisma: mockPrisma,
}));

// Import after mocking
import { DashboardService } from '../../../src/services/dashboard.service.js';

describe('DashboardService', () => {
  let dashboardService: DashboardService;

  const mockMetric: DashboardMetric = {
    id: 'metric-123',
    projectId: 'project-123',
    name: 'pass_rate',
    type: 'percentage' as MetricType,
    value: new Decimal(85.5),
    previousValue: new Decimal(80.0),
    changePercent: new Decimal(6.88),
    period: 'daily' as MetricPeriod,
    periodStart: new Date('2026-01-22'),
    periodEnd: new Date('2026-01-23'),
    metadata: null,
    createdAt: new Date(),
  };

  const mockSnapshot: DashboardSnapshot = {
    id: 'snapshot-123',
    projectId: 'project-123',
    snapshotAt: new Date(),
    data: {
      metrics: [],
      summary: {},
    },
    createdById: 'user-123',
    createdAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    dashboardService = new DashboardService();
  });

  describe('recordMetric', () => {
    it('should create a metric', async () => {
      mockPrisma.dashboardMetric.create.mockResolvedValue(mockMetric);

      const result = await dashboardService.recordMetric({
        projectId: 'project-123',
        name: 'pass_rate',
        type: 'percentage',
        value: 85.5,
        period: 'daily',
        periodStart: new Date('2026-01-22'),
        periodEnd: new Date('2026-01-23'),
      });

      expect(result.name).toBe('pass_rate');
      expect(Number(result.value)).toBe(85.5);
    });

    it('should calculate change percent when previous value provided', async () => {
      mockPrisma.dashboardMetric.create.mockResolvedValue(mockMetric);

      await dashboardService.recordMetric({
        projectId: 'project-123',
        name: 'pass_rate',
        type: 'percentage',
        value: 85.5,
        previousValue: 80.0,
        period: 'daily',
        periodStart: new Date('2026-01-22'),
        periodEnd: new Date('2026-01-23'),
      });

      const createCall = mockPrisma.dashboardMetric.create.mock.calls[0]?.[0];
      expect(createCall?.data?.changePercent).toBeDefined();
    });
  });

  describe('getMetrics', () => {
    it('should return metrics with filters', async () => {
      mockPrisma.dashboardMetric.findMany.mockResolvedValue([mockMetric]);

      const result = await dashboardService.getMetrics({
        projectId: 'project-123',
        period: 'daily',
      });

      expect(result).toHaveLength(1);
      expect(mockPrisma.dashboardMetric.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            projectId: 'project-123',
            period: 'daily',
          }),
        })
      );
    });

    it('should filter by date range', async () => {
      mockPrisma.dashboardMetric.findMany.mockResolvedValue([mockMetric]);

      const startDate = new Date('2026-01-01');
      const endDate = new Date('2026-01-31');

      await dashboardService.getMetrics({
        startDate,
        endDate,
      });

      expect(mockPrisma.dashboardMetric.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            periodStart: { gte: startDate },
            periodEnd: { lte: endDate },
          }),
        })
      );
    });
  });

  describe('getMetricByName', () => {
    it('should return latest metric by name', async () => {
      mockPrisma.dashboardMetric.findMany.mockResolvedValue([mockMetric]);

      const result = await dashboardService.getMetricByName('pass_rate', 'project-123');

      expect(result?.name).toBe('pass_rate');
    });
  });

  describe('createSnapshot', () => {
    it('should create a dashboard snapshot', async () => {
      mockPrisma.dashboardSnapshot.create.mockResolvedValue(mockSnapshot);

      const result = await dashboardService.createSnapshot({
        projectId: 'project-123',
        data: { metrics: [], summary: {} },
        createdById: 'user-123',
      });

      expect(result.projectId).toBe('project-123');
    });
  });

  describe('getSnapshots', () => {
    it('should return snapshots for a project', async () => {
      mockPrisma.dashboardSnapshot.findMany.mockResolvedValue([mockSnapshot]);

      const result = await dashboardService.getSnapshots('project-123');

      expect(result).toHaveLength(1);
    });
  });

  describe('getLatestSnapshot', () => {
    it('should return latest snapshot', async () => {
      mockPrisma.dashboardSnapshot.findMany.mockResolvedValue([mockSnapshot]);

      const result = await dashboardService.getLatestSnapshot('project-123');

      expect(result).toEqual(mockSnapshot);
    });
  });

  describe('calculatePassRate', () => {
    it('should calculate pass rate from execution results', async () => {
      mockPrisma.executionResult.count.mockResolvedValueOnce(100); // total
      mockPrisma.executionResult.count.mockResolvedValueOnce(85); // passed

      const result = await dashboardService.calculatePassRate('project-123');

      expect(result).toBe(85);
    });

    it('should return 0 when no results', async () => {
      mockPrisma.executionResult.count.mockResolvedValue(0);

      const result = await dashboardService.calculatePassRate('project-123');

      expect(result).toBe(0);
    });
  });

  describe('calculateTestCoverage', () => {
    it('should calculate test coverage', async () => {
      mockPrisma.testCase.count.mockResolvedValueOnce(100); // total
      mockPrisma.testCase.count.mockResolvedValueOnce(80); // with requirement

      const result = await dashboardService.calculateTestCoverage('project-123');

      expect(result).toBe(80);
    });
  });

  describe('calculateFlakinessScore', () => {
    it('should calculate average flakiness score', async () => {
      mockPrisma.flakyTest.count.mockResolvedValue(10);
      mockPrisma.testCase.count.mockResolvedValue(100);

      const result = await dashboardService.calculateFlakinessScore('project-123');

      expect(result).toBe(10); // 10% flaky
    });
  });

  describe('getExecutionSummary', () => {
    it('should return execution summary', async () => {
      mockPrisma.execution.count.mockResolvedValue(50);
      mockPrisma.executionResult.groupBy.mockResolvedValue([
        { status: 'passed', _count: { status: 40 } },
        { status: 'failed', _count: { status: 10 } },
      ]);

      const result = await dashboardService.getExecutionSummary('project-123');

      expect(result.totalExecutions).toBe(50);
      expect(result.resultsByStatus.passed).toBe(40);
      expect(result.resultsByStatus.failed).toBe(10);
    });
  });

  describe('getAICostSummary', () => {
    it('should return AI cost summary', async () => {
      mockPrisma.aiUsage.aggregate.mockResolvedValue({
        _sum: {
          costUsd: new Decimal(150.50),
          inputTokens: 1000000,
          outputTokens: 500000,
        },
        _count: { id: 500 },
      });

      const result = await dashboardService.getAICostSummary('project-123');

      expect(result.totalCostUsd).toBe(150.5);
      expect(result.totalRequests).toBe(500);
    });
  });

  describe('generateDashboardData', () => {
    it('should generate complete dashboard data', async () => {
      // Mock all the required calls
      mockPrisma.executionResult.count.mockResolvedValue(100);
      mockPrisma.testCase.count.mockResolvedValue(100);
      mockPrisma.flakyTest.count.mockResolvedValue(5);
      mockPrisma.execution.count.mockResolvedValue(50);
      mockPrisma.executionResult.groupBy.mockResolvedValue([]);
      mockPrisma.aiUsage.aggregate.mockResolvedValue({
        _sum: { costUsd: new Decimal(100), inputTokens: 1000, outputTokens: 500 },
        _count: { id: 100 },
      });
      mockPrisma.bug.count.mockResolvedValue(10);

      const result = await dashboardService.generateDashboardData('project-123');

      expect(result).toHaveProperty('passRate');
      expect(result).toHaveProperty('testCoverage');
      expect(result).toHaveProperty('flakinessScore');
      expect(result).toHaveProperty('executionSummary');
      expect(result).toHaveProperty('aiCostSummary');
    });
  });

  describe('getTrendData', () => {
    it('should return trend data for a metric', async () => {
      const metrics = [
        { ...mockMetric, periodStart: new Date('2026-01-20'), value: new Decimal(80) },
        { ...mockMetric, periodStart: new Date('2026-01-21'), value: new Decimal(82) },
        { ...mockMetric, periodStart: new Date('2026-01-22'), value: new Decimal(85) },
      ];
      mockPrisma.dashboardMetric.findMany.mockResolvedValue(metrics);

      const result = await dashboardService.getTrendData('pass_rate', 'project-123', 7);

      expect(result).toHaveLength(3);
    });
  });

  describe('cleanupOldMetrics', () => {
    it('should delete old metrics', async () => {
      mockPrisma.dashboardMetric.deleteMany.mockResolvedValue({ count: 100 });

      const result = await dashboardService.cleanupOldMetrics(90);

      expect(result).toBe(100);
    });
  });

  describe('getGlobalSummary', () => {
    it('should return global summary across all projects', async () => {
      mockPrisma.project.count.mockResolvedValue(10);
      mockPrisma.testCase.count.mockResolvedValue(1000);
      mockPrisma.execution.count.mockResolvedValue(500);
      mockPrisma.bug.count.mockResolvedValue(50);

      const result = await dashboardService.getGlobalSummary();

      expect(result.totalProjects).toBe(10);
      expect(result.totalTestCases).toBe(1000);
      expect(result.totalExecutions).toBe(500);
      expect(result.totalBugs).toBe(50);
    });
  });
});

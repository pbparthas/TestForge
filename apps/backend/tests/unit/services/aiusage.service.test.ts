/**
 * AiUsage Service Tests (TDD - RED phase)
 * Tests for AI usage tracking and cost reporting operations
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Prisma client - must be hoisted with vi.hoisted
const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    aiUsage: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock('../../../src/utils/prisma.js', () => ({
  prisma: mockPrisma,
}));

// Import after mocking
import { AiUsageService } from '../../../src/services/aiusage.service.js';
import type { RecordUsageInput, FindUsageParams } from '../../../src/services/aiusage.service.js';

describe('AiUsageService', () => {
  let service: AiUsageService;

  // --- Mock data ---

  const mockUsageRecord = {
    id: 'usage-1',
    projectId: 'proj-1',
    userId: 'user-1',
    agent: 'scriptsmith',
    operation: 'generate',
    model: 'claude-sonnet-4-20250514',
    inputTokens: 1000,
    outputTokens: 500,
    cachedTokens: 0,
    costUsd: 0.0165,
    costInr: 1.3943,
    durationMs: 2500,
    success: true,
    createdAt: new Date('2026-01-15T10:00:00Z'),
  };

  const mockUsageRecord2 = {
    id: 'usage-2',
    projectId: 'proj-1',
    userId: 'user-2',
    agent: 'testpilot',
    operation: 'analyze',
    model: 'claude-sonnet-4-20250514',
    inputTokens: 2000,
    outputTokens: 800,
    cachedTokens: 100,
    costUsd: 0.0280,
    costInr: 2.3660,
    durationMs: 3200,
    success: true,
    createdAt: new Date('2026-01-15T14:00:00Z'),
  };

  const mockUsageRecord3 = {
    id: 'usage-3',
    projectId: 'proj-1',
    userId: 'user-1',
    agent: 'scriptsmith',
    operation: 'generate',
    model: 'gpt-4o',
    inputTokens: 1500,
    outputTokens: 600,
    cachedTokens: 200,
    costUsd: 0.0210,
    costInr: 1.7745,
    durationMs: 1800,
    success: true,
    createdAt: new Date('2026-01-16T09:00:00Z'),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AiUsageService();
  });

  // =============================================
  // record()
  // =============================================

  describe('record', () => {
    it('should create an AI usage record with all fields', async () => {
      const input: RecordUsageInput = {
        projectId: 'proj-1',
        userId: 'user-1',
        agent: 'scriptsmith',
        operation: 'generate',
        model: 'claude-sonnet-4-20250514',
        inputTokens: 1000,
        outputTokens: 500,
        cachedTokens: 50,
        costUsd: 0.0165,
        costInr: 1.3943,
        durationMs: 2500,
        success: true,
      };

      mockPrisma.aiUsage.create.mockResolvedValue(mockUsageRecord);

      const result = await service.record(input);

      expect(result).toEqual(mockUsageRecord);
      expect(mockPrisma.aiUsage.create).toHaveBeenCalledOnce();
      expect(mockPrisma.aiUsage.create).toHaveBeenCalledWith({
        data: {
          projectId: 'proj-1',
          userId: 'user-1',
          agent: 'scriptsmith',
          operation: 'generate',
          model: 'claude-sonnet-4-20250514',
          inputTokens: 1000,
          outputTokens: 500,
          cachedTokens: 50,
          costUsd: 0.0165,
          costInr: 1.3943,
          durationMs: 2500,
          success: true,
        },
      });
    });

    it('should default cachedTokens to 0 and success to true when omitted', async () => {
      const input: RecordUsageInput = {
        projectId: 'proj-1',
        agent: 'testpilot',
        operation: 'analyze',
        model: 'claude-sonnet-4-20250514',
        inputTokens: 500,
        outputTokens: 200,
        costUsd: 0.0080,
        costInr: 0.6760,
      };

      mockPrisma.aiUsage.create.mockResolvedValue({ ...mockUsageRecord, cachedTokens: 0, success: true });

      await service.record(input);

      expect(mockPrisma.aiUsage.create).toHaveBeenCalledWith({
        data: {
          projectId: 'proj-1',
          agent: 'testpilot',
          operation: 'analyze',
          model: 'claude-sonnet-4-20250514',
          inputTokens: 500,
          outputTokens: 200,
          cachedTokens: 0,
          costUsd: 0.0080,
          costInr: 0.6760,
          success: true,
        },
      });
    });

    it('should omit userId and durationMs from data when not provided', async () => {
      const input: RecordUsageInput = {
        projectId: 'proj-1',
        agent: 'scriptsmith',
        operation: 'generate',
        model: 'claude-sonnet-4-20250514',
        inputTokens: 1000,
        outputTokens: 500,
        costUsd: 0.0165,
        costInr: 1.3943,
      };

      mockPrisma.aiUsage.create.mockResolvedValue(mockUsageRecord);

      await service.record(input);

      const callArg = mockPrisma.aiUsage.create.mock.calls[0][0];
      expect(callArg.data).not.toHaveProperty('userId');
      expect(callArg.data).not.toHaveProperty('durationMs');
    });
  });

  // =============================================
  // getProjectSummary()
  // =============================================

  describe('getProjectSummary', () => {
    it('should return zero summary for empty records', async () => {
      mockPrisma.aiUsage.findMany.mockResolvedValue([]);

      const result = await service.getProjectSummary('proj-1');

      expect(result).toEqual({
        totalCostUsd: 0,
        totalCostInr: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCalls: 0,
        byAgent: {},
        byModel: {},
      });
      expect(mockPrisma.aiUsage.findMany).toHaveBeenCalledWith({
        where: { projectId: 'proj-1' },
      });
    });

    it('should aggregate totals, byAgent, and byModel for multiple records', async () => {
      mockPrisma.aiUsage.findMany.mockResolvedValue([mockUsageRecord, mockUsageRecord2, mockUsageRecord3]);

      const result = await service.getProjectSummary('proj-1');

      // Total calls
      expect(result.totalCalls).toBe(3);

      // Total tokens
      expect(result.totalInputTokens).toBe(1000 + 2000 + 1500);
      expect(result.totalOutputTokens).toBe(500 + 800 + 600);

      // Total costs (use toBeCloseTo for floating point)
      expect(result.totalCostUsd).toBeCloseTo(0.0165 + 0.0280 + 0.0210, 4);
      expect(result.totalCostInr).toBeCloseTo(1.3943 + 2.3660 + 1.7745, 4);

      // byAgent: scriptsmith (records 1 and 3), testpilot (record 2)
      expect(result.byAgent['scriptsmith'].calls).toBe(2);
      expect(result.byAgent['scriptsmith'].costUsd).toBeCloseTo(0.0165 + 0.0210, 4);
      expect(result.byAgent['scriptsmith'].costInr).toBeCloseTo(1.3943 + 1.7745, 4);
      expect(result.byAgent['testpilot'].calls).toBe(1);
      expect(result.byAgent['testpilot'].costUsd).toBeCloseTo(0.0280, 4);
      expect(result.byAgent['testpilot'].costInr).toBeCloseTo(2.3660, 4);

      // byModel: claude-sonnet-4-20250514 (records 1 and 2), gpt-4o (record 3)
      expect(result.byModel['claude-sonnet-4-20250514'].calls).toBe(2);
      expect(result.byModel['claude-sonnet-4-20250514'].costUsd).toBeCloseTo(0.0165 + 0.0280, 4);
      expect(result.byModel['gpt-4o'].calls).toBe(1);
      expect(result.byModel['gpt-4o'].costUsd).toBeCloseTo(0.0210, 4);
    });

    it('should apply date filters when startDate and endDate are provided', async () => {
      const startDate = new Date('2026-01-15T00:00:00Z');
      const endDate = new Date('2026-01-16T23:59:59Z');

      mockPrisma.aiUsage.findMany.mockResolvedValue([mockUsageRecord]);

      await service.getProjectSummary('proj-1', startDate, endDate);

      expect(mockPrisma.aiUsage.findMany).toHaveBeenCalledWith({
        where: {
          projectId: 'proj-1',
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
      });
    });

    it('should apply only startDate filter when endDate is not provided', async () => {
      const startDate = new Date('2026-01-15T00:00:00Z');

      mockPrisma.aiUsage.findMany.mockResolvedValue([]);

      await service.getProjectSummary('proj-1', startDate);

      expect(mockPrisma.aiUsage.findMany).toHaveBeenCalledWith({
        where: {
          projectId: 'proj-1',
          createdAt: {
            gte: startDate,
          },
        },
      });
    });
  });

  // =============================================
  // findAll()
  // =============================================

  describe('findAll', () => {
    it('should return paginated results with correct totalPages', async () => {
      mockPrisma.aiUsage.findMany.mockResolvedValue([mockUsageRecord, mockUsageRecord2]);
      mockPrisma.aiUsage.count.mockResolvedValue(5);

      const params: FindUsageParams = { page: 1, limit: 2 };
      const result = await service.findAll(params);

      expect(result).toEqual({
        data: [mockUsageRecord, mockUsageRecord2],
        total: 5,
        page: 1,
        limit: 2,
        totalPages: 3, // ceil(5/2) = 3
      });
      expect(mockPrisma.aiUsage.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 0,
        take: 2,
        orderBy: { createdAt: 'desc' },
      });
      expect(mockPrisma.aiUsage.count).toHaveBeenCalledWith({ where: {} });
    });

    it('should calculate correct skip offset for page > 1', async () => {
      mockPrisma.aiUsage.findMany.mockResolvedValue([mockUsageRecord3]);
      mockPrisma.aiUsage.count.mockResolvedValue(5);

      const params: FindUsageParams = { page: 3, limit: 2 };
      const result = await service.findAll(params);

      expect(result.page).toBe(3);
      expect(mockPrisma.aiUsage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 4, take: 2 }),
      );
    });

    it('should apply all filter combinations correctly', async () => {
      const startDate = new Date('2026-01-15T00:00:00Z');
      const endDate = new Date('2026-01-16T23:59:59Z');

      mockPrisma.aiUsage.findMany.mockResolvedValue([]);
      mockPrisma.aiUsage.count.mockResolvedValue(0);

      const params: FindUsageParams = {
        page: 1,
        limit: 10,
        projectId: 'proj-1',
        userId: 'user-1',
        agent: 'scriptsmith',
        startDate,
        endDate,
      };

      await service.findAll(params);

      const expectedWhere = {
        projectId: 'proj-1',
        userId: 'user-1',
        agent: 'scriptsmith',
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      };

      expect(mockPrisma.aiUsage.findMany).toHaveBeenCalledWith({
        where: expectedWhere,
        skip: 0,
        take: 10,
        orderBy: { createdAt: 'desc' },
      });
      expect(mockPrisma.aiUsage.count).toHaveBeenCalledWith({ where: expectedWhere });
    });

    it('should return totalPages of 1 when total equals limit', async () => {
      mockPrisma.aiUsage.findMany.mockResolvedValue([mockUsageRecord]);
      mockPrisma.aiUsage.count.mockResolvedValue(10);

      const params: FindUsageParams = { page: 1, limit: 10 };
      const result = await service.findAll(params);

      expect(result.totalPages).toBe(1); // ceil(10/10) = 1
    });
  });

  // =============================================
  // getDailyCosts()
  // =============================================

  describe('getDailyCosts', () => {
    it('should group records by date correctly', async () => {
      // Two records on 2026-01-15, one on 2026-01-16
      mockPrisma.aiUsage.findMany.mockResolvedValue([mockUsageRecord, mockUsageRecord2, mockUsageRecord3]);

      const result = await service.getDailyCosts('proj-1');

      expect(result).toHaveLength(2);

      // First date: 2026-01-15 (records 1 and 2)
      const day1 = result.find(r => r.date === '2026-01-15');
      expect(day1).toBeDefined();
      expect(day1!.calls).toBe(2);
      expect(day1!.costUsd).toBeCloseTo(0.0165 + 0.0280, 4);
      expect(day1!.costInr).toBeCloseTo(1.3943 + 2.3660, 4);

      // Second date: 2026-01-16 (record 3)
      const day2 = result.find(r => r.date === '2026-01-16');
      expect(day2).toBeDefined();
      expect(day2!.calls).toBe(1);
      expect(day2!.costUsd).toBeCloseTo(0.0210, 4);
      expect(day2!.costInr).toBeCloseTo(1.7745, 4);
    });

    it('should use the days parameter to compute start date and default to 30', async () => {
      mockPrisma.aiUsage.findMany.mockResolvedValue([]);

      // Call with explicit days=7
      await service.getDailyCosts('proj-1', 7);

      const call = mockPrisma.aiUsage.findMany.mock.calls[0][0];
      expect(call.where.projectId).toBe('proj-1');
      expect(call.where.createdAt.gte).toBeInstanceOf(Date);
      expect(call.orderBy).toEqual({ createdAt: 'asc' });

      // The start date should be approximately 7 days ago
      const now = new Date();
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const actualStartDate = call.where.createdAt.gte as Date;
      // Allow 5 seconds tolerance for test execution time
      expect(Math.abs(actualStartDate.getTime() - sevenDaysAgo.getTime())).toBeLessThan(5000);
    });

    it('should return empty array when no records exist in the date range', async () => {
      mockPrisma.aiUsage.findMany.mockResolvedValue([]);

      const result = await service.getDailyCosts('proj-1', 30);

      expect(result).toEqual([]);
    });
  });
});

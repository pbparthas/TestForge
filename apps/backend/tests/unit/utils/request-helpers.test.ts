/**
 * Tests for shared request helper utilities
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before importing
const { mockAiUsageService } = vi.hoisted(() => ({
  mockAiUsageService: {
    record: vi.fn(),
  },
}));

import { parsePagination, trackAiUsage } from '../../../src/utils/request-helpers.js';
import type { Request } from 'express';

// Helper to create a mock request with query params
function mockRequest(query: Record<string, string> = {}): Request {
  return { query } as unknown as Request;
}

describe('parsePagination', () => {
  it('should return default page=1 and limit=10 when no query params', () => {
    const result = parsePagination(mockRequest());
    expect(result).toEqual({ page: 1, limit: 10, skip: 0 });
  });

  it('should parse valid page and limit from query', () => {
    const result = parsePagination(mockRequest({ page: '3', limit: '25' }));
    expect(result).toEqual({ page: 3, limit: 25, skip: 50 });
  });

  it('should use custom defaults when provided', () => {
    const result = parsePagination(mockRequest(), { page: 1, limit: 20 });
    expect(result).toEqual({ page: 1, limit: 20, skip: 0 });
  });

  it('should fall back to defaults for non-numeric strings', () => {
    const result = parsePagination(mockRequest({ page: 'abc', limit: 'xyz' }));
    expect(result).toEqual({ page: 1, limit: 10, skip: 0 });
  });

  it('should fall back to defaults for zero values', () => {
    const result = parsePagination(mockRequest({ page: '0', limit: '0' }));
    expect(result).toEqual({ page: 1, limit: 10, skip: 0 });
  });

  it('should fall back to defaults for negative values', () => {
    const result = parsePagination(mockRequest({ page: '-1', limit: '-5' }));
    expect(result).toEqual({ page: 1, limit: 10, skip: 0 });
  });

  it('should cap limit at 100', () => {
    const result = parsePagination(mockRequest({ limit: '500' }));
    expect(result).toEqual({ page: 1, limit: 100, skip: 0 });
  });

  it('should calculate skip correctly for page 2', () => {
    const result = parsePagination(mockRequest({ page: '2', limit: '15' }));
    expect(result).toEqual({ page: 2, limit: 15, skip: 15 });
  });

  it('should calculate skip correctly for higher pages', () => {
    const result = parsePagination(mockRequest({ page: '5', limit: '20' }));
    expect(result).toEqual({ page: 5, limit: 20, skip: 80 });
  });

  it('should handle float strings by truncating', () => {
    const result = parsePagination(mockRequest({ page: '2.7', limit: '10.5' }));
    expect(result).toEqual({ page: 2, limit: 10, skip: 10 });
  });
});

describe('trackAiUsage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call service.record with mapped fields from result.usage', async () => {
    const mockResult = {
      usage: {
        model: 'claude-sonnet-4-5-20250929',
        inputTokens: 1000,
        outputTokens: 500,
        cacheReadTokens: 200,
        costUsd: 0.05,
        costInr: 4.15,
        durationMs: 3000,
      },
    };

    await trackAiUsage(mockAiUsageService as any, {
      projectId: 'proj-123',
      userId: 'user-456',
      agent: 'TestWeaver',
      operation: 'generate',
      result: mockResult as any,
    });

    expect(mockAiUsageService.record).toHaveBeenCalledWith({
      projectId: 'proj-123',
      userId: 'user-456',
      agent: 'TestWeaver',
      operation: 'generate',
      model: 'claude-sonnet-4-5-20250929',
      inputTokens: 1000,
      outputTokens: 500,
      cachedTokens: 200,
      costUsd: 0.05,
      costInr: 4.15,
      durationMs: 3000,
    });
  });

  it('should handle missing optional usage fields', async () => {
    const mockResult = {
      usage: {
        model: 'claude-sonnet-4-5-20250929',
        inputTokens: 500,
        outputTokens: 200,
        costUsd: 0.02,
        costInr: 1.66,
        durationMs: 1500,
      },
    };

    await trackAiUsage(mockAiUsageService as any, {
      projectId: 'proj-123',
      userId: 'user-456',
      agent: 'ScriptSmith',
      operation: 'edit',
      result: mockResult as any,
    });

    expect(mockAiUsageService.record).toHaveBeenCalledWith({
      projectId: 'proj-123',
      userId: 'user-456',
      agent: 'ScriptSmith',
      operation: 'edit',
      model: 'claude-sonnet-4-5-20250929',
      inputTokens: 500,
      outputTokens: 200,
      cachedTokens: undefined,
      costUsd: 0.02,
      costInr: 1.66,
      durationMs: 1500,
    });
  });

  it('should propagate errors from service.record', async () => {
    mockAiUsageService.record.mockRejectedValue(new Error('DB error'));

    const mockResult = {
      usage: {
        model: 'claude-sonnet-4-5-20250929',
        inputTokens: 100,
        outputTokens: 50,
        costUsd: 0.01,
        costInr: 0.83,
        durationMs: 500,
      },
    };

    await expect(trackAiUsage(mockAiUsageService as any, {
      projectId: 'proj-123',
      userId: 'user-456',
      agent: 'FlowPilot',
      operation: 'generate',
      result: mockResult as any,
    })).rejects.toThrow('DB error');
  });
});

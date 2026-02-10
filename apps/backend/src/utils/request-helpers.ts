/**
 * Shared request helper utilities for route handlers.
 * Reduces boilerplate across CRUD route files.
 */

import type { Request } from 'express';

interface PaginationResult {
  page: number;
  limit: number;
  skip: number;
}

interface PaginationDefaults {
  page?: number;
  limit?: number;
}

/**
 * Parse pagination parameters from request query string.
 * Returns page, limit, and calculated skip value.
 */
export function parsePagination(
  req: Request,
  defaults?: PaginationDefaults,
): PaginationResult {
  const defaultPage = defaults?.page ?? 1;
  const defaultLimit = defaults?.limit ?? 10;
  const maxLimit = 100;

  const rawPage = parseInt(req.query.page as string);
  const rawLimit = parseInt(req.query.limit as string);

  const page = rawPage > 0 ? rawPage : defaultPage;
  const limit = rawLimit > 0 ? Math.min(rawLimit, maxLimit) : defaultLimit;
  const skip = (page - 1) * limit;

  return { page, limit, skip };
}

interface AiUsageParams {
  projectId: string;
  userId: string;
  agent: string;
  operation: string;
  result: {
    usage: {
      model: string;
      inputTokens: number;
      outputTokens: number;
      cacheReadTokens?: number;
      costUsd: number;
      costInr: number;
      durationMs: number;
    };
  };
}

interface AiUsageService {
  record(data: {
    projectId: string;
    userId: string;
    agent: string;
    operation: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    cachedTokens?: number;
    costUsd: number;
    costInr: number;
    durationMs: number;
  }): Promise<unknown>;
}

/**
 * Track AI agent usage by mapping result.usage fields to the usage service.
 * Eliminates repeated aiUsageService.record() blocks across AI route handlers.
 */
export async function trackAiUsage(
  service: AiUsageService,
  params: AiUsageParams,
): Promise<void> {
  await service.record({
    projectId: params.projectId,
    userId: params.userId,
    agent: params.agent,
    operation: params.operation,
    model: params.result.usage.model,
    inputTokens: params.result.usage.inputTokens,
    outputTokens: params.result.usage.outputTokens,
    cachedTokens: params.result.usage.cacheReadTokens,
    costUsd: params.result.usage.costUsd,
    costInr: params.result.usage.costInr,
    durationMs: params.result.usage.durationMs,
  });
}

/**
 * AI Usage Service
 * Tracks and reports AI agent usage and costs
 */

import type { AiUsage, Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma.js';

export interface RecordUsageInput {
  projectId: string;
  userId?: string | undefined;
  agent: string;
  operation: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cachedTokens?: number | undefined;
  costUsd: number;
  costInr: number;
  durationMs?: number | undefined;
  success?: boolean | undefined;
}

export interface UsageSummary {
  totalCostUsd: number;
  totalCostInr: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCalls: number;
  byAgent: Record<string, { calls: number; costUsd: number; costInr: number }>;
  byModel: Record<string, { calls: number; costUsd: number; costInr: number }>;
}

export interface FindUsageParams {
  page: number;
  limit: number;
  projectId?: string | undefined;
  userId?: string | undefined;
  agent?: string | undefined;
  startDate?: Date | undefined;
  endDate?: Date | undefined;
}

export class AiUsageService {
  async record(input: RecordUsageInput): Promise<AiUsage> {
    return prisma.aiUsage.create({
      data: {
        projectId: input.projectId,
        ...(input.userId ? { userId: input.userId } : {}),
        agent: input.agent,
        operation: input.operation,
        model: input.model,
        inputTokens: input.inputTokens,
        outputTokens: input.outputTokens,
        cachedTokens: input.cachedTokens ?? 0,
        costUsd: input.costUsd,
        costInr: input.costInr,
        ...(input.durationMs ? { durationMs: input.durationMs } : {}),
        success: input.success ?? true,
      },
    });
  }

  async getProjectSummary(projectId: string, startDate?: Date, endDate?: Date): Promise<UsageSummary> {
    const where: Prisma.AiUsageWhereInput = { projectId };
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const records = await prisma.aiUsage.findMany({ where });

    const summary: UsageSummary = {
      totalCostUsd: 0,
      totalCostInr: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCalls: records.length,
      byAgent: {},
      byModel: {},
    };

    for (const record of records) {
      summary.totalCostUsd += Number(record.costUsd);
      summary.totalCostInr += Number(record.costInr);
      summary.totalInputTokens += record.inputTokens;
      summary.totalOutputTokens += record.outputTokens;

      // By agent
      if (!summary.byAgent[record.agent]) {
        summary.byAgent[record.agent] = { calls: 0, costUsd: 0, costInr: 0 };
      }
      summary.byAgent[record.agent].calls++;
      summary.byAgent[record.agent].costUsd += Number(record.costUsd);
      summary.byAgent[record.agent].costInr += Number(record.costInr);

      // By model
      if (!summary.byModel[record.model]) {
        summary.byModel[record.model] = { calls: 0, costUsd: 0, costInr: 0 };
      }
      summary.byModel[record.model].calls++;
      summary.byModel[record.model].costUsd += Number(record.costUsd);
      summary.byModel[record.model].costInr += Number(record.costInr);
    }

    return summary;
  }

  async findAll(params: FindUsageParams) {
    const { page, limit, projectId, userId, agent, startDate, endDate } = params;
    const where: Prisma.AiUsageWhereInput = {};

    if (projectId) where.projectId = projectId;
    if (userId) where.userId = userId;
    if (agent) where.agent = agent;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      prisma.aiUsage.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      prisma.aiUsage.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getDailyCosts(projectId: string, days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const records = await prisma.aiUsage.findMany({
      where: { projectId, createdAt: { gte: startDate } },
      orderBy: { createdAt: 'asc' },
    });

    const dailyCosts: Record<string, { costUsd: number; costInr: number; calls: number }> = {};

    for (const record of records) {
      const dateKey = record.createdAt.toISOString().split('T')[0];
      if (!dailyCosts[dateKey]) {
        dailyCosts[dateKey] = { costUsd: 0, costInr: 0, calls: 0 };
      }
      dailyCosts[dateKey].costUsd += Number(record.costUsd);
      dailyCosts[dateKey].costInr += Number(record.costInr);
      dailyCosts[dateKey].calls++;
    }

    return Object.entries(dailyCosts).map(([date, data]) => ({ date, ...data }));
  }
}

export const aiUsageService = new AiUsageService();

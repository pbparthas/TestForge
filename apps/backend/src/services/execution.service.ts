/**
 * Execution Service
 * Handles test execution lifecycle - trigger, run, collect results
 */

import type { Execution, ExecutionResult, ExecutionStatus, ResultStatus, TriggerType, Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma.js';
import { NotFoundError } from '../errors/index.js';
import { selfHealingAgent } from '../agents/selfhealing.agent.js';
import { logger } from '../utils/logger.js';

export interface TriggerExecutionInput {
  projectId: string;
  suiteId?: string | undefined;
  environmentId?: string | undefined;
  triggerType?: TriggerType | undefined;
  triggeredById?: string | undefined;
  testCaseIds?: string[] | undefined; // Run specific test cases instead of suite
}

export interface ExecutionWithResults extends Execution {
  results: ExecutionResult[];
}

export interface RecordResultInput {
  executionId: string;
  testCaseId?: string | undefined;
  scriptId?: string | undefined;
  status: ResultStatus;
  durationMs?: number | undefined;
  errorMessage?: string | undefined;
  errorStack?: string | undefined;
  screenshots?: string[] | undefined;
  videoUrl?: string | undefined;
  logs?: string | undefined;
}

export interface ExecutionSummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  error: number;
  passRate: number;
  totalDurationMs: number;
}

export interface FindAllParams {
  page: number;
  limit: number;
  projectId?: string | undefined;
  suiteId?: string | undefined;
  status?: ExecutionStatus | undefined;
  triggerType?: TriggerType | undefined;
}

export class ExecutionService {
  async trigger(input: TriggerExecutionInput): Promise<Execution> {
    const execution = await prisma.execution.create({
      data: {
        projectId: input.projectId,
        ...(input.suiteId ? { suiteId: input.suiteId } : {}),
        ...(input.environmentId ? { environmentId: input.environmentId } : {}),
        triggerType: input.triggerType ?? 'manual',
        ...(input.triggeredById ? { triggeredById: input.triggeredById } : {}),
        status: 'pending',
      },
    });

    logger.info({ executionId: execution.id, projectId: input.projectId }, 'Execution triggered');
    return execution;
  }

  async start(id: string): Promise<Execution> {
    const execution = await prisma.execution.findUnique({ where: { id } });
    if (!execution) throw new NotFoundError('Execution', id);

    return prisma.execution.update({
      where: { id },
      data: { status: 'running', startedAt: new Date() },
    });
  }

  async complete(id: string): Promise<Execution> {
    const execution = await prisma.execution.findUnique({
      where: { id },
      include: { results: true },
    });
    if (!execution) throw new NotFoundError('Execution', id);

    const summary = this.calculateSummary(execution.results);
    const status: ExecutionStatus = summary.failed > 0 || summary.error > 0 ? 'failed' : 'completed';

    return prisma.execution.update({
      where: { id },
      data: {
        status,
        completedAt: new Date(),
        summary: summary as unknown as Prisma.InputJsonValue,
      },
    });
  }

  async cancel(id: string): Promise<Execution> {
    const execution = await prisma.execution.findUnique({ where: { id } });
    if (!execution) throw new NotFoundError('Execution', id);

    return prisma.execution.update({
      where: { id },
      data: { status: 'cancelled', completedAt: new Date() },
    });
  }

  async findById(id: string): Promise<ExecutionWithResults> {
    const execution = await prisma.execution.findUnique({
      where: { id },
      include: { results: true, suite: true, environment: true },
    });
    if (!execution) throw new NotFoundError('Execution', id);
    return execution as ExecutionWithResults;
  }

  async findAll(params: FindAllParams) {
    const { page, limit, projectId, suiteId, status, triggerType } = params;
    const where: Prisma.ExecutionWhereInput = {};

    if (projectId) where.projectId = projectId;
    if (suiteId) where.suiteId = suiteId;
    if (status) where.status = status;
    if (triggerType) where.triggerType = triggerType;

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      prisma.execution.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { suite: true, environment: true },
      }),
      prisma.execution.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async recordResult(input: RecordResultInput): Promise<ExecutionResult> {
    return prisma.executionResult.create({
      data: {
        executionId: input.executionId,
        ...(input.testCaseId ? { testCaseId: input.testCaseId } : {}),
        ...(input.scriptId ? { scriptId: input.scriptId } : {}),
        status: input.status,
        ...(input.durationMs ? { durationMs: input.durationMs } : {}),
        ...(input.errorMessage ? { errorMessage: input.errorMessage } : {}),
        ...(input.errorStack ? { errorStack: input.errorStack } : {}),
        screenshots: (input.screenshots ?? []) as Prisma.InputJsonValue,
        ...(input.videoUrl ? { videoUrl: input.videoUrl } : {}),
        ...(input.logs ? { logs: input.logs } : {}),
      },
    });
  }

  async getResults(executionId: string): Promise<ExecutionResult[]> {
    return prisma.executionResult.findMany({
      where: { executionId },
      include: { testCase: true, script: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async retryFailed(executionId: string, triggeredById?: string): Promise<Execution> {
    const original = await this.findById(executionId);
    const failedResults = original.results.filter(r => r.status === 'failed' || r.status === 'error');

    if (failedResults.length === 0) {
      throw new Error('No failed tests to retry');
    }

    // Create new execution for retry
    const retryExecution = await this.trigger({
      projectId: original.projectId,
      suiteId: original.suiteId ?? undefined,
      environmentId: original.environmentId ?? undefined,
      triggerType: 'manual',
      triggeredById,
      testCaseIds: failedResults.map(r => r.testCaseId).filter((id): id is string => id !== null),
    });

    logger.info({ originalId: executionId, retryId: retryExecution.id }, 'Retry execution created');
    return retryExecution;
  }

  async triggerSelfHealing(resultId: string, failedCode: string): Promise<{ diagnosis: unknown; fixed: boolean }> {
    const result = await prisma.executionResult.findUnique({ where: { id: resultId } });
    if (!result) throw new NotFoundError('ExecutionResult', resultId);
    if (result.status !== 'failed') {
      throw new Error('Can only trigger self-healing for failed results');
    }

    const diagnosis = await selfHealingAgent.diagnose({
      errorMessage: result.errorMessage ?? 'Unknown error',
      errorStack: result.errorStack ?? undefined,
      failedCode,
    });

    // Mark that self-healing was attempted
    await prisma.executionResult.update({
      where: { id: resultId },
      data: { selfHealingApplied: true },
    });

    logger.info({ resultId, diagnosisType: diagnosis.data.diagnosis.type }, 'Self-healing triggered');

    return {
      diagnosis: diagnosis.data,
      fixed: diagnosis.data.suggestedFixes.some(f => f.autoApplicable && f.confidence > 80),
    };
  }

  private calculateSummary(results: ExecutionResult[]): ExecutionSummary {
    const total = results.length;
    const passed = results.filter(r => r.status === 'passed').length;
    const failed = results.filter(r => r.status === 'failed').length;
    const skipped = results.filter(r => r.status === 'skipped').length;
    const error = results.filter(r => r.status === 'error').length;
    const totalDurationMs = results.reduce((sum, r) => sum + (r.durationMs ?? 0), 0);

    return {
      total,
      passed,
      failed,
      skipped,
      error,
      passRate: total > 0 ? Math.round((passed / total) * 100) : 0,
      totalDurationMs,
    };
  }

  async getProjectStats(projectId: string, days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const executions = await prisma.execution.findMany({
      where: { projectId, createdAt: { gte: startDate } },
      include: { results: true },
    });

    const totalExecutions = executions.length;
    const completedExecutions = executions.filter(e => e.status === 'completed').length;
    const failedExecutions = executions.filter(e => e.status === 'failed').length;

    const allResults = executions.flatMap(e => e.results);
    const summary = this.calculateSummary(allResults);

    return {
      totalExecutions,
      completedExecutions,
      failedExecutions,
      ...summary,
      averagePassRate: summary.passRate,
    };
  }
}

export const executionService = new ExecutionService();

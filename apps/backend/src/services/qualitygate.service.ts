/**
 * Quality Gate Service
 * Evaluates execution results against configurable thresholds
 */

import type {
  QualityGate,
  QualityGateCondition,
  QualityGateEvaluation,
  QualityGateMetric,
  QualityGateStatus,
  Prisma,
} from '@prisma/client';
import { prisma } from '../utils/prisma.js';
import { NotFoundError, ValidationError } from '../errors/index.js';
import { logger } from '../utils/logger.js';

// ============================================================================
// INPUT TYPES
// ============================================================================

export interface CreateQualityGateInput {
  projectId: string;
  name: string;
  description?: string;
  isDefault?: boolean;
  failOnBreach?: boolean;
  conditions: CreateConditionInput[];
  createdById?: string;
}

export interface CreateConditionInput {
  metric: QualityGateMetric;
  operator: 'gte' | 'lte' | 'gt' | 'lt' | 'eq';
  threshold: number;
  severity?: 'error' | 'warning';
  description?: string;
}

export interface UpdateQualityGateInput {
  name?: string;
  description?: string;
  isDefault?: boolean;
  isActive?: boolean;
  failOnBreach?: boolean;
  conditions?: CreateConditionInput[];
}

export interface EvaluateInput {
  executionId: string;
  qualityGateId?: string;
}

export interface FindQualityGatesParams {
  page: number;
  limit: number;
  projectId?: string;
  isActive?: boolean;
}

// ============================================================================
// OUTPUT TYPES
// ============================================================================

export interface QualityGateWithConditions extends QualityGate {
  conditions: QualityGateCondition[];
}

export interface ConditionResult {
  conditionId: string;
  metric: QualityGateMetric;
  operator: string;
  threshold: number;
  actualValue: number;
  passed: boolean;
  severity: string;
  message: string;
}

export interface EvaluationResult {
  qualityGateId: string;
  qualityGateName: string;
  executionId: string;
  status: QualityGateStatus;
  overallPassed: boolean;
  conditionResults: ConditionResult[];
  summary: string;
  evaluatedAt: Date;
}

export interface QualityGateSummary {
  projectId: string;
  totalEvaluations: number;
  passedCount: number;
  failedCount: number;
  warningCount: number;
  passRate: number;
  recentTrend: 'improving' | 'declining' | 'stable';
  topFailingConditions: { metric: string; failCount: number }[];
}

// ============================================================================
// SERVICE CLASS
// ============================================================================

export class QualityGateService {
  async create(input: CreateQualityGateInput): Promise<QualityGateWithConditions> {
    // If setting as default, unset other defaults first
    if (input.isDefault) {
      await prisma.qualityGate.updateMany({
        where: { projectId: input.projectId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const qualityGate = await prisma.qualityGate.create({
      data: {
        projectId: input.projectId,
        name: input.name,
        description: input.description,
        isDefault: input.isDefault ?? false,
        failOnBreach: input.failOnBreach ?? true,
        createdById: input.createdById,
        conditions: {
          create: input.conditions.map((c, index) => ({
            metric: c.metric,
            operator: c.operator,
            threshold: c.threshold,
            severity: c.severity ?? 'error',
            description: c.description,
            orderIndex: index,
          })),
        },
      },
      include: { conditions: { orderBy: { orderIndex: 'asc' } } },
    });

    logger.info({ qualityGateId: qualityGate.id, projectId: input.projectId }, 'Quality gate created');
    return qualityGate;
  }

  async update(id: string, input: UpdateQualityGateInput): Promise<QualityGateWithConditions> {
    const existing = await prisma.qualityGate.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('QualityGate', id);

    // If setting as default, unset other defaults first
    if (input.isDefault) {
      await prisma.qualityGate.updateMany({
        where: { projectId: existing.projectId, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    // If conditions are provided, replace all
    if (input.conditions) {
      await prisma.qualityGateCondition.deleteMany({ where: { qualityGateId: id } });
      await prisma.qualityGateCondition.createMany({
        data: input.conditions.map((c, index) => ({
          qualityGateId: id,
          metric: c.metric,
          operator: c.operator,
          threshold: c.threshold,
          severity: c.severity ?? 'error',
          description: c.description,
          orderIndex: index,
        })),
      });
    }

    const qualityGate = await prisma.qualityGate.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description,
        isDefault: input.isDefault,
        isActive: input.isActive,
        failOnBreach: input.failOnBreach,
      },
      include: { conditions: { orderBy: { orderIndex: 'asc' } } },
    });

    logger.info({ qualityGateId: id }, 'Quality gate updated');
    return qualityGate;
  }

  async findById(id: string): Promise<QualityGateWithConditions> {
    const qualityGate = await prisma.qualityGate.findUnique({
      where: { id },
      include: { conditions: { orderBy: { orderIndex: 'asc' } } },
    });
    if (!qualityGate) throw new NotFoundError('QualityGate', id);
    return qualityGate;
  }

  async findAll(params: FindQualityGatesParams) {
    const { page, limit, projectId, isActive } = params;
    const where: Prisma.QualityGateWhereInput = {};

    if (projectId) where.projectId = projectId;
    if (isActive !== undefined) where.isActive = isActive;

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      prisma.qualityGate.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { conditions: { orderBy: { orderIndex: 'asc' } } },
      }),
      prisma.qualityGate.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findByProject(projectId: string): Promise<QualityGateWithConditions[]> {
    return prisma.qualityGate.findMany({
      where: { projectId },
      include: { conditions: { orderBy: { orderIndex: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findDefault(projectId: string): Promise<QualityGateWithConditions | null> {
    return prisma.qualityGate.findFirst({
      where: { projectId, isDefault: true, isActive: true },
      include: { conditions: { orderBy: { orderIndex: 'asc' } } },
    });
  }

  async delete(id: string): Promise<void> {
    const qualityGate = await prisma.qualityGate.findUnique({ where: { id } });
    if (!qualityGate) throw new NotFoundError('QualityGate', id);

    await prisma.qualityGate.delete({ where: { id } });
    logger.info({ qualityGateId: id }, 'Quality gate deleted');
  }

  async setDefault(id: string): Promise<QualityGateWithConditions> {
    const qualityGate = await prisma.qualityGate.findUnique({ where: { id } });
    if (!qualityGate) throw new NotFoundError('QualityGate', id);

    // Unset other defaults
    await prisma.qualityGate.updateMany({
      where: { projectId: qualityGate.projectId, isDefault: true },
      data: { isDefault: false },
    });

    return prisma.qualityGate.update({
      where: { id },
      data: { isDefault: true },
      include: { conditions: { orderBy: { orderIndex: 'asc' } } },
    });
  }

  async evaluate(input: EvaluateInput): Promise<EvaluationResult> {
    const execution = await prisma.execution.findUnique({
      where: { id: input.executionId },
      include: { results: true, project: true },
    });
    if (!execution) throw new NotFoundError('Execution', input.executionId);

    // Get quality gate - specified or default
    let qualityGate: QualityGateWithConditions | null;
    if (input.qualityGateId) {
      qualityGate = await this.findById(input.qualityGateId);
    } else {
      qualityGate = await this.findDefault(execution.projectId);
    }

    if (!qualityGate) {
      return {
        qualityGateId: '',
        qualityGateName: 'No Gate',
        executionId: input.executionId,
        status: 'skipped',
        overallPassed: true,
        conditionResults: [],
        summary: 'No quality gate configured for this project',
        evaluatedAt: new Date(),
      };
    }

    // Calculate metrics
    const metrics = await this.calculateMetrics(input.executionId, execution.projectId);

    // Evaluate each condition
    const conditionResults: ConditionResult[] = [];
    let hasError = false;
    let hasWarning = false;

    for (const condition of qualityGate.conditions) {
      const actualValue = metrics[condition.metric] ?? 0;
      const passed = this.evaluateCondition(actualValue, condition.operator, Number(condition.threshold));

      if (!passed) {
        if (condition.severity === 'error') hasError = true;
        else hasWarning = true;
      }

      conditionResults.push({
        conditionId: condition.id,
        metric: condition.metric,
        operator: condition.operator,
        threshold: Number(condition.threshold),
        actualValue,
        passed,
        severity: condition.severity,
        message: this.formatConditionMessage(condition, actualValue, passed),
      });
    }

    // Determine overall status
    let status: QualityGateStatus;
    if (hasError) status = 'failed';
    else if (hasWarning) status = 'warning';
    else status = 'passed';

    const overallPassed = status === 'passed' || status === 'warning';

    // Generate summary
    const failedConditions = conditionResults.filter(r => !r.passed && r.severity === 'error');
    const summary = failedConditions.length > 0
      ? `Quality gate failed: ${failedConditions.map(c => c.message).join('; ')}`
      : status === 'warning'
        ? 'Quality gate passed with warnings'
        : 'Quality gate passed';

    // Store evaluation
    await prisma.qualityGateEvaluation.upsert({
      where: {
        qualityGateId_executionId: {
          qualityGateId: qualityGate.id,
          executionId: input.executionId,
        },
      },
      create: {
        qualityGateId: qualityGate.id,
        executionId: input.executionId,
        projectId: execution.projectId,
        status,
        results: conditionResults as unknown as Prisma.InputJsonValue,
        summary,
      },
      update: {
        status,
        results: conditionResults as unknown as Prisma.InputJsonValue,
        summary,
        evaluatedAt: new Date(),
      },
    });

    logger.info({
      qualityGateId: qualityGate.id,
      executionId: input.executionId,
      status,
    }, 'Quality gate evaluated');

    return {
      qualityGateId: qualityGate.id,
      qualityGateName: qualityGate.name,
      executionId: input.executionId,
      status,
      overallPassed,
      conditionResults,
      summary,
      evaluatedAt: new Date(),
    };
  }

  async getEvaluation(executionId: string, qualityGateId?: string): Promise<QualityGateEvaluation | null> {
    if (qualityGateId) {
      return prisma.qualityGateEvaluation.findUnique({
        where: { qualityGateId_executionId: { qualityGateId, executionId } },
      });
    }
    return prisma.qualityGateEvaluation.findFirst({
      where: { executionId },
      orderBy: { evaluatedAt: 'desc' },
    });
  }

  async getExecutionEvaluations(executionId: string): Promise<QualityGateEvaluation[]> {
    return prisma.qualityGateEvaluation.findMany({
      where: { executionId },
      include: { qualityGate: true },
      orderBy: { evaluatedAt: 'desc' },
    });
  }

  async getProjectSummary(projectId: string, days: number = 30): Promise<QualityGateSummary> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const evaluations = await prisma.qualityGateEvaluation.findMany({
      where: { projectId, evaluatedAt: { gte: startDate } },
      orderBy: { evaluatedAt: 'asc' },
    });

    const passedCount = evaluations.filter(e => e.status === 'passed').length;
    const failedCount = evaluations.filter(e => e.status === 'failed').length;
    const warningCount = evaluations.filter(e => e.status === 'warning').length;
    const totalEvaluations = evaluations.length;

    // Calculate trend (compare first half vs second half)
    const midpoint = Math.floor(evaluations.length / 2);
    const firstHalf = evaluations.slice(0, midpoint);
    const secondHalf = evaluations.slice(midpoint);

    const firstPassRate = firstHalf.length > 0
      ? firstHalf.filter(e => e.status === 'passed').length / firstHalf.length
      : 0;
    const secondPassRate = secondHalf.length > 0
      ? secondHalf.filter(e => e.status === 'passed').length / secondHalf.length
      : 0;

    let recentTrend: 'improving' | 'declining' | 'stable' = 'stable';
    if (secondPassRate > firstPassRate + 0.1) recentTrend = 'improving';
    else if (secondPassRate < firstPassRate - 0.1) recentTrend = 'declining';

    // Count failing conditions
    const conditionFailures: Record<string, number> = {};
    for (const evaluation of evaluations) {
      const results = evaluation.results as ConditionResult[];
      for (const result of results) {
        if (!result.passed && result.severity === 'error') {
          conditionFailures[result.metric] = (conditionFailures[result.metric] ?? 0) + 1;
        }
      }
    }

    const topFailingConditions = Object.entries(conditionFailures)
      .map(([metric, failCount]) => ({ metric, failCount }))
      .sort((a, b) => b.failCount - a.failCount)
      .slice(0, 5);

    return {
      projectId,
      totalEvaluations,
      passedCount,
      failedCount,
      warningCount,
      passRate: totalEvaluations > 0 ? Math.round((passedCount / totalEvaluations) * 100) : 0,
      recentTrend,
      topFailingConditions,
    };
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private async calculateMetrics(executionId: string, projectId: string): Promise<Record<QualityGateMetric, number>> {
    const [passRate, coverage, flakiness, duration, failedCount, criticalFailures] = await Promise.all([
      this.calculatePassRate(executionId),
      this.calculateCoverage(projectId),
      this.calculateMaxFlakiness(projectId),
      this.calculateDuration(executionId),
      this.calculateFailedCount(executionId),
      this.calculateCriticalFailures(executionId),
    ]);

    return {
      pass_rate: passRate,
      coverage,
      flakiness,
      duration,
      failed_count: failedCount,
      critical_failures: criticalFailures,
    };
  }

  private async calculatePassRate(executionId: string): Promise<number> {
    const results = await prisma.executionResult.findMany({ where: { executionId } });
    if (results.length === 0) return 100;
    const passed = results.filter(r => r.status === 'passed').length;
    return Math.round((passed / results.length) * 100);
  }

  private async calculateCoverage(projectId: string): Promise<number> {
    const [totalRequirements, coveredRequirements] = await Promise.all([
      prisma.requirement.count({ where: { projectId, status: 'active' } }),
      prisma.requirement.count({
        where: {
          projectId,
          status: 'active',
          testCases: { some: {} },
        },
      }),
    ]);

    if (totalRequirements === 0) return 100;
    return Math.round((coveredRequirements / totalRequirements) * 100);
  }

  private async calculateMaxFlakiness(projectId: string): Promise<number> {
    const flakyTest = await prisma.flakyTest.findFirst({
      where: { projectId },
      orderBy: { flakinessScore: 'desc' },
    });
    return flakyTest ? Number(flakyTest.flakinessScore) : 0;
  }

  private async calculateDuration(executionId: string): Promise<number> {
    const execution = await prisma.execution.findUnique({ where: { id: executionId } });
    if (!execution?.startedAt || !execution?.completedAt) return 0;
    return execution.completedAt.getTime() - execution.startedAt.getTime();
  }

  private async calculateFailedCount(executionId: string): Promise<number> {
    return prisma.executionResult.count({
      where: { executionId, status: 'failed' },
    });
  }

  private async calculateCriticalFailures(executionId: string): Promise<number> {
    return prisma.executionResult.count({
      where: {
        executionId,
        status: 'failed',
        testCase: { priority: 'critical' },
      },
    });
  }

  private evaluateCondition(actualValue: number, operator: string, threshold: number): boolean {
    switch (operator) {
      case 'gte': return actualValue >= threshold;
      case 'lte': return actualValue <= threshold;
      case 'gt': return actualValue > threshold;
      case 'lt': return actualValue < threshold;
      case 'eq': return actualValue === threshold;
      default: return false;
    }
  }

  private formatConditionMessage(
    condition: QualityGateCondition,
    actualValue: number,
    passed: boolean
  ): string {
    const metricLabels: Record<QualityGateMetric, string> = {
      pass_rate: 'Pass rate',
      coverage: 'Coverage',
      flakiness: 'Flakiness score',
      duration: 'Duration',
      failed_count: 'Failed tests',
      critical_failures: 'Critical failures',
    };

    const operatorLabels: Record<string, string> = {
      gte: 'at least',
      lte: 'at most',
      gt: 'greater than',
      lt: 'less than',
      eq: 'exactly',
    };

    const label = metricLabels[condition.metric] ?? condition.metric;
    const opLabel = operatorLabels[condition.operator] ?? condition.operator;
    const unit = ['pass_rate', 'coverage', 'flakiness'].includes(condition.metric) ? '%' : '';

    if (passed) {
      return `${label} ${actualValue}${unit} meets threshold (${opLabel} ${condition.threshold}${unit})`;
    }
    return `${label} ${actualValue}${unit} does not meet threshold (${opLabel} ${condition.threshold}${unit})`;
  }
}

export const qualityGateService = new QualityGateService();

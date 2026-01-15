/**
 * Bug Service
 * Handles bug tracking, creation from failures, and external sync
 */

import type { Bug, BugStatus, Priority, Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma.js';
import { NotFoundError } from '../errors/index.js';
import { logger } from '../utils/logger.js';

export interface CreateBugInput {
  projectId: string;
  title: string;
  description?: string | undefined;
  priority?: Priority | undefined;
  linkedTestCaseId?: string | undefined;
  linkedExecutionId?: string | undefined;
  externalId?: string | undefined;
}

export interface UpdateBugInput {
  title?: string | undefined;
  description?: string | undefined;
  status?: BugStatus | undefined;
  priority?: Priority | undefined;
  externalId?: string | undefined;
}

export interface CreateFromFailureInput {
  executionResultId: string;
  projectId: string;
  autoTitle?: boolean | undefined;
}

export interface FindAllParams {
  page: number;
  limit: number;
  projectId?: string | undefined;
  status?: BugStatus | undefined;
  priority?: Priority | undefined;
  linkedTestCaseId?: string | undefined;
}

export interface BugPattern {
  pattern: string;
  count: number;
  testCases: string[];
  lastOccurrence: Date;
  suggestedFix?: string | undefined;
}

export class BugService {
  async create(input: CreateBugInput): Promise<Bug> {
    return prisma.bug.create({
      data: {
        projectId: input.projectId,
        title: input.title,
        ...(input.description ? { description: input.description } : {}),
        priority: input.priority ?? 'medium',
        ...(input.linkedTestCaseId ? { linkedTestCaseId: input.linkedTestCaseId } : {}),
        ...(input.linkedExecutionId ? { linkedExecutionId: input.linkedExecutionId } : {}),
        ...(input.externalId ? { externalId: input.externalId } : {}),
        status: 'open',
      },
    });
  }

  async findById(id: string): Promise<Bug> {
    const bug = await prisma.bug.findUnique({
      where: { id },
      include: { testCase: true, project: true },
    });
    if (!bug) throw new NotFoundError('Bug', id);
    return bug;
  }

  async findAll(params: FindAllParams) {
    const { page, limit, projectId, status, priority, linkedTestCaseId } = params;
    const where: Prisma.BugWhereInput = {};

    if (projectId) where.projectId = projectId;
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (linkedTestCaseId) where.linkedTestCaseId = linkedTestCaseId;

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      prisma.bug.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { testCase: { select: { id: true, title: true } } },
      }),
      prisma.bug.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async update(id: string, input: UpdateBugInput): Promise<Bug> {
    const existing = await prisma.bug.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Bug', id);

    const updateData: Prisma.BugUpdateInput = {};
    if (input.title !== undefined) updateData.title = input.title;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.priority !== undefined) updateData.priority = input.priority;
    if (input.externalId !== undefined) updateData.externalId = input.externalId;

    return prisma.bug.update({ where: { id }, data: updateData });
  }

  async delete(id: string): Promise<void> {
    const existing = await prisma.bug.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Bug', id);
    await prisma.bug.delete({ where: { id } });
  }

  async createFromFailure(input: CreateFromFailureInput): Promise<Bug> {
    const result = await prisma.executionResult.findUnique({
      where: { id: input.executionResultId },
      include: { testCase: true, execution: true },
    });

    if (!result) throw new NotFoundError('ExecutionResult', input.executionResultId);
    if (result.status !== 'failed' && result.status !== 'error') {
      throw new Error('Can only create bug from failed/error results');
    }

    // Check if bug already exists for this test case
    const existingBug = await prisma.bug.findFirst({
      where: {
        linkedTestCaseId: result.testCaseId,
        status: { in: ['open', 'in_progress'] },
      },
    });

    if (existingBug) {
      logger.info({ bugId: existingBug.id, testCaseId: result.testCaseId }, 'Bug already exists for test case');
      return existingBug;
    }

    const title = input.autoTitle
      ? `[Auto] ${result.testCase?.title ?? 'Test'} failed: ${result.errorMessage?.substring(0, 100) ?? 'Unknown error'}`
      : `Test failure: ${result.testCase?.title ?? 'Unknown test'}`;

    const bug = await this.create({
      projectId: input.projectId,
      title,
      description: `**Error Message:**\n${result.errorMessage ?? 'No error message'}\n\n**Stack Trace:**\n\`\`\`\n${result.errorStack ?? 'No stack trace'}\n\`\`\``,
      priority: 'high',
      linkedTestCaseId: result.testCaseId ?? undefined,
      linkedExecutionId: result.executionId,
    });

    logger.info({ bugId: bug.id, resultId: input.executionResultId }, 'Bug created from failure');
    return bug;
  }

  async linkToExternal(id: string, externalId: string): Promise<Bug> {
    const existing = await prisma.bug.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Bug', id);

    return prisma.bug.update({
      where: { id },
      data: { externalId },
    });
  }

  async findByExternalId(externalId: string): Promise<Bug | null> {
    return prisma.bug.findFirst({ where: { externalId } });
  }

  async getProjectStats(projectId: string) {
    const bugs = await prisma.bug.findMany({ where: { projectId } });

    const total = bugs.length;
    const open = bugs.filter(b => b.status === 'open').length;
    const inProgress = bugs.filter(b => b.status === 'in_progress').length;
    const resolved = bugs.filter(b => b.status === 'resolved').length;
    const closed = bugs.filter(b => b.status === 'closed').length;

    const byPriority = {
      critical: bugs.filter(b => b.priority === 'critical').length,
      high: bugs.filter(b => b.priority === 'high').length,
      medium: bugs.filter(b => b.priority === 'medium').length,
      low: bugs.filter(b => b.priority === 'low').length,
    };

    return { total, open, inProgress, resolved, closed, byPriority };
  }

  async analyzePatterns(projectId: string): Promise<BugPattern[]> {
    const bugs = await prisma.bug.findMany({
      where: { projectId, status: { in: ['open', 'in_progress'] } },
      include: { testCase: true },
      orderBy: { createdAt: 'desc' },
    });

    // Simple pattern analysis based on error keywords
    const patternMap = new Map<string, BugPattern>();
    const commonPatterns = [
      { regex: /timeout/i, name: 'Timeout Issues' },
      { regex: /element not found|selector/i, name: 'Selector Issues' },
      { regex: /assertion|expect/i, name: 'Assertion Failures' },
      { regex: /network|api|fetch/i, name: 'Network Issues' },
      { regex: /authentication|login|auth/i, name: 'Authentication Issues' },
    ];

    for (const bug of bugs) {
      const description = bug.description ?? '';
      const title = bug.title;

      for (const pattern of commonPatterns) {
        if (pattern.regex.test(title) || pattern.regex.test(description)) {
          if (!patternMap.has(pattern.name)) {
            patternMap.set(pattern.name, {
              pattern: pattern.name,
              count: 0,
              testCases: [],
              lastOccurrence: bug.createdAt,
            });
          }
          const p = patternMap.get(pattern.name)!;
          p.count++;
          if (bug.testCase) {
            p.testCases.push(bug.testCase.title);
          }
          if (bug.createdAt > p.lastOccurrence) {
            p.lastOccurrence = bug.createdAt;
          }
        }
      }
    }

    return Array.from(patternMap.values()).sort((a, b) => b.count - a.count);
  }
}

export const bugService = new BugService();

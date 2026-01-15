/**
 * TestCase Service
 * Handles test case CRUD operations
 */

import type { TestCase, Priority, Status, TestType, Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma.js';
import { NotFoundError } from '../errors/index.js';

// =============================================================================
// TYPES
// =============================================================================

export interface TestStep {
  order: number;
  action: string;
  expected: string;
}

export interface CreateTestCaseInput {
  projectId: string;
  requirementId?: string;
  title: string;
  description?: string;
  preconditions?: string;
  steps?: TestStep[];
  expectedResult?: string;
  testData?: Record<string, unknown>;
  priority?: Priority;
  status?: Status;
  type?: TestType;
  isAutomated?: boolean;
  createdById: string;
}

export interface UpdateTestCaseInput {
  requirementId?: string | null;
  title?: string;
  description?: string;
  preconditions?: string;
  steps?: TestStep[];
  expectedResult?: string;
  testData?: Record<string, unknown>;
  priority?: Priority;
  status?: Status;
  type?: TestType;
  isAutomated?: boolean;
}

export interface FindAllParams {
  page: number;
  limit: number;
  projectId?: string;
  requirementId?: string;
  priority?: Priority;
  status?: Status;
  type?: TestType;
  isAutomated?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// =============================================================================
// SERVICE
// =============================================================================

export class TestCaseService {
  /**
   * Create a new test case
   */
  async create(input: CreateTestCaseInput): Promise<TestCase> {
    const testCase = await prisma.testCase.create({
      data: {
        projectId: input.projectId,
        requirementId: input.requirementId,
        title: input.title,
        description: input.description,
        preconditions: input.preconditions,
        steps: (input.steps ?? []) as Prisma.InputJsonValue,
        expectedResult: input.expectedResult,
        testData: input.testData as Prisma.InputJsonValue,
        priority: input.priority ?? 'medium',
        status: input.status ?? 'active',
        type: input.type ?? 'functional',
        isAutomated: input.isAutomated ?? false,
        createdById: input.createdById,
      },
    });

    return testCase;
  }

  /**
   * Find test case by ID
   */
  async findById(id: string): Promise<TestCase> {
    const testCase = await prisma.testCase.findUnique({
      where: { id },
    });

    if (!testCase) {
      throw new NotFoundError('TestCase', id);
    }

    return testCase;
  }

  /**
   * Find test case by ID with related data
   */
  async findByIdWithRelations(id: string): Promise<TestCase & Record<string, unknown>> {
    const testCase = await prisma.testCase.findUnique({
      where: { id },
      include: {
        project: true,
        requirement: true,
        createdBy: true,
        scripts: true,
        suites: {
          include: {
            suite: true,
          },
        },
      },
    });

    if (!testCase) {
      throw new NotFoundError('TestCase', id);
    }

    return testCase;
  }

  /**
   * Find all test cases with pagination and filtering
   */
  async findAll(params: FindAllParams): Promise<PaginatedResult<TestCase>> {
    const {
      page,
      limit,
      projectId,
      requirementId,
      priority,
      status,
      type,
      isAutomated,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = params;

    const where: Prisma.TestCaseWhereInput = {};
    if (projectId !== undefined) where.projectId = projectId;
    if (requirementId !== undefined) where.requirementId = requirementId;
    if (priority !== undefined) where.priority = priority;
    if (status !== undefined) where.status = status;
    if (type !== undefined) where.type = type;
    if (isAutomated !== undefined) where.isAutomated = isAutomated;

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      prisma.testCase.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      prisma.testCase.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Update test case fields
   */
  async update(id: string, input: UpdateTestCaseInput): Promise<TestCase> {
    const existingTestCase = await prisma.testCase.findUnique({
      where: { id },
    });

    if (!existingTestCase) {
      throw new NotFoundError('TestCase', id);
    }

    // Build update data, handling JSON fields
    const updateData: Prisma.TestCaseUpdateInput = {};

    if (input.requirementId !== undefined) updateData.requirementId = input.requirementId;
    if (input.title !== undefined) updateData.title = input.title;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.preconditions !== undefined) updateData.preconditions = input.preconditions;
    if (input.steps !== undefined) updateData.steps = input.steps as Prisma.InputJsonValue;
    if (input.expectedResult !== undefined) updateData.expectedResult = input.expectedResult;
    if (input.testData !== undefined) updateData.testData = input.testData as Prisma.InputJsonValue;
    if (input.priority !== undefined) updateData.priority = input.priority;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.type !== undefined) updateData.type = input.type;
    if (input.isAutomated !== undefined) updateData.isAutomated = input.isAutomated;

    const testCase = await prisma.testCase.update({
      where: { id },
      data: updateData,
    });

    return testCase;
  }

  /**
   * Delete test case
   */
  async delete(id: string): Promise<void> {
    const existingTestCase = await prisma.testCase.findUnique({
      where: { id },
    });

    if (!existingTestCase) {
      throw new NotFoundError('TestCase', id);
    }

    await prisma.testCase.delete({
      where: { id },
    });
  }

  /**
   * Archive test case (soft delete)
   */
  async archive(id: string): Promise<TestCase> {
    const existingTestCase = await prisma.testCase.findUnique({
      where: { id },
    });

    if (!existingTestCase) {
      throw new NotFoundError('TestCase', id);
    }

    return prisma.testCase.update({
      where: { id },
      data: { status: 'archived' },
    });
  }

  /**
   * Duplicate a test case
   */
  async duplicate(id: string, createdById: string): Promise<TestCase> {
    const existingTestCase = await prisma.testCase.findUnique({
      where: { id },
    });

    if (!existingTestCase) {
      throw new NotFoundError('TestCase', id);
    }

    return prisma.testCase.create({
      data: {
        projectId: existingTestCase.projectId,
        requirementId: existingTestCase.requirementId,
        title: `Copy of ${existingTestCase.title}`,
        description: existingTestCase.description,
        preconditions: existingTestCase.preconditions,
        steps: existingTestCase.steps as Prisma.InputJsonValue,
        expectedResult: existingTestCase.expectedResult,
        testData: existingTestCase.testData as Prisma.InputJsonValue,
        priority: existingTestCase.priority,
        status: 'active',
        type: existingTestCase.type,
        isAutomated: false,
        createdById,
      },
    });
  }

  /**
   * Bulk update status for multiple test cases
   */
  async bulkUpdateStatus(ids: string[], status: Status): Promise<{ count: number }> {
    const result = await prisma.testCase.updateMany({
      where: { id: { in: ids } },
      data: { status },
    });

    return { count: result.count };
  }

  /**
   * Get all test cases for a project
   */
  async getByProject(projectId: string): Promise<TestCase[]> {
    return prisma.testCase.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get all test cases for a requirement
   */
  async getByRequirement(requirementId: string): Promise<TestCase[]> {
    return prisma.testCase.findMany({
      where: { requirementId },
      orderBy: { createdAt: 'desc' },
    });
  }
}

// Export singleton instance
export const testCaseService = new TestCaseService();

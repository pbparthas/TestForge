/**
 * TestSuite Service
 * Handles test suite CRUD operations and test case associations
 */

import type { TestSuite, Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma.js';
import { NotFoundError } from '../errors/index.js';

// =============================================================================
// TYPES
// =============================================================================

export interface CreateTestSuiteInput {
  projectId: string;
  name: string;
  description?: string;
}

export interface UpdateTestSuiteInput {
  name?: string;
  description?: string;
}

export interface FindAllParams {
  page: number;
  limit: number;
  projectId?: string;
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

export interface TestCaseOrder {
  testCaseId: string;
  orderIndex: number;
}

// =============================================================================
// SERVICE
// =============================================================================

export class TestSuiteService {
  /**
   * Create a new test suite
   */
  async create(input: CreateTestSuiteInput): Promise<TestSuite> {
    return prisma.testSuite.create({
      data: {
        projectId: input.projectId,
        name: input.name,
        description: input.description,
      },
    });
  }

  /**
   * Find test suite by ID
   */
  async findById(id: string): Promise<TestSuite> {
    const testSuite = await prisma.testSuite.findUnique({
      where: { id },
    });

    if (!testSuite) {
      throw new NotFoundError('TestSuite', id);
    }

    return testSuite;
  }

  /**
   * Find test suite by ID with associated test cases
   */
  async findByIdWithTestCases(id: string): Promise<TestSuite & Record<string, unknown>> {
    const testSuite = await prisma.testSuite.findUnique({
      where: { id },
      include: {
        testCases: {
          include: {
            testCase: true,
          },
          orderBy: {
            orderIndex: 'asc',
          },
        },
        project: true,
      },
    });

    if (!testSuite) {
      throw new NotFoundError('TestSuite', id);
    }

    return testSuite;
  }

  /**
   * Find all test suites with pagination and filtering
   */
  async findAll(params: FindAllParams): Promise<PaginatedResult<TestSuite>> {
    const {
      page,
      limit,
      projectId,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = params;

    const where: Prisma.TestSuiteWhereInput = {};
    if (projectId !== undefined) where.projectId = projectId;

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      prisma.testSuite.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      prisma.testSuite.count({ where }),
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
   * Update test suite fields
   */
  async update(id: string, input: UpdateTestSuiteInput): Promise<TestSuite> {
    const existingTestSuite = await prisma.testSuite.findUnique({
      where: { id },
    });

    if (!existingTestSuite) {
      throw new NotFoundError('TestSuite', id);
    }

    const updateData: Prisma.TestSuiteUpdateInput = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;

    return prisma.testSuite.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Delete test suite
   */
  async delete(id: string): Promise<void> {
    const existingTestSuite = await prisma.testSuite.findUnique({
      where: { id },
    });

    if (!existingTestSuite) {
      throw new NotFoundError('TestSuite', id);
    }

    await prisma.testSuite.delete({
      where: { id },
    });
  }

  /**
   * Add test cases to suite
   */
  async addTestCases(suiteId: string, testCaseIds: string[]): Promise<{ count: number }> {
    const testSuite = await prisma.testSuite.findUnique({
      where: { id: suiteId },
    });

    if (!testSuite) {
      throw new NotFoundError('TestSuite', suiteId);
    }

    // Get current max order index
    const existingCases = await prisma.testSuiteCase.findMany({
      where: { suiteId },
      orderBy: { orderIndex: 'desc' },
      take: 1,
    });

    let nextIndex = existingCases.length > 0 ? existingCases[0].orderIndex + 1 : 0;

    const data = testCaseIds.map((testCaseId) => ({
      suiteId,
      testCaseId,
      orderIndex: nextIndex++,
    }));

    const result = await prisma.testSuiteCase.createMany({
      data,
      skipDuplicates: true,
    });

    return { count: result.count };
  }

  /**
   * Remove test cases from suite
   */
  async removeTestCases(suiteId: string, testCaseIds: string[]): Promise<{ count: number }> {
    const result = await prisma.testSuiteCase.deleteMany({
      where: {
        suiteId,
        testCaseId: { in: testCaseIds },
      },
    });

    return { count: result.count };
  }

  /**
   * Reorder test cases in suite
   */
  async reorderTestCases(suiteId: string, order: TestCaseOrder[]): Promise<void> {
    // Delete existing associations for the suite
    await prisma.testSuiteCase.deleteMany({
      where: { suiteId },
    });

    // Create new associations with updated order
    const data = order.map((item) => ({
      suiteId,
      testCaseId: item.testCaseId,
      orderIndex: item.orderIndex,
    }));

    await prisma.testSuiteCase.createMany({
      data,
    });
  }

  /**
   * Get all test suites for a project
   */
  async getByProject(projectId: string): Promise<TestSuite[]> {
    return prisma.testSuite.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Duplicate a test suite with its test cases
   */
  async duplicate(id: string): Promise<TestSuite> {
    const existingTestSuite = await prisma.testSuite.findUnique({
      where: { id },
      include: {
        testCases: true,
      },
    });

    if (!existingTestSuite) {
      throw new NotFoundError('TestSuite', id);
    }

    // Create new suite
    const newSuite = await prisma.testSuite.create({
      data: {
        projectId: existingTestSuite.projectId,
        name: `Copy of ${existingTestSuite.name}`,
        description: existingTestSuite.description,
      },
    });

    // Copy test case associations
    if (existingTestSuite.testCases.length > 0) {
      const data = existingTestSuite.testCases.map((tc) => ({
        suiteId: newSuite.id,
        testCaseId: tc.testCaseId,
        orderIndex: tc.orderIndex,
      }));

      await prisma.testSuiteCase.createMany({
        data,
      });
    }

    return newSuite;
  }
}

// Export singleton instance
export const testSuiteService = new TestSuiteService();

/**
 * TestSuite Service Tests (TDD - RED phase)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { TestSuite } from '@prisma/client';

// Mock Prisma client
const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    testSuite: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    testSuiteCase: {
      createMany: vi.fn(),
      deleteMany: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock('../../../src/utils/prisma.js', () => ({
  prisma: mockPrisma,
}));

import { TestSuiteService } from '../../../src/services/testsuite.service.js';

describe('TestSuiteService', () => {
  let testSuiteService: TestSuiteService;

  const mockTestSuite: TestSuite = {
    id: 'suite-123',
    projectId: 'project-123',
    name: 'Smoke Tests',
    description: 'Quick sanity tests',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    testSuiteService = new TestSuiteService();
  });

  describe('create', () => {
    it('should create a test suite with valid input', async () => {
      mockPrisma.testSuite.create.mockResolvedValue(mockTestSuite);

      const result = await testSuiteService.create({
        projectId: 'project-123',
        name: 'Smoke Tests',
        description: 'Quick sanity tests',
      });

      expect(result.name).toBe('Smoke Tests');
      expect(mockPrisma.testSuite.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('findById', () => {
    it('should return test suite by id', async () => {
      mockPrisma.testSuite.findUnique.mockResolvedValue(mockTestSuite);

      const result = await testSuiteService.findById('suite-123');

      expect(result).toEqual(mockTestSuite);
    });

    it('should throw NotFoundError if test suite does not exist', async () => {
      mockPrisma.testSuite.findUnique.mockResolvedValue(null);

      await expect(testSuiteService.findById('nonexistent')).rejects.toThrow(
        "TestSuite with id 'nonexistent' not found"
      );
    });
  });

  describe('findByIdWithTestCases', () => {
    it('should return test suite with associated test cases', async () => {
      const suiteWithCases = {
        ...mockTestSuite,
        testCases: [
          { testCase: { id: 'tc-1', title: 'Test 1' }, orderIndex: 0 },
          { testCase: { id: 'tc-2', title: 'Test 2' }, orderIndex: 1 },
        ],
      };
      mockPrisma.testSuite.findUnique.mockResolvedValue(suiteWithCases);

      const result = await testSuiteService.findByIdWithTestCases('suite-123');

      expect(result.testCases).toHaveLength(2);
    });
  });

  describe('findAll', () => {
    it('should return paginated test suites', async () => {
      mockPrisma.testSuite.findMany.mockResolvedValue([mockTestSuite]);
      mockPrisma.testSuite.count.mockResolvedValue(1);

      const result = await testSuiteService.findAll({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by projectId', async () => {
      mockPrisma.testSuite.findMany.mockResolvedValue([mockTestSuite]);
      mockPrisma.testSuite.count.mockResolvedValue(1);

      await testSuiteService.findAll({ page: 1, limit: 10, projectId: 'project-123' });

      expect(mockPrisma.testSuite.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ projectId: 'project-123' }),
        })
      );
    });
  });

  describe('update', () => {
    it('should update test suite fields', async () => {
      mockPrisma.testSuite.findUnique.mockResolvedValue(mockTestSuite);
      mockPrisma.testSuite.update.mockResolvedValue({ ...mockTestSuite, name: 'Updated Name' });

      const result = await testSuiteService.update('suite-123', { name: 'Updated Name' });

      expect(result.name).toBe('Updated Name');
    });

    it('should throw NotFoundError if test suite does not exist', async () => {
      mockPrisma.testSuite.findUnique.mockResolvedValue(null);

      await expect(
        testSuiteService.update('nonexistent', { name: 'New Name' })
      ).rejects.toThrow("TestSuite with id 'nonexistent' not found");
    });
  });

  describe('delete', () => {
    it('should delete test suite by id', async () => {
      mockPrisma.testSuite.findUnique.mockResolvedValue(mockTestSuite);
      mockPrisma.testSuite.delete.mockResolvedValue(mockTestSuite);

      await testSuiteService.delete('suite-123');

      expect(mockPrisma.testSuite.delete).toHaveBeenCalledWith({
        where: { id: 'suite-123' },
      });
    });
  });

  describe('addTestCases', () => {
    it('should add test cases to suite', async () => {
      mockPrisma.testSuite.findUnique.mockResolvedValue(mockTestSuite);
      mockPrisma.testSuiteCase.findMany.mockResolvedValue([]);
      mockPrisma.testSuiteCase.createMany.mockResolvedValue({ count: 2 });

      const result = await testSuiteService.addTestCases('suite-123', ['tc-1', 'tc-2']);

      expect(result.count).toBe(2);
    });
  });

  describe('removeTestCases', () => {
    it('should remove test cases from suite', async () => {
      mockPrisma.testSuiteCase.deleteMany.mockResolvedValue({ count: 1 });

      const result = await testSuiteService.removeTestCases('suite-123', ['tc-1']);

      expect(result.count).toBe(1);
    });
  });

  describe('reorderTestCases', () => {
    it('should update order of test cases in suite', async () => {
      mockPrisma.testSuiteCase.deleteMany.mockResolvedValue({ count: 2 });
      mockPrisma.testSuiteCase.createMany.mockResolvedValue({ count: 2 });

      await testSuiteService.reorderTestCases('suite-123', [
        { testCaseId: 'tc-2', orderIndex: 0 },
        { testCaseId: 'tc-1', orderIndex: 1 },
      ]);

      expect(mockPrisma.testSuiteCase.createMany).toHaveBeenCalled();
    });
  });

  describe('getByProject', () => {
    it('should return test suites for a project', async () => {
      mockPrisma.testSuite.findMany.mockResolvedValue([mockTestSuite]);

      const result = await testSuiteService.getByProject('project-123');

      expect(result).toHaveLength(1);
    });
  });

  describe('duplicate', () => {
    it('should create a copy of test suite with test cases', async () => {
      const suiteWithCases = {
        ...mockTestSuite,
        testCases: [
          { testCaseId: 'tc-1', orderIndex: 0 },
          { testCaseId: 'tc-2', orderIndex: 1 },
        ],
      };
      mockPrisma.testSuite.findUnique.mockResolvedValue(suiteWithCases);
      mockPrisma.testSuite.create.mockResolvedValue({
        ...mockTestSuite,
        id: 'suite-new',
        name: 'Copy of Smoke Tests',
      });
      mockPrisma.testSuiteCase.createMany.mockResolvedValue({ count: 2 });

      const result = await testSuiteService.duplicate('suite-123');

      expect(result.name).toContain('Copy of');
    });
  });
});

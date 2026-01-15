/**
 * TestCase Service Tests (TDD - RED phase)
 * Tests for test case CRUD operations
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { TestCase, Priority, Status, TestType } from '@prisma/client';

// Mock Prisma client
const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    testCase: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock('../../../src/utils/prisma.js', () => ({
  prisma: mockPrisma,
}));

// Import after mocking
import { TestCaseService } from '../../../src/services/testcase.service.js';

describe('TestCaseService', () => {
  let testCaseService: TestCaseService;

  const mockTestCase: TestCase = {
    id: 'tc-123',
    projectId: 'project-123',
    requirementId: 'req-123',
    title: 'Verify login with valid credentials',
    description: 'Test the login flow',
    preconditions: 'User exists in system',
    steps: [
      { order: 1, action: 'Navigate to login', expected: 'Login page displayed' },
      { order: 2, action: 'Enter credentials', expected: 'Credentials accepted' },
    ],
    expectedResult: 'User logged in successfully',
    testData: { username: 'testuser', password: 'test123' },
    priority: 'high' as Priority,
    status: 'active' as Status,
    type: 'e2e' as TestType,
    isAutomated: false,
    createdById: 'user-123',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    testCaseService = new TestCaseService();
  });

  describe('create', () => {
    it('should create a test case with valid input', async () => {
      mockPrisma.testCase.create.mockResolvedValue(mockTestCase);

      const input = {
        projectId: 'project-123',
        title: 'Verify login with valid credentials',
        description: 'Test the login flow',
        priority: 'high' as Priority,
        type: 'e2e' as TestType,
        createdById: 'user-123',
      };

      const result = await testCaseService.create(input);

      expect(result.title).toBe(input.title);
      expect(result.projectId).toBe(input.projectId);
      expect(mockPrisma.testCase.create).toHaveBeenCalledTimes(1);
    });

    it('should set default values for optional fields', async () => {
      mockPrisma.testCase.create.mockResolvedValue(mockTestCase);

      const input = {
        projectId: 'project-123',
        title: 'Basic test case',
        createdById: 'user-123',
      };

      await testCaseService.create(input);

      const createCall = mockPrisma.testCase.create.mock.calls[0]?.[0];
      expect(createCall?.data?.priority).toBe('medium');
      expect(createCall?.data?.status).toBe('active');
      expect(createCall?.data?.type).toBe('functional');
      expect(createCall?.data?.isAutomated).toBe(false);
    });
  });

  describe('findById', () => {
    it('should return test case by id', async () => {
      mockPrisma.testCase.findUnique.mockResolvedValue(mockTestCase);

      const result = await testCaseService.findById('tc-123');

      expect(result).toEqual(mockTestCase);
      expect(mockPrisma.testCase.findUnique).toHaveBeenCalledWith({
        where: { id: 'tc-123' },
      });
    });

    it('should throw NotFoundError if test case does not exist', async () => {
      mockPrisma.testCase.findUnique.mockResolvedValue(null);

      await expect(testCaseService.findById('nonexistent')).rejects.toThrow(
        "TestCase with id 'nonexistent' not found"
      );
    });
  });

  describe('findByIdWithRelations', () => {
    it('should return test case with related data', async () => {
      const testCaseWithRelations = {
        ...mockTestCase,
        project: { id: 'project-123', name: 'Test Project' },
        requirement: { id: 'req-123', title: 'Login Feature' },
        createdBy: { id: 'user-123', name: 'Test User' },
      };
      mockPrisma.testCase.findUnique.mockResolvedValue(testCaseWithRelations);

      const result = await testCaseService.findByIdWithRelations('tc-123');

      expect(result).toEqual(testCaseWithRelations);
      expect(mockPrisma.testCase.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'tc-123' },
          include: expect.objectContaining({
            project: true,
            requirement: true,
            createdBy: true,
          }),
        })
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated test cases', async () => {
      const testCases = [mockTestCase, { ...mockTestCase, id: 'tc-456' }];
      mockPrisma.testCase.findMany.mockResolvedValue(testCases);
      mockPrisma.testCase.count.mockResolvedValue(2);

      const result = await testCaseService.findAll({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });

    it('should filter by projectId', async () => {
      mockPrisma.testCase.findMany.mockResolvedValue([mockTestCase]);
      mockPrisma.testCase.count.mockResolvedValue(1);

      await testCaseService.findAll({ page: 1, limit: 10, projectId: 'project-123' });

      expect(mockPrisma.testCase.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ projectId: 'project-123' }),
        })
      );
    });

    it('should filter by priority', async () => {
      mockPrisma.testCase.findMany.mockResolvedValue([mockTestCase]);
      mockPrisma.testCase.count.mockResolvedValue(1);

      await testCaseService.findAll({ page: 1, limit: 10, priority: 'high' });

      expect(mockPrisma.testCase.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ priority: 'high' }),
        })
      );
    });

    it('should filter by status', async () => {
      mockPrisma.testCase.findMany.mockResolvedValue([mockTestCase]);
      mockPrisma.testCase.count.mockResolvedValue(1);

      await testCaseService.findAll({ page: 1, limit: 10, status: 'active' });

      expect(mockPrisma.testCase.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'active' }),
        })
      );
    });

    it('should filter by type', async () => {
      mockPrisma.testCase.findMany.mockResolvedValue([mockTestCase]);
      mockPrisma.testCase.count.mockResolvedValue(1);

      await testCaseService.findAll({ page: 1, limit: 10, type: 'e2e' });

      expect(mockPrisma.testCase.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ type: 'e2e' }),
        })
      );
    });

    it('should filter by isAutomated', async () => {
      mockPrisma.testCase.findMany.mockResolvedValue([mockTestCase]);
      mockPrisma.testCase.count.mockResolvedValue(1);

      await testCaseService.findAll({ page: 1, limit: 10, isAutomated: true });

      expect(mockPrisma.testCase.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isAutomated: true }),
        })
      );
    });

    it('should filter by requirementId', async () => {
      mockPrisma.testCase.findMany.mockResolvedValue([mockTestCase]);
      mockPrisma.testCase.count.mockResolvedValue(1);

      await testCaseService.findAll({ page: 1, limit: 10, requirementId: 'req-123' });

      expect(mockPrisma.testCase.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ requirementId: 'req-123' }),
        })
      );
    });
  });

  describe('update', () => {
    it('should update test case fields', async () => {
      mockPrisma.testCase.findUnique.mockResolvedValue(mockTestCase);
      mockPrisma.testCase.update.mockResolvedValue({
        ...mockTestCase,
        title: 'Updated title',
      });

      const result = await testCaseService.update('tc-123', {
        title: 'Updated title',
      });

      expect(result.title).toBe('Updated title');
      expect(mockPrisma.testCase.update).toHaveBeenCalledWith({
        where: { id: 'tc-123' },
        data: { title: 'Updated title' },
      });
    });

    it('should throw NotFoundError if test case does not exist', async () => {
      mockPrisma.testCase.findUnique.mockResolvedValue(null);

      await expect(
        testCaseService.update('nonexistent', { title: 'New title' })
      ).rejects.toThrow("TestCase with id 'nonexistent' not found");
    });

    it('should update steps array', async () => {
      const newSteps = [
        { order: 1, action: 'New step 1', expected: 'Expected 1' },
        { order: 2, action: 'New step 2', expected: 'Expected 2' },
      ];
      mockPrisma.testCase.findUnique.mockResolvedValue(mockTestCase);
      mockPrisma.testCase.update.mockResolvedValue({
        ...mockTestCase,
        steps: newSteps,
      });

      const result = await testCaseService.update('tc-123', { steps: newSteps });

      expect(result.steps).toEqual(newSteps);
    });
  });

  describe('delete', () => {
    it('should delete test case by id', async () => {
      mockPrisma.testCase.findUnique.mockResolvedValue(mockTestCase);
      mockPrisma.testCase.delete.mockResolvedValue(mockTestCase);

      await testCaseService.delete('tc-123');

      expect(mockPrisma.testCase.delete).toHaveBeenCalledWith({
        where: { id: 'tc-123' },
      });
    });

    it('should throw NotFoundError if test case does not exist', async () => {
      mockPrisma.testCase.findUnique.mockResolvedValue(null);

      await expect(testCaseService.delete('nonexistent')).rejects.toThrow(
        "TestCase with id 'nonexistent' not found"
      );
    });
  });

  describe('archive', () => {
    it('should set status to archived', async () => {
      mockPrisma.testCase.findUnique.mockResolvedValue(mockTestCase);
      mockPrisma.testCase.update.mockResolvedValue({
        ...mockTestCase,
        status: 'archived' as Status,
      });

      const result = await testCaseService.archive('tc-123');

      expect(result.status).toBe('archived');
      expect(mockPrisma.testCase.update).toHaveBeenCalledWith({
        where: { id: 'tc-123' },
        data: { status: 'archived' },
      });
    });
  });

  describe('duplicate', () => {
    it('should create a copy of test case with new title', async () => {
      mockPrisma.testCase.findUnique.mockResolvedValue(mockTestCase);
      mockPrisma.testCase.create.mockResolvedValue({
        ...mockTestCase,
        id: 'tc-new',
        title: 'Copy of Verify login with valid credentials',
      });

      const result = await testCaseService.duplicate('tc-123', 'user-456');

      expect(result.id).toBe('tc-new');
      expect(result.title).toContain('Copy of');
      expect(mockPrisma.testCase.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: expect.stringContaining('Copy of'),
            createdById: 'user-456',
          }),
        })
      );
    });
  });

  describe('bulkUpdateStatus', () => {
    it('should update status for multiple test cases', async () => {
      mockPrisma.testCase.updateMany = vi.fn().mockResolvedValue({ count: 3 });

      const result = await testCaseService.bulkUpdateStatus(
        ['tc-1', 'tc-2', 'tc-3'],
        'inactive'
      );

      expect(result.count).toBe(3);
    });
  });

  describe('getByProject', () => {
    it('should return test cases for a project', async () => {
      mockPrisma.testCase.findMany.mockResolvedValue([mockTestCase]);

      const result = await testCaseService.getByProject('project-123');

      expect(result).toHaveLength(1);
      expect(mockPrisma.testCase.findMany).toHaveBeenCalledWith({
        where: { projectId: 'project-123' },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('getByRequirement', () => {
    it('should return test cases for a requirement', async () => {
      mockPrisma.testCase.findMany.mockResolvedValue([mockTestCase]);

      const result = await testCaseService.getByRequirement('req-123');

      expect(result).toHaveLength(1);
      expect(mockPrisma.testCase.findMany).toHaveBeenCalledWith({
        where: { requirementId: 'req-123' },
        orderBy: { createdAt: 'desc' },
      });
    });
  });
});

/**
 * Template Service Unit Tests
 * Sprint 20: Tests for test template management
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// All mocks must be hoisted
const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    testTemplate: {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
    testCase: {
      create: vi.fn(),
    },
  },
}));

vi.mock('../../../src/utils/prisma.js', () => ({ prisma: mockPrisma }));

import { TemplateService } from '../../../src/services/template.service.js';
import { NotFoundError, ConflictError } from '../../../src/errors/index.js';

describe('TemplateService', () => {
  let service: TemplateService;

  const mockTemplate = {
    id: 'template-123',
    name: 'Login Flow',
    description: 'Test user login',
    category: 'auth',
    content: {
      steps: [
        { order: 1, action: 'Navigate to login', expected: 'Login page displayed' },
        { order: 2, action: 'Enter credentials', expected: 'Credentials entered' },
      ],
      preconditions: 'User account exists',
      expectedResult: 'User is logged in',
    },
    variables: ['{{username}}', '{{password}}'],
    tags: ['login', 'auth'],
    testType: 'functional',
    priority: 'high',
    isBuiltIn: false,
    isPublic: true,
    projectId: null,
    createdById: 'user-123',
    usageCount: 5,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockBuiltInTemplate = {
    ...mockTemplate,
    id: 'builtin-123',
    name: 'Built-in Template',
    isBuiltIn: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TemplateService();
  });

  // ==========================================================================
  // CREATE
  // ==========================================================================

  describe('create', () => {
    it('should create a custom template', async () => {
      mockPrisma.testTemplate.findFirst.mockResolvedValue(null);
      mockPrisma.testTemplate.create.mockResolvedValue(mockTemplate);

      const result = await service.create({
        name: 'Login Flow',
        description: 'Test user login',
        category: 'auth',
        content: {
          steps: [{ order: 1, action: 'Navigate', expected: 'Page loads' }],
        },
        variables: ['{{username}}'],
        tags: ['login'],
        createdById: 'user-123',
      });

      expect(result).toEqual(mockTemplate);
      expect(mockPrisma.testTemplate.create).toHaveBeenCalled();
    });

    it('should throw ConflictError if template name exists', async () => {
      mockPrisma.testTemplate.findFirst.mockResolvedValue(mockTemplate);

      await expect(
        service.create({
          name: 'Login Flow',
          category: 'auth',
          content: { steps: [{ order: 1, action: 'Test', expected: 'Pass' }] },
        })
      ).rejects.toThrow(ConflictError);
    });
  });

  // ==========================================================================
  // UPDATE
  // ==========================================================================

  describe('update', () => {
    it('should update a custom template', async () => {
      const updatedTemplate = { ...mockTemplate, name: 'Updated Login' };
      mockPrisma.testTemplate.findUnique.mockResolvedValue(mockTemplate);
      mockPrisma.testTemplate.findFirst.mockResolvedValue(null);
      mockPrisma.testTemplate.update.mockResolvedValue(updatedTemplate);

      const result = await service.update('template-123', { name: 'Updated Login' });

      expect(result.name).toBe('Updated Login');
    });

    it('should throw ConflictError when updating built-in template', async () => {
      mockPrisma.testTemplate.findUnique.mockResolvedValue(mockBuiltInTemplate);

      await expect(
        service.update('builtin-123', { name: 'New Name' })
      ).rejects.toThrow(ConflictError);
    });

    it('should throw ConflictError on name conflict', async () => {
      const otherTemplate = { ...mockTemplate, id: 'other-123', name: 'Other Template' };
      mockPrisma.testTemplate.findUnique.mockResolvedValue(mockTemplate);
      mockPrisma.testTemplate.findFirst.mockResolvedValue(otherTemplate);

      await expect(
        service.update('template-123', { name: 'Other Template' })
      ).rejects.toThrow(ConflictError);
    });
  });

  // ==========================================================================
  // DELETE
  // ==========================================================================

  describe('delete', () => {
    it('should delete a custom template', async () => {
      mockPrisma.testTemplate.findUnique.mockResolvedValue(mockTemplate);
      mockPrisma.testTemplate.delete.mockResolvedValue(mockTemplate);

      await service.delete('template-123');

      expect(mockPrisma.testTemplate.delete).toHaveBeenCalledWith({
        where: { id: 'template-123' },
      });
    });

    it('should throw ConflictError when deleting built-in template', async () => {
      mockPrisma.testTemplate.findUnique.mockResolvedValue(mockBuiltInTemplate);

      await expect(service.delete('builtin-123')).rejects.toThrow(ConflictError);
    });

    it('should throw NotFoundError for non-existent template', async () => {
      mockPrisma.testTemplate.findUnique.mockResolvedValue(null);

      await expect(service.delete('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  // ==========================================================================
  // FIND
  // ==========================================================================

  describe('findById', () => {
    it('should return template by ID', async () => {
      mockPrisma.testTemplate.findUnique.mockResolvedValue(mockTemplate);

      const result = await service.findById('template-123');

      expect(result).toEqual(mockTemplate);
    });

    it('should throw NotFoundError for non-existent template', async () => {
      mockPrisma.testTemplate.findUnique.mockResolvedValue(null);

      await expect(service.findById('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  // ==========================================================================
  // LIST
  // ==========================================================================

  describe('list', () => {
    it('should return paginated templates', async () => {
      mockPrisma.testTemplate.findMany.mockResolvedValue([mockTemplate]);
      mockPrisma.testTemplate.count.mockResolvedValue(1);

      const result = await service.list({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by category', async () => {
      mockPrisma.testTemplate.findMany.mockResolvedValue([mockTemplate]);
      mockPrisma.testTemplate.count.mockResolvedValue(1);

      await service.list({ category: 'auth' });

      expect(mockPrisma.testTemplate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              { category: 'auth' },
            ]),
          }),
        })
      );
    });

    it('should filter by built-in status', async () => {
      mockPrisma.testTemplate.findMany.mockResolvedValue([mockBuiltInTemplate]);
      mockPrisma.testTemplate.count.mockResolvedValue(1);

      await service.list({ isBuiltIn: true });

      expect(mockPrisma.testTemplate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              { isBuiltIn: true },
            ]),
          }),
        })
      );
    });

    it('should filter by search term', async () => {
      mockPrisma.testTemplate.findMany.mockResolvedValue([mockTemplate]);
      mockPrisma.testTemplate.count.mockResolvedValue(1);

      await service.list({ search: 'login' });

      expect(mockPrisma.testTemplate.findMany).toHaveBeenCalled();
    });

    it('should filter by tags', async () => {
      mockPrisma.testTemplate.findMany.mockResolvedValue([mockTemplate]);
      mockPrisma.testTemplate.count.mockResolvedValue(1);

      await service.list({ tags: ['auth', 'login'] });

      expect(mockPrisma.testTemplate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              { tags: { hasSome: ['auth', 'login'] } },
            ]),
          }),
        })
      );
    });
  });

  // ==========================================================================
  // GET BY CATEGORY
  // ==========================================================================

  describe('getByCategory', () => {
    it('should return templates for category', async () => {
      mockPrisma.testTemplate.findMany.mockResolvedValue([mockTemplate]);

      const result = await service.getByCategory('auth');

      expect(result).toHaveLength(1);
      expect(mockPrisma.testTemplate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            category: 'auth',
          }),
        })
      );
    });
  });

  // ==========================================================================
  // USE TEMPLATE
  // ==========================================================================

  describe('useTemplate', () => {
    const mockTestCase = {
      id: 'tc-123',
      projectId: 'project-123',
      title: 'Login Flow',
      description: 'Test user login',
      steps: mockTemplate.content.steps,
      priority: 'high',
      type: 'functional',
    };

    it('should create test case from template', async () => {
      mockPrisma.testTemplate.findUnique.mockResolvedValue(mockTemplate);
      mockPrisma.testCase.create.mockResolvedValue(mockTestCase);
      mockPrisma.testTemplate.update.mockResolvedValue({ ...mockTemplate, usageCount: 6 });

      const result = await service.useTemplate({
        templateId: 'template-123',
        projectId: 'project-123',
        createdById: 'user-123',
      });

      expect(result).toEqual(mockTestCase);
      expect(mockPrisma.testTemplate.update).toHaveBeenCalledWith({
        where: { id: 'template-123' },
        data: { usageCount: { increment: 1 } },
      });
    });

    it('should replace variables in template content', async () => {
      mockPrisma.testTemplate.findUnique.mockResolvedValue(mockTemplate);
      mockPrisma.testCase.create.mockResolvedValue(mockTestCase);
      mockPrisma.testTemplate.update.mockResolvedValue(mockTemplate);

      await service.useTemplate({
        templateId: 'template-123',
        projectId: 'project-123',
        createdById: 'user-123',
        variableValues: {
          username: 'testuser',
          password: 'secret123',
        },
      });

      expect(mockPrisma.testCase.create).toHaveBeenCalled();
    });

    it('should apply overrides when provided', async () => {
      mockPrisma.testTemplate.findUnique.mockResolvedValue(mockTemplate);
      mockPrisma.testCase.create.mockResolvedValue({ ...mockTestCase, title: 'Custom Title' });
      mockPrisma.testTemplate.update.mockResolvedValue(mockTemplate);

      await service.useTemplate({
        templateId: 'template-123',
        projectId: 'project-123',
        createdById: 'user-123',
        overrides: {
          title: 'Custom Title',
          priority: 'critical',
        },
      });

      expect(mockPrisma.testCase.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'Custom Title',
            priority: 'critical',
          }),
        })
      );
    });

    it('should throw NotFoundError for non-existent template', async () => {
      mockPrisma.testTemplate.findUnique.mockResolvedValue(null);

      await expect(
        service.useTemplate({
          templateId: 'nonexistent',
          projectId: 'project-123',
          createdById: 'user-123',
        })
      ).rejects.toThrow(NotFoundError);
    });
  });

  // ==========================================================================
  // STATS AND TAGS
  // ==========================================================================

  describe('getAllTags', () => {
    it('should return unique tags across templates', async () => {
      mockPrisma.testTemplate.findMany.mockResolvedValue([
        { tags: ['auth', 'login'] },
        { tags: ['auth', 'security'] },
        { tags: ['crud'] },
      ]);

      const result = await service.getAllTags();

      expect(result).toContain('auth');
      expect(result).toContain('login');
      expect(result).toContain('security');
      expect(result).toContain('crud');
      expect(result).toHaveLength(4);
    });
  });

  describe('getCategoryStats', () => {
    it('should return category counts', async () => {
      mockPrisma.testTemplate.groupBy.mockResolvedValue([
        { category: 'auth', _count: { id: 5 } },
        { category: 'crud', _count: { id: 3 } },
      ]);

      const result = await service.getCategoryStats();

      expect(result).toContainEqual({ category: 'auth', count: 5 });
      expect(result).toContainEqual({ category: 'crud', count: 3 });
    });
  });

  // ==========================================================================
  // SEED BUILT-IN TEMPLATES
  // ==========================================================================

  describe('seedBuiltInTemplates', () => {
    it('should create built-in templates that do not exist', async () => {
      mockPrisma.testTemplate.findFirst.mockResolvedValue(null);
      mockPrisma.testTemplate.create.mockResolvedValue(mockBuiltInTemplate);

      const result = await service.seedBuiltInTemplates();

      expect(result.created).toBeGreaterThan(0);
      expect(mockPrisma.testTemplate.create).toHaveBeenCalled();
    });

    it('should skip existing built-in templates', async () => {
      mockPrisma.testTemplate.findFirst.mockResolvedValue(mockBuiltInTemplate);

      const result = await service.seedBuiltInTemplates();

      expect(result.skipped).toBeGreaterThan(0);
      expect(mockPrisma.testTemplate.create).not.toHaveBeenCalled();
    });
  });
});

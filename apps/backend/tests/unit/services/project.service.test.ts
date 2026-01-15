/**
 * Project Service Tests (TDD - RED phase)
 * These tests define the expected behavior before implementation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Project, Framework, Language } from '@prisma/client';

// Mock Prisma client - must be hoisted with vi.hoisted
const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    project: {
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
import { ProjectService } from '../../../src/services/project.service.js';

describe('ProjectService', () => {
  let projectService: ProjectService;

  const mockProject: Project = {
    id: 'project-123',
    name: 'Test Project',
    description: 'A test project description',
    repositoryUrl: 'https://github.com/test/repo',
    framework: 'playwright' as Framework,
    language: 'typescript' as Language,
    createdById: 'user-123',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    projectService = new ProjectService();
  });

  describe('create', () => {
    it('should create a project with valid input', async () => {
      mockPrisma.project.create.mockResolvedValue(mockProject);

      const input = {
        name: 'Test Project',
        description: 'A test project description',
        repositoryUrl: 'https://github.com/test/repo',
        framework: 'playwright' as Framework,
        language: 'typescript' as Language,
        createdById: 'user-123',
      };

      const result = await projectService.create(input);

      expect(result.name).toBe(input.name);
      expect(result.framework).toBe(input.framework);
      expect(result.language).toBe(input.language);
      expect(mockPrisma.project.create).toHaveBeenCalledTimes(1);
    });

    it('should set default values for optional fields', async () => {
      mockPrisma.project.create.mockResolvedValue(mockProject);

      const input = {
        name: 'Test Project',
        createdById: 'user-123',
      };

      await projectService.create(input);

      const createCall = mockPrisma.project.create.mock.calls[0]?.[0];
      expect(createCall?.data?.isActive).toBe(true);
    });
  });

  describe('findById', () => {
    it('should return project by id', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(mockProject);

      const result = await projectService.findById('project-123');

      expect(result).toEqual(mockProject);
      expect(mockPrisma.project.findUnique).toHaveBeenCalledWith({
        where: { id: 'project-123' },
      });
    });

    it('should throw NotFoundError if project does not exist', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(null);

      await expect(projectService.findById('nonexistent')).rejects.toThrow(
        "Project with id 'nonexistent' not found"
      );
    });
  });

  describe('findByIdWithRelations', () => {
    it('should return project with related data', async () => {
      const projectWithRelations = {
        ...mockProject,
        createdBy: { id: 'user-123', name: 'Test User' },
        requirements: [],
        testCases: [],
        environments: [],
      };
      mockPrisma.project.findUnique.mockResolvedValue(projectWithRelations);

      const result = await projectService.findByIdWithRelations('project-123');

      expect(result).toEqual(projectWithRelations);
      expect(mockPrisma.project.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'project-123' },
          include: expect.objectContaining({
            createdBy: true,
          }),
        })
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated projects', async () => {
      const projects = [mockProject, { ...mockProject, id: 'project-456' }];
      mockPrisma.project.findMany.mockResolvedValue(projects);
      mockPrisma.project.count.mockResolvedValue(2);

      const result = await projectService.findAll({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });

    it('should filter by framework', async () => {
      mockPrisma.project.findMany.mockResolvedValue([mockProject]);
      mockPrisma.project.count.mockResolvedValue(1);

      await projectService.findAll({ page: 1, limit: 10, framework: 'playwright' });

      expect(mockPrisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ framework: 'playwright' }),
        })
      );
    });

    it('should filter by language', async () => {
      mockPrisma.project.findMany.mockResolvedValue([mockProject]);
      mockPrisma.project.count.mockResolvedValue(1);

      await projectService.findAll({ page: 1, limit: 10, language: 'typescript' });

      expect(mockPrisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ language: 'typescript' }),
        })
      );
    });

    it('should filter by isActive', async () => {
      mockPrisma.project.findMany.mockResolvedValue([mockProject]);
      mockPrisma.project.count.mockResolvedValue(1);

      await projectService.findAll({ page: 1, limit: 10, isActive: true });

      expect(mockPrisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isActive: true }),
        })
      );
    });

    it('should filter by createdById', async () => {
      mockPrisma.project.findMany.mockResolvedValue([mockProject]);
      mockPrisma.project.count.mockResolvedValue(1);

      await projectService.findAll({ page: 1, limit: 10, createdById: 'user-123' });

      expect(mockPrisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ createdById: 'user-123' }),
        })
      );
    });
  });

  describe('update', () => {
    it('should update project fields', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockPrisma.project.update.mockResolvedValue({
        ...mockProject,
        name: 'Updated Project',
      });

      const result = await projectService.update('project-123', {
        name: 'Updated Project',
      });

      expect(result.name).toBe('Updated Project');
      expect(mockPrisma.project.update).toHaveBeenCalledWith({
        where: { id: 'project-123' },
        data: { name: 'Updated Project' },
      });
    });

    it('should throw NotFoundError if project does not exist', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(null);

      await expect(
        projectService.update('nonexistent', { name: 'New Name' })
      ).rejects.toThrow("Project with id 'nonexistent' not found");
    });
  });

  describe('delete', () => {
    it('should delete project by id', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockPrisma.project.delete.mockResolvedValue(mockProject);

      await projectService.delete('project-123');

      expect(mockPrisma.project.delete).toHaveBeenCalledWith({
        where: { id: 'project-123' },
      });
    });

    it('should throw NotFoundError if project does not exist', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(null);

      await expect(projectService.delete('nonexistent')).rejects.toThrow(
        "Project with id 'nonexistent' not found"
      );
    });
  });

  describe('deactivate', () => {
    it('should set isActive to false', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockPrisma.project.update.mockResolvedValue({
        ...mockProject,
        isActive: false,
      });

      const result = await projectService.deactivate('project-123');

      expect(result.isActive).toBe(false);
      expect(mockPrisma.project.update).toHaveBeenCalledWith({
        where: { id: 'project-123' },
        data: { isActive: false },
      });
    });
  });

  describe('activate', () => {
    it('should set isActive to true', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        ...mockProject,
        isActive: false,
      });
      mockPrisma.project.update.mockResolvedValue({
        ...mockProject,
        isActive: true,
      });

      const result = await projectService.activate('project-123');

      expect(result.isActive).toBe(true);
      expect(mockPrisma.project.update).toHaveBeenCalledWith({
        where: { id: 'project-123' },
        data: { isActive: true },
      });
    });
  });

  describe('getProjectStats', () => {
    it('should return project statistics', async () => {
      const projectWithCounts = {
        ...mockProject,
        _count: {
          requirements: 5,
          testCases: 20,
          environments: 3,
          testSuites: 2,
        },
      };
      mockPrisma.project.findUnique.mockResolvedValue(projectWithCounts);

      const result = await projectService.getProjectStats('project-123');

      expect(result.requirementCount).toBe(5);
      expect(result.testCaseCount).toBe(20);
      expect(result.environmentCount).toBe(3);
      expect(result.testSuiteCount).toBe(2);
    });

    it('should throw NotFoundError if project does not exist', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(null);

      await expect(projectService.getProjectStats('nonexistent')).rejects.toThrow(
        "Project with id 'nonexistent' not found"
      );
    });
  });
});

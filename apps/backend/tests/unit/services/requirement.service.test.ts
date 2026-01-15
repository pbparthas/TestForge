/**
 * Requirement Service Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Requirement, Priority, Status } from '@prisma/client';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    requirement: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock('../../../src/utils/prisma.js', () => ({ prisma: mockPrisma }));

import { RequirementService } from '../../../src/services/requirement.service.js';

describe('RequirementService', () => {
  let service: RequirementService;

  const mockRequirement: Requirement = {
    id: 'req-123',
    projectId: 'project-123',
    externalId: 'JIRA-123',
    title: 'User Login Feature',
    description: 'Users should be able to login',
    priority: 'high' as Priority,
    status: 'active' as Status,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new RequirementService();
  });

  describe('create', () => {
    it('should create a requirement', async () => {
      mockPrisma.requirement.create.mockResolvedValue(mockRequirement);
      const result = await service.create({
        projectId: 'project-123',
        title: 'User Login Feature',
      });
      expect(result.title).toBe('User Login Feature');
    });
  });

  describe('findById', () => {
    it('should return requirement by id', async () => {
      mockPrisma.requirement.findUnique.mockResolvedValue(mockRequirement);
      const result = await service.findById('req-123');
      expect(result).toEqual(mockRequirement);
    });

    it('should throw NotFoundError if not found', async () => {
      mockPrisma.requirement.findUnique.mockResolvedValue(null);
      await expect(service.findById('nonexistent')).rejects.toThrow("Requirement with id 'nonexistent' not found");
    });
  });

  describe('findAll', () => {
    it('should return paginated requirements', async () => {
      mockPrisma.requirement.findMany.mockResolvedValue([mockRequirement]);
      mockPrisma.requirement.count.mockResolvedValue(1);
      const result = await service.findAll({ page: 1, limit: 10 });
      expect(result.data).toHaveLength(1);
    });
  });

  describe('update', () => {
    it('should update requirement', async () => {
      mockPrisma.requirement.findUnique.mockResolvedValue(mockRequirement);
      mockPrisma.requirement.update.mockResolvedValue({ ...mockRequirement, title: 'Updated' });
      const result = await service.update('req-123', { title: 'Updated' });
      expect(result.title).toBe('Updated');
    });
  });

  describe('delete', () => {
    it('should delete requirement', async () => {
      mockPrisma.requirement.findUnique.mockResolvedValue(mockRequirement);
      mockPrisma.requirement.delete.mockResolvedValue(mockRequirement);
      await service.delete('req-123');
      expect(mockPrisma.requirement.delete).toHaveBeenCalled();
    });
  });

  describe('archive', () => {
    it('should archive requirement', async () => {
      mockPrisma.requirement.findUnique.mockResolvedValue(mockRequirement);
      mockPrisma.requirement.update.mockResolvedValue({ ...mockRequirement, status: 'archived' });
      const result = await service.archive('req-123');
      expect(result.status).toBe('archived');
    });
  });

  describe('getByProject', () => {
    it('should return requirements by project', async () => {
      mockPrisma.requirement.findMany.mockResolvedValue([mockRequirement]);
      const result = await service.getByProject('project-123');
      expect(result).toHaveLength(1);
    });
  });
});

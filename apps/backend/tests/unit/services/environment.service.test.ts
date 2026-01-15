/**
 * Environment Service Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Environment } from '@prisma/client';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    environment: {
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

import { EnvironmentService } from '../../../src/services/environment.service.js';

describe('EnvironmentService', () => {
  let service: EnvironmentService;

  const mockEnvironment: Environment = {
    id: 'env-123',
    projectId: 'project-123',
    name: 'Development',
    baseUrl: 'http://localhost:3000',
    variables: { API_KEY: 'test' },
    isActive: true,
    createdAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new EnvironmentService();
  });

  describe('create', () => {
    it('should create an environment', async () => {
      mockPrisma.environment.create.mockResolvedValue(mockEnvironment);
      const result = await service.create({
        projectId: 'project-123',
        name: 'Development',
        baseUrl: 'http://localhost:3000',
      });
      expect(result.name).toBe('Development');
    });
  });

  describe('findById', () => {
    it('should return environment by id', async () => {
      mockPrisma.environment.findUnique.mockResolvedValue(mockEnvironment);
      const result = await service.findById('env-123');
      expect(result).toEqual(mockEnvironment);
    });

    it('should throw NotFoundError if not found', async () => {
      mockPrisma.environment.findUnique.mockResolvedValue(null);
      await expect(service.findById('nonexistent')).rejects.toThrow("Environment with id 'nonexistent' not found");
    });
  });

  describe('findAll', () => {
    it('should return paginated environments', async () => {
      mockPrisma.environment.findMany.mockResolvedValue([mockEnvironment]);
      mockPrisma.environment.count.mockResolvedValue(1);
      const result = await service.findAll({ page: 1, limit: 10 });
      expect(result.data).toHaveLength(1);
    });
  });

  describe('update', () => {
    it('should update environment', async () => {
      mockPrisma.environment.findUnique.mockResolvedValue(mockEnvironment);
      mockPrisma.environment.update.mockResolvedValue({ ...mockEnvironment, name: 'Staging' });
      const result = await service.update('env-123', { name: 'Staging' });
      expect(result.name).toBe('Staging');
    });
  });

  describe('delete', () => {
    it('should delete environment', async () => {
      mockPrisma.environment.findUnique.mockResolvedValue(mockEnvironment);
      mockPrisma.environment.delete.mockResolvedValue(mockEnvironment);
      await service.delete('env-123');
      expect(mockPrisma.environment.delete).toHaveBeenCalled();
    });
  });

  describe('activate', () => {
    it('should activate environment', async () => {
      mockPrisma.environment.findUnique.mockResolvedValue({ ...mockEnvironment, isActive: false });
      mockPrisma.environment.update.mockResolvedValue(mockEnvironment);
      const result = await service.activate('env-123');
      expect(result.isActive).toBe(true);
    });
  });

  describe('deactivate', () => {
    it('should deactivate environment', async () => {
      mockPrisma.environment.findUnique.mockResolvedValue(mockEnvironment);
      mockPrisma.environment.update.mockResolvedValue({ ...mockEnvironment, isActive: false });
      const result = await service.deactivate('env-123');
      expect(result.isActive).toBe(false);
    });
  });

  describe('getByProject', () => {
    it('should return environments by project', async () => {
      mockPrisma.environment.findMany.mockResolvedValue([mockEnvironment]);
      const result = await service.getByProject('project-123');
      expect(result).toHaveLength(1);
    });
  });

  describe('duplicate', () => {
    it('should duplicate environment', async () => {
      mockPrisma.environment.findUnique.mockResolvedValue(mockEnvironment);
      mockPrisma.environment.create.mockResolvedValue({
        ...mockEnvironment,
        id: 'env-new',
        name: 'Copy of Development',
      });
      const result = await service.duplicate('env-123');
      expect(result.name).toContain('Copy of');
    });
  });
});

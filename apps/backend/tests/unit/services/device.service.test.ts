/**
 * Device Service Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Device } from '@prisma/client';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    device: {
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

import { DeviceService } from '../../../src/services/device.service.js';

describe('DeviceService', () => {
  let service: DeviceService;

  const mockDevice: Device = {
    id: 'device-1',
    projectId: 'proj-1',
    name: 'Chrome Desktop',
    type: 'desktop' as const,
    config: { browser: 'chrome', headless: true },
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new DeviceService();
  });

  describe('create', () => {
    it('should create a device with provided input', async () => {
      mockPrisma.device.create.mockResolvedValue(mockDevice);

      const result = await service.create({
        projectId: 'proj-1',
        name: 'Chrome Desktop',
        type: 'desktop' as const,
        config: { browser: 'chrome', headless: true },
      });

      expect(result).toEqual(mockDevice);
      expect(mockPrisma.device.create).toHaveBeenCalledWith({
        data: {
          projectId: 'proj-1',
          name: 'Chrome Desktop',
          type: 'desktop',
          config: { browser: 'chrome', headless: true },
          isActive: true,
        },
      });
    });

    it('should default isActive to true when not provided', async () => {
      mockPrisma.device.create.mockResolvedValue(mockDevice);

      await service.create({
        projectId: 'proj-1',
        name: 'Chrome Desktop',
        type: 'desktop' as const,
        config: { browser: 'chrome' },
      });

      expect(mockPrisma.device.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isActive: true }),
        })
      );
    });
  });

  describe('findById', () => {
    it('should return device by id', async () => {
      mockPrisma.device.findUnique.mockResolvedValue(mockDevice);

      const result = await service.findById('device-1');

      expect(result).toEqual(mockDevice);
      expect(mockPrisma.device.findUnique).toHaveBeenCalledWith({ where: { id: 'device-1' } });
    });

    it('should throw NotFoundError if device not found', async () => {
      mockPrisma.device.findUnique.mockResolvedValue(null);

      await expect(service.findById('nonexistent')).rejects.toThrow(
        "Device with id 'nonexistent' not found"
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated devices', async () => {
      mockPrisma.device.findMany.mockResolvedValue([mockDevice]);
      mockPrisma.device.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.totalPages).toBe(1);
      expect(mockPrisma.device.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 0,
        take: 10,
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should apply filters for projectId, type, and isActive', async () => {
      mockPrisma.device.findMany.mockResolvedValue([mockDevice]);
      mockPrisma.device.count.mockResolvedValue(1);

      const result = await service.findAll({
        page: 1,
        limit: 10,
        projectId: 'proj-1',
        type: 'desktop' as const,
        isActive: true,
      });

      expect(result.data).toHaveLength(1);
      expect(mockPrisma.device.findMany).toHaveBeenCalledWith({
        where: { projectId: 'proj-1', type: 'desktop', isActive: true },
        skip: 0,
        take: 10,
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should calculate correct skip for page 2', async () => {
      mockPrisma.device.findMany.mockResolvedValue([]);
      mockPrisma.device.count.mockResolvedValue(15);

      const result = await service.findAll({ page: 2, limit: 10 });

      expect(result.totalPages).toBe(2);
      expect(mockPrisma.device.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 })
      );
    });
  });

  describe('update', () => {
    it('should update device when it exists', async () => {
      const updatedDevice = { ...mockDevice, name: 'Firefox Desktop' };
      mockPrisma.device.findUnique.mockResolvedValue(mockDevice);
      mockPrisma.device.update.mockResolvedValue(updatedDevice);

      const result = await service.update('device-1', { name: 'Firefox Desktop' });

      expect(result.name).toBe('Firefox Desktop');
      expect(mockPrisma.device.findUnique).toHaveBeenCalledWith({ where: { id: 'device-1' } });
      expect(mockPrisma.device.update).toHaveBeenCalledWith({
        where: { id: 'device-1' },
        data: { name: 'Firefox Desktop' },
      });
    });

    it('should throw NotFoundError if device not found on update', async () => {
      mockPrisma.device.findUnique.mockResolvedValue(null);

      await expect(service.update('nonexistent', { name: 'New' })).rejects.toThrow(
        "Device with id 'nonexistent' not found"
      );
      expect(mockPrisma.device.update).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should delete device when it exists', async () => {
      mockPrisma.device.findUnique.mockResolvedValue(mockDevice);
      mockPrisma.device.delete.mockResolvedValue(mockDevice);

      await service.delete('device-1');

      expect(mockPrisma.device.findUnique).toHaveBeenCalledWith({ where: { id: 'device-1' } });
      expect(mockPrisma.device.delete).toHaveBeenCalledWith({ where: { id: 'device-1' } });
    });

    it('should throw NotFoundError if device not found on delete', async () => {
      mockPrisma.device.findUnique.mockResolvedValue(null);

      await expect(service.delete('nonexistent')).rejects.toThrow(
        "Device with id 'nonexistent' not found"
      );
      expect(mockPrisma.device.delete).not.toHaveBeenCalled();
    });
  });

  describe('getByProject', () => {
    it('should return devices for a project ordered by createdAt desc', async () => {
      mockPrisma.device.findMany.mockResolvedValue([mockDevice]);

      const result = await service.getByProject('proj-1');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockDevice);
      expect(mockPrisma.device.findMany).toHaveBeenCalledWith({
        where: { projectId: 'proj-1' },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('getActiveByProject', () => {
    it('should return only active devices for a project ordered by name asc', async () => {
      mockPrisma.device.findMany.mockResolvedValue([mockDevice]);

      const result = await service.getActiveByProject('proj-1');

      expect(result).toHaveLength(1);
      expect(result[0].isActive).toBe(true);
      expect(mockPrisma.device.findMany).toHaveBeenCalledWith({
        where: { projectId: 'proj-1', isActive: true },
        orderBy: { name: 'asc' },
      });
    });
  });
});

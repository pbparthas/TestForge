/**
 * File Lock Service Tests
 * TDD for concurrent edit prevention via file locking
 */

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    fileLock: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    gitIntegration: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('../../../src/utils/prisma.js', () => ({ prisma: mockPrisma }));

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FileLockService } from '../../../src/services/file-lock.service.js';
import { NotFoundError, ConflictError } from '../../../src/errors/index.js';

describe('FileLockService', () => {
  let service: FileLockService;

  const mockIntegration = {
    id: 'git-int-123',
    projectId: 'proj-123',
    isActive: true,
  };

  const mockLock = {
    id: 'lock-123',
    integrationId: 'git-int-123',
    scriptId: 'script-123',
    userId: 'user-123',
    filePath: 'tests/login.spec.ts',
    lockedAt: new Date(),
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    isReleased: false,
    releasedAt: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new FileLockService();
  });

  describe('acquireLock', () => {
    it('should create a lock when no existing lock', async () => {
      mockPrisma.fileLock.findFirst.mockResolvedValue(null);
      mockPrisma.fileLock.create.mockResolvedValue(mockLock);

      const result = await service.acquireLock({
        integrationId: 'git-int-123',
        scriptId: 'script-123',
        userId: 'user-123',
        filePath: 'tests/login.spec.ts',
      });

      expect(result).toEqual(mockLock);
      expect(mockPrisma.fileLock.create).toHaveBeenCalled();
    });

    it('should throw ConflictError when locked by another user', async () => {
      const otherLock = { ...mockLock, userId: 'other-user' };
      mockPrisma.fileLock.findFirst.mockResolvedValue(otherLock);

      await expect(
        service.acquireLock({
          integrationId: 'git-int-123',
          scriptId: 'script-123',
          userId: 'user-123',
          filePath: 'tests/login.spec.ts',
        })
      ).rejects.toThrow(ConflictError);
    });

    it('should return existing lock if same user already holds it', async () => {
      mockPrisma.fileLock.findFirst.mockResolvedValue(mockLock);

      const result = await service.acquireLock({
        integrationId: 'git-int-123',
        scriptId: 'script-123',
        userId: 'user-123',
        filePath: 'tests/login.spec.ts',
      });

      expect(result).toEqual(mockLock);
      expect(mockPrisma.fileLock.create).not.toHaveBeenCalled();
    });

    it('should auto-release expired lock and acquire new one', async () => {
      const expiredLock = {
        ...mockLock,
        userId: 'other-user',
        expiresAt: new Date(Date.now() - 1000),
      };
      mockPrisma.fileLock.findFirst.mockResolvedValue(expiredLock);
      mockPrisma.fileLock.update.mockResolvedValue({ ...expiredLock, isReleased: true });
      mockPrisma.fileLock.create.mockResolvedValue(mockLock);

      const result = await service.acquireLock({
        integrationId: 'git-int-123',
        scriptId: 'script-123',
        userId: 'user-123',
        filePath: 'tests/login.spec.ts',
      });

      expect(mockPrisma.fileLock.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: expiredLock.id },
          data: expect.objectContaining({ isReleased: true }),
        })
      );
      expect(result).toEqual(mockLock);
    });
  });

  describe('releaseLock', () => {
    it('should mark lock as released', async () => {
      const releasedLock = { ...mockLock, isReleased: true, releasedAt: new Date() };
      mockPrisma.fileLock.findUnique.mockResolvedValue(mockLock);
      mockPrisma.fileLock.update.mockResolvedValue(releasedLock);

      const result = await service.releaseLock('lock-123');

      expect(result.isReleased).toBe(true);
      expect(mockPrisma.fileLock.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'lock-123' },
          data: expect.objectContaining({ isReleased: true }),
        })
      );
    });

    it('should throw NotFoundError when lock does not exist', async () => {
      mockPrisma.fileLock.findUnique.mockResolvedValue(null);

      await expect(service.releaseLock('missing-lock')).rejects.toThrow(NotFoundError);
    });
  });

  describe('checkLock', () => {
    it('should return active lock info', async () => {
      mockPrisma.fileLock.findFirst.mockResolvedValue(mockLock);

      const result = await service.checkLock('script-123');

      expect(result).toEqual(mockLock);
    });

    it('should return null when no active lock', async () => {
      mockPrisma.fileLock.findFirst.mockResolvedValue(null);

      const result = await service.checkLock('script-123');

      expect(result).toBeNull();
    });
  });

  describe('extendLock', () => {
    it('should push expiry forward', async () => {
      const extended = { ...mockLock, expiresAt: new Date(Date.now() + 60 * 60 * 1000) };
      mockPrisma.fileLock.findUnique.mockResolvedValue(mockLock);
      mockPrisma.fileLock.update.mockResolvedValue(extended);

      const result = await service.extendLock('lock-123', 30);

      expect(mockPrisma.fileLock.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'lock-123' },
          data: expect.objectContaining({ expiresAt: expect.any(Date) }),
        })
      );
      expect(result.expiresAt.getTime()).toBeGreaterThan(mockLock.expiresAt.getTime());
    });

    it('should throw NotFoundError when lock does not exist', async () => {
      mockPrisma.fileLock.findUnique.mockResolvedValue(null);

      await expect(service.extendLock('missing', 30)).rejects.toThrow(NotFoundError);
    });
  });

  describe('cleanupExpiredLocks', () => {
    it('should release all expired locks', async () => {
      mockPrisma.fileLock.updateMany.mockResolvedValue({ count: 3 });

      const count = await service.cleanupExpiredLocks();

      expect(count).toBe(3);
      expect(mockPrisma.fileLock.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isReleased: false,
            expiresAt: expect.objectContaining({ lt: expect.any(Date) }),
          }),
        })
      );
    });
  });

  describe('getApproachingExpiry', () => {
    it('should return locks expiring within the threshold', async () => {
      const soonLock = {
        ...mockLock,
        expiresAt: new Date(Date.now() + 3 * 60 * 1000), // 3 min from now
        integration: { projectId: 'proj-123' },
      };
      mockPrisma.fileLock.findMany.mockResolvedValue([soonLock]);

      const result = await service.getApproachingExpiry(5);

      expect(result).toHaveLength(1);
      expect(mockPrisma.fileLock.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isReleased: false,
          }),
          include: expect.objectContaining({
            integration: true,
          }),
        })
      );
    });

    it('should return empty array when no locks approaching expiry', async () => {
      mockPrisma.fileLock.findMany.mockResolvedValue([]);

      const result = await service.getApproachingExpiry(5);

      expect(result).toHaveLength(0);
    });
  });

  describe('forceRelease', () => {
    it('should force release a lock regardless of user', async () => {
      mockPrisma.fileLock.findFirst.mockResolvedValue(mockLock);
      mockPrisma.fileLock.update.mockResolvedValue({ ...mockLock, isReleased: true });

      const result = await service.forceRelease('script-123');

      expect(result.isReleased).toBe(true);
    });

    it('should throw NotFoundError when no active lock exists', async () => {
      mockPrisma.fileLock.findFirst.mockResolvedValue(null);

      await expect(service.forceRelease('script-123')).rejects.toThrow(NotFoundError);
    });
  });
});

/**
 * File Lock Service
 * Concurrent edit prevention via file-level locking
 */

import { prisma } from '../utils/prisma.js';
import { NotFoundError, ConflictError } from '../errors/index.js';
import type { FileLock } from '@prisma/client';

const DEFAULT_LOCK_DURATION_MINUTES = 30;

export interface AcquireLockInput {
  integrationId: string;
  scriptId: string;
  userId: string;
  filePath: string;
  durationMinutes?: number;
}

export class FileLockService {
  async acquireLock(input: AcquireLockInput): Promise<FileLock> {
    const { integrationId, scriptId, userId, filePath, durationMinutes } = input;
    const duration = durationMinutes || DEFAULT_LOCK_DURATION_MINUTES;

    const existing = await prisma.fileLock.findFirst({
      where: { scriptId, isReleased: false },
    });

    if (existing) {
      // Same user already holds the lock
      if (existing.userId === userId) {
        return existing;
      }

      // Lock expired — auto-release and acquire
      if (existing.expiresAt < new Date()) {
        await prisma.fileLock.update({
          where: { id: existing.id },
          data: { isReleased: true, releasedAt: new Date() },
        });
      } else {
        throw new ConflictError(`File is locked by another user`);
      }
    }

    return prisma.fileLock.create({
      data: {
        integrationId,
        scriptId,
        userId,
        filePath,
        expiresAt: new Date(Date.now() + duration * 60 * 1000),
      },
    });
  }

  async releaseLock(lockId: string): Promise<FileLock> {
    const lock = await prisma.fileLock.findUnique({ where: { id: lockId } });
    if (!lock) {
      throw new NotFoundError('FileLock', lockId);
    }

    return prisma.fileLock.update({
      where: { id: lockId },
      data: { isReleased: true, releasedAt: new Date() },
    });
  }

  async checkLock(scriptId: string): Promise<FileLock | null> {
    return prisma.fileLock.findFirst({
      where: { scriptId, isReleased: false },
    });
  }

  async extendLock(lockId: string, additionalMinutes: number): Promise<FileLock> {
    const lock = await prisma.fileLock.findUnique({ where: { id: lockId } });
    if (!lock) {
      throw new NotFoundError('FileLock', lockId);
    }

    const newExpiry = new Date(lock.expiresAt.getTime() + additionalMinutes * 60 * 1000);

    return prisma.fileLock.update({
      where: { id: lockId },
      data: { expiresAt: newExpiry },
    });
  }

  async cleanupExpiredLocks(): Promise<number> {
    const result = await prisma.fileLock.updateMany({
      where: {
        isReleased: false,
        expiresAt: { lt: new Date() },
      },
      data: {
        isReleased: true,
        releasedAt: new Date(),
      },
    });

    return result.count;
  }

  async getApproachingExpiry(thresholdMinutes: number): Promise<(FileLock & { integration: { projectId: string } })[]> {
    const now = new Date();
    const threshold = new Date(now.getTime() + thresholdMinutes * 60 * 1000);

    return prisma.fileLock.findMany({
      where: {
        isReleased: false,
        expiresAt: { gt: now, lte: threshold },
      },
      include: {
        integration: true,
      },
    }) as Promise<(FileLock & { integration: { projectId: string } })[]>;
  }

  async forceRelease(scriptId: string): Promise<FileLock> {
    const lock = await prisma.fileLock.findFirst({
      where: { scriptId, isReleased: false },
    });

    if (!lock) {
      throw new NotFoundError('FileLock', scriptId);
    }

    return prisma.fileLock.update({
      where: { id: lock.id },
      data: { isReleased: true, releasedAt: new Date() },
    });
  }
}

export const fileLockService = new FileLockService();

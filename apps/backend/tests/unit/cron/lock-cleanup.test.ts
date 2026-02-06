/**
 * Lock Cleanup Cron Tests
 * Tests for the periodic expired lock cleanup and expiry notifications
 */

const { mockFileLockService, mockLogger, mockEmitNotification } = vi.hoisted(() => ({
  mockFileLockService: {
    cleanupExpiredLocks: vi.fn(),
    getApproachingExpiry: vi.fn(),
  },
  mockLogger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
  mockEmitNotification: vi.fn(),
}));

vi.mock('../../../src/services/file-lock.service.js', () => ({
  fileLockService: mockFileLockService,
  FileLockService: vi.fn(),
}));
vi.mock('../../../src/utils/logger.js', () => ({ logger: mockLogger }));
vi.mock('../../../src/websocket/socket.js', () => ({
  emitNotification: mockEmitNotification,
  getSocketServer: vi.fn(),
  initializeSocketServer: vi.fn(),
}));

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { startLockCleanup, stopLockCleanup } from '../../../src/cron/lock-cleanup.js';

describe('Lock Cleanup Cron', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockFileLockService.getApproachingExpiry.mockResolvedValue([]);
  });

  afterEach(() => {
    stopLockCleanup();
    vi.useRealTimers();
  });

  it('should call cleanupExpiredLocks on interval', async () => {
    mockFileLockService.cleanupExpiredLocks.mockResolvedValue({ count: 2 });

    startLockCleanup(5 * 60 * 1000); // 5min

    // Advance 5 minutes
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);

    expect(mockFileLockService.cleanupExpiredLocks).toHaveBeenCalledTimes(1);
  });

  it('should run multiple times', async () => {
    mockFileLockService.cleanupExpiredLocks.mockResolvedValue({ count: 0 });

    startLockCleanup(5 * 60 * 1000);

    await vi.advanceTimersByTimeAsync(15 * 60 * 1000); // 15 min = 3 intervals

    expect(mockFileLockService.cleanupExpiredLocks).toHaveBeenCalledTimes(3);
  });

  it('should handle cleanup errors gracefully', async () => {
    mockFileLockService.cleanupExpiredLocks.mockRejectedValue(new Error('DB error'));

    startLockCleanup(5 * 60 * 1000);

    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);

    expect(mockFileLockService.cleanupExpiredLocks).toHaveBeenCalledTimes(1);
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it('stopLockCleanup should stop the interval', async () => {
    mockFileLockService.cleanupExpiredLocks.mockResolvedValue({ count: 0 });

    startLockCleanup(5 * 60 * 1000);
    stopLockCleanup();

    await vi.advanceTimersByTimeAsync(10 * 60 * 1000);

    expect(mockFileLockService.cleanupExpiredLocks).not.toHaveBeenCalled();
  });

  it('should check for approaching expiry locks and emit notifications', async () => {
    mockFileLockService.cleanupExpiredLocks.mockResolvedValue({ count: 0 });
    mockFileLockService.getApproachingExpiry.mockResolvedValue([
      {
        id: 'lock-1',
        userId: 'user-123',
        filePath: 'tests/login.spec.ts',
        expiresAt: new Date(Date.now() + 3 * 60 * 1000),
        integration: { projectId: 'proj-1' },
      },
    ]);

    startLockCleanup(5 * 60 * 1000);

    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);

    expect(mockFileLockService.getApproachingExpiry).toHaveBeenCalledWith(5);
    expect(mockEmitNotification).toHaveBeenCalledWith(
      'user-123',
      expect.objectContaining({
        type: 'lock_expiring',
        title: 'File lock expiring soon',
      })
    );
  });

  it('should not emit notifications when no locks approaching expiry', async () => {
    mockFileLockService.cleanupExpiredLocks.mockResolvedValue({ count: 0 });
    mockFileLockService.getApproachingExpiry.mockResolvedValue([]);

    startLockCleanup(5 * 60 * 1000);

    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);

    expect(mockEmitNotification).not.toHaveBeenCalled();
  });
});

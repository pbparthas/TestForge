/**
 * Lock Cleanup Cron
 * Periodically releases expired file locks and notifies users of approaching expiry
 */

import { fileLockService } from '../services/file-lock.service.js';
import { emitNotification } from '../websocket/socket.js';
import { logger } from '../utils/logger.js';

let intervalId: ReturnType<typeof setInterval> | null = null;

const EXPIRY_WARNING_MINUTES = 5;

export function startLockCleanup(intervalMs: number = 5 * 60 * 1000): void {
  if (intervalId) return; // Already running

  intervalId = setInterval(async () => {
    try {
      const result = await fileLockService.cleanupExpiredLocks();
      if (result.count > 0) {
        logger.info({ releasedCount: result.count }, 'Cleaned up expired file locks');
      }
    } catch (err) {
      logger.error({ error: err }, 'Lock cleanup failed');
    }

    // Notify users with locks approaching expiry
    try {
      const approaching = await fileLockService.getApproachingExpiry(EXPIRY_WARNING_MINUTES);
      for (const lock of approaching) {
        const minutesLeft = Math.round((lock.expiresAt.getTime() - Date.now()) / 60000);
        await emitNotification(lock.userId, {
          type: 'lock_expiring',
          title: 'File lock expiring soon',
          message: `Your lock on ${lock.filePath} expires in ${minutesLeft} minutes. Extend or save your changes.`,
          data: {
            lockId: lock.id,
            filePath: lock.filePath,
            expiresAt: lock.expiresAt.toISOString(),
          },
        });
      }
    } catch (err) {
      logger.error({ error: err }, 'Lock expiry notification failed');
    }
  }, intervalMs);

  logger.info({ intervalMs }, 'Lock cleanup cron started');
}

export function stopLockCleanup(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

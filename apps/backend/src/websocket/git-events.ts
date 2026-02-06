/**
 * Git WebSocket Events
 * Emit helpers for git:sync, file:locked, file:unlocked
 */

import { getSocketServer } from './socket.js';
import { logger } from '../utils/logger.js';

// =============================================================================
// TYPES
// =============================================================================

export interface GitSyncPayload {
  projectId: string;
  filesUpdated: number;
  filesCreated: number;
  source: 'webhook' | 'manual' | 'approval';
}

export interface FileLockPayload {
  projectId: string;
  scriptId: string;
  filePath: string;
  userId: string;
  expiresAt: string;
}

export interface FileUnlockPayload {
  projectId: string;
  scriptId: string;
  filePath: string;
}

// =============================================================================
// EMIT HELPERS
// =============================================================================

export async function emitGitSync(payload: GitSyncPayload): Promise<void> {
  const io = getSocketServer();
  if (!io) return;

  const channel = `project:${payload.projectId}`;
  io.to(channel).emit('git:sync', payload);
  logger.debug({ channel, payload }, 'Emitted git:sync');
}

export async function emitFileLocked(payload: FileLockPayload): Promise<void> {
  const io = getSocketServer();
  if (!io) return;

  const channel = `project:${payload.projectId}`;
  io.to(channel).emit('file:locked', payload);
  logger.debug({ channel, payload }, 'Emitted file:locked');
}

export async function emitFileUnlocked(payload: FileUnlockPayload): Promise<void> {
  const io = getSocketServer();
  if (!io) return;

  const channel = `project:${payload.projectId}`;
  io.to(channel).emit('file:unlocked', payload);
  logger.debug({ channel, payload }, 'Emitted file:unlocked');
}

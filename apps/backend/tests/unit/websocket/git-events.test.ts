/**
 * Git WebSocket Event Tests
 * Tests for git:sync, file:locked, file:unlocked emit helpers
 */

const { mockIo } = vi.hoisted(() => {
  const toMock = { emit: vi.fn() };
  return {
    mockIo: {
      to: vi.fn().mockReturnValue(toMock),
      emit: vi.fn(),
      _toMock: toMock,
    },
  };
});

vi.mock('../../../src/websocket/socket.js', () => ({
  getSocketServer: vi.fn().mockReturnValue(mockIo),
  initializeSocketServer: vi.fn(),
}));
vi.mock('../../../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { emitGitSync, emitFileLocked, emitFileUnlocked } from '../../../src/websocket/git-events.js';

describe('Git WebSocket Events', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('emitGitSync', () => {
    it('should emit git:sync to project channel', async () => {
      await emitGitSync({
        projectId: 'proj-1',
        filesUpdated: 3,
        filesCreated: 1,
        source: 'webhook',
      });

      expect(mockIo.to).toHaveBeenCalledWith('project:proj-1');
      expect(mockIo._toMock.emit).toHaveBeenCalledWith('git:sync', {
        projectId: 'proj-1',
        filesUpdated: 3,
        filesCreated: 1,
        source: 'webhook',
      });
    });
  });

  describe('emitFileLocked', () => {
    it('should emit file:locked to project channel', async () => {
      await emitFileLocked({
        projectId: 'proj-1',
        scriptId: 'script-1',
        filePath: 'tests/login.spec.ts',
        userId: 'user-1',
        expiresAt: '2026-02-06T12:00:00Z',
      });

      expect(mockIo.to).toHaveBeenCalledWith('project:proj-1');
      expect(mockIo._toMock.emit).toHaveBeenCalledWith('file:locked', {
        projectId: 'proj-1',
        scriptId: 'script-1',
        filePath: 'tests/login.spec.ts',
        userId: 'user-1',
        expiresAt: '2026-02-06T12:00:00Z',
      });
    });
  });

  describe('emitFileUnlocked', () => {
    it('should emit file:unlocked to project channel', async () => {
      await emitFileUnlocked({
        projectId: 'proj-1',
        scriptId: 'script-1',
        filePath: 'tests/login.spec.ts',
      });

      expect(mockIo.to).toHaveBeenCalledWith('project:proj-1');
      expect(mockIo._toMock.emit).toHaveBeenCalledWith('file:unlocked', {
        projectId: 'proj-1',
        scriptId: 'script-1',
        filePath: 'tests/login.spec.ts',
      });
    });
  });
});

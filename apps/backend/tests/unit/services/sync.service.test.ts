/**
 * Sync Service Tests
 * TDD for DB ↔ Git synchronization
 */

const { mockPrisma, mockWorkspaceService, mockGitService } = vi.hoisted(() => ({
  mockPrisma: {
    script: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    gitIntegration: {
      findUnique: vi.fn(),
    },
  },
  mockWorkspaceService: {
    writeFile: vi.fn(),
    readFile: vi.fn(),
    listFiles: vi.fn(),
    getWorkspacePath: vi.fn().mockReturnValue('/testforge-workspace/proj-123'),
  },
  mockGitService: {
    getIntegration: vi.fn(),
    commit: vi.fn(),
    push: vi.fn(),
    pull: vi.fn(),
  },
}));

vi.mock('../../../src/utils/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../../../src/services/workspace.service.js', () => ({
  workspaceService: mockWorkspaceService,
  WorkspaceService: vi.fn(),
}));
vi.mock('../../../src/services/git.service.js', () => ({
  gitService: mockGitService,
  GitService: vi.fn(),
}));

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SyncService } from '../../../src/services/sync.service.js';
import { NotFoundError } from '../../../src/errors/index.js';

describe('SyncService', () => {
  let service: SyncService;

  const mockIntegration = {
    id: 'git-int-123',
    projectId: 'proj-123',
    defaultBranch: 'main',
    developBranch: 'develop',
    workspacePath: '/testforge-workspace/proj-123',
  };

  const mockScript = {
    id: 'script-123',
    projectId: 'proj-123',
    name: 'Login Test',
    code: 'test("login works", async () => { /* ... */ });',
    language: 'typescript',
    framework: 'playwright',
    filePath: null,
    gitCommitHash: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SyncService();
    mockGitService.getIntegration.mockResolvedValue(mockIntegration);
  });

  describe('syncScriptToGit', () => {
    it('should write script to file, commit, and push', async () => {
      mockPrisma.script.findUnique.mockResolvedValue(mockScript);
      mockWorkspaceService.writeFile.mockResolvedValue(undefined);
      mockGitService.commit.mockResolvedValue({ commit: 'abc123' });
      mockGitService.push.mockResolvedValue(undefined);
      mockPrisma.script.update.mockResolvedValue({
        ...mockScript,
        filePath: 'tests/login-test.spec.ts',
        gitCommitHash: 'abc123',
      });

      const result = await service.syncScriptToGit({
        scriptId: 'script-123',
        userId: 'user-123',
      });

      expect(mockWorkspaceService.writeFile).toHaveBeenCalledWith(
        'proj-123',
        expect.stringContaining('.spec.ts'),
        mockScript.code
      );
      expect(mockGitService.commit).toHaveBeenCalled();
      expect(mockGitService.push).toHaveBeenCalledWith('proj-123', 'develop');
      expect(mockPrisma.script.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ gitCommitHash: 'abc123' }),
        })
      );
    });

    it('should use existing filePath if set', async () => {
      const scriptWithPath = { ...mockScript, filePath: 'tests/custom-path.spec.ts' };
      mockPrisma.script.findUnique.mockResolvedValue(scriptWithPath);
      mockWorkspaceService.writeFile.mockResolvedValue(undefined);
      mockGitService.commit.mockResolvedValue({ commit: 'def456' });
      mockGitService.push.mockResolvedValue(undefined);
      mockPrisma.script.update.mockResolvedValue({
        ...scriptWithPath,
        gitCommitHash: 'def456',
      });

      await service.syncScriptToGit({
        scriptId: 'script-123',
        userId: 'user-123',
      });

      expect(mockWorkspaceService.writeFile).toHaveBeenCalledWith(
        'proj-123',
        'tests/custom-path.spec.ts',
        scriptWithPath.code
      );
    });

    it('should throw NotFoundError for missing script', async () => {
      mockPrisma.script.findUnique.mockResolvedValue(null);

      await expect(
        service.syncScriptToGit({ scriptId: 'missing', userId: 'user-123' })
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('syncFilesFromGit', () => {
    it('should pull from git and update scripts from files', async () => {
      mockGitService.pull.mockResolvedValue(undefined);
      mockWorkspaceService.listFiles.mockResolvedValue([
        'tests/login.spec.ts',
        'tests/signup.spec.ts',
      ]);
      mockWorkspaceService.readFile.mockResolvedValue('updated code');
      mockPrisma.script.findMany.mockResolvedValue([
        { ...mockScript, filePath: 'tests/login.spec.ts' },
      ]);
      mockPrisma.script.update.mockResolvedValue(mockScript);

      const result = await service.syncFilesFromGit({ projectId: 'proj-123' });

      expect(mockGitService.pull).toHaveBeenCalledWith('proj-123', 'develop');
      expect(result.updated).toBeGreaterThanOrEqual(1);
    });
  });

  describe('detectConflicts', () => {
    it('should return no conflict when DB and file match', async () => {
      const scriptWithPath = { ...mockScript, filePath: 'tests/login.spec.ts' };
      mockPrisma.script.findUnique.mockResolvedValue(scriptWithPath);
      mockWorkspaceService.readFile.mockResolvedValue(scriptWithPath.code);

      const result = await service.detectConflicts('script-123');

      expect(result.hasConflict).toBe(false);
    });

    it('should return conflict when DB and file differ', async () => {
      const scriptWithPath = { ...mockScript, filePath: 'tests/login.spec.ts' };
      mockPrisma.script.findUnique.mockResolvedValue(scriptWithPath);
      mockWorkspaceService.readFile.mockResolvedValue('different code');

      const result = await service.detectConflicts('script-123');

      expect(result.hasConflict).toBe(true);
      expect(result.dbContent).toBe(scriptWithPath.code);
      expect(result.fileContent).toBe('different code');
    });
  });
});

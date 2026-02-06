/**
 * Git Service Tests
 * TDD for Git operations via simple-git
 */

const { mockPrisma, mockEncrypt, mockDecrypt, mockSimpleGit, mockGitInstance, mockFs } = vi.hoisted(() => {
  const mockGitInstance = {
    clone: vi.fn(),
    add: vi.fn().mockReturnThis(),
    commit: vi.fn(),
    push: vi.fn(),
    pull: vi.fn(),
    merge: vi.fn(),
    diff: vi.fn(),
    log: vi.fn(),
    checkout: vi.fn(),
    checkIsRepo: vi.fn(),
    branch: vi.fn(),
    env: vi.fn().mockReturnThis(),
    raw: vi.fn(),
  };

  return {
    mockPrisma: {
      gitIntegration: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      gitSyncHistory: {
        create: vi.fn(),
      },
    },
    mockEncrypt: vi.fn().mockReturnValue('encrypted-ssh-key'),
    mockDecrypt: vi.fn().mockReturnValue('-----BEGIN OPENSSH PRIVATE KEY-----\nfakekey\n-----END OPENSSH PRIVATE KEY-----'),
    mockSimpleGit: vi.fn().mockReturnValue(mockGitInstance),
    mockGitInstance,
    mockFs: {
      writeFile: vi.fn().mockResolvedValue(undefined),
      unlink: vi.fn().mockResolvedValue(undefined),
      mkdtemp: vi.fn().mockResolvedValue('/tmp/testforge-ssh-123'),
      rm: vi.fn().mockResolvedValue(undefined),
    },
  };
});

vi.mock('../../../src/utils/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../../../src/utils/encryption.js', () => ({
  encrypt: mockEncrypt,
  decrypt: mockDecrypt,
  getEncryptionKey: vi.fn().mockReturnValue('a'.repeat(64)),
}));
vi.mock('simple-git', () => ({ simpleGit: mockSimpleGit }));
vi.mock('fs/promises', () => ({ default: mockFs, ...mockFs }));

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GitService } from '../../../src/services/git.service.js';
import { NotFoundError, ValidationError } from '../../../src/errors/index.js';

describe('GitService', () => {
  let service: GitService;

  const mockIntegration = {
    id: 'git-int-123',
    projectId: 'proj-123',
    repositoryUrl: 'git@github.com:org/tests.git',
    sshKeyEncrypted: 'encrypted-ssh-key',
    defaultBranch: 'main',
    developBranch: 'develop',
    workspacePath: '/testforge-workspace/proj-123',
    lastSyncAt: null,
    lastSyncStatus: null,
    lastSyncError: null,
    webhookSecret: null,
    isActive: true,
    createdById: 'user-123',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new GitService();
  });

  describe('createIntegration', () => {
    it('should encrypt SSH key and store integration', async () => {
      mockPrisma.gitIntegration.create.mockResolvedValue(mockIntegration);

      const result = await service.createIntegration({
        projectId: 'proj-123',
        repositoryUrl: 'git@github.com:org/tests.git',
        sshKey: '-----BEGIN OPENSSH PRIVATE KEY-----\nfakekey\n-----END OPENSSH PRIVATE KEY-----',
        createdById: 'user-123',
      });

      expect(mockEncrypt).toHaveBeenCalled();
      expect(mockPrisma.gitIntegration.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            projectId: 'proj-123',
            sshKeyEncrypted: 'encrypted-ssh-key',
          }),
        })
      );
      expect(result).toEqual(mockIntegration);
    });
  });

  describe('getIntegration', () => {
    it('should return integration by project ID', async () => {
      mockPrisma.gitIntegration.findUnique.mockResolvedValue(mockIntegration);

      const result = await service.getIntegration('proj-123');

      expect(result).toEqual(mockIntegration);
    });

    it('should throw NotFoundError when not found', async () => {
      mockPrisma.gitIntegration.findUnique.mockResolvedValue(null);

      await expect(service.getIntegration('missing')).rejects.toThrow(NotFoundError);
    });
  });

  describe('commit', () => {
    it('should stage files and commit on develop branch', async () => {
      mockPrisma.gitIntegration.findUnique.mockResolvedValue(mockIntegration);
      mockGitInstance.checkIsRepo.mockResolvedValue(true);
      mockGitInstance.checkout.mockResolvedValue(undefined);
      mockGitInstance.add.mockReturnValue(mockGitInstance);
      mockGitInstance.commit.mockResolvedValue({ commit: 'abc123' });

      const result = await service.commit('proj-123', {
        message: 'Update login test',
        files: ['tests/login.spec.ts'],
        author: 'user@example.com',
      });

      expect(mockGitInstance.checkout).toHaveBeenCalledWith('develop');
      expect(mockGitInstance.add).toHaveBeenCalledWith(['tests/login.spec.ts']);
      expect(mockGitInstance.commit).toHaveBeenCalledWith(
        'Update login test',
        undefined,
        expect.objectContaining({ '--author': expect.any(String) })
      );
      expect(result.commit).toBe('abc123');
    });
  });

  describe('push', () => {
    it('should push specified branch to remote', async () => {
      mockPrisma.gitIntegration.findUnique.mockResolvedValue(mockIntegration);
      mockGitInstance.push.mockResolvedValue(undefined);

      await service.push('proj-123', 'develop');

      expect(mockGitInstance.push).toHaveBeenCalledWith('origin', 'develop');
    });
  });

  describe('pull', () => {
    it('should pull latest from remote branch', async () => {
      mockPrisma.gitIntegration.findUnique.mockResolvedValue(mockIntegration);
      mockGitInstance.checkout.mockResolvedValue(undefined);
      mockGitInstance.pull.mockResolvedValue({ summary: { changes: 2 } });

      const result = await service.pull('proj-123', 'develop');

      expect(mockGitInstance.checkout).toHaveBeenCalledWith('develop');
      expect(mockGitInstance.pull).toHaveBeenCalledWith('origin', 'develop');
    });
  });

  describe('merge', () => {
    it('should merge develop into main with --no-ff', async () => {
      mockPrisma.gitIntegration.findUnique.mockResolvedValue(mockIntegration);
      mockGitInstance.checkout.mockResolvedValue(undefined);
      mockGitInstance.merge.mockResolvedValue({ result: 'success' });

      await service.merge('proj-123');

      expect(mockGitInstance.checkout).toHaveBeenCalledWith('main');
      expect(mockGitInstance.merge).toHaveBeenCalledWith(['develop', '--no-ff']);
    });
  });

  describe('getDiff', () => {
    it('should return diff between branches for a file', async () => {
      mockPrisma.gitIntegration.findUnique.mockResolvedValue(mockIntegration);
      mockGitInstance.diff.mockResolvedValue('--- a/test.ts\n+++ b/test.ts\n@@ -1 +1 @@\n-old\n+new');

      const result = await service.getDiff('proj-123', {
        filePath: 'tests/login.spec.ts',
        source: 'main',
        target: 'develop',
      });

      expect(result).toContain('---');
      expect(mockGitInstance.diff).toHaveBeenCalledWith(['main', 'develop', '--', 'tests/login.spec.ts']);
    });
  });

  describe('getLog', () => {
    it('should return commit history', async () => {
      const mockLog = {
        all: [
          { hash: 'abc123', message: 'test commit', date: '2026-01-01', author_name: 'User' },
        ],
        total: 1,
      };
      mockPrisma.gitIntegration.findUnique.mockResolvedValue(mockIntegration);
      mockGitInstance.log.mockResolvedValue(mockLog);

      const result = await service.getLog('proj-123', { maxCount: 10 });

      expect(result.total).toBe(1);
      expect(mockGitInstance.log).toHaveBeenCalledWith(expect.objectContaining({ maxCount: 10 }));
    });
  });

  describe('testConnection', () => {
    it('should return success when clone succeeds', async () => {
      mockGitInstance.clone.mockResolvedValue(undefined);

      const result = await service.testConnection(
        'git@github.com:org/tests.git',
        '-----BEGIN OPENSSH PRIVATE KEY-----\nfakekey\n-----END OPENSSH PRIVATE KEY-----'
      );

      expect(result.success).toBe(true);
    });

    it('should return failure with error when clone fails', async () => {
      mockGitInstance.clone.mockRejectedValue(new Error('Permission denied'));

      const result = await service.testConnection(
        'git@github.com:org/tests.git',
        '-----BEGIN OPENSSH PRIVATE KEY-----\nfakekey\n-----END OPENSSH PRIVATE KEY-----'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Permission denied');
    });
  });
});

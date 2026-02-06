/**
 * Git Routes Integration Tests
 * Git integration, file locks, sync, and review comments
 */

const { mockGitService, mockFileLockService, mockSyncService, mockPrisma, mockJwt } = vi.hoisted(() => ({
  mockGitService: {
    createIntegration: vi.fn(),
    getIntegration: vi.fn(),
    testConnection: vi.fn(),
    getDiff: vi.fn(),
    getLog: vi.fn(),
  },
  mockFileLockService: {
    acquireLock: vi.fn(),
    releaseLock: vi.fn(),
    checkLock: vi.fn(),
    extendLock: vi.fn(),
    forceRelease: vi.fn(),
  },
  mockSyncService: {
    syncScriptToGit: vi.fn(),
    syncFilesFromGit: vi.fn(),
  },
  mockPrisma: {
    reviewComment: {
      create: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
  mockJwt: {
    verify: vi.fn(),
    sign: vi.fn(),
  },
}));

vi.mock('../../src/services/git.service.js', () => ({
  gitService: mockGitService,
  GitService: vi.fn(),
}));
vi.mock('../../src/services/file-lock.service.js', () => ({
  fileLockService: mockFileLockService,
  FileLockService: vi.fn(),
}));
vi.mock('../../src/services/sync.service.js', () => ({
  syncService: mockSyncService,
  SyncService: vi.fn(),
}));
vi.mock('../../src/utils/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('jsonwebtoken', () => ({ default: mockJwt }));

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';

describe('Git Routes', () => {
  const adminToken = 'admin-token';
  const userToken = 'user-token';

  const mockIntegration = {
    id: '550e8400-e29b-41d4-a716-446655440010',
    projectId: '550e8400-e29b-41d4-a716-446655440001',
    repositoryUrl: 'git@github.com:org/tests.git',
    defaultBranch: 'main',
    developBranch: 'develop',
    workspacePath: '/testforge-workspace/proj-123',
    isActive: true,
    createdById: 'admin-123',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockLock = {
    id: '550e8400-e29b-41d4-a716-446655440020',
    integrationId: '550e8400-e29b-41d4-a716-446655440010',
    scriptId: '550e8400-e29b-41d4-a716-446655440030',
    userId: 'user-123',
    filePath: 'tests/login.spec.ts',
    lockedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    isReleased: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockJwt.verify.mockImplementation((token: string) => {
      if (token === adminToken) {
        return { userId: 'admin-123', role: 'admin' };
      }
      if (token === userToken) {
        return { userId: 'user-123', role: 'qae' };
      }
      throw new Error('Invalid token');
    });
  });

  // ===========================================================================
  // Integration CRUD
  // ===========================================================================

  describe('POST /api/git/integrations', () => {
    it('should create integration with valid data', async () => {
      mockGitService.createIntegration.mockResolvedValue(mockIntegration);

      const res = await request(app)
        .post('/api/git/integrations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          projectId: '550e8400-e29b-41d4-a716-446655440001',
          repositoryUrl: 'git@github.com:org/tests.git',
          sshKey: '-----BEGIN OPENSSH PRIVATE KEY-----\nfakekey\n-----END OPENSSH PRIVATE KEY-----',
        });

      expect(res.status).toBe(201);
      expect(res.body.data).toBeDefined();
    });

    it('should return 403 for non-admin users', async () => {
      const res = await request(app)
        .post('/api/git/integrations')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          projectId: '550e8400-e29b-41d4-a716-446655440001',
          repositoryUrl: 'git@github.com:org/tests.git',
          sshKey: 'key',
        });

      expect(res.status).toBe(403);
    });

    it('should return 401 without token', async () => {
      const res = await request(app)
        .post('/api/git/integrations')
        .send({});

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/git/integrations/:projectId', () => {
    it('should return integration for project', async () => {
      mockGitService.getIntegration.mockResolvedValue(mockIntegration);

      const res = await request(app)
        .get(`/api/git/integrations/${mockIntegration.projectId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.projectId).toBe(mockIntegration.projectId);
    });
  });

  describe('POST /api/git/integrations/:id/test', () => {
    it('should test connection and return result', async () => {
      mockGitService.testConnection.mockResolvedValue({ success: true });

      const res = await request(app)
        .post(`/api/git/integrations/${mockIntegration.id}/test`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          repositoryUrl: 'git@github.com:org/tests.git',
          sshKey: 'key',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.success).toBe(true);
    });
  });

  // ===========================================================================
  // File Locks
  // ===========================================================================

  describe('POST /api/git/locks/acquire', () => {
    it('should acquire a file lock', async () => {
      mockFileLockService.acquireLock.mockResolvedValue(mockLock);

      const res = await request(app)
        .post('/api/git/locks/acquire')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          integrationId: '550e8400-e29b-41d4-a716-446655440010',
          scriptId: '550e8400-e29b-41d4-a716-446655440030',
          filePath: 'tests/login.spec.ts',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(mockLock.id);
    });
  });

  describe('POST /api/git/locks/:lockId/release', () => {
    it('should release a lock', async () => {
      mockFileLockService.releaseLock.mockResolvedValue({ ...mockLock, isReleased: true });

      const res = await request(app)
        .post(`/api/git/locks/${mockLock.id}/release`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/git/locks/check/:scriptId', () => {
    it('should return lock status', async () => {
      mockFileLockService.checkLock.mockResolvedValue(mockLock);

      const res = await request(app)
        .get(`/api/git/locks/check/${mockLock.scriptId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });

    it('should return null when no lock', async () => {
      mockFileLockService.checkLock.mockResolvedValue(null);

      const res = await request(app)
        .get(`/api/git/locks/check/${mockLock.scriptId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeNull();
    });
  });

  describe('POST /api/git/locks/:scriptId/force', () => {
    it('should force release (admin only)', async () => {
      mockFileLockService.forceRelease.mockResolvedValue({ ...mockLock, isReleased: true });

      const res = await request(app)
        .post(`/api/git/locks/${mockLock.scriptId}/force`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
    });

    it('should return 403 for non-admin', async () => {
      const res = await request(app)
        .post(`/api/git/locks/${mockLock.scriptId}/force`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(403);
    });
  });

  // ===========================================================================
  // Sync
  // ===========================================================================

  describe('POST /api/git/sync/to-git', () => {
    it('should sync script to git', async () => {
      mockSyncService.syncScriptToGit.mockResolvedValue({
        filePath: 'tests/login.spec.ts',
        commitHash: 'abc123',
      });

      const res = await request(app)
        .post('/api/git/sync/to-git')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ scriptId: '550e8400-e29b-41d4-a716-446655440030' });

      expect(res.status).toBe(200);
      expect(res.body.data.commitHash).toBe('abc123');
    });
  });

  describe('POST /api/git/sync/from-git', () => {
    it('should sync files from git', async () => {
      mockSyncService.syncFilesFromGit.mockResolvedValue({
        updated: 2,
        created: 0,
        errors: [],
      });

      const res = await request(app)
        .post('/api/git/sync/from-git')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ projectId: '550e8400-e29b-41d4-a716-446655440001' });

      expect(res.status).toBe(200);
      expect(res.body.data.updated).toBe(2);
    });
  });

  // ===========================================================================
  // Diff & History
  // ===========================================================================

  describe('GET /api/git/diff/:scriptId', () => {
    it('should return diff for script', async () => {
      mockGitService.getIntegration.mockResolvedValue(mockIntegration);
      mockGitService.getDiff.mockResolvedValue('--- a/test.ts\n+++ b/test.ts');

      const res = await request(app)
        .get('/api/git/diff/550e8400-e29b-41d4-a716-446655440030')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toContain('---');
    });
  });

  describe('GET /api/git/history/:projectId', () => {
    it('should return commit history', async () => {
      mockGitService.getLog.mockResolvedValue({
        all: [{ hash: 'abc123', message: 'test', date: '2026-01-01' }],
        total: 1,
      });

      const res = await request(app)
        .get(`/api/git/history/${mockIntegration.projectId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(1);
    });
  });

  // ===========================================================================
  // Review Comments
  // ===========================================================================

  const mockComment = {
    id: '550e8400-e29b-41d4-a716-446655440040',
    artifactId: '550e8400-e29b-41d4-a716-446655440050',
    scriptId: '550e8400-e29b-41d4-a716-446655440030',
    userId: 'user-123',
    filePath: 'tests/login.spec.ts',
    lineNumber: 10,
    lineEnd: null,
    content: 'This assertion needs a timeout',
    isResolved: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  describe('POST /api/git/reviews/:artifactId/comments', () => {
    it('should create a review comment', async () => {
      mockPrisma.reviewComment.create.mockResolvedValue(mockComment);

      const res = await request(app)
        .post(`/api/git/reviews/${mockComment.artifactId}/comments`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          scriptId: mockComment.scriptId,
          filePath: 'tests/login.spec.ts',
          lineNumber: 10,
          content: 'This assertion needs a timeout',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.content).toBe('This assertion needs a timeout');
    });
  });

  describe('GET /api/git/reviews/:artifactId/comments', () => {
    it('should list comments for artifact', async () => {
      mockPrisma.reviewComment.findMany.mockResolvedValue([mockComment]);

      const res = await request(app)
        .get(`/api/git/reviews/${mockComment.artifactId}/comments`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });
  });

  describe('PATCH /api/git/reviews/comments/:id/resolve', () => {
    it('should resolve a comment', async () => {
      mockPrisma.reviewComment.update.mockResolvedValue({ ...mockComment, isResolved: true });

      const res = await request(app)
        .patch(`/api/git/reviews/comments/${mockComment.id}/resolve`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.isResolved).toBe(true);
    });
  });
});

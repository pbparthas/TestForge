/**
 * ScriptSmith Session Routes Integration Tests
 * Sprint 13: Session-based workflow API tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';

// Mock service
const { mockSessionService, mockJwt } = vi.hoisted(() => ({
  mockSessionService: {
    create: vi.fn(),
    findById: vi.fn(),
    findByIdWithFiles: vi.fn(),
    findAll: vi.fn(),
    updateInput: vi.fn(),
    transform: vi.fn(),
    saveToFramework: vi.fn(),
    delete: vi.fn(),
    analyzeFramework: vi.fn(),
  },
  mockJwt: {
    verify: vi.fn(),
    sign: vi.fn(),
  },
}));

vi.mock('../../src/services/scriptsmith-session.service.js', () => ({
  scriptSmithSessionService: mockSessionService,
}));

vi.mock('jsonwebtoken', () => ({ default: mockJwt }));

import app from '../../src/app.js';
import { NotFoundError, ValidationError } from '../../src/errors/index.js';

describe('ScriptSmith Session Routes Integration', () => {
  const adminToken = 'admin-token';
  const userToken = 'user-token';

  const mockUser = {
    userId: '11111111-1111-1111-1111-111111111111',
    role: 'qae',
  };

  const projectId = '22222222-2222-2222-2222-222222222222';

  const mockSession = {
    id: '33333333-3333-3333-3333-333333333333',
    userId: mockUser.userId,
    projectId: projectId,
    inputMethod: 'describe',
    status: 'created',
    rawInput: null,
    transformedScript: null,
    frameworkAnalysis: null,
    costEstimate: null,
    projectPath: '/path/to/project',
    deviceType: null,
    deviceConfig: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: null,
    files: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockJwt.verify.mockImplementation((token: string) => {
      if (token === adminToken) {
        return { userId: 'admin-123', role: 'admin' };
      }
      if (token === userToken) {
        return mockUser;
      }
      throw new Error('Invalid token');
    });
  });

  // ==========================================================================
  // POST /api/scriptsmith/sessions - Create Session
  // ==========================================================================

  describe('POST /api/scriptsmith/sessions', () => {
    it('should create a session with describe method', async () => {
      mockSessionService.create.mockResolvedValue(mockSession);

      const res = await request(app)
        .post('/api/scriptsmith/sessions')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          inputMethod: 'describe',
          projectPath: '/path/to/project',
        });

      expect(res.status).toBe(201);
      expect(res.body.message).toBe('Session created');
      expect(res.body.data.inputMethod).toBe('describe');
    });

    it('should create a session with all input methods', async () => {
      const inputMethods = ['record', 'upload', 'screenshot', 'describe', 'edit'];

      for (const method of inputMethods) {
        mockSessionService.create.mockResolvedValue({
          ...mockSession,
          inputMethod: method,
        });

        const res = await request(app)
          .post('/api/scriptsmith/sessions')
          .set('Authorization', `Bearer ${userToken}`)
          .send({ inputMethod: method });

        expect(res.status).toBe(201);
        expect(res.body.data.inputMethod).toBe(method);
      }
    });

    it('should reject invalid input method', async () => {
      const res = await request(app)
        .post('/api/scriptsmith/sessions')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ inputMethod: 'invalid' });

      expect(res.status).toBe(400);
    });

    it('should require authentication', async () => {
      const res = await request(app)
        .post('/api/scriptsmith/sessions')
        .send({ inputMethod: 'describe' });

      expect(res.status).toBe(401);
    });
  });

  // ==========================================================================
  // GET /api/scriptsmith/sessions - List Sessions
  // ==========================================================================

  describe('GET /api/scriptsmith/sessions', () => {
    it('should return paginated sessions', async () => {
      mockSessionService.findAll.mockResolvedValue({
        data: [mockSession],
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      });

      const res = await request(app)
        .get('/api/scriptsmith/sessions')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.data).toHaveLength(1);
      expect(res.body.data.total).toBe(1);
    });

    it('should support filtering by status', async () => {
      mockSessionService.findAll.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 0,
      });

      const res = await request(app)
        .get('/api/scriptsmith/sessions')
        .query({ status: 'completed' })
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(mockSessionService.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'completed' })
      );
    });

    it('should support pagination', async () => {
      mockSessionService.findAll.mockResolvedValue({
        data: [],
        total: 0,
        page: 2,
        limit: 5,
        totalPages: 0,
      });

      const res = await request(app)
        .get('/api/scriptsmith/sessions')
        .query({ page: 2, limit: 5 })
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(mockSessionService.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ page: 2, limit: 5 })
      );
    });
  });

  // ==========================================================================
  // GET /api/scriptsmith/sessions/:id - Get Session
  // ==========================================================================

  describe('GET /api/scriptsmith/sessions/:id', () => {
    it('should return session with files', async () => {
      const sessionWithFiles = {
        ...mockSession,
        files: [
          { id: 'file-1', filePath: 'tests/test.spec.ts', content: 'code' },
        ],
      };
      mockSessionService.findByIdWithFiles.mockResolvedValue(sessionWithFiles);

      const res = await request(app)
        .get(`/api/scriptsmith/sessions/${mockSession.id}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.files).toHaveLength(1);
    });

    it('should return 404 for non-existent session', async () => {
      mockSessionService.findByIdWithFiles.mockRejectedValue(
        new NotFoundError('ScriptSmithSession', 'non-existent')
      );

      const res = await request(app)
        .get('/api/scriptsmith/sessions/non-existent')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(404);
    });
  });

  // ==========================================================================
  // POST /api/scriptsmith/sessions/:id/input - Update Input
  // ==========================================================================

  describe('POST /api/scriptsmith/sessions/:id/input', () => {
    it('should update session input', async () => {
      mockSessionService.updateInput.mockResolvedValue({
        ...mockSession,
        status: 'input_received',
        rawInput: { description: 'Generate a login test' },
      });

      const res = await request(app)
        .post(`/api/scriptsmith/sessions/${mockSession.id}/input`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ description: 'Generate a login test' });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Input updated');
      expect(res.body.data.status).toBe('input_received');
    });

    it('should handle recording input', async () => {
      mockSessionService.updateInput.mockResolvedValue({
        ...mockSession,
        inputMethod: 'record',
        status: 'input_received',
        rawInput: {
          recording: {
            actions: [{ type: 'navigate', url: 'https://example.com' }],
          },
        },
      });

      const res = await request(app)
        .post(`/api/scriptsmith/sessions/${mockSession.id}/input`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          recording: {
            actions: [{ type: 'navigate', url: 'https://example.com' }],
          },
        });

      expect(res.status).toBe(200);
    });

    it('should reject invalid status transition', async () => {
      mockSessionService.updateInput.mockRejectedValue(
        new ValidationError('Invalid status transition')
      );

      const res = await request(app)
        .post(`/api/scriptsmith/sessions/${mockSession.id}/input`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ description: 'test' });

      expect(res.status).toBe(400);
    });
  });

  // ==========================================================================
  // POST /api/scriptsmith/sessions/:id/transform - Transform
  // ==========================================================================

  describe('POST /api/scriptsmith/sessions/:id/transform', () => {
    it('should transform session with options', async () => {
      mockSessionService.transform.mockResolvedValue({
        ...mockSession,
        status: 'reviewing',
        transformedScript: 'test("login", async () => {});',
        files: [{ id: 'file-1', filePath: 'tests/test.spec.ts', content: 'code' }],
      });

      const res = await request(app)
        .post(`/api/scriptsmith/sessions/${mockSession.id}/transform`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          projectId: projectId,
          options: {
            framework: 'playwright',
            language: 'typescript',
            includePageObjects: true,
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Transformation complete');
      expect(res.body.data.status).toBe('reviewing');
    });

    it('should require projectId', async () => {
      const res = await request(app)
        .post(`/api/scriptsmith/sessions/${mockSession.id}/transform`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ options: {} });

      expect(res.status).toBe(400);
    });
  });

  // ==========================================================================
  // POST /api/scriptsmith/sessions/:id/save - Save
  // ==========================================================================

  describe('POST /api/scriptsmith/sessions/:id/save', () => {
    it('should save files to framework', async () => {
      mockSessionService.saveToFramework.mockResolvedValue({
        savedFiles: ['tests/test.spec.ts'],
        sessionId: mockSession.id,
      });

      const res = await request(app)
        .post(`/api/scriptsmith/sessions/${mockSession.id}/save`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          targetDir: 'output/dir',
          overwrite: false,
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Files saved successfully');
      expect(res.body.data.savedFiles).toContain('tests/test.spec.ts');
    });

    it('should require targetDir', async () => {
      const res = await request(app)
        .post(`/api/scriptsmith/sessions/${mockSession.id}/save`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({});

      expect(res.status).toBe(400);
    });
  });

  // ==========================================================================
  // DELETE /api/scriptsmith/sessions/:id - Delete
  // ==========================================================================

  describe('DELETE /api/scriptsmith/sessions/:id', () => {
    it('should delete session', async () => {
      mockSessionService.delete.mockResolvedValue(undefined);

      const res = await request(app)
        .delete(`/api/scriptsmith/sessions/${mockSession.id}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Session deleted');
    });

    it('should return 404 for non-existent session', async () => {
      mockSessionService.delete.mockRejectedValue(
        new NotFoundError('ScriptSmithSession', 'non-existent')
      );

      const res = await request(app)
        .delete('/api/scriptsmith/sessions/non-existent')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(404);
    });
  });

  // ==========================================================================
  // POST /api/scriptsmith/analyze-framework - Analyze
  // ==========================================================================

  describe('POST /api/scriptsmith/analyze-framework', () => {
    it('should analyze project framework', async () => {
      mockSessionService.analyzeFramework.mockResolvedValue({
        foundPageObjects: ['LoginPage', 'HomePage'],
        foundUtilities: ['helpers', 'api'],
        foundFixtures: [],
        projectStructure: {
          testDir: '/project/tests',
          pageObjectDir: '/project/pages',
          utilityDir: '/project/utils',
        },
        codingStyle: {
          indentation: 'spaces',
          quotesStyle: 'single',
          semicolons: true,
        },
      });

      const res = await request(app)
        .post('/api/scriptsmith/analyze-framework')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ projectPath: 'path/to/project' });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Framework analysis complete');
      expect(res.body.data.foundPageObjects).toContain('LoginPage');
    });

    it('should require projectPath', async () => {
      const res = await request(app)
        .post('/api/scriptsmith/analyze-framework')
        .set('Authorization', `Bearer ${userToken}`)
        .send({});

      expect(res.status).toBe(400);
    });
  });

  // ==========================================================================
  // AUTHENTICATION
  // ==========================================================================

  describe('Authentication', () => {
    it('should reject requests without token', async () => {
      const endpoints = [
        { method: 'get', path: '/api/scriptsmith/sessions' },
        { method: 'post', path: '/api/scriptsmith/sessions' },
        { method: 'get', path: '/api/scriptsmith/sessions/123' },
        { method: 'delete', path: '/api/scriptsmith/sessions/123' },
      ];

      for (const endpoint of endpoints) {
        const res = await (request(app) as unknown as Record<string, (path: string) => request.Test>)[
          endpoint.method
        ](endpoint.path);

        expect(res.status).toBe(401);
      }
    });

    it('should reject invalid tokens', async () => {
      const res = await request(app)
        .get('/api/scriptsmith/sessions')
        .set('Authorization', 'Bearer invalid-token');

      expect(res.status).toBe(401);
    });
  });
});

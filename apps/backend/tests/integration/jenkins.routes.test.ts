/**
 * Jenkins Routes Integration Tests
 * Sprint 15: CI/CD integration tests
 */

const { mockService, mockJwt } = vi.hoisted(() => ({
  mockService: {
    createIntegration: vi.fn(),
    getIntegration: vi.fn(),
    getProjectIntegrations: vi.fn(),
    updateIntegration: vi.fn(),
    deleteIntegration: vi.fn(),
    testConnection: vi.fn(),
    triggerBuild: vi.fn(),
    getBuild: vi.fn(),
    pollBuildStatus: vi.fn(),
    getIntegrationBuilds: vi.fn(),
    getConsoleLog: vi.fn(),
  },
  mockJwt: {
    verify: vi.fn(),
    sign: vi.fn(),
  },
}));

vi.mock('../../src/services/jenkins.service.js', () => ({
  jenkinsService: mockService,
}));

vi.mock('jsonwebtoken', () => ({ default: mockJwt }));

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import { NotFoundError, ValidationError } from '../../src/errors/index.js';

describe('Jenkins Routes', () => {
  const adminToken = 'admin-token';
  const userToken = 'user-token';

  const mockIntegration = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    projectId: '550e8400-e29b-41d4-a716-446655440001',
    integrationName: 'Main CI',
    serverUrl: 'https://jenkins.example.com',
    username: 'admin',
    apiTokenEncrypted: 'encrypted-token',
    jobPath: '/job/test-pipeline',
    defaultEnvironment: 'staging',
    defaultBrowser: 'chrome',
    buildParameters: {},
    isActive: true,
    createdById: 'user-123',
    createdAt: new Date(),
    updatedAt: new Date(),
    builds: [],
  };

  const mockBuild = {
    id: '550e8400-e29b-41d4-a716-446655440002',
    integrationId: '550e8400-e29b-41d4-a716-446655440000',
    executionId: null,
    jenkinsBuildNumber: 42,
    jenkinsBuildUrl: 'https://jenkins.example.com/job/test-pipeline/42/',
    status: 'pending',
    parameters: {},
    startedAt: null,
    completedAt: null,
    durationMs: null,
    totalTests: null,
    passedTests: null,
    failedTests: null,
    consoleLogUrl: 'https://jenkins.example.com/job/test-pipeline/42/console',
    createdAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup JWT verification
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
  // Integration CRUD Tests
  // ===========================================================================

  describe('POST /api/jenkins/integrations', () => {
    it('should create integration with valid data', async () => {
      mockService.createIntegration.mockResolvedValue(mockIntegration);

      const res = await request(app)
        .post('/api/jenkins/integrations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          projectId: '550e8400-e29b-41d4-a716-446655440001',
          integrationName: 'Main CI',
          serverUrl: 'https://jenkins.example.com',
          username: 'admin',
          apiToken: 'api-token',
          jobPath: '/job/test-pipeline',
        });

      expect(res.status).toBe(201);
      expect(res.body.message).toBe('Integration created');
      expect(res.body.data).toBeDefined();
    });

    it('should return 403 for non-admin users', async () => {
      const res = await request(app)
        .post('/api/jenkins/integrations')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          projectId: '550e8400-e29b-41d4-a716-446655440001',
          integrationName: 'Main CI',
          serverUrl: 'https://jenkins.example.com',
          username: 'admin',
          apiToken: 'api-token',
          jobPath: '/job/test-pipeline',
        });

      expect(res.status).toBe(403);
    });

    it('should return 400 for invalid data', async () => {
      const res = await request(app)
        .post('/api/jenkins/integrations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          projectId: 'invalid-uuid',
        });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/jenkins/integrations/:projectId', () => {
    it('should return project integrations', async () => {
      mockService.getProjectIntegrations.mockResolvedValue([mockIntegration]);

      const res = await request(app)
        .get('/api/jenkins/integrations/550e8400-e29b-41d4-a716-446655440001')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.total).toBe(1);
    });

    it('should filter by active status', async () => {
      mockService.getProjectIntegrations.mockResolvedValue([mockIntegration]);

      const res = await request(app)
        .get('/api/jenkins/integrations/550e8400-e29b-41d4-a716-446655440001?isActive=true')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(mockService.getProjectIntegrations).toHaveBeenCalledWith(
        '550e8400-e29b-41d4-a716-446655440001',
        { isActive: true }
      );
    });
  });

  describe('GET /api/jenkins/integration/:id', () => {
    it('should return integration without encrypted token', async () => {
      mockService.getIntegration.mockResolvedValue(mockIntegration);

      const res = await request(app)
        .get('/api/jenkins/integration/550e8400-e29b-41d4-a716-446655440000')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.apiTokenEncrypted).toBeUndefined();
      expect(res.body.data.serverUrl).toBe('https://jenkins.example.com');
    });

    it('should return 404 for non-existent integration', async () => {
      mockService.getIntegration.mockRejectedValue(
        new NotFoundError('JenkinsIntegration', 'not-found')
      );

      const res = await request(app)
        .get('/api/jenkins/integration/not-found')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/jenkins/integration/:id', () => {
    it('should update integration', async () => {
      mockService.updateIntegration.mockResolvedValue({
        ...mockIntegration,
        integrationName: 'Updated CI',
      });

      const res = await request(app)
        .put('/api/jenkins/integration/550e8400-e29b-41d4-a716-446655440000')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ integrationName: 'Updated CI' });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Integration updated');
    });

    it('should return 403 for non-admin users', async () => {
      const res = await request(app)
        .put('/api/jenkins/integration/550e8400-e29b-41d4-a716-446655440000')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ integrationName: 'Updated CI' });

      expect(res.status).toBe(403);
    });
  });

  describe('DELETE /api/jenkins/integration/:id', () => {
    it('should delete integration', async () => {
      mockService.deleteIntegration.mockResolvedValue(undefined);

      const res = await request(app)
        .delete('/api/jenkins/integration/550e8400-e29b-41d4-a716-446655440000')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Integration deleted');
    });

    it('should return 403 for non-admin users', async () => {
      const res = await request(app)
        .delete('/api/jenkins/integration/550e8400-e29b-41d4-a716-446655440000')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(403);
    });
  });

  // ===========================================================================
  // Connection Test
  // ===========================================================================

  describe('POST /api/jenkins/test-connection', () => {
    it('should return success for valid connection', async () => {
      mockService.testConnection.mockResolvedValue({
        success: true,
        version: 'Jenkins 2.400',
      });

      const res = await request(app)
        .post('/api/jenkins/test-connection')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          serverUrl: 'https://jenkins.example.com',
          username: 'admin',
          apiToken: 'token',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.success).toBe(true);
    });

    it('should return failure message for bad connection', async () => {
      mockService.testConnection.mockResolvedValue({
        success: false,
        error: 'Connection refused',
      });

      const res = await request(app)
        .post('/api/jenkins/test-connection')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          serverUrl: 'https://jenkins.example.com',
          username: 'admin',
          apiToken: 'token',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.success).toBe(false);
      expect(res.body.message).toBe('Connection failed');
    });
  });

  // ===========================================================================
  // Build Management
  // ===========================================================================

  describe('POST /api/jenkins/integration/:id/trigger', () => {
    it('should trigger build and return build record', async () => {
      mockService.triggerBuild.mockResolvedValue(mockBuild);

      const res = await request(app)
        .post('/api/jenkins/integration/550e8400-e29b-41d4-a716-446655440000/trigger')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          environment: 'staging',
          browser: 'chrome',
        });

      expect(res.status).toBe(201);
      expect(res.body.message).toBe('Build triggered');
      expect(res.body.data).toBeDefined();
    });

    it('should pass execution ID when provided', async () => {
      mockService.triggerBuild.mockResolvedValue(mockBuild);

      const execId = '550e8400-e29b-41d4-a716-446655440003';
      await request(app)
        .post('/api/jenkins/integration/550e8400-e29b-41d4-a716-446655440000/trigger')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          executionId: execId,
        });

      expect(mockService.triggerBuild).toHaveBeenCalledWith(
        '550e8400-e29b-41d4-a716-446655440000',
        expect.any(Object),
        execId
      );
    });

    it('should return 400 for inactive integration', async () => {
      mockService.triggerBuild.mockRejectedValue(
        new ValidationError('Integration is inactive')
      );

      const res = await request(app)
        .post('/api/jenkins/integration/550e8400-e29b-41d4-a716-446655440000/trigger')
        .set('Authorization', `Bearer ${userToken}`)
        .send({});

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/jenkins/integration/:id/builds', () => {
    it('should return build history', async () => {
      mockService.getIntegrationBuilds.mockResolvedValue({
        data: [mockBuild],
        total: 1,
      });

      const res = await request(app)
        .get('/api/jenkins/integration/550e8400-e29b-41d4-a716-446655440000/builds')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.total).toBe(1);
    });

    it('should support pagination', async () => {
      mockService.getIntegrationBuilds.mockResolvedValue({
        data: [],
        total: 0,
      });

      const res = await request(app)
        .get('/api/jenkins/integration/550e8400-e29b-41d4-a716-446655440000/builds?limit=10&offset=20')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(mockService.getIntegrationBuilds).toHaveBeenCalledWith(
        '550e8400-e29b-41d4-a716-446655440000',
        expect.objectContaining({ limit: 10, offset: 20 })
      );
    });

    it('should filter by status', async () => {
      mockService.getIntegrationBuilds.mockResolvedValue({
        data: [mockBuild],
        total: 1,
      });

      await request(app)
        .get('/api/jenkins/integration/550e8400-e29b-41d4-a716-446655440000/builds?status=success')
        .set('Authorization', `Bearer ${userToken}`);

      expect(mockService.getIntegrationBuilds).toHaveBeenCalledWith(
        '550e8400-e29b-41d4-a716-446655440000',
        expect.objectContaining({ status: 'success' })
      );
    });
  });

  describe('GET /api/jenkins/build/:id', () => {
    it('should return build details', async () => {
      mockService.getBuild.mockResolvedValue(mockBuild);

      const res = await request(app)
        .get('/api/jenkins/build/550e8400-e29b-41d4-a716-446655440002')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.jenkinsBuildNumber).toBe(42);
    });

    it('should return 404 for non-existent build', async () => {
      mockService.getBuild.mockRejectedValue(
        new NotFoundError('JenkinsBuild', 'not-found')
      );

      const res = await request(app)
        .get('/api/jenkins/build/not-found')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/jenkins/build/:id/poll', () => {
    it('should update and return build status', async () => {
      mockService.pollBuildStatus.mockResolvedValue({
        ...mockBuild,
        status: 'success',
      });

      const res = await request(app)
        .post('/api/jenkins/build/550e8400-e29b-41d4-a716-446655440002/poll')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Build status updated');
      expect(res.body.data.status).toBe('success');
    });
  });

  describe('GET /api/jenkins/build/:id/console', () => {
    it('should return console log', async () => {
      mockService.getConsoleLog.mockResolvedValue('Build started...\nRunning tests...\nBuild succeeded!');

      const res = await request(app)
        .get('/api/jenkins/build/550e8400-e29b-41d4-a716-446655440002/console')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.log).toContain('Build started');
    });
  });

  // ===========================================================================
  // Authentication
  // ===========================================================================

  describe('Authentication', () => {
    it('should return 401 without token', async () => {
      const res = await request(app).get('/api/jenkins/integration/550e8400-e29b-41d4-a716-446655440000');

      expect(res.status).toBe(401);
    });

    it('should return 401 with invalid token', async () => {
      const res = await request(app)
        .get('/api/jenkins/integration/550e8400-e29b-41d4-a716-446655440000')
        .set('Authorization', 'Bearer invalid-token');

      expect(res.status).toBe(401);
    });
  });
});

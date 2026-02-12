/**
 * Requirement Routes Integration Tests
 * Sprint 5: Integration tests for requirement management endpoints
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';

const { mockService, mockJwt } = vi.hoisted(() => ({
  mockService: {
    findAll: vi.fn(),
    findById: vi.fn(),
    findByIdWithTestCases: vi.fn(),
    getTestCaseCoverage: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    archive: vi.fn(),
  },
  mockJwt: {
    verify: vi.fn(),
    sign: vi.fn(),
  },
}));

vi.mock('../../src/services/requirement.service.js', () => ({
  requirementService: mockService,
}));

vi.mock('jsonwebtoken', () => ({ default: mockJwt }));

import app from '../../src/app.js';

describe('Requirement Routes Integration', () => {
  const adminToken = 'admin_test_token';
  const userToken = 'user_test_token';
  const viewerToken = 'viewer_test_token';

  const mockRequirement = {
    id: 'req-123',
    projectId: 'project-123',
    title: 'User Login',
    description: 'User should be able to login',
    priority: 'high',
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockJwt.verify.mockImplementation((token: string) => {
      if (token === adminToken) return { userId: 'admin-123', role: 'admin' };
      if (token === userToken) return { userId: 'user-123', role: 'qae' };
      if (token === viewerToken) return { userId: 'viewer-123', role: 'viewer' };
      throw new Error('Invalid token');
    });
  });

  describe('GET /api/requirements', () => {
    it('should return paginated requirements', async () => {
      mockService.findAll.mockResolvedValue({ data: [mockRequirement], total: 1 });

      const res = await request(app)
        .get('/api/requirements')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });

    it('should support filter params', async () => {
      mockService.findAll.mockResolvedValue({ data: [], total: 0 });

      const res = await request(app)
        .get('/api/requirements?projectId=proj-1&priority=high&status=active')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(mockService.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 'proj-1',
          priority: 'high',
          status: 'active',
        })
      );
    });

    it('should return 401 without auth', async () => {
      const res = await request(app).get('/api/requirements');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/requirements/:id', () => {
    it('should return requirement by id', async () => {
      mockService.findById.mockResolvedValue(mockRequirement);

      const res = await request(app)
        .get('/api/requirements/req-123')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe('req-123');
    });

    it('should return 404 for non-existent requirement', async () => {
      const { NotFoundError } = await import('../../src/errors/index.js');
      mockService.findById.mockRejectedValue(new NotFoundError('Requirement', 'bad-id'));

      const res = await request(app)
        .get('/api/requirements/bad-id')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/requirements/:id/with-test-cases', () => {
    it('should return requirement with test cases', async () => {
      const data = { ...mockRequirement, testCases: [{ id: 'tc-1' }] };
      mockService.findByIdWithTestCases.mockResolvedValue(data);

      const res = await request(app)
        .get('/api/requirements/req-123/with-test-cases')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.testCases).toHaveLength(1);
    });
  });

  describe('GET /api/requirements/:id/coverage', () => {
    it('should return test case coverage', async () => {
      mockService.getTestCaseCoverage.mockResolvedValue({ total: 5, automated: 3, manual: 2 });

      const res = await request(app)
        .get('/api/requirements/req-123/coverage')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(5);
    });
  });

  describe('POST /api/requirements', () => {
    it('should create requirement for qae', async () => {
      mockService.create.mockResolvedValue(mockRequirement);

      const res = await request(app)
        .post('/api/requirements')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          projectId: '550e8400-e29b-41d4-a716-446655440000',
          title: 'New Requirement',
        });

      expect(res.status).toBe(201);
      expect(res.body.message).toBe('Requirement created');
    });

    it('should create requirement for admin', async () => {
      mockService.create.mockResolvedValue(mockRequirement);

      const res = await request(app)
        .post('/api/requirements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          projectId: '550e8400-e29b-41d4-a716-446655440000',
          title: 'Admin Requirement',
        });

      expect(res.status).toBe(201);
    });

    it('should return 403 for viewer', async () => {
      const res = await request(app)
        .post('/api/requirements')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          projectId: '550e8400-e29b-41d4-a716-446655440000',
          title: 'Viewer Requirement',
        });

      expect(res.status).toBe(403);
    });

    it('should return 400 for invalid input', async () => {
      const res = await request(app)
        .post('/api/requirements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: '' });

      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /api/requirements/:id', () => {
    it('should update requirement', async () => {
      mockService.update.mockResolvedValue({ ...mockRequirement, title: 'Updated' });

      const res = await request(app)
        .patch('/api/requirements/req-123')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ title: 'Updated' });

      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe('Updated');
    });

    it('should return 404 for non-existent', async () => {
      const { NotFoundError } = await import('../../src/errors/index.js');
      mockService.update.mockRejectedValue(new NotFoundError('Requirement', 'bad-id'));

      const res = await request(app)
        .patch('/api/requirements/bad-id')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ title: 'Updated' });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/requirements/:id', () => {
    it('should delete requirement for admin', async () => {
      mockService.delete.mockResolvedValue(undefined);

      const res = await request(app)
        .delete('/api/requirements/req-123')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Requirement deleted');
    });

    it('should return 403 for non-admin', async () => {
      const res = await request(app)
        .delete('/api/requirements/req-123')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/requirements/:id/archive', () => {
    it('should archive requirement', async () => {
      mockService.archive.mockResolvedValue({ ...mockRequirement, status: 'archived' });

      const res = await request(app)
        .post('/api/requirements/req-123/archive')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Requirement archived');
    });
  });
});

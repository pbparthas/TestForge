/**
 * Environment Routes Integration Tests
 * Sprint 5: Integration tests for environment management endpoints
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';

const { mockService, mockJwt } = vi.hoisted(() => ({
  mockService: {
    findAll: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    activate: vi.fn(),
    deactivate: vi.fn(),
    duplicate: vi.fn(),
  },
  mockJwt: {
    verify: vi.fn(),
    sign: vi.fn(),
  },
}));

vi.mock('../../src/services/environment.service.js', () => ({
  environmentService: mockService,
}));

vi.mock('jsonwebtoken', () => ({ default: mockJwt }));

import app from '../../src/app.js';

describe('Environment Routes Integration', () => {
  const adminToken = 'admin_test_token';
  const leadToken = 'lead_test_token';
  const userToken = 'user_test_token';
  const viewerToken = 'viewer_test_token';

  const mockEnv = {
    id: 'env-123',
    projectId: 'project-123',
    name: 'Staging',
    baseUrl: 'https://staging.example.com',
    variables: { API_KEY: 'test' },
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockJwt.verify.mockImplementation((token: string) => {
      if (token === adminToken) return { userId: 'admin-123', role: 'admin' };
      if (token === leadToken) return { userId: 'lead-123', role: 'lead' };
      if (token === userToken) return { userId: 'user-123', role: 'qae' };
      if (token === viewerToken) return { userId: 'viewer-123', role: 'viewer' };
      throw new Error('Invalid token');
    });
  });

  describe('GET /api/environments', () => {
    it('should return paginated environments', async () => {
      mockService.findAll.mockResolvedValue({ data: [mockEnv], total: 1 });

      const res = await request(app)
        .get('/api/environments')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });

    it('should filter by projectId and isActive', async () => {
      mockService.findAll.mockResolvedValue({ data: [], total: 0 });

      const res = await request(app)
        .get('/api/environments?projectId=proj-1&isActive=true')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(mockService.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ projectId: 'proj-1', isActive: true })
      );
    });

    it('should return 401 without auth', async () => {
      const res = await request(app).get('/api/environments');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/environments/:id', () => {
    it('should return environment by id', async () => {
      mockService.findById.mockResolvedValue(mockEnv);

      const res = await request(app)
        .get('/api/environments/env-123')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe('env-123');
    });

    it('should return 404 for non-existent', async () => {
      const { NotFoundError } = await import('../../src/errors/index.js');
      mockService.findById.mockRejectedValue(new NotFoundError('Environment', 'bad-id'));

      const res = await request(app)
        .get('/api/environments/bad-id')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/environments', () => {
    it('should create environment for admin', async () => {
      mockService.create.mockResolvedValue(mockEnv);

      const res = await request(app)
        .post('/api/environments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          projectId: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Production',
          baseUrl: 'https://prod.example.com',
        });

      expect(res.status).toBe(201);
      expect(res.body.message).toBe('Environment created');
    });

    it('should create environment for lead', async () => {
      mockService.create.mockResolvedValue(mockEnv);

      const res = await request(app)
        .post('/api/environments')
        .set('Authorization', `Bearer ${leadToken}`)
        .send({
          projectId: '550e8400-e29b-41d4-a716-446655440000',
          name: 'QA',
          baseUrl: 'https://qa.example.com',
        });

      expect(res.status).toBe(201);
    });

    it('should return 403 for qae', async () => {
      const res = await request(app)
        .post('/api/environments')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          projectId: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Dev',
          baseUrl: 'https://dev.example.com',
        });

      expect(res.status).toBe(403);
    });

    it('should return 400 for invalid baseUrl', async () => {
      const res = await request(app)
        .post('/api/environments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          projectId: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Bad',
          baseUrl: 'not-a-url',
        });

      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /api/environments/:id', () => {
    it('should update environment for admin', async () => {
      mockService.update.mockResolvedValue({ ...mockEnv, name: 'Updated' });

      const res = await request(app)
        .patch('/api/environments/env-123')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Updated' });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Updated');
    });

    it('should return 403 for qae', async () => {
      const res = await request(app)
        .patch('/api/environments/env-123')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: 'Updated' });

      expect(res.status).toBe(403);
    });
  });

  describe('DELETE /api/environments/:id', () => {
    it('should delete environment for admin', async () => {
      mockService.delete.mockResolvedValue(undefined);

      const res = await request(app)
        .delete('/api/environments/env-123')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Environment deleted');
    });

    it('should return 403 for lead', async () => {
      const res = await request(app)
        .delete('/api/environments/env-123')
        .set('Authorization', `Bearer ${leadToken}`);

      expect(res.status).toBe(403);
    });

    it('should return 403 for qae', async () => {
      const res = await request(app)
        .delete('/api/environments/env-123')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/environments/:id/activate', () => {
    it('should activate environment for admin', async () => {
      mockService.activate.mockResolvedValue({ ...mockEnv, isActive: true });

      const res = await request(app)
        .post('/api/environments/env-123/activate')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Environment activated');
    });

    it('should return 403 for qae', async () => {
      const res = await request(app)
        .post('/api/environments/env-123/activate')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/environments/:id/deactivate', () => {
    it('should deactivate environment for lead', async () => {
      mockService.deactivate.mockResolvedValue({ ...mockEnv, isActive: false });

      const res = await request(app)
        .post('/api/environments/env-123/deactivate')
        .set('Authorization', `Bearer ${leadToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Environment deactivated');
    });
  });

  describe('POST /api/environments/:id/duplicate', () => {
    it('should duplicate environment for admin', async () => {
      mockService.duplicate.mockResolvedValue({ ...mockEnv, id: 'env-456', name: 'Staging (Copy)' });

      const res = await request(app)
        .post('/api/environments/env-123/duplicate')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(201);
      expect(res.body.message).toBe('Environment duplicated');
    });

    it('should return 403 for qae', async () => {
      const res = await request(app)
        .post('/api/environments/env-123/duplicate')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(403);
    });
  });
});

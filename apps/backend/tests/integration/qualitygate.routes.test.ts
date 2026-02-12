/**
 * Quality Gate Routes Integration Tests
 * Sprint 5: Integration tests for quality gate management endpoints
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';

const { mockService, mockJwt } = vi.hoisted(() => ({
  mockService: {
    findAll: vi.fn(),
    findById: vi.fn(),
    findByProject: vi.fn(),
    getProjectSummary: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    setDefault: vi.fn(),
    evaluate: vi.fn(),
    getExecutionEvaluations: vi.fn(),
  },
  mockJwt: {
    verify: vi.fn(),
    sign: vi.fn(),
  },
}));

vi.mock('../../src/services/qualitygate.service.js', () => ({
  qualityGateService: mockService,
}));

vi.mock('jsonwebtoken', () => ({ default: mockJwt }));

import app from '../../src/app.js';

describe('Quality Gate Routes Integration', () => {
  const adminToken = 'admin_test_token';
  const leadToken = 'lead_test_token';
  const userToken = 'user_test_token';
  const viewerToken = 'viewer_test_token';

  const mockQualityGate = {
    id: 'qg-123',
    projectId: 'project-123',
    name: 'Release Gate',
    description: 'Quality gate for release',
    isDefault: false,
    isActive: true,
    failOnBreach: true,
    conditions: [
      { metric: 'pass_rate', operator: 'gte', threshold: 95 },
    ],
    createdById: 'admin-123',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const validConditions = [
    { metric: 'pass_rate', operator: 'gte', threshold: 95 },
  ];

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

  describe('GET /api/quality-gates', () => {
    it('should return paginated quality gates', async () => {
      mockService.findAll.mockResolvedValue({ data: [mockQualityGate], total: 1 });

      const res = await request(app)
        .get('/api/quality-gates')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });

    it('should filter by projectId and isActive', async () => {
      mockService.findAll.mockResolvedValue({ data: [], total: 0 });

      const res = await request(app)
        .get('/api/quality-gates?projectId=proj-1&isActive=true')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(mockService.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ projectId: 'proj-1', isActive: true })
      );
    });

    it('should return 401 without auth', async () => {
      const res = await request(app).get('/api/quality-gates');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/quality-gates/:id', () => {
    it('should return quality gate by id', async () => {
      mockService.findById.mockResolvedValue(mockQualityGate);

      const res = await request(app)
        .get('/api/quality-gates/qg-123')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe('qg-123');
    });

    it('should return 404 for non-existent', async () => {
      const { NotFoundError } = await import('../../src/errors/index.js');
      mockService.findById.mockRejectedValue(new NotFoundError('QualityGate', 'bad-id'));

      const res = await request(app)
        .get('/api/quality-gates/bad-id')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/quality-gates/project/:projectId', () => {
    it('should return quality gates by project', async () => {
      mockService.findByProject.mockResolvedValue([mockQualityGate]);

      const res = await request(app)
        .get('/api/quality-gates/project/project-123')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });
  });

  describe('GET /api/quality-gates/project/:projectId/summary', () => {
    it('should return project quality summary', async () => {
      const mockSummary = { totalEvaluations: 10, passed: 8, failed: 2 };
      mockService.getProjectSummary.mockResolvedValue(mockSummary);

      const res = await request(app)
        .get('/api/quality-gates/project/project-123/summary')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.totalEvaluations).toBe(10);
    });

    it('should accept days query param', async () => {
      mockService.getProjectSummary.mockResolvedValue({});

      const res = await request(app)
        .get('/api/quality-gates/project/project-123/summary?days=7')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(mockService.getProjectSummary).toHaveBeenCalledWith('project-123', 7);
    });
  });

  describe('POST /api/quality-gates', () => {
    it('should create quality gate for admin', async () => {
      mockService.create.mockResolvedValue(mockQualityGate);

      const res = await request(app)
        .post('/api/quality-gates')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          projectId: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Release Gate',
          conditions: validConditions,
        });

      expect(res.status).toBe(201);
      expect(res.body.message).toBe('Quality gate created');
    });

    it('should create quality gate for lead', async () => {
      mockService.create.mockResolvedValue(mockQualityGate);

      const res = await request(app)
        .post('/api/quality-gates')
        .set('Authorization', `Bearer ${leadToken}`)
        .send({
          projectId: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Release Gate',
          conditions: validConditions,
        });

      expect(res.status).toBe(201);
    });

    it('should return 403 for qae', async () => {
      const res = await request(app)
        .post('/api/quality-gates')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          projectId: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Release Gate',
          conditions: validConditions,
        });

      expect(res.status).toBe(403);
    });

    it('should return 400 for missing conditions', async () => {
      const res = await request(app)
        .post('/api/quality-gates')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          projectId: '550e8400-e29b-41d4-a716-446655440000',
          name: 'No Conditions',
          conditions: [],
        });

      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid condition metric', async () => {
      const res = await request(app)
        .post('/api/quality-gates')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          projectId: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Bad Metric',
          conditions: [{ metric: 'invalid', operator: 'gte', threshold: 95 }],
        });

      expect(res.status).toBe(400);
    });
  });

  describe('PUT /api/quality-gates/:id', () => {
    it('should update quality gate for admin', async () => {
      mockService.update.mockResolvedValue({ ...mockQualityGate, name: 'Updated Gate' });

      const res = await request(app)
        .put('/api/quality-gates/qg-123')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Updated Gate' });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Updated Gate');
    });

    it('should return 403 for qae', async () => {
      const res = await request(app)
        .put('/api/quality-gates/qg-123')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: 'Updated' });

      expect(res.status).toBe(403);
    });
  });

  describe('DELETE /api/quality-gates/:id', () => {
    it('should delete quality gate for admin', async () => {
      mockService.delete.mockResolvedValue(undefined);

      const res = await request(app)
        .delete('/api/quality-gates/qg-123')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Quality gate deleted');
    });

    it('should return 403 for lead', async () => {
      const res = await request(app)
        .delete('/api/quality-gates/qg-123')
        .set('Authorization', `Bearer ${leadToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/quality-gates/:id/set-default', () => {
    it('should set default for admin', async () => {
      mockService.setDefault.mockResolvedValue({ ...mockQualityGate, isDefault: true });

      const res = await request(app)
        .post('/api/quality-gates/qg-123/set-default')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Quality gate set as default');
    });

    it('should return 403 for qae', async () => {
      const res = await request(app)
        .post('/api/quality-gates/qg-123/set-default')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/quality-gates/evaluate', () => {
    it('should evaluate execution for qae', async () => {
      const mockResult = { passed: true, score: 98, conditions: [] };
      mockService.evaluate.mockResolvedValue(mockResult);

      const res = await request(app)
        .post('/api/quality-gates/evaluate')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          executionId: '550e8400-e29b-41d4-a716-446655440000',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.passed).toBe(true);
    });

    it('should return 403 for viewer', async () => {
      const res = await request(app)
        .post('/api/quality-gates/evaluate')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          executionId: '550e8400-e29b-41d4-a716-446655440000',
        });

      expect(res.status).toBe(403);
    });

    it('should return 400 for invalid executionId', async () => {
      const res = await request(app)
        .post('/api/quality-gates/evaluate')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ executionId: 'not-a-uuid' });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/quality-gates/evaluations/:executionId', () => {
    it('should return evaluations for execution', async () => {
      mockService.getExecutionEvaluations.mockResolvedValue([{ id: 'eval-1', passed: true }]);

      const res = await request(app)
        .get('/api/quality-gates/evaluations/exec-123')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    it('should return 401 without auth', async () => {
      const res = await request(app).get('/api/quality-gates/evaluations/exec-123');
      expect(res.status).toBe(401);
    });
  });
});

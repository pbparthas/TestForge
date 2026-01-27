/**
 * Template Routes Integration Tests
 * Sprint 20: Tests for test template API
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';

// Mock service and JWT
const { mockTemplateService, mockJwt } = vi.hoisted(() => ({
  mockTemplateService: {
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    findById: vi.fn(),
    list: vi.fn(),
    getByCategory: vi.fn(),
    useTemplate: vi.fn(),
    seedBuiltInTemplates: vi.fn(),
    getAllTags: vi.fn(),
    getCategoryStats: vi.fn(),
  },
  mockJwt: {
    verify: vi.fn(),
    sign: vi.fn(),
  },
}));

vi.mock('../../src/services/template.service.js', () => ({
  templateService: mockTemplateService,
}));

vi.mock('jsonwebtoken', () => ({ default: mockJwt }));

import app from '../../src/app.js';

describe('Template Routes', () => {
  const adminToken = 'admin-token';
  const qaeToken = 'qae-token';
  const devToken = 'dev-token';

  const mockTemplate = {
    id: '00000000-0000-0000-0000-000000000001',
    name: 'Login Flow',
    description: 'Test user login',
    category: 'auth',
    content: {
      steps: [{ order: 1, action: 'Navigate', expected: 'Page loads' }],
      preconditions: 'User exists',
      expectedResult: 'User logged in',
    },
    variables: ['{{username}}'],
    tags: ['auth', 'login'],
    testType: 'functional',
    priority: 'high',
    isBuiltIn: false,
    isPublic: true,
    usageCount: 5,
  };

  const mockTestCase = {
    id: 'tc-123',
    projectId: 'project-123',
    title: 'Login Flow',
    priority: 'high',
    type: 'functional',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockJwt.verify.mockImplementation((token) => {
      if (token === adminToken) return { userId: 'admin-123', role: 'admin' };
      if (token === qaeToken) return { userId: 'qae-123', role: 'qae' };
      if (token === devToken) return { userId: 'dev-123', role: 'dev' };
      throw new Error('Invalid token');
    });
  });

  // ==========================================================================
  // LIST TEMPLATES
  // ==========================================================================

  describe('GET /api/templates', () => {
    it('should return paginated templates', async () => {
      mockTemplateService.list.mockResolvedValue({
        data: [mockTemplate],
        total: 1,
      });

      const res = await request(app)
        .get('/api/templates')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.pagination.total).toBe(1);
    });

    it('should filter by category', async () => {
      mockTemplateService.list.mockResolvedValue({ data: [mockTemplate], total: 1 });

      const res = await request(app)
        .get('/api/templates')
        .query({ category: 'auth' })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(mockTemplateService.list).toHaveBeenCalledWith(
        expect.objectContaining({ category: 'auth' })
      );
    });

    it('should filter by tags (comma-separated)', async () => {
      mockTemplateService.list.mockResolvedValue({ data: [mockTemplate], total: 1 });

      const res = await request(app)
        .get('/api/templates')
        .query({ tags: 'auth,login' })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(mockTemplateService.list).toHaveBeenCalledWith(
        expect.objectContaining({ tags: ['auth', 'login'] })
      );
    });

    it('should support pagination', async () => {
      mockTemplateService.list.mockResolvedValue({ data: [], total: 50 });

      const res = await request(app)
        .get('/api/templates')
        .query({ page: 2, limit: 10 })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.pagination.page).toBe(2);
      expect(res.body.pagination.limit).toBe(10);
      expect(res.body.pagination.totalPages).toBe(5);
    });

    it('should return 401 without auth', async () => {
      const res = await request(app).get('/api/templates');
      expect(res.status).toBe(401);
    });
  });

  // ==========================================================================
  // GET SINGLE TEMPLATE
  // ==========================================================================

  describe('GET /api/templates/:id', () => {
    it('should return a template by ID', async () => {
      mockTemplateService.findById.mockResolvedValue(mockTemplate);

      const res = await request(app)
        .get(`/api/templates/${mockTemplate.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Login Flow');
    });

    it('should return 404 for non-existent template', async () => {
      const { NotFoundError } = await import('../../src/errors/index.js');
      mockTemplateService.findById.mockRejectedValue(new NotFoundError('TestTemplate', 'nonexistent'));

      const res = await request(app)
        .get('/api/templates/nonexistent')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });
  });

  // ==========================================================================
  // GET BY CATEGORY
  // ==========================================================================

  describe('GET /api/templates/category/:category', () => {
    it('should return templates for a category', async () => {
      mockTemplateService.getByCategory.mockResolvedValue([mockTemplate]);

      const res = await request(app)
        .get('/api/templates/category/auth')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    it('should return 400 for invalid category', async () => {
      const res = await request(app)
        .get('/api/templates/category/invalid')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
    });
  });

  // ==========================================================================
  // CATEGORY STATS
  // ==========================================================================

  describe('GET /api/templates/categories', () => {
    it('should return category statistics', async () => {
      mockTemplateService.getCategoryStats.mockResolvedValue([
        { category: 'auth', count: 5 },
        { category: 'crud', count: 3 },
      ]);

      const res = await request(app)
        .get('/api/templates/categories')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });
  });

  // ==========================================================================
  // GET ALL TAGS
  // ==========================================================================

  describe('GET /api/templates/tags', () => {
    it('should return all unique tags', async () => {
      mockTemplateService.getAllTags.mockResolvedValue(['auth', 'login', 'crud']);

      const res = await request(app)
        .get('/api/templates/tags')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toContain('auth');
      expect(res.body.data).toContain('login');
    });
  });

  // ==========================================================================
  // CREATE TEMPLATE
  // ==========================================================================

  describe('POST /api/templates', () => {
    const createPayload = {
      name: 'New Template',
      description: 'A new test template',
      category: 'auth',
      content: {
        steps: [{ order: 1, action: 'Do something', expected: 'Something happens' }],
      },
      variables: ['{{var1}}'],
      tags: ['test'],
    };

    it('should create a template as admin', async () => {
      mockTemplateService.create.mockResolvedValue({ ...mockTemplate, ...createPayload });

      const res = await request(app)
        .post('/api/templates')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(createPayload);

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('New Template');
    });

    it('should create a template as QAE', async () => {
      mockTemplateService.create.mockResolvedValue({ ...mockTemplate, ...createPayload });

      const res = await request(app)
        .post('/api/templates')
        .set('Authorization', `Bearer ${qaeToken}`)
        .send(createPayload);

      expect(res.status).toBe(201);
    });

    it('should return 403 for dev role', async () => {
      const res = await request(app)
        .post('/api/templates')
        .set('Authorization', `Bearer ${devToken}`)
        .send(createPayload);

      expect(res.status).toBe(403);
    });

    it('should return 400 for missing required fields', async () => {
      const res = await request(app)
        .post('/api/templates')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Test' });

      expect(res.status).toBe(400);
    });

    it('should return 400 for empty steps', async () => {
      const res = await request(app)
        .post('/api/templates')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...createPayload, content: { steps: [] } });

      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid category', async () => {
      const res = await request(app)
        .post('/api/templates')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...createPayload, category: 'invalid' });

      expect(res.status).toBe(400);
    });
  });

  // ==========================================================================
  // USE TEMPLATE
  // ==========================================================================

  describe('POST /api/templates/use', () => {
    const usePayload = {
      templateId: '00000000-0000-0000-0000-000000000001',
      projectId: '00000000-0000-0000-0000-000000000002',
    };

    it('should create test case from template', async () => {
      mockTemplateService.useTemplate.mockResolvedValue(mockTestCase);

      const res = await request(app)
        .post('/api/templates/use')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(usePayload);

      expect(res.status).toBe(201);
      expect(res.body.message).toContain('Test case created');
      expect(res.body.data.id).toBe('tc-123');
    });

    it('should accept variable values', async () => {
      mockTemplateService.useTemplate.mockResolvedValue(mockTestCase);

      const res = await request(app)
        .post('/api/templates/use')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          ...usePayload,
          variableValues: { username: 'testuser', password: 'secret' },
        });

      expect(res.status).toBe(201);
      expect(mockTemplateService.useTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          variableValues: { username: 'testuser', password: 'secret' },
        })
      );
    });

    it('should accept overrides', async () => {
      mockTemplateService.useTemplate.mockResolvedValue(mockTestCase);

      const res = await request(app)
        .post('/api/templates/use')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          ...usePayload,
          overrides: { title: 'Custom Title', priority: 'critical' },
        });

      expect(res.status).toBe(201);
    });

    it('should return 400 for invalid UUIDs', async () => {
      const res = await request(app)
        .post('/api/templates/use')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ templateId: 'invalid', projectId: 'invalid' });

      expect(res.status).toBe(400);
    });
  });

  // ==========================================================================
  // UPDATE TEMPLATE
  // ==========================================================================

  describe('PUT /api/templates/:id', () => {
    it('should update a template', async () => {
      mockTemplateService.update.mockResolvedValue({ ...mockTemplate, name: 'Updated' });

      const res = await request(app)
        .put(`/api/templates/${mockTemplate.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Updated' });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Updated');
    });

    it('should return 409 when updating built-in template', async () => {
      const { ConflictError } = await import('../../src/errors/index.js');
      mockTemplateService.update.mockRejectedValue(new ConflictError('Built-in templates cannot be modified'));

      const res = await request(app)
        .put(`/api/templates/${mockTemplate.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Updated' });

      expect(res.status).toBe(409);
    });
  });

  // ==========================================================================
  // DELETE TEMPLATE
  // ==========================================================================

  describe('DELETE /api/templates/:id', () => {
    it('should delete a template as admin', async () => {
      mockTemplateService.delete.mockResolvedValue(undefined);

      const res = await request(app)
        .delete(`/api/templates/${mockTemplate.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('deleted');
    });

    it('should return 403 for QAE role', async () => {
      const res = await request(app)
        .delete(`/api/templates/${mockTemplate.id}`)
        .set('Authorization', `Bearer ${qaeToken}`);

      expect(res.status).toBe(403);
    });

    it('should return 409 when deleting built-in template', async () => {
      const { ConflictError } = await import('../../src/errors/index.js');
      mockTemplateService.delete.mockRejectedValue(new ConflictError('Built-in templates cannot be deleted'));

      const res = await request(app)
        .delete(`/api/templates/${mockTemplate.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(409);
    });
  });

  // ==========================================================================
  // SEED TEMPLATES
  // ==========================================================================

  describe('POST /api/templates/seed', () => {
    it('should seed templates as admin', async () => {
      mockTemplateService.seedBuiltInTemplates.mockResolvedValue({ created: 10, skipped: 0 });

      const res = await request(app)
        .post('/api/templates/seed')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.created).toBe(10);
    });

    it('should return 403 for non-admin', async () => {
      const res = await request(app)
        .post('/api/templates/seed')
        .set('Authorization', `Bearer ${qaeToken}`);

      expect(res.status).toBe(403);
    });
  });
});

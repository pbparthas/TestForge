/**
 * TestSuite Routes Integration Tests
 * Sprint 5: Integration tests for test suite management endpoints
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';

const { mockService, mockJwt } = vi.hoisted(() => ({
  mockService: {
    findAll: vi.fn(),
    findById: vi.fn(),
    findByIdWithTestCases: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    addTestCases: vi.fn(),
    removeTestCases: vi.fn(),
    reorderTestCases: vi.fn(),
    duplicate: vi.fn(),
  },
  mockJwt: {
    verify: vi.fn(),
    sign: vi.fn(),
  },
}));

vi.mock('../../src/services/testsuite.service.js', () => ({
  testSuiteService: mockService,
}));

vi.mock('jsonwebtoken', () => ({ default: mockJwt }));

import app from '../../src/app.js';

describe('TestSuite Routes Integration', () => {
  const adminToken = 'admin_test_token';
  const userToken = 'user_test_token';
  const viewerToken = 'viewer_test_token';

  const mockSuite = {
    id: 'suite-123',
    projectId: 'project-123',
    name: 'Login Tests',
    description: 'Test suite for login',
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

  describe('GET /api/test-suites', () => {
    it('should return paginated test suites', async () => {
      mockService.findAll.mockResolvedValue({ data: [mockSuite], total: 1 });

      const res = await request(app)
        .get('/api/test-suites')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });

    it('should support projectId filter', async () => {
      mockService.findAll.mockResolvedValue({ data: [], total: 0 });

      const res = await request(app)
        .get('/api/test-suites?projectId=proj-1')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(mockService.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ projectId: 'proj-1' })
      );
    });

    it('should return 401 without auth', async () => {
      const res = await request(app).get('/api/test-suites');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/test-suites/:id', () => {
    it('should return test suite by id', async () => {
      mockService.findById.mockResolvedValue(mockSuite);

      const res = await request(app)
        .get('/api/test-suites/suite-123')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe('suite-123');
    });

    it('should return 404 for non-existent suite', async () => {
      const { NotFoundError } = await import('../../src/errors/index.js');
      mockService.findById.mockRejectedValue(new NotFoundError('TestSuite', 'bad-id'));

      const res = await request(app)
        .get('/api/test-suites/bad-id')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/test-suites/:id/with-cases', () => {
    it('should return suite with test cases', async () => {
      const data = { ...mockSuite, testCases: [{ id: 'tc-1' }] };
      mockService.findByIdWithTestCases.mockResolvedValue(data);

      const res = await request(app)
        .get('/api/test-suites/suite-123/with-cases')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.testCases).toHaveLength(1);
    });
  });

  describe('POST /api/test-suites', () => {
    it('should create suite for qae', async () => {
      mockService.create.mockResolvedValue(mockSuite);

      const res = await request(app)
        .post('/api/test-suites')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          projectId: '550e8400-e29b-41d4-a716-446655440000',
          name: 'New Suite',
        });

      expect(res.status).toBe(201);
      expect(res.body.message).toBe('Test suite created');
    });

    it('should return 403 for viewer', async () => {
      const res = await request(app)
        .post('/api/test-suites')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          projectId: '550e8400-e29b-41d4-a716-446655440000',
          name: 'New Suite',
        });

      expect(res.status).toBe(403);
    });

    it('should return 400 for invalid input', async () => {
      const res = await request(app)
        .post('/api/test-suites')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: '' });

      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /api/test-suites/:id', () => {
    it('should update suite', async () => {
      mockService.update.mockResolvedValue({ ...mockSuite, name: 'Updated' });

      const res = await request(app)
        .patch('/api/test-suites/suite-123')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: 'Updated' });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Updated');
    });
  });

  describe('DELETE /api/test-suites/:id', () => {
    it('should delete suite for admin', async () => {
      mockService.delete.mockResolvedValue(undefined);

      const res = await request(app)
        .delete('/api/test-suites/suite-123')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Test suite deleted');
    });

    it('should return 403 for non-admin', async () => {
      const res = await request(app)
        .delete('/api/test-suites/suite-123')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/test-suites/:id/test-cases', () => {
    it('should add test cases to suite', async () => {
      mockService.addTestCases.mockResolvedValue({ count: 2 });

      const res = await request(app)
        .post('/api/test-suites/suite-123/test-cases')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          testCaseIds: [
            '550e8400-e29b-41d4-a716-446655440000',
            '550e8400-e29b-41d4-a716-446655440001',
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Test cases added');
    });

    it('should return 400 for empty array', async () => {
      const res = await request(app)
        .post('/api/test-suites/suite-123/test-cases')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ testCaseIds: [] });

      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/test-suites/:id/test-cases', () => {
    it('should remove test cases from suite', async () => {
      mockService.removeTestCases.mockResolvedValue({ count: 1 });

      const res = await request(app)
        .delete('/api/test-suites/suite-123/test-cases')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          testCaseIds: ['550e8400-e29b-41d4-a716-446655440000'],
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Test cases removed');
    });
  });

  describe('PUT /api/test-suites/:id/reorder', () => {
    it('should reorder test cases', async () => {
      mockService.reorderTestCases.mockResolvedValue(undefined);

      const res = await request(app)
        .put('/api/test-suites/suite-123/reorder')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          order: [
            { testCaseId: '550e8400-e29b-41d4-a716-446655440000', orderIndex: 0 },
            { testCaseId: '550e8400-e29b-41d4-a716-446655440001', orderIndex: 1 },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Test cases reordered');
    });
  });

  describe('POST /api/test-suites/:id/duplicate', () => {
    it('should duplicate suite', async () => {
      mockService.duplicate.mockResolvedValue({ ...mockSuite, id: 'suite-456', name: 'Login Tests (Copy)' });

      const res = await request(app)
        .post('/api/test-suites/suite-123/duplicate')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(201);
      expect(res.body.message).toBe('Test suite duplicated');
    });
  });
});

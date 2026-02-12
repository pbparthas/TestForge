/**
 * Duplicate Detection Routes Integration Tests
 * Sprint 5: Integration tests for duplicate detection endpoints
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';

const { mockService, mockJwt } = vi.hoisted(() => ({
  mockService: {
    checkTestCase: vi.fn(),
    checkScript: vi.fn(),
    checkSession: vi.fn(),
    getCheckById: vi.fn(),
    getProjectChecks: vi.fn(),
  },
  mockJwt: {
    verify: vi.fn(),
    sign: vi.fn(),
  },
}));

vi.mock('../../src/services/duplicate.service.js', () => ({
  duplicateDetectionService: mockService,
}));

vi.mock('jsonwebtoken', () => ({ default: mockJwt }));

import app from '../../src/app.js';

describe('Duplicate Routes Integration', () => {
  const adminToken = 'admin_test_token';
  const userToken = 'user_test_token';

  const mockDuplicateResult = {
    isDuplicate: false,
    confidence: 0,
    matchType: null,
    similarItems: [],
    checkId: 'check-123',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockJwt.verify.mockImplementation((token: string) => {
      if (token === adminToken) return { userId: 'admin-123', role: 'admin' };
      if (token === userToken) return { userId: 'user-123', role: 'qae' };
      throw new Error('Invalid token');
    });
  });

  describe('POST /api/duplicate/test-case', () => {
    it('should check test case for duplicates', async () => {
      mockService.checkTestCase.mockResolvedValue(mockDuplicateResult);

      const res = await request(app)
        .post('/api/duplicate/test-case')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          content: 'Test login page',
          projectId: '550e8400-e29b-41d4-a716-446655440000',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.checkId).toBe('check-123');
      expect(mockService.checkTestCase).toHaveBeenCalledWith(
        'Test login page',
        '550e8400-e29b-41d4-a716-446655440000',
        undefined
      );
    });

    it('should return 401 without auth', async () => {
      const res = await request(app)
        .post('/api/duplicate/test-case')
        .send({ content: 'test', projectId: '550e8400-e29b-41d4-a716-446655440000' });

      expect(res.status).toBe(401);
    });

    it('should return 400 for invalid input', async () => {
      const res = await request(app)
        .post('/api/duplicate/test-case')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ content: '' });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/duplicate/script', () => {
    it('should check script for duplicates', async () => {
      mockService.checkScript.mockResolvedValue(mockDuplicateResult);

      const res = await request(app)
        .post('/api/duplicate/script')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          code: 'describe("test", () => {})',
          projectId: '550e8400-e29b-41d4-a716-446655440000',
        });

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });

    it('should return 400 for missing code', async () => {
      const res = await request(app)
        .post('/api/duplicate/script')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ projectId: '550e8400-e29b-41d4-a716-446655440000' });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/duplicate/session/:sessionId', () => {
    it('should check session for duplicates', async () => {
      mockService.checkSession.mockResolvedValue(mockDuplicateResult);

      const res = await request(app)
        .post('/api/duplicate/session/session-123')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(mockService.checkSession).toHaveBeenCalledWith('session-123');
    });

    it('should return 401 without auth', async () => {
      const res = await request(app).post('/api/duplicate/session/session-123');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/duplicate/check/:id', () => {
    it('should return duplicate check by ID', async () => {
      const mockCheck = { id: 'check-123', isDuplicate: false, confidence: 0 };
      mockService.getCheckById.mockResolvedValue(mockCheck);

      const res = await request(app)
        .get('/api/duplicate/check/check-123')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe('check-123');
    });

    it('should return 404 for non-existent check', async () => {
      const { NotFoundError } = await import('../../src/errors/index.js');
      mockService.getCheckById.mockRejectedValue(new NotFoundError('DuplicateCheck', 'bad-id'));

      const res = await request(app)
        .get('/api/duplicate/check/bad-id')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(404);
    });

    it('should return 401 without auth', async () => {
      const res = await request(app).get('/api/duplicate/check/check-123');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/duplicate/project/:projectId', () => {
    it('should return project checks', async () => {
      const mockChecks = [{ id: 'check-1' }, { id: 'check-2' }];
      mockService.getProjectChecks.mockResolvedValue(mockChecks);

      const res = await request(app)
        .get('/api/duplicate/project/project-123')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.total).toBe(2);
    });

    it('should pass limit query param', async () => {
      mockService.getProjectChecks.mockResolvedValue([]);

      const res = await request(app)
        .get('/api/duplicate/project/project-123?limit=10')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(mockService.getProjectChecks).toHaveBeenCalledWith('project-123', 10);
    });

    it('should return 401 without auth', async () => {
      const res = await request(app).get('/api/duplicate/project/project-123');
      expect(res.status).toBe(401);
    });
  });
});

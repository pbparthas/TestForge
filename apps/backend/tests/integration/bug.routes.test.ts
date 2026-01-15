/**
 * Bug Routes Integration Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';

const { mockPrisma, mockJwt } = vi.hoisted(() => ({
  mockPrisma: {
    user: { findUnique: vi.fn() },
    bug: { create: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn() },
    executionResult: { findUnique: vi.fn() },
  },
  mockJwt: { sign: vi.fn(), verify: vi.fn() },
}));

vi.mock('../../src/utils/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('jsonwebtoken', () => ({ default: mockJwt }));

import app from '../../src/app.js';

describe('Bug Routes Integration', () => {
  const projectId = '11111111-1111-1111-1111-111111111111';
  const bugId = '22222222-2222-2222-2222-222222222222';
  const adminToken = 'admin_test_token';

  const mockBug = {
    id: bugId,
    projectId,
    title: 'Login button not working',
    description: 'Button fails to respond',
    status: 'open',
    priority: 'high',
    linkedTestCaseId: null,
    linkedExecutionId: null,
    externalId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockJwt.verify.mockReturnValue({ userId: 'user-123', role: 'admin' });
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-123', role: 'admin', isActive: true });
  });

  describe('POST /api/bugs', () => {
    it('should create a bug', async () => {
      mockPrisma.bug.create.mockResolvedValue(mockBug);

      const res = await request(app)
        .post('/api/bugs')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ projectId, title: 'Login button not working', priority: 'high' });

      expect(res.status).toBe(201);
      expect(res.body.data.title).toBe('Login button not working');
    });
  });

  describe('GET /api/bugs/:id', () => {
    it('should return bug by id', async () => {
      mockPrisma.bug.findUnique.mockResolvedValue(mockBug);

      const res = await request(app)
        .get(`/api/bugs/${bugId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(bugId);
    });
  });

  describe('PATCH /api/bugs/:id', () => {
    it('should update bug status', async () => {
      mockPrisma.bug.findUnique.mockResolvedValue(mockBug);
      mockPrisma.bug.update.mockResolvedValue({ ...mockBug, status: 'in_progress' });

      const res = await request(app)
        .patch(`/api/bugs/${bugId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'in_progress' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('in_progress');
    });
  });

  describe('POST /api/bugs/from-failure', () => {
    it('should create bug from failed execution result', async () => {
      const resultId = '33333333-3333-3333-3333-333333333333';
      mockPrisma.executionResult.findUnique.mockResolvedValue({
        id: resultId,
        status: 'failed',
        errorMessage: 'Element not found',
        errorStack: 'at line 10',
        testCaseId: '44444444-4444-4444-4444-444444444444',
        executionId: '55555555-5555-5555-5555-555555555555',
        testCase: { title: 'Login Test' },
        execution: { id: '55555555-5555-5555-5555-555555555555' },
      });
      mockPrisma.bug.findFirst.mockResolvedValue(null);
      mockPrisma.bug.create.mockResolvedValue({ ...mockBug, title: '[Auto] Login Test failed: Element not found' });

      const res = await request(app)
        .post('/api/bugs/from-failure')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ executionResultId: resultId, projectId, autoTitle: true });

      expect(res.status).toBe(201);
      expect(res.body.data.title).toContain('Login Test failed');
    });
  });

  describe('GET /api/bugs/project/:projectId/stats', () => {
    it('should return bug stats for project', async () => {
      mockPrisma.bug.findMany.mockResolvedValue([
        { ...mockBug, status: 'open' },
        { ...mockBug, id: 'bug-2', status: 'resolved' },
      ]);

      const res = await request(app)
        .get(`/api/bugs/project/${projectId}/stats`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(2);
      expect(res.body.data.open).toBe(1);
    });
  });
});

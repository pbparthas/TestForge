/**
 * TestCase Routes Integration Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import type { TestCase, Priority, Status, TestType } from '@prisma/client';

// Mock dependencies before importing app
const { mockPrisma, mockBcrypt, mockJwt } = vi.hoisted(() => ({
  mockPrisma: {
    user: { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    project: { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    testCase: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
      updateMany: vi.fn(),
    },
    refreshToken: { create: vi.fn(), findFirst: vi.fn(), deleteMany: vi.fn() },
  },
  mockBcrypt: { hash: vi.fn(), compare: vi.fn() },
  mockJwt: { sign: vi.fn(), verify: vi.fn() },
}));

vi.mock('../../src/utils/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('bcryptjs', () => ({ default: mockBcrypt }));
vi.mock('jsonwebtoken', () => ({ default: mockJwt }));

import app from '../../src/app.js';

describe('TestCase Routes Integration', () => {
  const mockTestCase: TestCase = {
    id: '00000000-0000-0000-0000-000000000001',
    projectId: '00000000-0000-0000-0000-000000000002',
    requirementId: '00000000-0000-0000-0000-000000000003',
    title: 'Verify login with valid credentials',
    description: 'Test the login flow',
    preconditions: 'User exists in system',
    steps: [{ order: 1, action: 'Navigate to login', expected: 'Login page displayed' }],
    expectedResult: 'User logged in successfully',
    testData: null,
    priority: 'high' as Priority,
    status: 'active' as Status,
    type: 'e2e' as TestType,
    isAutomated: false,
    createdById: 'user-123',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const adminToken = 'admin_test_token';
  const userToken = 'user_test_token';

  beforeEach(() => {
    vi.clearAllMocks();
    mockJwt.verify.mockImplementation((token: string) => {
      if (token === adminToken) return { userId: 'admin-123', role: 'admin' };
      if (token === userToken) return { userId: 'user-123', role: 'qae' };
      throw new Error('Invalid token');
    });
  });

  describe('GET /api/test-cases', () => {
    it('should return paginated test cases', async () => {
      mockPrisma.testCase.findMany.mockResolvedValue([mockTestCase]);
      mockPrisma.testCase.count.mockResolvedValue(1);

      const response = await request(app)
        .get('/api/test-cases')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.data).toHaveLength(1);
    });

    it('should filter by projectId', async () => {
      mockPrisma.testCase.findMany.mockResolvedValue([mockTestCase]);
      mockPrisma.testCase.count.mockResolvedValue(1);

      const response = await request(app)
        .get('/api/test-cases?projectId=00000000-0000-0000-0000-000000000002')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(mockPrisma.testCase.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ projectId: '00000000-0000-0000-0000-000000000002' }),
        })
      );
    });

    it('should return 401 without auth token', async () => {
      const response = await request(app).get('/api/test-cases');
      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/test-cases/:id', () => {
    it('should return test case by id', async () => {
      mockPrisma.testCase.findUnique.mockResolvedValue(mockTestCase);

      const response = await request(app)
        .get('/api/test-cases/tc-123')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe('00000000-0000-0000-0000-000000000001');
    });

    it('should return 404 for non-existent test case', async () => {
      mockPrisma.testCase.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/test-cases/nonexistent')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/test-cases', () => {
    it('should create a new test case', async () => {
      mockPrisma.testCase.create.mockResolvedValue(mockTestCase);

      const response = await request(app)
        .post('/api/test-cases')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          projectId: '00000000-0000-0000-0000-000000000002',
          title: 'New Test Case',
          description: 'A new test case',
          priority: 'high',
          type: 'e2e',
        });

      expect(response.status).toBe(201);
      expect(response.body.data.title).toBeDefined();
    });

    it('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/api/test-cases')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          description: 'Missing title and projectId',
        });

      expect(response.status).toBe(400);
    });
  });

  describe('PATCH /api/test-cases/:id', () => {
    it('should update test case', async () => {
      mockPrisma.testCase.findUnique.mockResolvedValue(mockTestCase);
      mockPrisma.testCase.update.mockResolvedValue({ ...mockTestCase, title: 'Updated title' });

      const response = await request(app)
        .patch('/api/test-cases/tc-123')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ title: 'Updated title' });

      expect(response.status).toBe(200);
      expect(response.body.data.title).toBe('Updated title');
    });

    it('should return 404 for non-existent test case', async () => {
      mockPrisma.testCase.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .patch('/api/test-cases/nonexistent')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ title: 'Updated title' });

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/test-cases/:id', () => {
    it('should delete test case for admin', async () => {
      mockPrisma.testCase.findUnique.mockResolvedValue(mockTestCase);
      mockPrisma.testCase.delete.mockResolvedValue(mockTestCase);

      const response = await request(app)
        .delete('/api/test-cases/tc-123')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
    });

    it('should return 403 for non-admin users', async () => {
      const response = await request(app)
        .delete('/api/test-cases/tc-123')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('POST /api/test-cases/:id/archive', () => {
    it('should archive test case', async () => {
      mockPrisma.testCase.findUnique.mockResolvedValue(mockTestCase);
      mockPrisma.testCase.update.mockResolvedValue({ ...mockTestCase, status: 'archived' });

      const response = await request(app)
        .post('/api/test-cases/tc-123/archive')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe('archived');
    });
  });

  describe('POST /api/test-cases/:id/duplicate', () => {
    it('should duplicate test case', async () => {
      mockPrisma.testCase.findUnique.mockResolvedValue(mockTestCase);
      mockPrisma.testCase.create.mockResolvedValue({
        ...mockTestCase,
        id: 'tc-new',
        title: 'Copy of Verify login with valid credentials',
      });

      const response = await request(app)
        .post('/api/test-cases/tc-123/duplicate')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(201);
      expect(response.body.data.title).toContain('Copy of');
    });
  });

  describe('POST /api/test-cases/bulk-update-status', () => {
    it('should bulk update status', async () => {
      mockPrisma.testCase.updateMany.mockResolvedValue({ count: 3 });

      const response = await request(app)
        .post('/api/test-cases/bulk-update-status')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          ids: ['00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000013'],
          status: 'inactive',
        });

      expect(response.status).toBe(200);
      expect(response.body.data.count).toBe(3);
    });
  });
});

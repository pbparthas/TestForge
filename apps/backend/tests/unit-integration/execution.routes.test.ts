/**
 * Execution Routes Integration Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';

const { mockPrisma, mockJwt, mockAnthropicCreate } = vi.hoisted(() => ({
  mockPrisma: {
    user: { findUnique: vi.fn() },
    execution: { create: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn(), count: vi.fn() },
    executionResult: { create: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
  },
  mockJwt: { sign: vi.fn(), verify: vi.fn() },
  mockAnthropicCreate: vi.fn(),
}));

vi.mock('../../src/utils/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('jsonwebtoken', () => ({ default: mockJwt }));
vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic { messages = { create: mockAnthropicCreate }; },
}));

import app from '../../src/app.js';

describe('Execution Routes Integration', () => {
  const projectId = '11111111-1111-1111-1111-111111111111';
  const executionId = '22222222-2222-2222-2222-222222222222';
  const adminToken = 'admin_test_token';

  const mockExecution = {
    id: executionId,
    projectId,
    suiteId: null,
    environmentId: null,
    status: 'pending',
    triggerType: 'manual',
    triggeredById: 'user-123',
    startedAt: null,
    completedAt: null,
    summary: null,
    createdAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockJwt.verify.mockReturnValue({ userId: 'user-123', role: 'admin' });
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-123', role: 'admin', isActive: true });
  });

  describe('POST /api/executions/trigger', () => {
    it('should trigger a new execution', async () => {
      mockPrisma.execution.create.mockResolvedValue(mockExecution);

      const res = await request(app)
        .post('/api/executions/trigger')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ projectId });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('pending');
    });
  });

  describe('GET /api/executions/:id', () => {
    it('should return execution by id', async () => {
      mockPrisma.execution.findUnique.mockResolvedValue({ ...mockExecution, results: [] });

      const res = await request(app)
        .get(`/api/executions/${executionId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(executionId);
    });
  });

  describe('POST /api/executions/:id/start', () => {
    it('should start execution', async () => {
      mockPrisma.execution.findUnique.mockResolvedValue(mockExecution);
      mockPrisma.execution.update.mockResolvedValue({ ...mockExecution, status: 'running', startedAt: new Date() });

      const res = await request(app)
        .post(`/api/executions/${executionId}/start`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('running');
    });
  });

  describe('POST /api/executions/:id/results', () => {
    it('should record test result', async () => {
      mockPrisma.executionResult.create.mockResolvedValue({
        id: 'result-123',
        executionId,
        status: 'passed',
        durationMs: 1500,
      });

      const res = await request(app)
        .post(`/api/executions/${executionId}/results`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'passed', durationMs: 1500 });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('passed');
    });
  });
});

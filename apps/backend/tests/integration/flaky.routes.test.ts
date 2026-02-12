/**
 * Flaky Test Routes Integration Tests
 * Sprint 5: Integration tests for flaky test management endpoints
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';

const { mockFlakyService, mockFlakyAgent, mockJwt } = vi.hoisted(() => ({
  mockFlakyService: {
    getFlakyTests: vi.fn(),
    getProjectSummary: vi.fn(),
    getTrends: vi.fn(),
    getQuarantinedTests: vi.fn(),
    getPatterns: vi.fn(),
    getFlakyTestById: vi.fn(),
    quarantineTest: vi.fn(),
    unquarantineTest: vi.fn(),
    updateFixStatus: vi.fn(),
    updatePatternType: vi.fn(),
    markAsFixed: vi.fn(),
    resetMetrics: vi.fn(),
    updateMetricsFromExecution: vi.fn(),
  },
  mockFlakyAgent: {
    analyzeRootCause: vi.fn(),
    detectPatterns: vi.fn(),
    generateReport: vi.fn(),
    suggestFix: vi.fn(),
    classifyPattern: vi.fn(),
  },
  mockJwt: {
    verify: vi.fn(),
    sign: vi.fn(),
  },
}));

vi.mock('../../src/services/flaky.service.js', () => ({
  flakyTestService: mockFlakyService,
}));

vi.mock('../../src/agents/flakyanalysis.agent.js', () => ({
  flakyAnalysisAgent: mockFlakyAgent,
}));

vi.mock('jsonwebtoken', () => ({ default: mockJwt }));

import app from '../../src/app.js';

describe('Flaky Routes Integration', () => {
  const adminToken = 'admin_test_token';
  const userToken = 'user_test_token';

  const mockFlakyTest = {
    id: 'flaky-123',
    testCaseId: 'tc-123',
    projectId: 'project-123',
    flakinessScore: 75,
    isQuarantined: false,
    fixStatus: 'open',
    patternType: 'timing',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockJwt.verify.mockImplementation((token: string) => {
      if (token === adminToken) return { userId: 'admin-123', role: 'admin' };
      if (token === userToken) return { userId: 'user-123', role: 'qae' };
      throw new Error('Invalid token');
    });
  });

  // ==========================================================================
  // PROJECT ROUTES
  // ==========================================================================

  describe('GET /api/flaky/:projectId', () => {
    it('should return flaky tests for project', async () => {
      mockFlakyService.getFlakyTests.mockResolvedValue([mockFlakyTest]);

      const res = await request(app)
        .get('/api/flaky/project-123')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.total).toBe(1);
    });

    it('should support query filters', async () => {
      mockFlakyService.getFlakyTests.mockResolvedValue([]);

      const res = await request(app)
        .get('/api/flaky/project-123?threshold=50&isQuarantined=true&fixStatus=open')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(mockFlakyService.getFlakyTests).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 'project-123',
          threshold: 50,
          isQuarantined: true,
          fixStatus: 'open',
        })
      );
    });

    it('should return 401 without auth', async () => {
      const res = await request(app).get('/api/flaky/project-123');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/flaky/:projectId/summary', () => {
    it('should return project summary', async () => {
      const summary = { totalFlaky: 5, quarantined: 2, avgScore: 60 };
      mockFlakyService.getProjectSummary.mockResolvedValue(summary);

      const res = await request(app)
        .get('/api/flaky/project-123/summary')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.totalFlaky).toBe(5);
    });
  });

  describe('GET /api/flaky/:projectId/trends', () => {
    it('should return trends with default days', async () => {
      mockFlakyService.getTrends.mockResolvedValue([]);

      const res = await request(app)
        .get('/api/flaky/project-123/trends')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(mockFlakyService.getTrends).toHaveBeenCalledWith('project-123', 30);
    });

    it('should accept custom days param', async () => {
      mockFlakyService.getTrends.mockResolvedValue([]);

      const res = await request(app)
        .get('/api/flaky/project-123/trends?days=7')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(mockFlakyService.getTrends).toHaveBeenCalledWith('project-123', 7);
    });
  });

  describe('GET /api/flaky/:projectId/quarantined', () => {
    it('should return quarantined tests', async () => {
      mockFlakyService.getQuarantinedTests.mockResolvedValue([mockFlakyTest]);

      const res = await request(app)
        .get('/api/flaky/project-123/quarantined')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });
  });

  describe('GET /api/flaky/:projectId/patterns', () => {
    it('should return detected patterns', async () => {
      mockFlakyService.getPatterns.mockResolvedValue([{ patternType: 'timing', count: 3 }]);

      const res = await request(app)
        .get('/api/flaky/project-123/patterns')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });
  });

  // ==========================================================================
  // SINGLE TEST ROUTES
  // ==========================================================================

  describe('GET /api/flaky/test/:id', () => {
    it('should return flaky test by id', async () => {
      mockFlakyService.getFlakyTestById.mockResolvedValue(mockFlakyTest);

      const res = await request(app)
        .get('/api/flaky/test/flaky-123')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe('flaky-123');
    });

    it('should return 404 for non-existent', async () => {
      const { NotFoundError } = await import('../../src/errors/index.js');
      mockFlakyService.getFlakyTestById.mockRejectedValue(new NotFoundError('FlakyTest', 'bad-id'));

      const res = await request(app)
        .get('/api/flaky/test/bad-id')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/flaky/test/:id/quarantine', () => {
    it('should quarantine test', async () => {
      mockFlakyService.quarantineTest.mockResolvedValue({ ...mockFlakyTest, isQuarantined: true });

      const res = await request(app)
        .post('/api/flaky/test/flaky-123/quarantine')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ reason: 'Consistently failing in CI' });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Test quarantined');
      expect(mockFlakyService.quarantineTest).toHaveBeenCalledWith('flaky-123', 'user-123', 'Consistently failing in CI');
    });

    it('should return 400 for missing reason', async () => {
      const res = await request(app)
        .post('/api/flaky/test/flaky-123/quarantine')
        .set('Authorization', `Bearer ${userToken}`)
        .send({});

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/flaky/test/:id/unquarantine', () => {
    it('should unquarantine test', async () => {
      mockFlakyService.unquarantineTest.mockResolvedValue({ ...mockFlakyTest, isQuarantined: false });

      const res = await request(app)
        .post('/api/flaky/test/flaky-123/unquarantine')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Test unquarantined');
    });
  });

  describe('POST /api/flaky/test/:id/fix-status', () => {
    it('should update fix status', async () => {
      mockFlakyService.updateFixStatus.mockResolvedValue({ ...mockFlakyTest, fixStatus: 'investigating' });

      const res = await request(app)
        .post('/api/flaky/test/flaky-123/fix-status')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ status: 'investigating' });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Fix status updated');
    });

    it('should return 400 for invalid status', async () => {
      const res = await request(app)
        .post('/api/flaky/test/flaky-123/fix-status')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ status: 'invalid' });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/flaky/test/:id/pattern', () => {
    it('should update pattern type', async () => {
      mockFlakyService.updatePatternType.mockResolvedValue({ ...mockFlakyTest, patternType: 'race_condition' });

      const res = await request(app)
        .post('/api/flaky/test/flaky-123/pattern')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ patternType: 'race_condition' });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Pattern type updated');
    });

    it('should return 400 for invalid pattern', async () => {
      const res = await request(app)
        .post('/api/flaky/test/flaky-123/pattern')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ patternType: 'invalid' });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/flaky/test/:id/mark-fixed', () => {
    it('should mark test as fixed', async () => {
      mockFlakyService.markAsFixed.mockResolvedValue({ ...mockFlakyTest, fixStatus: 'fixed' });

      const res = await request(app)
        .post('/api/flaky/test/flaky-123/mark-fixed')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Test marked as fixed');
    });
  });

  describe('POST /api/flaky/test/:id/reset', () => {
    it('should reset test metrics', async () => {
      mockFlakyService.resetMetrics.mockResolvedValue(mockFlakyTest);

      const res = await request(app)
        .post('/api/flaky/test/flaky-123/reset')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Metrics reset');
    });
  });

  // ==========================================================================
  // EXECUTION INTEGRATION
  // ==========================================================================

  describe('POST /api/flaky/execution/:executionId/update', () => {
    it('should update metrics from execution', async () => {
      mockFlakyService.updateMetricsFromExecution.mockResolvedValue({ updated: 3 });

      const res = await request(app)
        .post('/api/flaky/execution/exec-123/update')
        .set('Authorization', `Bearer ${userToken}`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Metrics updated from execution');
    });

    it('should accept autoQuarantineThreshold', async () => {
      mockFlakyService.updateMetricsFromExecution.mockResolvedValue({ updated: 1 });

      const res = await request(app)
        .post('/api/flaky/execution/exec-123/update')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ autoQuarantineThreshold: 80 });

      expect(res.status).toBe(200);
      expect(mockFlakyService.updateMetricsFromExecution).toHaveBeenCalledWith('exec-123', 80);
    });
  });

  // ==========================================================================
  // AI ANALYSIS ROUTES
  // ==========================================================================

  describe('POST /api/flaky/ai/analyze', () => {
    it('should perform AI root cause analysis', async () => {
      mockFlakyAgent.analyzeRootCause.mockResolvedValue({
        data: { rootCause: 'timing issue' },
        usage: { inputTokens: 100, outputTokens: 50 },
      });

      const res = await request(app)
        .post('/api/flaky/ai/analyze')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          testName: 'login.test.ts',
          testCode: 'it("should login", () => {})',
          executionHistory: [
            {
              executionId: 'exec-1',
              timestamp: '2026-01-01T00:00:00Z',
              status: 'failed',
              duration: 5000,
            },
          ],
          flakinessScore: 75,
          recentErrors: ['TimeoutError'],
        });

      expect(res.status).toBe(200);
      expect(res.body.data.rootCause).toBe('timing issue');
    });

    it('should return 400 for missing required fields', async () => {
      const res = await request(app)
        .post('/api/flaky/ai/analyze')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ testName: 'test' });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/flaky/ai/patterns', () => {
    it('should detect patterns', async () => {
      mockFlakyAgent.detectPatterns.mockResolvedValue({
        data: { patterns: [] },
        usage: { inputTokens: 100, outputTokens: 50 },
      });

      const res = await request(app)
        .post('/api/flaky/ai/patterns')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          projectId: '550e8400-e29b-41d4-a716-446655440000',
          flakyTests: [
            {
              testName: 'login.test.ts',
              flakinessScore: 75,
              totalRuns: 100,
              passRate: 75,
              recentErrors: ['TimeoutError'],
            },
          ],
        });

      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/flaky/ai/report', () => {
    it('should generate report', async () => {
      mockFlakyAgent.generateReport.mockResolvedValue({
        data: { report: 'Summary report...' },
        usage: { inputTokens: 200, outputTokens: 100 },
      });

      const res = await request(app)
        .post('/api/flaky/ai/report')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          projectId: '550e8400-e29b-41d4-a716-446655440000',
          projectName: 'TestForge',
          flakyTests: [
            {
              testName: 'login.test.ts',
              flakinessScore: 75,
              patternType: 'timing',
              isQuarantined: false,
              fixStatus: 'open',
            },
          ],
          patterns: [
            { patternType: 'timing', description: 'Timing issues', affectedCount: 3 },
          ],
          trends: { totalFlaky: 5, newFlaky: 1, fixed: 2, quarantined: 1, avgScore: 60 },
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Report generated');
    });
  });

  describe('POST /api/flaky/ai/suggest-fix', () => {
    it('should suggest fixes', async () => {
      mockFlakyAgent.suggestFix.mockResolvedValue({
        data: { suggestions: ['Add explicit wait'] },
        usage: { inputTokens: 100, outputTokens: 50 },
      });

      const res = await request(app)
        .post('/api/flaky/ai/suggest-fix')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          testName: 'login.test.ts',
          testCode: 'it("should login", () => {})',
          patternType: 'timing',
          errorMessages: ['TimeoutError: waiting for selector'],
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Fix suggestions generated');
    });
  });

  describe('POST /api/flaky/ai/classify', () => {
    it('should classify pattern', async () => {
      mockFlakyAgent.classifyPattern.mockResolvedValue({
        data: { patternType: 'timing', confidence: 90 },
        usage: { inputTokens: 50, outputTokens: 30 },
      });

      const res = await request(app)
        .post('/api/flaky/ai/classify')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          testName: 'login.test.ts',
          errorMessages: ['TimeoutError: waiting for selector'],
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Pattern classification complete');
    });

    it('should return 400 for empty errorMessages', async () => {
      const res = await request(app)
        .post('/api/flaky/ai/classify')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          testName: 'test',
          errorMessages: [],
        });

      expect(res.status).toBe(400);
    });
  });
});

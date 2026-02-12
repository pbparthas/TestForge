/**
 * Traceability Routes Integration Tests
 * Sprint 5: Integration tests for traceability endpoints
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';

const { mockService, mockJwt } = vi.hoisted(() => ({
  mockService: {
    getProjectCoverage: vi.fn(),
    getRequirementCoverage: vi.fn(),
    getTraceabilityChain: vi.fn(),
    getCoverageGaps: vi.fn(),
  },
  mockJwt: {
    verify: vi.fn(),
    sign: vi.fn(),
  },
}));

vi.mock('../../src/services/traceability.service.js', () => ({
  traceabilityService: mockService,
}));

vi.mock('jsonwebtoken', () => ({ default: mockJwt }));

import app from '../../src/app.js';

describe('Traceability Routes Integration', () => {
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

  describe('GET /api/traceability/coverage/:projectId', () => {
    it('should return project coverage for authenticated user', async () => {
      const mockCoverage = { totalRequirements: 10, covered: 8, percentage: 80 };
      mockService.getProjectCoverage.mockResolvedValue(mockCoverage);

      const res = await request(app)
        .get('/api/traceability/coverage/project-123')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual(mockCoverage);
      expect(mockService.getProjectCoverage).toHaveBeenCalledWith('project-123');
    });

    it('should return 401 without auth token', async () => {
      const res = await request(app).get('/api/traceability/coverage/project-123');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/traceability/requirements/:projectId', () => {
    it('should return requirement coverage', async () => {
      const mockData = [{ requirementId: 'req-1', testCaseCount: 3, coverage: 100 }];
      mockService.getRequirementCoverage.mockResolvedValue(mockData);

      const res = await request(app)
        .get('/api/traceability/requirements/project-123')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual(mockData);
    });

    it('should return 401 without auth token', async () => {
      const res = await request(app).get('/api/traceability/requirements/project-123');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/traceability/chain/:requirementId', () => {
    it('should return traceability chain', async () => {
      const mockChain = {
        requirement: { id: 'req-1', title: 'Login' },
        testCases: [{ id: 'tc-1' }],
        executions: [],
        bugs: [],
      };
      mockService.getTraceabilityChain.mockResolvedValue(mockChain);

      const res = await request(app)
        .get('/api/traceability/chain/req-1')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual(mockChain);
      expect(mockService.getTraceabilityChain).toHaveBeenCalledWith('req-1');
    });

    it('should return 401 without auth token', async () => {
      const res = await request(app).get('/api/traceability/chain/req-1');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/traceability/gaps/:projectId', () => {
    it('should return coverage gaps', async () => {
      const mockGaps = [{ requirementId: 'req-2', title: 'Checkout', missingTestTypes: ['unit'] }];
      mockService.getCoverageGaps.mockResolvedValue(mockGaps);

      const res = await request(app)
        .get('/api/traceability/gaps/project-123')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual(mockGaps);
    });

    it('should return 401 without auth token', async () => {
      const res = await request(app).get('/api/traceability/gaps/project-123');
      expect(res.status).toBe(401);
    });
  });
});

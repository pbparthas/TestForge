/**
 * Dashboard Routes Integration Tests
 * Tests the full HTTP request/response cycle for executive dashboard endpoints
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import type { DashboardMetric, DashboardSnapshot, MetricType, MetricPeriod } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

// Mock dependencies before importing app
const { mockPrisma, mockBcrypt, mockJwt } = vi.hoisted(() => ({
  mockPrisma: {
    user: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    dashboardMetric: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    dashboardSnapshot: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    execution: {
      count: vi.fn(),
    },
    executionResult: {
      count: vi.fn(),
      groupBy: vi.fn(),
    },
    testCase: {
      count: vi.fn(),
    },
    bug: {
      count: vi.fn(),
    },
    flakyTest: {
      count: vi.fn(),
    },
    aiUsage: {
      aggregate: vi.fn(),
    },
    project: {
      count: vi.fn(),
    },
    refreshToken: {
      create: vi.fn(),
      findFirst: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
  mockBcrypt: {
    hash: vi.fn(),
    compare: vi.fn(),
  },
  mockJwt: {
    sign: vi.fn(),
    verify: vi.fn(),
  },
}));

vi.mock('../../src/utils/prisma.js', () => ({
  prisma: mockPrisma,
}));

vi.mock('bcryptjs', () => ({
  default: mockBcrypt,
}));

vi.mock('jsonwebtoken', () => ({
  default: mockJwt,
}));

// Import app after mocking
import app from '../../src/app.js';

describe('Dashboard Routes Integration', () => {
  const mockMetric: DashboardMetric = {
    id: 'metric-123',
    projectId: 'project-123',
    name: 'pass_rate',
    type: 'percentage' as MetricType,
    value: new Decimal(85.5),
    previousValue: new Decimal(80.0),
    changePercent: new Decimal(6.88),
    period: 'daily' as MetricPeriod,
    periodStart: new Date('2026-01-22'),
    periodEnd: new Date('2026-01-23'),
    metadata: null,
    createdAt: new Date(),
  };

  const mockSnapshot: DashboardSnapshot = {
    id: 'snapshot-123',
    projectId: 'project-123',
    snapshotAt: new Date(),
    data: {
      passRate: 85,
      testCoverage: 80,
      flakinessScore: 5,
    },
    createdById: 'user-123',
    createdAt: new Date(),
  };

  const adminToken = 'admin_test_token';
  const leadToken = 'lead_test_token';
  const userToken = 'user_test_token';

  beforeEach(() => {
    vi.clearAllMocks();

    mockJwt.verify.mockImplementation((token: string) => {
      if (token === adminToken) {
        return { userId: 'admin-123', role: 'admin' };
      }
      if (token === leadToken) {
        return { userId: 'lead-123', role: 'lead' };
      }
      if (token === userToken) {
        return { userId: 'user-123', role: 'qae' };
      }
      throw new Error('Invalid token');
    });

    // Default mocks for aggregate methods
    mockPrisma.aiUsage.aggregate.mockResolvedValue({
      _sum: {
        costUsd: new Decimal(100),
        inputTokens: 1000,
        outputTokens: 500,
      },
      _count: { id: 100 },
    });
    mockPrisma.executionResult.groupBy.mockResolvedValue([]);
  });

  // =============================================================================
  // DASHBOARD DATA
  // =============================================================================

  describe('GET /api/dashboard', () => {
    it('should return complete dashboard data', async () => {
      mockPrisma.executionResult.count.mockResolvedValue(100);
      mockPrisma.testCase.count.mockResolvedValue(100);
      mockPrisma.flakyTest.count.mockResolvedValue(5);
      mockPrisma.execution.count.mockResolvedValue(50);
      mockPrisma.bug.count.mockResolvedValue(10);

      const response = await request(app)
        .get('/api/dashboard')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('passRate');
      expect(response.body.data).toHaveProperty('testCoverage');
      expect(response.body.data).toHaveProperty('flakinessScore');
      expect(response.body.data).toHaveProperty('executionSummary');
      expect(response.body.data).toHaveProperty('aiCostSummary');
    });

    it('should filter by projectId', async () => {
      mockPrisma.executionResult.count.mockResolvedValue(0);
      mockPrisma.testCase.count.mockResolvedValue(0);
      mockPrisma.flakyTest.count.mockResolvedValue(0);
      mockPrisma.execution.count.mockResolvedValue(0);
      mockPrisma.bug.count.mockResolvedValue(0);

      const response = await request(app)
        .get('/api/dashboard?projectId=project-123')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
    });

    it('should return 401 without auth token', async () => {
      const response = await request(app).get('/api/dashboard');
      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/dashboard/global', () => {
    it('should return global summary', async () => {
      mockPrisma.project.count.mockResolvedValue(10);
      mockPrisma.testCase.count.mockResolvedValue(1000);
      mockPrisma.execution.count.mockResolvedValue(500);
      mockPrisma.bug.count.mockResolvedValue(50);

      const response = await request(app)
        .get('/api/dashboard/global')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.totalProjects).toBe(10);
      expect(response.body.data.totalTestCases).toBe(1000);
    });
  });

  describe('GET /api/dashboard/pass-rate', () => {
    it('should return pass rate metric', async () => {
      mockPrisma.executionResult.count.mockResolvedValueOnce(100);
      mockPrisma.executionResult.count.mockResolvedValueOnce(85);

      const response = await request(app)
        .get('/api/dashboard/pass-rate')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('passRate');
      expect(response.body.data).toHaveProperty('days');
    });
  });

  describe('GET /api/dashboard/test-coverage', () => {
    it('should return test coverage metric', async () => {
      mockPrisma.testCase.count.mockResolvedValueOnce(100);
      mockPrisma.testCase.count.mockResolvedValueOnce(80);

      const response = await request(app)
        .get('/api/dashboard/test-coverage')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('testCoverage');
    });
  });

  describe('GET /api/dashboard/flakiness', () => {
    it('should return flakiness score', async () => {
      mockPrisma.flakyTest.count.mockResolvedValue(10);
      mockPrisma.testCase.count.mockResolvedValue(100);

      const response = await request(app)
        .get('/api/dashboard/flakiness')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('flakinessScore');
    });
  });

  describe('GET /api/dashboard/executions', () => {
    it('should return execution summary', async () => {
      mockPrisma.execution.count.mockResolvedValue(50);
      mockPrisma.executionResult.groupBy.mockResolvedValue([
        { status: 'passed', _count: { status: 40 } },
        { status: 'failed', _count: { status: 10 } },
      ]);

      const response = await request(app)
        .get('/api/dashboard/executions')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('totalExecutions');
      expect(response.body.data).toHaveProperty('resultsByStatus');
    });
  });

  describe('GET /api/dashboard/ai-costs', () => {
    it('should return AI cost summary', async () => {
      const response = await request(app)
        .get('/api/dashboard/ai-costs')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('totalCostUsd');
      expect(response.body.data).toHaveProperty('totalRequests');
    });
  });

  // =============================================================================
  // METRICS
  // =============================================================================

  describe('GET /api/dashboard/metrics', () => {
    it('should return metrics with filters', async () => {
      mockPrisma.dashboardMetric.findMany.mockResolvedValue([mockMetric]);

      const response = await request(app)
        .get('/api/dashboard/metrics?period=daily')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
    });

    it('should filter by date range', async () => {
      mockPrisma.dashboardMetric.findMany.mockResolvedValue([mockMetric]);

      const response = await request(app)
        .get('/api/dashboard/metrics?startDate=2026-01-01T00:00:00Z&endDate=2026-01-31T23:59:59Z')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/dashboard/metrics/:name', () => {
    it('should return latest metric by name', async () => {
      mockPrisma.dashboardMetric.findMany.mockResolvedValue([mockMetric]);

      const response = await request(app)
        .get('/api/dashboard/metrics/pass_rate')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
    });
  });

  describe('POST /api/dashboard/metrics', () => {
    it('should record metric for admin', async () => {
      mockPrisma.dashboardMetric.create.mockResolvedValue(mockMetric);

      const response = await request(app)
        .post('/api/dashboard/metrics')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'pass_rate',
          type: 'percentage',
          value: 85.5,
          period: 'daily',
          periodStart: '2026-01-22T00:00:00Z',
          periodEnd: '2026-01-23T00:00:00Z',
        });

      expect(response.status).toBe(201);
      expect(response.body.data.name).toBe('pass_rate');
    });

    it('should record metric for lead', async () => {
      mockPrisma.dashboardMetric.create.mockResolvedValue(mockMetric);

      const response = await request(app)
        .post('/api/dashboard/metrics')
        .set('Authorization', `Bearer ${leadToken}`)
        .send({
          name: 'pass_rate',
          type: 'percentage',
          value: 85.5,
          period: 'daily',
          periodStart: '2026-01-22T00:00:00Z',
          periodEnd: '2026-01-23T00:00:00Z',
        });

      expect(response.status).toBe(201);
    });

    it('should return 403 for regular users', async () => {
      const response = await request(app)
        .post('/api/dashboard/metrics')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'pass_rate',
          type: 'percentage',
          value: 85.5,
          period: 'daily',
          periodStart: '2026-01-22T00:00:00Z',
          periodEnd: '2026-01-23T00:00:00Z',
        });

      expect(response.status).toBe(403);
    });

    it('should return 400 for invalid input', async () => {
      const response = await request(app)
        .post('/api/dashboard/metrics')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: '', // Empty name should fail
        });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/dashboard/trend', () => {
    it('should return trend data', async () => {
      mockPrisma.dashboardMetric.findMany.mockResolvedValue([mockMetric]);

      const response = await request(app)
        .get('/api/dashboard/trend?name=pass_rate')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
    });

    it('should return 400 for missing name', async () => {
      const response = await request(app)
        .get('/api/dashboard/trend')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(400);
    });
  });

  // =============================================================================
  // SNAPSHOTS
  // =============================================================================

  describe('GET /api/dashboard/snapshots', () => {
    it('should return dashboard snapshots', async () => {
      mockPrisma.dashboardSnapshot.findMany.mockResolvedValue([mockSnapshot]);

      const response = await request(app)
        .get('/api/dashboard/snapshots')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
    });
  });

  describe('GET /api/dashboard/snapshots/latest', () => {
    it('should return latest snapshot', async () => {
      mockPrisma.dashboardSnapshot.findMany.mockResolvedValue([mockSnapshot]);

      const response = await request(app)
        .get('/api/dashboard/snapshots/latest')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe('snapshot-123');
    });
  });

  describe('GET /api/dashboard/snapshots/:id', () => {
    it('should return snapshot by id', async () => {
      mockPrisma.dashboardSnapshot.findUnique.mockResolvedValue(mockSnapshot);

      const response = await request(app)
        .get('/api/dashboard/snapshots/snapshot-123')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe('snapshot-123');
    });

    it('should return 404 for non-existent snapshot', async () => {
      mockPrisma.dashboardSnapshot.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/dashboard/snapshots/nonexistent')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/dashboard/snapshots', () => {
    it('should create snapshot for admin', async () => {
      mockPrisma.executionResult.count.mockResolvedValue(100);
      mockPrisma.testCase.count.mockResolvedValue(100);
      mockPrisma.flakyTest.count.mockResolvedValue(5);
      mockPrisma.execution.count.mockResolvedValue(50);
      mockPrisma.bug.count.mockResolvedValue(10);
      mockPrisma.dashboardSnapshot.create.mockResolvedValue(mockSnapshot);

      const response = await request(app)
        .post('/api/dashboard/snapshots')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ projectId: 'project-123' });

      expect(response.status).toBe(201);
    });

    it('should return 403 for regular users', async () => {
      const response = await request(app)
        .post('/api/dashboard/snapshots')
        .set('Authorization', `Bearer ${userToken}`)
        .send({});

      expect(response.status).toBe(403);
    });
  });

  // =============================================================================
  // MAINTENANCE
  // =============================================================================

  describe('POST /api/dashboard/record-daily', () => {
    it('should record daily metrics for admin', async () => {
      mockPrisma.executionResult.count.mockResolvedValue(100);
      mockPrisma.testCase.count.mockResolvedValue(100);
      mockPrisma.flakyTest.count.mockResolvedValue(5);
      mockPrisma.dashboardMetric.findMany.mockResolvedValue([]);
      mockPrisma.dashboardMetric.create.mockResolvedValue(mockMetric);

      const response = await request(app)
        .post('/api/dashboard/record-daily')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ projectId: 'project-123' });

      expect(response.status).toBe(200);
    });

    it('should return 403 for non-admin users', async () => {
      const response = await request(app)
        .post('/api/dashboard/record-daily')
        .set('Authorization', `Bearer ${leadToken}`)
        .send({ projectId: 'project-123' });

      expect(response.status).toBe(403);
    });

    it('should return 400 for missing projectId', async () => {
      const response = await request(app)
        .post('/api/dashboard/record-daily')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/dashboard/cleanup', () => {
    it('should cleanup old data for admin', async () => {
      mockPrisma.dashboardMetric.deleteMany.mockResolvedValue({ count: 100 });
      mockPrisma.dashboardSnapshot.deleteMany.mockResolvedValue({ count: 10 });

      const response = await request(app)
        .post('/api/dashboard/cleanup')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ retentionDays: 90 });

      expect(response.status).toBe(200);
      expect(response.body.data.metricsDeleted).toBe(100);
      expect(response.body.data.snapshotsDeleted).toBe(10);
    });

    it('should return 403 for non-admin users', async () => {
      const response = await request(app)
        .post('/api/dashboard/cleanup')
        .set('Authorization', `Bearer ${leadToken}`)
        .send({ retentionDays: 90 });

      expect(response.status).toBe(403);
    });
  });
});

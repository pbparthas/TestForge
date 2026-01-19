/**
 * Test Evolution Agent Routes Integration Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';

const { mockPrisma, mockJwt, mockAnthropicCreate } = vi.hoisted(() => ({
  mockPrisma: {
    user: { findUnique: vi.fn() },
    aiUsage: { create: vi.fn(), findMany: vi.fn(), count: vi.fn() },
  },
  mockJwt: { sign: vi.fn(), verify: vi.fn() },
  mockAnthropicCreate: vi.fn(),
}));

vi.mock('../../src/utils/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('jsonwebtoken', () => ({ default: mockJwt }));
vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create: mockAnthropicCreate };
  },
}));

import app from '../../src/app.js';

describe('Test Evolution Agent Routes Integration', () => {
  const adminToken = 'admin_test_token';
  const userToken = 'user_test_token';

  // Sample test suite input
  const sampleTestSuiteInput = {
    tests: [
      {
        id: 'test-001',
        name: 'should authenticate user with valid credentials',
        file: 'tests/auth.test.ts',
        line: 15,
        suite: 'AuthService',
        tags: ['auth', 'unit'],
        lastModified: '2025-12-01T10:00:00Z',
        createdAt: '2025-01-15T08:00:00Z',
      },
      {
        id: 'test-002',
        name: 'should reject invalid password',
        file: 'tests/auth.test.ts',
        line: 35,
        suite: 'AuthService',
        tags: ['auth', 'unit'],
        lastModified: '2025-12-15T14:00:00Z',
        createdAt: '2025-01-15T08:30:00Z',
      },
      {
        id: 'test-003',
        name: 'should process payment successfully',
        file: 'tests/payment.test.ts',
        line: 10,
        suite: 'PaymentService',
        tags: ['payment', 'integration'],
        lastModified: '2024-06-01T10:00:00Z',
        createdAt: '2024-01-01T10:00:00Z',
      },
    ],
    projectRoot: '/home/user/project',
  };

  // Sample execution history
  const sampleExecutionHistory = {
    runs: [
      {
        id: 'run-001',
        timestamp: '2026-01-18T10:00:00Z',
        duration: 45000,
        results: [
          { testId: 'test-001', status: 'passed' as const, duration: 120 },
          { testId: 'test-002', status: 'passed' as const, duration: 85 },
          { testId: 'test-003', status: 'failed' as const, duration: 2500, error: 'Timeout' },
        ],
      },
      {
        id: 'run-002',
        timestamp: '2026-01-17T10:00:00Z',
        duration: 42000,
        results: [
          { testId: 'test-001', status: 'passed' as const, duration: 115 },
          { testId: 'test-002', status: 'flaky' as const, duration: 90 },
          { testId: 'test-003', status: 'passed' as const, duration: 2200 },
        ],
      },
    ],
    totalRuns: 50,
    timeRange: {
      from: '2025-01-01T00:00:00Z',
      to: '2026-01-19T00:00:00Z',
    },
  };

  // Sample coverage data
  const sampleCoverageData = {
    current: {
      timestamp: '2026-01-18T10:00:00Z',
      overall: 78.5,
      lines: 82.3,
      branches: 65.2,
      functions: 88.1,
      statements: 80.5,
      files: [
        {
          path: 'src/services/auth.service.ts',
          lines: 95.0,
          branches: 85.0,
          functions: 100.0,
          statements: 92.0,
          uncoveredLines: [45, 67],
        },
        {
          path: 'src/services/payment.service.ts',
          lines: 45.0,
          branches: 30.0,
          functions: 60.0,
          statements: 42.0,
          uncoveredLines: [12, 23, 34, 45, 56],
        },
      ],
    },
    history: [
      { timestamp: '2026-01-11T00:00:00Z', overall: 75.2 },
      { timestamp: '2026-01-04T00:00:00Z', overall: 73.8 },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockJwt.verify.mockImplementation((token: string) => {
      if (token === adminToken) {
        return { userId: 'admin-123', role: 'admin' };
      }
      if (token === userToken) {
        return { userId: 'user-456', role: 'user' };
      }
      throw new Error('Invalid token');
    });
    mockPrisma.user.findUnique.mockImplementation(({ where }: { where: { id: string } }) => {
      if (where.id === 'admin-123') {
        return Promise.resolve({ id: 'admin-123', role: 'admin', isActive: true });
      }
      if (where.id === 'user-456') {
        return Promise.resolve({ id: 'user-456', role: 'user', isActive: true });
      }
      return Promise.resolve(null);
    });
    mockPrisma.aiUsage.create.mockResolvedValue({ id: 'usage-123' });
  });

  // ==========================================================================
  // POST /api/test-evolution/health - Analyze test health
  // ==========================================================================
  describe('POST /api/test-evolution/health', () => {
    const mockTestHealthOutput = {
      summary: {
        totalTests: 3,
        healthScore: 72,
        healthStatus: 'warning' as const,
        flakyTests: 1,
        slowTests: 1,
        failingTests: 1,
        avgPassRate: 83.3,
        avgDuration: 900,
      },
      flakiness: {
        flakyTests: [
          {
            testId: 'test-003',
            name: 'should process payment successfully',
            flakinessScore: 35,
            failureRate: 50,
            passRate: 50,
            recentResults: ['failed', 'passed'],
            patterns: ['Intermittent timeout'],
            recommendation: 'Add retry logic',
          },
        ],
        overallFlakinessScore: 25,
        trend: 'increasing' as const,
      },
      reliability: {
        mostReliable: [
          {
            testId: 'test-001',
            name: 'should authenticate user with valid credentials',
            passRate: 100,
            avgDuration: 117,
            consistency: 'high' as const,
          },
        ],
        leastReliable: [
          {
            testId: 'test-003',
            name: 'should process payment successfully',
            passRate: 50,
            avgDuration: 2350,
            consistency: 'low' as const,
          },
        ],
      },
      executionTrends: {
        durationTrend: 'stable' as const,
        passRateTrend: 'declining' as const,
        avgDurationChange: 3.5,
        avgPassRateChange: -8.3,
      },
      recommendations: [
        'Investigate flaky payment test',
        'Add mocking for external services',
      ],
    };

    it('should analyze test health successfully', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(mockTestHealthOutput) }],
        usage: { input_tokens: 2500, output_tokens: 2000 },
      });

      const res = await request(app)
        .post('/api/test-evolution/health')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          testSuite: sampleTestSuiteInput,
          executionHistory: sampleExecutionHistory,
        });

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.summary).toBeDefined();
      expect(res.body.data.summary.totalTests).toBe(3);
      expect(res.body.data.summary.healthScore).toBe(72);
      expect(res.body.data.flakiness.flakyTests).toHaveLength(1);
      expect(res.body.usage).toBeDefined();
    });

    it('should analyze with custom thresholds', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(mockTestHealthOutput) }],
        usage: { input_tokens: 2500, output_tokens: 2000 },
      });

      const res = await request(app)
        .post('/api/test-evolution/health')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          testSuite: sampleTestSuiteInput,
          executionHistory: sampleExecutionHistory,
          options: {
            flakinessThreshold: 20,
            slowTestThreshold: 2000,
            minRunsForAnalysis: 5,
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.data.flakiness).toBeDefined();
    });

    it('should filter by test tags', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(mockTestHealthOutput) }],
        usage: { input_tokens: 2000, output_tokens: 1500 },
      });

      const res = await request(app)
        .post('/api/test-evolution/health')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          testSuite: sampleTestSuiteInput,
          executionHistory: sampleExecutionHistory,
          options: {
            filterByTags: ['unit', 'auth'],
          },
        });

      expect(res.status).toBe(200);
    });

    it('should identify flaky tests', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(mockTestHealthOutput) }],
        usage: { input_tokens: 2500, output_tokens: 2000 },
      });

      const res = await request(app)
        .post('/api/test-evolution/health')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          testSuite: sampleTestSuiteInput,
          executionHistory: sampleExecutionHistory,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.flakiness.flakyTests).toHaveLength(1);
      expect(res.body.data.flakiness.flakyTests[0].patterns).toContain('Intermittent timeout');
    });

    it('should return 400 when testSuite is missing', async () => {
      const res = await request(app)
        .post('/api/test-evolution/health')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          executionHistory: sampleExecutionHistory,
        });

      expect(res.status).toBe(400);
    });

    it('should return 400 when executionHistory is missing', async () => {
      const res = await request(app)
        .post('/api/test-evolution/health')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          testSuite: sampleTestSuiteInput,
        });

      expect(res.status).toBe(400);
    });

    it('should return 401 when no auth token provided', async () => {
      const res = await request(app)
        .post('/api/test-evolution/health')
        .send({
          testSuite: sampleTestSuiteInput,
          executionHistory: sampleExecutionHistory,
        });

      expect(res.status).toBe(401);
    });

    it('should return 401 when invalid token provided', async () => {
      const res = await request(app)
        .post('/api/test-evolution/health')
        .set('Authorization', 'Bearer invalid_token')
        .send({
          testSuite: sampleTestSuiteInput,
          executionHistory: sampleExecutionHistory,
        });

      expect(res.status).toBe(401);
    });
  });

  // ==========================================================================
  // POST /api/test-evolution/coverage - Track coverage evolution
  // ==========================================================================
  describe('POST /api/test-evolution/coverage', () => {
    const mockCoverageEvolutionOutput = {
      summary: {
        currentCoverage: 78.5,
        previousCoverage: 75.2,
        changePercent: 4.4,
        trend: 'improving' as const,
        targetCoverage: 80,
        gapToTarget: 1.5,
        projectedTimeToTarget: '2 weeks',
      },
      trends: {
        weekly: [
          { week: '2026-W03', coverage: 78.5, change: 3.3 },
          { week: '2026-W02', coverage: 75.2, change: 1.4 },
        ],
        monthly: [
          { month: '2026-01', avgCoverage: 76.8, change: 4.2 },
        ],
        velocity: 1.5,
      },
      regressions: [
        {
          file: 'src/services/payment.service.ts',
          previousCoverage: 55.0,
          currentCoverage: 45.0,
          change: -10.0,
          cause: 'New methods without tests',
          affectedLines: [12, 23, 34],
        },
      ],
      gaps: [
        {
          file: 'src/services/payment.service.ts',
          coverage: 45.0,
          gap: 35.0,
          priority: 'high' as const,
          uncoveredAreas: ['processPayment error handling'],
          suggestedTests: ['Add error scenario tests'],
        },
      ],
      improvements: [
        {
          file: 'src/services/auth.service.ts',
          previousCoverage: 85.0,
          currentCoverage: 95.0,
          change: 10.0,
          contributor: 'Added edge case tests',
        },
      ],
      recommendations: [
        'Focus on payment.service.ts',
        'Maintain auth.service.ts coverage',
      ],
    };

    it('should track coverage evolution successfully', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(mockCoverageEvolutionOutput) }],
        usage: { input_tokens: 2200, output_tokens: 1800 },
      });

      const res = await request(app)
        .post('/api/test-evolution/coverage')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          coverageData: sampleCoverageData,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.summary).toBeDefined();
      expect(res.body.data.summary.currentCoverage).toBe(78.5);
      expect(res.body.data.summary.trend).toBe('improving');
      expect(res.body.data.regressions).toHaveLength(1);
      expect(res.body.data.gaps).toHaveLength(1);
      expect(res.body.usage).toBeDefined();
    });

    it('should track with custom target', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(mockCoverageEvolutionOutput) }],
        usage: { input_tokens: 2200, output_tokens: 1800 },
      });

      const res = await request(app)
        .post('/api/test-evolution/coverage')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          coverageData: sampleCoverageData,
          options: {
            targetCoverage: 90,
            regressionThreshold: 5,
            gapThreshold: 20,
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.data.summary.targetCoverage).toBeDefined();
    });

    it('should detect coverage regressions', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(mockCoverageEvolutionOutput) }],
        usage: { input_tokens: 2200, output_tokens: 1800 },
      });

      const res = await request(app)
        .post('/api/test-evolution/coverage')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          coverageData: sampleCoverageData,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.regressions).toHaveLength(1);
      expect(res.body.data.regressions[0].change).toBe(-10.0);
    });

    it('should identify coverage gaps', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(mockCoverageEvolutionOutput) }],
        usage: { input_tokens: 2200, output_tokens: 1800 },
      });

      const res = await request(app)
        .post('/api/test-evolution/coverage')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          coverageData: sampleCoverageData,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.gaps).toHaveLength(1);
      expect(res.body.data.gaps[0].priority).toBe('high');
      expect(res.body.data.gaps[0].suggestedTests.length).toBeGreaterThan(0);
    });

    it('should filter by file patterns', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(mockCoverageEvolutionOutput) }],
        usage: { input_tokens: 2000, output_tokens: 1500 },
      });

      const res = await request(app)
        .post('/api/test-evolution/coverage')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          coverageData: sampleCoverageData,
          options: {
            includePatterns: ['**/services/**'],
            excludePatterns: ['**/*.test.ts'],
          },
        });

      expect(res.status).toBe(200);
    });

    it('should return 400 when coverageData is missing', async () => {
      const res = await request(app)
        .post('/api/test-evolution/coverage')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          options: { targetCoverage: 80 },
        });

      expect(res.status).toBe(400);
    });

    it('should return 401 when no auth token provided', async () => {
      const res = await request(app)
        .post('/api/test-evolution/coverage')
        .send({
          coverageData: sampleCoverageData,
        });

      expect(res.status).toBe(401);
    });
  });

  // ==========================================================================
  // POST /api/test-evolution/stale - Detect stale tests
  // ==========================================================================
  describe('POST /api/test-evolution/stale', () => {
    const mockStaleTestsOutput = {
      summary: {
        totalTests: 3,
        staleTests: 1,
        deadCodeTests: 0,
        outdatedTests: 1,
        stalenessScore: 25,
      },
      staleTests: [
        {
          testId: 'test-003',
          name: 'should process payment successfully',
          file: 'tests/payment.test.ts',
          lastModified: '2024-06-01T10:00:00Z',
          daysSinceModification: 232,
          staleness: 'high' as const,
          reasons: [
            'Not modified in over 6 months',
            'Target code has changed',
          ],
          targetCodeChanges: 15,
          recommendation: 'Review and update',
        },
      ],
      deadCodeTests: [],
      outdatedTests: [
        {
          testId: 'test-003',
          name: 'should process payment successfully',
          file: 'tests/payment.test.ts',
          outdatedAspects: [
            {
              aspect: 'API contract',
              currentTest: 'Uses old response format',
              currentCode: 'Returns new format',
            },
          ],
          recommendation: 'Update test assertions',
        },
      ],
      recommendations: [
        'Update payment.test.ts',
        'Establish test maintenance schedule',
      ],
      maintenanceEffort: {
        totalHours: 4,
        byPriority: {
          high: 3,
          medium: 1,
          low: 0,
        },
      },
    };

    it('should detect stale tests successfully', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(mockStaleTestsOutput) }],
        usage: { input_tokens: 2000, output_tokens: 1600 },
      });

      const res = await request(app)
        .post('/api/test-evolution/stale')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          testSuite: sampleTestSuiteInput,
          codeChanges: [
            {
              file: 'src/services/payment.service.ts',
              lastModified: '2026-01-15T10:00:00Z',
              changeCount: 15,
            },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.data.summary).toBeDefined();
      expect(res.body.data.summary.staleTests).toBe(1);
      expect(res.body.data.staleTests).toHaveLength(1);
      expect(res.body.data.maintenanceEffort).toBeDefined();
      expect(res.body.usage).toBeDefined();
    });

    it('should detect with custom staleness threshold', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(mockStaleTestsOutput) }],
        usage: { input_tokens: 2000, output_tokens: 1600 },
      });

      const res = await request(app)
        .post('/api/test-evolution/stale')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          testSuite: sampleTestSuiteInput,
          codeChanges: [],
          options: {
            stalenessDays: 60,
            includeDeadCodeAnalysis: true,
            includeApiContractAnalysis: true,
          },
        });

      expect(res.status).toBe(200);
    });

    it('should identify outdated tests', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(mockStaleTestsOutput) }],
        usage: { input_tokens: 2000, output_tokens: 1600 },
      });

      const res = await request(app)
        .post('/api/test-evolution/stale')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          testSuite: sampleTestSuiteInput,
          codeChanges: [],
        });

      expect(res.status).toBe(200);
      expect(res.body.data.outdatedTests).toHaveLength(1);
      expect(res.body.data.outdatedTests[0].outdatedAspects.length).toBeGreaterThan(0);
    });

    it('should calculate maintenance effort', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(mockStaleTestsOutput) }],
        usage: { input_tokens: 2000, output_tokens: 1600 },
      });

      const res = await request(app)
        .post('/api/test-evolution/stale')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          testSuite: sampleTestSuiteInput,
          codeChanges: [],
        });

      expect(res.status).toBe(200);
      expect(res.body.data.maintenanceEffort.totalHours).toBe(4);
    });

    it('should return 400 when testSuite is missing', async () => {
      const res = await request(app)
        .post('/api/test-evolution/stale')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          codeChanges: [],
        });

      expect(res.status).toBe(400);
    });

    it('should return 401 when no auth token provided', async () => {
      const res = await request(app)
        .post('/api/test-evolution/stale')
        .send({
          testSuite: sampleTestSuiteInput,
          codeChanges: [],
        });

      expect(res.status).toBe(401);
    });
  });

  // ==========================================================================
  // POST /api/test-evolution/risk - Score test risk
  // ==========================================================================
  describe('POST /api/test-evolution/risk', () => {
    const mockTestRiskOutput = {
      summary: {
        overallRiskScore: 58,
        riskLevel: 'medium' as const,
        criticalRiskTests: 0,
        highRiskTests: 1,
        mediumRiskTests: 1,
        lowRiskTests: 1,
      },
      testRisks: [
        {
          testId: 'test-003',
          name: 'should process payment successfully',
          riskScore: 72,
          riskLevel: 'high' as const,
          riskFactors: [
            { factor: 'Flakiness', weight: 35, score: 80 },
            { factor: 'Integration test', weight: 25, score: 70 },
            { factor: 'Stale', weight: 20, score: 85 },
            { factor: 'External dependency', weight: 20, score: 60 },
          ],
          impact: {
            blocksRelease: true,
            affectedFeatures: ['Payment Processing'],
            downstreamTests: 0,
          },
          recommendations: [
            'Mock external service',
            'Update test assertions',
          ],
          maintenancePriority: 1,
        },
        {
          testId: 'test-002',
          name: 'should reject invalid password',
          riskScore: 35,
          riskLevel: 'medium' as const,
          riskFactors: [
            { factor: 'Occasional flakiness', weight: 50, score: 30 },
            { factor: 'Unit test', weight: 50, score: 10 },
          ],
          impact: {
            blocksRelease: false,
            affectedFeatures: ['Authentication'],
            downstreamTests: 1,
          },
          recommendations: ['Add retry for flaky assertion'],
          maintenancePriority: 2,
        },
      ],
      riskDistribution: {
        byCategory: {
          flakiness: 40,
          staleness: 25,
          complexity: 15,
          dependencies: 20,
        },
        byTestType: {
          unit: 20,
          integration: 60,
          e2e: 20,
        },
      },
      maintenancePlan: {
        immediate: [],
        shortTerm: ['test-003'],
        longTerm: ['test-002'],
        estimatedEffort: {
          immediate: 0,
          shortTerm: 4,
          longTerm: 2,
        },
      },
      recommendations: [
        'Address payment test flakiness',
        'Review test pyramid balance',
      ],
    };

    it('should score test risk successfully', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(mockTestRiskOutput) }],
        usage: { input_tokens: 3000, output_tokens: 2500 },
      });

      const res = await request(app)
        .post('/api/test-evolution/risk')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          testSuite: sampleTestSuiteInput,
          executionHistory: sampleExecutionHistory,
          coverageData: sampleCoverageData,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.summary).toBeDefined();
      expect(res.body.data.summary.overallRiskScore).toBe(58);
      expect(res.body.data.summary.riskLevel).toBe('medium');
      expect(res.body.data.testRisks).toHaveLength(2);
      expect(res.body.usage).toBeDefined();
    });

    it('should score with custom risk weights', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(mockTestRiskOutput) }],
        usage: { input_tokens: 3000, output_tokens: 2500 },
      });

      const res = await request(app)
        .post('/api/test-evolution/risk')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          testSuite: sampleTestSuiteInput,
          executionHistory: sampleExecutionHistory,
          coverageData: sampleCoverageData,
          options: {
            riskWeights: {
              flakiness: 40,
              staleness: 20,
              complexity: 20,
              dependencies: 20,
            },
            criticalThreshold: 80,
            highThreshold: 60,
          },
        });

      expect(res.status).toBe(200);
    });

    it('should identify high risk tests', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(mockTestRiskOutput) }],
        usage: { input_tokens: 3000, output_tokens: 2500 },
      });

      const res = await request(app)
        .post('/api/test-evolution/risk')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          testSuite: sampleTestSuiteInput,
          executionHistory: sampleExecutionHistory,
          coverageData: sampleCoverageData,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.summary.highRiskTests).toBe(1);
      const highRisk = res.body.data.testRisks.filter((t: any) => t.riskLevel === 'high');
      expect(highRisk).toHaveLength(1);
    });

    it('should provide maintenance plan', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(mockTestRiskOutput) }],
        usage: { input_tokens: 3000, output_tokens: 2500 },
      });

      const res = await request(app)
        .post('/api/test-evolution/risk')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          testSuite: sampleTestSuiteInput,
          executionHistory: sampleExecutionHistory,
          coverageData: sampleCoverageData,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.maintenancePlan).toBeDefined();
      expect(res.body.data.maintenancePlan.shortTerm).toContain('test-003');
    });

    it('should show risk distribution', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(mockTestRiskOutput) }],
        usage: { input_tokens: 3000, output_tokens: 2500 },
      });

      const res = await request(app)
        .post('/api/test-evolution/risk')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          testSuite: sampleTestSuiteInput,
          executionHistory: sampleExecutionHistory,
          coverageData: sampleCoverageData,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.riskDistribution.byCategory.flakiness).toBe(40);
      expect(res.body.data.riskDistribution.byTestType.integration).toBe(60);
    });

    it('should return 400 when testSuite is missing', async () => {
      const res = await request(app)
        .post('/api/test-evolution/risk')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          executionHistory: sampleExecutionHistory,
          coverageData: sampleCoverageData,
        });

      expect(res.status).toBe(400);
    });

    it('should return 400 when executionHistory is missing', async () => {
      const res = await request(app)
        .post('/api/test-evolution/risk')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          testSuite: sampleTestSuiteInput,
          coverageData: sampleCoverageData,
        });

      expect(res.status).toBe(400);
    });

    it('should return 401 when no auth token provided', async () => {
      const res = await request(app)
        .post('/api/test-evolution/risk')
        .send({
          testSuite: sampleTestSuiteInput,
          executionHistory: sampleExecutionHistory,
          coverageData: sampleCoverageData,
        });

      expect(res.status).toBe(401);
    });

    it('should return 401 when invalid token provided', async () => {
      const res = await request(app)
        .post('/api/test-evolution/risk')
        .set('Authorization', 'Bearer bad_token')
        .send({
          testSuite: sampleTestSuiteInput,
          executionHistory: sampleExecutionHistory,
          coverageData: sampleCoverageData,
        });

      expect(res.status).toBe(401);
    });
  });

  // ==========================================================================
  // Error Handling
  // ==========================================================================
  describe('Error Handling', () => {
    it('should handle AI API errors gracefully for /health', async () => {
      mockAnthropicCreate.mockRejectedValue(new Error('API rate limit exceeded'));

      const res = await request(app)
        .post('/api/test-evolution/health')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          testSuite: sampleTestSuiteInput,
          executionHistory: sampleExecutionHistory,
        });

      expect(res.status).toBe(500);
    }, 20000);

    it('should handle AI API errors gracefully for /coverage', async () => {
      mockAnthropicCreate.mockRejectedValue(new Error('Service unavailable'));

      const res = await request(app)
        .post('/api/test-evolution/coverage')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          coverageData: sampleCoverageData,
        });

      expect(res.status).toBe(500);
    }, 20000);

    it('should handle AI API errors gracefully for /stale', async () => {
      mockAnthropicCreate.mockRejectedValue(new Error('Connection timeout'));

      const res = await request(app)
        .post('/api/test-evolution/stale')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          testSuite: sampleTestSuiteInput,
          codeChanges: [],
        });

      expect(res.status).toBe(500);
    }, 20000);

    it('should handle AI API errors gracefully for /risk', async () => {
      mockAnthropicCreate.mockRejectedValue(new Error('Invalid API key'));

      const res = await request(app)
        .post('/api/test-evolution/risk')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          testSuite: sampleTestSuiteInput,
          executionHistory: sampleExecutionHistory,
          coverageData: sampleCoverageData,
        });

      expect(res.status).toBe(500);
    }, 20000);

    it('should handle malformed JSON response from AI for /health', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'This is not valid JSON { broken' }],
        usage: { input_tokens: 100, output_tokens: 50 },
      });

      const res = await request(app)
        .post('/api/test-evolution/health')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          testSuite: sampleTestSuiteInput,
          executionHistory: sampleExecutionHistory,
        });

      expect(res.status).toBe(500);
    }, 20000);

    it('should handle malformed JSON response from AI for /coverage', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: '{"incomplete": true' }],
        usage: { input_tokens: 100, output_tokens: 50 },
      });

      const res = await request(app)
        .post('/api/test-evolution/coverage')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          coverageData: sampleCoverageData,
        });

      expect(res.status).toBe(500);
    }, 20000);

    it('should handle malformed JSON response from AI for /stale', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'invalid json here' }],
        usage: { input_tokens: 100, output_tokens: 50 },
      });

      const res = await request(app)
        .post('/api/test-evolution/stale')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          testSuite: sampleTestSuiteInput,
          codeChanges: [],
        });

      expect(res.status).toBe(500);
    }, 20000);

    it('should handle malformed JSON response from AI for /risk', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: '{"summary": ' }],
        usage: { input_tokens: 100, output_tokens: 50 },
      });

      const res = await request(app)
        .post('/api/test-evolution/risk')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          testSuite: sampleTestSuiteInput,
          executionHistory: sampleExecutionHistory,
          coverageData: sampleCoverageData,
        });

      expect(res.status).toBe(500);
    }, 20000);
  });

  // ==========================================================================
  // Validation Tests
  // ==========================================================================
  describe('Input Validation', () => {
    it('should validate test has required fields', async () => {
      const res = await request(app)
        .post('/api/test-evolution/health')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          testSuite: {
            tests: [
              {
                name: 'test without id',
                file: 'tests/test.ts',
              },
            ],
          },
          executionHistory: sampleExecutionHistory,
        });

      expect(res.status).toBe(400);
    });

    it('should validate execution history has runs', async () => {
      const res = await request(app)
        .post('/api/test-evolution/health')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          testSuite: sampleTestSuiteInput,
          executionHistory: {
            totalRuns: 0,
          },
        });

      expect(res.status).toBe(400);
    });

    it('should validate coverage data has current', async () => {
      const res = await request(app)
        .post('/api/test-evolution/coverage')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          coverageData: {
            history: [],
          },
        });

      expect(res.status).toBe(400);
    });

    it('should accept valid input structure for health', async () => {
      const mockOutput = {
        summary: {
          totalTests: 1,
          healthScore: 100,
          healthStatus: 'healthy',
          flakyTests: 0,
          slowTests: 0,
          failingTests: 0,
          avgPassRate: 100,
          avgDuration: 100,
        },
        flakiness: { flakyTests: [], overallFlakinessScore: 0, trend: 'stable' },
        reliability: { mostReliable: [], leastReliable: [] },
        executionTrends: { durationTrend: 'stable', passRateTrend: 'stable', avgDurationChange: 0, avgPassRateChange: 0 },
        recommendations: [],
      };

      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(mockOutput) }],
        usage: { input_tokens: 500, output_tokens: 300 },
      });

      const res = await request(app)
        .post('/api/test-evolution/health')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          testSuite: {
            tests: [
              {
                id: 'test-1',
                name: 'valid test',
                file: 'tests/test.ts',
                line: 1,
                suite: 'TestSuite',
                lastModified: '2026-01-01T00:00:00Z',
                createdAt: '2026-01-01T00:00:00Z',
              },
            ],
          },
          executionHistory: {
            runs: [
              {
                id: 'run-1',
                timestamp: '2026-01-01T00:00:00Z',
                duration: 1000,
                results: [
                  { testId: 'test-1', status: 'passed', duration: 100 },
                ],
              },
            ],
            totalRuns: 1,
            timeRange: {
              from: '2026-01-01T00:00:00Z',
              to: '2026-01-02T00:00:00Z',
            },
          },
        });

      expect(res.status).toBe(200);
    });
  });
});

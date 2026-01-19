/**
 * Bug Pattern Agent Routes Integration Tests
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

describe('Bug Pattern Agent Routes Integration', () => {
  const adminToken = 'admin_test_token';
  const userToken = 'user_test_token';

  // Sample bug data for testing
  const sampleBugs = [
    {
      id: 'BUG-001',
      title: 'Login fails with invalid credentials',
      description: 'Users cannot log in when entering incorrect passwords. Error message not displayed properly.',
      status: 'open' as const,
      severity: 'high' as const,
      component: 'AuthService',
      stackTrace: 'Error: Authentication failed\n  at AuthService.login (auth.service.ts:45)\n  at LoginController.handle (login.controller.ts:23)',
      steps: ['Navigate to login page', 'Enter invalid credentials', 'Click login button'],
      environment: { browser: 'Chrome', version: '120.0', os: 'Windows 11' },
      createdAt: '2026-01-15T10:00:00.000Z',
      labels: ['auth', 'critical-path'],
      assignee: 'dev@example.com',
      reporter: 'qa@example.com',
    },
    {
      id: 'BUG-002',
      title: 'Session timeout not handled correctly',
      description: 'When session expires, user is not redirected to login page. Application hangs.',
      status: 'in_progress' as const,
      severity: 'critical' as const,
      component: 'AuthService',
      stackTrace: 'Error: Session expired\n  at SessionManager.validate (session.manager.ts:78)',
      steps: ['Login', 'Wait for session timeout', 'Try any action'],
      environment: { browser: 'Firefox', version: '121.0', os: 'macOS' },
      createdAt: '2026-01-16T14:30:00.000Z',
      labels: ['auth', 'session'],
      reporter: 'user@example.com',
    },
    {
      id: 'BUG-003',
      title: 'Payment processing fails intermittently',
      description: 'Payment transactions fail randomly with timeout errors. Retry does not help.',
      status: 'open' as const,
      severity: 'critical' as const,
      component: 'PaymentModule',
      stackTrace: 'TimeoutError: Payment gateway timeout\n  at PaymentService.process (payment.service.ts:112)',
      createdAt: '2026-01-17T09:15:00.000Z',
      labels: ['payment', 'critical'],
      assignee: 'senior-dev@example.com',
    },
  ];

  // Sample test failure for root cause analysis
  const sampleTestFailure = {
    testId: 'test-123',
    name: 'should login successfully with valid credentials',
    error: 'Expected element to be visible but was not found',
    stackTrace: `Error: Expected element to be visible
  at Object.<anonymous> (login.spec.ts:45:12)
  at processTicksAndRejections (internal/process/task_queues.js:95:5)`,
    duration: 5000,
    retries: 3,
    file: 'tests/e2e/login.spec.ts',
    line: 45,
  };

  // Sample code changes for prediction
  const sampleCodeChanges = [
    {
      file: 'src/services/auth.service.ts',
      additions: 45,
      deletions: 12,
      author: 'developer@example.com',
      date: '2026-01-18T10:00:00.000Z',
      commitMessage: 'Refactor authentication logic for better security',
      commitHash: 'abc123def',
      filesChanged: ['src/services/auth.service.ts', 'src/utils/jwt.util.ts'],
    },
    {
      file: 'src/services/payment.service.ts',
      additions: 120,
      deletions: 30,
      author: 'developer@example.com',
      date: '2026-01-18T14:00:00.000Z',
      commitMessage: 'Add new payment gateway integration',
      commitHash: 'def456ghi',
      filesChanged: ['src/services/payment.service.ts', 'src/config/payment.config.ts'],
    },
  ];

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
  // POST /api/bug-patterns/analyze - Analyze bug patterns
  // ==========================================================================
  describe('POST /api/bug-patterns/analyze', () => {
    const mockPatternAnalysisOutput = {
      patterns: [
        {
          id: 'PAT-001',
          name: 'Authentication Failures',
          description: 'Recurring issues with user authentication and session management',
          frequency: 2,
          affectedComponents: ['AuthService'],
          examples: ['BUG-001', 'BUG-002'],
          severity: 'critical' as const,
          trend: 'increasing' as const,
        },
        {
          id: 'PAT-002',
          name: 'Timeout Errors',
          description: 'Services timing out under load or specific conditions',
          frequency: 2,
          affectedComponents: ['AuthService', 'PaymentModule'],
          examples: ['BUG-002', 'BUG-003'],
          severity: 'high' as const,
          trend: 'stable' as const,
        },
      ],
      categories: [
        { name: 'Authentication', count: 2, percentage: 67, bugs: ['BUG-001', 'BUG-002'] },
        { name: 'Payment', count: 1, percentage: 33, bugs: ['BUG-003'] },
      ],
      correlations: [
        {
          factor1: 'component:AuthService',
          factor2: 'severity:critical',
          strength: 80,
          explanation: 'Auth bugs tend to be critical due to security implications',
        },
      ],
      severityDistribution: { critical: 2, high: 1, medium: 0, low: 0 },
      trends: {
        totalBugs: 3,
        openBugs: 2,
        avgResolutionTime: '2.5 days',
        hotspotComponents: ['AuthService', 'PaymentModule'],
        recentSpike: true,
        spikeReason: 'Recent auth refactoring introduced regressions',
      },
      insights: [
        '67% of bugs are related to authentication',
        'AuthService has the highest bug concentration',
        '2 critical bugs require immediate attention',
      ],
      recommendations: [
        'Increase test coverage for AuthService',
        'Add integration tests for session management',
        'Review payment gateway timeout handling',
      ],
    };

    it('should analyze bug patterns successfully', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(mockPatternAnalysisOutput) }],
        usage: { input_tokens: 2000, output_tokens: 1500 },
      });

      const res = await request(app)
        .post('/api/bug-patterns/analyze')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          bugs: sampleBugs,
        });

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.patterns).toHaveLength(2);
      expect(res.body.data.patterns[0].name).toBe('Authentication Failures');
      expect(res.body.data.categories).toHaveLength(2);
      expect(res.body.data.severityDistribution.critical).toBe(2);
      expect(res.body.data.trends.totalBugs).toBe(3);
      expect(res.body.data.insights).toHaveLength(3);
      expect(res.body.data.recommendations).toHaveLength(3);
      expect(res.body.usage).toBeDefined();
    });

    it('should analyze patterns with time range option', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(mockPatternAnalysisOutput) }],
        usage: { input_tokens: 2000, output_tokens: 1500 },
      });

      const res = await request(app)
        .post('/api/bug-patterns/analyze')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          bugs: sampleBugs,
          options: {
            timeRange: {
              from: '2026-01-01T00:00:00.000Z',
              to: '2026-01-31T23:59:59.999Z',
            },
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.data.patterns).toBeDefined();
    });

    it('should filter by components', async () => {
      const filteredOutput = {
        ...mockPatternAnalysisOutput,
        patterns: mockPatternAnalysisOutput.patterns.slice(0, 1),
        categories: [{ name: 'Authentication', count: 2, percentage: 100, bugs: ['BUG-001', 'BUG-002'] }],
      };

      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(filteredOutput) }],
        usage: { input_tokens: 1500, output_tokens: 1000 },
      });

      const res = await request(app)
        .post('/api/bug-patterns/analyze')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          bugs: sampleBugs,
          options: {
            components: ['AuthService'],
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.data.patterns).toHaveLength(1);
    });

    it('should filter by severities', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(mockPatternAnalysisOutput) }],
        usage: { input_tokens: 1500, output_tokens: 1000 },
      });

      const res = await request(app)
        .post('/api/bug-patterns/analyze')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          bugs: sampleBugs,
          options: {
            severities: ['critical', 'high'],
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });

    it('should return 400 when bugs array is missing', async () => {
      const res = await request(app)
        .post('/api/bug-patterns/analyze')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          options: { minPatternFrequency: 2 },
        });

      expect(res.status).toBe(400);
    });

    it('should return 400 when bugs array is empty', async () => {
      const res = await request(app)
        .post('/api/bug-patterns/analyze')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          bugs: [],
        });

      expect(res.status).toBe(400);
    });

    it('should return 401 when no auth token provided', async () => {
      const res = await request(app)
        .post('/api/bug-patterns/analyze')
        .send({
          bugs: sampleBugs,
        });

      expect(res.status).toBe(401);
    });

    it('should return 401 when invalid token provided', async () => {
      const res = await request(app)
        .post('/api/bug-patterns/analyze')
        .set('Authorization', 'Bearer invalid_token')
        .send({
          bugs: sampleBugs,
        });

      expect(res.status).toBe(401);
    });
  });

  // ==========================================================================
  // POST /api/bug-patterns/root-cause - Find root cause
  // ==========================================================================
  describe('POST /api/bug-patterns/root-cause', () => {
    const mockRootCauseOutput = {
      rootCause: {
        type: 'code_defect' as const,
        description: 'Missing null check in authentication flow causes element lookup failure',
        confidence: 85,
        evidence: [
          'Stack trace shows element lookup failure in login.spec.ts:45',
          'Recent code change modified element selectors',
          'Error occurs only after specific code changes',
        ],
      },
      contributing_factors: [
        {
          factor: 'Missing wait for element',
          impact: 'high' as const,
          explanation: 'Element may not be rendered when test tries to find it',
        },
        {
          factor: 'Timing issue',
          impact: 'medium' as const,
          explanation: 'Test runs faster than UI rendering',
        },
      ],
      suggestedFix: {
        description: 'Add explicit wait for element visibility before interaction',
        steps: [
          'Add await page.waitForSelector before finding element',
          'Increase timeout for element lookup',
          'Add retry logic for flaky element interactions',
        ],
        complexity: 'simple' as const,
        estimatedEffort: '1 hour',
      },
      relatedBugs: ['BUG-001', 'BUG-002'],
      preventionStrategies: [
        'Add explicit waits in all E2E tests',
        'Implement retry patterns for element interactions',
        'Use more stable selectors like data-testid',
      ],
    };

    it('should find root cause successfully', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(mockRootCauseOutput) }],
        usage: { input_tokens: 1200, output_tokens: 900 },
      });

      const res = await request(app)
        .post('/api/bug-patterns/root-cause')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          failure: sampleTestFailure,
        });

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.rootCause).toBeDefined();
      expect(res.body.data.rootCause.type).toBe('code_defect');
      expect(res.body.data.rootCause.confidence).toBe(85);
      expect(res.body.data.contributing_factors).toHaveLength(2);
      expect(res.body.data.suggestedFix.complexity).toBe('simple');
      expect(res.body.data.preventionStrategies).toHaveLength(3);
      expect(res.body.usage).toBeDefined();
    });

    it('should find root cause with code changes context', async () => {
      const outputWithChanges = {
        ...mockRootCauseOutput,
        rootCause: {
          ...mockRootCauseOutput.rootCause,
          evidence: [
            ...mockRootCauseOutput.rootCause.evidence,
            'Recent commit abc123def modified auth.service.ts with 45 additions',
          ],
        },
      };

      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(outputWithChanges) }],
        usage: { input_tokens: 1500, output_tokens: 1000 },
      });

      const res = await request(app)
        .post('/api/bug-patterns/root-cause')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          failure: sampleTestFailure,
          codeChanges: sampleCodeChanges,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.rootCause.evidence).toContain('Recent commit abc123def modified auth.service.ts with 45 additions');
    });

    it('should identify environment-related root causes', async () => {
      const environmentOutput = {
        ...mockRootCauseOutput,
        rootCause: {
          type: 'environment' as const,
          description: 'Test environment has insufficient resources causing timeouts',
          confidence: 72,
          evidence: ['High retry count indicates flakiness', 'Duration exceeds normal test time'],
        },
      };

      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(environmentOutput) }],
        usage: { input_tokens: 1200, output_tokens: 800 },
      });

      const res = await request(app)
        .post('/api/bug-patterns/root-cause')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          failure: {
            ...sampleTestFailure,
            duration: 30000,
            retries: 5,
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.data.rootCause.type).toBe('environment');
    });

    it('should return 400 when failure is missing', async () => {
      const res = await request(app)
        .post('/api/bug-patterns/root-cause')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          codeChanges: sampleCodeChanges,
        });

      expect(res.status).toBe(400);
    });

    it('should return 400 when failure.testId is missing', async () => {
      const { testId, ...failureWithoutId } = sampleTestFailure;
      const res = await request(app)
        .post('/api/bug-patterns/root-cause')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          failure: failureWithoutId,
        });

      expect(res.status).toBe(400);
    });

    it('should return 400 when failure.error is missing', async () => {
      const { error, ...failureWithoutError } = sampleTestFailure;
      const res = await request(app)
        .post('/api/bug-patterns/root-cause')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          failure: failureWithoutError,
        });

      expect(res.status).toBe(400);
    });

    it('should return 401 when no auth token provided', async () => {
      const res = await request(app)
        .post('/api/bug-patterns/root-cause')
        .send({
          failure: sampleTestFailure,
        });

      expect(res.status).toBe(401);
    });

    it('should return 401 when invalid token provided', async () => {
      const res = await request(app)
        .post('/api/bug-patterns/root-cause')
        .set('Authorization', 'Bearer bad_token')
        .send({
          failure: sampleTestFailure,
        });

      expect(res.status).toBe(401);
    });
  });

  // ==========================================================================
  // POST /api/bug-patterns/predict - Predict bug-prone areas
  // ==========================================================================
  describe('POST /api/bug-patterns/predict', () => {
    const mockPredictionOutput = {
      predictions: [
        {
          file: 'src/services/auth.service.ts',
          riskScore: 85,
          riskLevel: 'high' as const,
          reasons: [
            'High churn rate (45 additions, 12 deletions)',
            'Previous critical bugs in this area',
            'Complex authentication logic',
          ],
          historicalBugCount: 5,
          recentChangeVelocity: 15,
          recommendations: [
            'Add integration tests for new auth flow',
            'Require code review from security team',
          ],
        },
        {
          file: 'src/services/payment.service.ts',
          riskScore: 72,
          riskLevel: 'medium' as const,
          reasons: [
            'Large code addition (120 lines)',
            'New payment gateway integration',
            'External service dependency',
          ],
          historicalBugCount: 2,
          recentChangeVelocity: 8,
          recommendations: [
            'Add timeout handling tests',
            'Test with mock payment gateway',
          ],
        },
      ],
      overallRisk: {
        score: 78,
        level: 'high' as const,
        summary: 'High risk due to significant changes in critical components (auth, payment)',
      },
      hotspots: [
        {
          area: 'Authentication',
          risk: 85,
          topContributors: ['auth.service.ts', 'jwt.util.ts'],
        },
        {
          area: 'Payment',
          risk: 72,
          topContributors: ['payment.service.ts', 'payment.config.ts'],
        },
      ],
      suggestedTestFocus: [
        'Authentication flows',
        'Payment processing with timeouts',
        'Session management edge cases',
      ],
      mitigationStrategies: [
        'Increase test coverage for auth module to 90%',
        'Add integration tests for payment gateway',
        'Implement feature flags for gradual rollout',
      ],
    };

    it('should predict bug-prone areas successfully', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(mockPredictionOutput) }],
        usage: { input_tokens: 1500, output_tokens: 1200 },
      });

      const res = await request(app)
        .post('/api/bug-patterns/predict')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          codeChanges: sampleCodeChanges,
        });

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.predictions).toHaveLength(2);
      expect(res.body.data.predictions[0].file).toBe('src/services/auth.service.ts');
      expect(res.body.data.predictions[0].riskScore).toBe(85);
      expect(res.body.data.overallRisk.level).toBe('high');
      expect(res.body.data.hotspots).toHaveLength(2);
      expect(res.body.data.suggestedTestFocus).toHaveLength(3);
      expect(res.body.usage).toBeDefined();
    });

    it('should predict with historical bugs context', async () => {
      const outputWithHistory = {
        ...mockPredictionOutput,
        predictions: mockPredictionOutput.predictions.map(p => ({
          ...p,
          historicalBugCount: p.historicalBugCount + 3,
        })),
      };

      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(outputWithHistory) }],
        usage: { input_tokens: 2000, output_tokens: 1400 },
      });

      const res = await request(app)
        .post('/api/bug-patterns/predict')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          codeChanges: sampleCodeChanges,
          historicalBugs: sampleBugs,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.predictions[0].historicalBugCount).toBe(8);
    });

    it('should return low risk for minor changes', async () => {
      const lowRiskOutput = {
        predictions: [
          {
            file: 'src/utils/helpers.ts',
            riskScore: 15,
            riskLevel: 'low' as const,
            reasons: ['Minor utility function update'],
            historicalBugCount: 0,
            recentChangeVelocity: 1,
            recommendations: ['Standard code review is sufficient'],
          },
        ],
        overallRisk: {
          score: 15,
          level: 'low' as const,
          summary: 'Low risk - minor changes to stable utility functions',
        },
        hotspots: [],
        suggestedTestFocus: ['Unit tests for modified utilities'],
        mitigationStrategies: [],
      };

      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(lowRiskOutput) }],
        usage: { input_tokens: 800, output_tokens: 600 },
      });

      const res = await request(app)
        .post('/api/bug-patterns/predict')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          codeChanges: [
            {
              file: 'src/utils/helpers.ts',
              additions: 5,
              deletions: 2,
              author: 'developer@example.com',
              date: '2026-01-19T10:00:00.000Z',
              commitMessage: 'Fix typo in helper function',
            },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.data.overallRisk.level).toBe('low');
      expect(res.body.data.predictions[0].riskScore).toBe(15);
    });

    it('should return 400 when codeChanges is missing', async () => {
      const res = await request(app)
        .post('/api/bug-patterns/predict')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          historicalBugs: sampleBugs,
        });

      expect(res.status).toBe(400);
    });

    it('should return 400 when codeChanges is empty', async () => {
      const res = await request(app)
        .post('/api/bug-patterns/predict')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          codeChanges: [],
        });

      expect(res.status).toBe(400);
    });

    it('should return 401 when no auth token provided', async () => {
      const res = await request(app)
        .post('/api/bug-patterns/predict')
        .send({
          codeChanges: sampleCodeChanges,
        });

      expect(res.status).toBe(401);
    });

    it('should return 401 when invalid token provided', async () => {
      const res = await request(app)
        .post('/api/bug-patterns/predict')
        .set('Authorization', 'Bearer expired_token')
        .send({
          codeChanges: sampleCodeChanges,
        });

      expect(res.status).toBe(401);
    });
  });

  // ==========================================================================
  // POST /api/bug-patterns/report - Generate bug report
  // ==========================================================================
  describe('POST /api/bug-patterns/report', () => {
    const mockReportOutput = {
      executiveSummary: {
        totalBugs: 3,
        openBugs: 2,
        criticalBugs: 2,
        avgAge: '2.5 days',
        healthScore: 45,
        healthStatus: 'critical' as const,
        keyFindings: [
          '2 critical bugs require immediate attention',
          'AuthService is a major hotspot',
          'Payment processing has intermittent issues',
        ],
      },
      charts: {
        severityBreakdown: [
          { label: 'Critical', value: 2 },
          { label: 'High', value: 1 },
          { label: 'Medium', value: 0 },
          { label: 'Low', value: 0 },
        ],
        statusBreakdown: [
          { label: 'Open', value: 2 },
          { label: 'In Progress', value: 1 },
          { label: 'Resolved', value: 0 },
        ],
        componentBreakdown: [
          { label: 'AuthService', value: 2 },
          { label: 'PaymentModule', value: 1 },
        ],
        trendOverTime: [
          { date: '2026-01-15', opened: 1, closed: 0 },
          { date: '2026-01-16', opened: 1, closed: 0 },
          { date: '2026-01-17', opened: 1, closed: 0 },
        ],
        topAuthors: [
          { author: 'qa@example.com', bugs: 1 },
          { author: 'user@example.com', bugs: 1 },
        ],
      },
      topIssues: [
        {
          id: 'BUG-002',
          title: 'Session timeout not handled correctly',
          severity: 'critical',
          age: '3 days',
          impact: 'Affects all users after session expires',
        },
        {
          id: 'BUG-003',
          title: 'Payment processing fails intermittently',
          severity: 'critical',
          age: '2 days',
          impact: 'Blocks transactions for affected users',
        },
      ],
      recommendations: [
        {
          priority: 'high' as const,
          action: 'Fix session timeout handling in AuthService',
          expectedImpact: 'Resolve user experience issues for session expiry',
          effort: '4 hours',
        },
        {
          priority: 'high' as const,
          action: 'Investigate and fix payment gateway timeouts',
          expectedImpact: 'Restore reliable payment processing',
          effort: '1 day',
        },
        {
          priority: 'medium' as const,
          action: 'Improve error messages for login failures',
          expectedImpact: 'Better user experience for auth errors',
          effort: '2 hours',
        },
      ],
      reportDate: '2026-01-19T10:00:00.000Z',
    };

    it('should generate bug report successfully', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(mockReportOutput) }],
        usage: { input_tokens: 2000, output_tokens: 1800 },
      });

      const res = await request(app)
        .post('/api/bug-patterns/report')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          bugs: sampleBugs,
        });

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.executiveSummary).toBeDefined();
      expect(res.body.data.executiveSummary.totalBugs).toBe(3);
      expect(res.body.data.executiveSummary.healthStatus).toBe('critical');
      expect(res.body.data.charts).toBeDefined();
      expect(res.body.data.charts.severityBreakdown).toHaveLength(4);
      expect(res.body.data.topIssues).toHaveLength(2);
      expect(res.body.data.recommendations).toHaveLength(3);
      expect(res.body.data.reportDate).toBeDefined();
      expect(res.body.usage).toBeDefined();
    });

    it('should generate detailed report format', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(mockReportOutput) }],
        usage: { input_tokens: 2500, output_tokens: 2200 },
      });

      const res = await request(app)
        .post('/api/bug-patterns/report')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          bugs: sampleBugs,
          options: {
            format: 'detailed',
            includeCharts: true,
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.data.charts).toBeDefined();
    });

    it('should generate executive summary format', async () => {
      const executiveOutput = {
        ...mockReportOutput,
        charts: {
          severityBreakdown: mockReportOutput.charts.severityBreakdown,
          statusBreakdown: mockReportOutput.charts.statusBreakdown,
          componentBreakdown: [],
          trendOverTime: [],
          topAuthors: [],
        },
      };

      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(executiveOutput) }],
        usage: { input_tokens: 1500, output_tokens: 1000 },
      });

      const res = await request(app)
        .post('/api/bug-patterns/report')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          bugs: sampleBugs,
          options: {
            format: 'executive',
            includeCharts: false,
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.data.executiveSummary).toBeDefined();
    });

    it('should filter report by time range', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(mockReportOutput) }],
        usage: { input_tokens: 2000, output_tokens: 1500 },
      });

      const res = await request(app)
        .post('/api/bug-patterns/report')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          bugs: sampleBugs,
          options: {
            timeRange: {
              from: '2026-01-15T00:00:00.000Z',
              to: '2026-01-17T23:59:59.999Z',
            },
          },
        });

      expect(res.status).toBe(200);
    });

    it('should focus on specific areas', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(mockReportOutput) }],
        usage: { input_tokens: 1800, output_tokens: 1400 },
      });

      const res = await request(app)
        .post('/api/bug-patterns/report')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          bugs: sampleBugs,
          options: {
            focusAreas: ['AuthService', 'security'],
          },
        });

      expect(res.status).toBe(200);
    });

    it('should return 400 when bugs array is missing', async () => {
      const res = await request(app)
        .post('/api/bug-patterns/report')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          options: { format: 'detailed' },
        });

      expect(res.status).toBe(400);
    });

    it('should return 400 when bugs array is empty', async () => {
      const res = await request(app)
        .post('/api/bug-patterns/report')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          bugs: [],
        });

      expect(res.status).toBe(400);
    });

    it('should return 401 when no auth token provided', async () => {
      const res = await request(app)
        .post('/api/bug-patterns/report')
        .send({
          bugs: sampleBugs,
        });

      expect(res.status).toBe(401);
    });

    it('should return 401 when invalid token provided', async () => {
      const res = await request(app)
        .post('/api/bug-patterns/report')
        .set('Authorization', 'Bearer wrong_token')
        .send({
          bugs: sampleBugs,
        });

      expect(res.status).toBe(401);
    });
  });

  // ==========================================================================
  // POST /api/bug-patterns/cluster - Cluster similar bugs
  // ==========================================================================
  describe('POST /api/bug-patterns/cluster', () => {
    const mockClusterOutput = {
      clusters: [
        {
          id: 'CLUSTER-001',
          name: 'Authentication Issues',
          theme: 'User authentication and session management failures',
          bugs: ['BUG-001', 'BUG-002'],
          size: 2,
          avgSeverity: 1.5,
          commonCharacteristics: [
            'Related to AuthService component',
            'Affects user login flow',
            'Session-related errors',
          ],
          suggestedPriority: 'critical' as const,
          triageRecommendation: 'Assign to auth team for consolidated fix - both bugs share root cause',
        },
        {
          id: 'CLUSTER-002',
          name: 'Payment Processing',
          theme: 'Transaction and payment gateway issues',
          bugs: ['BUG-003'],
          size: 1,
          avgSeverity: 1.0,
          commonCharacteristics: [
            'Payment gateway timeout',
            'Intermittent failures',
            'External service dependency',
          ],
          suggestedPriority: 'critical' as const,
          triageRecommendation: 'Investigate payment gateway configuration and timeout settings',
        },
      ],
      similarityMatrix: [
        {
          bug1: 'BUG-001',
          bug2: 'BUG-002',
          similarity: 82,
          sharedAttributes: ['component', 'labels', 'error_type'],
        },
        {
          bug1: 'BUG-001',
          bug2: 'BUG-003',
          similarity: 25,
          sharedAttributes: ['severity'],
        },
        {
          bug1: 'BUG-002',
          bug2: 'BUG-003',
          similarity: 30,
          sharedAttributes: ['status', 'timeout_pattern'],
        },
      ],
      outliers: [],
      triageOrder: ['BUG-002', 'BUG-003', 'BUG-001'],
      insights: [
        'Authentication cluster contains 67% of bugs',
        'High similarity between auth-related bugs suggests common root cause',
        'Payment bug is isolated and requires separate investigation',
      ],
    };

    it('should cluster bugs successfully', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(mockClusterOutput) }],
        usage: { input_tokens: 1800, output_tokens: 1500 },
      });

      const res = await request(app)
        .post('/api/bug-patterns/cluster')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          bugs: sampleBugs,
        });

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.clusters).toHaveLength(2);
      expect(res.body.data.clusters[0].name).toBe('Authentication Issues');
      expect(res.body.data.clusters[0].bugs).toHaveLength(2);
      expect(res.body.data.similarityMatrix).toHaveLength(3);
      expect(res.body.data.triageOrder).toHaveLength(3);
      expect(res.body.data.insights).toHaveLength(3);
      expect(res.body.usage).toBeDefined();
    });

    it('should cluster with custom options', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(mockClusterOutput) }],
        usage: { input_tokens: 1800, output_tokens: 1500 },
      });

      const res = await request(app)
        .post('/api/bug-patterns/cluster')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          bugs: sampleBugs,
          options: {
            minClusterSize: 2,
            maxClusters: 5,
            similarityThreshold: 70,
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.data.clusters).toBeDefined();
    });

    it('should identify outliers', async () => {
      const outputWithOutliers = {
        ...mockClusterOutput,
        outliers: [
          {
            bugId: 'BUG-003',
            reason: 'Unique infrastructure-related issue with no similar bugs',
            specialAttention: true,
          },
        ],
      };

      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(outputWithOutliers) }],
        usage: { input_tokens: 1800, output_tokens: 1600 },
      });

      const res = await request(app)
        .post('/api/bug-patterns/cluster')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          bugs: sampleBugs,
          options: {
            similarityThreshold: 80,
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.data.outliers).toHaveLength(1);
      expect(res.body.data.outliers[0].specialAttention).toBe(true);
    });

    it('should provide similarity scores between bugs', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(mockClusterOutput) }],
        usage: { input_tokens: 1800, output_tokens: 1500 },
      });

      const res = await request(app)
        .post('/api/bug-patterns/cluster')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          bugs: sampleBugs,
        });

      expect(res.status).toBe(200);
      const authSimilarity = res.body.data.similarityMatrix.find(
        (m: any) => m.bug1 === 'BUG-001' && m.bug2 === 'BUG-002'
      );
      expect(authSimilarity).toBeDefined();
      expect(authSimilarity.similarity).toBe(82);
      expect(authSimilarity.sharedAttributes).toContain('component');
    });

    it('should return 400 when bugs array is missing', async () => {
      const res = await request(app)
        .post('/api/bug-patterns/cluster')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          options: { minClusterSize: 2 },
        });

      expect(res.status).toBe(400);
    });

    it('should return 400 when bugs array is empty', async () => {
      const res = await request(app)
        .post('/api/bug-patterns/cluster')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          bugs: [],
        });

      expect(res.status).toBe(400);
    });

    it('should return 401 when no auth token provided', async () => {
      const res = await request(app)
        .post('/api/bug-patterns/cluster')
        .send({
          bugs: sampleBugs,
        });

      expect(res.status).toBe(401);
    });

    it('should return 401 when invalid token provided', async () => {
      const res = await request(app)
        .post('/api/bug-patterns/cluster')
        .set('Authorization', 'Bearer invalid')
        .send({
          bugs: sampleBugs,
        });

      expect(res.status).toBe(401);
    });
  });

  // ==========================================================================
  // Error Handling
  // ==========================================================================
  describe('Error Handling', () => {
    it('should handle AI API errors gracefully for /analyze', async () => {
      mockAnthropicCreate.mockRejectedValue(new Error('API rate limit exceeded'));

      const res = await request(app)
        .post('/api/bug-patterns/analyze')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          bugs: sampleBugs,
        });

      expect(res.status).toBe(500);
    }, 20000);

    it('should handle AI API errors gracefully for /root-cause', async () => {
      mockAnthropicCreate.mockRejectedValue(new Error('Service unavailable'));

      const res = await request(app)
        .post('/api/bug-patterns/root-cause')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          failure: sampleTestFailure,
        });

      expect(res.status).toBe(500);
    }, 20000);

    it('should handle AI API errors gracefully for /predict', async () => {
      mockAnthropicCreate.mockRejectedValue(new Error('Connection timeout'));

      const res = await request(app)
        .post('/api/bug-patterns/predict')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          codeChanges: sampleCodeChanges,
        });

      expect(res.status).toBe(500);
    }, 20000);

    it('should handle AI API errors gracefully for /report', async () => {
      mockAnthropicCreate.mockRejectedValue(new Error('Invalid API key'));

      const res = await request(app)
        .post('/api/bug-patterns/report')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          bugs: sampleBugs,
        });

      expect(res.status).toBe(500);
    }, 20000);

    it('should handle AI API errors gracefully for /cluster', async () => {
      mockAnthropicCreate.mockRejectedValue(new Error('Network error'));

      const res = await request(app)
        .post('/api/bug-patterns/cluster')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          bugs: sampleBugs,
        });

      expect(res.status).toBe(500);
    }, 20000);

    it('should handle malformed JSON response from AI for /analyze', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'This is not valid JSON { broken' }],
        usage: { input_tokens: 100, output_tokens: 50 },
      });

      const res = await request(app)
        .post('/api/bug-patterns/analyze')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          bugs: sampleBugs,
        });

      expect(res.status).toBe(500);
    }, 20000);

    it('should handle malformed JSON response from AI for /root-cause', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: '{"incomplete": true' }],
        usage: { input_tokens: 100, output_tokens: 50 },
      });

      const res = await request(app)
        .post('/api/bug-patterns/root-cause')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          failure: sampleTestFailure,
        });

      expect(res.status).toBe(500);
    }, 20000);

    it('should handle malformed JSON response from AI for /predict', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'invalid json here' }],
        usage: { input_tokens: 100, output_tokens: 50 },
      });

      const res = await request(app)
        .post('/api/bug-patterns/predict')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          codeChanges: sampleCodeChanges,
        });

      expect(res.status).toBe(500);
    }, 20000);

    it('should handle malformed JSON response from AI for /report', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: '{"executiveSummary": ' }],
        usage: { input_tokens: 100, output_tokens: 50 },
      });

      const res = await request(app)
        .post('/api/bug-patterns/report')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          bugs: sampleBugs,
        });

      expect(res.status).toBe(500);
    }, 20000);

    it('should handle malformed JSON response from AI for /cluster', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'clusters: [broken' }],
        usage: { input_tokens: 100, output_tokens: 50 },
      });

      const res = await request(app)
        .post('/api/bug-patterns/cluster')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          bugs: sampleBugs,
        });

      expect(res.status).toBe(500);
    }, 20000);
  });
});

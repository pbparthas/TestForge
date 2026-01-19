/**
 * Test Evolution Agent Tests
 * Tests for analyzing test health, coverage evolution, stale tests, and test risk scoring
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the Anthropic client - must be hoisted with vi.hoisted
const { mockAnthropicClient, mockCreate } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockAnthropicClient: {
    messages: {
      create: vi.fn(),
    },
  },
}));

// Assign the mock function to the client
mockAnthropicClient.messages.create = mockCreate;

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => mockAnthropicClient),
}));

vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Import after mocking
import {
  TestEvolutionAgent,
  TestSuiteInput,
  TestExecutionHistory,
  CoverageData,
  TestHealthOutput,
  CoverageEvolutionOutput,
  StaleTestsOutput,
  TestRiskOutput,
  TestHealthOptions,
  CoverageEvolutionOptions,
  StaleTestsOptions,
  TestRiskOptions,
} from '../../../src/agents/testevolution.agent.js';

describe('TestEvolutionAgent', () => {
  let agent: TestEvolutionAgent;

  // Sample test suite input
  const sampleTestSuiteInput: TestSuiteInput = {
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
      {
        id: 'test-004',
        name: 'should load dashboard within 2 seconds',
        file: 'tests/e2e/dashboard.test.ts',
        line: 25,
        suite: 'Dashboard',
        tags: ['e2e', 'performance'],
        lastModified: '2026-01-10T10:00:00Z',
        createdAt: '2025-06-01T10:00:00Z',
      },
    ],
    projectRoot: '/home/user/project',
  };

  // Sample execution history
  const sampleExecutionHistory: TestExecutionHistory = {
    runs: [
      {
        id: 'run-001',
        timestamp: '2026-01-18T10:00:00Z',
        duration: 45000,
        results: [
          { testId: 'test-001', status: 'passed', duration: 120 },
          { testId: 'test-002', status: 'passed', duration: 85 },
          { testId: 'test-003', status: 'passed', duration: 2500 },
          { testId: 'test-004', status: 'failed', duration: 3500, error: 'Timeout' },
        ],
      },
      {
        id: 'run-002',
        timestamp: '2026-01-17T10:00:00Z',
        duration: 42000,
        results: [
          { testId: 'test-001', status: 'passed', duration: 115 },
          { testId: 'test-002', status: 'passed', duration: 90 },
          { testId: 'test-003', status: 'failed', duration: 2200, error: 'Connection timeout' },
          { testId: 'test-004', status: 'passed', duration: 1800 },
        ],
      },
      {
        id: 'run-003',
        timestamp: '2026-01-16T10:00:00Z',
        duration: 48000,
        results: [
          { testId: 'test-001', status: 'passed', duration: 130 },
          { testId: 'test-002', status: 'flaky', duration: 95 },
          { testId: 'test-003', status: 'passed', duration: 2100 },
          { testId: 'test-004', status: 'failed', duration: 4000, error: 'Element not found' },
        ],
      },
    ],
    totalRuns: 100,
    timeRange: {
      from: '2025-01-01T00:00:00Z',
      to: '2026-01-19T00:00:00Z',
    },
  };

  // Sample coverage data
  const sampleCoverageData: CoverageData = {
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
          uncoveredLines: [45, 67, 89],
        },
        {
          path: 'src/services/payment.service.ts',
          lines: 45.0,
          branches: 30.0,
          functions: 60.0,
          statements: 42.0,
          uncoveredLines: [12, 23, 34, 45, 56, 67, 78, 89, 100, 111],
        },
      ],
    },
    history: [
      { timestamp: '2026-01-11T00:00:00Z', overall: 75.2 },
      { timestamp: '2026-01-04T00:00:00Z', overall: 73.8 },
      { timestamp: '2025-12-28T00:00:00Z', overall: 72.1 },
      { timestamp: '2025-12-21T00:00:00Z', overall: 70.5 },
    ],
  };

  // Mock API response helper
  const createMockResponse = (content: string) => ({
    content: [{ type: 'text' as const, text: content }],
    usage: {
      input_tokens: 1800,
      output_tokens: 1000,
      cache_read_input_tokens: 0,
      cache_creation_input_tokens: 0,
    },
  });

  beforeEach(() => {
    vi.clearAllMocks();
    agent = new TestEvolutionAgent();
  });

  // ============================================================================
  // analyzeTestHealth() Tests
  // ============================================================================

  describe('analyzeTestHealth()', () => {
    const mockTestHealthOutput: TestHealthOutput = {
      summary: {
        totalTests: 4,
        healthScore: 72,
        healthStatus: 'warning',
        flakyTests: 2,
        slowTests: 1,
        failingTests: 1,
        avgPassRate: 85.5,
        avgDuration: 1500,
      },
      flakiness: {
        flakyTests: [
          {
            testId: 'test-004',
            name: 'should load dashboard within 2 seconds',
            flakinessScore: 45,
            failureRate: 66.7,
            passRate: 33.3,
            recentResults: ['failed', 'passed', 'failed'],
            patterns: ['Intermittent timeout', 'Environment-dependent'],
            recommendation: 'Add retry logic and increase timeout',
          },
          {
            testId: 'test-003',
            name: 'should process payment successfully',
            flakinessScore: 25,
            failureRate: 33.3,
            passRate: 66.7,
            recentResults: ['passed', 'failed', 'passed'],
            patterns: ['Network-dependent', 'External service'],
            recommendation: 'Mock external payment service',
          },
        ],
        overallFlakinessScore: 35,
        trend: 'increasing',
      },
      reliability: {
        mostReliable: [
          {
            testId: 'test-001',
            name: 'should authenticate user with valid credentials',
            passRate: 100,
            avgDuration: 122,
            consistency: 'high',
          },
          {
            testId: 'test-002',
            name: 'should reject invalid password',
            passRate: 100,
            avgDuration: 90,
            consistency: 'high',
          },
        ],
        leastReliable: [
          {
            testId: 'test-004',
            name: 'should load dashboard within 2 seconds',
            passRate: 33.3,
            avgDuration: 3100,
            consistency: 'low',
          },
        ],
      },
      executionTrends: {
        durationTrend: 'stable',
        passRateTrend: 'declining',
        avgDurationChange: 2.5,
        avgPassRateChange: -5.2,
      },
      recommendations: [
        'Investigate and fix flaky E2E test test-004',
        'Add mocking for external payment service in test-003',
        'Consider quarantining consistently failing tests',
      ],
    };

    it('should analyze test health successfully', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockTestHealthOutput)));

      const result = await agent.analyzeTestHealth(sampleTestSuiteInput, sampleExecutionHistory);

      expect(result.data.summary).toBeDefined();
      expect(result.data.summary.totalTests).toBe(4);
      expect(result.data.summary.healthScore).toBe(72);
      expect(result.data.summary.healthStatus).toBe('warning');
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it('should identify flaky tests', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockTestHealthOutput)));

      const result = await agent.analyzeTestHealth(sampleTestSuiteInput, sampleExecutionHistory);

      expect(result.data.flakiness).toBeDefined();
      expect(result.data.flakiness.flakyTests).toHaveLength(2);
      expect(result.data.flakiness.flakyTests[0].flakinessScore).toBe(45);
      expect(result.data.flakiness.overallFlakinessScore).toBe(35);
    });

    it('should calculate reliability metrics', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockTestHealthOutput)));

      const result = await agent.analyzeTestHealth(sampleTestSuiteInput, sampleExecutionHistory);

      expect(result.data.reliability).toBeDefined();
      expect(result.data.reliability.mostReliable).toHaveLength(2);
      expect(result.data.reliability.leastReliable).toHaveLength(1);
      expect(result.data.reliability.mostReliable[0].passRate).toBe(100);
    });

    it('should detect execution trends', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockTestHealthOutput)));

      const result = await agent.analyzeTestHealth(sampleTestSuiteInput, sampleExecutionHistory);

      expect(result.data.executionTrends).toBeDefined();
      expect(result.data.executionTrends.durationTrend).toBe('stable');
      expect(result.data.executionTrends.passRateTrend).toBe('declining');
    });

    it('should handle custom flakiness threshold', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockTestHealthOutput)));

      const options: TestHealthOptions = {
        flakinessThreshold: 20,
        slowTestThreshold: 2000,
        minRunsForAnalysis: 10,
      };

      const result = await agent.analyzeTestHealth(sampleTestSuiteInput, sampleExecutionHistory, options);

      expect(result.data).toBeDefined();

      const callArgs = mockCreate.mock.calls[0][0];
      const userMessage = callArgs.messages.find((m: { role: string }) => m.role === 'user');
      expect(userMessage.content).toContain('FLAKINESS THRESHOLD');
      expect(userMessage.content).toContain('SLOW TEST THRESHOLD');
    });

    it('should handle empty execution history', async () => {
      const noHistoryOutput: TestHealthOutput = {
        summary: {
          totalTests: 4,
          healthScore: 50,
          healthStatus: 'unknown',
          flakyTests: 0,
          slowTests: 0,
          failingTests: 0,
          avgPassRate: 0,
          avgDuration: 0,
        },
        flakiness: {
          flakyTests: [],
          overallFlakinessScore: 0,
          trend: 'unknown',
        },
        reliability: {
          mostReliable: [],
          leastReliable: [],
        },
        executionTrends: {
          durationTrend: 'unknown',
          passRateTrend: 'unknown',
          avgDurationChange: 0,
          avgPassRateChange: 0,
        },
        recommendations: ['No execution history available for analysis'],
      };

      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(noHistoryOutput)));

      const emptyHistory: TestExecutionHistory = {
        runs: [],
        totalRuns: 0,
        timeRange: { from: '2026-01-01T00:00:00Z', to: '2026-01-19T00:00:00Z' },
      };

      const result = await agent.analyzeTestHealth(sampleTestSuiteInput, emptyHistory);

      expect(result.data.summary.healthStatus).toBe('unknown');
      expect(result.data.flakiness.flakyTests).toEqual([]);
    });

    it('should include usage metrics in response', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockTestHealthOutput)));

      const result = await agent.analyzeTestHealth(sampleTestSuiteInput, sampleExecutionHistory);

      expect(result.usage).toBeDefined();
      expect(result.usage.inputTokens).toBe(1800);
      expect(result.usage.outputTokens).toBe(1000);
      expect(result.usage.model).toBeDefined();
      expect(result.usage.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should filter by test tags', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockTestHealthOutput)));

      const options: TestHealthOptions = {
        filterByTags: ['unit', 'auth'],
      };

      const result = await agent.analyzeTestHealth(sampleTestSuiteInput, sampleExecutionHistory, options);

      expect(result.data).toBeDefined();

      const callArgs = mockCreate.mock.calls[0][0];
      const userMessage = callArgs.messages.find((m: { role: string }) => m.role === 'user');
      expect(userMessage.content).toContain('FILTER TAGS');
    });
  });

  // ============================================================================
  // trackCoverageEvolution() Tests
  // ============================================================================

  describe('trackCoverageEvolution()', () => {
    const mockCoverageEvolutionOutput: CoverageEvolutionOutput = {
      summary: {
        currentCoverage: 78.5,
        previousCoverage: 75.2,
        changePercent: 4.4,
        trend: 'improving',
        targetCoverage: 80,
        gapToTarget: 1.5,
        projectedTimeToTarget: '2 weeks',
      },
      trends: {
        weekly: [
          { week: '2026-W03', coverage: 78.5, change: 3.3 },
          { week: '2026-W02', coverage: 75.2, change: 1.4 },
          { week: '2026-W01', coverage: 73.8, change: 1.7 },
          { week: '2025-W52', coverage: 72.1, change: 1.6 },
        ],
        monthly: [
          { month: '2026-01', avgCoverage: 75.8, change: 5.3 },
          { month: '2025-12', avgCoverage: 70.5, change: 2.1 },
        ],
        velocity: 1.2,
      },
      regressions: [
        {
          file: 'src/services/payment.service.ts',
          previousCoverage: 55.0,
          currentCoverage: 45.0,
          change: -10.0,
          cause: 'New methods added without tests',
          affectedLines: [12, 23, 34, 45, 56],
        },
      ],
      gaps: [
        {
          file: 'src/services/payment.service.ts',
          coverage: 45.0,
          gap: 35.0,
          priority: 'high',
          uncoveredAreas: ['processPayment error handling', 'refund flow'],
          suggestedTests: ['Add error scenario tests', 'Add refund tests'],
        },
      ],
      improvements: [
        {
          file: 'src/services/auth.service.ts',
          previousCoverage: 85.0,
          currentCoverage: 95.0,
          change: 10.0,
          contributor: 'Added login edge case tests',
        },
      ],
      recommendations: [
        'Focus on payment.service.ts to close coverage gap',
        'Address coverage regression before next release',
        'Current velocity suggests target achievable in 2 weeks',
      ],
    };

    it('should track coverage evolution successfully', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockCoverageEvolutionOutput)));

      const result = await agent.trackCoverageEvolution(sampleCoverageData);

      expect(result.data.summary).toBeDefined();
      expect(result.data.summary.currentCoverage).toBe(78.5);
      expect(result.data.summary.trend).toBe('improving');
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it('should calculate coverage trends', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockCoverageEvolutionOutput)));

      const result = await agent.trackCoverageEvolution(sampleCoverageData);

      expect(result.data.trends).toBeDefined();
      expect(result.data.trends.weekly).toHaveLength(4);
      expect(result.data.trends.velocity).toBe(1.2);
    });

    it('should detect coverage regressions', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockCoverageEvolutionOutput)));

      const result = await agent.trackCoverageEvolution(sampleCoverageData);

      expect(result.data.regressions).toHaveLength(1);
      expect(result.data.regressions[0].file).toBe('src/services/payment.service.ts');
      expect(result.data.regressions[0].change).toBe(-10.0);
    });

    it('should identify coverage gaps', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockCoverageEvolutionOutput)));

      const result = await agent.trackCoverageEvolution(sampleCoverageData);

      expect(result.data.gaps).toHaveLength(1);
      expect(result.data.gaps[0].priority).toBe('high');
      expect(result.data.gaps[0].suggestedTests.length).toBeGreaterThan(0);
    });

    it('should highlight improvements', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockCoverageEvolutionOutput)));

      const result = await agent.trackCoverageEvolution(sampleCoverageData);

      expect(result.data.improvements).toHaveLength(1);
      expect(result.data.improvements[0].change).toBe(10.0);
    });

    it('should project time to target', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockCoverageEvolutionOutput)));

      const result = await agent.trackCoverageEvolution(sampleCoverageData);

      expect(result.data.summary.targetCoverage).toBe(80);
      expect(result.data.summary.gapToTarget).toBe(1.5);
      expect(result.data.summary.projectedTimeToTarget).toBe('2 weeks');
    });

    it('should handle custom target coverage', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockCoverageEvolutionOutput)));

      const options: CoverageEvolutionOptions = {
        targetCoverage: 90,
        regressionThreshold: 5,
        gapThreshold: 20,
      };

      const result = await agent.trackCoverageEvolution(sampleCoverageData, options);

      expect(result.data).toBeDefined();

      const callArgs = mockCreate.mock.calls[0][0];
      const userMessage = callArgs.messages.find((m: { role: string }) => m.role === 'user');
      expect(userMessage.content).toContain('TARGET COVERAGE');
      expect(userMessage.content).toContain('REGRESSION THRESHOLD');
    });

    it('should handle no historical data', async () => {
      const noHistoryOutput: CoverageEvolutionOutput = {
        summary: {
          currentCoverage: 78.5,
          previousCoverage: 0,
          changePercent: 0,
          trend: 'unknown',
          targetCoverage: 80,
          gapToTarget: 1.5,
          projectedTimeToTarget: 'Unable to project',
        },
        trends: { weekly: [], monthly: [], velocity: 0 },
        regressions: [],
        gaps: [],
        improvements: [],
        recommendations: ['Collect more coverage data for trend analysis'],
      };

      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(noHistoryOutput)));

      const noHistoryCoverage: CoverageData = {
        current: sampleCoverageData.current,
        history: [],
      };

      const result = await agent.trackCoverageEvolution(noHistoryCoverage);

      expect(result.data.summary.trend).toBe('unknown');
      expect(result.data.trends.weekly).toEqual([]);
    });

    it('should filter by file patterns', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockCoverageEvolutionOutput)));

      const options: CoverageEvolutionOptions = {
        includePatterns: ['**/services/**'],
        excludePatterns: ['**/*.test.ts'],
      };

      const result = await agent.trackCoverageEvolution(sampleCoverageData, options);

      expect(result.data).toBeDefined();

      const callArgs = mockCreate.mock.calls[0][0];
      const userMessage = callArgs.messages.find((m: { role: string }) => m.role === 'user');
      expect(userMessage.content).toContain('INCLUDE PATTERNS');
      expect(userMessage.content).toContain('EXCLUDE PATTERNS');
    });
  });

  // ============================================================================
  // detectStaleTests() Tests
  // ============================================================================

  describe('detectStaleTests()', () => {
    const mockStaleTestsOutput: StaleTestsOutput = {
      summary: {
        totalTests: 4,
        staleTests: 2,
        deadCodeTests: 1,
        outdatedTests: 1,
        stalenessScore: 35,
      },
      staleTests: [
        {
          testId: 'test-003',
          name: 'should process payment successfully',
          file: 'tests/payment.test.ts',
          lastModified: '2024-06-01T10:00:00Z',
          daysSinceModification: 232,
          staleness: 'high',
          reasons: [
            'Not modified in over 6 months',
            'Target code has been significantly modified',
          ],
          targetCodeChanges: 15,
          recommendation: 'Review and update to match current implementation',
        },
        {
          testId: 'test-001',
          name: 'should authenticate user with valid credentials',
          file: 'tests/auth.test.ts',
          lastModified: '2025-12-01T10:00:00Z',
          daysSinceModification: 49,
          staleness: 'medium',
          reasons: [
            'Target code modified after test',
            'May not cover new functionality',
          ],
          targetCodeChanges: 5,
          recommendation: 'Verify test still covers all scenarios',
        },
      ],
      deadCodeTests: [
        {
          testId: 'test-legacy-001',
          name: 'should use deprecated API',
          file: 'tests/legacy.test.ts',
          reason: 'Tests deprecated function that no longer exists',
          targetFunction: 'deprecatedLogin',
          lastExecution: 'never',
          recommendation: 'Remove test - target code no longer exists',
        },
      ],
      outdatedTests: [
        {
          testId: 'test-003',
          name: 'should process payment successfully',
          file: 'tests/payment.test.ts',
          outdatedAspects: [
            {
              aspect: 'API contract',
              currentTest: 'Uses old response format',
              currentCode: 'Returns new PaymentResult object',
            },
          ],
          recommendation: 'Update test to match new API contract',
        },
      ],
      recommendations: [
        'Prioritize updating payment.test.ts - high staleness score',
        'Remove legacy.test.ts - tests non-existent code',
        'Establish test maintenance schedule',
      ],
      maintenanceEffort: {
        totalHours: 8,
        byPriority: {
          high: 4,
          medium: 3,
          low: 1,
        },
      },
    };

    it('should detect stale tests successfully', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockStaleTestsOutput)));

      const codeChanges = [
        {
          file: 'src/services/payment.service.ts',
          lastModified: '2026-01-15T10:00:00Z',
          changeCount: 15,
        },
        {
          file: 'src/services/auth.service.ts',
          lastModified: '2026-01-10T10:00:00Z',
          changeCount: 5,
        },
      ];

      const result = await agent.detectStaleTests(sampleTestSuiteInput, codeChanges);

      expect(result.data.summary).toBeDefined();
      expect(result.data.summary.staleTests).toBe(2);
      expect(result.data.staleTests).toHaveLength(2);
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it('should identify dead code tests', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockStaleTestsOutput)));

      const result = await agent.detectStaleTests(sampleTestSuiteInput, []);

      expect(result.data.deadCodeTests).toHaveLength(1);
      expect(result.data.deadCodeTests[0].reason).toContain('deprecated');
    });

    it('should find outdated tests', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockStaleTestsOutput)));

      const result = await agent.detectStaleTests(sampleTestSuiteInput, []);

      expect(result.data.outdatedTests).toHaveLength(1);
      expect(result.data.outdatedTests[0].outdatedAspects.length).toBeGreaterThan(0);
    });

    it('should calculate maintenance effort', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockStaleTestsOutput)));

      const result = await agent.detectStaleTests(sampleTestSuiteInput, []);

      expect(result.data.maintenanceEffort).toBeDefined();
      expect(result.data.maintenanceEffort.totalHours).toBe(8);
      expect(result.data.maintenanceEffort.byPriority.high).toBe(4);
    });

    it('should handle custom staleness threshold', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockStaleTestsOutput)));

      const options: StaleTestsOptions = {
        stalenessDays: 60,
        includeDeadCodeAnalysis: true,
        includeApiContractAnalysis: true,
      };

      const result = await agent.detectStaleTests(sampleTestSuiteInput, [], options);

      expect(result.data).toBeDefined();

      const callArgs = mockCreate.mock.calls[0][0];
      const userMessage = callArgs.messages.find((m: { role: string }) => m.role === 'user');
      expect(userMessage.content).toContain('STALENESS THRESHOLD');
    });

    it('should handle no stale tests', async () => {
      const noStaleOutput: StaleTestsOutput = {
        summary: {
          totalTests: 4,
          staleTests: 0,
          deadCodeTests: 0,
          outdatedTests: 0,
          stalenessScore: 0,
        },
        staleTests: [],
        deadCodeTests: [],
        outdatedTests: [],
        recommendations: ['All tests are up to date'],
        maintenanceEffort: {
          totalHours: 0,
          byPriority: { high: 0, medium: 0, low: 0 },
        },
      };

      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(noStaleOutput)));

      const result = await agent.detectStaleTests(sampleTestSuiteInput, []);

      expect(result.data.staleTests).toEqual([]);
      expect(result.data.summary.stalenessScore).toBe(0);
    });

    it('should categorize by staleness level', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockStaleTestsOutput)));

      const result = await agent.detectStaleTests(sampleTestSuiteInput, []);

      const highStaleness = result.data.staleTests.filter(t => t.staleness === 'high');
      const mediumStaleness = result.data.staleTests.filter(t => t.staleness === 'medium');

      expect(highStaleness.length).toBeGreaterThan(0);
      expect(mediumStaleness.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // scoreTestRisk() Tests
  // ============================================================================

  describe('scoreTestRisk()', () => {
    const mockTestRiskOutput: TestRiskOutput = {
      summary: {
        overallRiskScore: 65,
        riskLevel: 'medium',
        criticalRiskTests: 1,
        highRiskTests: 2,
        mediumRiskTests: 1,
        lowRiskTests: 0,
      },
      testRisks: [
        {
          testId: 'test-004',
          name: 'should load dashboard within 2 seconds',
          riskScore: 85,
          riskLevel: 'critical',
          riskFactors: [
            { factor: 'High flakiness', weight: 35, score: 90 },
            { factor: 'E2E test with external dependencies', weight: 25, score: 80 },
            { factor: 'Performance sensitive', weight: 20, score: 85 },
            { factor: 'Long execution time', weight: 20, score: 75 },
          ],
          impact: {
            blocksRelease: true,
            affectedFeatures: ['Dashboard', 'User Experience'],
            downstreamTests: 3,
          },
          recommendations: [
            'Add retry mechanism',
            'Mock external dependencies',
            'Split into smaller focused tests',
          ],
          maintenancePriority: 1,
        },
        {
          testId: 'test-003',
          name: 'should process payment successfully',
          riskScore: 72,
          riskLevel: 'high',
          riskFactors: [
            { factor: 'Integration test', weight: 30, score: 70 },
            { factor: 'Stale test', weight: 30, score: 85 },
            { factor: 'External service dependency', weight: 40, score: 65 },
          ],
          impact: {
            blocksRelease: true,
            affectedFeatures: ['Payment Processing'],
            downstreamTests: 0,
          },
          recommendations: [
            'Update test to match current API',
            'Add better mocking',
          ],
          maintenancePriority: 2,
        },
      ],
      riskDistribution: {
        byCategory: {
          flakiness: 35,
          staleness: 25,
          complexity: 20,
          dependencies: 20,
        },
        byTestType: {
          unit: 10,
          integration: 45,
          e2e: 45,
        },
      },
      maintenancePlan: {
        immediate: ['test-004'],
        shortTerm: ['test-003'],
        longTerm: [],
        estimatedEffort: {
          immediate: 4,
          shortTerm: 6,
          longTerm: 0,
        },
      },
      recommendations: [
        'Address critical E2E test stability first',
        'Update stale payment integration test',
        'Consider test pyramid rebalancing - too many E2E tests',
      ],
    };

    it('should score test risk successfully', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockTestRiskOutput)));

      const result = await agent.scoreTestRisk(
        sampleTestSuiteInput,
        sampleExecutionHistory,
        sampleCoverageData
      );

      expect(result.data.summary).toBeDefined();
      expect(result.data.summary.overallRiskScore).toBe(65);
      expect(result.data.summary.riskLevel).toBe('medium');
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it('should identify critical risk tests', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockTestRiskOutput)));

      const result = await agent.scoreTestRisk(
        sampleTestSuiteInput,
        sampleExecutionHistory,
        sampleCoverageData
      );

      expect(result.data.summary.criticalRiskTests).toBe(1);
      const criticalTests = result.data.testRisks.filter(t => t.riskLevel === 'critical');
      expect(criticalTests).toHaveLength(1);
    });

    it('should calculate risk factors', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockTestRiskOutput)));

      const result = await agent.scoreTestRisk(
        sampleTestSuiteInput,
        sampleExecutionHistory,
        sampleCoverageData
      );

      expect(result.data.testRisks[0].riskFactors.length).toBeGreaterThan(0);
      expect(result.data.testRisks[0].riskFactors[0].factor).toBeDefined();
      expect(result.data.testRisks[0].riskFactors[0].weight).toBeDefined();
      expect(result.data.testRisks[0].riskFactors[0].score).toBeDefined();
    });

    it('should assess impact', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockTestRiskOutput)));

      const result = await agent.scoreTestRisk(
        sampleTestSuiteInput,
        sampleExecutionHistory,
        sampleCoverageData
      );

      expect(result.data.testRisks[0].impact).toBeDefined();
      expect(result.data.testRisks[0].impact.blocksRelease).toBe(true);
      expect(result.data.testRisks[0].impact.affectedFeatures.length).toBeGreaterThan(0);
    });

    it('should provide maintenance plan', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockTestRiskOutput)));

      const result = await agent.scoreTestRisk(
        sampleTestSuiteInput,
        sampleExecutionHistory,
        sampleCoverageData
      );

      expect(result.data.maintenancePlan).toBeDefined();
      expect(result.data.maintenancePlan.immediate).toContain('test-004');
      expect(result.data.maintenancePlan.estimatedEffort.immediate).toBe(4);
    });

    it('should show risk distribution', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockTestRiskOutput)));

      const result = await agent.scoreTestRisk(
        sampleTestSuiteInput,
        sampleExecutionHistory,
        sampleCoverageData
      );

      expect(result.data.riskDistribution).toBeDefined();
      expect(result.data.riskDistribution.byCategory.flakiness).toBe(35);
      expect(result.data.riskDistribution.byTestType.e2e).toBe(45);
    });

    it('should handle custom risk weights', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockTestRiskOutput)));

      const options: TestRiskOptions = {
        riskWeights: {
          flakiness: 40,
          staleness: 20,
          complexity: 20,
          dependencies: 20,
        },
        criticalThreshold: 80,
        highThreshold: 60,
      };

      const result = await agent.scoreTestRisk(
        sampleTestSuiteInput,
        sampleExecutionHistory,
        sampleCoverageData,
        options
      );

      expect(result.data).toBeDefined();

      const callArgs = mockCreate.mock.calls[0][0];
      const userMessage = callArgs.messages.find((m: { role: string }) => m.role === 'user');
      expect(userMessage.content).toContain('RISK WEIGHTS');
    });

    it('should prioritize maintenance', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockTestRiskOutput)));

      const result = await agent.scoreTestRisk(
        sampleTestSuiteInput,
        sampleExecutionHistory,
        sampleCoverageData
      );

      expect(result.data.testRisks[0].maintenancePriority).toBe(1);
      expect(result.data.testRisks[1].maintenancePriority).toBe(2);
    });

    it('should handle low risk suite', async () => {
      const lowRiskOutput: TestRiskOutput = {
        summary: {
          overallRiskScore: 15,
          riskLevel: 'low',
          criticalRiskTests: 0,
          highRiskTests: 0,
          mediumRiskTests: 0,
          lowRiskTests: 4,
        },
        testRisks: [],
        riskDistribution: {
          byCategory: { flakiness: 5, staleness: 5, complexity: 3, dependencies: 2 },
          byTestType: { unit: 80, integration: 15, e2e: 5 },
        },
        maintenancePlan: {
          immediate: [],
          shortTerm: [],
          longTerm: [],
          estimatedEffort: { immediate: 0, shortTerm: 0, longTerm: 0 },
        },
        recommendations: ['Test suite is healthy - continue current practices'],
      };

      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(lowRiskOutput)));

      const result = await agent.scoreTestRisk(
        sampleTestSuiteInput,
        sampleExecutionHistory,
        sampleCoverageData
      );

      expect(result.data.summary.riskLevel).toBe('low');
      expect(result.data.summary.overallRiskScore).toBe(15);
    });
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe('error handling', () => {
    it('should retry on transient failures', async () => {
      const retryAgent = new TestEvolutionAgent({ maxRetries: 2 });

      const delaySpy = vi.spyOn(retryAgent as unknown as { delay: (ms: number) => Promise<void> }, 'delay')
        .mockResolvedValue(undefined);

      const mockOutput: TestHealthOutput = {
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

      mockCreate
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(createMockResponse(JSON.stringify(mockOutput)));

      const result = await retryAgent.analyzeTestHealth(sampleTestSuiteInput, sampleExecutionHistory);

      expect(result.data.summary).toBeDefined();
      expect(mockCreate).toHaveBeenCalledTimes(2);
      expect(delaySpy).toHaveBeenCalledTimes(1);

      delaySpy.mockRestore();
    });

    it('should fail after max retries', async () => {
      const retryAgent = new TestEvolutionAgent({ maxRetries: 3 });

      const delaySpy = vi.spyOn(retryAgent as unknown as { delay: (ms: number) => Promise<void> }, 'delay')
        .mockResolvedValue(undefined);

      mockCreate.mockRejectedValue(new Error('Persistent API error'));

      await expect(retryAgent.analyzeTestHealth(sampleTestSuiteInput, sampleExecutionHistory))
        .rejects.toThrow('Persistent API error');

      expect(mockCreate).toHaveBeenCalledTimes(3);
      expect(delaySpy).toHaveBeenCalledTimes(2);

      delaySpy.mockRestore();
    });

    it('should handle malformed JSON response', async () => {
      const noRetryAgent = new TestEvolutionAgent({ maxRetries: 1 });

      mockCreate.mockResolvedValue(createMockResponse('This is not valid JSON'));

      await expect(noRetryAgent.analyzeTestHealth(sampleTestSuiteInput, sampleExecutionHistory))
        .rejects.toThrow('Failed to parse JSON response');
    });

    it('should handle JSON wrapped in markdown code blocks', async () => {
      const mockOutput: TestHealthOutput = {
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

      const wrappedJson = '```json\n' + JSON.stringify(mockOutput) + '\n```';

      mockCreate.mockResolvedValue(createMockResponse(wrappedJson));

      const result = await agent.analyzeTestHealth(sampleTestSuiteInput, sampleExecutionHistory);

      expect(result.data.summary).toBeDefined();
    });

    it('should handle empty API response', async () => {
      const noRetryAgent = new TestEvolutionAgent({ maxRetries: 1 });

      mockCreate.mockResolvedValue({
        content: [],
        usage: {
          input_tokens: 0,
          output_tokens: 0,
          cache_read_input_tokens: 0,
          cache_creation_input_tokens: 0,
        },
      });

      await expect(noRetryAgent.analyzeTestHealth(sampleTestSuiteInput, sampleExecutionHistory))
        .rejects.toThrow();
    });
  });

  // ============================================================================
  // Configuration Tests
  // ============================================================================

  describe('configuration', () => {
    it('should use default configuration', () => {
      const defaultAgent = new TestEvolutionAgent();
      expect(defaultAgent).toBeDefined();
    });

    it('should accept custom configuration', () => {
      const customAgent = new TestEvolutionAgent({
        model: 'claude-3-5-haiku-20241022',
        maxTokens: 8192,
        temperature: 0.5,
        maxRetries: 5,
      });
      expect(customAgent).toBeDefined();
    });
  });

  // ============================================================================
  // Edge Case Tests
  // ============================================================================

  describe('edge cases', () => {
    it('should handle single test', async () => {
      const singleTestInput: TestSuiteInput = {
        tests: [sampleTestSuiteInput.tests[0]],
      };

      const singleTestOutput: TestHealthOutput = {
        summary: {
          totalTests: 1,
          healthScore: 95,
          healthStatus: 'healthy',
          flakyTests: 0,
          slowTests: 0,
          failingTests: 0,
          avgPassRate: 100,
          avgDuration: 120,
        },
        flakiness: { flakyTests: [], overallFlakinessScore: 0, trend: 'stable' },
        reliability: {
          mostReliable: [{
            testId: 'test-001',
            name: 'should authenticate user with valid credentials',
            passRate: 100,
            avgDuration: 120,
            consistency: 'high',
          }],
          leastReliable: [],
        },
        executionTrends: { durationTrend: 'stable', passRateTrend: 'stable', avgDurationChange: 0, avgPassRateChange: 0 },
        recommendations: [],
      };

      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(singleTestOutput)));

      const result = await agent.analyzeTestHealth(singleTestInput, sampleExecutionHistory);

      expect(result.data.summary.totalTests).toBe(1);
    });

    it('should handle all tests passing', async () => {
      const allPassOutput: TestHealthOutput = {
        summary: {
          totalTests: 4,
          healthScore: 100,
          healthStatus: 'healthy',
          flakyTests: 0,
          slowTests: 0,
          failingTests: 0,
          avgPassRate: 100,
          avgDuration: 500,
        },
        flakiness: { flakyTests: [], overallFlakinessScore: 0, trend: 'stable' },
        reliability: { mostReliable: [], leastReliable: [] },
        executionTrends: { durationTrend: 'stable', passRateTrend: 'stable', avgDurationChange: 0, avgPassRateChange: 0 },
        recommendations: ['Test suite is in excellent health'],
      };

      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(allPassOutput)));

      const result = await agent.analyzeTestHealth(sampleTestSuiteInput, sampleExecutionHistory);

      expect(result.data.summary.healthScore).toBe(100);
      expect(result.data.summary.flakyTests).toBe(0);
    });

    it('should handle all tests failing', async () => {
      const allFailOutput: TestHealthOutput = {
        summary: {
          totalTests: 4,
          healthScore: 0,
          healthStatus: 'critical',
          flakyTests: 0,
          slowTests: 0,
          failingTests: 4,
          avgPassRate: 0,
          avgDuration: 1000,
        },
        flakiness: { flakyTests: [], overallFlakinessScore: 0, trend: 'stable' },
        reliability: { mostReliable: [], leastReliable: [] },
        executionTrends: { durationTrend: 'stable', passRateTrend: 'stable', avgDurationChange: 0, avgPassRateChange: 0 },
        recommendations: ['Critical: All tests are failing - investigate immediately'],
      };

      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(allFailOutput)));

      const result = await agent.analyzeTestHealth(sampleTestSuiteInput, sampleExecutionHistory);

      expect(result.data.summary.healthScore).toBe(0);
      expect(result.data.summary.healthStatus).toBe('critical');
      expect(result.data.summary.failingTests).toBe(4);
    });

    it('should handle tests with no tags', async () => {
      const noTagsInput: TestSuiteInput = {
        tests: [
          {
            id: 'test-no-tag',
            name: 'test without tags',
            file: 'tests/misc.test.ts',
            line: 1,
            suite: 'Misc',
            lastModified: '2026-01-01T00:00:00Z',
            createdAt: '2026-01-01T00:00:00Z',
          },
        ],
      };

      const mockOutput: TestHealthOutput = {
        summary: {
          totalTests: 1,
          healthScore: 80,
          healthStatus: 'good',
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

      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockOutput)));

      const result = await agent.analyzeTestHealth(noTagsInput, sampleExecutionHistory);

      expect(result.data.summary.totalTests).toBe(1);
    });

    it('should handle 100% coverage', async () => {
      const fullCoverageData: CoverageData = {
        current: {
          timestamp: '2026-01-18T10:00:00Z',
          overall: 100,
          lines: 100,
          branches: 100,
          functions: 100,
          statements: 100,
          files: [],
        },
        history: [],
      };

      const fullCoverageOutput: CoverageEvolutionOutput = {
        summary: {
          currentCoverage: 100,
          previousCoverage: 95,
          changePercent: 5.3,
          trend: 'improving',
          targetCoverage: 100,
          gapToTarget: 0,
          projectedTimeToTarget: 'Target achieved',
        },
        trends: { weekly: [], monthly: [], velocity: 0 },
        regressions: [],
        gaps: [],
        improvements: [],
        recommendations: ['Maintain 100% coverage'],
      };

      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(fullCoverageOutput)));

      const result = await agent.trackCoverageEvolution(fullCoverageData);

      expect(result.data.summary.gapToTarget).toBe(0);
      expect(result.data.gaps).toEqual([]);
    });
  });
});

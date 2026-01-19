/**
 * Bug Pattern Agent Tests
 * Tests for analyzing patterns in bugs and test failures
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
  BugPatternAgent,
  BugData,
  TestFailure,
  CodeChange,
  PatternAnalysisOutput,
  RootCauseOutput,
  BugPredictionOutput,
  BugReportOutput,
  BugClusterOutput,
  PatternAnalysisOptions,
  ReportOptions,
  ClusterOptions,
} from '../../../src/agents/bugpattern.agent.js';

describe('BugPatternAgent', () => {
  let agent: BugPatternAgent;

  // Sample bug data
  const mockBug1: BugData = {
    id: 'BUG-001',
    title: 'Login fails with invalid token',
    description: 'Users are unable to login when their JWT token is expired',
    status: 'open',
    severity: 'critical',
    component: 'AuthService',
    stackTrace: 'Error: TokenExpiredError at AuthService.verify (auth.service.ts:45)',
    steps: ['Open login page', 'Enter credentials', 'Click submit'],
    environment: {
      os: 'Windows 10',
      browser: 'Chrome 120',
      version: '1.0.0',
    },
    createdAt: '2026-01-15T10:00:00Z',
    labels: ['auth', 'critical', 'production'],
    assignee: 'john@example.com',
    reporter: 'jane@example.com',
  };

  const mockBug2: BugData = {
    id: 'BUG-002',
    title: 'Session timeout not handled',
    description: 'Session timeout causes a crash instead of redirect to login',
    status: 'in_progress',
    severity: 'high',
    component: 'AuthService',
    stackTrace: 'Error: NullPointerException at SessionManager.check (session.ts:78)',
    createdAt: '2026-01-16T14:30:00Z',
    labels: ['auth', 'session'],
    assignee: 'john@example.com',
  };

  const mockBug3: BugData = {
    id: 'BUG-003',
    title: 'UI button misalignment on mobile',
    description: 'Submit button is cut off on mobile devices',
    status: 'open',
    severity: 'low',
    component: 'UI',
    createdAt: '2026-01-17T09:15:00Z',
    labels: ['ui', 'mobile'],
  };

  const mockBugs: BugData[] = [mockBug1, mockBug2, mockBug3];

  // Sample test failure
  const mockTestFailure: TestFailure = {
    testId: 'TEST-001',
    name: 'should authenticate user with valid credentials',
    error: 'Expected status 200 but received 401',
    stackTrace: `Error: Assertion failed
    at AuthTest.authenticate (auth.test.ts:45)
    at runTest (test-runner.ts:102)`,
    duration: 1500,
    retries: 2,
    file: 'tests/auth.test.ts',
    line: 45,
  };

  // Sample code changes
  const mockCodeChange1: CodeChange = {
    file: 'src/services/auth.service.ts',
    additions: 50,
    deletions: 20,
    author: 'john@example.com',
    date: '2026-01-18T08:00:00Z',
    commitMessage: 'Refactor token validation logic',
    commitHash: 'abc123',
    filesChanged: ['auth.service.ts', 'jwt.util.ts'],
  };

  const mockCodeChange2: CodeChange = {
    file: 'src/utils/jwt.util.ts',
    additions: 30,
    deletions: 10,
    author: 'jane@example.com',
    date: '2026-01-18T10:00:00Z',
    commitMessage: 'Add token refresh mechanism',
  };

  const mockCodeChanges: CodeChange[] = [mockCodeChange1, mockCodeChange2];

  // Mock API response helper
  const createMockResponse = (content: string) => ({
    content: [{ type: 'text' as const, text: content }],
    usage: {
      input_tokens: 1000,
      output_tokens: 500,
      cache_read_input_tokens: 0,
      cache_creation_input_tokens: 0,
    },
  });

  beforeEach(() => {
    vi.clearAllMocks();
    agent = new BugPatternAgent();
  });

  // ============================================================================
  // analyzePatterns() Tests
  // ============================================================================

  describe('analyzePatterns()', () => {
    const mockPatternAnalysis: PatternAnalysisOutput = {
      patterns: [
        {
          id: 'PAT-001',
          name: 'Authentication Failures',
          description: 'Recurring issues with JWT token handling and session management',
          frequency: 2,
          affectedComponents: ['AuthService'],
          examples: ['BUG-001', 'BUG-002'],
          severity: 'high',
          trend: 'increasing',
        },
      ],
      categories: [
        {
          name: 'Authentication',
          count: 2,
          percentage: 66.7,
          bugs: ['BUG-001', 'BUG-002'],
        },
        {
          name: 'UI/UX',
          count: 1,
          percentage: 33.3,
          bugs: ['BUG-003'],
        },
      ],
      correlations: [
        {
          factor1: 'component:AuthService',
          factor2: 'severity:high+',
          strength: 85,
          explanation: 'Auth bugs tend to be high or critical severity',
        },
      ],
      severityDistribution: {
        critical: 1,
        high: 1,
        medium: 0,
        low: 1,
      },
      trends: {
        totalBugs: 3,
        openBugs: 2,
        avgResolutionTime: '2.5 days',
        hotspotComponents: ['AuthService'],
        recentSpike: true,
        spikeReason: 'Recent authentication refactor introduced regressions',
      },
      insights: [
        '67% of bugs are in authentication component',
        'Critical bugs are concentrated in AuthService',
      ],
      recommendations: [
        'Increase test coverage for AuthService',
        'Add integration tests for token handling',
      ],
    };

    it('should identify recurring bug patterns', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockPatternAnalysis)));

      const result = await agent.analyzePatterns(mockBugs);

      expect(result.data.patterns).toBeDefined();
      expect(result.data.patterns.length).toBeGreaterThan(0);
      expect(result.data.patterns[0].name).toBe('Authentication Failures');
      expect(result.data.patterns[0].frequency).toBe(2);
      expect(result.data.patterns[0].affectedComponents).toContain('AuthService');
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it('should calculate severity distribution', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockPatternAnalysis)));

      const result = await agent.analyzePatterns(mockBugs);

      expect(result.data.severityDistribution).toBeDefined();
      expect(result.data.severityDistribution.critical).toBe(1);
      expect(result.data.severityDistribution.high).toBe(1);
      expect(result.data.severityDistribution.medium).toBe(0);
      expect(result.data.severityDistribution.low).toBe(1);
    });

    it('should detect trends over time', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockPatternAnalysis)));

      const result = await agent.analyzePatterns(mockBugs);

      expect(result.data.trends).toBeDefined();
      expect(result.data.trends.totalBugs).toBe(3);
      expect(result.data.trends.openBugs).toBe(2);
      expect(result.data.trends.hotspotComponents).toContain('AuthService');
      expect(result.data.trends.recentSpike).toBe(true);
      expect(result.data.trends.spikeReason).toBeDefined();
    });

    it('should handle empty bug array', async () => {
      const emptyAnalysis: PatternAnalysisOutput = {
        patterns: [],
        categories: [],
        correlations: [],
        severityDistribution: {
          critical: 0,
          high: 0,
          medium: 0,
          low: 0,
        },
        trends: {
          totalBugs: 0,
          openBugs: 0,
          avgResolutionTime: 'N/A',
          hotspotComponents: [],
          recentSpike: false,
        },
        insights: ['No bugs to analyze'],
        recommendations: [],
      };

      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(emptyAnalysis)));

      const result = await agent.analyzePatterns([]);

      expect(result.data.patterns).toEqual([]);
      expect(result.data.trends.totalBugs).toBe(0);
      expect(result.data.insights).toContain('No bugs to analyze');
    });

    it('should filter by time range', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockPatternAnalysis)));

      const options: PatternAnalysisOptions = {
        timeRange: {
          from: '2026-01-15T00:00:00Z',
          to: '2026-01-16T23:59:59Z',
        },
      };

      const result = await agent.analyzePatterns(mockBugs, options);

      expect(result.data).toBeDefined();
      expect(mockCreate).toHaveBeenCalledTimes(1);

      // Verify the prompt includes time range
      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.messages).toBeDefined();
      const userMessage = callArgs.messages.find((m: { role: string }) => m.role === 'user');
      expect(userMessage.content).toContain('TIME RANGE');
    });

    it('should filter by components', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockPatternAnalysis)));

      const options: PatternAnalysisOptions = {
        components: ['AuthService'],
      };

      const result = await agent.analyzePatterns(mockBugs, options);

      expect(result.data).toBeDefined();

      const callArgs = mockCreate.mock.calls[0][0];
      const userMessage = callArgs.messages.find((m: { role: string }) => m.role === 'user');
      expect(userMessage.content).toContain('FOCUS COMPONENTS');
      expect(userMessage.content).toContain('AuthService');
    });

    it('should filter by severities', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockPatternAnalysis)));

      const options: PatternAnalysisOptions = {
        severities: ['critical', 'high'],
      };

      const result = await agent.analyzePatterns(mockBugs, options);

      expect(result.data).toBeDefined();

      const callArgs = mockCreate.mock.calls[0][0];
      const userMessage = callArgs.messages.find((m: { role: string }) => m.role === 'user');
      expect(userMessage.content).toContain('SEVERITY FILTER');
    });

    it('should include usage metrics in response', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockPatternAnalysis)));

      const result = await agent.analyzePatterns(mockBugs);

      expect(result.usage).toBeDefined();
      expect(result.usage.inputTokens).toBe(1000);
      expect(result.usage.outputTokens).toBe(500);
      expect(result.usage.model).toBeDefined();
      expect(result.usage.durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  // ============================================================================
  // findRootCause() Tests
  // ============================================================================

  describe('findRootCause()', () => {
    const mockRootCauseOutput: RootCauseOutput = {
      rootCause: {
        type: 'code_defect',
        description: 'Token validation logic fails to handle expired tokens gracefully',
        confidence: 85,
        evidence: [
          'Stack trace shows TokenExpiredError at line 45',
          'Recent commit modified token validation logic',
        ],
      },
      contributing_factors: [
        {
          factor: 'Missing error boundary',
          impact: 'high',
          explanation: 'No try-catch around token verification call',
        },
        {
          factor: 'Lack of token refresh',
          impact: 'medium',
          explanation: 'No automatic token refresh before expiration',
        },
      ],
      suggestedFix: {
        description: 'Add proper error handling for expired tokens',
        steps: [
          'Add try-catch around jwt.verify()',
          'Implement token refresh on 401 response',
          'Add unit test for expired token scenario',
        ],
        complexity: 'simple',
        estimatedEffort: '4 hours',
      },
      relatedBugs: ['BUG-002'],
      preventionStrategies: [
        'Add pre-emptive token refresh',
        'Implement comprehensive error handling middleware',
      ],
    };

    it('should determine root cause with confidence', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockRootCauseOutput)));

      const result = await agent.findRootCause(mockTestFailure);

      expect(result.data.rootCause).toBeDefined();
      expect(result.data.rootCause.type).toBe('code_defect');
      expect(result.data.rootCause.confidence).toBe(85);
      expect(result.data.rootCause.evidence.length).toBeGreaterThan(0);
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it('should use code changes for context', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockRootCauseOutput)));

      const result = await agent.findRootCause(mockTestFailure, mockCodeChanges);

      expect(result.data.rootCause).toBeDefined();

      const callArgs = mockCreate.mock.calls[0][0];
      const userMessage = callArgs.messages.find((m: { role: string }) => m.role === 'user');
      expect(userMessage.content).toContain('RECENT CODE CHANGES');
      expect(userMessage.content).toContain('auth.service.ts');
      expect(userMessage.content).toContain('Refactor token validation logic');
    });

    it('should suggest fixes', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockRootCauseOutput)));

      const result = await agent.findRootCause(mockTestFailure);

      expect(result.data.suggestedFix).toBeDefined();
      expect(result.data.suggestedFix.description).toBeDefined();
      expect(result.data.suggestedFix.steps.length).toBeGreaterThan(0);
      expect(result.data.suggestedFix.complexity).toBe('simple');
      expect(result.data.suggestedFix.estimatedEffort).toBe('4 hours');
    });

    it('should identify contributing factors', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockRootCauseOutput)));

      const result = await agent.findRootCause(mockTestFailure);

      expect(result.data.contributing_factors).toBeDefined();
      expect(result.data.contributing_factors.length).toBeGreaterThan(0);
      expect(result.data.contributing_factors[0].factor).toBeDefined();
      expect(result.data.contributing_factors[0].impact).toBe('high');
      expect(result.data.contributing_factors[0].explanation).toBeDefined();
    });

    it('should handle missing stack trace', async () => {
      const failureWithoutStack: TestFailure = {
        testId: 'TEST-002',
        name: 'should load dashboard',
        error: 'Timeout waiting for element',
        duration: 30000,
        retries: 3,
      };

      const noStackOutput: RootCauseOutput = {
        rootCause: {
          type: 'timing',
          description: 'Element not rendered within timeout period',
          confidence: 60,
          evidence: ['Test timeout after 30 seconds', 'Multiple retries attempted'],
        },
        contributing_factors: [
          {
            factor: 'Slow network',
            impact: 'medium',
            explanation: 'Network latency may cause slow rendering',
          },
        ],
        suggestedFix: {
          description: 'Increase timeout and add explicit waits',
          steps: ['Increase test timeout', 'Add waitForSelector before assertion'],
          complexity: 'trivial',
          estimatedEffort: '30 minutes',
        },
        relatedBugs: [],
        preventionStrategies: ['Add retry logic with exponential backoff'],
      };

      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(noStackOutput)));

      const result = await agent.findRootCause(failureWithoutStack);

      expect(result.data.rootCause.type).toBe('timing');
      expect(result.data.rootCause.confidence).toBeLessThan(85);

      const callArgs = mockCreate.mock.calls[0][0];
      const userMessage = callArgs.messages.find((m: { role: string }) => m.role === 'user');
      expect(userMessage.content).not.toContain('STACK TRACE');
    });

    it('should provide prevention strategies', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockRootCauseOutput)));

      const result = await agent.findRootCause(mockTestFailure);

      expect(result.data.preventionStrategies).toBeDefined();
      expect(result.data.preventionStrategies.length).toBeGreaterThan(0);
    });

    it('should identify related bugs', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockRootCauseOutput)));

      const result = await agent.findRootCause(mockTestFailure);

      expect(result.data.relatedBugs).toBeDefined();
      expect(result.data.relatedBugs).toContain('BUG-002');
    });
  });

  // ============================================================================
  // predictBugProne() Tests
  // ============================================================================

  describe('predictBugProne()', () => {
    const mockPredictionOutput: BugPredictionOutput = {
      predictions: [
        {
          file: 'src/services/auth.service.ts',
          riskScore: 85,
          riskLevel: 'high',
          reasons: ['High churn rate', 'Previous critical bugs', 'Complex logic'],
          historicalBugCount: 5,
          recentChangeVelocity: 15,
          recommendations: ['Add integration tests', 'Code review required'],
        },
        {
          file: 'src/utils/jwt.util.ts',
          riskScore: 65,
          riskLevel: 'medium',
          reasons: ['Recent modifications', 'Dependency of auth service'],
          historicalBugCount: 2,
          recentChangeVelocity: 8,
          recommendations: ['Add unit tests for edge cases'],
        },
      ],
      overallRisk: {
        score: 75,
        level: 'high',
        summary: 'High risk due to significant changes in authentication module',
      },
      hotspots: [
        {
          area: 'Authentication',
          risk: 80,
          topContributors: ['auth.service.ts', 'jwt.util.ts'],
        },
      ],
      suggestedTestFocus: ['Token validation', 'Session management', 'Login flow'],
      mitigationStrategies: [
        'Increase test coverage to 90%',
        'Add code review gates for auth module',
        'Implement feature flags for risky changes',
      ],
    };

    it('should predict risky files', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockPredictionOutput)));

      const result = await agent.predictBugProne(mockCodeChanges);

      expect(result.data.predictions).toBeDefined();
      expect(result.data.predictions.length).toBeGreaterThan(0);
      expect(result.data.predictions[0].file).toBe('src/services/auth.service.ts');
      expect(result.data.predictions[0].riskScore).toBe(85);
      expect(result.data.predictions[0].riskLevel).toBe('high');
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it('should use historical bugs for better predictions', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockPredictionOutput)));

      const result = await agent.predictBugProne(mockCodeChanges, mockBugs);

      expect(result.data.predictions[0].historicalBugCount).toBe(5);

      const callArgs = mockCreate.mock.calls[0][0];
      const userMessage = callArgs.messages.find((m: { role: string }) => m.role === 'user');
      expect(userMessage.content).toContain('HISTORICAL BUGS');
      expect(userMessage.content).toContain('BUG-001');
    });

    it('should calculate overall risk score', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockPredictionOutput)));

      const result = await agent.predictBugProne(mockCodeChanges);

      expect(result.data.overallRisk).toBeDefined();
      expect(result.data.overallRisk.score).toBe(75);
      expect(result.data.overallRisk.level).toBe('high');
      expect(result.data.overallRisk.summary).toBeDefined();
    });

    it('should identify hotspots', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockPredictionOutput)));

      const result = await agent.predictBugProne(mockCodeChanges);

      expect(result.data.hotspots).toBeDefined();
      expect(result.data.hotspots.length).toBeGreaterThan(0);
      expect(result.data.hotspots[0].area).toBe('Authentication');
      expect(result.data.hotspots[0].risk).toBe(80);
      expect(result.data.hotspots[0].topContributors).toContain('auth.service.ts');
    });

    it('should handle empty code changes', async () => {
      const emptyPrediction: BugPredictionOutput = {
        predictions: [],
        overallRisk: {
          score: 0,
          level: 'low',
          summary: 'No code changes to analyze',
        },
        hotspots: [],
        suggestedTestFocus: [],
        mitigationStrategies: [],
      };

      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(emptyPrediction)));

      const result = await agent.predictBugProne([]);

      expect(result.data.predictions).toEqual([]);
      expect(result.data.overallRisk.score).toBe(0);
      expect(result.data.overallRisk.level).toBe('low');
    });

    it('should provide mitigation strategies', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockPredictionOutput)));

      const result = await agent.predictBugProne(mockCodeChanges);

      expect(result.data.mitigationStrategies).toBeDefined();
      expect(result.data.mitigationStrategies.length).toBeGreaterThan(0);
    });

    it('should suggest test focus areas', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockPredictionOutput)));

      const result = await agent.predictBugProne(mockCodeChanges);

      expect(result.data.suggestedTestFocus).toBeDefined();
      expect(result.data.suggestedTestFocus).toContain('Token validation');
    });
  });

  // ============================================================================
  // generateReport() Tests
  // ============================================================================

  describe('generateReport()', () => {
    const mockReportOutput: BugReportOutput = {
      executiveSummary: {
        totalBugs: 3,
        openBugs: 2,
        criticalBugs: 1,
        avgAge: '2.5 days',
        healthScore: 65,
        healthStatus: 'warning',
        keyFindings: [
          '1 critical bug in authentication',
          'AuthService is a hotspot with 67% of bugs',
        ],
      },
      charts: {
        severityBreakdown: [
          { label: 'Critical', value: 1 },
          { label: 'High', value: 1 },
          { label: 'Medium', value: 0 },
          { label: 'Low', value: 1 },
        ],
        statusBreakdown: [
          { label: 'Open', value: 2 },
          { label: 'In Progress', value: 1 },
          { label: 'Resolved', value: 0 },
        ],
        componentBreakdown: [
          { label: 'AuthService', value: 2 },
          { label: 'UI', value: 1 },
        ],
        trendOverTime: [
          { date: '2026-01-15', opened: 1, closed: 0 },
          { date: '2026-01-16', opened: 1, closed: 0 },
          { date: '2026-01-17', opened: 1, closed: 0 },
        ],
        topAuthors: [
          { author: 'john@example.com', bugs: 2 },
        ],
      },
      topIssues: [
        {
          id: 'BUG-001',
          title: 'Login fails with invalid token',
          severity: 'critical',
          age: '4 days',
          impact: 'Blocks user authentication',
        },
      ],
      recommendations: [
        {
          priority: 'high',
          action: 'Fix critical authentication bug',
          expectedImpact: 'Restore login functionality for all users',
          effort: '1 day',
        },
        {
          priority: 'medium',
          action: 'Add comprehensive auth tests',
          expectedImpact: 'Prevent future auth regressions',
          effort: '2 days',
        },
      ],
      reportDate: '2026-01-19T10:00:00Z',
    };

    it('should generate executive summary', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockReportOutput)));

      const result = await agent.generateReport(mockBugs);

      expect(result.data.executiveSummary).toBeDefined();
      expect(result.data.executiveSummary.totalBugs).toBe(3);
      expect(result.data.executiveSummary.openBugs).toBe(2);
      expect(result.data.executiveSummary.criticalBugs).toBe(1);
      expect(result.data.executiveSummary.healthScore).toBe(65);
      expect(result.data.executiveSummary.healthStatus).toBe('warning');
      expect(result.data.executiveSummary.keyFindings.length).toBeGreaterThan(0);
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it('should include chart data', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockReportOutput)));

      const result = await agent.generateReport(mockBugs);

      expect(result.data.charts).toBeDefined();
      expect(result.data.charts.severityBreakdown).toBeDefined();
      expect(result.data.charts.statusBreakdown).toBeDefined();
      expect(result.data.charts.componentBreakdown).toBeDefined();
      expect(result.data.charts.trendOverTime).toBeDefined();
      expect(result.data.charts.topAuthors).toBeDefined();
    });

    it('should list top issues', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockReportOutput)));

      const result = await agent.generateReport(mockBugs);

      expect(result.data.topIssues).toBeDefined();
      expect(result.data.topIssues.length).toBeGreaterThan(0);
      expect(result.data.topIssues[0].id).toBe('BUG-001');
      expect(result.data.topIssues[0].severity).toBe('critical');
      expect(result.data.topIssues[0].impact).toBeDefined();
    });

    it('should provide recommendations', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockReportOutput)));

      const result = await agent.generateReport(mockBugs);

      expect(result.data.recommendations).toBeDefined();
      expect(result.data.recommendations.length).toBeGreaterThan(0);
      expect(result.data.recommendations[0].priority).toBe('high');
      expect(result.data.recommendations[0].action).toBeDefined();
      expect(result.data.recommendations[0].expectedImpact).toBeDefined();
      expect(result.data.recommendations[0].effort).toBeDefined();
    });

    it('should filter by date range', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockReportOutput)));

      const options: ReportOptions = {
        timeRange: {
          from: '2026-01-15T00:00:00Z',
          to: '2026-01-17T23:59:59Z',
        },
      };

      const result = await agent.generateReport(mockBugs, options);

      expect(result.data).toBeDefined();

      const callArgs = mockCreate.mock.calls[0][0];
      const userMessage = callArgs.messages.find((m: { role: string }) => m.role === 'user');
      expect(userMessage.content).toContain('TIME RANGE');
    });

    it('should support different report formats', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockReportOutput)));

      const options: ReportOptions = {
        format: 'executive',
      };

      const result = await agent.generateReport(mockBugs, options);

      expect(result.data).toBeDefined();

      const callArgs = mockCreate.mock.calls[0][0];
      const userMessage = callArgs.messages.find((m: { role: string }) => m.role === 'user');
      expect(userMessage.content).toContain('REPORT FORMAT');
      expect(userMessage.content).toContain('executive');
    });

    it('should optionally include charts', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockReportOutput)));

      const options: ReportOptions = {
        includeCharts: true,
      };

      const result = await agent.generateReport(mockBugs, options);

      expect(result.data.charts).toBeDefined();

      const callArgs = mockCreate.mock.calls[0][0];
      const userMessage = callArgs.messages.find((m: { role: string }) => m.role === 'user');
      expect(userMessage.content).toContain('INCLUDE CHARTS');
    });

    it('should support focus areas', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockReportOutput)));

      const options: ReportOptions = {
        focusAreas: ['AuthService', 'Security'],
      };

      const result = await agent.generateReport(mockBugs, options);

      expect(result.data).toBeDefined();

      const callArgs = mockCreate.mock.calls[0][0];
      const userMessage = callArgs.messages.find((m: { role: string }) => m.role === 'user');
      expect(userMessage.content).toContain('FOCUS AREAS');
      expect(userMessage.content).toContain('AuthService');
    });

    it('should include report date', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockReportOutput)));

      const result = await agent.generateReport(mockBugs);

      expect(result.data.reportDate).toBeDefined();
    });
  });

  // ============================================================================
  // clusterBugs() Tests
  // ============================================================================

  describe('clusterBugs()', () => {
    const mockClusterOutput: BugClusterOutput = {
      clusters: [
        {
          id: 'CLUSTER-001',
          name: 'Authentication Failures',
          theme: 'Login and session management issues',
          bugs: ['BUG-001', 'BUG-002'],
          size: 2,
          avgSeverity: 1.5,
          commonCharacteristics: ['Involves JWT', 'AuthService component', 'Session related'],
          suggestedPriority: 'high',
          triageRecommendation: 'Assign to auth team for batch fix',
        },
        {
          id: 'CLUSTER-002',
          name: 'UI Issues',
          theme: 'User interface rendering problems',
          bugs: ['BUG-003'],
          size: 1,
          avgSeverity: 4,
          commonCharacteristics: ['Mobile specific', 'Layout issue'],
          suggestedPriority: 'low',
          triageRecommendation: 'Schedule for next UI sprint',
        },
      ],
      similarityMatrix: [
        {
          bug1: 'BUG-001',
          bug2: 'BUG-002',
          similarity: 85,
          sharedAttributes: ['component:AuthService', 'type:auth'],
        },
      ],
      outliers: [
        {
          bugId: 'BUG-003',
          reason: 'Only UI bug in the dataset',
          specialAttention: false,
        },
      ],
      triageOrder: ['BUG-001', 'BUG-002', 'BUG-003'],
      insights: [
        'Two clusters identified: Auth (67%) and UI (33%)',
        'Auth cluster has highest priority',
      ],
    };

    it('should group similar bugs', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockClusterOutput)));

      const result = await agent.clusterBugs(mockBugs);

      expect(result.data.clusters).toBeDefined();
      expect(result.data.clusters.length).toBe(2);
      expect(result.data.clusters[0].name).toBe('Authentication Failures');
      expect(result.data.clusters[0].bugs).toContain('BUG-001');
      expect(result.data.clusters[0].bugs).toContain('BUG-002');
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it('should calculate similarity scores', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockClusterOutput)));

      const result = await agent.clusterBugs(mockBugs);

      expect(result.data.similarityMatrix).toBeDefined();
      expect(result.data.similarityMatrix.length).toBeGreaterThan(0);
      expect(result.data.similarityMatrix[0].bug1).toBe('BUG-001');
      expect(result.data.similarityMatrix[0].bug2).toBe('BUG-002');
      expect(result.data.similarityMatrix[0].similarity).toBe(85);
      expect(result.data.similarityMatrix[0].sharedAttributes.length).toBeGreaterThan(0);
    });

    it('should identify outliers', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockClusterOutput)));

      const result = await agent.clusterBugs(mockBugs);

      expect(result.data.outliers).toBeDefined();
      expect(result.data.outliers.length).toBeGreaterThan(0);
      expect(result.data.outliers[0].bugId).toBe('BUG-003');
      expect(result.data.outliers[0].reason).toBeDefined();
    });

    it('should suggest triage order', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockClusterOutput)));

      const result = await agent.clusterBugs(mockBugs);

      expect(result.data.triageOrder).toBeDefined();
      expect(result.data.triageOrder.length).toBe(3);
      expect(result.data.triageOrder[0]).toBe('BUG-001');
    });

    it('should handle single bug', async () => {
      const singleBugCluster: BugClusterOutput = {
        clusters: [
          {
            id: 'CLUSTER-001',
            name: 'Single Bug',
            theme: 'Standalone issue',
            bugs: ['BUG-001'],
            size: 1,
            avgSeverity: 1,
            commonCharacteristics: ['Authentication'],
            suggestedPriority: 'critical',
            triageRecommendation: 'Fix immediately',
          },
        ],
        similarityMatrix: [],
        outliers: [],
        triageOrder: ['BUG-001'],
        insights: ['Only one bug to analyze'],
      };

      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(singleBugCluster)));

      const result = await agent.clusterBugs([mockBug1]);

      expect(result.data.clusters.length).toBe(1);
      expect(result.data.clusters[0].size).toBe(1);
      expect(result.data.similarityMatrix).toEqual([]);
    });

    it('should respect cluster options', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockClusterOutput)));

      const options: ClusterOptions = {
        minClusterSize: 2,
        maxClusters: 5,
        similarityThreshold: 70,
      };

      const result = await agent.clusterBugs(mockBugs, options);

      expect(result.data).toBeDefined();

      const callArgs = mockCreate.mock.calls[0][0];
      const userMessage = callArgs.messages.find((m: { role: string }) => m.role === 'user');
      expect(userMessage.content).toContain('MIN CLUSTER SIZE');
      expect(userMessage.content).toContain('MAX CLUSTERS');
      expect(userMessage.content).toContain('SIMILARITY THRESHOLD');
    });

    it('should provide cluster insights', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockClusterOutput)));

      const result = await agent.clusterBugs(mockBugs);

      expect(result.data.insights).toBeDefined();
      expect(result.data.insights.length).toBeGreaterThan(0);
    });

    it('should include common characteristics', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockClusterOutput)));

      const result = await agent.clusterBugs(mockBugs);

      expect(result.data.clusters[0].commonCharacteristics).toBeDefined();
      expect(result.data.clusters[0].commonCharacteristics.length).toBeGreaterThan(0);
    });

    it('should suggest priority per cluster', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockClusterOutput)));

      const result = await agent.clusterBugs(mockBugs);

      expect(result.data.clusters[0].suggestedPriority).toBe('high');
      expect(result.data.clusters[1].suggestedPriority).toBe('low');
    });
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe('error handling', () => {
    it('should retry on transient failures', async () => {
      const retryAgent = new BugPatternAgent({ maxRetries: 2 });

      // Mock the delay method to return immediately
      const delaySpy = vi.spyOn(retryAgent as unknown as { delay: (ms: number) => Promise<void> }, 'delay')
        .mockResolvedValue(undefined);

      const mockPatternAnalysis: PatternAnalysisOutput = {
        patterns: [],
        categories: [],
        correlations: [],
        severityDistribution: { critical: 0, high: 0, medium: 0, low: 0 },
        trends: {
          totalBugs: 0,
          openBugs: 0,
          avgResolutionTime: 'N/A',
          hotspotComponents: [],
          recentSpike: false,
        },
        insights: [],
        recommendations: [],
      };

      mockCreate
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(createMockResponse(JSON.stringify(mockPatternAnalysis)));

      const result = await retryAgent.analyzePatterns(mockBugs);

      expect(result.data.patterns).toBeDefined();
      expect(mockCreate).toHaveBeenCalledTimes(2);
      expect(delaySpy).toHaveBeenCalledTimes(1);

      delaySpy.mockRestore();
    });

    it('should fail after max retries', async () => {
      const retryAgent = new BugPatternAgent({ maxRetries: 3 });

      // Mock the delay method to return immediately
      const delaySpy = vi.spyOn(retryAgent as unknown as { delay: (ms: number) => Promise<void> }, 'delay')
        .mockResolvedValue(undefined);

      mockCreate.mockRejectedValue(new Error('Persistent API error'));

      await expect(retryAgent.analyzePatterns(mockBugs))
        .rejects.toThrow('Persistent API error');

      expect(mockCreate).toHaveBeenCalledTimes(3);
      expect(delaySpy).toHaveBeenCalledTimes(2); // Called between attempts (3 attempts = 2 delays)

      delaySpy.mockRestore();
    });

    it('should handle malformed JSON response', async () => {
      const noRetryAgent = new BugPatternAgent({ maxRetries: 1 });

      mockCreate.mockResolvedValue(createMockResponse('This is not valid JSON at all'));

      await expect(noRetryAgent.analyzePatterns(mockBugs))
        .rejects.toThrow('Failed to parse JSON response');
    });

    it('should handle JSON wrapped in markdown code blocks', async () => {
      const mockPatternAnalysis: PatternAnalysisOutput = {
        patterns: [],
        categories: [],
        correlations: [],
        severityDistribution: { critical: 0, high: 0, medium: 0, low: 0 },
        trends: {
          totalBugs: 0,
          openBugs: 0,
          avgResolutionTime: 'N/A',
          hotspotComponents: [],
          recentSpike: false,
        },
        insights: [],
        recommendations: [],
      };

      const wrappedJson = '```json\n' + JSON.stringify(mockPatternAnalysis) + '\n```';

      mockCreate.mockResolvedValue(createMockResponse(wrappedJson));

      const result = await agent.analyzePatterns(mockBugs);

      expect(result.data.patterns).toBeDefined();
    });

    it('should handle empty API response', async () => {
      const noRetryAgent = new BugPatternAgent({ maxRetries: 1 });

      mockCreate.mockResolvedValue({
        content: [],
        usage: {
          input_tokens: 0,
          output_tokens: 0,
          cache_read_input_tokens: 0,
          cache_creation_input_tokens: 0,
        },
      });

      await expect(noRetryAgent.analyzePatterns(mockBugs))
        .rejects.toThrow();
    });

    it('should handle rate limiting errors', async () => {
      const retryAgent = new BugPatternAgent({ maxRetries: 2 });

      const delaySpy = vi.spyOn(retryAgent as unknown as { delay: (ms: number) => Promise<void> }, 'delay')
        .mockResolvedValue(undefined);

      const rateLimitError = new Error('Rate limit exceeded');
      (rateLimitError as Error & { status: number }).status = 429;

      mockCreate.mockRejectedValue(rateLimitError);

      await expect(retryAgent.analyzePatterns(mockBugs))
        .rejects.toThrow('Rate limit exceeded');

      expect(mockCreate).toHaveBeenCalledTimes(2);

      delaySpy.mockRestore();
    });
  });

  // ============================================================================
  // Configuration Tests
  // ============================================================================

  describe('configuration', () => {
    it('should use default configuration', () => {
      const defaultAgent = new BugPatternAgent();
      expect(defaultAgent).toBeDefined();
    });

    it('should accept custom configuration', () => {
      const customAgent = new BugPatternAgent({
        model: 'claude-3-5-haiku-20241022',
        maxTokens: 8192,
        temperature: 0.5,
        maxRetries: 5,
      });
      expect(customAgent).toBeDefined();
    });

    it('should use agent name correctly', async () => {
      const mockPatternAnalysis: PatternAnalysisOutput = {
        patterns: [],
        categories: [],
        correlations: [],
        severityDistribution: { critical: 0, high: 0, medium: 0, low: 0 },
        trends: {
          totalBugs: 0,
          openBugs: 0,
          avgResolutionTime: 'N/A',
          hotspotComponents: [],
          recentSpike: false,
        },
        insights: [],
        recommendations: [],
      };

      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockPatternAnalysis)));

      await agent.analyzePatterns(mockBugs);

      // The agent should be named 'BugPatternAgent'
      expect(agent).toBeDefined();
    });
  });

  // ============================================================================
  // Edge Case Tests
  // ============================================================================

  describe('edge cases', () => {
    it('should handle all bugs with same severity', async () => {
      const sameSeverityBugs: BugData[] = [
        { ...mockBug1, severity: 'high' },
        { ...mockBug2, severity: 'high' },
        { ...mockBug3, severity: 'high' },
      ];

      const sameSeverityAnalysis: PatternAnalysisOutput = {
        patterns: [
          {
            id: 'PAT-001',
            name: 'Uniform Severity Pattern',
            description: 'All bugs are high severity',
            frequency: 3,
            affectedComponents: ['AuthService', 'UI'],
            examples: ['BUG-001', 'BUG-002', 'BUG-003'],
            severity: 'high',
            trend: 'stable',
          },
        ],
        categories: [],
        correlations: [],
        severityDistribution: { critical: 0, high: 3, medium: 0, low: 0 },
        trends: {
          totalBugs: 3,
          openBugs: 2,
          avgResolutionTime: '2 days',
          hotspotComponents: ['AuthService'],
          recentSpike: false,
        },
        insights: ['All bugs have uniform high severity'],
        recommendations: ['Review severity assignment process'],
      };

      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(sameSeverityAnalysis)));

      const result = await agent.analyzePatterns(sameSeverityBugs);

      expect(result.data.severityDistribution.high).toBe(3);
      expect(result.data.severityDistribution.critical).toBe(0);
      expect(result.data.severityDistribution.medium).toBe(0);
      expect(result.data.severityDistribution.low).toBe(0);
    });

    it('should handle very high similarity threshold (0.99)', async () => {
      const highThresholdCluster: BugClusterOutput = {
        clusters: [
          {
            id: 'CLUSTER-001',
            name: 'Single Bug Clusters',
            theme: 'No bugs meet high similarity threshold',
            bugs: ['BUG-001'],
            size: 1,
            avgSeverity: 1,
            commonCharacteristics: [],
            suggestedPriority: 'critical',
            triageRecommendation: 'Review individually - no similar bugs found',
          },
        ],
        similarityMatrix: [
          {
            bug1: 'BUG-001',
            bug2: 'BUG-002',
            similarity: 85, // Below 99% threshold
            sharedAttributes: ['component'],
          },
        ],
        outliers: [
          { bugId: 'BUG-002', reason: 'Below similarity threshold', specialAttention: false },
          { bugId: 'BUG-003', reason: 'Below similarity threshold', specialAttention: false },
        ],
        triageOrder: ['BUG-001', 'BUG-002', 'BUG-003'],
        insights: ['Very high threshold resulted in minimal clustering'],
      };

      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(highThresholdCluster)));

      const options: ClusterOptions = {
        similarityThreshold: 99,
      };

      const result = await agent.clusterBugs(mockBugs, options);

      expect(result.data.outliers.length).toBe(2);
      expect(result.data.insights).toContain('Very high threshold resulted in minimal clustering');

      const callArgs = mockCreate.mock.calls[0][0];
      const userMessage = callArgs.messages.find((m: { role: string }) => m.role === 'user');
      expect(userMessage.content).toContain('SIMILARITY THRESHOLD');
      expect(userMessage.content).toContain('99%');
    });

    it('should handle very low similarity threshold (0.1)', async () => {
      const lowThresholdCluster: BugClusterOutput = {
        clusters: [
          {
            id: 'CLUSTER-001',
            name: 'All Bugs Cluster',
            theme: 'All bugs clustered together due to low threshold',
            bugs: ['BUG-001', 'BUG-002', 'BUG-003'],
            size: 3,
            avgSeverity: 2,
            commonCharacteristics: ['software bugs'],
            suggestedPriority: 'high',
            triageRecommendation: 'Review threshold - too broad clustering',
          },
        ],
        similarityMatrix: [
          { bug1: 'BUG-001', bug2: 'BUG-002', similarity: 85, sharedAttributes: ['component'] },
          { bug1: 'BUG-001', bug2: 'BUG-003', similarity: 25, sharedAttributes: [] },
          { bug1: 'BUG-002', bug2: 'BUG-003', similarity: 30, sharedAttributes: [] },
        ],
        outliers: [],
        triageOrder: ['BUG-001', 'BUG-002', 'BUG-003'],
        insights: ['Low threshold resulted in single large cluster'],
      };

      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(lowThresholdCluster)));

      const options: ClusterOptions = {
        similarityThreshold: 10,
      };

      const result = await agent.clusterBugs(mockBugs, options);

      expect(result.data.clusters.length).toBe(1);
      expect(result.data.clusters[0].size).toBe(3);
      expect(result.data.outliers.length).toBe(0);

      const callArgs = mockCreate.mock.calls[0][0];
      const userMessage = callArgs.messages.find((m: { role: string }) => m.role === 'user');
      expect(userMessage.content).toContain('10%');
    });

    it('should handle all bugs in one cluster', async () => {
      const singleClusterOutput: BugClusterOutput = {
        clusters: [
          {
            id: 'CLUSTER-001',
            name: 'Authentication Related',
            theme: 'All bugs relate to authentication',
            bugs: ['BUG-001', 'BUG-002', 'BUG-003'],
            size: 3,
            avgSeverity: 1.67,
            commonCharacteristics: ['AuthService related', 'Session handling'],
            suggestedPriority: 'critical',
            triageRecommendation: 'All bugs share common root cause - fix holistically',
          },
        ],
        similarityMatrix: [
          { bug1: 'BUG-001', bug2: 'BUG-002', similarity: 90, sharedAttributes: ['component', 'labels'] },
          { bug1: 'BUG-001', bug2: 'BUG-003', similarity: 85, sharedAttributes: ['component'] },
          { bug1: 'BUG-002', bug2: 'BUG-003', similarity: 88, sharedAttributes: ['component'] },
        ],
        outliers: [],
        triageOrder: ['BUG-001', 'BUG-002', 'BUG-003'],
        insights: ['All bugs form single cluster - likely systemic issue'],
      };

      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(singleClusterOutput)));

      const result = await agent.clusterBugs(mockBugs);

      expect(result.data.clusters.length).toBe(1);
      expect(result.data.clusters[0].bugs.length).toBe(3);
      expect(result.data.outliers.length).toBe(0);
    });

    it('should handle prediction with empty historical bugs array', async () => {
      const noHistoryPrediction: BugPredictionOutput = {
        predictions: [
          {
            file: 'src/services/auth.service.ts',
            riskScore: 60,
            riskLevel: 'medium',
            reasons: ['Moderate churn rate', 'No historical bug data available'],
            historicalBugCount: 0,
            recentChangeVelocity: 10,
            recommendations: ['Add tests proactively'],
          },
        ],
        overallRisk: {
          score: 60,
          level: 'medium',
          summary: 'Moderate risk - no historical data for comparison',
        },
        hotspots: [],
        suggestedTestFocus: ['New code changes'],
        mitigationStrategies: ['Establish baseline metrics'],
      };

      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(noHistoryPrediction)));

      const result = await agent.predictBugProne(mockCodeChanges, []);

      expect(result.data.predictions[0].historicalBugCount).toBe(0);
      expect(result.data.overallRisk.summary).toContain('no historical data');
    });

    it('should handle test failure with minimal info (no file, line, or stack trace)', async () => {
      const minimalFailure: TestFailure = {
        testId: 'TEST-MINIMAL',
        name: 'minimal test',
        error: 'Unknown error',
        duration: 100,
        retries: 0,
      };

      const minimalRootCause: RootCauseOutput = {
        rootCause: {
          type: 'unknown',
          description: 'Insufficient information to determine root cause',
          confidence: 30,
          evidence: ['No stack trace available', 'No file location provided'],
        },
        contributing_factors: [],
        suggestedFix: {
          description: 'Improve test error reporting',
          steps: ['Add better error logging', 'Include stack traces'],
          complexity: 'trivial',
          estimatedEffort: '1 hour',
        },
        relatedBugs: [],
        preventionStrategies: ['Improve test error capture'],
      };

      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(minimalRootCause)));

      const result = await agent.findRootCause(minimalFailure);

      expect(result.data.rootCause.type).toBe('unknown');
      expect(result.data.rootCause.confidence).toBeLessThan(50);

      const callArgs = mockCreate.mock.calls[0][0];
      const userMessage = callArgs.messages.find((m: { role: string }) => m.role === 'user');
      expect(userMessage.content).not.toContain('FILE:');
      expect(userMessage.content).not.toContain('LINE:');
      expect(userMessage.content).not.toContain('STACK TRACE');
    });

    it('should handle bug with all optional fields undefined', async () => {
      const minimalBug: BugData = {
        id: 'BUG-MINIMAL',
        title: 'Minimal bug',
        description: 'A bug with no optional fields',
        status: 'open',
        severity: 'medium',
        component: 'Unknown',
        createdAt: '2026-01-19T00:00:00Z',
      };

      const minimalAnalysis: PatternAnalysisOutput = {
        patterns: [],
        categories: [{ name: 'Unknown', count: 1, percentage: 100, bugs: ['BUG-MINIMAL'] }],
        correlations: [],
        severityDistribution: { critical: 0, high: 0, medium: 1, low: 0 },
        trends: {
          totalBugs: 1,
          openBugs: 1,
          avgResolutionTime: 'N/A',
          hotspotComponents: [],
          recentSpike: false,
        },
        insights: ['Single bug with minimal information'],
        recommendations: ['Improve bug reporting to include more details'],
      };

      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(minimalAnalysis)));

      const result = await agent.analyzePatterns([minimalBug]);

      expect(result.data.trends.totalBugs).toBe(1);
      expect(result.data.categories[0].name).toBe('Unknown');

      const callArgs = mockCreate.mock.calls[0][0];
      const userMessage = callArgs.messages.find((m: { role: string }) => m.role === 'user');
      expect(userMessage.content).not.toContain('Labels:');
      expect(userMessage.content).not.toContain('Stack Trace:');
      expect(userMessage.content).not.toContain('Steps:');
      expect(userMessage.content).not.toContain('Environment:');
    });

    it('should handle code change without optional commit hash and files changed', async () => {
      const minimalChange: CodeChange = {
        file: 'src/index.ts',
        additions: 5,
        deletions: 2,
        author: 'dev@example.com',
        date: '2026-01-19T10:00:00Z',
        commitMessage: 'Minor update',
      };

      const minimalPrediction: BugPredictionOutput = {
        predictions: [
          {
            file: 'src/index.ts',
            riskScore: 20,
            riskLevel: 'low',
            reasons: ['Minor changes'],
            historicalBugCount: 0,
            recentChangeVelocity: 1,
            recommendations: [],
          },
        ],
        overallRisk: { score: 20, level: 'low', summary: 'Low risk' },
        hotspots: [],
        suggestedTestFocus: [],
        mitigationStrategies: [],
      };

      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(minimalPrediction)));

      const result = await agent.predictBugProne([minimalChange]);

      expect(result.data.overallRisk.level).toBe('low');

      const callArgs = mockCreate.mock.calls[0][0];
      const userMessage = callArgs.messages.find((m: { role: string }) => m.role === 'user');
      expect(userMessage.content).not.toContain('Commit:');
      expect(userMessage.content).not.toContain('Files Changed:');
    });
  });

  // ============================================================================
  // Integration-style Tests
  // ============================================================================

  describe('integration scenarios', () => {
    it('should analyze patterns and generate report for same bugs', async () => {
      const mockPatternAnalysis: PatternAnalysisOutput = {
        patterns: [{ id: 'PAT-001', name: 'Auth Pattern', description: 'Auth issues', frequency: 2, affectedComponents: ['Auth'], examples: ['BUG-001'], severity: 'high', trend: 'stable' }],
        categories: [],
        correlations: [],
        severityDistribution: { critical: 1, high: 1, medium: 0, low: 1 },
        trends: { totalBugs: 3, openBugs: 2, avgResolutionTime: '2 days', hotspotComponents: ['Auth'], recentSpike: false },
        insights: [],
        recommendations: [],
      };

      const mockReportOutput: BugReportOutput = {
        executiveSummary: { totalBugs: 3, openBugs: 2, criticalBugs: 1, avgAge: '2 days', healthScore: 70, healthStatus: 'warning', keyFindings: [] },
        charts: { severityBreakdown: [], statusBreakdown: [], componentBreakdown: [], trendOverTime: [], topAuthors: [] },
        topIssues: [],
        recommendations: [],
        reportDate: '2026-01-19T10:00:00Z',
      };

      mockCreate
        .mockResolvedValueOnce(createMockResponse(JSON.stringify(mockPatternAnalysis)))
        .mockResolvedValueOnce(createMockResponse(JSON.stringify(mockReportOutput)));

      const patternResult = await agent.analyzePatterns(mockBugs);
      const reportResult = await agent.generateReport(mockBugs);

      expect(patternResult.data.severityDistribution.critical).toBe(reportResult.data.executiveSummary.criticalBugs);
      expect(mockCreate).toHaveBeenCalledTimes(2);
    });

    it('should use root cause analysis to enhance predictions', async () => {
      const mockRootCause: RootCauseOutput = {
        rootCause: { type: 'code_defect', description: 'Auth bug', confidence: 90, evidence: [] },
        contributing_factors: [],
        suggestedFix: { description: 'Fix auth', steps: [], complexity: 'simple', estimatedEffort: '1h' },
        relatedBugs: [],
        preventionStrategies: [],
      };

      const mockPrediction: BugPredictionOutput = {
        predictions: [{ file: 'auth.ts', riskScore: 90, riskLevel: 'high', reasons: [], historicalBugCount: 5, recentChangeVelocity: 10, recommendations: [] }],
        overallRisk: { score: 90, level: 'high', summary: 'High risk' },
        hotspots: [],
        suggestedTestFocus: [],
        mitigationStrategies: [],
      };

      mockCreate
        .mockResolvedValueOnce(createMockResponse(JSON.stringify(mockRootCause)))
        .mockResolvedValueOnce(createMockResponse(JSON.stringify(mockPrediction)));

      const rootCauseResult = await agent.findRootCause(mockTestFailure, mockCodeChanges);
      const predictionResult = await agent.predictBugProne(mockCodeChanges, mockBugs);

      expect(rootCauseResult.data.rootCause.type).toBe('code_defect');
      expect(predictionResult.data.predictions[0].riskLevel).toBe('high');
      expect(mockCreate).toHaveBeenCalledTimes(2);
    });
  });
});

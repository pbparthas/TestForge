/**
 * Flaky Analysis Agent Unit Tests
 * Sprint 14: Tests for AI-powered flaky test root cause analysis
 */

import { describe, it, expect, beforeEach, vi, afterAll } from 'vitest';

// All mocks must be hoisted
const { mockCreate } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
}));

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: mockCreate,
    },
  })),
}));

import { FlakyAnalysisAgent } from '../../../src/agents/flakyanalysis.agent.js';
import type { ExecutionHistoryEntry } from '../../../src/agents/flakyanalysis.agent.js';

describe('FlakyAnalysisAgent', () => {
  let agent: FlakyAnalysisAgent;

  const mockUsage = {
    input_tokens: 1000,
    output_tokens: 500,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    agent = new FlakyAnalysisAgent();
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // ANALYZE ROOT CAUSE
  // ==========================================================================

  describe('analyzeRootCause', () => {
    const mockInput = {
      testName: 'Login Flow Test',
      testCode: `
        test('user can login', async ({ page }) => {
          await page.goto('/login');
          await page.fill('#username', 'testuser');
          await page.fill('#password', 'password');
          await page.click('button[type="submit"]');
          await expect(page).toHaveURL('/dashboard');
        });
      `,
      executionHistory: [
        {
          executionId: 'exec-1',
          timestamp: new Date('2026-01-20T10:00:00Z'),
          status: 'passed' as const,
          duration: 5000,
        },
        {
          executionId: 'exec-2',
          timestamp: new Date('2026-01-20T11:00:00Z'),
          status: 'failed' as const,
          duration: 30000,
          errorMessage: 'Timeout waiting for navigation',
        },
        {
          executionId: 'exec-3',
          timestamp: new Date('2026-01-20T12:00:00Z'),
          status: 'passed' as const,
          duration: 4500,
        },
      ] as ExecutionHistoryEntry[],
      flakinessScore: 67,
      recentErrors: ['Timeout waiting for navigation', 'Element not found: #username'],
    };

    const mockResponse = {
      primaryPattern: 'timing',
      confidence: 85,
      rootCauses: [
        {
          cause: 'Navigation timeout due to slow page load',
          confidence: 85,
          evidence: ['Timeout error in history', 'Failed test took 30s vs 5s for passed'],
          codeLocation: 'page.goto(\'/login\')',
        },
      ],
      suggestedFixes: [
        {
          description: 'Add explicit wait for page load',
          codeChange: 'await page.waitForLoadState(\'networkidle\');',
          priority: 'high',
          effort: 'minimal',
        },
      ],
      analysis: 'The test is flaky due to timing issues with navigation.',
      additionalPatterns: ['network'],
    };

    it('should analyze root cause successfully', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(mockResponse) }],
        usage: mockUsage,
      });

      const result = await agent.analyzeRootCause(mockInput);

      expect(result.data.primaryPattern).toBe('timing');
      expect(result.data.confidence).toBe(85);
      expect(result.data.rootCauses).toHaveLength(1);
      expect(result.data.suggestedFixes).toHaveLength(1);
      expect(result.usage.inputTokens).toBe(1000);
    });

    it('should handle JSON in code blocks', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: '```json\n' + JSON.stringify(mockResponse) + '\n```' }],
        usage: mockUsage,
      });

      const result = await agent.analyzeRootCause(mockInput);

      expect(result.data.primaryPattern).toBe('timing');
    });

    it('should retry on API failure', async () => {
      mockCreate
        .mockRejectedValueOnce(new Error('API error'))
        .mockResolvedValue({
          content: [{ type: 'text', text: JSON.stringify(mockResponse) }],
          usage: mockUsage,
        });

      const result = await agent.analyzeRootCause(mockInput);

      expect(result.data.primaryPattern).toBe('timing');
      expect(mockCreate).toHaveBeenCalledTimes(2);
    });

    it('should include all execution history in analysis', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(mockResponse) }],
        usage: mockUsage,
      });

      await agent.analyzeRootCause(mockInput);

      const callArgs = mockCreate.mock.calls[0]?.[0] as { messages: Array<{ content: string }> };
      const userMessage = callArgs.messages[0]?.content;
      // Check for status markers from execution history
      expect(userMessage).toContain('PASSED');
      expect(userMessage).toContain('FAILED');
      expect(userMessage).toContain('Timeout waiting for navigation');
    });
  });

  // ==========================================================================
  // DETECT PATTERNS
  // ==========================================================================

  describe('detectPatterns', () => {
    const mockInput = {
      projectId: 'project-123',
      flakyTests: [
        {
          testName: 'Login Test',
          flakinessScore: 75,
          totalRuns: 100,
          passRate: 75,
          recentErrors: ['Timeout'],
          lastPassAt: new Date('2026-01-20'),
          lastFailAt: new Date('2026-01-19'),
        },
        {
          testName: 'Checkout Test',
          flakinessScore: 60,
          totalRuns: 50,
          passRate: 80,
          recentErrors: ['Element not found'],
        },
      ],
    };

    const mockResponse = {
      patterns: [
        {
          patternType: 'timing',
          description: 'Tests timing out on navigation',
          severity: 'high',
          affectedTests: ['Login Test'],
          confidence: 80,
          suggestedFix: 'Add explicit waits',
        },
        {
          patternType: 'flaky_selector',
          description: 'Dynamic selectors causing element not found',
          severity: 'medium',
          affectedTests: ['Checkout Test'],
          confidence: 70,
          suggestedFix: 'Use data-testid attributes',
        },
      ],
      summary: {
        mostCommonPattern: 'timing',
        totalAffected: 2,
        recommendations: ['Add wait utilities', 'Stabilize selectors'],
      },
    };

    it('should detect patterns across tests', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(mockResponse) }],
        usage: mockUsage,
      });

      const result = await agent.detectPatterns(mockInput);

      expect(result.data.patterns).toHaveLength(2);
      expect(result.data.summary.mostCommonPattern).toBe('timing');
      expect(result.data.summary.totalAffected).toBe(2);
    });

    it('should include all test data in prompt', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(mockResponse) }],
        usage: mockUsage,
      });

      await agent.detectPatterns(mockInput);

      const callArgs = mockCreate.mock.calls[0]?.[0] as { messages: Array<{ content: string }> };
      const userMessage = callArgs.messages[0]?.content;
      expect(userMessage).toContain('Login Test');
      expect(userMessage).toContain('Checkout Test');
      expect(userMessage).toContain('75%');
    });
  });

  // ==========================================================================
  // GENERATE REPORT
  // ==========================================================================

  describe('generateReport', () => {
    const mockInput = {
      projectId: 'project-123',
      projectName: 'MyApp',
      flakyTests: [
        {
          testName: 'Login Test',
          flakinessScore: 75,
          patternType: 'timing' as const,
          isQuarantined: false,
          fixStatus: 'investigating',
        },
      ],
      patterns: [
        {
          patternType: 'timing' as const,
          description: 'Timing issues',
          affectedCount: 5,
        },
      ],
      trends: {
        totalFlaky: 10,
        newFlaky: 2,
        fixed: 3,
        quarantined: 2,
        avgScore: 65,
      },
    };

    const mockResponse = {
      summary: 'Project has 10 flaky tests with avg score 65%.',
      executiveSummary: 'Test stability needs attention.',
      keyFindings: ['Timing is the main issue', '5 tests affected by timing'],
      recommendations: [
        {
          priority: 1,
          action: 'Add wait utilities',
          impact: 'Fix 5 tests',
          effort: 'low',
        },
      ],
      detailedAnalysis: 'Detailed analysis text here.',
      nextSteps: ['Prioritize timing fixes', 'Review quarantined tests'],
    };

    it('should generate comprehensive report', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(mockResponse) }],
        usage: mockUsage,
      });

      const result = await agent.generateReport(mockInput);

      expect(result.data.summary).toContain('10 flaky tests');
      expect(result.data.keyFindings).toHaveLength(2);
      expect(result.data.recommendations).toHaveLength(1);
      expect(result.data.nextSteps).toHaveLength(2);
    });

    it('should include trends in report', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(mockResponse) }],
        usage: mockUsage,
      });

      await agent.generateReport(mockInput);

      const callArgs = mockCreate.mock.calls[0]?.[0] as { messages: Array<{ content: string }> };
      const userMessage = callArgs.messages[0]?.content;
      expect(userMessage).toContain('Total Flaky Tests: 10');
      expect(userMessage).toContain('New Flaky (this period): 2');
      expect(userMessage).toContain('Fixed: 3');
    });
  });

  // ==========================================================================
  // SUGGEST FIX
  // ==========================================================================

  describe('suggestFix', () => {
    const mockInput = {
      testName: 'Login Test',
      testCode: `
        test('login', async () => {
          await page.click('#login-btn');
          await expect(page).toHaveURL('/dashboard');
        });
      `,
      patternType: 'timing' as const,
      errorMessages: ['Timeout waiting for navigation'],
    };

    const mockResponse = {
      fixType: 'add explicit wait',
      description: 'Add waitForNavigation after click',
      codeChanges: [
        {
          location: 'line 3',
          original: "await page.click('#login-btn');",
          suggested: "await Promise.all([page.waitForNavigation(), page.click('#login-btn')]);",
          explanation: 'Wait for navigation to complete before asserting URL',
        },
      ],
      additionalRecommendations: ['Consider adding retry logic'],
      estimatedEffort: 'minimal',
      testingNotes: 'Run test 10 times to verify stability',
    };

    it('should suggest specific fixes', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(mockResponse) }],
        usage: mockUsage,
      });

      const result = await agent.suggestFix(mockInput);

      expect(result.data.fixType).toBe('add explicit wait');
      expect(result.data.codeChanges).toHaveLength(1);
      expect(result.data.estimatedEffort).toBe('minimal');
    });

    it('should include pattern type in prompt', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(mockResponse) }],
        usage: mockUsage,
      });

      await agent.suggestFix(mockInput);

      const callArgs = mockCreate.mock.calls[0]?.[0] as { messages: Array<{ content: string }> };
      const userMessage = callArgs.messages[0]?.content;
      expect(userMessage).toContain('IDENTIFIED PATTERN: timing');
    });
  });

  // ==========================================================================
  // CLASSIFY PATTERN
  // ==========================================================================

  describe('classifyPattern', () => {
    const mockResponse = {
      pattern: 'timing',
      confidence: 90,
      reasoning: 'Error message indicates timeout during navigation',
    };

    it('should classify pattern from errors', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(mockResponse) }],
        usage: mockUsage,
      });

      const result = await agent.classifyPattern(
        'Login Test',
        ['Timeout waiting for selector', 'Navigation timeout']
      );

      expect(result.data.pattern).toBe('timing');
      expect(result.data.confidence).toBe(90);
      expect(result.data.reasoning).toContain('timeout');
    });

    it('should handle network errors', async () => {
      const networkResponse = {
        pattern: 'network',
        confidence: 85,
        reasoning: 'Connection refused indicates network issue',
      };

      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(networkResponse) }],
        usage: mockUsage,
      });

      const result = await agent.classifyPattern(
        'API Test',
        ['Connection refused', 'ECONNRESET']
      );

      expect(result.data.pattern).toBe('network');
    });

    it('should handle selector errors', async () => {
      const selectorResponse = {
        pattern: 'flaky_selector',
        confidence: 80,
        reasoning: 'Element not found with dynamic ID',
      };

      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(selectorResponse) }],
        usage: mockUsage,
      });

      const result = await agent.classifyPattern(
        'UI Test',
        ['Element not found: #btn-123abc', 'Multiple elements match selector']
      );

      expect(result.data.pattern).toBe('flaky_selector');
    });
  });

  // ==========================================================================
  // ERROR HANDLING
  // ==========================================================================

  describe('error handling', () => {
    it('should throw after max retries', async () => {
      // Create agent with minimal retries for faster test
      const testAgent = new FlakyAnalysisAgent({ maxRetries: 2 });
      mockCreate.mockRejectedValue(new Error('API error'));

      await expect(
        testAgent.analyzeRootCause({
          testName: 'Test',
          testCode: 'code',
          executionHistory: [],
          flakinessScore: 50,
          recentErrors: [],
        })
      ).rejects.toThrow('API error');

      expect(mockCreate).toHaveBeenCalledTimes(2);
    }, 15000); // Increase timeout for retries with backoff

    it('should throw on invalid JSON response', async () => {
      // Create agent with minimal retries for faster test
      const testAgent = new FlakyAnalysisAgent({ maxRetries: 1 });
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'not valid json' }],
        usage: mockUsage,
      });

      await expect(
        testAgent.classifyPattern('Test', ['error'])
      ).rejects.toThrow('Failed to parse JSON');
    }, 10000);
  });

  // ==========================================================================
  // USAGE TRACKING
  // ==========================================================================

  describe('usage tracking', () => {
    it('should track token usage', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify({ pattern: 'timing', confidence: 90, reasoning: 'test' }) }],
        usage: {
          input_tokens: 500,
          output_tokens: 200,
        },
      });

      const result = await agent.classifyPattern('Test', ['error']);

      expect(result.usage.inputTokens).toBe(500);
      expect(result.usage.outputTokens).toBe(200);
      expect(result.usage.costUsd).toBeGreaterThan(0);
      expect(result.usage.costInr).toBeGreaterThan(0);
    });

    it('should include model in usage', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify({ pattern: 'timing', confidence: 90, reasoning: 'test' }) }],
        usage: mockUsage,
      });

      const result = await agent.classifyPattern('Test', ['error']);

      expect(result.usage.model).toBe('claude-sonnet-4-20250514');
    });
  });
});

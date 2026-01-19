/**
 * VisualAnalysis Agent Tests
 * Tests for visual regression testing and UI element detection
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
  VisualAnalysisAgent,
  CompareInput,
  CompareOutput,
  RegressionAnalysisInput,
  RegressionAnalysisOutput,
  DetectElementsInput,
  DetectElementsOutput,
  GenerateVisualTestCaseInput,
  GenerateVisualTestCaseOutput,
  ScreenshotInput,
  VisualDifference,
  DetectedElement,
} from '../../../src/agents/visualanalysis.agent.js';

describe('VisualAnalysisAgent', () => {
  let agent: VisualAnalysisAgent;

  // Sample screenshot input
  const mockScreenshot: ScreenshotInput = {
    base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    mediaType: 'image/png',
    metadata: {
      url: 'https://example.com/login',
      viewport: { width: 1920, height: 1080 },
      browser: 'Chrome',
    },
  };

  // Sample visual difference
  const mockDifference: VisualDifference = {
    id: 'diff-1',
    category: 'layout',
    severity: 'high',
    description: 'Button moved 20px to the right',
    baselineRegion: { x: 100, y: 200, width: 80, height: 40 },
    currentRegion: { x: 120, y: 200, width: 80, height: 40 },
    confidence: 0.95,
    suggestion: 'Check if layout change was intentional',
  };

  // Sample detected element
  const mockElement: DetectedElement = {
    type: 'button',
    boundingBox: { x: 100, y: 200, width: 80, height: 40 },
    confidence: 0.95,
    text: 'Submit',
    state: 'default',
    accessibility: {
      hasLabel: true,
      suggestedLabel: 'Submit form',
      role: 'button',
      issues: [],
    },
    suggestedSelector: "[data-testid='submit-btn']",
    suggestedAction: 'click',
  };

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
    agent = new VisualAnalysisAgent();
  });

  // ============================================================================
  // compare() Tests
  // ============================================================================

  describe('compare()', () => {
    const mockCompareOutput: CompareOutput = {
      match: false,
      similarityScore: 0.85,
      differences: [mockDifference],
      summary: {
        totalDifferences: 1,
        bySeverity: { critical: 0, high: 1, medium: 0, low: 0 },
        byCategory: { layout: 1 },
        criticalCount: 0,
      },
      recommendation: 'review',
      analysisNotes: 'One significant layout change detected in the button position.',
    };

    it('should compare two screenshots and detect differences', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockCompareOutput)));

      const input: CompareInput = {
        baseline: mockScreenshot,
        current: { ...mockScreenshot, base64: 'differentBase64Data' },
        context: 'Testing login page after CSS update',
      };

      const result = await agent.compare(input);

      expect(result.data.match).toBe(false);
      expect(result.data.similarityScore).toBe(0.85);
      expect(result.data.differences).toHaveLength(1);
      expect(result.data.differences[0].category).toBe('layout');
      expect(result.data.recommendation).toBe('review');
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it('should return match=true when images are identical', async () => {
      const identicalOutput: CompareOutput = {
        match: true,
        similarityScore: 1.0,
        differences: [],
        summary: {
          totalDifferences: 0,
          bySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
          byCategory: {},
          criticalCount: 0,
        },
        recommendation: 'pass',
        analysisNotes: 'Screenshots are identical. No visual differences detected.',
      };

      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(identicalOutput)));

      const input: CompareInput = {
        baseline: mockScreenshot,
        current: mockScreenshot,
      };

      const result = await agent.compare(input);

      expect(result.data.match).toBe(true);
      expect(result.data.similarityScore).toBe(1.0);
      expect(result.data.differences).toHaveLength(0);
      expect(result.data.recommendation).toBe('pass');
    });

    it('should respect ignore regions', async () => {
      const outputWithIgnored: CompareOutput = {
        match: true,
        similarityScore: 0.95,
        differences: [],
        summary: {
          totalDifferences: 0,
          bySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
          byCategory: {},
          criticalCount: 0,
        },
        recommendation: 'pass',
        analysisNotes: 'Differences in ignored regions were excluded from comparison.',
      };

      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(outputWithIgnored)));

      const input: CompareInput = {
        baseline: mockScreenshot,
        current: mockScreenshot,
        ignoreRegions: [
          {
            box: { x: 0, y: 0, width: 200, height: 50 },
            reason: 'Dynamic timestamp in header',
            type: 'timestamp',
          },
          {
            box: { x: 800, y: 200, width: 300, height: 250 },
            reason: 'Advertisement banner',
            type: 'ad',
          },
        ],
      };

      const result = await agent.compare(input);

      expect(result.data.match).toBe(true);
      expect(mockCreate).toHaveBeenCalledTimes(1);

      // Verify the API was called with content that includes ignore regions info
      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.messages).toBeDefined();
    });

    it('should handle missing images gracefully', async () => {
      // Create agent with maxRetries: 1 to avoid retry delays
      const noRetryAgent = new VisualAnalysisAgent({ maxRetries: 1 });

      const errorMessage = 'Invalid image data';
      mockCreate.mockRejectedValue(new Error(errorMessage));

      const input: CompareInput = {
        baseline: { ...mockScreenshot, base64: '' },
        current: mockScreenshot,
      };

      await expect(noRetryAgent.compare(input)).rejects.toThrow('Invalid image data');
    });

    it('should include sensitivity threshold in comparison', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockCompareOutput)));

      const input: CompareInput = {
        baseline: mockScreenshot,
        current: mockScreenshot,
        sensitivity: 0.3,
        categories: ['layout', 'color', 'typography'],
      };

      await agent.compare(input);

      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it('should include usage metrics in response', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockCompareOutput)));

      const input: CompareInput = {
        baseline: mockScreenshot,
        current: mockScreenshot,
      };

      const result = await agent.compare(input);

      expect(result.usage).toBeDefined();
      expect(result.usage.inputTokens).toBe(1000);
      expect(result.usage.outputTokens).toBe(500);
      expect(result.usage.model).toBeDefined();
      expect(result.usage.durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  // ============================================================================
  // analyzeRegression() Tests
  // ============================================================================

  describe('analyzeRegression()', () => {
    const mockRegressionOutput: RegressionAnalysisOutput = {
      type: 'regression',
      confidence: 0.85,
      reasoning: "The button color change doesn't align with any recent style updates in the PR description.",
      requiresHumanReview: true,
      suggestedAction: 'investigate',
      impact: {
        userExperience: 'minor',
        functionality: 'none',
        accessibility: 'minor',
      },
      relatedAreas: ['Header navigation', 'CTA buttons'],
    };

    it('should classify intentional changes', async () => {
      const intentionalOutput: RegressionAnalysisOutput = {
        type: 'intentional_change',
        confidence: 0.95,
        reasoning: 'The PR description explicitly mentions updating the button styling to match the new design system.',
        requiresHumanReview: false,
        suggestedAction: 'update_baseline',
        impact: {
          userExperience: 'none',
          functionality: 'none',
          accessibility: 'none',
        },
        relatedAreas: [],
      };

      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(intentionalOutput)));

      const input: RegressionAnalysisInput = {
        difference: mockDifference,
        baseline: mockScreenshot,
        current: mockScreenshot,
        changeContext: 'PR #123: Updated button styling to match new design system',
        recentChanges: ['Updated button CSS', 'Changed primary color'],
      };

      const result = await agent.analyzeRegression(input);

      expect(result.data.type).toBe('intentional_change');
      expect(result.data.confidence).toBe(0.95);
      expect(result.data.suggestedAction).toBe('update_baseline');
      expect(result.data.requiresHumanReview).toBe(false);
    });

    it('should detect regressions', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockRegressionOutput)));

      const input: RegressionAnalysisInput = {
        difference: mockDifference,
        baseline: mockScreenshot,
        current: mockScreenshot,
      };

      const result = await agent.analyzeRegression(input);

      expect(result.data.type).toBe('regression');
      expect(result.data.requiresHumanReview).toBe(true);
      expect(result.data.suggestedAction).toBe('investigate');
    });

    it('should assess impact correctly', async () => {
      const highImpactOutput: RegressionAnalysisOutput = {
        type: 'regression',
        confidence: 0.9,
        reasoning: 'Critical navigation element is missing, affecting all user flows.',
        requiresHumanReview: true,
        suggestedAction: 'reject',
        impact: {
          userExperience: 'major',
          functionality: 'major',
          accessibility: 'moderate',
        },
        relatedAreas: ['Navigation', 'User flows', 'Accessibility'],
      };

      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(highImpactOutput)));

      const input: RegressionAnalysisInput = {
        difference: {
          ...mockDifference,
          severity: 'critical',
          category: 'missing',
          description: 'Navigation menu is completely missing',
        },
        baseline: mockScreenshot,
        current: mockScreenshot,
      };

      const result = await agent.analyzeRegression(input);

      expect(result.data.impact.userExperience).toBe('major');
      expect(result.data.impact.functionality).toBe('major');
      expect(result.data.suggestedAction).toBe('reject');
    });

    it('should use change context for classification', async () => {
      const contextAwareOutput: RegressionAnalysisOutput = {
        type: 'environment_difference',
        confidence: 0.8,
        reasoning: 'The difference appears to be due to different font rendering between CI and local environments.',
        requiresHumanReview: false,
        suggestedAction: 'accept',
        impact: {
          userExperience: 'none',
          functionality: 'none',
          accessibility: 'none',
        },
        relatedAreas: [],
      };

      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(contextAwareOutput)));

      const input: RegressionAnalysisInput = {
        difference: mockDifference,
        baseline: mockScreenshot,
        current: mockScreenshot,
        changeContext: 'No code changes, running in CI environment',
        historicalContext: 'Similar font rendering differences observed in previous CI runs',
      };

      const result = await agent.analyzeRegression(input);

      expect(result.data.type).toBe('environment_difference');
      expect(result.data.confidence).toBe(0.8);
    });

    it('should handle timing issues', async () => {
      const timingOutput: RegressionAnalysisOutput = {
        type: 'timing_issue',
        confidence: 0.75,
        reasoning: 'The loading spinner was captured at different animation frames.',
        requiresHumanReview: false,
        suggestedAction: 'accept',
        impact: {
          userExperience: 'none',
          functionality: 'none',
          accessibility: 'none',
        },
        relatedAreas: ['Loading states'],
      };

      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(timingOutput)));

      const input: RegressionAnalysisInput = {
        difference: {
          ...mockDifference,
          category: 'content',
          description: 'Loading spinner position varies',
        },
        baseline: mockScreenshot,
        current: mockScreenshot,
      };

      const result = await agent.analyzeRegression(input);

      expect(result.data.type).toBe('timing_issue');
    });
  });

  // ============================================================================
  // detectElements() Tests
  // ============================================================================

  describe('detectElements()', () => {
    const mockDetectOutput: DetectElementsOutput = {
      elements: [mockElement],
      pageStructure: {
        hasHeader: true,
        hasFooter: true,
        hasNavigation: true,
        hasSidebar: false,
        mainContentArea: { x: 0, y: 80, width: 1200, height: 600 },
      },
      summary: {
        totalElements: 15,
        byType: { button: 3, input: 4, link: 8 },
        averageConfidence: 0.92,
        accessibilityIssues: 2,
      },
      pageDescription: 'Login page with email/password form and social login options',
    };

    it('should detect UI elements from screenshot', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockDetectOutput)));

      const input: DetectElementsInput = {
        screenshot: mockScreenshot,
        context: 'Login page of the application',
      };

      const result = await agent.detectElements(input);

      expect(result.data.elements).toBeDefined();
      expect(result.data.elements.length).toBeGreaterThan(0);
      expect(result.data.pageStructure).toBeDefined();
      expect(result.data.summary.totalElements).toBe(15);
      expect(result.data.pageDescription).toContain('Login');
    });

    it('should filter by element types', async () => {
      const filteredOutput: DetectElementsOutput = {
        elements: [mockElement],
        pageStructure: {
          hasHeader: true,
          hasFooter: true,
          hasNavigation: true,
          hasSidebar: false,
        },
        summary: {
          totalElements: 3,
          byType: { button: 3 },
          averageConfidence: 0.93,
          accessibilityIssues: 0,
        },
        pageDescription: 'Page containing 3 buttons',
      };

      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(filteredOutput)));

      const input: DetectElementsInput = {
        screenshot: mockScreenshot,
        elementTypes: ['button'],
      };

      const result = await agent.detectElements(input);

      expect(result.data.elements.every(el => el.type === 'button')).toBe(true);
      expect(result.data.summary.byType).toHaveProperty('button');
    });

    it('should respect minConfidence threshold', async () => {
      const highConfidenceOutput: DetectElementsOutput = {
        elements: [
          { ...mockElement, confidence: 0.95 },
          { ...mockElement, type: 'input', confidence: 0.92 },
        ],
        pageStructure: {
          hasHeader: true,
          hasFooter: false,
          hasNavigation: true,
          hasSidebar: false,
        },
        summary: {
          totalElements: 2,
          byType: { button: 1, input: 1 },
          averageConfidence: 0.935,
          accessibilityIssues: 0,
        },
        pageDescription: 'Page with high confidence elements only',
      };

      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(highConfidenceOutput)));

      const input: DetectElementsInput = {
        screenshot: mockScreenshot,
        minConfidence: 0.9,
      };

      const result = await agent.detectElements(input);

      expect(result.data.elements.every(el => el.confidence >= 0.9)).toBe(true);
      expect(result.data.summary.averageConfidence).toBeGreaterThanOrEqual(0.9);
    });

    it('should provide page structure analysis', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockDetectOutput)));

      const input: DetectElementsInput = {
        screenshot: mockScreenshot,
      };

      const result = await agent.detectElements(input);

      expect(result.data.pageStructure.hasHeader).toBe(true);
      expect(result.data.pageStructure.hasFooter).toBe(true);
      expect(result.data.pageStructure.hasNavigation).toBe(true);
      expect(result.data.pageStructure.mainContentArea).toBeDefined();
    });

    it('should detect nested elements when requested', async () => {
      const nestedOutput: DetectElementsOutput = {
        elements: [
          {
            ...mockElement,
            type: 'form',
            children: [
              { ...mockElement, type: 'input' },
              { ...mockElement, type: 'button' },
            ],
          },
        ],
        pageStructure: {
          hasHeader: true,
          hasFooter: true,
          hasNavigation: true,
          hasSidebar: false,
        },
        summary: {
          totalElements: 3,
          byType: { form: 1, input: 1, button: 1 },
          averageConfidence: 0.9,
          accessibilityIssues: 0,
        },
        pageDescription: 'Form with nested input and button elements',
      };

      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(nestedOutput)));

      const input: DetectElementsInput = {
        screenshot: mockScreenshot,
        detectNested: true,
      };

      const result = await agent.detectElements(input);

      const formElement = result.data.elements.find(el => el.type === 'form');
      expect(formElement).toBeDefined();
      expect(formElement?.children).toBeDefined();
      expect(formElement?.children?.length).toBeGreaterThan(0);
    });

    it('should include accessibility information', async () => {
      const accessibilityOutput: DetectElementsOutput = {
        elements: [
          {
            ...mockElement,
            accessibility: {
              hasLabel: false,
              suggestedLabel: 'Submit form button',
              role: 'button',
              issues: ['Missing aria-label', 'No visible text for screen readers'],
            },
          },
        ],
        pageStructure: {
          hasHeader: true,
          hasFooter: true,
          hasNavigation: true,
          hasSidebar: false,
        },
        summary: {
          totalElements: 1,
          byType: { button: 1 },
          averageConfidence: 0.95,
          accessibilityIssues: 2,
        },
        pageDescription: 'Page with accessibility issues',
      };

      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(accessibilityOutput)));

      const input: DetectElementsInput = {
        screenshot: mockScreenshot,
      };

      const result = await agent.detectElements(input);

      const element = result.data.elements[0];
      expect(element.accessibility).toBeDefined();
      expect(element.accessibility?.issues).toBeDefined();
      expect(element.accessibility?.issues?.length).toBeGreaterThan(0);
      expect(result.data.summary.accessibilityIssues).toBe(2);
    });
  });

  // ============================================================================
  // generateVisualTestCase() Tests
  // ============================================================================

  describe('generateVisualTestCase()', () => {
    const mockGenerateOutput: GenerateVisualTestCaseOutput = {
      testCases: [
        {
          title: 'Verify login form visual layout',
          description: 'Ensures the login form elements are properly positioned and styled',
          preconditions: 'User is on the login page, not authenticated',
          steps: [
            {
              order: 1,
              action: 'Navigate to login page',
              target: '/login',
              visualAssertions: [
                {
                  type: 'exists',
                  target: { selector: "[data-testid='login-form']" },
                  expected: 'Login form is visible',
                },
              ],
              waitCondition: 'networkIdle',
            },
          ],
          expectedVisualState: 'Clean login form with email, password fields and submit button',
          priority: 'high',
          type: 'visual',
          tags: ['login', 'form', 'visual'],
          baselineRegions: [
            {
              name: 'login-form',
              region: { x: 400, y: 200, width: 400, height: 300 },
              tolerance: 0.02,
            },
          ],
          viewports: [
            { width: 1920, height: 1080, name: 'desktop' },
            { width: 375, height: 667, name: 'mobile' },
          ],
        },
      ],
      summary: {
        total: 1,
        byPriority: { high: 1 },
        byType: { visual: 1 },
        totalAssertions: 1,
      },
      baselineConfig: {
        captureFullPage: false,
        regions: [{ name: 'main-content', selector: 'main', tolerance: 0.02 }],
        ignoreRegions: [{ reason: 'Dynamic timestamp', selector: '.timestamp' }],
      },
    };

    it('should generate visual test cases from screenshot', async () => {
      // First call for detectElements (auto-detection), second for generateVisualTestCase
      mockCreate
        .mockResolvedValueOnce(createMockResponse(JSON.stringify({
          elements: [mockElement],
          pageStructure: { hasHeader: true, hasFooter: true, hasNavigation: true, hasSidebar: false },
          summary: { totalElements: 1, byType: { button: 1 }, averageConfidence: 0.95, accessibilityIssues: 0 },
          pageDescription: 'Test page',
        })))
        .mockResolvedValueOnce(createMockResponse(JSON.stringify(mockGenerateOutput)));

      const input: GenerateVisualTestCaseInput = {
        screenshot: mockScreenshot,
        feature: 'Login form',
        focusAreas: ['form validation', 'button states'],
        maxTestCases: 5,
      };

      const result = await agent.generateVisualTestCase(input);

      expect(result.data.testCases).toBeDefined();
      expect(result.data.testCases.length).toBeGreaterThan(0);
      expect(result.data.summary.total).toBeGreaterThan(0);
    });

    it('should auto-detect elements if not provided', async () => {
      const detectOutput: DetectElementsOutput = {
        elements: [mockElement, { ...mockElement, type: 'input', text: 'Email' }],
        pageStructure: { hasHeader: true, hasFooter: true, hasNavigation: true, hasSidebar: false },
        summary: { totalElements: 2, byType: { button: 1, input: 1 }, averageConfidence: 0.93, accessibilityIssues: 0 },
        pageDescription: 'Login form with input and button',
      };

      mockCreate
        .mockResolvedValueOnce(createMockResponse(JSON.stringify(detectOutput)))
        .mockResolvedValueOnce(createMockResponse(JSON.stringify(mockGenerateOutput)));

      const input: GenerateVisualTestCaseInput = {
        screenshot: mockScreenshot,
        // No elements provided - should auto-detect
      };

      const result = await agent.generateVisualTestCase(input);

      // Should have called API twice: once for detection, once for generation
      expect(mockCreate).toHaveBeenCalledTimes(2);
      expect(result.data.testCases).toBeDefined();
    });

    it('should use provided elements without auto-detection', async () => {
      mockCreate.mockResolvedValueOnce(createMockResponse(JSON.stringify(mockGenerateOutput)));

      const input: GenerateVisualTestCaseInput = {
        screenshot: mockScreenshot,
        elements: [mockElement], // Elements provided
        feature: 'Button component',
      };

      const result = await agent.generateVisualTestCase(input);

      // Should have called API only once (no detection needed)
      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(result.data.testCases).toBeDefined();
    });

    it('should include responsive viewports when requested', async () => {
      const responsiveOutput: GenerateVisualTestCaseOutput = {
        ...mockGenerateOutput,
        testCases: [
          {
            ...mockGenerateOutput.testCases[0],
            type: 'responsive',
            viewports: [
              { width: 1920, height: 1080, name: 'desktop' },
              { width: 1024, height: 768, name: 'tablet' },
              { width: 375, height: 667, name: 'mobile' },
            ],
          },
        ],
        summary: {
          ...mockGenerateOutput.summary,
          byType: { responsive: 1 },
        },
      };

      mockCreate
        .mockResolvedValueOnce(createMockResponse(JSON.stringify({
          elements: [mockElement],
          pageStructure: { hasHeader: true, hasFooter: true, hasNavigation: true, hasSidebar: false },
          summary: { totalElements: 1, byType: { button: 1 }, averageConfidence: 0.95, accessibilityIssues: 0 },
          pageDescription: 'Test page',
        })))
        .mockResolvedValueOnce(createMockResponse(JSON.stringify(responsiveOutput)));

      const input: GenerateVisualTestCaseInput = {
        screenshot: mockScreenshot,
        includeResponsive: true,
        testTypes: ['responsive'],
      };

      const result = await agent.generateVisualTestCase(input);

      expect(result.data.testCases[0].viewports).toBeDefined();
      expect(result.data.testCases[0].viewports?.length).toBeGreaterThanOrEqual(2);
      expect(result.data.testCases[0].type).toBe('responsive');
    });

    it('should create baseline regions', async () => {
      mockCreate
        .mockResolvedValueOnce(createMockResponse(JSON.stringify({
          elements: [mockElement],
          pageStructure: { hasHeader: true, hasFooter: true, hasNavigation: true, hasSidebar: false },
          summary: { totalElements: 1, byType: { button: 1 }, averageConfidence: 0.95, accessibilityIssues: 0 },
          pageDescription: 'Test page',
        })))
        .mockResolvedValueOnce(createMockResponse(JSON.stringify(mockGenerateOutput)));

      const input: GenerateVisualTestCaseInput = {
        screenshot: mockScreenshot,
        feature: 'Login form',
      };

      const result = await agent.generateVisualTestCase(input);

      expect(result.data.testCases[0].baselineRegions).toBeDefined();
      expect(result.data.testCases[0].baselineRegions?.length).toBeGreaterThan(0);
      expect(result.data.testCases[0].baselineRegions?.[0]).toHaveProperty('name');
      expect(result.data.testCases[0].baselineRegions?.[0]).toHaveProperty('region');
      expect(result.data.testCases[0].baselineRegions?.[0]).toHaveProperty('tolerance');
    });

    it('should include baseline config with ignore regions', async () => {
      mockCreate
        .mockResolvedValueOnce(createMockResponse(JSON.stringify({
          elements: [mockElement],
          pageStructure: { hasHeader: true, hasFooter: true, hasNavigation: true, hasSidebar: false },
          summary: { totalElements: 1, byType: { button: 1 }, averageConfidence: 0.95, accessibilityIssues: 0 },
          pageDescription: 'Test page',
        })))
        .mockResolvedValueOnce(createMockResponse(JSON.stringify(mockGenerateOutput)));

      const input: GenerateVisualTestCaseInput = {
        screenshot: mockScreenshot,
      };

      const result = await agent.generateVisualTestCase(input);

      expect(result.data.baselineConfig).toBeDefined();
      expect(result.data.baselineConfig.ignoreRegions).toBeDefined();
      expect(result.data.baselineConfig.regions).toBeDefined();
    });

    it('should respect maxTestCases limit', async () => {
      const limitedOutput: GenerateVisualTestCaseOutput = {
        ...mockGenerateOutput,
        testCases: [mockGenerateOutput.testCases[0], mockGenerateOutput.testCases[0]],
        summary: { ...mockGenerateOutput.summary, total: 2 },
      };

      mockCreate
        .mockResolvedValueOnce(createMockResponse(JSON.stringify({
          elements: [mockElement],
          pageStructure: { hasHeader: true, hasFooter: true, hasNavigation: true, hasSidebar: false },
          summary: { totalElements: 1, byType: { button: 1 }, averageConfidence: 0.95, accessibilityIssues: 0 },
          pageDescription: 'Test page',
        })))
        .mockResolvedValueOnce(createMockResponse(JSON.stringify(limitedOutput)));

      const input: GenerateVisualTestCaseInput = {
        screenshot: mockScreenshot,
        maxTestCases: 2,
      };

      const result = await agent.generateVisualTestCase(input);

      expect(result.data.testCases.length).toBeLessThanOrEqual(2);
    });

    it('should filter by test types', async () => {
      const layoutOnlyOutput: GenerateVisualTestCaseOutput = {
        ...mockGenerateOutput,
        testCases: [{ ...mockGenerateOutput.testCases[0], type: 'layout' }],
        summary: { ...mockGenerateOutput.summary, byType: { layout: 1 } },
      };

      mockCreate
        .mockResolvedValueOnce(createMockResponse(JSON.stringify({
          elements: [mockElement],
          pageStructure: { hasHeader: true, hasFooter: true, hasNavigation: true, hasSidebar: false },
          summary: { totalElements: 1, byType: { button: 1 }, averageConfidence: 0.95, accessibilityIssues: 0 },
          pageDescription: 'Test page',
        })))
        .mockResolvedValueOnce(createMockResponse(JSON.stringify(layoutOnlyOutput)));

      const input: GenerateVisualTestCaseInput = {
        screenshot: mockScreenshot,
        testTypes: ['layout'],
      };

      const result = await agent.generateVisualTestCase(input);

      expect(result.data.testCases.every(tc => tc.type === 'layout')).toBe(true);
    });
  });

  // ============================================================================
  // Error Handling and Edge Cases
  // ============================================================================

  describe('error handling', () => {
    it('should retry on transient failures', async () => {
      // Create agent with maxRetries: 2 and mock the delay function
      const retryAgent = new VisualAnalysisAgent({ maxRetries: 2 });

      // Mock the delay method to return immediately
      // Access the protected delay method via prototype
      const delaySpy = vi.spyOn(retryAgent as unknown as { delay: (ms: number) => Promise<void> }, 'delay')
        .mockResolvedValue(undefined);

      mockCreate
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(createMockResponse(JSON.stringify({
          match: true,
          similarityScore: 1.0,
          differences: [],
          summary: { totalDifferences: 0, bySeverity: { critical: 0, high: 0, medium: 0, low: 0 }, byCategory: {}, criticalCount: 0 },
          recommendation: 'pass',
          analysisNotes: 'Identical',
        })));

      const input: CompareInput = {
        baseline: mockScreenshot,
        current: mockScreenshot,
      };

      const result = await retryAgent.compare(input);

      expect(result.data.match).toBe(true);
      expect(mockCreate).toHaveBeenCalledTimes(2);
      expect(delaySpy).toHaveBeenCalledTimes(1);

      delaySpy.mockRestore();
    });

    it('should fail after max retries', async () => {
      // Create agent with maxRetries: 3
      const retryAgent = new VisualAnalysisAgent({ maxRetries: 3 });

      // Mock the delay method to return immediately
      const delaySpy = vi.spyOn(retryAgent as unknown as { delay: (ms: number) => Promise<void> }, 'delay')
        .mockResolvedValue(undefined);

      mockCreate.mockRejectedValue(new Error('Persistent error'));

      const input: CompareInput = {
        baseline: mockScreenshot,
        current: mockScreenshot,
      };

      await expect(retryAgent.compare(input)).rejects.toThrow('Persistent error');
      expect(mockCreate).toHaveBeenCalledTimes(3);
      expect(delaySpy).toHaveBeenCalledTimes(2); // Called between attempts (3 attempts = 2 delays)

      delaySpy.mockRestore();
    });

    it('should handle malformed JSON response', async () => {
      // Create agent with maxRetries: 1 to test single parse failure
      const noRetryAgent = new VisualAnalysisAgent({ maxRetries: 1 });

      mockCreate.mockResolvedValue(createMockResponse('This is not valid JSON'));

      const input: DetectElementsInput = {
        screenshot: mockScreenshot,
      };

      await expect(noRetryAgent.detectElements(input)).rejects.toThrow('Failed to parse JSON response');
    });

    it('should handle JSON wrapped in markdown code blocks', async () => {
      const wrappedJson = '```json\n' + JSON.stringify({
        match: true,
        similarityScore: 1.0,
        differences: [],
        summary: { totalDifferences: 0, bySeverity: { critical: 0, high: 0, medium: 0, low: 0 }, byCategory: {}, criticalCount: 0 },
        recommendation: 'pass',
        analysisNotes: 'Identical',
      }) + '\n```';

      mockCreate.mockResolvedValue(createMockResponse(wrappedJson));

      const input: CompareInput = {
        baseline: mockScreenshot,
        current: mockScreenshot,
      };

      const result = await agent.compare(input);

      expect(result.data.match).toBe(true);
    });
  });

  // ============================================================================
  // Sprint 9 Edge Cases
  // ============================================================================

  describe('edge cases', () => {
    it('should handle images with different viewport dimensions', async () => {
      const compareOutput: CompareOutput = {
        match: false,
        similarityScore: 0.7,
        differences: [
          {
            id: 'diff-dimension',
            category: 'size',
            severity: 'high',
            description: 'Viewport dimensions differ between screenshots',
            confidence: 1.0,
          },
        ],
        summary: {
          totalDifferences: 1,
          bySeverity: { critical: 0, high: 1, medium: 0, low: 0 },
          byCategory: { size: 1 },
          criticalCount: 0,
        },
        recommendation: 'review',
        analysisNotes: 'Screenshots have different viewport sizes which may affect comparison.',
      };

      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(compareOutput)));

      const baselineWithDifferentDimensions: ScreenshotInput = {
        ...mockScreenshot,
        metadata: {
          url: 'https://example.com/page',
          viewport: { width: 1920, height: 1080 },
        },
      };

      const currentWithDifferentDimensions: ScreenshotInput = {
        ...mockScreenshot,
        metadata: {
          url: 'https://example.com/page',
          viewport: { width: 1366, height: 768 },
        },
      };

      const input: CompareInput = {
        baseline: baselineWithDifferentDimensions,
        current: currentWithDifferentDimensions,
        context: 'Comparing screenshots with different viewport dimensions',
      };

      const result = await agent.compare(input);

      expect(result.data.match).toBe(false);
      expect(result.data.differences).toHaveLength(1);
      expect(result.data.differences[0].category).toBe('size');
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it('should handle empty ignore regions array', async () => {
      const outputWithEmptyIgnore: CompareOutput = {
        match: true,
        similarityScore: 1.0,
        differences: [],
        summary: {
          totalDifferences: 0,
          bySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
          byCategory: {},
          criticalCount: 0,
        },
        recommendation: 'pass',
        analysisNotes: 'No differences detected. Empty ignore regions array was provided.',
      };

      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(outputWithEmptyIgnore)));

      const input: CompareInput = {
        baseline: mockScreenshot,
        current: mockScreenshot,
        ignoreRegions: [], // Explicitly empty array
      };

      const result = await agent.compare(input);

      expect(result.data.match).toBe(true);
      expect(result.data.differences).toHaveLength(0);
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it('should handle zero confidence threshold (minConfidence: 0)', async () => {
      const allElementsOutput: DetectElementsOutput = {
        elements: [
          { ...mockElement, confidence: 0.1, type: 'text' },
          { ...mockElement, confidence: 0.05, type: 'container' },
          { ...mockElement, confidence: 0.95, type: 'button' },
        ],
        pageStructure: {
          hasHeader: true,
          hasFooter: true,
          hasNavigation: false,
          hasSidebar: false,
        },
        summary: {
          totalElements: 3,
          byType: { text: 1, container: 1, button: 1 },
          averageConfidence: 0.367,
          accessibilityIssues: 0,
        },
        pageDescription: 'Page with elements of varying confidence levels',
      };

      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(allElementsOutput)));

      const input: DetectElementsInput = {
        screenshot: mockScreenshot,
        minConfidence: 0, // Zero threshold - should include all elements
      };

      const result = await agent.detectElements(input);

      expect(result.data.elements).toHaveLength(3);
      expect(result.data.elements.some(el => el.confidence < 0.5)).toBe(true);
      expect(result.data.summary.averageConfidence).toBeLessThan(0.5);
    });

    it('should handle no elements detected scenario', async () => {
      const noElementsOutput: DetectElementsOutput = {
        elements: [],
        pageStructure: {
          hasHeader: false,
          hasFooter: false,
          hasNavigation: false,
          hasSidebar: false,
        },
        summary: {
          totalElements: 0,
          byType: {},
          averageConfidence: 0,
          accessibilityIssues: 0,
        },
        pageDescription: 'Blank page or image with no detectable UI elements',
      };

      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(noElementsOutput)));

      const input: DetectElementsInput = {
        screenshot: mockScreenshot,
        context: 'Blank page screenshot',
      };

      const result = await agent.detectElements(input);

      expect(result.data.elements).toHaveLength(0);
      expect(result.data.summary.totalElements).toBe(0);
      expect(result.data.summary.byType).toEqual({});
      expect(result.data.pageStructure.hasHeader).toBe(false);
    });

    it('should handle deeply nested element detection', async () => {
      const deeplyNestedOutput: DetectElementsOutput = {
        elements: [
          {
            ...mockElement,
            type: 'container',
            children: [
              {
                ...mockElement,
                type: 'form',
                children: [
                  {
                    ...mockElement,
                    type: 'container',
                    children: [
                      { ...mockElement, type: 'input' },
                      { ...mockElement, type: 'button' },
                    ],
                  },
                ],
              },
            ],
          },
        ],
        pageStructure: {
          hasHeader: true,
          hasFooter: true,
          hasNavigation: true,
          hasSidebar: false,
        },
        summary: {
          totalElements: 5,
          byType: { container: 2, form: 1, input: 1, button: 1 },
          averageConfidence: 0.95,
          accessibilityIssues: 0,
        },
        pageDescription: 'Page with deeply nested form elements',
      };

      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(deeplyNestedOutput)));

      const input: DetectElementsInput = {
        screenshot: mockScreenshot,
        detectNested: true,
      };

      const result = await agent.detectElements(input);

      // Check root element has children
      expect(result.data.elements[0].children).toBeDefined();
      expect(result.data.elements[0].children?.length).toBeGreaterThan(0);

      // Check nested children exist (form inside container)
      const form = result.data.elements[0].children?.[0];
      expect(form?.type).toBe('form');
      expect(form?.children).toBeDefined();

      // Check deeply nested children (container inside form)
      const innerContainer = form?.children?.[0];
      expect(innerContainer?.type).toBe('container');
      expect(innerContainer?.children?.length).toBe(2);
    });

    it('should generate test cases when no elements are pre-detected', async () => {
      // First call returns empty elements, second generates test cases anyway
      const emptyDetectionOutput: DetectElementsOutput = {
        elements: [],
        pageStructure: {
          hasHeader: true,
          hasFooter: true,
          hasNavigation: false,
          hasSidebar: false,
        },
        summary: {
          totalElements: 0,
          byType: {},
          averageConfidence: 0,
          accessibilityIssues: 0,
        },
        pageDescription: 'Page with minimal elements',
      };

      const generateOutput: GenerateVisualTestCaseOutput = {
        testCases: [
          {
            title: 'Verify page structure',
            description: 'Basic page structure verification',
            preconditions: 'Page is loaded',
            steps: [
              {
                order: 1,
                action: 'Navigate to page',
                visualAssertions: [
                  {
                    type: 'exists',
                    target: { selector: 'body' },
                    expected: 'Page body is visible',
                  },
                ],
              },
            ],
            expectedVisualState: 'Page loads with header and footer',
            priority: 'medium',
            type: 'visual',
            tags: ['structure'],
          },
        ],
        summary: {
          total: 1,
          byPriority: { medium: 1 },
          byType: { visual: 1 },
          totalAssertions: 1,
        },
        baselineConfig: {
          captureFullPage: true,
          regions: [],
          ignoreRegions: [],
        },
      };

      mockCreate
        .mockResolvedValueOnce(createMockResponse(JSON.stringify(emptyDetectionOutput)))
        .mockResolvedValueOnce(createMockResponse(JSON.stringify(generateOutput)));

      const input: GenerateVisualTestCaseInput = {
        screenshot: mockScreenshot,
        feature: 'Basic page',
      };

      const result = await agent.generateVisualTestCase(input);

      expect(mockCreate).toHaveBeenCalledTimes(2); // Detection + Generation
      expect(result.data.testCases).toHaveLength(1);
      expect(result.data.summary.total).toBe(1);
    });
  });

  // ============================================================================
  // Configuration Tests
  // ============================================================================

  describe('configuration', () => {
    it('should use default configuration', () => {
      const defaultAgent = new VisualAnalysisAgent();
      expect(defaultAgent).toBeDefined();
    });

    it('should accept custom configuration', () => {
      const customAgent = new VisualAnalysisAgent({
        model: 'claude-3-5-haiku-20241022',
        maxTokens: 8192,
        temperature: 0.5,
        maxRetries: 5,
      });
      expect(customAgent).toBeDefined();
    });
  });
});

/**
 * Visual Analysis Routes Integration Tests
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

describe('Visual Analysis Routes Integration', () => {
  const adminToken = 'admin_test_token';
  const userToken = 'user_test_token';
  const projectId = '11111111-1111-1111-1111-111111111111';

  // Valid base64 PNG for testing (minimum 100 chars)
  const validBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==AAAAAAAAAAAAAAAA';

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
  // POST /api/visual/compare - Compare two screenshots
  // ==========================================================================
  describe('POST /api/visual/compare', () => {
    const mockCompareOutput = {
      match: false,
      similarityScore: 0.85,
      differences: [
        {
          id: 'diff-1',
          category: 'layout',
          severity: 'high',
          description: 'Button moved 20px to the right',
          baselineRegion: { x: 100, y: 200, width: 80, height: 40 },
          currentRegion: { x: 120, y: 200, width: 80, height: 40 },
          confidence: 0.95,
          suggestion: 'Check if layout change was intentional',
        },
      ],
      summary: {
        totalDifferences: 1,
        bySeverity: { critical: 0, high: 1, medium: 0, low: 0 },
        byCategory: { layout: 1 },
        criticalCount: 0,
      },
      recommendation: 'review',
      analysisNotes: 'One significant layout change detected in the button position.',
    };

    it('should compare two screenshots and return differences', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(mockCompareOutput) }],
        usage: { input_tokens: 1000, output_tokens: 500 },
      });

      const res = await request(app)
        .post('/api/visual/compare')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          baseline: {
            base64: validBase64,
            mediaType: 'image/png',
            metadata: { url: 'https://example.com/page', viewport: { width: 1920, height: 1080 } },
          },
          current: {
            base64: validBase64,
            mediaType: 'image/png',
            metadata: { url: 'https://example.com/page', viewport: { width: 1920, height: 1080 } },
          },
          sensitivity: 0.3,
          context: 'Comparing homepage before and after CSS update',
        });

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.match).toBe(false);
      expect(res.body.data.similarityScore).toBe(0.85);
      expect(res.body.data.differences).toHaveLength(1);
      expect(res.body.data.differences[0].category).toBe('layout');
      expect(res.body.data.recommendation).toBe('review');
    });

    it('should compare with ignore regions', async () => {
      const matchOutput = { ...mockCompareOutput, match: true, differences: [], summary: { ...mockCompareOutput.summary, totalDifferences: 0 } };
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(matchOutput) }],
        usage: { input_tokens: 1000, output_tokens: 400 },
      });

      const res = await request(app)
        .post('/api/visual/compare')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          baseline: { base64: validBase64, mediaType: 'image/png' },
          current: { base64: validBase64, mediaType: 'image/png' },
          ignoreRegions: [
            {
              box: { x: 0, y: 0, width: 100, height: 50 },
              reason: 'Dynamic timestamp area',
              type: 'timestamp',
            },
            {
              box: { x: 200, y: 300, width: 300, height: 250 },
              reason: 'Advertisement banner',
              type: 'ad',
            },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.data.match).toBe(true);
    });

    it('should return 400 when baseline is missing', async () => {
      const res = await request(app)
        .post('/api/visual/compare')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          current: { base64: validBase64, mediaType: 'image/png' },
        });

      expect(res.status).toBe(400);
    });

    it('should return 400 when current is missing', async () => {
      const res = await request(app)
        .post('/api/visual/compare')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          baseline: { base64: validBase64, mediaType: 'image/png' },
        });

      expect(res.status).toBe(400);
    });

    it('should return 400 when base64 is too short', async () => {
      const res = await request(app)
        .post('/api/visual/compare')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          baseline: { base64: 'short', mediaType: 'image/png' },
          current: { base64: validBase64, mediaType: 'image/png' },
        });

      expect(res.status).toBe(400);
    });

    it('should return 400 when mediaType is invalid', async () => {
      const res = await request(app)
        .post('/api/visual/compare')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          baseline: { base64: validBase64, mediaType: 'image/bmp' },
          current: { base64: validBase64, mediaType: 'image/png' },
        });

      expect(res.status).toBe(400);
    });

    it('should return 401 when no auth token provided', async () => {
      const res = await request(app)
        .post('/api/visual/compare')
        .send({
          baseline: { base64: validBase64, mediaType: 'image/png' },
          current: { base64: validBase64, mediaType: 'image/png' },
        });

      expect(res.status).toBe(401);
    });

    it('should return 401 when invalid token provided', async () => {
      const res = await request(app)
        .post('/api/visual/compare')
        .set('Authorization', 'Bearer invalid_token')
        .send({
          baseline: { base64: validBase64, mediaType: 'image/png' },
          current: { base64: validBase64, mediaType: 'image/png' },
        });

      expect(res.status).toBe(401);
    });
  });

  // ==========================================================================
  // POST /api/visual/analyze-regression - Analyze if difference is regression
  // ==========================================================================
  describe('POST /api/visual/analyze-regression', () => {
    const mockRegressionOutput = {
      type: 'regression',
      confidence: 0.85,
      reasoning: 'The button color change does not align with any recent style updates in the provided context.',
      requiresHumanReview: true,
      suggestedAction: 'investigate',
      impact: {
        userExperience: 'minor',
        functionality: 'none',
        accessibility: 'minor',
      },
      relatedAreas: ['Header navigation', 'CTA buttons'],
    };

    it('should analyze a visual difference for regression', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(mockRegressionOutput) }],
        usage: { input_tokens: 1200, output_tokens: 400 },
      });

      const res = await request(app)
        .post('/api/visual/analyze-regression')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          difference: {
            id: 'diff-1',
            category: 'color',
            severity: 'medium',
            description: 'Button background changed from blue to green',
            baselineRegion: { x: 100, y: 200, width: 120, height: 40 },
            currentRegion: { x: 100, y: 200, width: 120, height: 40 },
            confidence: 0.92,
          },
          baseline: { base64: validBase64, mediaType: 'image/png' },
          current: { base64: validBase64, mediaType: 'image/png' },
          changeContext: 'PR #123: Updated navigation styles',
          recentChanges: [
            'Added new nav component',
            'Fixed responsive layout bug',
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.type).toBe('regression');
      expect(res.body.data.confidence).toBe(0.85);
      expect(res.body.data.requiresHumanReview).toBe(true);
      expect(res.body.data.suggestedAction).toBe('investigate');
      expect(res.body.data.impact.userExperience).toBe('minor');
    });

    it('should identify intentional changes', async () => {
      const intentionalOutput = {
        ...mockRegressionOutput,
        type: 'intentional_change',
        confidence: 0.95,
        reasoning: 'The color change matches the PR description for brand color update.',
        requiresHumanReview: false,
        suggestedAction: 'update_baseline',
      };
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(intentionalOutput) }],
        usage: { input_tokens: 1200, output_tokens: 400 },
      });

      const res = await request(app)
        .post('/api/visual/analyze-regression')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          difference: {
            id: 'diff-2',
            category: 'color',
            severity: 'low',
            description: 'Brand color updated from #blue to #newblue',
            confidence: 0.9,
          },
          baseline: { base64: validBase64, mediaType: 'image/png' },
          current: { base64: validBase64, mediaType: 'image/png' },
          changeContext: 'Brand color refresh - updating primary color',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.type).toBe('intentional_change');
      expect(res.body.data.suggestedAction).toBe('update_baseline');
    });

    it('should return 400 when difference object is missing', async () => {
      const res = await request(app)
        .post('/api/visual/analyze-regression')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          baseline: { base64: validBase64, mediaType: 'image/png' },
          current: { base64: validBase64, mediaType: 'image/png' },
        });

      expect(res.status).toBe(400);
    });

    it('should return 400 when baseline screenshot is missing', async () => {
      const res = await request(app)
        .post('/api/visual/analyze-regression')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          difference: { id: 'diff-1', category: 'layout', severity: 'high', description: 'Test', confidence: 0.9 },
          current: { base64: validBase64, mediaType: 'image/png' },
        });

      expect(res.status).toBe(400);
    });

    it('should return 400 when current screenshot is missing', async () => {
      const res = await request(app)
        .post('/api/visual/analyze-regression')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          difference: { id: 'diff-1', category: 'layout', severity: 'high', description: 'Test', confidence: 0.9 },
          baseline: { base64: validBase64, mediaType: 'image/png' },
        });

      expect(res.status).toBe(400);
    });

    it('should return 401 when no auth token provided', async () => {
      const res = await request(app)
        .post('/api/visual/analyze-regression')
        .send({
          difference: { id: 'diff-1', category: 'layout', severity: 'high', description: 'Test', confidence: 0.9 },
          baseline: { base64: validBase64, mediaType: 'image/png' },
          current: { base64: validBase64, mediaType: 'image/png' },
        });

      expect(res.status).toBe(401);
    });
  });

  // ==========================================================================
  // POST /api/visual/detect-elements - Detect UI elements
  // ==========================================================================
  describe('POST /api/visual/detect-elements', () => {
    const mockDetectOutput = {
      elements: [
        {
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
          suggestedSelector: '[data-testid="submit-btn"]',
          suggestedAction: 'click',
        },
        {
          type: 'input',
          boundingBox: { x: 100, y: 150, width: 200, height: 36 },
          confidence: 0.92,
          text: '',
          state: 'default',
          accessibility: {
            hasLabel: false,
            suggestedLabel: 'Email input',
            role: 'textbox',
            issues: ['Missing accessible label'],
          },
          suggestedSelector: 'input[type="email"]',
          suggestedAction: 'type',
        },
      ],
      pageStructure: {
        hasHeader: true,
        hasFooter: true,
        hasNavigation: true,
        hasSidebar: false,
        mainContentArea: { x: 0, y: 80, width: 1200, height: 600 },
      },
      summary: {
        totalElements: 2,
        byType: { button: 1, input: 1 },
        averageConfidence: 0.935,
        accessibilityIssues: 1,
      },
      pageDescription: 'Login form with email input and submit button',
    };

    it('should detect UI elements from screenshot', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(mockDetectOutput) }],
        usage: { input_tokens: 800, output_tokens: 600 },
      });

      const res = await request(app)
        .post('/api/visual/detect-elements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          screenshot: {
            base64: validBase64,
            mediaType: 'image/png',
            metadata: { url: 'https://example.com/login', viewport: { width: 1920, height: 1080 } },
          },
          context: 'Login page of web application',
        });

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.elements).toHaveLength(2);
      expect(res.body.data.elements[0].type).toBe('button');
      expect(res.body.data.elements[0].text).toBe('Submit');
      expect(res.body.data.pageStructure.hasHeader).toBe(true);
      expect(res.body.data.summary.totalElements).toBe(2);
    });

    it('should filter elements by type', async () => {
      const filteredOutput = { ...mockDetectOutput, elements: [mockDetectOutput.elements[0]] };
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(filteredOutput) }],
        usage: { input_tokens: 800, output_tokens: 400 },
      });

      const res = await request(app)
        .post('/api/visual/detect-elements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          screenshot: { base64: validBase64, mediaType: 'image/png' },
          elementTypes: ['button', 'link'],
        });

      expect(res.status).toBe(200);
      expect(res.body.data.elements).toHaveLength(1);
      expect(res.body.data.elements[0].type).toBe('button');
    });

    it('should respect minimum confidence threshold', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(mockDetectOutput) }],
        usage: { input_tokens: 800, output_tokens: 600 },
      });

      const res = await request(app)
        .post('/api/visual/detect-elements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          screenshot: { base64: validBase64, mediaType: 'image/png' },
          minConfidence: 0.9,
        });

      expect(res.status).toBe(200);
    });

    it('should detect nested elements when requested', async () => {
      const nestedOutput = {
        ...mockDetectOutput,
        elements: [{
          ...mockDetectOutput.elements[0],
          children: [
            { type: 'icon', boundingBox: { x: 105, y: 210, width: 20, height: 20 }, confidence: 0.88, text: '' },
          ],
        }],
      };
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(nestedOutput) }],
        usage: { input_tokens: 800, output_tokens: 700 },
      });

      const res = await request(app)
        .post('/api/visual/detect-elements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          screenshot: { base64: validBase64, mediaType: 'image/png' },
          detectNested: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.elements[0].children).toBeDefined();
      expect(res.body.data.elements[0].children).toHaveLength(1);
    });

    it('should return 400 when screenshot is missing', async () => {
      const res = await request(app)
        .post('/api/visual/detect-elements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          elementTypes: ['button'],
        });

      expect(res.status).toBe(400);
    });

    it('should return 400 when screenshot base64 is too short', async () => {
      const res = await request(app)
        .post('/api/visual/detect-elements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          screenshot: { base64: 'abc', mediaType: 'image/png' },
        });

      expect(res.status).toBe(400);
    });

    it('should return 401 when no auth token provided', async () => {
      const res = await request(app)
        .post('/api/visual/detect-elements')
        .send({
          screenshot: { base64: validBase64, mediaType: 'image/png' },
        });

      expect(res.status).toBe(401);
    });
  });

  // ==========================================================================
  // POST /api/visual/generate-test-case - Generate visual test cases
  // ==========================================================================
  describe('POST /api/visual/generate-test-case', () => {
    const mockGenerateOutput = {
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
                  target: { selector: '[data-testid="login-form"]' },
                  expected: 'Login form is visible',
                },
              ],
              waitCondition: 'networkIdle',
            },
            {
              order: 2,
              action: 'Capture login form screenshot',
              visualAssertions: [
                {
                  type: 'screenshot',
                  target: { region: { x: 400, y: 200, width: 400, height: 300 } },
                  expected: 'Matches baseline',
                  tolerance: 0.02,
                },
              ],
            },
          ],
          expectedVisualState: 'Clean login form with email, password fields and submit button',
          priority: 'high',
          type: 'visual',
          tags: ['login', 'form', 'visual'],
          baselineRegions: [
            { name: 'login-form', region: { x: 400, y: 200, width: 400, height: 300 }, tolerance: 0.02 },
          ],
          viewports: [
            { width: 1920, height: 1080, name: 'desktop' },
            { width: 375, height: 667, name: 'mobile' },
          ],
        },
      ],
      summary: {
        total: 1,
        byPriority: { high: 1, medium: 0, low: 0 },
        byType: { visual: 1 },
        totalAssertions: 2,
      },
      baselineConfig: {
        captureFullPage: false,
        regions: [{ name: 'main-content', selector: 'main', tolerance: 0.02 }],
        ignoreRegions: [{ reason: 'Dynamic timestamp', selector: '.timestamp' }],
      },
    };

    it('should generate visual test cases from screenshot', async () => {
      // First call for element detection (implicit), second for test case generation
      mockAnthropicCreate
        .mockResolvedValueOnce({
          content: [{ type: 'text', text: JSON.stringify({
            elements: [{ type: 'button', boundingBox: { x: 100, y: 200, width: 80, height: 40 }, confidence: 0.95, text: 'Submit' }],
            pageStructure: { hasHeader: true, hasFooter: true, hasNavigation: false, hasSidebar: false },
            summary: { totalElements: 1, byType: { button: 1 }, averageConfidence: 0.95, accessibilityIssues: 0 },
            pageDescription: 'Login form',
          })}],
          usage: { input_tokens: 500, output_tokens: 300 },
        })
        .mockResolvedValueOnce({
          content: [{ type: 'text', text: JSON.stringify(mockGenerateOutput) }],
          usage: { input_tokens: 1000, output_tokens: 800 },
        });

      const res = await request(app)
        .post('/api/visual/generate-test-case')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          screenshot: {
            base64: validBase64,
            mediaType: 'image/png',
            metadata: { url: 'https://example.com/login', viewport: { width: 1920, height: 1080 } },
          },
          feature: 'User Authentication',
          focusAreas: ['login form', 'submit button', 'error states'],
          includeResponsive: true,
          maxTestCases: 5,
        });

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.testCases).toHaveLength(1);
      expect(res.body.data.testCases[0].title).toBe('Verify login form visual layout');
      expect(res.body.data.testCases[0].priority).toBe('high');
      expect(res.body.data.testCases[0].type).toBe('visual');
      expect(res.body.data.summary.total).toBe(1);
      expect(res.body.data.baselineConfig).toBeDefined();
    });

    it('should generate multiple test cases with various types', async () => {
      const multiTypeOutput = {
        ...mockGenerateOutput,
        testCases: [
          { ...mockGenerateOutput.testCases[0] },
          { ...mockGenerateOutput.testCases[0], title: 'Responsive layout test', type: 'responsive', priority: 'medium' },
          { ...mockGenerateOutput.testCases[0], title: 'Layout regression test', type: 'layout', priority: 'high' },
        ],
        summary: { total: 3, byPriority: { high: 2, medium: 1 }, byType: { visual: 1, responsive: 1, layout: 1 }, totalAssertions: 6 },
      };

      mockAnthropicCreate
        .mockResolvedValueOnce({
          content: [{ type: 'text', text: JSON.stringify({
            elements: [],
            pageStructure: { hasHeader: true, hasFooter: true, hasNavigation: false, hasSidebar: false },
            summary: { totalElements: 0, byType: {}, averageConfidence: 0, accessibilityIssues: 0 },
            pageDescription: 'Page',
          })}],
          usage: { input_tokens: 500, output_tokens: 200 },
        })
        .mockResolvedValueOnce({
          content: [{ type: 'text', text: JSON.stringify(multiTypeOutput) }],
          usage: { input_tokens: 1000, output_tokens: 1200 },
        });

      const res = await request(app)
        .post('/api/visual/generate-test-case')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          screenshot: { base64: validBase64, mediaType: 'image/png' },
          includeResponsive: true,
          maxTestCases: 10,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.testCases).toHaveLength(3);
      expect(res.body.data.summary.total).toBe(3);
    });

    it('should generate test cases with specific test types', async () => {
      mockAnthropicCreate
        .mockResolvedValueOnce({
          content: [{ type: 'text', text: JSON.stringify({
            elements: [],
            pageStructure: { hasHeader: true, hasFooter: true, hasNavigation: false, hasSidebar: false },
            summary: { totalElements: 0, byType: {}, averageConfidence: 0, accessibilityIssues: 0 },
            pageDescription: 'Page',
          })}],
          usage: { input_tokens: 500, output_tokens: 200 },
        })
        .mockResolvedValueOnce({
          content: [{ type: 'text', text: JSON.stringify(mockGenerateOutput) }],
          usage: { input_tokens: 1000, output_tokens: 800 },
        });

      const res = await request(app)
        .post('/api/visual/generate-test-case')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          screenshot: { base64: validBase64, mediaType: 'image/jpeg' },
          testTypes: ['visual', 'visual-regression'],
        });

      expect(res.status).toBe(200);
    });

    it('should return 400 when screenshot is missing', async () => {
      const res = await request(app)
        .post('/api/visual/generate-test-case')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          feature: 'Login',
        });

      expect(res.status).toBe(400);
    });

    it('should return 400 when screenshot base64 is invalid', async () => {
      const res = await request(app)
        .post('/api/visual/generate-test-case')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          screenshot: { base64: 'too-short', mediaType: 'image/png' },
        });

      expect(res.status).toBe(400);
    });

    it('should return 400 when mediaType is invalid', async () => {
      const res = await request(app)
        .post('/api/visual/generate-test-case')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          screenshot: { base64: validBase64, mediaType: 'image/tiff' },
        });

      expect(res.status).toBe(400);
    });

    it('should return 401 when no auth token provided', async () => {
      const res = await request(app)
        .post('/api/visual/generate-test-case')
        .send({
          screenshot: { base64: validBase64, mediaType: 'image/png' },
        });

      expect(res.status).toBe(401);
    });

    it('should return 401 when invalid token provided', async () => {
      const res = await request(app)
        .post('/api/visual/generate-test-case')
        .set('Authorization', 'Bearer bad_token')
        .send({
          screenshot: { base64: validBase64, mediaType: 'image/png' },
        });

      expect(res.status).toBe(401);
    });
  });

  // ==========================================================================
  // Error Handling
  // ==========================================================================
  describe('Error Handling', () => {
    it('should handle AI API errors gracefully for /compare', async () => {
      mockAnthropicCreate.mockRejectedValue(new Error('API rate limit exceeded'));

      const res = await request(app)
        .post('/api/visual/compare')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          baseline: { base64: validBase64, mediaType: 'image/png' },
          current: { base64: validBase64, mediaType: 'image/png' },
        });

      expect(res.status).toBe(500);
    }, 20000);

    it('should handle AI API errors gracefully for /detect-elements', async () => {
      mockAnthropicCreate.mockRejectedValue(new Error('API unavailable'));

      const res = await request(app)
        .post('/api/visual/detect-elements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          screenshot: { base64: validBase64, mediaType: 'image/png' },
        });

      expect(res.status).toBe(500);
    }, 20000);

    it('should handle malformed JSON response from AI', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'This is not valid JSON' }],
        usage: { input_tokens: 100, output_tokens: 50 },
      });

      const res = await request(app)
        .post('/api/visual/compare')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          baseline: { base64: validBase64, mediaType: 'image/png' },
          current: { base64: validBase64, mediaType: 'image/png' },
        });

      expect(res.status).toBe(500);
    }, 20000);
  });
});

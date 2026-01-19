/**
 * Recorder Agent Routes Integration Tests
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

describe('Recorder Agent Routes Integration', () => {
  const adminToken = 'admin_test_token';
  const userToken = 'user_test_token';

  // Sample recording for testing
  const sampleRecording = {
    id: 'rec-123',
    name: 'Login Flow Recording',
    url: 'https://example.com/login',
    viewport: { width: 1920, height: 1080 },
    browser: 'chromium' as const,
    userAgent: 'Mozilla/5.0 Test',
    actions: [
      {
        id: 'action-1',
        type: 'navigate',
        timestamp: 0,
        target: { css: '' },
        value: 'https://example.com/login',
        metadata: { tagName: 'document' },
      },
      {
        id: 'action-2',
        type: 'fill',
        timestamp: 1500,
        target: { css: 'input[name="email"]', testId: 'email-input' },
        value: 'test@example.com',
        metadata: { tagName: 'INPUT', isVisible: true },
      },
      {
        id: 'action-3',
        type: 'fill',
        timestamp: 3000,
        target: { css: 'input[name="password"]', testId: 'password-input' },
        value: 'password123',
        metadata: { tagName: 'INPUT', isVisible: true },
      },
      {
        id: 'action-4',
        type: 'click',
        timestamp: 4500,
        target: { css: 'button[type="submit"]', role: { name: 'button', options: { name: 'Login' } } },
        coordinates: { x: 300, y: 400 },
        metadata: { tagName: 'BUTTON', textContent: 'Login', isVisible: true },
      },
    ],
    duration: 5000,
    recordedAt: '2026-01-19T10:00:00.000Z',
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
  // POST /api/recorder/convert - Convert recording to script
  // ==========================================================================
  describe('POST /api/recorder/convert', () => {
    const mockConvertOutput = {
      name: 'login-flow.spec.ts',
      code: `import { test, expect } from '@playwright/test';

test('Login Flow Recording', async ({ page }) => {
  await page.goto('https://example.com/login');
  await page.getByTestId('email-input').fill('test@example.com');
  await page.getByTestId('password-input').fill('password123');
  await page.getByRole('button', { name: 'Login' }).click();
});`,
      language: 'typescript',
      framework: 'playwright',
      pageObjects: [],
      utilities: [],
      dependencies: ['@playwright/test'],
      notes: ['Consider adding assertions after login'],
    };

    it('should convert recording to Playwright script', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(mockConvertOutput) }],
        usage: { input_tokens: 1500, output_tokens: 800 },
      });

      const res = await request(app)
        .post('/api/recorder/convert')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          recording: sampleRecording,
          options: {
            framework: 'playwright',
            language: 'typescript',
            includeComments: true,
            selectorPreference: ['testid', 'role', 'text', 'css'],
            waitStrategy: 'standard',
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.name).toBe('login-flow.spec.ts');
      expect(res.body.data.framework).toBe('playwright');
      expect(res.body.data.language).toBe('typescript');
      expect(res.body.data.code).toContain('getByTestId');
      expect(res.body.data.dependencies).toContain('@playwright/test');
      expect(res.body.usage).toBeDefined();
    });

    it('should convert recording to Cypress script', async () => {
      const cypressOutput = {
        ...mockConvertOutput,
        name: 'login-flow.cy.ts',
        framework: 'cypress',
        code: `describe('Login Flow Recording', () => {
  it('should complete login flow', () => {
    cy.visit('https://example.com/login');
    cy.get('[data-testid="email-input"]').type('test@example.com');
    cy.get('[data-testid="password-input"]').type('password123');
    cy.findByRole('button', { name: 'Login' }).click();
  });
});`,
        dependencies: ['cypress', '@testing-library/cypress'],
      };

      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(cypressOutput) }],
        usage: { input_tokens: 1500, output_tokens: 800 },
      });

      const res = await request(app)
        .post('/api/recorder/convert')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          recording: sampleRecording,
          options: {
            framework: 'cypress',
            language: 'typescript',
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.data.framework).toBe('cypress');
      expect(res.body.data.code).toContain('cy.visit');
    });

    it('should include Page Objects when requested', async () => {
      const withPageObjects = {
        ...mockConvertOutput,
        pageObjects: [
          {
            name: 'LoginPage',
            code: `export class LoginPage {
  readonly emailInput = page.getByTestId('email-input');
  readonly passwordInput = page.getByTestId('password-input');
  readonly loginButton = page.getByRole('button', { name: 'Login' });
}`,
          },
        ],
      };

      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(withPageObjects) }],
        usage: { input_tokens: 1800, output_tokens: 1200 },
      });

      const res = await request(app)
        .post('/api/recorder/convert')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          recording: sampleRecording,
          options: {
            framework: 'playwright',
            language: 'typescript',
            includePageObjects: true,
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.data.pageObjects).toHaveLength(1);
      expect(res.body.data.pageObjects[0].name).toBe('LoginPage');
    });

    it('should return 400 when recording is missing', async () => {
      const res = await request(app)
        .post('/api/recorder/convert')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          options: {
            framework: 'playwright',
            language: 'typescript',
          },
        });

      expect(res.status).toBe(400);
    });

    it('should return 400 when recording.actions is empty', async () => {
      const res = await request(app)
        .post('/api/recorder/convert')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          recording: { ...sampleRecording, actions: [] },
          options: {
            framework: 'playwright',
            language: 'typescript',
          },
        });

      expect(res.status).toBe(400);
    });

    it('should return 400 when recording.url is missing', async () => {
      const { url, ...recordingWithoutUrl } = sampleRecording;
      const res = await request(app)
        .post('/api/recorder/convert')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          recording: recordingWithoutUrl,
          options: {
            framework: 'playwright',
            language: 'typescript',
          },
        });

      expect(res.status).toBe(400);
    });

    it('should return 401 when no auth token provided', async () => {
      const res = await request(app)
        .post('/api/recorder/convert')
        .send({
          recording: sampleRecording,
          options: { framework: 'playwright', language: 'typescript' },
        });

      expect(res.status).toBe(401);
    });

    it('should return 401 when invalid token provided', async () => {
      const res = await request(app)
        .post('/api/recorder/convert')
        .set('Authorization', 'Bearer invalid_token')
        .send({
          recording: sampleRecording,
          options: { framework: 'playwright', language: 'typescript' },
        });

      expect(res.status).toBe(401);
    });
  });

  // ==========================================================================
  // POST /api/recorder/optimize - Optimize a recording
  // ==========================================================================
  describe('POST /api/recorder/optimize', () => {
    const mockOptimizeOutput = {
      recording: {
        ...sampleRecording,
        actions: sampleRecording.actions.slice(0, 3).concat([
          {
            id: 'action-4-optimized',
            type: 'click',
            timestamp: 4500,
            target: { testId: 'login-button', role: { name: 'button', options: { name: 'Login' } } },
            metadata: { tagName: 'BUTTON', textContent: 'Login', isVisible: true },
          },
        ]),
      },
      removedActions: [],
      modifiedActions: [
        {
          original: sampleRecording.actions[3],
          modified: {
            id: 'action-4-optimized',
            type: 'click',
            timestamp: 4500,
            target: { testId: 'login-button', role: { name: 'button', options: { name: 'Login' } } },
            metadata: { tagName: 'BUTTON', textContent: 'Login', isVisible: true },
          },
          reason: 'Improved selector: added testId for better stability',
        },
      ],
      addedActions: [],
      suggestions: [
        {
          actionIds: ['action-4'],
          type: 'improve',
          description: 'Improved button selector by adding data-testid',
          priority: 'high',
          applied: true,
        },
      ],
      summary: {
        originalActionCount: 4,
        optimizedActionCount: 4,
        removedCount: 0,
        modifiedCount: 1,
        addedCount: 0,
        estimatedTimeReduction: 5,
      },
    };

    it('should optimize recording by improving selectors', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(mockOptimizeOutput) }],
        usage: { input_tokens: 1200, output_tokens: 900 },
      });

      const res = await request(app)
        .post('/api/recorder/optimize')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          recording: sampleRecording,
          options: {
            removeDuplicates: true,
            mergeTypeActions: true,
            improveSelectors: true,
            addSmartWaits: true,
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.recording).toBeDefined();
      expect(res.body.data.modifiedActions).toHaveLength(1);
      expect(res.body.data.suggestions).toHaveLength(1);
      expect(res.body.data.summary.modifiedCount).toBe(1);
      expect(res.body.usage).toBeDefined();
    });

    it('should remove redundant actions', async () => {
      const withRemovals = {
        ...mockOptimizeOutput,
        removedActions: [
          { id: 'action-5', type: 'scroll', timestamp: 2000, target: { css: 'body' } },
        ],
        summary: {
          ...mockOptimizeOutput.summary,
          removedCount: 1,
          estimatedTimeReduction: 10,
        },
      };

      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(withRemovals) }],
        usage: { input_tokens: 1200, output_tokens: 1000 },
      });

      const res = await request(app)
        .post('/api/recorder/optimize')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          recording: sampleRecording,
          options: {
            removeUnnecessaryScrolls: true,
            collapseRapidClicks: true,
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.data.removedActions).toHaveLength(1);
      expect(res.body.data.summary.removedCount).toBe(1);
    });

    it('should merge consecutive type actions', async () => {
      const withMerges = {
        ...mockOptimizeOutput,
        suggestions: [
          {
            actionIds: ['type-1', 'type-2', 'type-3'],
            type: 'merge',
            description: 'Merged 3 consecutive type actions into single fill',
            priority: 'medium',
            applied: true,
          },
        ],
      };

      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(withMerges) }],
        usage: { input_tokens: 1200, output_tokens: 900 },
      });

      const res = await request(app)
        .post('/api/recorder/optimize')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          recording: sampleRecording,
          options: {
            mergeTypeActions: true,
            actionMergeThreshold: 500,
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.data.suggestions[0].type).toBe('merge');
    });

    it('should return 400 when recording is missing', async () => {
      const res = await request(app)
        .post('/api/recorder/optimize')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          options: { removeDuplicates: true },
        });

      expect(res.status).toBe(400);
    });

    it('should return 400 when recording.id is missing', async () => {
      const { id, ...recordingWithoutId } = sampleRecording;
      const res = await request(app)
        .post('/api/recorder/optimize')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          recording: recordingWithoutId,
        });

      expect(res.status).toBe(400);
    });

    it('should return 401 when no auth token provided', async () => {
      const res = await request(app)
        .post('/api/recorder/optimize')
        .send({
          recording: sampleRecording,
        });

      expect(res.status).toBe(401);
    });

    it('should return 401 when invalid token provided', async () => {
      const res = await request(app)
        .post('/api/recorder/optimize')
        .set('Authorization', 'Bearer bad_token')
        .send({
          recording: sampleRecording,
        });

      expect(res.status).toBe(401);
    });
  });

  // ==========================================================================
  // POST /api/recorder/assertions - Add assertions to recording
  // ==========================================================================
  describe('POST /api/recorder/assertions', () => {
    const mockAssertionOutput = {
      assertions: [
        {
          afterActionId: 'action-1',
          type: 'url',
          target: null,
          expectedValue: 'https://example.com/login',
          description: 'Verify navigation to login page',
          confidence: 0.95,
          code: {
            playwright: "await expect(page).toHaveURL('https://example.com/login');",
            cypress: "cy.url().should('eq', 'https://example.com/login');",
            selenium: "assert driver.current_url == 'https://example.com/login'",
          },
        },
        {
          afterActionId: 'action-4',
          type: 'url',
          target: null,
          expectedValue: 'https://example.com/dashboard',
          description: 'Verify redirect to dashboard after login',
          confidence: 0.90,
          code: {
            playwright: "await expect(page).toHaveURL(/dashboard/);",
            cypress: "cy.url().should('include', 'dashboard');",
            selenium: "assert 'dashboard' in driver.current_url",
          },
        },
        {
          afterActionId: 'action-4',
          type: 'visible',
          target: { css: '.welcome-message', testId: 'welcome-msg' },
          description: 'Verify welcome message is displayed after login',
          confidence: 0.85,
          code: {
            playwright: "await expect(page.getByTestId('welcome-msg')).toBeVisible();",
            cypress: "cy.get('[data-testid=\"welcome-msg\"]').should('be.visible');",
            selenium: "wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '.welcome-message')))",
          },
        },
      ],
      summary: {
        total: 3,
        byType: { url: 2, visible: 1 },
        averageConfidence: 0.90,
      },
      enhancedRecording: sampleRecording,
    };

    it('should add assertions to recording', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(mockAssertionOutput) }],
        usage: { input_tokens: 1400, output_tokens: 1000 },
      });

      const res = await request(app)
        .post('/api/recorder/assertions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          recording: sampleRecording,
        });

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.assertions).toHaveLength(3);
      expect(res.body.data.assertions[0].type).toBe('url');
      expect(res.body.data.assertions[0].confidence).toBe(0.95);
      expect(res.body.data.assertions[0].code.playwright).toContain('toHaveURL');
      expect(res.body.data.summary.total).toBe(3);
      expect(res.body.data.summary.averageConfidence).toBe(0.90);
      expect(res.body.usage).toBeDefined();
    });

    it('should add assertions with user hints', async () => {
      const withHints = {
        ...mockAssertionOutput,
        assertions: [
          ...mockAssertionOutput.assertions,
          {
            afterActionId: 'action-2',
            type: 'value',
            target: { testId: 'email-input' },
            expectedValue: 'test@example.com',
            description: 'Verify email field has correct value',
            confidence: 0.98,
            code: {
              playwright: "await expect(page.getByTestId('email-input')).toHaveValue('test@example.com');",
              cypress: "cy.get('[data-testid=\"email-input\"]').should('have.value', 'test@example.com');",
              selenium: "assert element.get_attribute('value') == 'test@example.com'",
            },
          },
        ],
        summary: { total: 4, byType: { url: 2, visible: 1, value: 1 }, averageConfidence: 0.92 },
      };

      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(withHints) }],
        usage: { input_tokens: 1600, output_tokens: 1200 },
      });

      const res = await request(app)
        .post('/api/recorder/assertions')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          recording: sampleRecording,
          hints: [
            {
              afterActionId: 'action-2',
              type: 'value',
              description: 'Verify email was entered correctly',
              expectedValue: 'test@example.com',
            },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.data.assertions).toHaveLength(4);
      expect(res.body.data.summary.byType.value).toBe(1);
    });

    it('should return assertions with all framework code variations', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(mockAssertionOutput) }],
        usage: { input_tokens: 1400, output_tokens: 1000 },
      });

      const res = await request(app)
        .post('/api/recorder/assertions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          recording: sampleRecording,
        });

      expect(res.status).toBe(200);
      res.body.data.assertions.forEach((assertion: any) => {
        expect(assertion.code).toBeDefined();
        expect(assertion.code.playwright).toBeDefined();
        expect(assertion.code.cypress).toBeDefined();
        expect(assertion.code.selenium).toBeDefined();
      });
    });

    it('should return 400 when recording is missing', async () => {
      const res = await request(app)
        .post('/api/recorder/assertions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          hints: [{ type: 'visible', description: 'Check button' }],
        });

      expect(res.status).toBe(400);
    });

    it('should return 400 when recording.actions is empty', async () => {
      const res = await request(app)
        .post('/api/recorder/assertions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          recording: { ...sampleRecording, actions: [] },
        });

      expect(res.status).toBe(400);
    });

    it('should return 401 when no auth token provided', async () => {
      const res = await request(app)
        .post('/api/recorder/assertions')
        .send({
          recording: sampleRecording,
        });

      expect(res.status).toBe(401);
    });

    it('should return 401 when invalid token provided', async () => {
      const res = await request(app)
        .post('/api/recorder/assertions')
        .set('Authorization', 'Bearer wrong_token')
        .send({
          recording: sampleRecording,
        });

      expect(res.status).toBe(401);
    });
  });

  // ==========================================================================
  // POST /api/recorder/selectors - Suggest selectors for element
  // ==========================================================================
  describe('POST /api/recorder/selectors', () => {
    const mockSelectorOutput = {
      suggestions: [
        {
          strategy: 'role',
          value: "button[name='Submit']",
          code: {
            playwright: "page.getByRole('button', { name: 'Submit' })",
            cypress: "cy.findByRole('button', { name: 'Submit' })",
            selenium: "driver.find_element(By.XPATH, \"//button[text()='Submit']\")",
          },
          robustness: 0.95,
          maintainability: 0.90,
          isUnique: true,
          reasoning: 'Uses semantic role with unique accessible name - most stable approach',
        },
        {
          strategy: 'testid',
          value: 'submit-button',
          code: {
            playwright: "page.getByTestId('submit-button')",
            cypress: "cy.get('[data-testid=\"submit-button\"]')",
            selenium: "driver.find_element(By.CSS_SELECTOR, '[data-testid=\"submit-button\"]')",
          },
          robustness: 0.92,
          maintainability: 0.95,
          isUnique: true,
          reasoning: 'Test ID provides excellent stability, decoupled from styling',
        },
        {
          strategy: 'css',
          value: 'form button[type="submit"]',
          code: {
            playwright: "page.locator('form button[type=\"submit\"]')",
            cypress: "cy.get('form button[type=\"submit\"]')",
            selenium: "driver.find_element(By.CSS_SELECTOR, 'form button[type=\"submit\"]')",
          },
          robustness: 0.75,
          maintainability: 0.70,
          isUnique: true,
          reasoning: 'CSS selector is functional but may break if form structure changes',
        },
      ],
      recommended: {
        strategy: 'role',
        value: "button[name='Submit']",
        code: {
          playwright: "page.getByRole('button', { name: 'Submit' })",
          cypress: "cy.findByRole('button', { name: 'Submit' })",
          selenium: "driver.find_element(By.XPATH, \"//button[text()='Submit']\")",
        },
        robustness: 0.95,
        maintainability: 0.90,
        isUnique: true,
        reasoning: 'Uses semantic role with unique accessible name - most stable approach',
      },
      analysis: {
        hasTestId: true,
        hasAriaLabel: false,
        hasUniqueText: true,
        isInteractive: true,
        isInForm: true,
        nestingLevel: 2,
      },
    };

    it('should suggest selectors for element', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(mockSelectorOutput) }],
        usage: { input_tokens: 800, output_tokens: 700 },
      });

      const res = await request(app)
        .post('/api/recorder/selectors')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          element: {
            currentSelector: { css: 'button.btn-primary' },
            html: '<button class="btn-primary" data-testid="submit-button" type="submit">Submit</button>',
            attributes: {
              class: 'btn-primary',
              type: 'submit',
              'data-testid': 'submit-button',
            },
            context: '<form><button class="btn-primary" type="submit">Submit</button></form>',
            pageUrl: 'https://example.com/form',
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.suggestions).toHaveLength(3);
      expect(res.body.data.suggestions[0].strategy).toBe('role');
      expect(res.body.data.suggestions[0].robustness).toBe(0.95);
      expect(res.body.data.recommended).toBeDefined();
      expect(res.body.data.recommended.strategy).toBe('role');
      expect(res.body.data.analysis.hasTestId).toBe(true);
      expect(res.body.data.analysis.isInForm).toBe(true);
      expect(res.body.usage).toBeDefined();
    });

    it('should provide selectors with all framework code variations', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(mockSelectorOutput) }],
        usage: { input_tokens: 800, output_tokens: 700 },
      });

      const res = await request(app)
        .post('/api/recorder/selectors')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          element: {
            currentSelector: { css: 'input[name="email"]' },
            attributes: { type: 'email', name: 'email', placeholder: 'Enter email' },
          },
        });

      expect(res.status).toBe(200);
      res.body.data.suggestions.forEach((suggestion: any) => {
        expect(suggestion.code.playwright).toBeDefined();
        expect(suggestion.code.cypress).toBeDefined();
        expect(suggestion.code.selenium).toBeDefined();
      });
    });

    it('should handle elements without test-id', async () => {
      const noTestIdOutput = {
        ...mockSelectorOutput,
        analysis: {
          ...mockSelectorOutput.analysis,
          hasTestId: false,
        },
        suggestions: mockSelectorOutput.suggestions.filter(s => s.strategy !== 'testid'),
      };

      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(noTestIdOutput) }],
        usage: { input_tokens: 800, output_tokens: 600 },
      });

      const res = await request(app)
        .post('/api/recorder/selectors')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          element: {
            currentSelector: { css: 'button.save' },
            html: '<button class="save">Save Changes</button>',
            attributes: { class: 'save' },
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.data.analysis.hasTestId).toBe(false);
    });

    it('should return 400 when element is missing', async () => {
      const res = await request(app)
        .post('/api/recorder/selectors')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it('should return 400 when element.currentSelector is missing', async () => {
      const res = await request(app)
        .post('/api/recorder/selectors')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          element: {
            html: '<button>Click</button>',
          },
        });

      expect(res.status).toBe(400);
    });

    it('should return 401 when no auth token provided', async () => {
      const res = await request(app)
        .post('/api/recorder/selectors')
        .send({
          element: {
            currentSelector: { css: 'button' },
          },
        });

      expect(res.status).toBe(401);
    });

    it('should return 401 when invalid token provided', async () => {
      const res = await request(app)
        .post('/api/recorder/selectors')
        .set('Authorization', 'Bearer expired_token')
        .send({
          element: {
            currentSelector: { css: 'button' },
          },
        });

      expect(res.status).toBe(401);
    });
  });

  // ==========================================================================
  // POST /api/recorder/process - Full pipeline
  // ==========================================================================
  describe('POST /api/recorder/process', () => {
    const mockOptimizeResult = {
      recording: sampleRecording,
      removedActions: [],
      modifiedActions: [],
      addedActions: [],
      suggestions: [
        { actionIds: ['action-2'], type: 'improve', description: 'Added testId selector', priority: 'medium', applied: true },
      ],
      summary: { originalActionCount: 4, optimizedActionCount: 4, removedCount: 0, modifiedCount: 1, addedCount: 0, estimatedTimeReduction: 5 },
    };

    const mockAssertionResult = {
      assertions: [
        {
          afterActionId: 'action-4',
          type: 'url',
          description: 'Verify redirect after login',
          confidence: 0.90,
          code: {
            playwright: "await expect(page).toHaveURL(/dashboard/);",
            cypress: "cy.url().should('include', 'dashboard');",
            selenium: "assert 'dashboard' in driver.current_url",
          },
        },
      ],
      summary: { total: 1, byType: { url: 1 }, averageConfidence: 0.90 },
    };

    const mockScriptResult = {
      name: 'login-flow.spec.ts',
      code: `import { test, expect } from '@playwright/test';

test('Login Flow', async ({ page }) => {
  await page.goto('https://example.com/login');
  await page.getByTestId('email-input').fill('test@example.com');
  await page.getByTestId('password-input').fill('password123');
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page).toHaveURL(/dashboard/);
});`,
      language: 'typescript',
      framework: 'playwright',
      dependencies: ['@playwright/test'],
      notes: [],
    };

    it('should process recording with full pipeline', async () => {
      // Three AI calls: optimize, assertions, convert
      mockAnthropicCreate
        .mockResolvedValueOnce({
          content: [{ type: 'text', text: JSON.stringify(mockOptimizeResult) }],
          usage: { input_tokens: 1200, output_tokens: 800 },
        })
        .mockResolvedValueOnce({
          content: [{ type: 'text', text: JSON.stringify(mockAssertionResult) }],
          usage: { input_tokens: 1400, output_tokens: 600 },
        })
        .mockResolvedValueOnce({
          content: [{ type: 'text', text: JSON.stringify(mockScriptResult) }],
          usage: { input_tokens: 1600, output_tokens: 1000 },
        });

      const res = await request(app)
        .post('/api/recorder/process')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          recording: sampleRecording,
          options: {
            conversion: {
              framework: 'playwright',
              language: 'typescript',
              includeComments: true,
            },
            optimization: {
              removeDuplicates: true,
              improveSelectors: true,
            },
            assertionHints: [
              { afterActionId: 'action-4', type: 'url', description: 'Verify dashboard redirect' },
            ],
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.script).toBeDefined();
      expect(res.body.data.script.framework).toBe('playwright');
      expect(res.body.data.optimization).toBeDefined();
      expect(res.body.data.optimization.summary.modifiedCount).toBe(1);
      expect(res.body.data.assertions).toBeDefined();
      expect(res.body.data.assertions.assertions).toHaveLength(1);
      expect(res.body.usage).toBeDefined();
    });

    it('should skip optimization when skipOptimization is true', async () => {
      // Two AI calls: assertions, convert (skip optimize)
      mockAnthropicCreate
        .mockResolvedValueOnce({
          content: [{ type: 'text', text: JSON.stringify(mockAssertionResult) }],
          usage: { input_tokens: 1400, output_tokens: 600 },
        })
        .mockResolvedValueOnce({
          content: [{ type: 'text', text: JSON.stringify(mockScriptResult) }],
          usage: { input_tokens: 1600, output_tokens: 1000 },
        });

      const res = await request(app)
        .post('/api/recorder/process')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          recording: sampleRecording,
          options: {
            conversion: { framework: 'playwright', language: 'typescript' },
            skipOptimization: true,
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.data.script).toBeDefined();
      expect(res.body.data.optimization).toBeUndefined();
      expect(res.body.data.assertions).toBeDefined();
    });

    it('should skip assertions when skipAssertions is true', async () => {
      // Two AI calls: optimize, convert (skip assertions)
      mockAnthropicCreate
        .mockResolvedValueOnce({
          content: [{ type: 'text', text: JSON.stringify(mockOptimizeResult) }],
          usage: { input_tokens: 1200, output_tokens: 800 },
        })
        .mockResolvedValueOnce({
          content: [{ type: 'text', text: JSON.stringify(mockScriptResult) }],
          usage: { input_tokens: 1600, output_tokens: 1000 },
        });

      const res = await request(app)
        .post('/api/recorder/process')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          recording: sampleRecording,
          options: {
            conversion: { framework: 'cypress', language: 'javascript' },
            skipAssertions: true,
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.data.script).toBeDefined();
      expect(res.body.data.optimization).toBeDefined();
      expect(res.body.data.assertions).toBeUndefined();
    });

    it('should process with only conversion (skip both optimization and assertions)', async () => {
      // One AI call: convert only
      mockAnthropicCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: JSON.stringify(mockScriptResult) }],
        usage: { input_tokens: 1600, output_tokens: 1000 },
      });

      const res = await request(app)
        .post('/api/recorder/process')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          recording: sampleRecording,
          options: {
            conversion: { framework: 'playwright', language: 'typescript' },
            skipOptimization: true,
            skipAssertions: true,
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.data.script).toBeDefined();
      expect(res.body.data.optimization).toBeUndefined();
      expect(res.body.data.assertions).toBeUndefined();
    });

    it('should return 400 when recording is missing', async () => {
      const res = await request(app)
        .post('/api/recorder/process')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          options: {
            conversion: { framework: 'playwright', language: 'typescript' },
          },
        });

      expect(res.status).toBe(400);
    });

    it('should return 400 when conversion options are missing', async () => {
      const res = await request(app)
        .post('/api/recorder/process')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          recording: sampleRecording,
          options: {
            optimization: { removeDuplicates: true },
          },
        });

      expect(res.status).toBe(400);
    });

    it('should return 400 when framework is missing in conversion options', async () => {
      const res = await request(app)
        .post('/api/recorder/process')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          recording: sampleRecording,
          options: {
            conversion: { language: 'typescript' },
          },
        });

      expect(res.status).toBe(400);
    });

    it('should return 401 when no auth token provided', async () => {
      const res = await request(app)
        .post('/api/recorder/process')
        .send({
          recording: sampleRecording,
          options: {
            conversion: { framework: 'playwright', language: 'typescript' },
          },
        });

      expect(res.status).toBe(401);
    });

    it('should return 401 when invalid token provided', async () => {
      const res = await request(app)
        .post('/api/recorder/process')
        .set('Authorization', 'Bearer invalid')
        .send({
          recording: sampleRecording,
          options: {
            conversion: { framework: 'playwright', language: 'typescript' },
          },
        });

      expect(res.status).toBe(401);
    });
  });

  // ==========================================================================
  // Error Handling
  // ==========================================================================
  describe('Error Handling', () => {
    it('should handle AI API errors gracefully for /convert', async () => {
      mockAnthropicCreate.mockRejectedValue(new Error('API rate limit exceeded'));

      const res = await request(app)
        .post('/api/recorder/convert')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          recording: sampleRecording,
          options: { framework: 'playwright', language: 'typescript' },
        });

      expect(res.status).toBe(500);
    }, 20000);

    it('should handle AI API errors gracefully for /optimize', async () => {
      mockAnthropicCreate.mockRejectedValue(new Error('Service unavailable'));

      const res = await request(app)
        .post('/api/recorder/optimize')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          recording: sampleRecording,
        });

      expect(res.status).toBe(500);
    }, 20000);

    it('should handle AI API errors gracefully for /assertions', async () => {
      mockAnthropicCreate.mockRejectedValue(new Error('Connection timeout'));

      const res = await request(app)
        .post('/api/recorder/assertions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          recording: sampleRecording,
        });

      expect(res.status).toBe(500);
    }, 20000);

    it('should handle AI API errors gracefully for /selectors', async () => {
      mockAnthropicCreate.mockRejectedValue(new Error('Invalid API key'));

      const res = await request(app)
        .post('/api/recorder/selectors')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          element: { currentSelector: { css: 'button' } },
        });

      expect(res.status).toBe(500);
    }, 20000);

    it('should handle malformed JSON response from AI for /convert', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'This is not valid JSON { broken' }],
        usage: { input_tokens: 100, output_tokens: 50 },
      });

      const res = await request(app)
        .post('/api/recorder/convert')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          recording: sampleRecording,
          options: { framework: 'playwright', language: 'typescript' },
        });

      expect(res.status).toBe(500);
    }, 20000);

    it('should handle malformed JSON response from AI for /optimize', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: '{"incomplete": true' }],
        usage: { input_tokens: 100, output_tokens: 50 },
      });

      const res = await request(app)
        .post('/api/recorder/optimize')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          recording: sampleRecording,
        });

      expect(res.status).toBe(500);
    }, 20000);

    it('should handle pipeline errors in /process gracefully', async () => {
      // First call succeeds, second fails
      mockAnthropicCreate
        .mockResolvedValueOnce({
          content: [{ type: 'text', text: JSON.stringify({ recording: sampleRecording, removedActions: [], modifiedActions: [], addedActions: [], suggestions: [], summary: { originalActionCount: 4, optimizedActionCount: 4, removedCount: 0, modifiedCount: 0, addedCount: 0, estimatedTimeReduction: 0 } }) }],
          usage: { input_tokens: 1000, output_tokens: 500 },
        })
        .mockRejectedValueOnce(new Error('API error during assertions'));

      const res = await request(app)
        .post('/api/recorder/process')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          recording: sampleRecording,
          options: {
            conversion: { framework: 'playwright', language: 'typescript' },
          },
        });

      expect(res.status).toBe(500);
    }, 20000);
  });
});

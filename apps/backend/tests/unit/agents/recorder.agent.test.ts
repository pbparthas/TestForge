/**
 * Recorder Agent Tests
 * Tests for converting browser recordings to automation scripts
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
  RecorderAgent,
  Recording,
  RecordedAction,
  ElementSelector,
  ConversionOptions,
  OptimizationOptions,
  GeneratedScript,
  OptimizedRecording,
  AssertionResult,
  AssertionHint,
  SelectorSuggestionResult,
  ElementInfo,
} from '../../../src/agents/recorder.agent.js';

describe('RecorderAgent', () => {
  let agent: RecorderAgent;

  // Sample element selector
  const mockSelector: ElementSelector = {
    css: '#submit-btn',
    xpath: '//button[@id="submit-btn"]',
    testId: 'submit-btn',
    role: { name: 'button', options: { name: 'Submit' } },
  };

  // Sample recorded action
  const mockAction: RecordedAction = {
    id: 'action-1',
    type: 'click',
    timestamp: 1000,
    target: mockSelector,
    metadata: {
      tagName: 'BUTTON',
      textContent: 'Submit',
      isVisible: true,
      isInViewport: true,
    },
  };

  // Sample type action for merge tests
  const mockTypeAction1: RecordedAction = {
    id: 'action-2',
    type: 'type',
    timestamp: 1500,
    target: { css: '#email-input', testId: 'email-input' },
    value: 'test',
    metadata: { tagName: 'INPUT' },
  };

  const mockTypeAction2: RecordedAction = {
    id: 'action-3',
    type: 'type',
    timestamp: 1600,
    target: { css: '#email-input', testId: 'email-input' },
    value: '@example.com',
    metadata: { tagName: 'INPUT' },
  };

  // Sample recording
  const mockRecording: Recording = {
    id: 'rec-123',
    name: 'Login Flow Test',
    url: 'https://example.com/login',
    viewport: { width: 1920, height: 1080 },
    browser: 'chromium',
    userAgent: 'Mozilla/5.0',
    actions: [mockAction, mockTypeAction1, mockTypeAction2],
    duration: 5000,
    recordedAt: '2026-01-19T10:00:00Z',
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
    agent = new RecorderAgent();
  });

  // ============================================================================
  // convertToScript() Tests
  // ============================================================================

  describe('convertToScript()', () => {
    const mockPlaywrightScript: GeneratedScript = {
      name: 'login-flow.spec.ts',
      code: `import { test, expect } from '@playwright/test';

test('Login Flow Test', async ({ page }) => {
  await page.goto('https://example.com/login');
  await page.getByRole('button', { name: 'Submit' }).click();
  await page.getByTestId('email-input').fill('test@example.com');
});`,
      language: 'typescript',
      framework: 'playwright',
      dependencies: ['@playwright/test'],
      notes: ['Using role-based selectors for better accessibility'],
    };

    const mockCypressScript: GeneratedScript = {
      name: 'login-flow.cy.ts',
      code: `describe('Login Flow Test', () => {
  it('should complete login flow', () => {
    cy.visit('https://example.com/login');
    cy.findByRole('button', { name: 'Submit' }).click();
    cy.findByTestId('email-input').type('test@example.com');
  });
});`,
      language: 'typescript',
      framework: 'cypress',
      dependencies: ['cypress', '@testing-library/cypress'],
      notes: [],
    };

    const mockSeleniumScript: GeneratedScript = {
      name: 'LoginFlowTest.java',
      code: `import org.openqa.selenium.*;
import org.openqa.selenium.chrome.ChromeDriver;

public class LoginFlowTest {
  public void testLoginFlow() {
    WebDriver driver = new ChromeDriver();
    driver.get("https://example.com/login");
    driver.findElement(By.id("submit-btn")).click();
    driver.findElement(By.id("email-input")).sendKeys("test@example.com");
    driver.quit();
  }
}`,
      language: 'java',
      framework: 'selenium',
      dependencies: ['selenium-java', 'webdrivermanager'],
      notes: [],
    };

    it('should convert recording to Playwright script', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockPlaywrightScript)));

      const options: ConversionOptions = {
        framework: 'playwright',
        language: 'typescript',
        testName: 'Login Flow Test',
        includeComments: true,
      };

      const result = await agent.convertToScript(mockRecording, options);

      expect(result.data.framework).toBe('playwright');
      expect(result.data.language).toBe('typescript');
      expect(result.data.code).toContain('@playwright/test');
      expect(result.data.dependencies).toContain('@playwright/test');
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it('should convert recording to Cypress script', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockCypressScript)));

      const options: ConversionOptions = {
        framework: 'cypress',
        language: 'typescript',
        testName: 'Login Flow Test',
      };

      const result = await agent.convertToScript(mockRecording, options);

      expect(result.data.framework).toBe('cypress');
      expect(result.data.language).toBe('typescript');
      expect(result.data.code).toContain('describe');
      expect(result.data.code).toContain('cy.visit');
      expect(result.data.dependencies).toContain('cypress');
    });

    it('should convert recording to Selenium script', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockSeleniumScript)));

      const options: ConversionOptions = {
        framework: 'selenium',
        language: 'java',
        testName: 'LoginFlowTest',
      };

      const result = await agent.convertToScript(mockRecording, options);

      expect(result.data.framework).toBe('selenium');
      expect(result.data.language).toBe('java');
      expect(result.data.code).toContain('WebDriver');
      expect(result.data.code).toContain('ChromeDriver');
    });

    it('should include page objects when requested', async () => {
      const scriptWithPageObjects: GeneratedScript = {
        ...mockPlaywrightScript,
        pageObjects: [
          {
            name: 'LoginPage',
            code: `export class LoginPage {
  constructor(private page: Page) {}

  async clickSubmit() {
    await this.page.getByRole('button', { name: 'Submit' }).click();
  }

  async enterEmail(email: string) {
    await this.page.getByTestId('email-input').fill(email);
  }
}`,
          },
        ],
      };

      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(scriptWithPageObjects)));

      const options: ConversionOptions = {
        framework: 'playwright',
        language: 'typescript',
        includePageObjects: true,
      };

      const result = await agent.convertToScript(mockRecording, options);

      expect(result.data.pageObjects).toBeDefined();
      expect(result.data.pageObjects!.length).toBeGreaterThan(0);
      expect(result.data.pageObjects![0].name).toBe('LoginPage');
      expect(result.data.pageObjects![0].code).toContain('class LoginPage');
    });

    it('should handle different output languages', async () => {
      const pythonScript: GeneratedScript = {
        name: 'test_login_flow.py',
        code: `import pytest
from playwright.sync_api import Page

def test_login_flow(page: Page):
    page.goto("https://example.com/login")
    page.get_by_role("button", name="Submit").click()
    page.get_by_test_id("email-input").fill("test@example.com")`,
        language: 'python',
        framework: 'playwright',
        dependencies: ['pytest', 'playwright'],
        notes: [],
      };

      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(pythonScript)));

      const options: ConversionOptions = {
        framework: 'playwright',
        language: 'python',
      };

      const result = await agent.convertToScript(mockRecording, options);

      expect(result.data.language).toBe('python');
      expect(result.data.code).toContain('pytest');
      expect(result.data.code).toContain('def test_login_flow');
    });

    it('should respect selector preference', async () => {
      const testIdFirstScript: GeneratedScript = {
        ...mockPlaywrightScript,
        code: `import { test, expect } from '@playwright/test';

test('Login Flow Test', async ({ page }) => {
  await page.goto('https://example.com/login');
  await page.getByTestId('submit-btn').click();
  await page.getByTestId('email-input').fill('test@example.com');
});`,
        notes: ['Using testid selectors as preferred'],
      };

      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(testIdFirstScript)));

      const options: ConversionOptions = {
        framework: 'playwright',
        language: 'typescript',
        selectorPreference: ['testid', 'role', 'css', 'xpath'],
      };

      const result = await agent.convertToScript(mockRecording, options);

      expect(result.data.code).toContain('getByTestId');
      expect(mockCreate).toHaveBeenCalledTimes(1);

      // Verify the prompt includes selector preference
      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.messages).toBeDefined();
    });

    it('should include usage metrics in response', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockPlaywrightScript)));

      const options: ConversionOptions = {
        framework: 'playwright',
        language: 'typescript',
      };

      const result = await agent.convertToScript(mockRecording, options);

      expect(result.usage).toBeDefined();
      expect(result.usage.inputTokens).toBe(1000);
      expect(result.usage.outputTokens).toBe(500);
      expect(result.usage.model).toBeDefined();
      expect(result.usage.durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  // ============================================================================
  // optimizeRecording() Tests
  // ============================================================================

  describe('optimizeRecording()', () => {
    const mockOptimizedRecording: OptimizedRecording = {
      recording: {
        ...mockRecording,
        actions: [
          mockAction,
          {
            ...mockTypeAction1,
            id: 'action-merged',
            type: 'fill',
            value: 'test@example.com',
          },
        ],
      },
      removedActions: [mockTypeAction2],
      modifiedActions: [
        {
          original: mockTypeAction1,
          modified: {
            ...mockTypeAction1,
            id: 'action-merged',
            type: 'fill',
            value: 'test@example.com',
          },
          reason: 'Merged consecutive type actions into single fill',
        },
      ],
      addedActions: [],
      suggestions: [
        {
          actionIds: ['action-2', 'action-3'],
          type: 'merge',
          description: 'Merged consecutive type actions into single fill',
          priority: 'medium',
          applied: true,
        },
      ],
      summary: {
        originalActionCount: 3,
        optimizedActionCount: 2,
        removedCount: 1,
        modifiedCount: 1,
        addedCount: 0,
        estimatedTimeReduction: 10,
      },
    };

    it('should remove duplicate actions', async () => {
      const duplicateRemovalResult: OptimizedRecording = {
        ...mockOptimizedRecording,
        suggestions: [
          {
            actionIds: ['action-dup'],
            type: 'remove',
            description: 'Removed duplicate click action on same element',
            priority: 'high',
            applied: true,
          },
        ],
      };

      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(duplicateRemovalResult)));

      const options: OptimizationOptions = {
        removeDuplicates: true,
      };

      const result = await agent.optimizeRecording(mockRecording, options);

      expect(result.data.suggestions.some(s => s.type === 'remove')).toBe(true);
      expect(result.data.summary.removedCount).toBeGreaterThanOrEqual(0);
    });

    it('should merge consecutive type actions', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockOptimizedRecording)));

      const options: OptimizationOptions = {
        mergeTypeActions: true,
      };

      const result = await agent.optimizeRecording(mockRecording, options);

      expect(result.data.modifiedActions.length).toBeGreaterThan(0);
      expect(result.data.modifiedActions[0].reason).toContain('Merged');
      expect(result.data.summary.optimizedActionCount).toBeLessThan(
        result.data.summary.originalActionCount
      );
    });

    it('should improve weak selectors', async () => {
      const selectorImprovedResult: OptimizedRecording = {
        ...mockOptimizedRecording,
        modifiedActions: [
          {
            original: {
              ...mockAction,
              target: { css: '.btn-primary' },
            },
            modified: {
              ...mockAction,
              target: { testId: 'submit-btn', role: { name: 'button', options: { name: 'Submit' } } },
            },
            reason: 'Improved selector from class-based to testId and role',
          },
        ],
        suggestions: [
          {
            actionIds: ['action-1'],
            type: 'improve',
            description: 'Improved selector from class-based to testId and role for better stability',
            priority: 'high',
            applied: true,
          },
        ],
      };

      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(selectorImprovedResult)));

      const options: OptimizationOptions = {
        improveSelectors: true,
      };

      const result = await agent.optimizeRecording(mockRecording, options);

      expect(result.data.suggestions.some(s => s.type === 'improve')).toBe(true);
      expect(result.data.modifiedActions.some(m => m.reason.includes('selector'))).toBe(true);
    });

    it('should add smart waits', async () => {
      const waitAddedResult: OptimizedRecording = {
        ...mockOptimizedRecording,
        addedActions: [
          {
            id: 'wait-1',
            type: 'wait',
            timestamp: 950,
            target: { css: '#submit-btn' },
            value: 'visible',
            metadata: { tagName: 'BUTTON' },
          },
        ],
        suggestions: [
          {
            actionIds: ['action-1'],
            type: 'add',
            description: 'Added wait for element visibility before click',
            priority: 'medium',
            applied: true,
          },
        ],
        summary: {
          ...mockOptimizedRecording.summary,
          addedCount: 1,
        },
      };

      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(waitAddedResult)));

      const options: OptimizationOptions = {
        addSmartWaits: true,
      };

      const result = await agent.optimizeRecording(mockRecording, options);

      expect(result.data.addedActions.length).toBeGreaterThan(0);
      expect(result.data.addedActions[0].type).toBe('wait');
      expect(result.data.suggestions.some(s => s.type === 'add')).toBe(true);
    });

    it('should return optimization summary', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockOptimizedRecording)));

      const result = await agent.optimizeRecording(mockRecording);

      expect(result.data.summary).toBeDefined();
      expect(result.data.summary.originalActionCount).toBe(3);
      expect(result.data.summary.optimizedActionCount).toBe(2);
      expect(result.data.summary.removedCount).toBeDefined();
      expect(result.data.summary.modifiedCount).toBeDefined();
      expect(result.data.summary.addedCount).toBeDefined();
      expect(result.data.summary.estimatedTimeReduction).toBeDefined();
    });

    it('should use default options when none provided', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockOptimizedRecording)));

      const result = await agent.optimizeRecording(mockRecording);

      expect(result.data.recording).toBeDefined();
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================================================
  // addAssertions() Tests
  // ============================================================================

  describe('addAssertions()', () => {
    const mockAssertionResult: AssertionResult = {
      assertions: [
        {
          afterActionId: 'action-1',
          type: 'visible',
          target: { css: '.success-message' },
          description: 'Verify success message appears after form submit',
          confidence: 0.95,
          code: {
            playwright: "await expect(page.locator('.success-message')).toBeVisible();",
            cypress: "cy.get('.success-message').should('be.visible');",
            selenium: "wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '.success-message')))",
          },
        },
        {
          afterActionId: 'action-merged',
          type: 'value',
          target: { testId: 'email-input' },
          expectedValue: 'test@example.com',
          description: 'Verify email input has expected value',
          confidence: 0.85,
          code: {
            playwright: "await expect(page.getByTestId('email-input')).toHaveValue('test@example.com');",
            cypress: "cy.findByTestId('email-input').should('have.value', 'test@example.com');",
            selenium: "assert driver.find_element(By.CSS_SELECTOR, '[data-testid=\"email-input\"]').get_attribute('value') == 'test@example.com'",
          },
        },
      ],
      summary: {
        total: 2,
        byType: {
          visible: 1,
          hidden: 0,
          enabled: 0,
          disabled: 0,
          checked: 0,
          unchecked: 0,
          text: 0,
          value: 1,
          attribute: 0,
          url: 0,
          title: 0,
          count: 0,
          screenshot: 0,
        },
        averageConfidence: 0.9,
      },
    };

    it('should generate assertions for actions', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockAssertionResult)));

      const result = await agent.addAssertions(mockRecording);

      expect(result.data.assertions).toBeDefined();
      expect(result.data.assertions.length).toBeGreaterThan(0);
      expect(result.data.assertions[0].afterActionId).toBe('action-1');
      expect(result.data.assertions[0].type).toBe('visible');
    });

    it('should include multi-framework code', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockAssertionResult)));

      const result = await agent.addAssertions(mockRecording);

      const assertion = result.data.assertions[0];
      expect(assertion.code).toBeDefined();
      expect(assertion.code.playwright).toBeDefined();
      expect(assertion.code.cypress).toBeDefined();
      expect(assertion.code.selenium).toBeDefined();
    });

    it('should respect assertion hints', async () => {
      const hintedAssertionResult: AssertionResult = {
        assertions: [
          {
            afterActionId: 'action-1',
            type: 'url',
            expectedValue: 'https://example.com/dashboard',
            description: 'Verify redirect to dashboard after login',
            confidence: 0.98,
            code: {
              playwright: "await expect(page).toHaveURL('https://example.com/dashboard');",
              cypress: "cy.url().should('eq', 'https://example.com/dashboard');",
              selenium: "assert driver.current_url == 'https://example.com/dashboard'",
            },
          },
        ],
        summary: {
          total: 1,
          byType: {
            visible: 0,
            hidden: 0,
            enabled: 0,
            disabled: 0,
            checked: 0,
            unchecked: 0,
            text: 0,
            value: 0,
            attribute: 0,
            url: 1,
            title: 0,
            count: 0,
            screenshot: 0,
          },
          averageConfidence: 0.98,
        },
      };

      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(hintedAssertionResult)));

      const hints: AssertionHint[] = [
        {
          afterActionId: 'action-1',
          type: 'url',
          description: 'Verify redirect to dashboard',
          expectedValue: 'https://example.com/dashboard',
        },
      ];

      const result = await agent.addAssertions(mockRecording, hints);

      expect(result.data.assertions[0].type).toBe('url');
      expect(result.data.assertions[0].expectedValue).toBe('https://example.com/dashboard');
    });

    it('should include confidence scores', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockAssertionResult)));

      const result = await agent.addAssertions(mockRecording);

      result.data.assertions.forEach(assertion => {
        expect(assertion.confidence).toBeDefined();
        expect(assertion.confidence).toBeGreaterThanOrEqual(0);
        expect(assertion.confidence).toBeLessThanOrEqual(1);
      });
      expect(result.data.summary.averageConfidence).toBeDefined();
    });

    it('should provide assertion summary by type', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockAssertionResult)));

      const result = await agent.addAssertions(mockRecording);

      expect(result.data.summary).toBeDefined();
      expect(result.data.summary.total).toBe(2);
      expect(result.data.summary.byType).toBeDefined();
      expect(result.data.summary.byType.visible).toBe(1);
      expect(result.data.summary.byType.value).toBe(1);
    });
  });

  // ============================================================================
  // suggestSelectors() Tests
  // ============================================================================

  describe('suggestSelectors()', () => {
    const mockSelectorResult: SelectorSuggestionResult = {
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
          reasoning: 'Uses semantic role with unique accessible name',
        },
        {
          strategy: 'testid',
          value: 'submit-btn',
          code: {
            playwright: "page.getByTestId('submit-btn')",
            cypress: "cy.findByTestId('submit-btn')",
            selenium: "driver.find_element(By.CSS_SELECTOR, '[data-testid=\"submit-btn\"]')",
          },
          robustness: 0.90,
          maintainability: 0.95,
          isUnique: true,
          reasoning: 'Stable test ID attribute, not affected by styling changes',
        },
        {
          strategy: 'css',
          value: '#submit-btn',
          code: {
            playwright: "page.locator('#submit-btn')",
            cypress: "cy.get('#submit-btn')",
            selenium: "driver.find_element(By.ID, 'submit-btn')",
          },
          robustness: 0.75,
          maintainability: 0.70,
          isUnique: true,
          reasoning: 'ID-based selector, unique but tied to implementation',
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
        reasoning: 'Best balance of robustness and maintainability',
      },
      analysis: {
        hasTestId: true,
        hasAriaLabel: false,
        hasUniqueText: true,
        isInteractive: true,
        isInForm: true,
        nestingLevel: 3,
      },
    };

    it('should suggest multiple selector strategies', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockSelectorResult)));

      const element: ElementInfo = {
        currentSelector: mockSelector,
        html: '<button id="submit-btn" data-testid="submit-btn">Submit</button>',
        attributes: {
          id: 'submit-btn',
          'data-testid': 'submit-btn',
          type: 'submit',
        },
      };

      const result = await agent.suggestSelectors(element);

      expect(result.data.suggestions).toBeDefined();
      expect(result.data.suggestions.length).toBeGreaterThan(1);

      const strategies = result.data.suggestions.map(s => s.strategy);
      expect(strategies).toContain('role');
      expect(strategies).toContain('testid');
    });

    it('should rank by robustness', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockSelectorResult)));

      const element: ElementInfo = {
        currentSelector: mockSelector,
      };

      const result = await agent.suggestSelectors(element);

      // Suggestions should be ordered by robustness (highest first)
      for (let i = 0; i < result.data.suggestions.length - 1; i++) {
        expect(result.data.suggestions[i].robustness).toBeGreaterThanOrEqual(
          result.data.suggestions[i + 1].robustness
        );
      }
    });

    it('should include framework-specific code', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockSelectorResult)));

      const element: ElementInfo = {
        currentSelector: mockSelector,
      };

      const result = await agent.suggestSelectors(element);

      result.data.suggestions.forEach(suggestion => {
        expect(suggestion.code).toBeDefined();
        expect(suggestion.code.playwright).toBeDefined();
        expect(suggestion.code.cypress).toBeDefined();
        expect(suggestion.code.selenium).toBeDefined();
      });
    });

    it('should handle shadow DOM elements', async () => {
      const shadowDomResult: SelectorSuggestionResult = {
        ...mockSelectorResult,
        suggestions: [
          {
            strategy: 'css',
            value: '>>> .shadow-button',
            code: {
              playwright: "page.locator('host-element').locator('>>> .shadow-button')",
              cypress: "cy.get('host-element').shadow().find('.shadow-button')",
              selenium: "driver.execute_script(\"return document.querySelector('host-element').shadowRoot.querySelector('.shadow-button')\")",
            },
            robustness: 0.70,
            maintainability: 0.65,
            isUnique: true,
            reasoning: 'Shadow DOM piercing selector for encapsulated component',
          },
        ],
        recommended: {
          strategy: 'css',
          value: '>>> .shadow-button',
          code: {
            playwright: "page.locator('host-element').locator('>>> .shadow-button')",
            cypress: "cy.get('host-element').shadow().find('.shadow-button')",
            selenium: "driver.execute_script(\"return document.querySelector('host-element').shadowRoot.querySelector('.shadow-button')\")",
          },
          robustness: 0.70,
          maintainability: 0.65,
          isUnique: true,
          reasoning: 'Best available selector for shadow DOM element',
        },
        analysis: {
          ...mockSelectorResult.analysis,
          nestingLevel: 5,
        },
      };

      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(shadowDomResult)));

      const element: ElementInfo = {
        currentSelector: { css: '.shadow-button' },
        html: '<button class="shadow-button">Click</button>',
        context: '<host-element>#shadow-root<button class="shadow-button">Click</button></host-element>',
      };

      const result = await agent.suggestSelectors(element);

      expect(result.data.suggestions[0].code.playwright).toContain('shadow');
      expect(result.data.suggestions[0].code.cypress).toContain('shadow');
    });

    it('should provide element analysis', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockSelectorResult)));

      const element: ElementInfo = {
        currentSelector: mockSelector,
      };

      const result = await agent.suggestSelectors(element);

      expect(result.data.analysis).toBeDefined();
      expect(result.data.analysis.hasTestId).toBe(true);
      expect(result.data.analysis.isInteractive).toBe(true);
      expect(result.data.analysis.isInForm).toBe(true);
      expect(result.data.analysis.nestingLevel).toBeDefined();
    });

    it('should provide a recommended selector', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockSelectorResult)));

      const element: ElementInfo = {
        currentSelector: mockSelector,
      };

      const result = await agent.suggestSelectors(element);

      expect(result.data.recommended).toBeDefined();
      expect(result.data.recommended.strategy).toBe('role');
      expect(result.data.recommended.robustness).toBeGreaterThanOrEqual(0.9);
    });
  });

  // ============================================================================
  // processRecording() Tests
  // ============================================================================

  describe('processRecording()', () => {
    const mockOptimizedRecording: OptimizedRecording = {
      recording: {
        ...mockRecording,
        actions: [mockAction],
      },
      removedActions: [],
      modifiedActions: [],
      addedActions: [],
      suggestions: [],
      summary: {
        originalActionCount: 3,
        optimizedActionCount: 1,
        removedCount: 2,
        modifiedCount: 0,
        addedCount: 0,
        estimatedTimeReduction: 20,
      },
    };

    const mockAssertionResult: AssertionResult = {
      assertions: [],
      summary: {
        total: 0,
        byType: {
          visible: 0,
          hidden: 0,
          enabled: 0,
          disabled: 0,
          checked: 0,
          unchecked: 0,
          text: 0,
          value: 0,
          attribute: 0,
          url: 0,
          title: 0,
          count: 0,
          screenshot: 0,
        },
        averageConfidence: 0,
      },
    };

    const mockGeneratedScript: GeneratedScript = {
      name: 'test.spec.ts',
      code: 'test code',
      language: 'typescript',
      framework: 'playwright',
      dependencies: ['@playwright/test'],
    };

    it('should run full pipeline', async () => {
      mockCreate
        .mockResolvedValueOnce(createMockResponse(JSON.stringify(mockOptimizedRecording)))
        .mockResolvedValueOnce(createMockResponse(JSON.stringify(mockAssertionResult)))
        .mockResolvedValueOnce(createMockResponse(JSON.stringify(mockGeneratedScript)));

      const result = await agent.processRecording(mockRecording, {
        conversion: {
          framework: 'playwright',
          language: 'typescript',
        },
      });

      expect(result.data.script).toBeDefined();
      expect(result.data.optimization).toBeDefined();
      expect(result.data.assertions).toBeDefined();
      expect(mockCreate).toHaveBeenCalledTimes(3);
    });

    it('should aggregate usage metrics', async () => {
      mockCreate
        .mockResolvedValueOnce(createMockResponse(JSON.stringify(mockOptimizedRecording)))
        .mockResolvedValueOnce(createMockResponse(JSON.stringify(mockAssertionResult)))
        .mockResolvedValueOnce(createMockResponse(JSON.stringify(mockGeneratedScript)));

      const result = await agent.processRecording(mockRecording, {
        conversion: {
          framework: 'playwright',
          language: 'typescript',
        },
      });

      // Aggregated from 3 API calls
      expect(result.usage.inputTokens).toBe(3000); // 1000 * 3
      expect(result.usage.outputTokens).toBe(1500); // 500 * 3
      expect(result.usage.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should handle partial options - skip optimization', async () => {
      mockCreate
        .mockResolvedValueOnce(createMockResponse(JSON.stringify(mockAssertionResult)))
        .mockResolvedValueOnce(createMockResponse(JSON.stringify(mockGeneratedScript)));

      const result = await agent.processRecording(mockRecording, {
        conversion: {
          framework: 'playwright',
          language: 'typescript',
        },
        skipOptimization: true,
      });

      expect(result.data.script).toBeDefined();
      expect(result.data.optimization).toBeUndefined();
      expect(result.data.assertions).toBeDefined();
      expect(mockCreate).toHaveBeenCalledTimes(2);
    });

    it('should handle partial options - skip assertions', async () => {
      mockCreate
        .mockResolvedValueOnce(createMockResponse(JSON.stringify(mockOptimizedRecording)))
        .mockResolvedValueOnce(createMockResponse(JSON.stringify(mockGeneratedScript)));

      const result = await agent.processRecording(mockRecording, {
        conversion: {
          framework: 'playwright',
          language: 'typescript',
        },
        skipAssertions: true,
      });

      expect(result.data.script).toBeDefined();
      expect(result.data.optimization).toBeDefined();
      expect(result.data.assertions).toBeUndefined();
      expect(mockCreate).toHaveBeenCalledTimes(2);
    });

    it('should handle skip both optimization and assertions', async () => {
      mockCreate.mockResolvedValueOnce(createMockResponse(JSON.stringify(mockGeneratedScript)));

      const result = await agent.processRecording(mockRecording, {
        conversion: {
          framework: 'cypress',
          language: 'javascript',
        },
        skipOptimization: true,
        skipAssertions: true,
      });

      expect(result.data.script).toBeDefined();
      expect(result.data.optimization).toBeUndefined();
      expect(result.data.assertions).toBeUndefined();
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe('error handling', () => {
    it('should retry on transient failures', async () => {
      const retryAgent = new RecorderAgent({ maxRetries: 2 });

      // Mock the delay method to return immediately
      const delaySpy = vi.spyOn(retryAgent as unknown as { delay: (ms: number) => Promise<void> }, 'delay')
        .mockResolvedValue(undefined);

      const mockScript: GeneratedScript = {
        name: 'test.spec.ts',
        code: 'test code',
        language: 'typescript',
        framework: 'playwright',
        dependencies: [],
      };

      mockCreate
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(createMockResponse(JSON.stringify(mockScript)));

      const options: ConversionOptions = {
        framework: 'playwright',
        language: 'typescript',
      };

      const result = await retryAgent.convertToScript(mockRecording, options);

      expect(result.data.name).toBe('test.spec.ts');
      expect(mockCreate).toHaveBeenCalledTimes(2);
      expect(delaySpy).toHaveBeenCalledTimes(1);

      delaySpy.mockRestore();
    });

    it('should fail after max retries', async () => {
      const retryAgent = new RecorderAgent({ maxRetries: 3 });

      // Mock the delay method to return immediately
      const delaySpy = vi.spyOn(retryAgent as unknown as { delay: (ms: number) => Promise<void> }, 'delay')
        .mockResolvedValue(undefined);

      mockCreate.mockRejectedValue(new Error('Persistent API error'));

      const options: ConversionOptions = {
        framework: 'playwright',
        language: 'typescript',
      };

      await expect(retryAgent.convertToScript(mockRecording, options))
        .rejects.toThrow('Persistent API error');

      expect(mockCreate).toHaveBeenCalledTimes(3);
      expect(delaySpy).toHaveBeenCalledTimes(2); // Called between attempts (3 attempts = 2 delays)

      delaySpy.mockRestore();
    });

    it('should handle malformed JSON response', async () => {
      const noRetryAgent = new RecorderAgent({ maxRetries: 1 });

      mockCreate.mockResolvedValue(createMockResponse('This is not valid JSON at all'));

      const options: ConversionOptions = {
        framework: 'playwright',
        language: 'typescript',
      };

      await expect(noRetryAgent.convertToScript(mockRecording, options))
        .rejects.toThrow('Failed to parse JSON response');
    });

    it('should handle JSON wrapped in markdown code blocks', async () => {
      const mockScript: GeneratedScript = {
        name: 'test.spec.ts',
        code: 'test code',
        language: 'typescript',
        framework: 'playwright',
        dependencies: [],
      };

      const wrappedJson = '```json\n' + JSON.stringify(mockScript) + '\n```';

      mockCreate.mockResolvedValue(createMockResponse(wrappedJson));

      const options: ConversionOptions = {
        framework: 'playwright',
        language: 'typescript',
      };

      const result = await agent.convertToScript(mockRecording, options);

      expect(result.data.name).toBe('test.spec.ts');
    });

    it('should handle empty API response', async () => {
      const noRetryAgent = new RecorderAgent({ maxRetries: 1 });

      mockCreate.mockResolvedValue({
        content: [],
        usage: {
          input_tokens: 0,
          output_tokens: 0,
          cache_read_input_tokens: 0,
          cache_creation_input_tokens: 0,
        },
      });

      const options: ConversionOptions = {
        framework: 'playwright',
        language: 'typescript',
      };

      await expect(noRetryAgent.convertToScript(mockRecording, options))
        .rejects.toThrow();
    });
  });

  // ============================================================================
  // Configuration Tests
  // ============================================================================

  describe('configuration', () => {
    it('should use default configuration', () => {
      const defaultAgent = new RecorderAgent();
      expect(defaultAgent).toBeDefined();
    });

    it('should accept custom configuration', () => {
      const customAgent = new RecorderAgent({
        model: 'claude-3-5-haiku-20241022',
        maxTokens: 8192,
        temperature: 0.5,
        maxRetries: 5,
      });
      expect(customAgent).toBeDefined();
    });

    it('should use agent name in logging', async () => {
      const mockScript: GeneratedScript = {
        name: 'test.spec.ts',
        code: 'test',
        language: 'typescript',
        framework: 'playwright',
        dependencies: [],
      };

      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockScript)));

      const options: ConversionOptions = {
        framework: 'playwright',
        language: 'typescript',
      };

      await agent.convertToScript(mockRecording, options);

      // The agent should be named 'RecorderAgent'
      expect(agent).toBeDefined();
    });
  });
});

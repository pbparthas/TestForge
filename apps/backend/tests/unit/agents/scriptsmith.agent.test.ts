/**
 * ScriptSmith Agent Tests
 * Characterization tests for prompt building + unit tests for extracted methods
 */

const { mockAnthropicCreate, mockDuplicateService } = vi.hoisted(() => ({
  mockAnthropicCreate: vi.fn(),
  mockDuplicateService: {
    checkScript: vi.fn(),
  },
}));

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = {
      create: mockAnthropicCreate,
    };
  },
}));

vi.mock('../../../src/services/duplicate.service.js', () => ({
  duplicateDetectionService: mockDuplicateService,
}));

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ScriptSmithAgent } from '../../../src/agents/scriptsmith.agent.js';
import type { GenerateScriptInput } from '../../../src/agents/scriptsmith.agent.js';

describe('ScriptSmithAgent', () => {
  let agent: ScriptSmithAgent;

  beforeEach(() => {
    vi.clearAllMocks();
    agent = new ScriptSmithAgent();
  });

  // Access private methods via casting for unit testing
  const callBuildGeneratePrompt = (agent: ScriptSmithAgent, input: GenerateScriptInput): string => {
    return (agent as any).buildGeneratePrompt(input);
  };

  const callBuildScreenshotPrompt = (agent: ScriptSmithAgent, input: GenerateScriptInput): string => {
    return (agent as any).buildScreenshotPrompt(input);
  };

  const callBuildInputMethodSection = (agent: ScriptSmithAgent, input: GenerateScriptInput): string => {
    return (agent as any).buildInputMethodSection(input);
  };

  const callBuildDeviceTargetSection = (agent: ScriptSmithAgent, deviceTarget: object): string => {
    return (agent as any).buildDeviceTargetSection(deviceTarget);
  };

  const callBuildBasicOptionsSection = (agent: ScriptSmithAgent, options: object, framework: string, language: string): string => {
    return (agent as any).buildBasicOptionsSection(options, framework, language);
  };

  const callBuildTransformationOptionsSection = (agent: ScriptSmithAgent, options: object): string => {
    return (agent as any).buildTransformationOptionsSection(options);
  };

  // =========================================================================
  // buildInputMethodSection
  // =========================================================================
  describe('buildInputMethodSection', () => {
    it('should build test case section with title, preconditions, and steps', () => {
      const input: GenerateScriptInput = {
        inputMethod: 'test_case',
        testCase: {
          title: 'Login Test',
          preconditions: 'User exists',
          steps: [
            { order: 1, action: 'Navigate to login', expected: 'Login page loads' },
            { order: 2, action: 'Enter credentials', expected: 'Fields populated' },
          ],
        },
      };

      const result = callBuildInputMethodSection(agent, input);

      expect(result).toContain('TEST CASE:');
      expect(result).toContain('Title: Login Test');
      expect(result).toContain('Preconditions: User exists');
      expect(result).toContain('1. Action: Navigate to login');
      expect(result).toContain('Expected: Login page loads');
      expect(result).toContain('2. Action: Enter credentials');
    });

    it('should build test case section without preconditions', () => {
      const input: GenerateScriptInput = {
        inputMethod: 'test_case',
        testCase: {
          title: 'Simple Test',
          steps: [{ order: 1, action: 'Click button', expected: 'Button clicked' }],
        },
      };

      const result = callBuildInputMethodSection(agent, input);

      expect(result).toContain('Title: Simple Test');
      expect(result).not.toContain('Preconditions:');
    });

    it('should build recording section with JSON actions', () => {
      const input: GenerateScriptInput = {
        inputMethod: 'recording',
        recording: {
          actions: [
            { type: 'navigate', url: 'http://example.com' },
            { type: 'click', selector: '#btn' },
          ],
        },
      };

      const result = callBuildInputMethodSection(agent, input);

      expect(result).toContain('RECORDED ACTIONS:');
      expect(result).toContain('"type": "navigate"');
      expect(result).toContain('"type": "click"');
    });

    it('should build description section', () => {
      const input: GenerateScriptInput = {
        inputMethod: 'description',
        description: 'Test the login flow end to end',
      };

      const result = callBuildInputMethodSection(agent, input);

      expect(result).toContain('DESCRIPTION:');
      expect(result).toContain('Test the login flow end to end');
    });

    it('should return empty string for screenshot input method', () => {
      const input: GenerateScriptInput = {
        inputMethod: 'screenshot',
        screenshot: { base64: 'abc' },
      };

      const result = callBuildInputMethodSection(agent, input);

      expect(result).toBe('');
    });
  });

  // =========================================================================
  // buildDeviceTargetSection
  // =========================================================================
  describe('buildDeviceTargetSection', () => {
    it('should build basic device target with type and viewport', () => {
      const result = callBuildDeviceTargetSection(agent, {
        type: 'desktop',
        viewport: { width: 1920, height: 1080 },
      });

      expect(result).toContain('DEVICE TARGET:');
      expect(result).toContain('- Type: desktop');
      expect(result).toContain('- Viewport: 1920x1080');
    });

    it('should include device name when present', () => {
      const result = callBuildDeviceTargetSection(agent, {
        type: 'mobile',
        viewport: { width: 375, height: 812 },
        deviceName: 'iPhone 13',
      });

      expect(result).toContain('- Device: iPhone 13');
    });

    it('should include touch enabled when true', () => {
      const result = callBuildDeviceTargetSection(agent, {
        type: 'mobile',
        viewport: { width: 375, height: 812 },
        isTouchEnabled: true,
      });

      expect(result).toContain('- Touch enabled: yes');
    });

    it('should include viewport config note when userAgent is set', () => {
      const result = callBuildDeviceTargetSection(agent, {
        type: 'mobile',
        viewport: { width: 375, height: 812 },
        userAgent: 'Mozilla/5.0 (iPhone; ...',
      });

      expect(result).toContain('- Include viewport configuration in test setup');
    });

    it('should not include optional fields when not present', () => {
      const result = callBuildDeviceTargetSection(agent, {
        type: 'desktop',
        viewport: { width: 1920, height: 1080 },
      });

      expect(result).not.toContain('Device:');
      expect(result).not.toContain('Touch enabled');
      expect(result).not.toContain('viewport configuration');
    });
  });

  // =========================================================================
  // buildBasicOptionsSection
  // =========================================================================
  describe('buildBasicOptionsSection', () => {
    it('should include framework, language, and page objects default', () => {
      const result = callBuildBasicOptionsSection(agent, {}, 'playwright', 'typescript');

      expect(result).toContain('OPTIONS:');
      expect(result).toContain('- Framework: playwright');
      expect(result).toContain('- Language: typescript');
      expect(result).toContain('- Include Page Objects: false');
    });

    it('should include base URL when provided', () => {
      const result = callBuildBasicOptionsSection(agent, { baseUrl: 'http://localhost:3000' }, 'cypress', 'javascript');

      expect(result).toContain('- Base URL: http://localhost:3000');
    });

    it('should include existing helpers when provided', () => {
      const result = callBuildBasicOptionsSection(agent, {
        useExistingHelpers: ['loginHelper', 'apiHelper'],
      }, 'playwright', 'typescript');

      expect(result).toContain('- Use these existing helpers: loginHelper, apiHelper');
    });

    it('should show page objects as true when set', () => {
      const result = callBuildBasicOptionsSection(agent, { includePageObjects: true }, 'playwright', 'typescript');

      expect(result).toContain('- Include Page Objects: true');
    });
  });

  // =========================================================================
  // buildTransformationOptionsSection
  // =========================================================================
  describe('buildTransformationOptionsSection', () => {
    it('should return empty string when no transformation options set', () => {
      const result = callBuildTransformationOptionsSection(agent, {});

      // Only includeComments defaults to including the line (since !== false)
      expect(result).toContain('Include comments explaining each step');
    });

    it('should include all transformation options when set', () => {
      const result = callBuildTransformationOptionsSection(agent, {
        extractUtilities: true,
        addLogging: true,
        generateRandomData: true,
        includeComments: true,
        waitStrategy: 'conservative',
        selectorPreference: 'testid',
        codeStyle: 'playwright-best-practices',
      });

      expect(result).toContain('Extract reusable code');
      expect(result).toContain('console.log statements');
      expect(result).toContain('randomized test data');
      expect(result).toContain('Include comments');
      expect(result).toContain('Wait strategy: conservative');
      expect(result).toContain('Selector preference: testid');
      expect(result).toContain('Code style: playwright-best-practices');
    });

    it('should exclude comments line when includeComments is false', () => {
      const result = callBuildTransformationOptionsSection(agent, {
        includeComments: false,
      });

      expect(result).not.toContain('Include comments');
    });
  });

  // =========================================================================
  // buildGeneratePrompt — characterization tests
  // =========================================================================
  describe('buildGeneratePrompt', () => {
    it('should produce correct prompt for test_case input with defaults', () => {
      const input: GenerateScriptInput = {
        inputMethod: 'test_case',
        testCase: {
          title: 'Login Test',
          steps: [
            { order: 1, action: 'Go to login', expected: 'Page loads' },
          ],
        },
      };

      const prompt = callBuildGeneratePrompt(agent, input);

      expect(prompt).toMatch(/^Generate a playwright test script in typescript\.\n/);
      expect(prompt).toContain('TEST CASE:');
      expect(prompt).toContain('Title: Login Test');
      expect(prompt).toContain('DEVICE TARGET:');
      expect(prompt).toContain('- Type: desktop');
      expect(prompt).toContain('- Viewport: 1920x1080');
      expect(prompt).toContain('OPTIONS:');
      expect(prompt).toContain('- Framework: playwright');
      expect(prompt).toContain('Return the script as a JSON object.');
    });

    it('should produce correct prompt for recording input with custom options', () => {
      const input: GenerateScriptInput = {
        inputMethod: 'recording',
        recording: {
          actions: [{ type: 'click', selector: '#btn' }],
        },
        options: {
          framework: 'cypress',
          language: 'javascript',
          extractUtilities: true,
          waitStrategy: 'minimal',
        },
      };

      const prompt = callBuildGeneratePrompt(agent, input);

      expect(prompt).toMatch(/^Generate a cypress test script in javascript\.\n/);
      expect(prompt).toContain('RECORDED ACTIONS:');
      expect(prompt).toContain('- Framework: cypress');
      expect(prompt).toContain('- Language: javascript');
      expect(prompt).toContain('Extract reusable code');
      expect(prompt).toContain('Wait strategy: minimal');
    });

    it('should produce correct prompt for description input', () => {
      const input: GenerateScriptInput = {
        inputMethod: 'description',
        description: 'Test user registration',
        options: {
          baseUrl: 'http://localhost:3000',
          selectorPreference: 'role',
        },
      };

      const prompt = callBuildGeneratePrompt(agent, input);

      expect(prompt).toContain('DESCRIPTION:\nTest user registration');
      expect(prompt).toContain('- Base URL: http://localhost:3000');
      expect(prompt).toContain('- Selector preference: role');
    });

    it('should handle device target with all properties', () => {
      const input: GenerateScriptInput = {
        inputMethod: 'description',
        description: 'Test mobile flow',
        options: {
          deviceTarget: {
            type: 'mobile',
            viewport: { width: 375, height: 812 },
            deviceName: 'iPhone 13',
            isTouchEnabled: true,
            userAgent: 'Mozilla/5.0 (iPhone)',
          },
        },
      };

      const prompt = callBuildGeneratePrompt(agent, input);

      expect(prompt).toContain('- Type: mobile');
      expect(prompt).toContain('- Viewport: 375x812');
      expect(prompt).toContain('- Device: iPhone 13');
      expect(prompt).toContain('- Touch enabled: yes');
      expect(prompt).toContain('- Include viewport configuration in test setup');
    });
  });

  // =========================================================================
  // buildScreenshotPrompt — characterization tests
  // =========================================================================
  describe('buildScreenshotPrompt', () => {
    it('should produce correct prompt with URL and annotations', () => {
      const input: GenerateScriptInput = {
        inputMethod: 'screenshot',
        screenshot: {
          base64: 'abc',
          url: 'http://example.com/login',
          annotations: [
            { x: 100, y: 200, label: 'Email field', type: 'input' },
            { x: 300, y: 400, label: 'Submit' },
          ],
        },
      };

      const prompt = callBuildScreenshotPrompt(agent, input);

      expect(prompt).toContain('based on the attached screenshot');
      expect(prompt).toContain('Page URL: http://example.com/login');
      expect(prompt).toContain('ANNOTATIONS');
      expect(prompt).toContain('At (100, 200): "Email field" [input]');
      expect(prompt).toContain('At (300, 400): "Submit"');
      expect(prompt).not.toContain('[undefined]');
      expect(prompt).toContain('DEVICE TARGET:');
      expect(prompt).toContain('- Type: desktop');
      expect(prompt).toContain('OPTIONS:');
      expect(prompt).toContain('Return as JSON.');
    });

    it('should produce correct prompt without URL or annotations', () => {
      const input: GenerateScriptInput = {
        inputMethod: 'screenshot',
        screenshot: { base64: 'abc' },
        options: {
          selectorPreference: 'testid',
          waitStrategy: 'conservative',
        },
      };

      const prompt = callBuildScreenshotPrompt(agent, input);

      expect(prompt).not.toContain('Page URL:');
      expect(prompt).not.toContain('ANNOTATIONS');
      expect(prompt).toContain('- Selector preference: testid');
      expect(prompt).toContain('- Wait strategy: conservative');
      expect(prompt).toContain('Include comments explaining inferred actions');
    });

    it('should reuse device target section from shared method', () => {
      const input: GenerateScriptInput = {
        inputMethod: 'screenshot',
        screenshot: { base64: 'abc' },
        options: {
          deviceTarget: {
            type: 'tablet',
            viewport: { width: 768, height: 1024 },
            deviceName: 'iPad',
          },
        },
      };

      const prompt = callBuildScreenshotPrompt(agent, input);

      expect(prompt).toContain('- Type: tablet');
      expect(prompt).toContain('- Viewport: 768x1024');
      expect(prompt).toContain('- Device: iPad');
    });
  });
});

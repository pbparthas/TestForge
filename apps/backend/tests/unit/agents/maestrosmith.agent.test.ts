/**
 * MaestroSmith Agent Tests
 * TDD for Maestro YAML flow generation and editing
 */

const { mockAnthropicCreate } = vi.hoisted(() => ({
  mockAnthropicCreate: vi.fn(),
}));

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = {
      create: mockAnthropicCreate,
    };
  },
}));

const { mockMaestroService } = vi.hoisted(() => ({
  mockMaestroService: {
    getRegistry: vi.fn(),
    getWidgets: vi.fn(),
    lookupWidget: vi.fn(),
    validateYaml: vi.fn(),
    analyzeSelectors: vi.fn(),
  },
}));

vi.mock('../../../src/services/maestro.service.js', () => ({
  maestroService: mockMaestroService,
}));

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MaestroSmithAgent, MaestroFlowInput, EditFlowInput } from '../../../src/agents/maestrosmith.agent.js';

describe('MaestroSmithAgent', () => {
  let agent: MaestroSmithAgent;

  const mockRegistry = {
    appId: 'com.bankbazaar.app',
    version: 'abc123',
    widgets: [
      { eventName: 'Login', file: 'auth/login_screen.dart', type: 'TextField' },
      { eventName: 'LoginAttempt', file: 'auth/login_screen.dart', type: 'Button' },
      { eventName: 'home_check_score_cta', file: 'home/home_body.dart', type: 'Button' },
    ],
  };

  const mockGeneratedYaml = {
    name: 'user_login.yaml',
    yaml: `appId: com.bankbazaar.app
---
- launchApp:
    clearState: true
- tapOn:
    id: Login
- inputText: "9876543210"
- hideKeyboard
- tapOn:
    id: LoginAttempt
- assertVisible: "Dashboard"`,
    commands: ['launchApp', 'tapOn', 'inputText', 'hideKeyboard', 'assertVisible'],
    warnings: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    agent = new MaestroSmithAgent();

    // Default mock for registry
    mockMaestroService.getRegistry.mockReturnValue(mockRegistry);
    mockMaestroService.getWidgets.mockReturnValue(mockRegistry.widgets);
    mockMaestroService.lookupWidget.mockImplementation((projectId: string, eventName: string) => {
      const widget = mockRegistry.widgets.find(w => w.eventName === eventName);
      return widget ? { found: true, eventName: widget.eventName, file: widget.file } : { found: false };
    });
    mockMaestroService.validateYaml.mockReturnValue({ valid: true, errors: [], warnings: [] });
    mockMaestroService.analyzeSelectors.mockReturnValue({
      totalSelectors: 2,
      idBased: 2,
      textBased: 0,
      warnings: [],
    });
  });

  describe('generate', () => {
    it('should generate Maestro YAML from test case', async () => {
      mockAnthropicCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: JSON.stringify(mockGeneratedYaml) }],
        usage: { input_tokens: 500, output_tokens: 200 },
      });

      const input: MaestroFlowInput = {
        inputMethod: 'test_case',
        testCase: {
          title: 'User Login',
          steps: [
            { order: 1, action: 'Open app', expected: 'Login screen shown' },
            { order: 2, action: 'Enter mobile number 9876543210', expected: 'Number entered' },
            { order: 3, action: 'Tap Login button', expected: 'Dashboard shown' },
          ],
        },
        options: {
          appId: 'com.bankbazaar.app',
          projectId: 'proj-123',
          includeAssertions: true,
        },
      };

      const result = await agent.generate(input);

      expect(result.data.name).toBe('user_login.yaml');
      expect(result.data.yaml).toContain('appId: com.bankbazaar.app');
      expect(result.data.commands).toContain('launchApp');
      expect(result.data.commands).toContain('tapOn');
      expect(result.usage.inputTokens).toBe(500);
      expect(result.usage.outputTokens).toBe(200);
    });

    it('should generate Maestro YAML from description', async () => {
      mockAnthropicCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: JSON.stringify(mockGeneratedYaml) }],
        usage: { input_tokens: 400, output_tokens: 180 },
      });

      const input: MaestroFlowInput = {
        inputMethod: 'description',
        description: 'Test user login with mobile number and verify dashboard is shown',
        options: {
          appId: 'com.bankbazaar.app',
          projectId: 'proj-123',
        },
      };

      const result = await agent.generate(input);

      expect(result.data.name).toBe('user_login.yaml');
      expect(result.data.yaml).toContain('appId:');
    });

    it('should include registry context in prompt when available', async () => {
      mockAnthropicCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: JSON.stringify(mockGeneratedYaml) }],
        usage: { input_tokens: 600, output_tokens: 200 },
      });

      const input: MaestroFlowInput = {
        inputMethod: 'description',
        description: 'Login test',
        options: {
          appId: 'com.bankbazaar.app',
          projectId: 'proj-123',
        },
      };

      await agent.generate(input);

      // Verify the API call included registry context
      expect(mockAnthropicCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.stringContaining('Available widget identifiers'),
            }),
          ]),
        })
      );
    });

    it('should handle missing registry gracefully', async () => {
      mockMaestroService.getRegistry.mockReturnValue(null);
      mockMaestroService.getWidgets.mockReturnValue([]);

      mockAnthropicCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: JSON.stringify({
          ...mockGeneratedYaml,
          warnings: ['No registry available - using text-based selectors'],
        }) }],
        usage: { input_tokens: 400, output_tokens: 180 },
      });

      const input: MaestroFlowInput = {
        inputMethod: 'description',
        description: 'Login test',
        options: {
          appId: 'com.bankbazaar.app',
          projectId: 'proj-123',
        },
      };

      const result = await agent.generate(input);

      expect(result.data.warnings).toContain('No registry available - using text-based selectors');
    });

    it('should include AI usage tracking', async () => {
      mockAnthropicCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: JSON.stringify(mockGeneratedYaml) }],
        usage: { input_tokens: 500, output_tokens: 200 },
      });

      const input: MaestroFlowInput = {
        inputMethod: 'description',
        description: 'Simple login test',
        options: {
          appId: 'com.bankbazaar.app',
          projectId: 'proj-123',
        },
      };

      const result = await agent.generate(input);

      expect(result.usage).toHaveProperty('inputTokens');
      expect(result.usage).toHaveProperty('outputTokens');
      expect(result.usage).toHaveProperty('costUsd');
      expect(result.usage).toHaveProperty('costInr');
      expect(result.usage).toHaveProperty('model');
      expect(result.usage).toHaveProperty('durationMs');
    });

    it('should prefer id-based selectors when registry has matches', async () => {
      mockAnthropicCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: JSON.stringify(mockGeneratedYaml) }],
        usage: { input_tokens: 500, output_tokens: 200 },
      });

      const input: MaestroFlowInput = {
        inputMethod: 'test_case',
        testCase: {
          title: 'Login Test',
          steps: [
            { order: 1, action: 'Tap on Login button', expected: 'Input field shown' },
          ],
        },
        options: {
          appId: 'com.bankbazaar.app',
          projectId: 'proj-123',
        },
      };

      await agent.generate(input);

      // System prompt should instruct AI to prefer id-based selectors
      expect(mockAnthropicCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          system: expect.stringContaining('ALWAYS prefer id-based selectors'),
        })
      );
    });
  });

  describe('edit', () => {
    const mockEditedYaml = {
      yaml: `appId: com.bankbazaar.app
---
- launchApp:
    clearState: true
- tapOn:
    id: Login
- inputText: "9876543210"
- hideKeyboard
- tapOn:
    id: LoginAttempt
- extendedWaitUntil:
    visible: "Dashboard"
    timeout: 5000`,
      changes: ['Added extendedWaitUntil instead of assertVisible for reliability'],
      explanation: 'Replaced assertVisible with extendedWaitUntil to add timeout for slow loads',
    };

    it('should edit existing Maestro YAML', async () => {
      mockAnthropicCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: JSON.stringify(mockEditedYaml) }],
        usage: { input_tokens: 600, output_tokens: 250 },
      });

      const input: EditFlowInput = {
        existingYaml: mockGeneratedYaml.yaml,
        instruction: 'Add timeout wait for Dashboard to appear',
        projectId: 'proj-123',
      };

      const result = await agent.edit(input);

      expect(result.data.yaml).toContain('extendedWaitUntil');
      expect(result.data.changes).toHaveLength(1);
      expect(result.data.explanation).toBeTruthy();
    });

    it('should fix errors based on context', async () => {
      mockAnthropicCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: JSON.stringify({
          yaml: 'fixed yaml content',
          changes: ['Changed text selector to id selector'],
          explanation: 'Fixed selector to use id instead of text',
        }) }],
        usage: { input_tokens: 500, output_tokens: 200 },
      });

      const input: EditFlowInput = {
        existingYaml: mockGeneratedYaml.yaml,
        instruction: 'Fix the failing selector',
        projectId: 'proj-123',
        context: {
          errorMessage: 'Element not found: "Login Button"',
          failedCommand: 'tapOn: "Login Button"',
        },
      };

      const result = await agent.edit(input);

      expect(result.data.changes).toContain('Changed text selector to id selector');
    });

    it('should include error context in prompt', async () => {
      mockAnthropicCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: JSON.stringify({
          yaml: 'fixed yaml',
          changes: ['Fixed selector'],
          explanation: 'Used id selector',
        }) }],
        usage: { input_tokens: 500, output_tokens: 200 },
      });

      const input: EditFlowInput = {
        existingYaml: mockGeneratedYaml.yaml,
        instruction: 'Fix selector error',
        projectId: 'proj-123',
        context: {
          errorMessage: 'Timeout waiting for element',
          failedCommand: 'tapOn: "Submit"',
        },
      };

      await agent.edit(input);

      expect(mockAnthropicCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.stringContaining('Timeout waiting for element'),
            }),
          ]),
        })
      );
    });
  });

  describe('validate', () => {
    it('should validate and analyze generated YAML', async () => {
      mockAnthropicCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: JSON.stringify(mockGeneratedYaml) }],
        usage: { input_tokens: 500, output_tokens: 200 },
      });

      const input: MaestroFlowInput = {
        inputMethod: 'description',
        description: 'Login test',
        options: {
          appId: 'com.bankbazaar.app',
          projectId: 'proj-123',
        },
      };

      const result = await agent.generate(input);

      // Should have called validateYaml and analyzeSelectors
      expect(mockMaestroService.validateYaml).toHaveBeenCalledWith(result.data.yaml);
      expect(mockMaestroService.analyzeSelectors).toHaveBeenCalledWith('proj-123', result.data.yaml);
    });

    it('should include validation warnings in result', async () => {
      mockMaestroService.analyzeSelectors.mockReturnValue({
        totalSelectors: 3,
        idBased: 1,
        textBased: 2,
        warnings: ['Text-based selector used for "Submit"', 'Text-based selector used for "Cancel"'],
      });

      mockAnthropicCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: JSON.stringify({
          ...mockGeneratedYaml,
          warnings: [],
        }) }],
        usage: { input_tokens: 500, output_tokens: 200 },
      });

      const input: MaestroFlowInput = {
        inputMethod: 'description',
        description: 'Login test',
        options: {
          appId: 'com.bankbazaar.app',
          projectId: 'proj-123',
        },
      };

      const result = await agent.generate(input);

      // Agent should merge warnings from selector analysis
      expect(result.data.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('system prompts', () => {
    it('should include Maestro command reference in system prompt', async () => {
      mockAnthropicCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: JSON.stringify(mockGeneratedYaml) }],
        usage: { input_tokens: 500, output_tokens: 200 },
      });

      const input: MaestroFlowInput = {
        inputMethod: 'description',
        description: 'Simple test',
        options: {
          appId: 'com.bankbazaar.app',
          projectId: 'proj-123',
        },
      };

      await agent.generate(input);

      expect(mockAnthropicCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          system: expect.stringContaining('tapOn'),
        })
      );
      expect(mockAnthropicCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          system: expect.stringContaining('assertVisible'),
        })
      );
      expect(mockAnthropicCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          system: expect.stringContaining('launchApp'),
        })
      );
    });

    it('should include output format spec in system prompt', async () => {
      mockAnthropicCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: JSON.stringify(mockGeneratedYaml) }],
        usage: { input_tokens: 500, output_tokens: 200 },
      });

      const input: MaestroFlowInput = {
        inputMethod: 'description',
        description: 'Test',
        options: {
          appId: 'com.bankbazaar.app',
          projectId: 'proj-123',
        },
      };

      await agent.generate(input);

      expect(mockAnthropicCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          system: expect.stringContaining('Output Format'),
        })
      );
    });
  });

  describe('error handling', () => {
    it('should retry on API failure', async () => {
      mockAnthropicCreate
        .mockRejectedValueOnce(new Error('API rate limit'))
        .mockResolvedValueOnce({
          content: [{ type: 'text', text: JSON.stringify(mockGeneratedYaml) }],
          usage: { input_tokens: 500, output_tokens: 200 },
        });

      const input: MaestroFlowInput = {
        inputMethod: 'description',
        description: 'Login test',
        options: {
          appId: 'com.bankbazaar.app',
          projectId: 'proj-123',
        },
      };

      const result = await agent.generate(input);

      expect(mockAnthropicCreate).toHaveBeenCalledTimes(2);
      expect(result.data.name).toBe('user_login.yaml');
    });

    it('should throw after max retries', async () => {
      // Create agent with minimal retries for faster test
      const fastAgent = new MaestroSmithAgent({ maxRetries: 1 });
      mockAnthropicCreate.mockRejectedValue(new Error('API error'));

      const input: MaestroFlowInput = {
        inputMethod: 'description',
        description: 'Login test',
        options: {
          appId: 'com.bankbazaar.app',
          projectId: 'proj-123',
        },
      };

      await expect(fastAgent.generate(input)).rejects.toThrow('API error');
    });

    it('should handle malformed JSON response', async () => {
      // Create agent with minimal retries for faster test
      const fastAgent = new MaestroSmithAgent({ maxRetries: 1 });
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'not valid json' }],
        usage: { input_tokens: 500, output_tokens: 200 },
      });

      const input: MaestroFlowInput = {
        inputMethod: 'description',
        description: 'Login test',
        options: {
          appId: 'com.bankbazaar.app',
          projectId: 'proj-123',
        },
      };

      await expect(fastAgent.generate(input)).rejects.toThrow(/Failed to parse JSON/);
    });
  });
});

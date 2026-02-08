/**
 * ScriptSmith Agent
 * Generates and edits Playwright/Cypress automation scripts
 *
 * Sprint 7: Enhanced with device targeting, transformation options, and screenshot input
 */

import { BaseAgent, AgentResponse, AgentConfig } from './base.agent.js';
import { DeviceTarget, getDefaultDeviceTarget } from '../types/deviceTargeting.js';

export interface ScreenshotAnnotation {
  x: number;
  y: number;
  width?: number;
  height?: number;
  label: string;
  type?: 'click' | 'input' | 'assert' | 'highlight';
}

export interface TransformationOptions {
  framework?: 'playwright' | 'cypress';
  language?: 'typescript' | 'javascript';
  includePageObjects?: boolean;
  useExistingHelpers?: string[];
  baseUrl?: string;
  // New transformation options (Sprint 7)
  extractUtilities?: boolean;
  addLogging?: boolean;
  generateRandomData?: boolean;
  includeComments?: boolean;
  waitStrategy?: 'minimal' | 'standard' | 'conservative';
  selectorPreference?: 'role' | 'testid' | 'text' | 'css';
  codeStyle?: 'match-project' | 'playwright-best-practices';
  deviceTarget?: DeviceTarget;
  // Sprint 14+: Duplicate detection options
  projectId?: string;
  skipDuplicateCheck?: boolean;
}

export interface GenerateScriptInput {
  inputMethod: 'test_case' | 'recording' | 'description' | 'screenshot';
  testCase?: {
    title: string;
    steps: Array<{ order: number; action: string; expected: string }>;
    preconditions?: string;
  };
  recording?: {
    actions: Array<{
      type: 'click' | 'fill' | 'navigate' | 'wait' | 'assert';
      selector?: string;
      value?: string;
      url?: string;
    }>;
  };
  description?: string;
  screenshot?: {
    base64: string;
    annotations?: ScreenshotAnnotation[];
    url?: string;
  };
  options?: TransformationOptions;
}

export interface GeneratedScript {
  name: string;
  code: string;
  language: 'typescript' | 'javascript';
  framework: 'playwright' | 'cypress';
  pageObjects?: Array<{
    name: string;
    code: string;
  }>;
  utilities?: Array<{
    name: string;
    code: string;
  }>;
  dependencies?: string[];
}

export interface EditScriptInput {
  existingCode: string;
  instruction: string;
  context?: {
    errorMessage?: string;
    failedSelector?: string;
  };
  // Sprint 14+: Duplicate detection options
  projectId?: string;
  skipDuplicateCheck?: boolean;
}

export interface EditedScript {
  code: string;
  changes: string[];
  explanation: string;
}

const GENERATE_SYSTEM_PROMPT = `You are ScriptSmith, an expert automation engineer specializing in Playwright and Cypress test scripts.

Guidelines:
1. Generate clean, maintainable test code
2. Use proper async/await patterns
3. Include appropriate waits and assertions
4. Follow Page Object Model when requested
5. Use descriptive test and variable names
6. Include error handling where appropriate
7. Add comments for complex logic

For Playwright:
- Use @playwright/test
- Use proper locator strategies (getByRole, getByTestId, getByText)
- Avoid brittle selectors

For Cypress:
- Use cy commands properly
- Chain commands correctly
- Use proper assertions

Wait Strategies:
- minimal: Only essential waits (networkidle, visible)
- standard: Balanced waits with reasonable timeouts
- conservative: Extra waits for slow/flaky elements

Selector Preferences:
- role: Prefer getByRole() for accessibility
- testid: Prefer getByTestId() for stability
- text: Prefer getByText() for readability
- css: Use CSS selectors when others don't apply

Output Format:
Return a JSON object:
{
  "name": "login.spec.ts",
  "code": "// Full test code here",
  "language": "typescript",
  "framework": "playwright",
  "pageObjects": [
    {"name": "LoginPage", "code": "// Page object code"}
  ],
  "utilities": [
    {"name": "testHelpers", "code": "// Utility code"}
  ],
  "dependencies": ["@playwright/test"]
}`;

const EDIT_SYSTEM_PROMPT = `You are ScriptSmith, an expert at fixing and improving automation scripts.

Guidelines:
1. Understand the existing code structure
2. Make minimal changes to fix the issue
3. Maintain code style consistency
4. Improve reliability if possible
5. Add comments explaining fixes

Output Format:
Return a JSON object:
{
  "code": "// Updated full code",
  "changes": ["Changed selector from X to Y", "Added wait before click"],
  "explanation": "Brief explanation of what was changed and why"
}`;

const SCREENSHOT_SYSTEM_PROMPT = `You are ScriptSmith, an expert at generating automation scripts from UI screenshots.

Your task:
1. Analyze the screenshot to understand the UI structure
2. Identify interactive elements (buttons, inputs, links)
3. Use annotations to understand the intended test flow
4. Generate a complete, working test script

Guidelines:
- Infer element selectors from visible text and structure
- Use stable selector strategies
- Include assertions for visible elements
- Handle common UI patterns (forms, modals, navigation)

Output Format:
Return a JSON object:
{
  "name": "generated.spec.ts",
  "code": "// Full test code here",
  "language": "typescript",
  "framework": "playwright",
  "pageObjects": [],
  "dependencies": ["@playwright/test"]
}`;

export class ScriptSmithAgent extends BaseAgent {
  constructor(config?: AgentConfig) {
    super('ScriptSmith', config);
  }

  async generate(input: GenerateScriptInput): Promise<AgentResponse<GeneratedScript>> {
    // Check for duplicates before generation
    const contentToCheck = this.extractContentForDuplicateCheck(input);
    const duplicateWarning = await this.checkScriptDuplicates(
      contentToCheck,
      input.options?.projectId,
      input.options?.skipDuplicateCheck
    );

    let result: AgentResponse<GeneratedScript>;

    // Handle screenshot input separately (uses vision)
    if (input.inputMethod === 'screenshot' && input.screenshot) {
      result = await this.generateFromScreenshot(input);
    } else {
      const userPrompt = this.buildGeneratePrompt(input);
      result = await this.call<GeneratedScript>(
        GENERATE_SYSTEM_PROMPT,
        userPrompt,
        (text) => this.parseJSON<GeneratedScript>(text)
      );
    }

    // Attach duplicate warning if found
    if (duplicateWarning) {
      result.duplicateWarning = duplicateWarning;
    }

    return result;
  }

  /**
   * Extract content from input for duplicate checking
   */
  private extractContentForDuplicateCheck(input: GenerateScriptInput): string {
    switch (input.inputMethod) {
      case 'screenshot':
        return `screenshot-based script`;
      case 'recording':
        return JSON.stringify(input.recording?.actions || []);
      case 'test_case':
        return `${input.testCase?.title || ''} ${input.testCase?.steps?.map(s => s.action).join(' ') || ''}`;
      case 'description':
      default:
        return input.description || '';
    }
  }

  async generateFromScreenshot(input: GenerateScriptInput): Promise<AgentResponse<GeneratedScript>> {
    if (!input.screenshot?.base64) {
      throw new Error('Screenshot base64 data is required');
    }

    const userPrompt = this.buildScreenshotPrompt(input);

    // For screenshot input, we need to use vision capabilities
    return this.callWithImage<GeneratedScript>(
      SCREENSHOT_SYSTEM_PROMPT,
      userPrompt,
      input.screenshot.base64,
      (text) => this.parseJSON<GeneratedScript>(text)
    );
  }

  async edit(input: EditScriptInput): Promise<AgentResponse<EditedScript>> {
    const userPrompt = this.buildEditPrompt(input);
    const result = await this.call<EditedScript>(
      EDIT_SYSTEM_PROMPT,
      userPrompt,
      (text) => this.parseJSON<EditedScript>(text)
    );

    // Check for duplicates with the edited code
    const duplicateWarning = await this.checkScriptDuplicates(
      result.data.code,
      input.projectId,
      input.skipDuplicateCheck
    );

    if (duplicateWarning) {
      result.duplicateWarning = duplicateWarning;
    }

    return result;
  }

  private buildGeneratePrompt(input: GenerateScriptInput): string {
    const options = input.options ?? {};
    const framework = options.framework ?? 'playwright';
    const language = options.language ?? 'typescript';
    const deviceTarget = options.deviceTarget ?? getDefaultDeviceTarget();

    let prompt = `Generate a ${framework} test script in ${language}.\n\n`;
    prompt += this.buildInputMethodSection(input);
    prompt += this.buildDeviceTargetSection(deviceTarget);
    prompt += this.buildBasicOptionsSection(options, framework, language);
    prompt += this.buildTransformationOptionsSection(options);
    prompt += `\nReturn the script as a JSON object.`;
    return prompt;
  }

  private buildInputMethodSection(input: GenerateScriptInput): string {
    if (input.inputMethod === 'test_case' && input.testCase) {
      let section = `TEST CASE:\n`;
      section += `Title: ${input.testCase.title}\n`;
      if (input.testCase.preconditions) {
        section += `Preconditions: ${input.testCase.preconditions}\n`;
      }
      section += `Steps:\n`;
      for (const step of input.testCase.steps) {
        section += `  ${step.order}. Action: ${step.action}\n     Expected: ${step.expected}\n`;
      }
      return section;
    }
    if (input.inputMethod === 'recording' && input.recording) {
      return `RECORDED ACTIONS:\n${JSON.stringify(input.recording.actions, null, 2)}\n`;
    }
    if (input.inputMethod === 'description' && input.description) {
      return `DESCRIPTION:\n${input.description}\n`;
    }
    return '';
  }

  private buildDeviceTargetSection(deviceTarget: DeviceTarget): string {
    let section = `\nDEVICE TARGET:\n`;
    section += `- Type: ${deviceTarget.type}\n`;
    section += `- Viewport: ${deviceTarget.viewport.width}x${deviceTarget.viewport.height}\n`;
    if (deviceTarget.deviceName) {
      section += `- Device: ${deviceTarget.deviceName}\n`;
    }
    if (deviceTarget.isTouchEnabled) {
      section += `- Touch enabled: yes\n`;
    }
    if (deviceTarget.userAgent) {
      section += `- Include viewport configuration in test setup\n`;
    }
    return section;
  }

  private buildBasicOptionsSection(options: TransformationOptions, framework: string, language: string): string {
    let section = `\nOPTIONS:\n`;
    section += `- Framework: ${framework}\n`;
    section += `- Language: ${language}\n`;
    section += `- Include Page Objects: ${options.includePageObjects ?? false}\n`;
    if (options.baseUrl) {
      section += `- Base URL: ${options.baseUrl}\n`;
    }
    if (options.useExistingHelpers?.length) {
      section += `- Use these existing helpers: ${options.useExistingHelpers.join(', ')}\n`;
    }
    return section;
  }

  private buildTransformationOptionsSection(options: TransformationOptions): string {
    let section = '';
    if (options.extractUtilities) {
      section += `- Extract reusable code into separate utility functions\n`;
    }
    if (options.addLogging) {
      section += `- Add console.log statements for debugging key steps\n`;
    }
    if (options.generateRandomData) {
      section += `- Use randomized test data (faker-style) for inputs\n`;
    }
    if (options.includeComments !== false) {
      section += `- Include comments explaining each step\n`;
    }
    if (options.waitStrategy) {
      section += `- Wait strategy: ${options.waitStrategy}\n`;
    }
    if (options.selectorPreference) {
      section += `- Selector preference: ${options.selectorPreference}\n`;
    }
    if (options.codeStyle) {
      section += `- Code style: ${options.codeStyle}\n`;
    }
    return section;
  }

  private buildScreenshotPrompt(input: GenerateScriptInput): string {
    const options = input.options ?? {};
    const framework = options.framework ?? 'playwright';
    const language = options.language ?? 'typescript';
    const deviceTarget = options.deviceTarget ?? getDefaultDeviceTarget();

    let prompt = `Generate a ${framework} test script in ${language} based on the attached screenshot.\n\n`;

    if (input.screenshot?.url) {
      prompt += `Page URL: ${input.screenshot.url}\n\n`;
    }

    if (input.screenshot?.annotations?.length) {
      prompt += `ANNOTATIONS (user marked these areas):\n`;
      for (const ann of input.screenshot.annotations) {
        prompt += `- At (${ann.x}, ${ann.y}): "${ann.label}"`;
        if (ann.type) {
          prompt += ` [${ann.type}]`;
        }
        prompt += `\n`;
      }
      prompt += `\nUse these annotations to understand the intended test flow.\n`;
    }

    prompt += this.buildDeviceTargetSection(deviceTarget);

    prompt += `\nOPTIONS:\n`;
    prompt += `- Framework: ${framework}\n`;
    prompt += `- Language: ${language}\n`;
    prompt += `- Include Page Objects: ${options.includePageObjects ?? false}\n`;

    if (options.selectorPreference) {
      prompt += `- Selector preference: ${options.selectorPreference}\n`;
    }
    if (options.waitStrategy) {
      prompt += `- Wait strategy: ${options.waitStrategy}\n`;
    }
    if (options.includeComments !== false) {
      prompt += `- Include comments explaining inferred actions\n`;
    }

    prompt += `\nAnalyze the screenshot and generate a complete test script. Return as JSON.`;
    return prompt;
  }

  private buildEditPrompt(input: EditScriptInput): string {
    let prompt = `Edit the following test script:\n\n`;
    prompt += `EXISTING CODE:\n\`\`\`\n${input.existingCode}\n\`\`\`\n\n`;
    prompt += `INSTRUCTION: ${input.instruction}\n`;

    if (input.context?.errorMessage) {
      prompt += `\nERROR MESSAGE: ${input.context.errorMessage}\n`;
    }
    if (input.context?.failedSelector) {
      prompt += `FAILED SELECTOR: ${input.context.failedSelector}\n`;
    }

    prompt += `\nReturn the updated script as a JSON object.`;
    return prompt;
  }

  /**
   * Call with image content for vision-based generation
   * This extends the base agent to handle image input
   */
  private async callWithImage<T>(
    systemPrompt: string,
    userPrompt: string,
    imageBase64: string,
    parser: (text: string) => T
  ): Promise<AgentResponse<T>> {
    const startTime = Date.now();

    // Build message with image content
    const messages = [
      {
        role: 'user' as const,
        content: [
          {
            type: 'image' as const,
            source: {
              type: 'base64' as const,
              media_type: 'image/png' as const,
              data: imageBase64,
            },
          },
          {
            type: 'text' as const,
            text: userPrompt,
          },
        ],
      },
    ];

    const client = this.getClient();
    const response = await client.messages.create({
      model: this.getModel(),
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature,
      system: systemPrompt,
      messages: messages as any,
    });

    const durationMs = Date.now() - startTime;
    const textContent = response.content.find(c => c.type === 'text');

    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from vision call');
    }

    const data = parser(textContent.text);
    const usage = this.calculateVisionUsage(response.usage, durationMs);

    return { data, usage };
  }

  /**
   * Calculate usage for vision calls
   */
  private calculateVisionUsage(
    usage: { input_tokens: number; output_tokens: number },
    durationMs: number
  ): AgentResponse<unknown>['usage'] {
    const model = this.getModel();
    // Use same pricing as base - vision doesn't have separate pricing
    const pricing = { input: 3.0, output: 15.0 }; // Default to sonnet pricing
    const inputTokens = usage.input_tokens;
    const outputTokens = usage.output_tokens;

    const costUsd = (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
    const costInr = costUsd * 84.5; // USD_TO_INR

    return {
      inputTokens,
      outputTokens,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
      costUsd: Math.round(costUsd * 1_000_000) / 1_000_000,
      costInr: Math.round(costInr * 10_000) / 10_000,
      model,
      durationMs,
    };
  }
}

export const scriptSmithAgent = new ScriptSmithAgent();

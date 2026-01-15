/**
 * ScriptSmith Agent
 * Generates and edits Playwright/Cypress automation scripts
 */

import { BaseAgent, AgentResponse, AgentConfig } from './base.agent.js';

export interface GenerateScriptInput {
  inputMethod: 'test_case' | 'recording' | 'description';
  testCase?: {
    title: string;
    steps: Array<{ order: number; action: string; expected: string }>;
    preconditions?: string | undefined;
  } | undefined;
  recording?: {
    actions: Array<{
      type: 'click' | 'fill' | 'navigate' | 'wait' | 'assert';
      selector?: string | undefined;
      value?: string | undefined;
      url?: string | undefined;
    }>;
  } | undefined;
  description?: string | undefined;
  options?: {
    framework?: 'playwright' | 'cypress' | undefined;
    language?: 'typescript' | 'javascript' | undefined;
    includePageObjects?: boolean | undefined;
    useExistingHelpers?: string[] | undefined;
    baseUrl?: string | undefined;
  } | undefined;
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
  dependencies?: string[];
}

export interface EditScriptInput {
  existingCode: string;
  instruction: string;
  context?: {
    errorMessage?: string | undefined;
    failedSelector?: string | undefined;
  } | undefined;
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

export class ScriptSmithAgent extends BaseAgent {
  constructor(config?: AgentConfig) {
    super('ScriptSmith', config);
  }

  async generate(input: GenerateScriptInput): Promise<AgentResponse<GeneratedScript>> {
    const userPrompt = this.buildGeneratePrompt(input);
    return this.call<GeneratedScript>(
      GENERATE_SYSTEM_PROMPT,
      userPrompt,
      (text) => this.parseJSON<GeneratedScript>(text)
    );
  }

  async edit(input: EditScriptInput): Promise<AgentResponse<EditedScript>> {
    const userPrompt = this.buildEditPrompt(input);
    return this.call<EditedScript>(
      EDIT_SYSTEM_PROMPT,
      userPrompt,
      (text) => this.parseJSON<EditedScript>(text)
    );
  }

  private buildGeneratePrompt(input: GenerateScriptInput): string {
    const options = input.options ?? {};
    const framework = options.framework ?? 'playwright';
    const language = options.language ?? 'typescript';

    let prompt = `Generate a ${framework} test script in ${language}.\n\n`;

    if (input.inputMethod === 'test_case' && input.testCase) {
      prompt += `TEST CASE:\n`;
      prompt += `Title: ${input.testCase.title}\n`;
      if (input.testCase.preconditions) {
        prompt += `Preconditions: ${input.testCase.preconditions}\n`;
      }
      prompt += `Steps:\n`;
      for (const step of input.testCase.steps) {
        prompt += `  ${step.order}. Action: ${step.action}\n     Expected: ${step.expected}\n`;
      }
    } else if (input.inputMethod === 'recording' && input.recording) {
      prompt += `RECORDED ACTIONS:\n${JSON.stringify(input.recording.actions, null, 2)}\n`;
    } else if (input.inputMethod === 'description' && input.description) {
      prompt += `DESCRIPTION:\n${input.description}\n`;
    }

    prompt += `\nOPTIONS:\n`;
    prompt += `- Framework: ${framework}\n`;
    prompt += `- Language: ${language}\n`;
    prompt += `- Include Page Objects: ${options.includePageObjects ?? false}\n`;

    if (options.baseUrl) {
      prompt += `- Base URL: ${options.baseUrl}\n`;
    }
    if (options.useExistingHelpers?.length) {
      prompt += `- Use these existing helpers: ${options.useExistingHelpers.join(', ')}\n`;
    }

    prompt += `\nReturn the script as a JSON object.`;
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
}

export const scriptSmithAgent = new ScriptSmithAgent();

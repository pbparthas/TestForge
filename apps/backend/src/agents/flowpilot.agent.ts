/**
 * FlowPilot Agent
 * Generates API tests from OpenAPI specs and chains API calls
 */

import { BaseAgent, AgentResponse, AgentConfig } from './base.agent.js';

export interface GenerateApiTestsInput {
  openApiSpec?: string | undefined; // JSON or YAML string
  endpoint?: {
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    path: string;
    description?: string | undefined;
    requestBody?: Record<string, unknown> | undefined;
    responseSchema?: Record<string, unknown> | undefined;
  } | undefined;
  options?: {
    includeAuthTests?: boolean | undefined;
    includeValidationTests?: boolean | undefined;
    includeErrorCases?: boolean | undefined;
    framework?: 'playwright' | 'jest' | 'vitest' | undefined;
    // Sprint 14+: Duplicate detection options
    projectId?: string | undefined;
    skipDuplicateCheck?: boolean | undefined;
  } | undefined;
}

export interface GeneratedApiTest {
  name: string;
  description: string;
  code: string;
  type: 'positive' | 'negative' | 'auth' | 'validation';
}

export interface GenerateApiTestsOutput {
  tests: GeneratedApiTest[];
  setup: string; // Common setup code
  helpers: Array<{
    name: string;
    code: string;
  }>;
}

export interface ChainInput {
  description: string;
  steps: Array<{
    name: string;
    endpoint: string;
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    dependsOn?: string[] | undefined;
    extractFields?: string[] | undefined;
  }>;
  options?: {
    framework?: 'playwright' | 'jest' | 'vitest' | undefined;
    includeCleanup?: boolean | undefined;
  } | undefined;
}

export interface ChainOutput {
  code: string;
  flowDiagram: string; // ASCII diagram of the flow
  dataFlow: Array<{
    from: string;
    to: string;
    field: string;
  }>;
}

const GENERATE_SYSTEM_PROMPT = `You are FlowPilot, an expert at generating API tests.

Generate comprehensive API tests including:
1. Happy path tests
2. Validation tests (missing fields, wrong types)
3. Authentication tests
4. Error case tests

Output JSON:
{
  "tests": [
    {
      "name": "should create user with valid data",
      "description": "POST /users with valid payload returns 201",
      "code": "test('should create user', async () => { ... })",
      "type": "positive"
    }
  ],
  "setup": "// Common setup code like base URL, auth headers",
  "helpers": [
    {"name": "createAuthHeaders", "code": "function createAuthHeaders() { ... }"}
  ]
}`;

const CHAIN_SYSTEM_PROMPT = `You are FlowPilot, creating chained API test flows.

Create a test that:
1. Executes steps in order
2. Passes data between steps (e.g., created ID to next request)
3. Handles cleanup
4. Has clear assertions at each step

Output JSON:
{
  "code": "// Full test code with all steps chained",
  "flowDiagram": "Step1 -> Step2 -> Step3",
  "dataFlow": [
    {"from": "createUser", "to": "getUser", "field": "userId"}
  ]
}`;

export class FlowPilotAgent extends BaseAgent {
  constructor(config?: AgentConfig) {
    super('FlowPilot', config);
  }

  async generateApiTests(input: GenerateApiTestsInput): Promise<AgentResponse<GenerateApiTestsOutput>> {
    // Check for duplicates before generation
    const contentToCheck = this.extractContentForDuplicateCheck(input);
    const duplicateWarning = await this.checkTestCaseDuplicates(
      contentToCheck,
      input.options?.projectId,
      input.options?.skipDuplicateCheck
    );

    const userPrompt = this.buildGeneratePrompt(input);
    const result = await this.call<GenerateApiTestsOutput>(
      GENERATE_SYSTEM_PROMPT,
      userPrompt,
      (text) => this.parseJSON<GenerateApiTestsOutput>(text)
    );

    // Attach duplicate warning if found
    if (duplicateWarning) {
      result.duplicateWarning = duplicateWarning;
    }

    return result;
  }

  /**
   * Extract content from input for duplicate checking
   */
  private extractContentForDuplicateCheck(input: GenerateApiTestsInput): string {
    if (input.openApiSpec) {
      return input.openApiSpec.substring(0, 1000); // First 1000 chars of spec
    }
    if (input.endpoint) {
      return `${input.endpoint.method} ${input.endpoint.path} ${input.endpoint.description || ''}`;
    }
    return '';
  }

  async chain(input: ChainInput): Promise<AgentResponse<ChainOutput>> {
    const userPrompt = this.buildChainPrompt(input);
    return this.call<ChainOutput>(
      CHAIN_SYSTEM_PROMPT,
      userPrompt,
      (text) => this.parseJSON<ChainOutput>(text)
    );
  }

  private buildGeneratePrompt(input: GenerateApiTestsInput): string {
    const options = input.options ?? {};
    let prompt = `Generate API tests for:\n\n`;

    if (input.openApiSpec) {
      prompt += `OpenAPI Spec:\n${input.openApiSpec}\n\n`;
    } else if (input.endpoint) {
      prompt += `Endpoint: ${input.endpoint.method} ${input.endpoint.path}\n`;
      if (input.endpoint.description) prompt += `Description: ${input.endpoint.description}\n`;
      if (input.endpoint.requestBody) prompt += `Request Body: ${JSON.stringify(input.endpoint.requestBody)}\n`;
      if (input.endpoint.responseSchema) prompt += `Response Schema: ${JSON.stringify(input.endpoint.responseSchema)}\n`;
    }

    prompt += `\nOptions:\n`;
    prompt += `- Include auth tests: ${options.includeAuthTests ?? true}\n`;
    prompt += `- Include validation tests: ${options.includeValidationTests ?? true}\n`;
    prompt += `- Include error cases: ${options.includeErrorCases ?? true}\n`;
    prompt += `- Framework: ${options.framework ?? 'playwright'}\n`;
    return prompt;
  }

  private buildChainPrompt(input: ChainInput): string {
    let prompt = `Create a chained API test flow:\n\n`;
    prompt += `Description: ${input.description}\n\n`;
    prompt += `Steps:\n`;
    input.steps.forEach((step, i) => {
      prompt += `${i + 1}. ${step.name}: ${step.method} ${step.endpoint}\n`;
      if (step.dependsOn?.length) prompt += `   Depends on: ${step.dependsOn.join(', ')}\n`;
      if (step.extractFields?.length) prompt += `   Extract: ${step.extractFields.join(', ')}\n`;
    });
    prompt += `\nFramework: ${input.options?.framework ?? 'playwright'}\n`;
    prompt += `Include cleanup: ${input.options?.includeCleanup ?? true}\n`;
    return prompt;
  }
}

export const flowPilotAgent = new FlowPilotAgent();

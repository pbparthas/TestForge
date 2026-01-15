/**
 * TestWeaver Agent
 * Generates and evolves test cases from specifications
 */

import { BaseAgent, AgentResponse, AgentConfig } from './base.agent.js';

export interface TestStep {
  order: number;
  action: string;
  expected: string;
}

export interface GeneratedTestCase {
  title: string;
  description: string;
  preconditions: string;
  steps: TestStep[];
  expectedResult: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  type: 'functional' | 'integration' | 'e2e' | 'api' | 'performance';
  tags: string[];
}

export interface GenerateInput {
  specification: string;
  inputMethod: 'specification' | 'natural_language' | 'existing_test';
  options?: {
    maxTestCases?: number | undefined;
    includeNegativeCases?: boolean | undefined;
    includeEdgeCases?: boolean | undefined;
    focusAreas?: string[] | undefined;
    testTypes?: ('functional' | 'integration' | 'e2e' | 'api')[] | undefined;
  } | undefined;
}

export interface GenerateOutput {
  testCases: GeneratedTestCase[];
  summary: {
    total: number;
    byPriority: Record<string, number>;
    byType: Record<string, number>;
  };
}

export interface EvolveInput {
  existingTestCases: Array<{
    id: string;
    title: string;
    description: string;
    steps: TestStep[];
  }>;
  oldSpecification: string;
  newSpecification: string;
}

export interface EvolveOutput {
  unchanged: string[]; // IDs of unchanged test cases
  modified: Array<{
    id: string;
    changes: string[];
    updatedTestCase: GeneratedTestCase;
  }>;
  deprecated: Array<{
    id: string;
    reason: string;
  }>;
  newTestCases: GeneratedTestCase[];
  migrationGuide: string;
}

const GENERATE_SYSTEM_PROMPT = `You are TestWeaver, an expert test case designer. Your role is to generate comprehensive, well-structured test cases from specifications.

Guidelines:
1. Create clear, actionable test steps
2. Include both positive and negative scenarios when requested
3. Cover edge cases and boundary conditions
4. Use consistent naming conventions
5. Prioritize based on business impact and risk
6. Each test case should be independent and atomic

Output Format:
Return a JSON object with this structure:
{
  "testCases": [
    {
      "title": "Descriptive test title",
      "description": "What this test validates",
      "preconditions": "Required setup before test",
      "steps": [
        {"order": 1, "action": "Do something", "expected": "Something happens"}
      ],
      "expectedResult": "Final expected outcome",
      "priority": "high|medium|low|critical",
      "type": "functional|integration|e2e|api|performance",
      "tags": ["login", "authentication"]
    }
  ],
  "summary": {
    "total": 5,
    "byPriority": {"high": 2, "medium": 3},
    "byType": {"functional": 3, "e2e": 2}
  }
}`;

const EVOLVE_SYSTEM_PROMPT = `You are TestWeaver, an expert test case evolution specialist. Your role is to analyze specification changes and determine how existing test cases should be updated.

Guidelines:
1. Identify which test cases are still valid (unchanged)
2. Determine which test cases need modification
3. Flag test cases that should be deprecated
4. Generate new test cases for new functionality
5. Provide a clear migration guide

Output Format:
Return a JSON object with this structure:
{
  "unchanged": ["id1", "id2"],
  "modified": [
    {
      "id": "id3",
      "changes": ["Step 2 updated to reflect new button label"],
      "updatedTestCase": { /* full test case object */ }
    }
  ],
  "deprecated": [
    {"id": "id4", "reason": "Feature removed from specification"}
  ],
  "newTestCases": [/* new GeneratedTestCase objects */],
  "migrationGuide": "Summary of changes and recommended actions"
}`;

export class TestWeaverAgent extends BaseAgent {
  constructor(config?: AgentConfig) {
    super('TestWeaver', config);
  }

  async generate(input: GenerateInput): Promise<AgentResponse<GenerateOutput>> {
    const userPrompt = this.buildGeneratePrompt(input);
    return this.call<GenerateOutput>(
      GENERATE_SYSTEM_PROMPT,
      userPrompt,
      (text) => this.parseJSON<GenerateOutput>(text)
    );
  }

  async evolve(input: EvolveInput): Promise<AgentResponse<EvolveOutput>> {
    const userPrompt = this.buildEvolvePrompt(input);
    return this.call<EvolveOutput>(
      EVOLVE_SYSTEM_PROMPT,
      userPrompt,
      (text) => this.parseJSON<EvolveOutput>(text)
    );
  }

  private buildGeneratePrompt(input: GenerateInput): string {
    const options = input.options ?? {};
    const maxTestCases = options.maxTestCases ?? 10;
    const includeNegative = options.includeNegativeCases ?? true;
    const includeEdge = options.includeEdgeCases ?? true;

    let prompt = `Generate test cases from the following ${input.inputMethod}:\n\n`;
    prompt += `${input.specification}\n\n`;
    prompt += `Requirements:\n`;
    prompt += `- Maximum test cases: ${maxTestCases}\n`;
    prompt += `- Include negative test cases: ${includeNegative}\n`;
    prompt += `- Include edge cases: ${includeEdge}\n`;

    if (options.focusAreas?.length) {
      prompt += `- Focus areas: ${options.focusAreas.join(', ')}\n`;
    }
    if (options.testTypes?.length) {
      prompt += `- Test types to generate: ${options.testTypes.join(', ')}\n`;
    }

    prompt += `\nReturn the test cases as a JSON object.`;
    return prompt;
  }

  private buildEvolvePrompt(input: EvolveInput): string {
    let prompt = `Analyze the following specification changes and determine how existing test cases should be updated.\n\n`;
    prompt += `OLD SPECIFICATION:\n${input.oldSpecification}\n\n`;
    prompt += `NEW SPECIFICATION:\n${input.newSpecification}\n\n`;
    prompt += `EXISTING TEST CASES:\n${JSON.stringify(input.existingTestCases, null, 2)}\n\n`;
    prompt += `Analyze the changes and return a JSON object with unchanged, modified, deprecated test cases, and any new test cases needed.`;
    return prompt;
  }
}

export const testWeaverAgent = new TestWeaverAgent();

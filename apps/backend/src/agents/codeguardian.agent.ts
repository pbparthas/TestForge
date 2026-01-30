/**
 * CodeGuardian Agent
 * Generates unit tests and analyzes code coverage
 */

import { BaseAgent, AgentResponse, AgentConfig } from './base.agent.js';

export interface GenerateUnitTestsInput {
  code: string;
  language: 'typescript' | 'javascript';
  framework?: 'vitest' | 'jest' | 'mocha' | undefined;
  options?: {
    includeEdgeCases?: boolean | undefined;
    includeMocks?: boolean | undefined;
    targetCoverage?: number | undefined;
    // Sprint 14+: Duplicate detection options
    projectId?: string | undefined;
    skipDuplicateCheck?: boolean | undefined;
  } | undefined;
}

export interface GeneratedUnitTest {
  name: string;
  code: string;
  covers: string[]; // Function/method names covered
  type: 'happy-path' | 'edge-case' | 'error-handling';
}

export interface GenerateUnitTestsOutput {
  tests: GeneratedUnitTest[];
  mocks: Array<{
    name: string;
    code: string;
  }>;
  setup: string;
  estimatedCoverage: number;
}

export interface AnalyzeCoverageInput {
  code: string;
  existingTests?: string | undefined;
  coverageReport?: {
    statements: number;
    branches: number;
    functions: number;
    lines: number;
    uncoveredLines: number[];
  } | undefined;
}

export interface AnalyzeCoverageOutput {
  uncoveredPaths: Array<{
    type: 'function' | 'branch' | 'statement';
    location: string;
    description: string;
    difficulty: 'easy' | 'medium' | 'hard';
  }>;
  suggestions: Array<{
    path: string;
    testCode: string;
    impact: number; // Estimated coverage increase
  }>;
  summary: {
    totalUncovered: number;
    easyWins: number;
    estimatedEffort: string;
  };
}

const GENERATE_SYSTEM_PROMPT = `You are CodeGuardian, an expert at writing comprehensive unit tests.

Generate tests that:
1. Cover all public functions/methods
2. Test edge cases and error conditions
3. Use appropriate mocking
4. Are maintainable and readable

Output JSON:
{
  "tests": [
    {
      "name": "should return sum of two numbers",
      "code": "test('add returns sum', () => { expect(add(2, 3)).toBe(5); })",
      "covers": ["add"],
      "type": "happy-path"
    }
  ],
  "mocks": [
    {"name": "mockDatabase", "code": "const mockDb = { query: vi.fn() };"}
  ],
  "setup": "// Import statements and common setup",
  "estimatedCoverage": 85
}`;

const ANALYZE_SYSTEM_PROMPT = `You are CodeGuardian, analyzing code coverage gaps.

Identify:
1. Uncovered code paths
2. Missing edge case tests
3. Untested error handlers
4. Quick wins for coverage improvement

Output JSON:
{
  "uncoveredPaths": [
    {
      "type": "branch",
      "location": "line 25, else branch",
      "description": "Error handling for invalid input not tested",
      "difficulty": "easy"
    }
  ],
  "suggestions": [
    {
      "path": "validateInput else branch",
      "testCode": "test('throws on invalid input', () => { ... })",
      "impact": 5
    }
  ],
  "summary": {
    "totalUncovered": 12,
    "easyWins": 4,
    "estimatedEffort": "2-3 hours for 90% coverage"
  }
}`;

export class CodeGuardianAgent extends BaseAgent {
  constructor(config?: AgentConfig) {
    super('CodeGuardian', config);
  }

  async generateUnitTests(input: GenerateUnitTestsInput): Promise<AgentResponse<GenerateUnitTestsOutput>> {
    // Check for duplicates before generation (using source code as check content)
    const duplicateWarning = await this.checkScriptDuplicates(
      input.code,
      input.options?.projectId,
      input.options?.skipDuplicateCheck
    );

    const userPrompt = this.buildGeneratePrompt(input);
    const result = await this.call<GenerateUnitTestsOutput>(
      GENERATE_SYSTEM_PROMPT,
      userPrompt,
      (text) => this.parseJSON<GenerateUnitTestsOutput>(text)
    );

    // Attach duplicate warning if found
    if (duplicateWarning) {
      result.duplicateWarning = duplicateWarning;
    }

    return result;
  }

  async analyzeCoverage(input: AnalyzeCoverageInput): Promise<AgentResponse<AnalyzeCoverageOutput>> {
    const userPrompt = this.buildAnalyzePrompt(input);
    return this.call<AnalyzeCoverageOutput>(
      ANALYZE_SYSTEM_PROMPT,
      userPrompt,
      (text) => this.parseJSON<AnalyzeCoverageOutput>(text)
    );
  }

  private buildGeneratePrompt(input: GenerateUnitTestsInput): string {
    const options = input.options ?? {};
    let prompt = `Generate unit tests for this ${input.language} code:\n\n`;
    prompt += `\`\`\`${input.language}\n${input.code}\n\`\`\`\n\n`;
    prompt += `Framework: ${input.framework ?? 'vitest'}\n`;
    prompt += `Include edge cases: ${options.includeEdgeCases ?? true}\n`;
    prompt += `Include mocks: ${options.includeMocks ?? true}\n`;
    if (options.targetCoverage) prompt += `Target coverage: ${options.targetCoverage}%\n`;
    return prompt;
  }

  private buildAnalyzePrompt(input: AnalyzeCoverageInput): string {
    let prompt = `Analyze coverage gaps for this code:\n\n`;
    prompt += `\`\`\`\n${input.code}\n\`\`\`\n\n`;
    if (input.existingTests) {
      prompt += `Existing tests:\n\`\`\`\n${input.existingTests}\n\`\`\`\n\n`;
    }
    if (input.coverageReport) {
      prompt += `Coverage Report:\n`;
      prompt += `- Statements: ${input.coverageReport.statements}%\n`;
      prompt += `- Branches: ${input.coverageReport.branches}%\n`;
      prompt += `- Functions: ${input.coverageReport.functions}%\n`;
      prompt += `- Lines: ${input.coverageReport.lines}%\n`;
      if (input.coverageReport.uncoveredLines.length) {
        prompt += `- Uncovered lines: ${input.coverageReport.uncoveredLines.join(', ')}\n`;
      }
    }
    return prompt;
  }
}

export const codeGuardianAgent = new CodeGuardianAgent();

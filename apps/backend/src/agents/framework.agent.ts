/**
 * Framework Agent
 * Analyzes code patterns, suggests page objects, reviews scripts
 */

import { BaseAgent, AgentResponse, AgentConfig } from './base.agent.js';

export interface AnalyzeInput {
  code: string;
  framework: 'playwright' | 'cypress';
  options?: {
    checkPageObjects?: boolean | undefined;
    checkCodeSmells?: boolean | undefined;
    checkBestPractices?: boolean | undefined;
  } | undefined;
}

export interface AnalyzeOutput {
  pageObjectSuggestions: Array<{
    name: string;
    selectors: string[];
    methods: string[];
    reason: string;
  }>;
  codeSmells: Array<{
    type: string;
    location: string;
    description: string;
    severity: 'low' | 'medium' | 'high';
    suggestion: string;
  }>;
  bestPractices: Array<{
    rule: string;
    status: 'pass' | 'fail' | 'warning';
    details: string;
  }>;
  overallScore: number; // 0-100
}

export interface ReviewInput {
  code: string;
  testCase?: {
    title: string;
    steps: Array<{ action: string; expected: string }>;
  } | undefined;
  framework: 'playwright' | 'cypress';
}

export interface ReviewOutput {
  approved: boolean;
  issues: Array<{
    line: number;
    type: 'error' | 'warning' | 'suggestion';
    message: string;
    fix?: string | undefined;
  }>;
  suggestions: string[];
  summary: string;
}

const ANALYZE_SYSTEM_PROMPT = `You are Framework Agent, an expert code analyzer for test automation frameworks.

Analyze the provided code and identify:
1. Opportunities to extract Page Objects
2. Code smells (hardcoded waits, brittle selectors, duplicate code)
3. Best practice violations

Output JSON:
{
  "pageObjectSuggestions": [
    {"name": "LoginPage", "selectors": ["#username", "#password"], "methods": ["login", "getError"], "reason": "Multiple login interactions found"}
  ],
  "codeSmells": [
    {"type": "hardcoded-wait", "location": "line 15", "description": "Using page.waitForTimeout", "severity": "medium", "suggestion": "Use waitForSelector instead"}
  ],
  "bestPractices": [
    {"rule": "Use role-based selectors", "status": "fail", "details": "Found 3 CSS selectors that could use getByRole"}
  ],
  "overallScore": 75
}`;

const REVIEW_SYSTEM_PROMPT = `You are Framework Agent, reviewing automation scripts for quality and correctness.

Review the script against:
1. Test case alignment (if provided)
2. Code quality and maintainability
3. Framework best practices
4. Potential flakiness

Output JSON:
{
  "approved": true/false,
  "issues": [
    {"line": 10, "type": "warning", "message": "Missing assertion", "fix": "Add expect(...)"}
  ],
  "suggestions": ["Consider using test.describe for grouping"],
  "summary": "Brief review summary"
}`;

export class FrameworkAgent extends BaseAgent {
  constructor(config?: AgentConfig) {
    super('FrameworkAgent', config);
  }

  async analyze(input: AnalyzeInput): Promise<AgentResponse<AnalyzeOutput>> {
    const userPrompt = this.buildAnalyzePrompt(input);
    return this.call<AnalyzeOutput>(
      ANALYZE_SYSTEM_PROMPT,
      userPrompt,
      (text) => this.parseJSON<AnalyzeOutput>(text)
    );
  }

  async review(input: ReviewInput): Promise<AgentResponse<ReviewOutput>> {
    const userPrompt = this.buildReviewPrompt(input);
    return this.call<ReviewOutput>(
      REVIEW_SYSTEM_PROMPT,
      userPrompt,
      (text) => this.parseJSON<ReviewOutput>(text)
    );
  }

  private buildAnalyzePrompt(input: AnalyzeInput): string {
    const options = input.options ?? {};
    let prompt = `Analyze this ${input.framework} test code:\n\n\`\`\`\n${input.code}\n\`\`\`\n\n`;
    prompt += `Analysis options:\n`;
    prompt += `- Check for Page Object opportunities: ${options.checkPageObjects ?? true}\n`;
    prompt += `- Check for code smells: ${options.checkCodeSmells ?? true}\n`;
    prompt += `- Check best practices: ${options.checkBestPractices ?? true}\n`;
    return prompt;
  }

  private buildReviewPrompt(input: ReviewInput): string {
    let prompt = `Review this ${input.framework} script:\n\n\`\`\`\n${input.code}\n\`\`\`\n\n`;
    if (input.testCase) {
      prompt += `Test Case: ${input.testCase.title}\n`;
      prompt += `Steps:\n`;
      input.testCase.steps.forEach((s, i) => {
        prompt += `  ${i + 1}. ${s.action} → ${s.expected}\n`;
      });
    }
    return prompt;
  }
}

export const frameworkAgent = new FrameworkAgent();

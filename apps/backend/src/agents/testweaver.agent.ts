/**
 * TestWeaver Agent
 * Generates and evolves test cases from specifications
 * Sprint 8: Added screenshot, file upload, multi-turn, batch, AI mapping
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

export interface AIMapping {
  product?: string;
  partner?: string;
  module?: string;
  confidence: {
    product: number;
    partner: number;
    module: number;
  };
  suggestedTags: string[];
}

// Sprint 8: Extended input types
export type InputMethod =
  | 'specification'
  | 'natural_language'
  | 'existing_test'
  | 'screenshot'
  | 'file_upload'
  | 'conversation';

export interface ScreenshotAnnotation {
  x: number;
  y: number;
  width?: number | undefined;
  height?: number | undefined;
  label: string;
  type?: 'click' | 'input' | 'assert' | 'highlight' | undefined;
}

export interface ScreenshotInput {
  base64: string;
  mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
  annotations?: ScreenshotAnnotation[] | undefined;
  context?: string | undefined;
}

export interface FileUploadInput {
  content: string;
  fileName: string;
  mimeType: 'text/csv' | 'application/json' | 'text/plain' | 'text/markdown' | 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  mapping?: Record<string, string> | undefined; // column → field mapping
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface GenerateOptions {
  maxTestCases?: number | undefined;
  includeNegativeCases?: boolean | undefined;
  includeEdgeCases?: boolean | undefined;
  focusAreas?: string[] | undefined;
  testTypes?: ('functional' | 'integration' | 'e2e' | 'api')[] | undefined;
  // Sprint 8: AI mapping options
  includeMapping?: boolean | undefined;
  mappingContext?: {
    products?: string[] | undefined;
    partners?: string[] | undefined;
    modules?: string[] | undefined;
  } | undefined;
  // Sprint 14+: Duplicate detection options
  projectId?: string | undefined;
  skipDuplicateCheck?: boolean | undefined;
}

export interface GenerateInput {
  specification?: string | undefined;
  inputMethod: InputMethod;
  screenshot?: ScreenshotInput | undefined;
  fileUpload?: FileUploadInput | undefined;
  conversation?: ConversationMessage[] | undefined;
  options?: GenerateOptions | undefined;
}

export interface GenerateOutput {
  testCases: GeneratedTestCase[];
  summary: {
    total: number;
    byPriority: Record<string, number>;
    byType: Record<string, number>;
  };
  mapping?: AIMapping;
}

// Sprint 8: Batch generation types
export interface BatchGenerateInput {
  specifications: Array<{
    id: string;
    content: string;
    inputMethod: InputMethod;
  }>;
  options?: GenerateOptions | undefined;
}

export interface BatchGenerateOutput {
  results: Array<{
    id: string;
    success: boolean;
    output?: GenerateOutput;
    error?: string;
  }>;
  summary: {
    total: number;
    successful: number;
    failed: number;
    totalTestCases: number;
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
  // Sprint 14+: Duplicate detection options
  projectId?: string;
  skipDuplicateCheck?: boolean;
}

export interface EvolveOutput {
  unchanged: string[];
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

const SCREENSHOT_SYSTEM_PROMPT = `You are TestWeaver, an expert test case designer with visual analysis capabilities.
Analyze the provided UI screenshot and generate comprehensive test cases for the visible elements and interactions.

Guidelines:
1. Identify all interactive elements (buttons, inputs, links, forms)
2. Understand the user flow shown in the screenshot
3. If annotations are provided, focus on those areas
4. Generate test cases for both happy path and error scenarios
5. Consider accessibility and edge cases

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
      "tags": ["ui", "visual"]
    }
  ],
  "summary": {
    "total": 5,
    "byPriority": {"high": 2, "medium": 3},
    "byType": {"functional": 3, "e2e": 2}
  }
}`;

const MAPPING_SYSTEM_PROMPT = `You are TestWeaver with AI mapping capabilities. Analyze the test content and suggest appropriate categorization.

Given the test content, determine:
1. Which product this test relates to (from provided list or suggest new)
2. Which partner/team this test relates to (if applicable)
3. Which module/feature area this test covers
4. Confidence scores (0-1) for each mapping

Output Format:
{
  "mapping": {
    "product": "Suggested product name",
    "partner": "Suggested partner/team",
    "module": "Suggested module/feature",
    "confidence": {
      "product": 0.85,
      "partner": 0.60,
      "module": 0.90
    },
    "suggestedTags": ["tag1", "tag2"]
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
    // Check for duplicates before generation
    const contentToCheck = this.extractContentForDuplicateCheck(input);
    const duplicateWarning = await this.checkTestCaseDuplicates(
      contentToCheck,
      input.options?.projectId,
      input.options?.skipDuplicateCheck
    );

    // Route to appropriate handler based on input method
    let result: AgentResponse<GenerateOutput>;
    switch (input.inputMethod) {
      case 'screenshot':
        result = await this.generateFromScreenshot(input);
        break;
      case 'file_upload':
        result = await this.generateFromFile(input);
        break;
      case 'conversation':
        result = await this.generateFromConversation(input);
        break;
      default:
        result = await this.generateFromSpec(input);
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
  private extractContentForDuplicateCheck(input: GenerateInput): string {
    switch (input.inputMethod) {
      case 'screenshot':
        return input.screenshot?.context || 'screenshot-based test';
      case 'file_upload':
        return input.fileUpload?.content || '';
      case 'conversation':
        return input.conversation?.map(m => m.content).join(' ') || '';
      default:
        return input.specification || '';
    }
  }

  /**
   * Generate from text specification (original method)
   */
  private async generateFromSpec(input: GenerateInput): Promise<AgentResponse<GenerateOutput>> {
    const userPrompt = this.buildGeneratePrompt(input);
    const result = await this.call<GenerateOutput>(
      GENERATE_SYSTEM_PROMPT,
      userPrompt,
      (text) => this.parseJSON<GenerateOutput>(text)
    );

    // Add AI mapping if requested
    if (input.options?.includeMapping) {
      const mapping = await this.generateMapping(input.specification || '', input.options.mappingContext);
      result.data.mapping = mapping;
    }

    return result;
  }

  /**
   * Sprint 8: Generate test cases from screenshot using Claude Vision
   */
  private async generateFromScreenshot(input: GenerateInput): Promise<AgentResponse<GenerateOutput>> {
    if (!input.screenshot) {
      throw new Error('Screenshot input is required for screenshot input method');
    }

    let textPrompt = 'Analyze this UI screenshot and generate comprehensive test cases.\n\n';

    if (input.screenshot.annotations?.length) {
      textPrompt += 'Focus on these annotated areas:\n';
      input.screenshot.annotations.forEach((a, i) => {
        textPrompt += `${i + 1}. "${a.label}" at (${a.x}, ${a.y})`;
        if (a.type) textPrompt += ` - ${a.type} action`;
        textPrompt += '\n';
      });
      textPrompt += '\n';
    }

    if (input.screenshot.context) {
      textPrompt += `Additional context: ${input.screenshot.context}\n\n`;
    }

    textPrompt += this.buildOptionsPrompt(input.options);
    textPrompt += '\nReturn the test cases as a JSON object.';

    const result = await this.callWithVision<GenerateOutput>(
      SCREENSHOT_SYSTEM_PROMPT,
      textPrompt,
      input.screenshot.base64,
      input.screenshot.mediaType,
      (text) => this.parseJSON<GenerateOutput>(text)
    );

    // Add AI mapping if requested
    if (input.options?.includeMapping) {
      const context = input.screenshot.context || 'UI screenshot test cases';
      const mapping = await this.generateMapping(context, input.options.mappingContext);
      result.data.mapping = mapping;
    }

    return result;
  }

  /**
   * Sprint 8: Generate test cases from uploaded file
   */
  private async generateFromFile(input: GenerateInput): Promise<AgentResponse<GenerateOutput>> {
    if (!input.fileUpload) {
      throw new Error('File upload input is required for file_upload input method');
    }

    const parsedContent = this.parseFileContent(input.fileUpload);

    let userPrompt = `Generate test cases from the following parsed file content:\n\n`;
    userPrompt += `File: ${input.fileUpload.fileName}\n`;
    userPrompt += `Content:\n${parsedContent}\n\n`;

    if (input.fileUpload.mapping) {
      userPrompt += `Column/Field mapping:\n${JSON.stringify(input.fileUpload.mapping, null, 2)}\n\n`;
    }

    userPrompt += this.buildOptionsPrompt(input.options);
    userPrompt += '\nReturn the test cases as a JSON object.';

    const result = await this.call<GenerateOutput>(
      GENERATE_SYSTEM_PROMPT,
      userPrompt,
      (text) => this.parseJSON<GenerateOutput>(text)
    );

    if (input.options?.includeMapping) {
      const mapping = await this.generateMapping(parsedContent, input.options.mappingContext);
      result.data.mapping = mapping;
    }

    return result;
  }

  /**
   * Sprint 8: Generate with multi-turn conversation support
   */
  private async generateFromConversation(input: GenerateInput): Promise<AgentResponse<GenerateOutput>> {
    if (!input.conversation?.length) {
      throw new Error('Conversation history is required for conversation input method');
    }

    // Add system context to the last user message
    const messages = input.conversation.map((m, i) => {
      if (i === input.conversation!.length - 1 && m.role === 'user') {
        return {
          role: m.role as 'user' | 'assistant',
          content: `${m.content}\n\n${this.buildOptionsPrompt(input.options)}\nReturn the test cases as a JSON object.`,
        };
      }
      return { role: m.role as 'user' | 'assistant', content: m.content };
    });

    const result = await this.callWithHistory<GenerateOutput>(
      GENERATE_SYSTEM_PROMPT,
      messages,
      (text) => this.parseJSON<GenerateOutput>(text)
    );

    if (input.options?.includeMapping) {
      const lastUserMessage = input.conversation.filter(m => m.role === 'user').pop()?.content || '';
      const mapping = await this.generateMapping(lastUserMessage, input.options.mappingContext);
      result.data.mapping = mapping;
    }

    return result;
  }

  /**
   * Sprint 8: Batch generation for multiple specifications
   */
  async batchGenerate(input: BatchGenerateInput): Promise<AgentResponse<BatchGenerateOutput>> {
    const startTime = Date.now();
    const results: BatchGenerateOutput['results'] = [];
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCostUsd = 0;
    let totalCostInr = 0;
    let totalTestCases = 0;

    // Process each specification
    for (const spec of input.specifications) {
      try {
        const result = await this.generate({
          specification: spec.content,
          inputMethod: spec.inputMethod,
          ...(input.options && { options: input.options }),
        });

        results.push({
          id: spec.id,
          success: true,
          output: result.data,
        });

        totalInputTokens += result.usage.inputTokens;
        totalOutputTokens += result.usage.outputTokens;
        totalCostUsd += result.usage.costUsd;
        totalCostInr += result.usage.costInr;
        totalTestCases += result.data.testCases.length;
      } catch (error) {
        results.push({
          id: spec.id,
          success: false,
          error: (error as Error).message,
        });
      }
    }

    const durationMs = Date.now() - startTime;
    const successful = results.filter(r => r.success).length;

    return {
      data: {
        results,
        summary: {
          total: input.specifications.length,
          successful,
          failed: input.specifications.length - successful,
          totalTestCases,
        },
      },
      usage: {
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        cacheReadTokens: 0,
        cacheCreationTokens: 0,
        costUsd: totalCostUsd,
        costInr: totalCostInr,
        model: this.config.model,
        durationMs,
      },
    };
  }

  /**
   * Sprint 8: Generate AI mapping for test content
   */
  private async generateMapping(
    content: string,
    context?: { products?: string[] | undefined; partners?: string[] | undefined; modules?: string[] | undefined } | undefined
  ): Promise<AIMapping> {
    let mappingPrompt = `Analyze this test content and suggest appropriate categorization:\n\n${content}\n\n`;

    if (context?.products?.length) {
      mappingPrompt += `Available products: ${context.products.join(', ')}\n`;
    }
    if (context?.partners?.length) {
      mappingPrompt += `Available partners/teams: ${context.partners.join(', ')}\n`;
    }
    if (context?.modules?.length) {
      mappingPrompt += `Available modules: ${context.modules.join(', ')}\n`;
    }

    mappingPrompt += '\nReturn the mapping as a JSON object.';

    const result = await this.call<{ mapping: AIMapping }>(
      MAPPING_SYSTEM_PROMPT,
      mappingPrompt,
      (text) => this.parseJSON<{ mapping: AIMapping }>(text)
    );

    return result.data.mapping;
  }

  async evolve(input: EvolveInput): Promise<AgentResponse<EvolveOutput>> {
    // Check for duplicates before evolving (using new specification)
    const duplicateWarning = await this.checkTestCaseDuplicates(
      input.newSpecification,
      input.projectId,
      input.skipDuplicateCheck
    );

    const userPrompt = this.buildEvolvePrompt(input);
    const result = await this.call<EvolveOutput>(
      EVOLVE_SYSTEM_PROMPT,
      userPrompt,
      (text) => this.parseJSON<EvolveOutput>(text)
    );

    // Attach duplicate warning if found
    if (duplicateWarning) {
      result.duplicateWarning = duplicateWarning;
    }

    return result;
  }

  private parseFileContent(fileUpload: FileUploadInput): string {
    const { content, mimeType } = fileUpload;

    switch (mimeType) {
      case 'application/json':
        try {
          const parsed = JSON.parse(content);
          return JSON.stringify(parsed, null, 2);
        } catch {
          return content;
        }

      case 'text/csv':
        // Parse CSV to structured format
        const lines = content.split('\n').filter(l => l.trim());
        if (lines.length === 0) return content;

        const headerLine = lines[0];
        if (!headerLine) return content;
        const headers = headerLine.split(',').map(h => h.trim());
        const rows = lines.slice(1).map(line => {
          const values = line.split(',');
          const row: Record<string, string> = {};
          headers.forEach((h, i) => {
            row[h] = values[i]?.trim() || '';
          });
          return row;
        });
        return JSON.stringify(rows, null, 2);

      case 'text/plain':
      case 'text/markdown':
      default:
        return content;
    }
  }

  private buildOptionsPrompt(options?: GenerateOptions): string {
    if (!options) return '';

    const parts: string[] = ['Requirements:'];

    if (options.maxTestCases) {
      parts.push(`- Maximum test cases: ${options.maxTestCases}`);
    }
    if (options.includeNegativeCases !== undefined) {
      parts.push(`- Include negative test cases: ${options.includeNegativeCases}`);
    }
    if (options.includeEdgeCases !== undefined) {
      parts.push(`- Include edge cases: ${options.includeEdgeCases}`);
    }
    if (options.focusAreas?.length) {
      parts.push(`- Focus areas: ${options.focusAreas.join(', ')}`);
    }
    if (options.testTypes?.length) {
      parts.push(`- Test types to generate: ${options.testTypes.join(', ')}`);
    }

    return parts.length > 1 ? parts.join('\n') + '\n' : '';
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

/**
 * Base Agent Class
 * Common functionality for all AI agents
 */

import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../utils/logger.js';
import {
  duplicateDetectionService,
  DuplicateResult,
} from '../services/duplicate.service.js';

// Model pricing (per 1M tokens) - as of Jan 2026
const MODEL_PRICING = {
  'claude-sonnet-4-20250514': { input: 3.0, output: 15.0 },
  'claude-3-5-sonnet-20241022': { input: 3.0, output: 15.0 },
  'claude-3-5-haiku-20241022': { input: 0.80, output: 4.0 },
  'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
} as const;

const USD_TO_INR = 84.5; // Update periodically

export type ModelId = keyof typeof MODEL_PRICING;

export interface DuplicateWarning {
  isDuplicate: boolean;
  confidence: number;
  matchType: 'exact' | 'near' | 'semantic' | null;
  similarItems: Array<{
    id: string;
    name: string;
    similarity: number;
    path?: string | undefined;
  }>;
  recommendation?: string | undefined;
  checkId?: string | undefined;
}

export interface AgentResponse<T> {
  data: T;
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheCreationTokens: number;
    costUsd: number;
    costInr: number;
    model: string;
    durationMs: number;
  };
  duplicateWarning?: DuplicateWarning;
}

export interface AgentConfig {
  model?: ModelId;
  maxTokens?: number;
  temperature?: number;
  maxRetries?: number;
}

const DEFAULT_CONFIG: Required<AgentConfig> = {
  model: 'claude-sonnet-4-20250514',
  maxTokens: 4096,
  temperature: 0.3,
  maxRetries: 3,
};

export interface ImageContent {
  type: 'image';
  source: {
    type: 'base64';
    media_type: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
    data: string;
  };
}

export interface TextContent {
  type: 'text';
  text: string;
}

export type MessageContent = TextContent | ImageContent;

export abstract class BaseAgent {
  protected client: Anthropic;
  protected config: Required<AgentConfig>;
  protected agentName: string;

  constructor(agentName: string, config: AgentConfig = {}) {
    this.client = new Anthropic();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.agentName = agentName;
  }

  /**
   * Get the Anthropic client instance
   */
  protected getClient(): Anthropic {
    return this.client;
  }

  /**
   * Get the configured model ID
   */
  protected getModel(): ModelId {
    return this.config.model;
  }

  /**
   * Call with multi-turn conversation support
   */
  protected async callWithHistory<T>(
    systemPrompt: string,
    messages: Array<{ role: 'user' | 'assistant'; content: string | MessageContent[] }>,
    parser: (text: string) => T
  ): Promise<AgentResponse<T>> {
    const startTime = Date.now();
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        const response = await this.client.messages.create({
          model: this.config.model,
          max_tokens: this.config.maxTokens,
          temperature: this.config.temperature,
          system: systemPrompt,
          messages: messages.map(m => ({
            role: m.role,
            content: m.content,
          })) as Anthropic.MessageParam[],
        });

        const durationMs = Date.now() - startTime;
        const firstContent = response.content[0];
        const text = firstContent && firstContent.type === 'text' ? firstContent.text : '';

        const data = parser(text);
        const usage = this.calculateUsage(response.usage, durationMs);

        logger.info({
          agent: this.agentName,
          model: this.config.model,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          costUsd: usage.costUsd,
          durationMs,
        }, 'Agent call with history completed');

        return { data, usage };
      } catch (error) {
        lastError = error as Error;
        logger.warn({
          agent: this.agentName,
          attempt,
          error: lastError.message,
        }, 'Agent call failed, retrying');

        if (attempt < this.config.maxRetries) {
          await this.delay(Math.pow(2, attempt) * 1000);
        }
      }
    }

    logger.error({ agent: this.agentName, error: lastError?.message }, 'Agent call failed after retries');
    throw lastError;
  }

  /**
   * Call with vision support (image + text)
   */
  protected async callWithVision<T>(
    systemPrompt: string,
    textPrompt: string,
    imageBase64: string,
    mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
    parser: (text: string) => T
  ): Promise<AgentResponse<T>> {
    const content: MessageContent[] = [
      {
        type: 'image',
        source: {
          type: 'base64',
          media_type: mediaType,
          data: imageBase64,
        },
      },
      {
        type: 'text',
        text: textPrompt,
      },
    ];

    return this.callWithHistory<T>(systemPrompt, [{ role: 'user', content }], parser);
  }

  protected async call<T>(
    systemPrompt: string,
    userPrompt: string,
    parser: (text: string) => T
  ): Promise<AgentResponse<T>> {
    const startTime = Date.now();
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        const response = await this.client.messages.create({
          model: this.config.model,
          max_tokens: this.config.maxTokens,
          temperature: this.config.temperature,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        });

        const durationMs = Date.now() - startTime;
        const firstContent = response.content[0];
        const text = firstContent && firstContent.type === 'text' ? firstContent.text : '';

        const data = parser(text);
        const usage = this.calculateUsage(response.usage, durationMs);

        logger.info({
          agent: this.agentName,
          model: this.config.model,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          costUsd: usage.costUsd,
          durationMs,
        }, 'Agent call completed');

        return { data, usage };
      } catch (error) {
        lastError = error as Error;
        logger.warn({
          agent: this.agentName,
          attempt,
          error: lastError.message,
        }, 'Agent call failed, retrying');

        if (attempt < this.config.maxRetries) {
          await this.delay(Math.pow(2, attempt) * 1000); // Exponential backoff
        }
      }
    }

    logger.error({ agent: this.agentName, error: lastError?.message }, 'Agent call failed after retries');
    throw lastError;
  }

  protected calculateUsage(
    usage: Anthropic.Usage,
    durationMs: number
  ): AgentResponse<unknown>['usage'] {
    const pricing = MODEL_PRICING[this.config.model];
    const inputTokens = usage.input_tokens;
    const outputTokens = usage.output_tokens;
    const cacheReadTokens = (usage as { cache_read_input_tokens?: number }).cache_read_input_tokens ?? 0;
    const cacheCreationTokens = (usage as { cache_creation_input_tokens?: number }).cache_creation_input_tokens ?? 0;

    // Cache reads are 90% cheaper, cache creation is 25% more expensive
    const effectiveInputTokens = inputTokens - cacheReadTokens - cacheCreationTokens
      + (cacheReadTokens * 0.1)
      + (cacheCreationTokens * 1.25);

    const costUsd = (effectiveInputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
    const costInr = costUsd * USD_TO_INR;

    return {
      inputTokens,
      outputTokens,
      cacheReadTokens,
      cacheCreationTokens,
      costUsd: Math.round(costUsd * 1_000_000) / 1_000_000, // 6 decimal places
      costInr: Math.round(costInr * 10_000) / 10_000, // 4 decimal places
      model: this.config.model,
      durationMs,
    };
  }

  protected delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  protected parseJSON<T>(text: string): T {
    // Extract JSON from markdown code blocks if present
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const extracted = jsonMatch?.[1];
    const jsonStr = extracted ? extracted.trim() : text.trim();

    try {
      return JSON.parse(jsonStr) as T;
    } catch {
      throw new Error(`Failed to parse JSON response: ${jsonStr.substring(0, 200)}`);
    }
  }

  /**
   * Check for duplicate test cases before generation
   * @param content - The content to check (test case description, title, etc.)
   * @param projectId - The project ID to check against
   * @param skipCheck - Whether to skip the duplicate check
   * @returns DuplicateWarning if duplicates found, undefined otherwise
   */
  protected async checkTestCaseDuplicates(
    content: string,
    projectId?: string,
    skipCheck = false
  ): Promise<DuplicateWarning | undefined> {
    if (skipCheck || !projectId) {
      return undefined;
    }

    try {
      const result: DuplicateResult = await duplicateDetectionService.checkTestCase(
        content,
        projectId
      );

      if (result.isDuplicate || result.confidence >= 60) {
        logger.info({
          agent: this.agentName,
          projectId,
          isDuplicate: result.isDuplicate,
          confidence: result.confidence,
          matchType: result.matchType,
          similarCount: result.similarItems.length,
        }, 'Duplicate check completed for test case');

        return {
          isDuplicate: result.isDuplicate,
          confidence: result.confidence,
          matchType: result.matchType,
          similarItems: result.similarItems,
          recommendation: result.recommendation,
          checkId: result.checkId,
        };
      }

      return undefined;
    } catch (error) {
      logger.warn({
        agent: this.agentName,
        error: (error as Error).message,
      }, 'Duplicate check failed, proceeding without check');
      return undefined;
    }
  }

  /**
   * Check for duplicate scripts before generation
   * @param code - The code to check
   * @param projectId - The project ID to check against
   * @param skipCheck - Whether to skip the duplicate check
   * @returns DuplicateWarning if duplicates found, undefined otherwise
   */
  protected async checkScriptDuplicates(
    code: string,
    projectId?: string,
    skipCheck = false
  ): Promise<DuplicateWarning | undefined> {
    if (skipCheck || !projectId) {
      return undefined;
    }

    try {
      const result: DuplicateResult = await duplicateDetectionService.checkScript(
        code,
        projectId
      );

      if (result.isDuplicate || result.confidence >= 60) {
        logger.info({
          agent: this.agentName,
          projectId,
          isDuplicate: result.isDuplicate,
          confidence: result.confidence,
          matchType: result.matchType,
          similarCount: result.similarItems.length,
        }, 'Duplicate check completed for script');

        return {
          isDuplicate: result.isDuplicate,
          confidence: result.confidence,
          matchType: result.matchType,
          similarItems: result.similarItems,
          recommendation: result.recommendation,
          checkId: result.checkId,
        };
      }

      return undefined;
    } catch (error) {
      logger.warn({
        agent: this.agentName,
        error: (error as Error).message,
      }, 'Duplicate check failed, proceeding without check');
      return undefined;
    }
  }
}

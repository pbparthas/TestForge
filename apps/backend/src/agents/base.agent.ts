/**
 * Base Agent Class
 * Common functionality for all AI agents
 */

import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../utils/logger.js';

// Model pricing (per 1M tokens) - as of Jan 2026
const MODEL_PRICING = {
  'claude-sonnet-4-20250514': { input: 3.0, output: 15.0 },
  'claude-3-5-sonnet-20241022': { input: 3.0, output: 15.0 },
  'claude-3-5-haiku-20241022': { input: 0.80, output: 4.0 },
  'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
} as const;

const USD_TO_INR = 84.5; // Update periodically

export type ModelId = keyof typeof MODEL_PRICING;

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
}

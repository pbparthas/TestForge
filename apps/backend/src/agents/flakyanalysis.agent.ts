/**
 * Flaky Analysis Agent
 * Sprint 14: AI-powered root cause analysis for flaky tests
 *
 * Capabilities:
 * - Analyze execution history to identify flakiness patterns
 * - Detect root causes (timing, race conditions, selectors, etc.)
 * - Suggest fixes based on identified patterns
 * - Generate analysis reports
 */

import { BaseAgent, AgentResponse, AgentConfig } from './base.agent.js';
import type { FlakyPatternType } from '@prisma/client';

// =============================================================================
// TYPES
// =============================================================================

export interface ExecutionHistoryEntry {
  executionId: string;
  timestamp: Date;
  status: 'passed' | 'failed';
  duration: number;
  errorMessage?: string;
  stackTrace?: string;
  environment?: string;
  browser?: string;
  retryAttempt?: number;
}

export interface AnalyzeRootCauseInput {
  testName: string;
  testCode: string;
  executionHistory: ExecutionHistoryEntry[];
  flakinessScore: number;
  recentErrors: string[];
}

export interface RootCauseAnalysis {
  primaryPattern: FlakyPatternType;
  confidence: number; // 0-100
  rootCauses: Array<{
    cause: string;
    confidence: number;
    evidence: string[];
    codeLocation?: string;
  }>;
  suggestedFixes: Array<{
    description: string;
    codeChange?: string;
    priority: 'critical' | 'high' | 'medium' | 'low';
    effort: 'minimal' | 'moderate' | 'significant';
  }>;
  analysis: string;
  additionalPatterns: FlakyPatternType[];
}

export interface DetectPatternsInput {
  projectId: string;
  flakyTests: Array<{
    testName: string;
    flakinessScore: number;
    totalRuns: number;
    passRate: number;
    recentErrors: string[];
    lastPassAt?: Date;
    lastFailAt?: Date;
  }>;
}

export interface PatternDetectionResult {
  patterns: Array<{
    patternType: FlakyPatternType;
    description: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    affectedTests: string[];
    confidence: number;
    suggestedFix: string;
  }>;
  summary: {
    mostCommonPattern: FlakyPatternType;
    totalAffected: number;
    recommendations: string[];
  };
}

export interface GenerateReportInput {
  projectId: string;
  projectName: string;
  flakyTests: Array<{
    testName: string;
    flakinessScore: number;
    patternType: FlakyPatternType | null;
    isQuarantined: boolean;
    fixStatus: string;
  }>;
  patterns: Array<{
    patternType: FlakyPatternType;
    description: string;
    affectedCount: number;
  }>;
  trends: {
    totalFlaky: number;
    newFlaky: number;
    fixed: number;
    quarantined: number;
    avgScore: number;
  };
}

export interface FlakyReport {
  summary: string;
  executiveSummary: string;
  keyFindings: string[];
  recommendations: Array<{
    priority: number;
    action: string;
    impact: string;
    effort: string;
  }>;
  detailedAnalysis: string;
  nextSteps: string[];
}

export interface SuggestFixInput {
  testName: string;
  testCode: string;
  patternType: FlakyPatternType;
  errorMessages: string[];
}

export interface FixSuggestion {
  fixType: string;
  description: string;
  codeChanges: Array<{
    location: string;
    original: string;
    suggested: string;
    explanation: string;
  }>;
  additionalRecommendations: string[];
  estimatedEffort: 'minimal' | 'moderate' | 'significant';
  testingNotes: string;
}

// =============================================================================
// AGENT
// =============================================================================

export class FlakyAnalysisAgent extends BaseAgent {
  constructor(config: AgentConfig = {}) {
    super('FlakyAnalysisAgent', {
      model: 'claude-sonnet-4-20250514',
      maxTokens: 4096,
      temperature: 0.2,
      ...config,
    });
  }

  /**
   * Analyze root cause of a flaky test
   */
  async analyzeRootCause(
    input: AnalyzeRootCauseInput
  ): Promise<AgentResponse<RootCauseAnalysis>> {
    const systemPrompt = `You are an expert test automation engineer specializing in diagnosing flaky tests.
Your task is to analyze execution history and test code to identify the root cause of flakiness.

Pattern types to consider:
- timing: Tests fail due to timing issues, race conditions with async operations, or insufficient waits
- race_condition: Concurrent operations causing non-deterministic behavior
- flaky_selector: DOM selectors that match inconsistently (dynamic IDs, position-based, etc.)
- network: Network-related flakiness (timeouts, API failures, slow responses)
- state_dependent: Tests depend on external state that isn't properly isolated
- environment: Environment-specific issues (CI vs local, browser versions, OS differences)
- data_dependent: Tests depend on specific data that may change or be unavailable
- unknown: Cannot determine the pattern with confidence

Provide a thorough analysis with concrete evidence from the execution history.`;

    const userPrompt = `Analyze this flaky test:

TEST NAME: ${input.testName}
FLAKINESS SCORE: ${input.flakinessScore}%

TEST CODE:
\`\`\`
${input.testCode}
\`\`\`

EXECUTION HISTORY (last ${input.executionHistory.length} runs):
${input.executionHistory.map(e =>
  `- ${e.timestamp.toISOString()}: ${e.status.toUpperCase()} (${e.duration}ms)${e.errorMessage ? ` - ${e.errorMessage}` : ''}`
).join('\n')}

RECENT ERRORS:
${input.recentErrors.map(e => `- ${e}`).join('\n')}

Analyze the root cause and provide your response in this JSON format:
{
  "primaryPattern": "timing|race_condition|flaky_selector|network|state_dependent|environment|data_dependent|unknown",
  "confidence": 0-100,
  "rootCauses": [
    {
      "cause": "description of root cause",
      "confidence": 0-100,
      "evidence": ["evidence from history or code"],
      "codeLocation": "line or function where issue exists"
    }
  ],
  "suggestedFixes": [
    {
      "description": "what to fix",
      "codeChange": "suggested code snippet if applicable",
      "priority": "critical|high|medium|low",
      "effort": "minimal|moderate|significant"
    }
  ],
  "analysis": "detailed explanation of findings",
  "additionalPatterns": ["other patterns that may contribute"]
}`;

    return this.call<RootCauseAnalysis>(
      systemPrompt,
      userPrompt,
      (text) => this.parseJSON<RootCauseAnalysis>(text)
    );
  }

  /**
   * Detect patterns across multiple flaky tests
   */
  async detectPatterns(
    input: DetectPatternsInput
  ): Promise<AgentResponse<PatternDetectionResult>> {
    const systemPrompt = `You are an expert test automation engineer analyzing patterns across flaky tests.
Your task is to identify common patterns of flakiness across a test suite.

Look for:
1. Shared root causes (e.g., all tests using same selector pattern)
2. Environmental correlations (e.g., failures cluster in CI)
3. Timing patterns (e.g., failures at similar points in test flow)
4. Resource contention (e.g., tests competing for same resources)

Provide actionable insights that help the team fix multiple tests at once.`;

    const userPrompt = `Analyze these ${input.flakyTests.length} flaky tests for patterns:

${input.flakyTests.map(t => `
TEST: ${t.testName}
- Flakiness Score: ${t.flakinessScore}%
- Total Runs: ${t.totalRuns}
- Pass Rate: ${t.passRate}%
- Last Pass: ${t.lastPassAt?.toISOString() || 'N/A'}
- Last Fail: ${t.lastFailAt?.toISOString() || 'N/A'}
- Recent Errors: ${t.recentErrors.slice(0, 3).join('; ') || 'N/A'}
`).join('\n---\n')}

Identify patterns and provide your response in this JSON format:
{
  "patterns": [
    {
      "patternType": "timing|race_condition|flaky_selector|network|state_dependent|environment|data_dependent|unknown",
      "description": "description of the pattern",
      "severity": "critical|high|medium|low",
      "affectedTests": ["test names affected"],
      "confidence": 0-100,
      "suggestedFix": "how to address this pattern"
    }
  ],
  "summary": {
    "mostCommonPattern": "pattern type",
    "totalAffected": number,
    "recommendations": ["actionable recommendations"]
  }
}`;

    return this.call<PatternDetectionResult>(
      systemPrompt,
      userPrompt,
      (text) => this.parseJSON<PatternDetectionResult>(text)
    );
  }

  /**
   * Generate a flaky test report
   */
  async generateReport(
    input: GenerateReportInput
  ): Promise<AgentResponse<FlakyReport>> {
    const systemPrompt = `You are a QA engineering lead preparing a flaky test report for stakeholders.
Your report should be actionable, data-driven, and provide clear recommendations.

The report should help:
1. Engineering managers understand the impact on velocity
2. Developers know what to prioritize fixing
3. QA leads track progress on test stability`;

    const userPrompt = `Generate a flaky test report for project: ${input.projectName}

SUMMARY METRICS:
- Total Flaky Tests: ${input.trends.totalFlaky}
- New Flaky (this period): ${input.trends.newFlaky}
- Fixed: ${input.trends.fixed}
- Quarantined: ${input.trends.quarantined}
- Average Flakiness Score: ${input.trends.avgScore}%

TOP FLAKY TESTS:
${input.flakyTests.slice(0, 10).map(t =>
  `- ${t.testName}: ${t.flakinessScore}% (${t.patternType || 'unknown pattern'}) [${t.fixStatus}]${t.isQuarantined ? ' [QUARANTINED]' : ''}`
).join('\n')}

DETECTED PATTERNS:
${input.patterns.map(p =>
  `- ${p.patternType}: ${p.description} (${p.affectedCount} tests affected)`
).join('\n') || 'No patterns detected yet'}

Generate a comprehensive report in this JSON format:
{
  "summary": "2-3 sentence executive summary",
  "executiveSummary": "paragraph for non-technical stakeholders",
  "keyFindings": ["finding 1", "finding 2", ...],
  "recommendations": [
    {
      "priority": 1-5,
      "action": "specific action to take",
      "impact": "expected impact",
      "effort": "low|medium|high"
    }
  ],
  "detailedAnalysis": "technical analysis paragraph",
  "nextSteps": ["immediate next step 1", "step 2", ...]
}`;

    return this.call<FlakyReport>(
      systemPrompt,
      userPrompt,
      (text) => this.parseJSON<FlakyReport>(text)
    );
  }

  /**
   * Suggest specific fixes for a flaky test
   */
  async suggestFix(
    input: SuggestFixInput
  ): Promise<AgentResponse<FixSuggestion>> {
    const systemPrompt = `You are an expert test automation engineer providing specific code fixes for flaky tests.
Based on the identified pattern type, provide concrete, actionable code changes.

For each pattern type, consider:
- timing: Add explicit waits, use proper async/await patterns, waitFor utilities
- race_condition: Add mutex/locks, ensure proper cleanup, isolate parallel operations
- flaky_selector: Use data-testid, stable selectors, element visibility checks
- network: Add retry logic, mock APIs, increase timeouts with backoff
- state_dependent: Proper setup/teardown, database isolation, fixture management
- environment: Environment detection, CI-specific configurations, browser normalization
- data_dependent: Use factories, seed data, proper fixtures`;

    const userPrompt = `Suggest fixes for this flaky test:

TEST NAME: ${input.testName}
IDENTIFIED PATTERN: ${input.patternType}

TEST CODE:
\`\`\`
${input.testCode}
\`\`\`

RECENT ERRORS:
${input.errorMessages.map(e => `- ${e}`).join('\n')}

Provide specific fixes in this JSON format:
{
  "fixType": "type of fix (e.g., 'add explicit wait', 'stabilize selector')",
  "description": "overall description of the fix approach",
  "codeChanges": [
    {
      "location": "line number or function name",
      "original": "original code snippet",
      "suggested": "suggested replacement code",
      "explanation": "why this change helps"
    }
  ],
  "additionalRecommendations": ["other things to consider"],
  "estimatedEffort": "minimal|moderate|significant",
  "testingNotes": "how to verify the fix works"
}`;

    return this.call<FixSuggestion>(
      systemPrompt,
      userPrompt,
      (text) => this.parseJSON<FixSuggestion>(text)
    );
  }

  /**
   * Classify a test's flakiness pattern from error messages
   */
  async classifyPattern(
    testName: string,
    errorMessages: string[]
  ): Promise<AgentResponse<{ pattern: FlakyPatternType; confidence: number; reasoning: string }>> {
    const systemPrompt = `You are an expert at classifying flaky test patterns from error messages.
Analyze the errors and classify into one of these patterns:
- timing: Timeout errors, element not found after wait, async issues
- race_condition: Stale element, element detached, concurrent modification
- flaky_selector: Element not found (dynamic ID), multiple matches, wrong element
- network: Connection refused, timeout, HTTP errors, API failures
- state_dependent: Assertion on expected state, database constraint, auth issues
- environment: Browser-specific, OS-specific, CI-specific failures
- data_dependent: Data not found, unexpected data format, null references
- unknown: Cannot determine with confidence`;

    const userPrompt = `Classify the flakiness pattern for test: ${testName}

ERROR MESSAGES:
${errorMessages.map(e => `- ${e}`).join('\n')}

Respond in JSON format:
{
  "pattern": "timing|race_condition|flaky_selector|network|state_dependent|environment|data_dependent|unknown",
  "confidence": 0-100,
  "reasoning": "explanation for the classification"
}`;

    return this.call<{ pattern: FlakyPatternType; confidence: number; reasoning: string }>(
      systemPrompt,
      userPrompt,
      (text) => this.parseJSON<{ pattern: FlakyPatternType; confidence: number; reasoning: string }>(text)
    );
  }
}

export const flakyAnalysisAgent = new FlakyAnalysisAgent();

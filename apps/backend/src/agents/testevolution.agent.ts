/**
 * Test Evolution Agent
 * Analyzes test health, coverage evolution, stale tests, and test risk scoring
 */

import { BaseAgent, AgentResponse, AgentConfig } from './base.agent.js';

// ============================================================================
// Input Types
// ============================================================================

export interface TestInfo {
  id: string;
  name: string;
  file: string;
  line?: number | undefined;
  suite?: string | undefined;
  tags?: string[] | undefined;
  lastModified?: string | undefined;
  createdAt?: string | undefined;
}

export interface TestSuiteInput {
  tests: TestInfo[];
  projectRoot?: string | undefined;
}

export interface TestExecutionResult {
  testId: string;
  status: 'passed' | 'failed' | 'skipped' | 'flaky';
  duration: number;
  error?: string | undefined;
  retries?: number | undefined;
  environment?: string | undefined;
}

export interface TestRun {
  id: string;
  timestamp: string;
  duration: number;
  results: TestExecutionResult[];
  branch?: string | undefined;
  commit?: string | undefined;
}

export interface TestExecutionHistory {
  runs: TestRun[];
  totalRuns: number;
  timeRange: {
    from: string;
    to: string;
  };
}

export interface FileCoverage {
  path: string;
  lines: number;
  branches: number;
  functions: number;
  statements: number;
  uncoveredLines?: number[] | undefined;
}

export interface CoverageSnapshot {
  timestamp: string;
  overall: number;
  lines?: number | undefined;
  branches?: number | undefined;
  functions?: number | undefined;
  statements?: number | undefined;
  files?: FileCoverage[] | undefined;
}

export interface CoverageData {
  current: CoverageSnapshot;
  history: Array<{
    timestamp: string;
    overall: number;
  }>;
}

export interface CodeChange {
  file: string;
  lastModified: string;
  changeCount: number;
  changedFunctions?: string[] | undefined;
}

// ============================================================================
// Options Types
// ============================================================================

export interface TestHealthOptions {
  flakinessThreshold?: number | undefined;
  slowTestThreshold?: number | undefined;
  minRunsForAnalysis?: number | undefined;
  filterByTags?: string[] | undefined;
  filterBySuite?: string | undefined;
}

export interface CoverageEvolutionOptions {
  targetCoverage?: number | undefined;
  regressionThreshold?: number | undefined;
  gapThreshold?: number | undefined;
  includePatterns?: string[] | undefined;
  excludePatterns?: string[] | undefined;
}

export interface StaleTestsOptions {
  stalenessDays?: number | undefined;
  includeDeadCodeAnalysis?: boolean | undefined;
  includeApiContractAnalysis?: boolean | undefined;
}

export interface TestRiskOptions {
  riskWeights?: {
    flakiness?: number | undefined;
    staleness?: number | undefined;
    complexity?: number | undefined;
    dependencies?: number | undefined;
  } | undefined;
  criticalThreshold?: number | undefined;
  highThreshold?: number | undefined;
  mediumThreshold?: number | undefined;
}

// ============================================================================
// Output Types - Test Health
// ============================================================================

export interface FlakyTest {
  testId: string;
  name: string;
  flakinessScore: number;
  failureRate: number;
  passRate: number;
  recentResults: string[];
  patterns: string[];
  recommendation: string;
}

export interface ReliableTest {
  testId: string;
  name: string;
  passRate: number;
  avgDuration: number;
  consistency: 'high' | 'medium' | 'low';
}

export interface TestHealthOutput {
  summary: {
    totalTests: number;
    healthScore: number;
    healthStatus: 'healthy' | 'good' | 'warning' | 'critical' | 'unknown';
    flakyTests: number;
    slowTests: number;
    failingTests: number;
    avgPassRate: number;
    avgDuration: number;
  };
  flakiness: {
    flakyTests: FlakyTest[];
    overallFlakinessScore: number;
    trend: 'decreasing' | 'stable' | 'increasing' | 'unknown';
  };
  reliability: {
    mostReliable: ReliableTest[];
    leastReliable: ReliableTest[];
  };
  executionTrends: {
    durationTrend: 'improving' | 'stable' | 'degrading' | 'unknown';
    passRateTrend: 'improving' | 'stable' | 'declining' | 'unknown';
    avgDurationChange: number;
    avgPassRateChange: number;
  };
  recommendations: string[];
}

// ============================================================================
// Output Types - Coverage Evolution
// ============================================================================

export interface WeeklyTrend {
  week: string;
  coverage: number;
  change: number;
}

export interface MonthlyTrend {
  month: string;
  avgCoverage: number;
  change: number;
}

export interface CoverageRegression {
  file: string;
  previousCoverage: number;
  currentCoverage: number;
  change: number;
  cause: string;
  affectedLines: number[];
}

export interface CoverageGap {
  file: string;
  coverage: number;
  gap: number;
  priority: 'high' | 'medium' | 'low';
  uncoveredAreas: string[];
  suggestedTests: string[];
}

export interface CoverageImprovement {
  file: string;
  previousCoverage: number;
  currentCoverage: number;
  change: number;
  contributor: string;
}

export interface CoverageEvolutionOutput {
  summary: {
    currentCoverage: number;
    previousCoverage: number;
    changePercent: number;
    trend: 'improving' | 'stable' | 'declining' | 'unknown';
    targetCoverage: number;
    gapToTarget: number;
    projectedTimeToTarget: string;
  };
  trends: {
    weekly: WeeklyTrend[];
    monthly: MonthlyTrend[];
    velocity: number;
  };
  regressions: CoverageRegression[];
  gaps: CoverageGap[];
  improvements: CoverageImprovement[];
  recommendations: string[];
}

// ============================================================================
// Output Types - Stale Tests
// ============================================================================

export interface StaleTest {
  testId: string;
  name: string;
  file: string;
  lastModified: string;
  daysSinceModification: number;
  staleness: 'high' | 'medium' | 'low';
  reasons: string[];
  targetCodeChanges: number;
  recommendation: string;
}

export interface DeadCodeTest {
  testId: string;
  name: string;
  file: string;
  reason: string;
  targetFunction: string;
  lastExecution: string;
  recommendation: string;
}

export interface OutdatedTest {
  testId: string;
  name: string;
  file: string;
  outdatedAspects: Array<{
    aspect: string;
    currentTest: string;
    currentCode: string;
  }>;
  recommendation: string;
}

export interface StaleTestsOutput {
  summary: {
    totalTests: number;
    staleTests: number;
    deadCodeTests: number;
    outdatedTests: number;
    stalenessScore: number;
  };
  staleTests: StaleTest[];
  deadCodeTests: DeadCodeTest[];
  outdatedTests: OutdatedTest[];
  recommendations: string[];
  maintenanceEffort: {
    totalHours: number;
    byPriority: {
      high: number;
      medium: number;
      low: number;
    };
  };
}

// ============================================================================
// Output Types - Test Risk
// ============================================================================

export interface RiskFactor {
  factor: string;
  weight: number;
  score: number;
}

export interface TestImpact {
  blocksRelease: boolean;
  affectedFeatures: string[];
  downstreamTests: number;
}

export interface TestRisk {
  testId: string;
  name: string;
  riskScore: number;
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
  riskFactors: RiskFactor[];
  impact: TestImpact;
  recommendations: string[];
  maintenancePriority: number;
}

export interface RiskDistribution {
  byCategory: {
    flakiness: number;
    staleness: number;
    complexity: number;
    dependencies: number;
  };
  byTestType: {
    unit: number;
    integration: number;
    e2e: number;
  };
}

export interface MaintenancePlan {
  immediate: string[];
  shortTerm: string[];
  longTerm: string[];
  estimatedEffort: {
    immediate: number;
    shortTerm: number;
    longTerm: number;
  };
}

export interface TestRiskOutput {
  summary: {
    overallRiskScore: number;
    riskLevel: 'critical' | 'high' | 'medium' | 'low';
    criticalRiskTests: number;
    highRiskTests: number;
    mediumRiskTests: number;
    lowRiskTests: number;
  };
  testRisks: TestRisk[];
  riskDistribution: RiskDistribution;
  maintenancePlan: MaintenancePlan;
  recommendations: string[];
}

// ============================================================================
// System Prompts
// ============================================================================

const TEST_HEALTH_SYSTEM_PROMPT = `You are Test Health Analyzer, an expert at evaluating test suite health and identifying problematic tests.

Analyze the provided test suite and execution history to determine:
1. Overall test suite health score (0-100)
2. Flaky tests with flakiness scores and patterns
3. Reliability metrics for each test
4. Execution trends over time
5. Actionable recommendations

Health status levels:
- healthy: 80-100 score
- good: 60-79 score
- warning: 40-59 score
- critical: 0-39 score
- unknown: insufficient data

Output JSON:
{
  "summary": {
    "totalTests": 10,
    "healthScore": 72,
    "healthStatus": "warning",
    "flakyTests": 2,
    "slowTests": 1,
    "failingTests": 1,
    "avgPassRate": 85.5,
    "avgDuration": 1500
  },
  "flakiness": {
    "flakyTests": [
      {
        "testId": "test-001",
        "name": "test name",
        "flakinessScore": 45,
        "failureRate": 66.7,
        "passRate": 33.3,
        "recentResults": ["failed", "passed", "failed"],
        "patterns": ["Intermittent timeout", "Environment-dependent"],
        "recommendation": "Add retry logic and increase timeout"
      }
    ],
    "overallFlakinessScore": 35,
    "trend": "increasing"
  },
  "reliability": {
    "mostReliable": [
      {
        "testId": "test-002",
        "name": "reliable test",
        "passRate": 100,
        "avgDuration": 120,
        "consistency": "high"
      }
    ],
    "leastReliable": [
      {
        "testId": "test-003",
        "name": "unreliable test",
        "passRate": 50,
        "avgDuration": 3000,
        "consistency": "low"
      }
    ]
  },
  "executionTrends": {
    "durationTrend": "stable",
    "passRateTrend": "declining",
    "avgDurationChange": 2.5,
    "avgPassRateChange": -5.2
  },
  "recommendations": [
    "Investigate and fix flaky tests",
    "Add mocking for external dependencies"
  ]
}`;

const COVERAGE_EVOLUTION_SYSTEM_PROMPT = `You are Coverage Evolution Analyzer, an expert at tracking and analyzing test coverage trends over time.

Analyze the provided coverage data and history to determine:
1. Coverage trends (weekly, monthly)
2. Coverage regressions (files with decreased coverage)
3. Coverage gaps (files below target)
4. Improvements and their contributors
5. Projected time to reach target coverage

Output JSON:
{
  "summary": {
    "currentCoverage": 78.5,
    "previousCoverage": 75.2,
    "changePercent": 4.4,
    "trend": "improving",
    "targetCoverage": 80,
    "gapToTarget": 1.5,
    "projectedTimeToTarget": "2 weeks"
  },
  "trends": {
    "weekly": [
      {"week": "2026-W03", "coverage": 78.5, "change": 3.3}
    ],
    "monthly": [
      {"month": "2026-01", "avgCoverage": 75.8, "change": 5.3}
    ],
    "velocity": 1.2
  },
  "regressions": [
    {
      "file": "src/services/payment.service.ts",
      "previousCoverage": 55.0,
      "currentCoverage": 45.0,
      "change": -10.0,
      "cause": "New methods added without tests",
      "affectedLines": [12, 23, 34]
    }
  ],
  "gaps": [
    {
      "file": "src/services/payment.service.ts",
      "coverage": 45.0,
      "gap": 35.0,
      "priority": "high",
      "uncoveredAreas": ["error handling", "refund flow"],
      "suggestedTests": ["Add error scenario tests"]
    }
  ],
  "improvements": [
    {
      "file": "src/services/auth.service.ts",
      "previousCoverage": 85.0,
      "currentCoverage": 95.0,
      "change": 10.0,
      "contributor": "Added login edge case tests"
    }
  ],
  "recommendations": [
    "Focus on payment.service.ts to close coverage gap",
    "Address coverage regression before next release"
  ]
}`;

const STALE_TESTS_SYSTEM_PROMPT = `You are Stale Tests Detector, an expert at identifying tests that need maintenance or removal.

Analyze the provided tests and code changes to identify:
1. Stale tests (not updated despite code changes)
2. Dead code tests (testing non-existent functionality)
3. Outdated tests (API contract mismatches)
4. Maintenance effort estimates

Staleness levels:
- high: >180 days or significant code drift
- medium: 90-180 days or moderate code drift
- low: 30-90 days or minor code drift

Output JSON:
{
  "summary": {
    "totalTests": 10,
    "staleTests": 2,
    "deadCodeTests": 1,
    "outdatedTests": 1,
    "stalenessScore": 35
  },
  "staleTests": [
    {
      "testId": "test-001",
      "name": "test name",
      "file": "tests/test.ts",
      "lastModified": "2024-06-01T10:00:00Z",
      "daysSinceModification": 232,
      "staleness": "high",
      "reasons": ["Not modified in over 6 months"],
      "targetCodeChanges": 15,
      "recommendation": "Review and update to match current implementation"
    }
  ],
  "deadCodeTests": [
    {
      "testId": "test-legacy",
      "name": "legacy test",
      "file": "tests/legacy.test.ts",
      "reason": "Tests deprecated function",
      "targetFunction": "deprecatedLogin",
      "lastExecution": "never",
      "recommendation": "Remove test"
    }
  ],
  "outdatedTests": [
    {
      "testId": "test-002",
      "name": "outdated test",
      "file": "tests/api.test.ts",
      "outdatedAspects": [
        {
          "aspect": "API contract",
          "currentTest": "Uses old response format",
          "currentCode": "Returns new format"
        }
      ],
      "recommendation": "Update test to match new API contract"
    }
  ],
  "recommendations": [
    "Prioritize updating high staleness tests",
    "Remove dead code tests",
    "Establish test maintenance schedule"
  ],
  "maintenanceEffort": {
    "totalHours": 8,
    "byPriority": {
      "high": 4,
      "medium": 3,
      "low": 1
    }
  }
}`;

const TEST_RISK_SYSTEM_PROMPT = `You are Test Risk Scorer, an expert at assessing risk levels of tests and prioritizing maintenance.

Analyze the provided tests, execution history, and coverage to score risk:
1. Calculate risk score (0-100) for each test
2. Identify risk factors (flakiness, staleness, complexity, dependencies)
3. Assess impact on releases and features
4. Create prioritized maintenance plan

Risk levels:
- critical: 80-100 score
- high: 60-79 score
- medium: 40-59 score
- low: 0-39 score

Output JSON:
{
  "summary": {
    "overallRiskScore": 65,
    "riskLevel": "medium",
    "criticalRiskTests": 1,
    "highRiskTests": 2,
    "mediumRiskTests": 1,
    "lowRiskTests": 0
  },
  "testRisks": [
    {
      "testId": "test-001",
      "name": "high risk test",
      "riskScore": 85,
      "riskLevel": "critical",
      "riskFactors": [
        {"factor": "High flakiness", "weight": 35, "score": 90},
        {"factor": "External dependencies", "weight": 25, "score": 80}
      ],
      "impact": {
        "blocksRelease": true,
        "affectedFeatures": ["Dashboard", "User Experience"],
        "downstreamTests": 3
      },
      "recommendations": [
        "Add retry mechanism",
        "Mock external dependencies"
      ],
      "maintenancePriority": 1
    }
  ],
  "riskDistribution": {
    "byCategory": {
      "flakiness": 35,
      "staleness": 25,
      "complexity": 20,
      "dependencies": 20
    },
    "byTestType": {
      "unit": 10,
      "integration": 45,
      "e2e": 45
    }
  },
  "maintenancePlan": {
    "immediate": ["test-001"],
    "shortTerm": ["test-002"],
    "longTerm": [],
    "estimatedEffort": {
      "immediate": 4,
      "shortTerm": 6,
      "longTerm": 0
    }
  },
  "recommendations": [
    "Address critical E2E test stability first",
    "Consider test pyramid rebalancing"
  ]
}`;

// ============================================================================
// Test Evolution Agent Class
// ============================================================================

export class TestEvolutionAgent extends BaseAgent {
  constructor(config?: AgentConfig) {
    super('TestEvolutionAgent', config);
  }

  /**
   * Analyze test suite health and identify problematic tests
   */
  async analyzeTestHealth(
    input: TestSuiteInput,
    executionHistory: TestExecutionHistory,
    options?: TestHealthOptions
  ): Promise<AgentResponse<TestHealthOutput>> {
    const userPrompt = this.buildTestHealthPrompt(input, executionHistory, options);
    return this.call<TestHealthOutput>(
      TEST_HEALTH_SYSTEM_PROMPT,
      userPrompt,
      (text) => this.parseJSON<TestHealthOutput>(text)
    );
  }

  /**
   * Track coverage evolution and identify trends
   */
  async trackCoverageEvolution(
    coverageData: CoverageData,
    options?: CoverageEvolutionOptions
  ): Promise<AgentResponse<CoverageEvolutionOutput>> {
    const userPrompt = this.buildCoverageEvolutionPrompt(coverageData, options);
    return this.call<CoverageEvolutionOutput>(
      COVERAGE_EVOLUTION_SYSTEM_PROMPT,
      userPrompt,
      (text) => this.parseJSON<CoverageEvolutionOutput>(text)
    );
  }

  /**
   * Detect stale and outdated tests
   */
  async detectStaleTests(
    input: TestSuiteInput,
    codeChanges: CodeChange[],
    options?: StaleTestsOptions
  ): Promise<AgentResponse<StaleTestsOutput>> {
    const userPrompt = this.buildStaleTestsPrompt(input, codeChanges, options);
    return this.call<StaleTestsOutput>(
      STALE_TESTS_SYSTEM_PROMPT,
      userPrompt,
      (text) => this.parseJSON<StaleTestsOutput>(text)
    );
  }

  /**
   * Score test risk and prioritize maintenance
   */
  async scoreTestRisk(
    input: TestSuiteInput,
    executionHistory: TestExecutionHistory,
    coverageData: CoverageData,
    options?: TestRiskOptions
  ): Promise<AgentResponse<TestRiskOutput>> {
    const userPrompt = this.buildTestRiskPrompt(input, executionHistory, coverageData, options);
    return this.call<TestRiskOutput>(
      TEST_RISK_SYSTEM_PROMPT,
      userPrompt,
      (text) => this.parseJSON<TestRiskOutput>(text)
    );
  }

  // ============================================================================
  // Private Prompt Builders
  // ============================================================================

  private buildTestHealthPrompt(
    input: TestSuiteInput,
    executionHistory: TestExecutionHistory,
    options?: TestHealthOptions
  ): string {
    let prompt = `Analyze the health of the following test suite with ${input.tests.length} tests:\n\n`;

    // Add options context
    if (options?.flakinessThreshold) {
      prompt += `FLAKINESS THRESHOLD: ${options.flakinessThreshold}%\n`;
    }
    if (options?.slowTestThreshold) {
      prompt += `SLOW TEST THRESHOLD: ${options.slowTestThreshold}ms\n`;
    }
    if (options?.minRunsForAnalysis) {
      prompt += `MIN RUNS FOR ANALYSIS: ${options.minRunsForAnalysis}\n`;
    }
    if (options?.filterByTags?.length) {
      prompt += `FILTER TAGS: ${options.filterByTags.join(', ')}\n`;
    }
    if (options?.filterBySuite) {
      prompt += `FILTER SUITE: ${options.filterBySuite}\n`;
    }

    if (input.projectRoot) {
      prompt += `PROJECT ROOT: ${input.projectRoot}\n`;
    }
    prompt += '\n';

    // Add test definitions
    prompt += 'TESTS:\n';
    input.tests.forEach((test, index) => {
      prompt += `\n--- Test ${index + 1} ---\n`;
      prompt += `ID: ${test.id}\n`;
      prompt += `Name: ${test.name}\n`;
      prompt += `File: ${test.file}\n`;
      if (test.line) prompt += `Line: ${test.line}\n`;
      if (test.suite) prompt += `Suite: ${test.suite}\n`;
      if (test.tags?.length) prompt += `Tags: ${test.tags.join(', ')}\n`;
      if (test.lastModified) prompt += `Last Modified: ${test.lastModified}\n`;
      if (test.createdAt) prompt += `Created: ${test.createdAt}\n`;
    });

    // Add execution history
    prompt += '\nEXECUTION HISTORY:\n';
    prompt += `Total Runs: ${executionHistory.totalRuns}\n`;
    prompt += `Time Range: ${executionHistory.timeRange.from} to ${executionHistory.timeRange.to}\n`;

    if (executionHistory.runs.length > 0) {
      prompt += '\nRecent Runs:\n';
      executionHistory.runs.slice(0, 10).forEach((run, index) => {
        prompt += `\n--- Run ${index + 1} ---\n`;
        prompt += `ID: ${run.id}\n`;
        prompt += `Timestamp: ${run.timestamp}\n`;
        prompt += `Duration: ${run.duration}ms\n`;
        if (run.branch) prompt += `Branch: ${run.branch}\n`;
        if (run.commit) prompt += `Commit: ${run.commit}\n`;
        prompt += 'Results:\n';
        run.results.forEach(result => {
          prompt += `  - ${result.testId}: ${result.status} (${result.duration}ms)`;
          if (result.error) prompt += ` - Error: ${result.error}`;
          prompt += '\n';
        });
      });
    } else {
      prompt += '\nNo execution runs available.\n';
    }

    return prompt;
  }

  private buildCoverageEvolutionPrompt(
    coverageData: CoverageData,
    options?: CoverageEvolutionOptions
  ): string {
    let prompt = 'Analyze coverage evolution for the following data:\n\n';

    // Add options context
    if (options?.targetCoverage) {
      prompt += `TARGET COVERAGE: ${options.targetCoverage}%\n`;
    }
    if (options?.regressionThreshold) {
      prompt += `REGRESSION THRESHOLD: ${options.regressionThreshold}%\n`;
    }
    if (options?.gapThreshold) {
      prompt += `GAP THRESHOLD: ${options.gapThreshold}%\n`;
    }
    if (options?.includePatterns?.length) {
      prompt += `INCLUDE PATTERNS: ${options.includePatterns.join(', ')}\n`;
    }
    if (options?.excludePatterns?.length) {
      prompt += `EXCLUDE PATTERNS: ${options.excludePatterns.join(', ')}\n`;
    }
    prompt += '\n';

    // Add current coverage
    prompt += 'CURRENT COVERAGE:\n';
    prompt += `Timestamp: ${coverageData.current.timestamp}\n`;
    prompt += `Overall: ${coverageData.current.overall}%\n`;
    if (coverageData.current.lines !== undefined) prompt += `Lines: ${coverageData.current.lines}%\n`;
    if (coverageData.current.branches !== undefined) prompt += `Branches: ${coverageData.current.branches}%\n`;
    if (coverageData.current.functions !== undefined) prompt += `Functions: ${coverageData.current.functions}%\n`;
    if (coverageData.current.statements !== undefined) prompt += `Statements: ${coverageData.current.statements}%\n`;

    // Add file coverage details
    if (coverageData.current.files?.length) {
      prompt += '\nFile Coverage:\n';
      coverageData.current.files.forEach(file => {
        prompt += `  ${file.path}:\n`;
        prompt += `    Lines: ${file.lines}%, Branches: ${file.branches}%, Functions: ${file.functions}%, Statements: ${file.statements}%\n`;
        if (file.uncoveredLines?.length) {
          prompt += `    Uncovered Lines: ${file.uncoveredLines.join(', ')}\n`;
        }
      });
    }

    // Add historical coverage
    if (coverageData.history.length > 0) {
      prompt += '\nCOVERAGE HISTORY:\n';
      coverageData.history.forEach(snapshot => {
        prompt += `  ${snapshot.timestamp}: ${snapshot.overall}%\n`;
      });
    } else {
      prompt += '\nNo historical coverage data available.\n';
    }

    return prompt;
  }

  private buildStaleTestsPrompt(
    input: TestSuiteInput,
    codeChanges: CodeChange[],
    options?: StaleTestsOptions
  ): string {
    let prompt = `Detect stale tests in the following test suite with ${input.tests.length} tests:\n\n`;

    // Add options context
    if (options?.stalenessDays) {
      prompt += `STALENESS THRESHOLD: ${options.stalenessDays} days\n`;
    }
    if (options?.includeDeadCodeAnalysis) {
      prompt += `INCLUDE DEAD CODE ANALYSIS: yes\n`;
    }
    if (options?.includeApiContractAnalysis) {
      prompt += `INCLUDE API CONTRACT ANALYSIS: yes\n`;
    }

    if (input.projectRoot) {
      prompt += `PROJECT ROOT: ${input.projectRoot}\n`;
    }
    prompt += '\n';

    // Add test definitions
    prompt += 'TESTS:\n';
    input.tests.forEach((test, index) => {
      prompt += `\n--- Test ${index + 1} ---\n`;
      prompt += `ID: ${test.id}\n`;
      prompt += `Name: ${test.name}\n`;
      prompt += `File: ${test.file}\n`;
      if (test.line) prompt += `Line: ${test.line}\n`;
      if (test.suite) prompt += `Suite: ${test.suite}\n`;
      if (test.tags?.length) prompt += `Tags: ${test.tags.join(', ')}\n`;
      if (test.lastModified) prompt += `Last Modified: ${test.lastModified}\n`;
      if (test.createdAt) prompt += `Created: ${test.createdAt}\n`;
    });

    // Add code changes
    if (codeChanges.length > 0) {
      prompt += '\nCODE CHANGES:\n';
      codeChanges.forEach(change => {
        prompt += `  ${change.file}:\n`;
        prompt += `    Last Modified: ${change.lastModified}\n`;
        prompt += `    Change Count: ${change.changeCount}\n`;
        if (change.changedFunctions?.length) {
          prompt += `    Changed Functions: ${change.changedFunctions.join(', ')}\n`;
        }
      });
    } else {
      prompt += '\nNo code change data available.\n';
    }

    return prompt;
  }

  private buildTestRiskPrompt(
    input: TestSuiteInput,
    executionHistory: TestExecutionHistory,
    coverageData: CoverageData,
    options?: TestRiskOptions
  ): string {
    let prompt = `Score test risk for the following test suite with ${input.tests.length} tests:\n\n`;

    // Add options context
    if (options?.riskWeights) {
      prompt += 'RISK WEIGHTS:\n';
      if (options.riskWeights.flakiness !== undefined) {
        prompt += `  Flakiness: ${options.riskWeights.flakiness}%\n`;
      }
      if (options.riskWeights.staleness !== undefined) {
        prompt += `  Staleness: ${options.riskWeights.staleness}%\n`;
      }
      if (options.riskWeights.complexity !== undefined) {
        prompt += `  Complexity: ${options.riskWeights.complexity}%\n`;
      }
      if (options.riskWeights.dependencies !== undefined) {
        prompt += `  Dependencies: ${options.riskWeights.dependencies}%\n`;
      }
    }
    if (options?.criticalThreshold) {
      prompt += `CRITICAL THRESHOLD: ${options.criticalThreshold}\n`;
    }
    if (options?.highThreshold) {
      prompt += `HIGH THRESHOLD: ${options.highThreshold}\n`;
    }
    if (options?.mediumThreshold) {
      prompt += `MEDIUM THRESHOLD: ${options.mediumThreshold}\n`;
    }

    if (input.projectRoot) {
      prompt += `PROJECT ROOT: ${input.projectRoot}\n`;
    }
    prompt += '\n';

    // Add test definitions
    prompt += 'TESTS:\n';
    input.tests.forEach((test, index) => {
      prompt += `\n--- Test ${index + 1} ---\n`;
      prompt += `ID: ${test.id}\n`;
      prompt += `Name: ${test.name}\n`;
      prompt += `File: ${test.file}\n`;
      if (test.line) prompt += `Line: ${test.line}\n`;
      if (test.suite) prompt += `Suite: ${test.suite}\n`;
      if (test.tags?.length) prompt += `Tags: ${test.tags.join(', ')}\n`;
      if (test.lastModified) prompt += `Last Modified: ${test.lastModified}\n`;
      if (test.createdAt) prompt += `Created: ${test.createdAt}\n`;
    });

    // Add execution history summary
    prompt += '\nEXECUTION HISTORY:\n';
    prompt += `Total Runs: ${executionHistory.totalRuns}\n`;
    prompt += `Time Range: ${executionHistory.timeRange.from} to ${executionHistory.timeRange.to}\n`;

    if (executionHistory.runs.length > 0) {
      prompt += '\nRecent Runs:\n';
      executionHistory.runs.slice(0, 5).forEach((run, index) => {
        prompt += `\n--- Run ${index + 1} ---\n`;
        prompt += `Timestamp: ${run.timestamp}\n`;
        prompt += `Duration: ${run.duration}ms\n`;
        prompt += 'Results:\n';
        run.results.forEach(result => {
          prompt += `  - ${result.testId}: ${result.status} (${result.duration}ms)`;
          if (result.error) prompt += ` - Error: ${result.error}`;
          prompt += '\n';
        });
      });
    }

    // Add coverage summary
    prompt += '\nCOVERAGE DATA:\n';
    prompt += `Overall Coverage: ${coverageData.current.overall}%\n`;
    if (coverageData.current.files?.length) {
      prompt += 'File Coverage:\n';
      coverageData.current.files.forEach(file => {
        prompt += `  ${file.path}: ${file.lines}% lines, ${file.branches}% branches\n`;
      });
    }

    return prompt;
  }
}

// Export singleton instance
export const testEvolutionAgent = new TestEvolutionAgent();

/**
 * Bug Pattern Agent
 * Analyzes patterns in bugs and test failures for QA insights
 */

import { BaseAgent, AgentResponse, AgentConfig } from './base.agent.js';

// ============================================================================
// Input Types
// ============================================================================

export interface BugData {
  id: string;
  title: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed' | 'wontfix';
  severity: 'critical' | 'high' | 'medium' | 'low';
  component: string;
  stackTrace?: string | undefined;
  steps?: string[] | undefined;
  environment?: {
    os?: string | undefined;
    browser?: string | undefined;
    version?: string | undefined;
    device?: string | undefined;
  } | undefined;
  createdAt: string; // ISO date string
  labels?: string[] | undefined;
  assignee?: string | undefined;
  reporter?: string | undefined;
}

export interface TestFailure {
  testId: string;
  name: string;
  error: string;
  stackTrace?: string | undefined;
  duration: number; // ms
  retries: number;
  screenshot?: string | undefined; // Base64 encoded
  file?: string | undefined;
  line?: number | undefined;
}

export interface CodeChange {
  file: string;
  additions: number;
  deletions: number;
  author: string;
  date: string; // ISO date string
  commitMessage: string;
  commitHash?: string | undefined;
  filesChanged?: string[] | undefined;
}

// ============================================================================
// Output Types
// ============================================================================

export interface PatternAnalysisOutput {
  patterns: Array<{
    id: string;
    name: string;
    description: string;
    frequency: number; // Number of occurrences
    affectedComponents: string[];
    examples: string[]; // Bug IDs
    severity: 'critical' | 'high' | 'medium' | 'low';
    trend: 'increasing' | 'stable' | 'decreasing';
  }>;
  categories: Array<{
    name: string;
    count: number;
    percentage: number;
    bugs: string[]; // Bug IDs
  }>;
  correlations: Array<{
    factor1: string;
    factor2: string;
    strength: number; // 0-100
    explanation: string;
  }>;
  severityDistribution: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  trends: {
    totalBugs: number;
    openBugs: number;
    avgResolutionTime: string; // Duration string
    hotspotComponents: string[];
    recentSpike: boolean;
    spikeReason?: string | undefined;
  };
  insights: string[];
  recommendations: string[];
}

export interface RootCauseOutput {
  rootCause: {
    type: 'code_defect' | 'configuration' | 'environment' | 'data' | 'integration' | 'timing' | 'resource' | 'unknown';
    description: string;
    confidence: number; // 0-100
    evidence: string[];
  };
  contributing_factors: Array<{
    factor: string;
    impact: 'high' | 'medium' | 'low';
    explanation: string;
  }>;
  suggestedFix: {
    description: string;
    steps: string[];
    complexity: 'trivial' | 'simple' | 'moderate' | 'complex';
    estimatedEffort: string;
  };
  relatedBugs: string[]; // Bug IDs with similar root causes
  preventionStrategies: string[];
}

export interface BugPredictionOutput {
  predictions: Array<{
    file: string;
    riskScore: number; // 0-100
    riskLevel: 'critical' | 'high' | 'medium' | 'low';
    reasons: string[];
    historicalBugCount: number;
    recentChangeVelocity: number;
    recommendations: string[];
  }>;
  overallRisk: {
    score: number;
    level: 'critical' | 'high' | 'medium' | 'low';
    summary: string;
  };
  hotspots: Array<{
    area: string;
    risk: number;
    topContributors: string[]; // Files or components
  }>;
  suggestedTestFocus: string[];
  mitigationStrategies: string[];
}

export interface BugReportOutput {
  executiveSummary: {
    totalBugs: number;
    openBugs: number;
    criticalBugs: number;
    avgAge: string;
    healthScore: number; // 0-100
    healthStatus: 'healthy' | 'warning' | 'critical';
    keyFindings: string[];
  };
  charts: {
    severityBreakdown: Array<{ label: string; value: number }>;
    statusBreakdown: Array<{ label: string; value: number }>;
    componentBreakdown: Array<{ label: string; value: number }>;
    trendOverTime: Array<{ date: string; opened: number; closed: number }>;
    topAuthors: Array<{ author: string; bugs: number }>;
  };
  topIssues: Array<{
    id: string;
    title: string;
    severity: string;
    age: string;
    impact: string;
  }>;
  recommendations: Array<{
    priority: 'high' | 'medium' | 'low';
    action: string;
    expectedImpact: string;
    effort: string;
  }>;
  reportDate: string;
}

export interface BugClusterOutput {
  clusters: Array<{
    id: string;
    name: string;
    theme: string;
    bugs: string[]; // Bug IDs
    size: number;
    avgSeverity: number;
    commonCharacteristics: string[];
    suggestedPriority: 'critical' | 'high' | 'medium' | 'low';
    triageRecommendation: string;
  }>;
  similarityMatrix: Array<{
    bug1: string;
    bug2: string;
    similarity: number; // 0-100
    sharedAttributes: string[];
  }>;
  outliers: Array<{
    bugId: string;
    reason: string;
    specialAttention: boolean;
  }>;
  triageOrder: string[]; // Bug IDs in recommended order
  insights: string[];
}

// ============================================================================
// Input Options
// ============================================================================

export interface PatternAnalysisOptions {
  timeRange?: {
    from: string;
    to: string;
  } | undefined;
  components?: string[] | undefined;
  severities?: Array<'critical' | 'high' | 'medium' | 'low'> | undefined;
  minPatternFrequency?: number | undefined;
}

export interface ReportOptions {
  format?: 'detailed' | 'summary' | 'executive' | undefined;
  includeCharts?: boolean | undefined;
  timeRange?: {
    from: string;
    to: string;
  } | undefined;
  focusAreas?: string[] | undefined;
}

export interface ClusterOptions {
  minClusterSize?: number | undefined;
  maxClusters?: number | undefined;
  similarityThreshold?: number | undefined;
}

// ============================================================================
// System Prompts
// ============================================================================

const PATTERN_ANALYSIS_SYSTEM_PROMPT = `You are Bug Pattern Analyzer, an expert at identifying recurring patterns in software bugs.

Analyze the provided bugs and identify:
1. Recurring patterns and their frequency
2. Bug categories and distribution
3. Correlations between different factors
4. Severity distribution and trends
5. Actionable insights and recommendations

Output JSON:
{
  "patterns": [
    {
      "id": "PAT-001",
      "name": "Null Reference Pattern",
      "description": "Null pointer exceptions in data processing",
      "frequency": 12,
      "affectedComponents": ["DataService", "UserModule"],
      "examples": ["BUG-101", "BUG-105"],
      "severity": "high",
      "trend": "increasing"
    }
  ],
  "categories": [
    {"name": "UI/UX", "count": 15, "percentage": 30, "bugs": ["BUG-101"]}
  ],
  "correlations": [
    {"factor1": "component:auth", "factor2": "severity:critical", "strength": 75, "explanation": "Auth bugs tend to be critical"}
  ],
  "severityDistribution": {"critical": 5, "high": 10, "medium": 20, "low": 15},
  "trends": {
    "totalBugs": 50,
    "openBugs": 20,
    "avgResolutionTime": "3.5 days",
    "hotspotComponents": ["AuthService", "PaymentModule"],
    "recentSpike": true,
    "spikeReason": "Recent deployment introduced regressions"
  },
  "insights": ["70% of critical bugs are in auth module"],
  "recommendations": ["Increase test coverage for AuthService"]
}`;

const ROOT_CAUSE_SYSTEM_PROMPT = `You are Root Cause Analyzer, an expert at determining the underlying causes of test failures.

Analyze the failure and determine:
1. The root cause type and description
2. Contributing factors and their impact
3. Suggested fix with steps
4. Prevention strategies

Output JSON:
{
  "rootCause": {
    "type": "code_defect|configuration|environment|data|integration|timing|resource|unknown",
    "description": "Detailed description of the root cause",
    "confidence": 85,
    "evidence": ["Stack trace shows null pointer", "Recent code change modified validation"]
  },
  "contributing_factors": [
    {"factor": "Missing input validation", "impact": "high", "explanation": "No null check before processing"}
  ],
  "suggestedFix": {
    "description": "Add null validation before data processing",
    "steps": ["Add null check in processData()", "Add unit test for null input"],
    "complexity": "simple",
    "estimatedEffort": "2 hours"
  },
  "relatedBugs": ["BUG-045", "BUG-067"],
  "preventionStrategies": ["Add input validation layer", "Implement defensive coding practices"]
}`;

const PREDICTION_SYSTEM_PROMPT = `You are Bug Prediction Analyst, predicting bug-prone areas in codebases.

Analyze code changes and historical bugs to:
1. Identify high-risk files and areas
2. Calculate risk scores based on change velocity and history
3. Provide recommendations for testing focus
4. Suggest mitigation strategies

Output JSON:
{
  "predictions": [
    {
      "file": "src/services/auth.service.ts",
      "riskScore": 85,
      "riskLevel": "high",
      "reasons": ["High churn rate", "Previous critical bugs", "Complex logic"],
      "historicalBugCount": 12,
      "recentChangeVelocity": 15,
      "recommendations": ["Add integration tests", "Code review required"]
    }
  ],
  "overallRisk": {
    "score": 65,
    "level": "medium",
    "summary": "Moderate risk due to recent changes in core modules"
  },
  "hotspots": [
    {"area": "Authentication", "risk": 80, "topContributors": ["auth.service.ts", "jwt.util.ts"]}
  ],
  "suggestedTestFocus": ["Auth flows", "Payment processing", "Data validation"],
  "mitigationStrategies": ["Increase test coverage", "Add code review gates", "Implement feature flags"]
}`;

const REPORT_SYSTEM_PROMPT = `You are Bug Report Generator, creating comprehensive bug analysis reports.

Generate a detailed report including:
1. Executive summary with health score
2. Chart data for visualization
3. Top issues requiring attention
4. Prioritized recommendations

Output JSON:
{
  "executiveSummary": {
    "totalBugs": 150,
    "openBugs": 45,
    "criticalBugs": 5,
    "avgAge": "4.2 days",
    "healthScore": 72,
    "healthStatus": "warning",
    "keyFindings": ["5 critical bugs open", "Auth module needs attention"]
  },
  "charts": {
    "severityBreakdown": [{"label": "Critical", "value": 5}],
    "statusBreakdown": [{"label": "Open", "value": 45}],
    "componentBreakdown": [{"label": "Auth", "value": 30}],
    "trendOverTime": [{"date": "2024-01-15", "opened": 10, "closed": 8}],
    "topAuthors": [{"author": "john@example.com", "bugs": 15}]
  },
  "topIssues": [
    {"id": "BUG-001", "title": "Login fails intermittently", "severity": "critical", "age": "5 days", "impact": "Affects 30% of users"}
  ],
  "recommendations": [
    {"priority": "high", "action": "Fix critical auth bugs", "expectedImpact": "Resolve 30% user complaints", "effort": "2 days"}
  ],
  "reportDate": "2024-01-20T10:30:00Z"
}`;

const CLUSTER_SYSTEM_PROMPT = `You are Bug Clustering Expert, grouping similar bugs for efficient triage.

Cluster bugs based on:
1. Similarity in description, component, and symptoms
2. Common root causes
3. Shared characteristics
4. Create similarity scores between bugs

Output JSON:
{
  "clusters": [
    {
      "id": "CLUSTER-001",
      "name": "Authentication Failures",
      "theme": "Login and session management issues",
      "bugs": ["BUG-001", "BUG-005", "BUG-012"],
      "size": 3,
      "avgSeverity": 2.5,
      "commonCharacteristics": ["Involves JWT", "Occurs after timeout"],
      "suggestedPriority": "high",
      "triageRecommendation": "Assign to auth team for batch fix"
    }
  ],
  "similarityMatrix": [
    {"bug1": "BUG-001", "bug2": "BUG-005", "similarity": 85, "sharedAttributes": ["component", "error type"]}
  ],
  "outliers": [
    {"bugId": "BUG-099", "reason": "Unique infrastructure issue", "specialAttention": true}
  ],
  "triageOrder": ["BUG-001", "BUG-005", "BUG-012", "BUG-099"],
  "insights": ["3 clusters account for 80% of bugs", "Auth cluster is most urgent"]
}`;

// ============================================================================
// Bug Pattern Agent Class
// ============================================================================

export class BugPatternAgent extends BaseAgent {
  constructor(config?: AgentConfig) {
    super('BugPatternAgent', config);
  }

  /**
   * Analyze patterns in a collection of bugs
   */
  async analyzePatterns(
    bugs: BugData[],
    options?: PatternAnalysisOptions
  ): Promise<AgentResponse<PatternAnalysisOutput>> {
    const userPrompt = this.buildPatternAnalysisPrompt(bugs, options);
    return this.call<PatternAnalysisOutput>(
      PATTERN_ANALYSIS_SYSTEM_PROMPT,
      userPrompt,
      (text) => this.parseJSON<PatternAnalysisOutput>(text)
    );
  }

  /**
   * Find the root cause of a test failure
   */
  async findRootCause(
    failure: TestFailure,
    context?: CodeChange[]
  ): Promise<AgentResponse<RootCauseOutput>> {
    const userPrompt = this.buildRootCausePrompt(failure, context);
    return this.call<RootCauseOutput>(
      ROOT_CAUSE_SYSTEM_PROMPT,
      userPrompt,
      (text) => this.parseJSON<RootCauseOutput>(text)
    );
  }

  /**
   * Predict bug-prone areas based on code changes and history
   */
  async predictBugProne(
    codeChanges: CodeChange[],
    historicalBugs?: BugData[]
  ): Promise<AgentResponse<BugPredictionOutput>> {
    const userPrompt = this.buildPredictionPrompt(codeChanges, historicalBugs);
    return this.call<BugPredictionOutput>(
      PREDICTION_SYSTEM_PROMPT,
      userPrompt,
      (text) => this.parseJSON<BugPredictionOutput>(text)
    );
  }

  /**
   * Generate a comprehensive bug analysis report
   */
  async generateReport(
    bugs: BugData[],
    options?: ReportOptions
  ): Promise<AgentResponse<BugReportOutput>> {
    const userPrompt = this.buildReportPrompt(bugs, options);
    return this.call<BugReportOutput>(
      REPORT_SYSTEM_PROMPT,
      userPrompt,
      (text) => this.parseJSON<BugReportOutput>(text)
    );
  }

  /**
   * Cluster similar bugs for efficient triage
   */
  async clusterBugs(
    bugs: BugData[],
    options?: ClusterOptions
  ): Promise<AgentResponse<BugClusterOutput>> {
    const userPrompt = this.buildClusterPrompt(bugs, options);
    return this.call<BugClusterOutput>(
      CLUSTER_SYSTEM_PROMPT,
      userPrompt,
      (text) => this.parseJSON<BugClusterOutput>(text)
    );
  }

  // ============================================================================
  // Private Prompt Builders
  // ============================================================================

  private buildPatternAnalysisPrompt(bugs: BugData[], options?: PatternAnalysisOptions): string {
    let prompt = `Analyze the following ${bugs.length} bugs for patterns:\n\n`;

    // Add options context
    if (options?.timeRange) {
      prompt += `TIME RANGE: ${options.timeRange.from} to ${options.timeRange.to}\n`;
    }
    if (options?.components?.length) {
      prompt += `FOCUS COMPONENTS: ${options.components.join(', ')}\n`;
    }
    if (options?.severities?.length) {
      prompt += `SEVERITY FILTER: ${options.severities.join(', ')}\n`;
    }
    if (options?.minPatternFrequency) {
      prompt += `MIN PATTERN FREQUENCY: ${options.minPatternFrequency}\n`;
    }
    prompt += '\n';

    // Add bug data
    prompt += 'BUGS:\n';
    bugs.forEach((bug, index) => {
      prompt += `\n--- Bug ${index + 1} ---\n`;
      prompt += `ID: ${bug.id}\n`;
      prompt += `Title: ${bug.title}\n`;
      prompt += `Description: ${bug.description}\n`;
      prompt += `Status: ${bug.status}\n`;
      prompt += `Severity: ${bug.severity}\n`;
      prompt += `Component: ${bug.component}\n`;
      prompt += `Created: ${bug.createdAt}\n`;
      if (bug.labels?.length) prompt += `Labels: ${bug.labels.join(', ')}\n`;
      if (bug.stackTrace) prompt += `Stack Trace:\n${bug.stackTrace.substring(0, 500)}\n`;
      if (bug.steps?.length) prompt += `Steps: ${bug.steps.join(' -> ')}\n`;
      if (bug.environment) {
        prompt += `Environment: ${JSON.stringify(bug.environment)}\n`;
      }
    });

    return prompt;
  }

  private buildRootCausePrompt(failure: TestFailure, context?: CodeChange[]): string {
    let prompt = `Analyze this test failure to find the root cause:\n\n`;

    prompt += `TEST: ${failure.name}\n`;
    prompt += `TEST ID: ${failure.testId}\n`;
    prompt += `ERROR: ${failure.error}\n`;
    prompt += `DURATION: ${failure.duration}ms\n`;
    prompt += `RETRIES: ${failure.retries}\n`;

    if (failure.file) prompt += `FILE: ${failure.file}\n`;
    if (failure.line) prompt += `LINE: ${failure.line}\n`;

    if (failure.stackTrace) {
      prompt += `\nSTACK TRACE:\n${failure.stackTrace}\n`;
    }

    if (context?.length) {
      prompt += `\nRECENT CODE CHANGES (${context.length}):\n`;
      context.forEach((change, index) => {
        prompt += `\n--- Change ${index + 1} ---\n`;
        prompt += `File: ${change.file}\n`;
        prompt += `Author: ${change.author}\n`;
        prompt += `Date: ${change.date}\n`;
        prompt += `Message: ${change.commitMessage}\n`;
        prompt += `Changes: +${change.additions} -${change.deletions}\n`;
        if (change.filesChanged?.length) {
          prompt += `Files Changed: ${change.filesChanged.join(', ')}\n`;
        }
      });
    }

    return prompt;
  }

  private buildPredictionPrompt(codeChanges: CodeChange[], historicalBugs?: BugData[]): string {
    let prompt = `Predict bug-prone areas based on the following data:\n\n`;

    prompt += `CODE CHANGES (${codeChanges.length}):\n`;
    codeChanges.forEach((change, index) => {
      prompt += `\n--- Change ${index + 1} ---\n`;
      prompt += `File: ${change.file}\n`;
      prompt += `Author: ${change.author}\n`;
      prompt += `Date: ${change.date}\n`;
      prompt += `Message: ${change.commitMessage}\n`;
      prompt += `Additions: ${change.additions}\n`;
      prompt += `Deletions: ${change.deletions}\n`;
      if (change.commitHash) prompt += `Commit: ${change.commitHash}\n`;
    });

    if (historicalBugs?.length) {
      prompt += `\nHISTORICAL BUGS (${historicalBugs.length}):\n`;
      historicalBugs.forEach((bug, index) => {
        prompt += `\n--- Historical Bug ${index + 1} ---\n`;
        prompt += `ID: ${bug.id}\n`;
        prompt += `Title: ${bug.title}\n`;
        prompt += `Severity: ${bug.severity}\n`;
        prompt += `Component: ${bug.component}\n`;
        prompt += `Status: ${bug.status}\n`;
        prompt += `Created: ${bug.createdAt}\n`;
      });
    }

    return prompt;
  }

  private buildReportPrompt(bugs: BugData[], options?: ReportOptions): string {
    let prompt = `Generate a bug analysis report for the following ${bugs.length} bugs:\n\n`;

    // Add options
    if (options?.format) {
      prompt += `REPORT FORMAT: ${options.format}\n`;
    }
    if (options?.includeCharts !== undefined) {
      prompt += `INCLUDE CHARTS: ${options.includeCharts}\n`;
    }
    if (options?.timeRange) {
      prompt += `TIME RANGE: ${options.timeRange.from} to ${options.timeRange.to}\n`;
    }
    if (options?.focusAreas?.length) {
      prompt += `FOCUS AREAS: ${options.focusAreas.join(', ')}\n`;
    }
    prompt += '\n';

    // Add bug summaries
    prompt += 'BUGS:\n';
    bugs.forEach((bug, index) => {
      prompt += `\n--- Bug ${index + 1} ---\n`;
      prompt += `ID: ${bug.id}\n`;
      prompt += `Title: ${bug.title}\n`;
      prompt += `Description: ${bug.description.substring(0, 200)}${bug.description.length > 200 ? '...' : ''}\n`;
      prompt += `Status: ${bug.status}\n`;
      prompt += `Severity: ${bug.severity}\n`;
      prompt += `Component: ${bug.component}\n`;
      prompt += `Created: ${bug.createdAt}\n`;
      if (bug.assignee) prompt += `Assignee: ${bug.assignee}\n`;
      if (bug.reporter) prompt += `Reporter: ${bug.reporter}\n`;
    });

    return prompt;
  }

  private buildClusterPrompt(bugs: BugData[], options?: ClusterOptions): string {
    let prompt = `Cluster the following ${bugs.length} bugs for efficient triage:\n\n`;

    // Add options
    if (options?.minClusterSize) {
      prompt += `MIN CLUSTER SIZE: ${options.minClusterSize}\n`;
    }
    if (options?.maxClusters) {
      prompt += `MAX CLUSTERS: ${options.maxClusters}\n`;
    }
    if (options?.similarityThreshold) {
      prompt += `SIMILARITY THRESHOLD: ${options.similarityThreshold}%\n`;
    }
    prompt += '\n';

    // Add bug data for clustering
    prompt += 'BUGS:\n';
    bugs.forEach((bug, index) => {
      prompt += `\n--- Bug ${index + 1} ---\n`;
      prompt += `ID: ${bug.id}\n`;
      prompt += `Title: ${bug.title}\n`;
      prompt += `Description: ${bug.description}\n`;
      prompt += `Severity: ${bug.severity}\n`;
      prompt += `Component: ${bug.component}\n`;
      prompt += `Status: ${bug.status}\n`;
      if (bug.labels?.length) prompt += `Labels: ${bug.labels.join(', ')}\n`;
      if (bug.stackTrace) {
        // Include truncated stack trace for similarity matching
        prompt += `Stack Trace (excerpt): ${bug.stackTrace.substring(0, 300)}\n`;
      }
      if (bug.steps?.length) {
        prompt += `Repro Steps: ${bug.steps.slice(0, 3).join(' -> ')}\n`;
      }
    });

    return prompt;
  }
}

// Export singleton instance
export const bugPatternAgent = new BugPatternAgent();

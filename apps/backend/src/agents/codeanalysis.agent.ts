/**
 * Code Analysis Agent
 * Analyzes code complexity, architecture, best practices, and technical debt
 */

import { BaseAgent, AgentResponse, AgentConfig } from './base.agent.js';

// ============================================================================
// Input Types
// ============================================================================

export interface FileInput {
  path: string;
  content: string;
  language?: string | undefined;
}

export interface CodeInput {
  files: FileInput[];
  projectRoot?: string | undefined;
}

// ============================================================================
// Complexity Analysis Types
// ============================================================================

export interface ComplexityOptions {
  cyclomaticThreshold?: number | undefined;
  cognitiveThreshold?: number | undefined;
  maintainabilityThreshold?: number | undefined;
  includePatterns?: string[] | undefined;
  excludePatterns?: string[] | undefined;
}

export interface FunctionComplexity {
  name: string;
  cyclomaticComplexity: number;
  cognitiveComplexity: number;
  lineStart: number;
  lineEnd: number;
  issues: string[];
}

export interface FileComplexity {
  path: string;
  cyclomaticComplexity: number;
  cognitiveComplexity: number;
  maintainabilityIndex: number;
  linesOfCode: number;
  functions: FunctionComplexity[];
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
}

export interface Hotspot {
  file: string;
  function: string;
  metric: string;
  value: number;
  threshold: number;
  recommendation: string;
}

export interface ComplexityAnalysisOutput {
  summary: {
    averageCyclomaticComplexity: number;
    averageCognitiveComplexity: number;
    averageMaintainabilityIndex: number;
    totalFiles: number;
    totalFunctions: number;
    complexFunctions: number;
  };
  files: FileComplexity[];
  hotspots: Hotspot[];
  trends: {
    improving: string[];
    degrading: string[];
    stable: string[];
  };
  recommendations: string[];
}

// ============================================================================
// Architecture Analysis Types
// ============================================================================

export interface ArchitectureOptions {
  layers?: Array<{
    name: string;
    patterns: string[];
  }> | undefined;
  allowedDependencies?: Record<string, string[]> | undefined;
}

export interface ModuleInfo {
  name: string;
  path: string;
  dependencies: string[];
  dependents: string[];
  coupling: number;
  cohesion: 'low' | 'medium' | 'high';
  layer: string;
}

export interface CircularDependency {
  cycle: string[];
  severity: 'low' | 'medium' | 'high';
  recommendation: string;
}

export interface LayerViolation {
  source: string;
  target: string;
  sourceLayer: string;
  targetLayer: string;
  violation: string;
  recommendation: string;
}

export interface DependencyGraph {
  nodes: string[];
  edges: Array<{
    from: string;
    to: string;
    type: string;
  }>;
}

export interface ArchitectureAnalysisOutput {
  summary: {
    totalModules: number;
    totalDependencies: number;
    avgCoupling: number;
    circularDependencies: number;
    layerViolations: number;
    architectureScore: number;
  };
  modules: ModuleInfo[];
  circularDependencies: CircularDependency[];
  layerViolations: LayerViolation[];
  dependencyGraph: DependencyGraph;
  recommendations: string[];
}

// ============================================================================
// Best Practices Types
// ============================================================================

export interface BestPracticesOptions {
  enabledRules?: string[] | undefined;
  disabledRules?: string[] | undefined;
  customRules?: Array<{
    id: string;
    name: string;
    pattern: string;
    message: string;
    severity: 'critical' | 'warning' | 'info';
  }> | undefined;
}

export interface Violation {
  id: string;
  rule: string;
  severity: 'critical' | 'warning' | 'info';
  file: string;
  line: number;
  message: string;
  suggestion: string;
  category: 'SOLID' | 'DRY' | 'codeSmells' | 'naming' | 'security';
}

export interface FileScore {
  path: string;
  score: number;
  violations: number;
  topIssue: string | null;
}

export interface BestPracticesOutput {
  summary: {
    totalViolations: number;
    criticalViolations: number;
    warningViolations: number;
    infoViolations: number;
    overallScore: number;
    categories: {
      SOLID: number;
      DRY: number;
      codeSmells: number;
      naming: number;
      security: number;
    };
  };
  violations: Violation[];
  fileScores: FileScore[];
  recommendations: string[];
  patterns: {
    detected: string[];
    suggested: string[];
  };
}

// ============================================================================
// Technical Debt Types
// ============================================================================

export interface TechnicalDebtOptions {
  hourlyRate?: number | undefined;
  currency?: string | undefined;
  includeSeverities?: Array<'critical' | 'high' | 'medium' | 'low'> | undefined;
  historicalData?: Array<{
    date: string;
    totalHours: number;
  }> | undefined;
}

export interface DebtItem {
  id: string;
  type: 'architecture' | 'code_quality' | 'security' | 'testing' | 'documentation';
  title: string;
  description: string;
  file: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  effort: {
    hours: number;
    complexity: 'trivial' | 'low' | 'medium' | 'high';
    risk: 'none' | 'low' | 'medium' | 'high';
  };
  impact: {
    maintainability: 'none' | 'low' | 'medium' | 'high';
    testability: 'none' | 'low' | 'medium' | 'high';
    performance: 'none' | 'low' | 'medium' | 'high';
  };
  recommendation: string;
  priority: number;
}

export interface DebtCategory {
  count: number;
  hours: number;
  percentage: number;
}

export interface TechnicalDebtOutput {
  summary: {
    totalDebtHours: number;
    totalDebtCost: number;
    debtRatio: number;
    debtGrade: 'A' | 'B' | 'C' | 'D' | 'F';
    debtTrend: 'decreasing' | 'stable' | 'increasing';
    prioritizedItems: number;
  };
  items: DebtItem[];
  categories: {
    architecture: DebtCategory;
    code_quality: DebtCategory;
    security: DebtCategory;
    testing: DebtCategory;
    documentation: DebtCategory;
  };
  remediationPlan: {
    immediate: string[];
    shortTerm: string[];
    longTerm: string[];
    totalEffort: {
      immediate: number;
      shortTerm: number;
      longTerm: number;
    };
  };
  recommendations: string[];
  trends: {
    weekOverWeek: number;
    monthOverMonth: number;
    topGrowing: string[];
  };
}

// ============================================================================
// System Prompts
// ============================================================================

const COMPLEXITY_ANALYSIS_SYSTEM_PROMPT = `You are Code Complexity Analyzer, an expert at measuring and analyzing code complexity metrics.

Analyze the provided code and calculate:
1. Cyclomatic complexity per function and file
2. Cognitive complexity for readability assessment
3. Maintainability index (0-100, higher is better)
4. Identify complexity hotspots exceeding thresholds
5. Provide actionable recommendations

Output JSON:
{
  "summary": {
    "averageCyclomaticComplexity": 8.5,
    "averageCognitiveComplexity": 12.3,
    "averageMaintainabilityIndex": 65.2,
    "totalFiles": 5,
    "totalFunctions": 25,
    "complexFunctions": 3
  },
  "files": [
    {
      "path": "src/services/auth.ts",
      "cyclomaticComplexity": 12,
      "cognitiveComplexity": 18,
      "maintainabilityIndex": 55,
      "linesOfCode": 200,
      "functions": [
        {
          "name": "login",
          "cyclomaticComplexity": 8,
          "cognitiveComplexity": 12,
          "lineStart": 10,
          "lineEnd": 50,
          "issues": ["Nested conditionals", "Long method"]
        }
      ],
      "overallRisk": "high"
    }
  ],
  "hotspots": [
    {
      "file": "src/services/auth.ts",
      "function": "login",
      "metric": "cognitiveComplexity",
      "value": 12,
      "threshold": 10,
      "recommendation": "Extract conditionals into helper methods"
    }
  ],
  "trends": {
    "improving": ["file1.ts"],
    "degrading": ["file2.ts"],
    "stable": ["file3.ts"]
  },
  "recommendations": [
    "Refactor login method to reduce complexity",
    "Use early returns to flatten nesting"
  ]
}`;

const ARCHITECTURE_ANALYSIS_SYSTEM_PROMPT = `You are Architecture Analyzer, an expert at analyzing software architecture and dependencies.

Analyze the provided code structure and identify:
1. Module dependencies and coupling metrics
2. Circular dependencies between modules
3. Layer violations in the architecture
4. Cohesion analysis per module
5. Overall architecture health score

Output JSON:
{
  "summary": {
    "totalModules": 10,
    "totalDependencies": 25,
    "avgCoupling": 3.5,
    "circularDependencies": 2,
    "layerViolations": 3,
    "architectureScore": 75
  },
  "modules": [
    {
      "name": "AuthService",
      "path": "src/services/auth.ts",
      "dependencies": ["UserRepository", "JwtUtil"],
      "dependents": ["AuthController"],
      "coupling": 4,
      "cohesion": "high",
      "layer": "service"
    }
  ],
  "circularDependencies": [
    {
      "cycle": ["ServiceA", "ServiceB", "ServiceA"],
      "severity": "high",
      "recommendation": "Extract shared logic into common module"
    }
  ],
  "layerViolations": [
    {
      "source": "AuthController",
      "target": "UserRepository",
      "sourceLayer": "controller",
      "targetLayer": "repository",
      "violation": "Controller accessing repository directly",
      "recommendation": "Use service layer as intermediary"
    }
  ],
  "dependencyGraph": {
    "nodes": ["ModuleA", "ModuleB"],
    "edges": [{"from": "ModuleA", "to": "ModuleB", "type": "imports"}]
  },
  "recommendations": [
    "Break circular dependencies",
    "Add service layer between controllers and repositories"
  ]
}`;

const BEST_PRACTICES_SYSTEM_PROMPT = `You are Best Practices Analyzer, an expert at evaluating code against software engineering principles.

Analyze the code for:
1. SOLID principles violations
2. DRY (Don't Repeat Yourself) violations
3. Code smells (long methods, large classes, etc.)
4. Naming convention issues
5. Security concerns

Output JSON:
{
  "summary": {
    "totalViolations": 15,
    "criticalViolations": 3,
    "warningViolations": 8,
    "infoViolations": 4,
    "overallScore": 72,
    "categories": {
      "SOLID": 65,
      "DRY": 80,
      "codeSmells": 70,
      "naming": 85,
      "security": 60
    }
  },
  "violations": [
    {
      "id": "SRP-001",
      "rule": "Single Responsibility Principle",
      "severity": "critical",
      "file": "src/services/payment.ts",
      "line": 15,
      "message": "Class has too many responsibilities",
      "suggestion": "Extract payment validation into separate service",
      "category": "SOLID"
    }
  ],
  "fileScores": [
    {
      "path": "src/services/auth.ts",
      "score": 65,
      "violations": 3,
      "topIssue": "Hardcoded secret"
    }
  ],
  "recommendations": [
    "Address security issues first",
    "Refactor large methods"
  ],
  "patterns": {
    "detected": ["Service Pattern", "Repository Pattern"],
    "suggested": ["Dependency Injection", "Factory Pattern"]
  }
}`;

const TECHNICAL_DEBT_SYSTEM_PROMPT = `You are Technical Debt Analyzer, an expert at quantifying and prioritizing technical debt.

Analyze the code and quantify:
1. Technical debt items with effort estimates
2. Debt categorized by type (architecture, code quality, security, etc.)
3. Remediation plan with priorities
4. Debt trends over time

Output JSON:
{
  "summary": {
    "totalDebtHours": 45.5,
    "totalDebtCost": 4550,
    "debtRatio": 12.5,
    "debtGrade": "C",
    "debtTrend": "increasing",
    "prioritizedItems": 8
  },
  "items": [
    {
      "id": "DEBT-001",
      "type": "architecture",
      "title": "Circular dependency",
      "description": "AuthService and UserService have bidirectional dependencies",
      "file": "src/services/auth.ts",
      "severity": "high",
      "effort": {
        "hours": 8,
        "complexity": "medium",
        "risk": "low"
      },
      "impact": {
        "maintainability": "high",
        "testability": "high",
        "performance": "low"
      },
      "recommendation": "Extract shared logic",
      "priority": 1
    }
  ],
  "categories": {
    "architecture": {"count": 2, "hours": 16, "percentage": 35},
    "code_quality": {"count": 3, "hours": 12, "percentage": 26},
    "security": {"count": 1, "hours": 2, "percentage": 4},
    "testing": {"count": 2, "hours": 10, "percentage": 22},
    "documentation": {"count": 1, "hours": 6, "percentage": 13}
  },
  "remediationPlan": {
    "immediate": ["DEBT-003"],
    "shortTerm": ["DEBT-001", "DEBT-002"],
    "longTerm": ["DEBT-004"],
    "totalEffort": {
      "immediate": 2,
      "shortTerm": 20,
      "longTerm": 24
    }
  },
  "recommendations": [
    "Address security debt immediately",
    "Plan sprint for architecture improvements"
  ],
  "trends": {
    "weekOverWeek": 5.2,
    "monthOverMonth": 15.8,
    "topGrowing": ["code_quality", "testing"]
  }
}`;

// ============================================================================
// Code Analysis Agent Class
// ============================================================================

export class CodeAnalysisAgent extends BaseAgent {
  constructor(config?: AgentConfig) {
    super('CodeAnalysisAgent', config);
  }

  /**
   * Analyze code complexity metrics
   */
  async analyzeComplexity(
    input: CodeInput,
    options?: ComplexityOptions
  ): Promise<AgentResponse<ComplexityAnalysisOutput>> {
    const userPrompt = this.buildComplexityPrompt(input, options);
    return this.call<ComplexityAnalysisOutput>(
      COMPLEXITY_ANALYSIS_SYSTEM_PROMPT,
      userPrompt,
      (text) => this.parseJSON<ComplexityAnalysisOutput>(text)
    );
  }

  /**
   * Analyze architecture and dependencies
   */
  async analyzeArchitecture(
    input: CodeInput,
    options?: ArchitectureOptions
  ): Promise<AgentResponse<ArchitectureAnalysisOutput>> {
    const userPrompt = this.buildArchitecturePrompt(input, options);
    return this.call<ArchitectureAnalysisOutput>(
      ARCHITECTURE_ANALYSIS_SYSTEM_PROMPT,
      userPrompt,
      (text) => this.parseJSON<ArchitectureAnalysisOutput>(text)
    );
  }

  /**
   * Check code against best practices
   */
  async checkBestPractices(
    input: CodeInput,
    options?: BestPracticesOptions
  ): Promise<AgentResponse<BestPracticesOutput>> {
    const userPrompt = this.buildBestPracticesPrompt(input, options);
    return this.call<BestPracticesOutput>(
      BEST_PRACTICES_SYSTEM_PROMPT,
      userPrompt,
      (text) => this.parseJSON<BestPracticesOutput>(text)
    );
  }

  /**
   * Score and analyze technical debt
   */
  async scoreTechnicalDebt(
    input: CodeInput,
    options?: TechnicalDebtOptions
  ): Promise<AgentResponse<TechnicalDebtOutput>> {
    const userPrompt = this.buildTechnicalDebtPrompt(input, options);
    return this.call<TechnicalDebtOutput>(
      TECHNICAL_DEBT_SYSTEM_PROMPT,
      userPrompt,
      (text) => this.parseJSON<TechnicalDebtOutput>(text)
    );
  }

  // ============================================================================
  // Private Prompt Builders
  // ============================================================================

  private buildComplexityPrompt(input: CodeInput, options?: ComplexityOptions): string {
    let prompt = `Analyze the following ${input.files.length} file(s) for code complexity:\n\n`;

    // Add options context
    if (options?.cyclomaticThreshold || options?.cognitiveThreshold || options?.maintainabilityThreshold) {
      prompt += 'THRESHOLDS:\n';
      if (options.cyclomaticThreshold) {
        prompt += `- Cyclomatic Complexity: ${options.cyclomaticThreshold}\n`;
      }
      if (options.cognitiveThreshold) {
        prompt += `- Cognitive Complexity: ${options.cognitiveThreshold}\n`;
      }
      if (options.maintainabilityThreshold) {
        prompt += `- Maintainability Index: ${options.maintainabilityThreshold}\n`;
      }
      prompt += '\n';
    }

    if (options?.includePatterns?.length) {
      prompt += `INCLUDE PATTERNS: ${options.includePatterns.join(', ')}\n`;
    }
    if (options?.excludePatterns?.length) {
      prompt += `EXCLUDE PATTERNS: ${options.excludePatterns.join(', ')}\n`;
    }

    if (input.projectRoot) {
      prompt += `PROJECT ROOT: ${input.projectRoot}\n`;
    }
    prompt += '\n';

    // Add file contents
    prompt += 'FILES:\n';
    input.files.forEach((file, index) => {
      prompt += `\n--- File ${index + 1} ---\n`;
      prompt += `Path: ${file.path}\n`;
      if (file.language) prompt += `Language: ${file.language}\n`;
      prompt += `Content:\n${file.content}\n`;
    });

    return prompt;
  }

  private buildArchitecturePrompt(input: CodeInput, options?: ArchitectureOptions): string {
    let prompt = `Analyze the architecture of the following ${input.files.length} file(s):\n\n`;

    if (options?.layers?.length) {
      prompt += 'LAYER DEFINITIONS:\n';
      options.layers.forEach(layer => {
        prompt += `- ${layer.name}: ${layer.patterns.join(', ')}\n`;
      });
      prompt += '\n';
    }

    if (options?.allowedDependencies) {
      prompt += 'ALLOWED DEPENDENCIES:\n';
      Object.entries(options.allowedDependencies).forEach(([layer, deps]) => {
        prompt += `- ${layer} can depend on: ${deps.length > 0 ? deps.join(', ') : 'none'}\n`;
      });
      prompt += '\n';
    }

    if (input.projectRoot) {
      prompt += `PROJECT ROOT: ${input.projectRoot}\n`;
    }
    prompt += '\n';

    // Add file contents
    prompt += 'FILES:\n';
    input.files.forEach((file, index) => {
      prompt += `\n--- File ${index + 1} ---\n`;
      prompt += `Path: ${file.path}\n`;
      if (file.language) prompt += `Language: ${file.language}\n`;
      prompt += `Content:\n${file.content}\n`;
    });

    return prompt;
  }

  private buildBestPracticesPrompt(input: CodeInput, options?: BestPracticesOptions): string {
    let prompt = `Check the following ${input.files.length} file(s) against best practices:\n\n`;

    if (options?.enabledRules?.length) {
      prompt += `ENABLED RULES: ${options.enabledRules.join(', ')}\n`;
    }
    if (options?.disabledRules?.length) {
      prompt += `DISABLED RULES: ${options.disabledRules.join(', ')}\n`;
    }

    if (options?.customRules?.length) {
      prompt += 'CUSTOM RULES:\n';
      options.customRules.forEach(rule => {
        prompt += `- ${rule.id}: ${rule.name} (${rule.severity}) - Pattern: ${rule.pattern}\n`;
        prompt += `  Message: ${rule.message}\n`;
      });
      prompt += '\n';
    }

    if (input.projectRoot) {
      prompt += `PROJECT ROOT: ${input.projectRoot}\n`;
    }
    prompt += '\n';

    // Add file contents
    prompt += 'FILES:\n';
    input.files.forEach((file, index) => {
      prompt += `\n--- File ${index + 1} ---\n`;
      prompt += `Path: ${file.path}\n`;
      if (file.language) prompt += `Language: ${file.language}\n`;
      prompt += `Content:\n${file.content}\n`;
    });

    return prompt;
  }

  private buildTechnicalDebtPrompt(input: CodeInput, options?: TechnicalDebtOptions): string {
    let prompt = `Analyze technical debt in the following ${input.files.length} file(s):\n\n`;

    if (options?.hourlyRate) {
      prompt += `HOURLY RATE: ${options.hourlyRate}\n`;
    }
    if (options?.currency) {
      prompt += `CURRENCY: ${options.currency}\n`;
    }
    if (options?.includeSeverities?.length) {
      prompt += `INCLUDE SEVERITIES: ${options.includeSeverities.join(', ')}\n`;
    }

    if (options?.historicalData?.length) {
      prompt += 'HISTORICAL DATA:\n';
      options.historicalData.forEach(data => {
        prompt += `- ${data.date}: ${data.totalHours} hours\n`;
      });
      prompt += '\n';
    }

    if (input.projectRoot) {
      prompt += `PROJECT ROOT: ${input.projectRoot}\n`;
    }
    prompt += '\n';

    // Add file contents
    prompt += 'FILES:\n';
    input.files.forEach((file, index) => {
      prompt += `\n--- File ${index + 1} ---\n`;
      prompt += `Path: ${file.path}\n`;
      if (file.language) prompt += `Language: ${file.language}\n`;
      prompt += `Content:\n${file.content}\n`;
    });

    return prompt;
  }
}

// Export singleton instance
export const codeAnalysisAgent = new CodeAnalysisAgent();

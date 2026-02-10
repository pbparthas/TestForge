/**
 * TestPilot Workflow Definitions
 * Types, agent registry, predefined workflows, and cost constants.
 */

import { testWeaverAgent } from '../../agents/testweaver.agent.js';
import { scriptSmithAgent } from '../../agents/scriptsmith.agent.js';
import { codeGuardianAgent } from '../../agents/codeguardian.agent.js';
import { visualAnalysisAgent } from '../../agents/visualanalysis.agent.js';
import { bugPatternAgent } from '../../agents/bugpattern.agent.js';
import { flowPilotAgent } from '../../agents/flowpilot.agent.js';
import { codeAnalysisAgent } from '../../agents/codeanalysis.agent.js';
import { testEvolutionAgent } from '../../agents/testevolution.agent.js';

// ============================================================================
// Types
// ============================================================================

export type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export type StepType = 'agent' | 'condition' | 'parallel' | 'aggregate' | 'transform' | 'validate';

export type PredefinedWorkflow = 'full-test-suite' | 'visual-regression-flow' | 'api-test-flow' | 'code-quality-audit';

export interface WorkflowStep {
  id: string;
  type: StepType;
  agent?: string;
  operation?: string;
  input?: Record<string, unknown>;
  outputKey?: string;
  condition?: string;
  then?: WorkflowStep[];
  else?: WorkflowStep[];
  branches?: WorkflowStep[];
  sources?: string[];
  aggregateFunction?: 'merge' | 'concat' | 'sum';
  transform?: Record<string, string>;
  validation?: {
    rules: Array<{
      field: string;
      condition: string;
      message: string;
    }>;
  };
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description?: string;
  steps: WorkflowStep[];
}

export interface WorkflowExecutionOptions {
  timeout?: number;
  retryOnFailure?: boolean;
  maxRetries?: number;
}

export interface WorkflowExecutionResult {
  id: string;
  workflowId: string;
  status: ExecutionStatus;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  steps: Array<{
    id: string;
    status: ExecutionStatus;
    output?: unknown;
    error?: string;
  }>;
  startedAt: Date | null;
  completedAt: Date | null;
  error: string | null;
  totalCostUsd: number;
}

export interface WorkflowStatusResult {
  status: ExecutionStatus;
  steps: Array<{
    id: string;
    status: string;
    output?: unknown;
  }>;
  completedSteps: number;
  totalSteps: number;
  startedAt: Date | null;
  completedAt?: Date | null;
  elapsedMs: number;
}

export interface CostEstimate {
  estimatedCostUsd: number;
  estimatedTokens: number;
  breakdown: Array<{
    stepId: string;
    agent: string;
    estimatedCostUsd: number;
    estimatedTokens: number;
  }>;
}

export interface WorkflowListResult {
  predefined: Array<{
    id: string;
    name: string;
    description: string;
    agents: string[];
  }>;
  custom: Array<{
    id: string;
    name: string;
    description?: string;
  }>;
}

// ============================================================================
// Agent Registry
// ============================================================================

export interface AgentRegistry {
  [agent: string]: {
    instance: unknown;
    operations: string[];
  };
}

export const AGENT_REGISTRY: AgentRegistry = {
  TestWeaver: {
    instance: testWeaverAgent,
    operations: ['generate', 'evolve', 'batchGenerate'],
  },
  ScriptSmith: {
    instance: scriptSmithAgent,
    operations: ['generate', 'edit'],
  },
  CodeGuardian: {
    instance: codeGuardianAgent,
    operations: ['generate', 'analyze'],
  },
  VisualAnalysis: {
    instance: visualAnalysisAgent,
    operations: ['analyze'],
  },
  BugPattern: {
    instance: bugPatternAgent,
    operations: ['analyze', 'suggestFix'],
  },
  FlowPilot: {
    instance: flowPilotAgent,
    operations: ['generate', 'chain'],
  },
  CodeAnalysis: {
    instance: codeAnalysisAgent,
    operations: ['analyze'],
  },
  TestEvolution: {
    instance: testEvolutionAgent,
    operations: ['evolve', 'analyze'],
  },
};

// ============================================================================
// Predefined Workflows
// ============================================================================

export const PREDEFINED_WORKFLOWS: Record<PredefinedWorkflow, WorkflowDefinition> = {
  'full-test-suite': {
    id: 'full-test-suite',
    name: 'Full Test Suite Generation',
    description: 'Generate comprehensive test suite: TestWeaver → ScriptSmith → CodeGuardian',
    steps: [
      {
        id: 'step-1',
        type: 'agent',
        agent: 'TestWeaver',
        operation: 'generate',
        input: { specification: '${input.specification}', inputMethod: 'specification' },
        outputKey: 'testWeaver',
      },
      {
        id: 'step-2',
        type: 'agent',
        agent: 'ScriptSmith',
        operation: 'generate',
        input: {
          testCases: '${steps.step-1.output.testCases}',
          inputMethod: 'test_case',
        },
        outputKey: 'scriptSmith',
      },
      {
        id: 'step-3',
        type: 'agent',
        agent: 'CodeGuardian',
        operation: 'generate',
        input: {
          code: '${steps.step-2.output.code}',
          language: 'typescript',
        },
        outputKey: 'codeGuardian',
      },
    ],
  },
  'visual-regression-flow': {
    id: 'visual-regression-flow',
    name: 'Visual Regression Testing Flow',
    description: 'Visual analysis with conditional bug pattern detection',
    steps: [
      {
        id: 'step-1',
        type: 'agent',
        agent: 'VisualAnalysis',
        operation: 'analyze',
        input: {
          screenshot: '${input.screenshot}',
          baselineScreenshot: '${input.baselineScreenshot}',
        },
        outputKey: 'visualAnalysis',
      },
      {
        id: 'step-2',
        type: 'condition',
        condition: '${steps.step-1.output.hasVisualRegression}',
        then: [
          {
            id: 'step-2a',
            type: 'agent',
            agent: 'BugPattern',
            operation: 'analyze',
            input: {
              differences: '${steps.step-1.output}',
            },
            outputKey: 'bugPattern',
          },
        ],
        else: [],
      },
    ],
  },
  'api-test-flow': {
    id: 'api-test-flow',
    name: 'API Test Generation Flow',
    description: 'Generate API tests: FlowPilot → CodeGuardian',
    steps: [
      {
        id: 'step-1',
        type: 'agent',
        agent: 'FlowPilot',
        operation: 'generate',
        input: { openApiSpec: '${input.openApiSpec}' },
        outputKey: 'flowPilot',
      },
      {
        id: 'step-2',
        type: 'agent',
        agent: 'CodeGuardian',
        operation: 'generate',
        input: {
          code: '${steps.step-1.output.setup}',
          tests: '${steps.step-1.output.tests}',
          language: 'typescript',
        },
        outputKey: 'codeGuardian',
      },
    ],
  },
  'code-quality-audit': {
    id: 'code-quality-audit',
    name: 'Code Quality Audit',
    description: 'Parallel code analysis and test evolution',
    steps: [
      {
        id: 'step-1',
        type: 'parallel',
        branches: [
          {
            id: 'branch-1',
            type: 'agent',
            agent: 'CodeAnalysis',
            operation: 'analyze',
            input: { code: '${input.code}' },
            outputKey: 'codeAnalysis',
          },
          {
            id: 'branch-2',
            type: 'agent',
            agent: 'TestEvolution',
            operation: 'analyze',
            input: { testCases: '${input.testCases}' },
            outputKey: 'testEvolution',
          },
        ],
      },
    ],
  },
};

// ============================================================================
// Cost Estimation Constants
// ============================================================================

export const BASE_TOKEN_COST_PER_1K = 0.003;
export const AGENT_TOKEN_ESTIMATES: Record<string, number> = {
  TestWeaver: 2000,
  ScriptSmith: 1500,
  CodeGuardian: 1800,
  VisualAnalysis: 2500,
  BugPattern: 1600,
  FlowPilot: 1400,
  CodeAnalysis: 2000,
  TestEvolution: 1700,
};

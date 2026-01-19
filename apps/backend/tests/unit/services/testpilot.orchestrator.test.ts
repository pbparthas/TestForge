/**
 * TestPilot Orchestrator Service Tests (TDD - RED phase)
 * Sprint 12: Workflow orchestration for AI agent pipelines
 *
 * Tests for:
 * - Workflow execution (success, failure, partial)
 * - Step types (agent, condition, parallel, aggregate, transform, validate)
 * - Cost estimation
 * - Workflow cancellation
 * - Error handling
 * - Predefined workflows
 * - Custom workflow creation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ============================================================================
// Mock Setup - Must be hoisted
// ============================================================================

const { mockPrisma, mockTestWeaverAgent, mockScriptSmithAgent, mockCodeGuardianAgent, mockVisualAnalysisAgent, mockBugPatternAgent, mockFlowPilotAgent, mockCodeAnalysisAgent, mockTestEvolutionAgent } = vi.hoisted(() => ({
  mockPrisma: {
    workflow: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    workflowExecution: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    workflowStep: {
      create: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    aiUsage: {
      create: vi.fn(),
    },
  },
  mockTestWeaverAgent: {
    generate: vi.fn(),
    evolve: vi.fn(),
    batchGenerate: vi.fn(),
  },
  mockScriptSmithAgent: {
    generate: vi.fn(),
    edit: vi.fn(),
  },
  mockCodeGuardianAgent: {
    generate: vi.fn(),
    analyze: vi.fn(),
  },
  mockVisualAnalysisAgent: {
    analyze: vi.fn(),
  },
  mockBugPatternAgent: {
    analyze: vi.fn(),
    suggestFix: vi.fn(),
  },
  mockFlowPilotAgent: {
    generate: vi.fn(),
    chain: vi.fn(),
  },
  mockCodeAnalysisAgent: {
    analyze: vi.fn(),
  },
  mockTestEvolutionAgent: {
    evolve: vi.fn(),
    analyze: vi.fn(),
  },
}));

vi.mock('../../../src/utils/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../../../src/agents/testweaver.agent.js', () => ({
  TestWeaverAgent: vi.fn().mockImplementation(() => mockTestWeaverAgent),
  testWeaverAgent: mockTestWeaverAgent,
}));
vi.mock('../../../src/agents/scriptsmith.agent.js', () => ({
  ScriptSmithAgent: vi.fn().mockImplementation(() => mockScriptSmithAgent),
  scriptSmithAgent: mockScriptSmithAgent,
}));
vi.mock('../../../src/agents/codeguardian.agent.js', () => ({
  CodeGuardianAgent: vi.fn().mockImplementation(() => mockCodeGuardianAgent),
  codeGuardianAgent: mockCodeGuardianAgent,
}));
vi.mock('../../../src/agents/visualanalysis.agent.js', () => ({
  VisualAnalysisAgent: vi.fn().mockImplementation(() => mockVisualAnalysisAgent),
  visualAnalysisAgent: mockVisualAnalysisAgent,
}));
vi.mock('../../../src/agents/bugpattern.agent.js', () => ({
  BugPatternAgent: vi.fn().mockImplementation(() => mockBugPatternAgent),
  bugPatternAgent: mockBugPatternAgent,
}));
vi.mock('../../../src/agents/flowpilot.agent.js', () => ({
  FlowPilotAgent: vi.fn().mockImplementation(() => mockFlowPilotAgent),
  flowPilotAgent: mockFlowPilotAgent,
}));
vi.mock('../../../src/agents/codeanalysis.agent.js', () => ({
  CodeAnalysisAgent: vi.fn().mockImplementation(() => mockCodeAnalysisAgent),
  codeAnalysisAgent: mockCodeAnalysisAgent,
}));
vi.mock('../../../src/agents/testevolution.agent.js', () => ({
  TestEvolutionAgent: vi.fn().mockImplementation(() => mockTestEvolutionAgent),
  testEvolutionAgent: mockTestEvolutionAgent,
}));
vi.mock('../../../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Import after mocking
import {
  TestPilotOrchestratorService,
  WorkflowDefinition,
  WorkflowStep,
  ExecutionStatus,
  StepType,
  PredefinedWorkflow,
} from '../../../src/services/testpilot.orchestrator.service.js';

// ============================================================================
// Test Data
// ============================================================================

const mockUsage = {
  inputTokens: 1000,
  outputTokens: 500,
  totalTokens: 1500,
  costUsd: 0.015,
};

const mockTestWeaverOutput = {
  data: {
    testCases: [
      {
        title: 'Login with valid credentials',
        description: 'Verify user can login',
        steps: [{ order: 1, action: 'Enter creds', expected: 'Success' }],
        priority: 'high',
        type: 'functional',
      },
    ],
    summary: { total: 1, byPriority: { high: 1 }, byType: { functional: 1 } },
  },
  usage: mockUsage,
};

const mockScriptSmithOutput = {
  data: {
    name: 'login.spec.ts',
    code: 'test("login", async ({ page }) => { /* ... */ });',
    language: 'typescript',
    framework: 'playwright',
  },
  usage: mockUsage,
};

const mockCodeGuardianOutput = {
  data: {
    tests: [{ name: 'should login', code: 'test(...)', type: 'happy-path' }],
    estimatedCoverage: 85,
  },
  usage: mockUsage,
};

const mockVisualAnalysisOutput = {
  data: {
    elements: [{ type: 'button', label: 'Login', confidence: 0.95 }],
    suggestedActions: ['click_button'],
    hasVisualRegression: false,
  },
  usage: mockUsage,
};

const mockBugPatternOutput = {
  data: {
    patterns: [{ type: 'timing', severity: 'medium', description: 'Race condition' }],
    suggestedFixes: [{ description: 'Add wait', code: 'await page.waitFor(...)' }],
  },
  usage: mockUsage,
};

const mockFlowPilotOutput = {
  data: {
    tests: [{ name: 'should create user', code: 'test(...)', type: 'positive' }],
    setup: '// Setup',
  },
  usage: mockUsage,
};

const mockCodeAnalysisOutput = {
  data: {
    issues: [],
    suggestions: ['Consider adding error handling'],
    score: 90,
  },
  usage: mockUsage,
};

const mockTestEvolutionOutput = {
  data: {
    evolved: [{ id: 'tc-1', changes: ['Updated step'] }],
    deprecated: [],
    new: [],
  },
  usage: mockUsage,
};

const mockWorkflowExecution = {
  id: 'exec-123',
  workflowId: 'wf-123',
  status: 'pending' as ExecutionStatus,
  input: {},
  output: null,
  steps: [],
  startedAt: null,
  completedAt: null,
  error: null,
  totalCostUsd: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ============================================================================
// Tests
// ============================================================================

describe('TestPilotOrchestratorService', () => {
  let orchestrator: TestPilotOrchestratorService;

  beforeEach(() => {
    vi.resetAllMocks();
    orchestrator = new TestPilotOrchestratorService();
  });

  // ==========================================================================
  // executeWorkflow() - Basic Execution
  // ==========================================================================

  describe('executeWorkflow() - basic execution', () => {
    it('should execute a simple single-agent workflow', async () => {
      mockTestWeaverAgent.generate.mockResolvedValue(mockTestWeaverOutput);
      mockPrisma.workflowExecution.create.mockResolvedValue(mockWorkflowExecution);
      mockPrisma.workflowExecution.update.mockResolvedValue({
        ...mockWorkflowExecution,
        status: 'completed',
      });
      mockPrisma.workflowStep.create.mockResolvedValue({ id: 'step-1' });
      mockPrisma.workflowStep.update.mockResolvedValue({ id: 'step-1', status: 'completed' });

      const result = await orchestrator.executeWorkflow('full-test-suite', {
        specification: 'User login flow',
        projectId: 'project-123',
      });

      expect(result.status).toBe('completed');
      expect(result.output).toBeDefined();
      expect(mockTestWeaverAgent.generate).toHaveBeenCalled();
    });

    it('should track execution status throughout workflow', async () => {
      mockTestWeaverAgent.generate.mockResolvedValue(mockTestWeaverOutput);
      mockScriptSmithAgent.generate.mockResolvedValue(mockScriptSmithOutput);
      mockPrisma.workflowExecution.create.mockResolvedValue(mockWorkflowExecution);
      mockPrisma.workflowExecution.update.mockImplementation(({ data }) => ({
        ...mockWorkflowExecution,
        ...data,
      }));
      mockPrisma.workflowStep.create.mockResolvedValue({ id: 'step-1' });
      mockPrisma.workflowStep.update.mockResolvedValue({ id: 'step-1', status: 'completed' });

      await orchestrator.executeWorkflow('full-test-suite', {
        specification: 'User login flow',
        projectId: 'project-123',
      });

      // Verify status was updated to running, then completed
      const updateCalls = mockPrisma.workflowExecution.update.mock.calls;
      expect(updateCalls.some((call) => call[0].data.status === 'running')).toBe(true);
      expect(updateCalls.some((call) => call[0].data.status === 'completed')).toBe(true);
    });

    it('should accumulate costs across all steps', async () => {
      mockTestWeaverAgent.generate.mockResolvedValue(mockTestWeaverOutput);
      mockScriptSmithAgent.generate.mockResolvedValue(mockScriptSmithOutput);
      mockCodeGuardianAgent.generate.mockResolvedValue(mockCodeGuardianOutput);
      mockPrisma.workflowExecution.create.mockResolvedValue(mockWorkflowExecution);
      mockPrisma.workflowExecution.update.mockImplementation(({ data }) => ({
        ...mockWorkflowExecution,
        ...data,
      }));
      mockPrisma.workflowStep.create.mockResolvedValue({ id: 'step-1' });
      mockPrisma.workflowStep.update.mockResolvedValue({ id: 'step-1', status: 'completed' });

      const result = await orchestrator.executeWorkflow('full-test-suite', {
        specification: 'User login flow',
        projectId: 'project-123',
      });

      // Each agent returns $0.015, so 3 agents = $0.045
      expect(result.totalCostUsd).toBeGreaterThan(0);
    });

    it('should pass output from one step to next step as input', async () => {
      mockTestWeaverAgent.generate.mockResolvedValue(mockTestWeaverOutput);
      mockScriptSmithAgent.generate.mockResolvedValue(mockScriptSmithOutput);
      mockPrisma.workflowExecution.create.mockResolvedValue(mockWorkflowExecution);
      mockPrisma.workflowExecution.update.mockResolvedValue({
        ...mockWorkflowExecution,
        status: 'completed',
      });
      mockPrisma.workflowStep.create.mockResolvedValue({ id: 'step-1' });
      mockPrisma.workflowStep.update.mockResolvedValue({ id: 'step-1', status: 'completed' });

      await orchestrator.executeWorkflow('full-test-suite', {
        specification: 'User login flow',
        projectId: 'project-123',
      });

      // ScriptSmith should receive testCases from TestWeaver
      expect(mockScriptSmithAgent.generate).toHaveBeenCalledWith(
        expect.objectContaining({
          testCases: expect.arrayContaining([
            expect.objectContaining({ title: 'Login with valid credentials' }),
          ]),
        })
      );
    });
  });

  // ==========================================================================
  // executeWorkflow() - Predefined Workflows
  // ==========================================================================

  describe('executeWorkflow() - predefined workflows', () => {
    it('should execute full-test-suite workflow (TestWeaver -> ScriptSmith -> CodeGuardian)', async () => {
      mockTestWeaverAgent.generate.mockResolvedValue(mockTestWeaverOutput);
      mockScriptSmithAgent.generate.mockResolvedValue(mockScriptSmithOutput);
      mockCodeGuardianAgent.generate.mockResolvedValue(mockCodeGuardianOutput);
      mockPrisma.workflowExecution.create.mockResolvedValue(mockWorkflowExecution);
      mockPrisma.workflowExecution.update.mockResolvedValue({
        ...mockWorkflowExecution,
        status: 'completed',
      });
      mockPrisma.workflowStep.create.mockResolvedValue({ id: 'step-1' });
      mockPrisma.workflowStep.update.mockResolvedValue({ id: 'step-1', status: 'completed' });

      const result = await orchestrator.executeWorkflow('full-test-suite', {
        specification: 'User login flow',
        projectId: 'project-123',
      });

      expect(result.status).toBe('completed');
      expect(mockTestWeaverAgent.generate).toHaveBeenCalled();
      expect(mockScriptSmithAgent.generate).toHaveBeenCalled();
      expect(mockCodeGuardianAgent.generate).toHaveBeenCalled();
    });

    it('should execute visual-regression-flow workflow (VisualAnalysis -> BugPattern conditional)', async () => {
      mockVisualAnalysisAgent.analyze.mockResolvedValue({
        ...mockVisualAnalysisOutput,
        data: { ...mockVisualAnalysisOutput.data, hasVisualRegression: true },
      });
      mockBugPatternAgent.analyze.mockResolvedValue(mockBugPatternOutput);
      mockPrisma.workflowExecution.create.mockResolvedValue(mockWorkflowExecution);
      mockPrisma.workflowExecution.update.mockResolvedValue({
        ...mockWorkflowExecution,
        status: 'completed',
      });
      mockPrisma.workflowStep.create.mockResolvedValue({ id: 'step-1' });
      mockPrisma.workflowStep.update.mockResolvedValue({ id: 'step-1', status: 'completed' });

      const result = await orchestrator.executeWorkflow('visual-regression-flow', {
        screenshot: { base64: 'abc123', mediaType: 'image/png' },
        baselineScreenshot: { base64: 'def456', mediaType: 'image/png' },
        projectId: 'project-123',
      });

      expect(result.status).toBe('completed');
      expect(mockVisualAnalysisAgent.analyze).toHaveBeenCalled();
      // BugPattern should be called because hasVisualRegression is true
      expect(mockBugPatternAgent.analyze).toHaveBeenCalled();
    });

    it('should skip conditional step when condition is false', async () => {
      mockVisualAnalysisAgent.analyze.mockResolvedValue({
        ...mockVisualAnalysisOutput,
        data: { ...mockVisualAnalysisOutput.data, hasVisualRegression: false },
      });
      mockPrisma.workflowExecution.create.mockResolvedValue(mockWorkflowExecution);
      mockPrisma.workflowExecution.update.mockResolvedValue({
        ...mockWorkflowExecution,
        status: 'completed',
      });
      mockPrisma.workflowStep.create.mockResolvedValue({ id: 'step-1' });
      mockPrisma.workflowStep.update.mockResolvedValue({ id: 'step-1', status: 'skipped' });

      const result = await orchestrator.executeWorkflow('visual-regression-flow', {
        screenshot: { base64: 'abc123', mediaType: 'image/png' },
        baselineScreenshot: { base64: 'def456', mediaType: 'image/png' },
        projectId: 'project-123',
      });

      expect(result.status).toBe('completed');
      expect(mockVisualAnalysisAgent.analyze).toHaveBeenCalled();
      // BugPattern should NOT be called because hasVisualRegression is false
      expect(mockBugPatternAgent.analyze).not.toHaveBeenCalled();
    });

    it('should execute api-test-flow workflow (FlowPilot -> CodeGuardian)', async () => {
      mockFlowPilotAgent.generate.mockResolvedValue(mockFlowPilotOutput);
      mockCodeGuardianAgent.generate.mockResolvedValue(mockCodeGuardianOutput);
      mockPrisma.workflowExecution.create.mockResolvedValue(mockWorkflowExecution);
      mockPrisma.workflowExecution.update.mockResolvedValue({
        ...mockWorkflowExecution,
        status: 'completed',
      });
      mockPrisma.workflowStep.create.mockResolvedValue({ id: 'step-1' });
      mockPrisma.workflowStep.update.mockResolvedValue({ id: 'step-1', status: 'completed' });

      const result = await orchestrator.executeWorkflow('api-test-flow', {
        openApiSpec: '{ "openapi": "3.0.0" }',
        projectId: 'project-123',
      });

      expect(result.status).toBe('completed');
      expect(mockFlowPilotAgent.generate).toHaveBeenCalled();
      expect(mockCodeGuardianAgent.generate).toHaveBeenCalled();
    });

    it('should execute code-quality-audit workflow with parallel steps', async () => {
      mockCodeAnalysisAgent.analyze.mockResolvedValue(mockCodeAnalysisOutput);
      mockTestEvolutionAgent.analyze.mockResolvedValue(mockTestEvolutionOutput);
      mockPrisma.workflowExecution.create.mockResolvedValue(mockWorkflowExecution);
      mockPrisma.workflowExecution.update.mockResolvedValue({
        ...mockWorkflowExecution,
        status: 'completed',
      });
      mockPrisma.workflowStep.create.mockResolvedValue({ id: 'step-1' });
      mockPrisma.workflowStep.update.mockResolvedValue({ id: 'step-1', status: 'completed' });

      const result = await orchestrator.executeWorkflow('code-quality-audit', {
        code: 'function login() { /* ... */ }',
        testCases: [{ id: 'tc-1', title: 'Test 1' }],
        projectId: 'project-123',
      });

      expect(result.status).toBe('completed');
      // Both should be called (parallel execution)
      expect(mockCodeAnalysisAgent.analyze).toHaveBeenCalled();
      expect(mockTestEvolutionAgent.analyze).toHaveBeenCalled();
    });

    it('should throw error for unknown predefined workflow', async () => {
      await expect(
        orchestrator.executeWorkflow('unknown-workflow' as PredefinedWorkflow, {
          projectId: 'project-123',
        })
      ).rejects.toThrow('Unknown workflow: unknown-workflow');
    });
  });

  // ==========================================================================
  // executeWorkflow() - Step Types
  // ==========================================================================

  describe('executeWorkflow() - step types', () => {
    describe('agent step', () => {
      it('should call the specified agent with operation and input', async () => {
        mockTestWeaverAgent.generate.mockResolvedValue(mockTestWeaverOutput);
        mockPrisma.workflowExecution.create.mockResolvedValue(mockWorkflowExecution);
        mockPrisma.workflowExecution.update.mockResolvedValue({
          ...mockWorkflowExecution,
          status: 'completed',
        });
        mockPrisma.workflowStep.create.mockResolvedValue({ id: 'step-1' });
        mockPrisma.workflowStep.update.mockResolvedValue({ id: 'step-1', status: 'completed' });

        const customWorkflow: WorkflowDefinition = {
          id: 'custom-1',
          name: 'Custom Agent Workflow',
          steps: [
            {
              id: 'step-1',
              type: 'agent' as StepType,
              agent: 'TestWeaver',
              operation: 'generate',
              input: { specification: '${input.specification}' },
            },
          ],
        };

        const result = await orchestrator.executeCustomWorkflow(customWorkflow, {
          specification: 'Test spec',
          projectId: 'project-123',
        });

        expect(mockTestWeaverAgent.generate).toHaveBeenCalledWith(
          expect.objectContaining({ specification: 'Test spec' })
        );
        expect(result.status).toBe('completed');
      });

      it('should handle agent errors gracefully', async () => {
        mockTestWeaverAgent.generate.mockRejectedValue(new Error('Agent failed'));
        mockPrisma.workflowExecution.create.mockResolvedValue(mockWorkflowExecution);
        mockPrisma.workflowExecution.update.mockResolvedValue({
          ...mockWorkflowExecution,
          status: 'failed',
        });
        mockPrisma.workflowStep.create.mockResolvedValue({ id: 'step-1' });
        mockPrisma.workflowStep.update.mockResolvedValue({ id: 'step-1', status: 'failed' });

        const result = await orchestrator.executeWorkflow('full-test-suite', {
          specification: 'User login flow',
          projectId: 'project-123',
        });

        expect(result.status).toBe('failed');
        expect(result.error).toContain('Agent failed');
      });
    });

    describe('condition step', () => {
      it('should execute then branch when condition is true', async () => {
        mockTestWeaverAgent.generate.mockResolvedValue(mockTestWeaverOutput);
        mockScriptSmithAgent.generate.mockResolvedValue(mockScriptSmithOutput);
        mockPrisma.workflowExecution.create.mockResolvedValue(mockWorkflowExecution);
        mockPrisma.workflowExecution.update.mockResolvedValue({
          ...mockWorkflowExecution,
          status: 'completed',
        });
        mockPrisma.workflowStep.create.mockResolvedValue({ id: 'step-1' });
        mockPrisma.workflowStep.update.mockResolvedValue({ id: 'step-1', status: 'completed' });

        const customWorkflow: WorkflowDefinition = {
          id: 'custom-cond',
          name: 'Conditional Workflow',
          steps: [
            {
              id: 'step-1',
              type: 'agent' as StepType,
              agent: 'TestWeaver',
              operation: 'generate',
              input: { specification: '${input.specification}' },
              outputKey: 'testCases',
            },
            {
              id: 'step-2',
              type: 'condition' as StepType,
              condition: '${steps.step-1.output.testCases.length > 0}',
              then: [
                {
                  id: 'step-2a',
                  type: 'agent' as StepType,
                  agent: 'ScriptSmith',
                  operation: 'generate',
                  input: { testCases: '${steps.step-1.output.testCases}' },
                },
              ],
              else: [],
            },
          ],
        };

        await orchestrator.executeCustomWorkflow(customWorkflow, {
          specification: 'Test spec',
          projectId: 'project-123',
        });

        expect(mockScriptSmithAgent.generate).toHaveBeenCalled();
      });

      it('should execute else branch when condition is false', async () => {
        mockTestWeaverAgent.generate.mockResolvedValue({
          ...mockTestWeaverOutput,
          data: { ...mockTestWeaverOutput.data, testCases: [] },
        });
        mockPrisma.workflowExecution.create.mockResolvedValue(mockWorkflowExecution);
        mockPrisma.workflowExecution.update.mockResolvedValue({
          ...mockWorkflowExecution,
          status: 'completed',
        });
        mockPrisma.workflowStep.create.mockResolvedValue({ id: 'step-1' });
        mockPrisma.workflowStep.update.mockResolvedValue({ id: 'step-1', status: 'completed' });

        const customWorkflow: WorkflowDefinition = {
          id: 'custom-cond',
          name: 'Conditional Workflow',
          steps: [
            {
              id: 'step-1',
              type: 'agent' as StepType,
              agent: 'TestWeaver',
              operation: 'generate',
              input: { specification: '${input.specification}' },
              outputKey: 'testCases',
            },
            {
              id: 'step-2',
              type: 'condition' as StepType,
              condition: '${steps.step-1.output.testCases.length > 0}',
              then: [
                {
                  id: 'step-2a',
                  type: 'agent' as StepType,
                  agent: 'ScriptSmith',
                  operation: 'generate',
                  input: { testCases: '${steps.step-1.output.testCases}' },
                },
              ],
              else: [],
            },
          ],
        };

        await orchestrator.executeCustomWorkflow(customWorkflow, {
          specification: 'Test spec',
          projectId: 'project-123',
        });

        expect(mockScriptSmithAgent.generate).not.toHaveBeenCalled();
      });
    });

    describe('parallel step', () => {
      it('should execute multiple steps concurrently', async () => {
        mockCodeAnalysisAgent.analyze.mockResolvedValue(mockCodeAnalysisOutput);
        mockCodeGuardianAgent.generate.mockResolvedValue(mockCodeGuardianOutput);
        mockPrisma.workflowExecution.create.mockResolvedValue(mockWorkflowExecution);
        mockPrisma.workflowExecution.update.mockResolvedValue({
          ...mockWorkflowExecution,
          status: 'completed',
        });
        mockPrisma.workflowStep.create.mockResolvedValue({ id: 'step-1' });
        mockPrisma.workflowStep.update.mockResolvedValue({ id: 'step-1', status: 'completed' });

        const customWorkflow: WorkflowDefinition = {
          id: 'custom-parallel',
          name: 'Parallel Workflow',
          steps: [
            {
              id: 'step-1',
              type: 'parallel' as StepType,
              branches: [
                {
                  id: 'branch-1',
                  type: 'agent' as StepType,
                  agent: 'CodeAnalysis',
                  operation: 'analyze',
                  input: { code: '${input.code}' },
                },
                {
                  id: 'branch-2',
                  type: 'agent' as StepType,
                  agent: 'CodeGuardian',
                  operation: 'generate',
                  input: { code: '${input.code}' },
                },
              ],
            },
          ],
        };

        await orchestrator.executeCustomWorkflow(customWorkflow, {
          code: 'function test() {}',
          projectId: 'project-123',
        });

        expect(mockCodeAnalysisAgent.analyze).toHaveBeenCalled();
        expect(mockCodeGuardianAgent.generate).toHaveBeenCalled();
      });

      it('should fail entire parallel step if any branch fails', async () => {
        mockCodeAnalysisAgent.analyze.mockResolvedValue(mockCodeAnalysisOutput);
        mockCodeGuardianAgent.generate.mockRejectedValue(new Error('Branch failed'));
        mockPrisma.workflowExecution.create.mockResolvedValue(mockWorkflowExecution);
        mockPrisma.workflowExecution.update.mockResolvedValue({
          ...mockWorkflowExecution,
          status: 'failed',
        });
        mockPrisma.workflowStep.create.mockResolvedValue({ id: 'step-1' });
        mockPrisma.workflowStep.update.mockResolvedValue({ id: 'step-1', status: 'failed' });

        const customWorkflow: WorkflowDefinition = {
          id: 'custom-parallel',
          name: 'Parallel Workflow',
          steps: [
            {
              id: 'step-1',
              type: 'parallel' as StepType,
              branches: [
                {
                  id: 'branch-1',
                  type: 'agent' as StepType,
                  agent: 'CodeAnalysis',
                  operation: 'analyze',
                  input: { code: '${input.code}' },
                },
                {
                  id: 'branch-2',
                  type: 'agent' as StepType,
                  agent: 'CodeGuardian',
                  operation: 'generate',
                  input: { code: '${input.code}' },
                },
              ],
            },
          ],
        };

        const result = await orchestrator.executeCustomWorkflow(customWorkflow, {
          code: 'function test() {}',
          projectId: 'project-123',
        });

        expect(result.status).toBe('failed');
      });

      it('should aggregate results from parallel branches', async () => {
        mockCodeAnalysisAgent.analyze.mockResolvedValue(mockCodeAnalysisOutput);
        mockCodeGuardianAgent.generate.mockResolvedValue(mockCodeGuardianOutput);
        mockPrisma.workflowExecution.create.mockResolvedValue(mockWorkflowExecution);
        mockPrisma.workflowExecution.update.mockResolvedValue({
          ...mockWorkflowExecution,
          status: 'completed',
        });
        mockPrisma.workflowStep.create.mockResolvedValue({ id: 'step-1' });
        mockPrisma.workflowStep.update.mockResolvedValue({ id: 'step-1', status: 'completed' });

        const customWorkflow: WorkflowDefinition = {
          id: 'custom-parallel',
          name: 'Parallel Workflow',
          steps: [
            {
              id: 'step-1',
              type: 'parallel' as StepType,
              branches: [
                {
                  id: 'branch-1',
                  type: 'agent' as StepType,
                  agent: 'CodeAnalysis',
                  operation: 'analyze',
                  input: { code: '${input.code}' },
                  outputKey: 'codeAnalysis',
                },
                {
                  id: 'branch-2',
                  type: 'agent' as StepType,
                  agent: 'CodeGuardian',
                  operation: 'generate',
                  input: { code: '${input.code}' },
                  outputKey: 'codeGuardian',
                },
              ],
            },
          ],
        };

        const result = await orchestrator.executeCustomWorkflow(customWorkflow, {
          code: 'function test() {}',
          projectId: 'project-123',
        });

        expect(result.output).toHaveProperty('codeAnalysis');
        expect(result.output).toHaveProperty('codeGuardian');
      });
    });

    describe('aggregate step', () => {
      it('should combine results from multiple steps', async () => {
        mockTestWeaverAgent.generate.mockResolvedValue(mockTestWeaverOutput);
        mockScriptSmithAgent.generate.mockResolvedValue(mockScriptSmithOutput);
        mockPrisma.workflowExecution.create.mockResolvedValue(mockWorkflowExecution);
        mockPrisma.workflowExecution.update.mockResolvedValue({
          ...mockWorkflowExecution,
          status: 'completed',
        });
        mockPrisma.workflowStep.create.mockResolvedValue({ id: 'step-1' });
        mockPrisma.workflowStep.update.mockResolvedValue({ id: 'step-1', status: 'completed' });

        const customWorkflow: WorkflowDefinition = {
          id: 'custom-aggregate',
          name: 'Aggregate Workflow',
          steps: [
            {
              id: 'step-1',
              type: 'agent' as StepType,
              agent: 'TestWeaver',
              operation: 'generate',
              input: { specification: '${input.specification}' },
              outputKey: 'testWeaver',
            },
            {
              id: 'step-2',
              type: 'agent' as StepType,
              agent: 'ScriptSmith',
              operation: 'generate',
              input: { testCases: '${steps.step-1.output.testCases}' },
              outputKey: 'scriptSmith',
            },
            {
              id: 'step-3',
              type: 'aggregate' as StepType,
              sources: ['step-1', 'step-2'],
              aggregateFunction: 'merge',
              outputKey: 'combined',
            },
          ],
        };

        const result = await orchestrator.executeCustomWorkflow(customWorkflow, {
          specification: 'Test spec',
          projectId: 'project-123',
        });

        expect(result.output.combined).toBeDefined();
        expect(result.output.combined.testWeaver).toBeDefined();
        expect(result.output.combined.scriptSmith).toBeDefined();
      });
    });

    describe('transform step', () => {
      it('should transform data between steps', async () => {
        mockTestWeaverAgent.generate.mockResolvedValue(mockTestWeaverOutput);
        mockScriptSmithAgent.generate.mockResolvedValue(mockScriptSmithOutput);
        mockPrisma.workflowExecution.create.mockResolvedValue(mockWorkflowExecution);
        mockPrisma.workflowExecution.update.mockResolvedValue({
          ...mockWorkflowExecution,
          status: 'completed',
        });
        mockPrisma.workflowStep.create.mockResolvedValue({ id: 'step-1' });
        mockPrisma.workflowStep.update.mockResolvedValue({ id: 'step-1', status: 'completed' });

        const customWorkflow: WorkflowDefinition = {
          id: 'custom-transform',
          name: 'Transform Workflow',
          steps: [
            {
              id: 'step-1',
              type: 'agent' as StepType,
              agent: 'TestWeaver',
              operation: 'generate',
              input: { specification: '${input.specification}' },
            },
            {
              id: 'step-2',
              type: 'transform' as StepType,
              transform: {
                testCases: '${steps.step-1.output.testCases}',
                count: '${steps.step-1.output.testCases.length}',
                highPriority: '${steps.step-1.output.testCases.filter(tc => tc.priority === "high")}',
              },
              outputKey: 'transformed',
            },
          ],
        };

        const result = await orchestrator.executeCustomWorkflow(customWorkflow, {
          specification: 'Test spec',
          projectId: 'project-123',
        });

        expect(result.output.transformed).toBeDefined();
        expect(result.output.transformed.count).toBe(1);
      });
    });

    describe('validate step', () => {
      it('should validate step output and continue if valid', async () => {
        mockTestWeaverAgent.generate.mockResolvedValue(mockTestWeaverOutput);
        mockScriptSmithAgent.generate.mockResolvedValue(mockScriptSmithOutput);
        mockPrisma.workflowExecution.create.mockResolvedValue(mockWorkflowExecution);
        mockPrisma.workflowExecution.update.mockResolvedValue({
          ...mockWorkflowExecution,
          status: 'completed',
        });
        mockPrisma.workflowStep.create.mockResolvedValue({ id: 'step-1' });
        mockPrisma.workflowStep.update.mockResolvedValue({ id: 'step-1', status: 'completed' });

        const customWorkflow: WorkflowDefinition = {
          id: 'custom-validate',
          name: 'Validate Workflow',
          steps: [
            {
              id: 'step-1',
              type: 'agent' as StepType,
              agent: 'TestWeaver',
              operation: 'generate',
              input: { specification: '${input.specification}' },
            },
            {
              id: 'step-2',
              type: 'validate' as StepType,
              validation: {
                rules: [
                  { field: 'steps.step-1.output.testCases', condition: 'length > 0', message: 'No test cases generated' },
                ],
              },
            },
            {
              id: 'step-3',
              type: 'agent' as StepType,
              agent: 'ScriptSmith',
              operation: 'generate',
              input: { testCases: '${steps.step-1.output.testCases}' },
            },
          ],
        };

        const result = await orchestrator.executeCustomWorkflow(customWorkflow, {
          specification: 'Test spec',
          projectId: 'project-123',
        });

        expect(result.status).toBe('completed');
        expect(mockScriptSmithAgent.generate).toHaveBeenCalled();
      });

      it('should fail workflow if validation fails', async () => {
        mockTestWeaverAgent.generate.mockResolvedValue({
          ...mockTestWeaverOutput,
          data: { ...mockTestWeaverOutput.data, testCases: [] },
        });
        mockPrisma.workflowExecution.create.mockResolvedValue(mockWorkflowExecution);
        mockPrisma.workflowExecution.update.mockResolvedValue({
          ...mockWorkflowExecution,
          status: 'failed',
        });
        mockPrisma.workflowStep.create.mockResolvedValue({ id: 'step-1' });
        mockPrisma.workflowStep.update.mockResolvedValue({ id: 'step-1', status: 'failed' });

        const customWorkflow: WorkflowDefinition = {
          id: 'custom-validate',
          name: 'Validate Workflow',
          steps: [
            {
              id: 'step-1',
              type: 'agent' as StepType,
              agent: 'TestWeaver',
              operation: 'generate',
              input: { specification: '${input.specification}' },
            },
            {
              id: 'step-2',
              type: 'validate' as StepType,
              validation: {
                rules: [
                  { field: 'steps.step-1.output.testCases', condition: 'length > 0', message: 'No test cases generated' },
                ],
              },
            },
          ],
        };

        const result = await orchestrator.executeCustomWorkflow(customWorkflow, {
          specification: 'Test spec',
          projectId: 'project-123',
        });

        expect(result.status).toBe('failed');
        expect(result.error).toContain('No test cases generated');
      });
    });
  });

  // ==========================================================================
  // createCustomWorkflow()
  // ==========================================================================

  describe('createCustomWorkflow()', () => {
    it('should create a custom workflow definition', async () => {
      const mockWorkflow = {
        id: 'wf-custom-123',
        name: 'My Custom Workflow',
        description: 'A custom workflow for testing',
        steps: [],
        createdAt: new Date(),
      };
      mockPrisma.workflow.create.mockResolvedValue(mockWorkflow);

      const definition: WorkflowDefinition = {
        id: 'custom-1',
        name: 'My Custom Workflow',
        description: 'A custom workflow for testing',
        steps: [
          {
            id: 'step-1',
            type: 'agent' as StepType,
            agent: 'TestWeaver',
            operation: 'generate',
            input: { specification: '${input.specification}' },
          },
        ],
      };

      const result = await orchestrator.createCustomWorkflow(definition);

      expect(result.id).toBe('wf-custom-123');
      expect(result.name).toBe('My Custom Workflow');
      expect(mockPrisma.workflow.create).toHaveBeenCalled();
    });

    it('should validate workflow definition before creating', async () => {
      const invalidDefinition = {
        id: 'custom-1',
        name: '',  // Invalid: empty name
        steps: [],
      } as WorkflowDefinition;

      await expect(orchestrator.createCustomWorkflow(invalidDefinition)).rejects.toThrow(
        'Workflow name is required'
      );
    });

    it('should validate step types in workflow definition', async () => {
      const invalidDefinition: WorkflowDefinition = {
        id: 'custom-1',
        name: 'Invalid Workflow',
        steps: [
          {
            id: 'step-1',
            type: 'invalid-type' as StepType,
          },
        ],
      };

      await expect(orchestrator.createCustomWorkflow(invalidDefinition)).rejects.toThrow(
        'Invalid step type: invalid-type'
      );
    });

    it('should validate agent names in workflow definition', async () => {
      const invalidDefinition: WorkflowDefinition = {
        id: 'custom-1',
        name: 'Invalid Workflow',
        steps: [
          {
            id: 'step-1',
            type: 'agent' as StepType,
            agent: 'UnknownAgent',
            operation: 'generate',
          },
        ],
      };

      await expect(orchestrator.createCustomWorkflow(invalidDefinition)).rejects.toThrow(
        'Unknown agent: UnknownAgent'
      );
    });
  });

  // ==========================================================================
  // getWorkflowStatus()
  // ==========================================================================

  describe('getWorkflowStatus()', () => {
    it('should return current execution status', async () => {
      const mockExecutionWithSteps = {
        ...mockWorkflowExecution,
        status: 'running',
        steps: [
          { id: 'step-1', status: 'completed', output: {} },
          { id: 'step-2', status: 'running', output: null },
        ],
      };
      mockPrisma.workflowExecution.findUnique.mockResolvedValue(mockExecutionWithSteps);

      const result = await orchestrator.getWorkflowStatus('exec-123');

      expect(result.status).toBe('running');
      expect(result.steps).toHaveLength(2);
      expect(result.completedSteps).toBe(1);
      expect(result.totalSteps).toBe(2);
    });

    it('should throw error for non-existent execution', async () => {
      mockPrisma.workflowExecution.findUnique.mockResolvedValue(null);

      await expect(orchestrator.getWorkflowStatus('nonexistent')).rejects.toThrow(
        "Workflow execution with id 'nonexistent' not found"
      );
    });

    it('should include timing information', async () => {
      const startedAt = new Date('2025-01-01T10:00:00Z');
      const mockExecutionWithTiming = {
        ...mockWorkflowExecution,
        status: 'running',
        startedAt,
        steps: [],
      };
      mockPrisma.workflowExecution.findUnique.mockResolvedValue(mockExecutionWithTiming);

      const result = await orchestrator.getWorkflowStatus('exec-123');

      expect(result.startedAt).toEqual(startedAt);
      expect(result.elapsedMs).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // cancelWorkflow()
  // ==========================================================================

  describe('cancelWorkflow()', () => {
    it('should cancel a running workflow', async () => {
      mockPrisma.workflowExecution.findUnique.mockResolvedValue({
        ...mockWorkflowExecution,
        status: 'running',
      });
      mockPrisma.workflowExecution.update.mockResolvedValue({
        ...mockWorkflowExecution,
        status: 'cancelled',
      });

      const result = await orchestrator.cancelWorkflow('exec-123');

      expect(result.status).toBe('cancelled');
      expect(mockPrisma.workflowExecution.update).toHaveBeenCalledWith({
        where: { id: 'exec-123' },
        data: expect.objectContaining({ status: 'cancelled' }),
      });
    });

    it('should throw error for non-existent execution', async () => {
      mockPrisma.workflowExecution.findUnique.mockResolvedValue(null);

      await expect(orchestrator.cancelWorkflow('nonexistent')).rejects.toThrow(
        "Workflow execution with id 'nonexistent' not found"
      );
    });

    it('should throw error if workflow is already completed', async () => {
      mockPrisma.workflowExecution.findUnique.mockResolvedValue({
        ...mockWorkflowExecution,
        status: 'completed',
      });

      await expect(orchestrator.cancelWorkflow('exec-123')).rejects.toThrow(
        'Cannot cancel workflow with status: completed'
      );
    });

    it('should throw error if workflow is already cancelled', async () => {
      mockPrisma.workflowExecution.findUnique.mockResolvedValue({
        ...mockWorkflowExecution,
        status: 'cancelled',
      });

      await expect(orchestrator.cancelWorkflow('exec-123')).rejects.toThrow(
        'Cannot cancel workflow with status: cancelled'
      );
    });

    it('should throw error if workflow has already failed', async () => {
      mockPrisma.workflowExecution.findUnique.mockResolvedValue({
        ...mockWorkflowExecution,
        status: 'failed',
      });

      await expect(orchestrator.cancelWorkflow('exec-123')).rejects.toThrow(
        'Cannot cancel workflow with status: failed'
      );
    });
  });

  // ==========================================================================
  // estimateCost()
  // ==========================================================================

  describe('estimateCost()', () => {
    it('should estimate cost for a predefined workflow', async () => {
      const result = await orchestrator.estimateCost('full-test-suite', {
        specification: 'User login flow with 10 test cases',
        projectId: 'project-123',
      });

      expect(result).toHaveProperty('estimatedCostUsd');
      expect(result).toHaveProperty('estimatedTokens');
      expect(result).toHaveProperty('breakdown');
      expect(result.estimatedCostUsd).toBeGreaterThan(0);
    });

    it('should return cost breakdown by step', async () => {
      const result = await orchestrator.estimateCost('full-test-suite', {
        specification: 'User login flow',
        projectId: 'project-123',
      });

      expect(result.breakdown).toHaveLength(3); // TestWeaver, ScriptSmith, CodeGuardian
      result.breakdown.forEach((step) => {
        expect(step).toHaveProperty('stepId');
        expect(step).toHaveProperty('agent');
        expect(step).toHaveProperty('estimatedCostUsd');
        expect(step).toHaveProperty('estimatedTokens');
      });
    });

    it('should estimate higher cost for larger inputs', async () => {
      const smallInput = {
        specification: 'Simple test',
        projectId: 'project-123',
      };
      const largeInput = {
        specification: 'A very detailed specification '.repeat(100),
        projectId: 'project-123',
      };

      const smallEstimate = await orchestrator.estimateCost('full-test-suite', smallInput);
      const largeEstimate = await orchestrator.estimateCost('full-test-suite', largeInput);

      expect(largeEstimate.estimatedCostUsd).toBeGreaterThan(smallEstimate.estimatedCostUsd);
    });

    it('should throw error for unknown workflow', async () => {
      await expect(
        orchestrator.estimateCost('unknown-workflow' as PredefinedWorkflow, { projectId: 'project-123' })
      ).rejects.toThrow('Unknown workflow: unknown-workflow');
    });
  });

  // ==========================================================================
  // listWorkflows()
  // ==========================================================================

  describe('listWorkflows()', () => {
    it('should return list of predefined workflows', async () => {
      const result = await orchestrator.listWorkflows();

      expect(result.predefined).toContainEqual(
        expect.objectContaining({
          id: 'full-test-suite',
          name: expect.any(String),
          description: expect.any(String),
        })
      );
      expect(result.predefined).toContainEqual(
        expect.objectContaining({
          id: 'visual-regression-flow',
        })
      );
      expect(result.predefined).toContainEqual(
        expect.objectContaining({
          id: 'api-test-flow',
        })
      );
      expect(result.predefined).toContainEqual(
        expect.objectContaining({
          id: 'code-quality-audit',
        })
      );
    });

    it('should return list of custom workflows', async () => {
      const mockCustomWorkflows = [
        { id: 'custom-1', name: 'Custom Workflow 1' },
        { id: 'custom-2', name: 'Custom Workflow 2' },
      ];
      mockPrisma.workflow.findMany.mockResolvedValue(mockCustomWorkflows);

      const result = await orchestrator.listWorkflows();

      expect(result.custom).toHaveLength(2);
      expect(result.custom[0].id).toBe('custom-1');
    });

    it('should include workflow metadata', async () => {
      mockPrisma.workflow.findMany.mockResolvedValue([]);

      const result = await orchestrator.listWorkflows();

      result.predefined.forEach((workflow) => {
        expect(workflow).toHaveProperty('id');
        expect(workflow).toHaveProperty('name');
        expect(workflow).toHaveProperty('description');
        expect(workflow).toHaveProperty('agents');
        expect(workflow.agents).toBeInstanceOf(Array);
      });
    });
  });

  // ==========================================================================
  // Error Handling
  // ==========================================================================

  describe('error handling', () => {
    it('should handle database errors gracefully', async () => {
      mockPrisma.workflowExecution.create.mockRejectedValue(new Error('Database error'));

      await expect(
        orchestrator.executeWorkflow('full-test-suite', {
          specification: 'Test spec',
          projectId: 'project-123',
        })
      ).rejects.toThrow('Database error');
    });

    it('should handle agent timeout errors', async () => {
      mockTestWeaverAgent.generate.mockRejectedValue(new Error('Request timeout'));
      mockPrisma.workflowExecution.create.mockResolvedValue(mockWorkflowExecution);
      mockPrisma.workflowExecution.update.mockResolvedValue({
        ...mockWorkflowExecution,
        status: 'failed',
      });
      mockPrisma.workflowStep.create.mockResolvedValue({ id: 'step-1' });
      mockPrisma.workflowStep.update.mockResolvedValue({ id: 'step-1', status: 'failed' });

      const result = await orchestrator.executeWorkflow('full-test-suite', {
        specification: 'Test spec',
        projectId: 'project-123',
      });

      expect(result.status).toBe('failed');
      expect(result.error).toContain('Request timeout');
    });

    it('should record partial results on failure', async () => {
      mockTestWeaverAgent.generate.mockResolvedValue(mockTestWeaverOutput);
      mockScriptSmithAgent.generate.mockRejectedValue(new Error('ScriptSmith failed'));
      mockPrisma.workflowExecution.create.mockResolvedValue(mockWorkflowExecution);
      mockPrisma.workflowExecution.update.mockImplementation(({ data }) => ({
        ...mockWorkflowExecution,
        ...data,
      }));
      mockPrisma.workflowStep.create.mockResolvedValue({ id: 'step-1' });
      mockPrisma.workflowStep.update.mockResolvedValue({ id: 'step-1', status: 'completed' });

      const result = await orchestrator.executeWorkflow('full-test-suite', {
        specification: 'Test spec',
        projectId: 'project-123',
      });

      expect(result.status).toBe('failed');
      // First step should have succeeded
      expect(result.output.testWeaver).toBeDefined();
    });

    it('should validate input before execution', async () => {
      await expect(
        orchestrator.executeWorkflow('full-test-suite', {
          // Missing required projectId
        } as Record<string, unknown>)
      ).rejects.toThrow('projectId is required');
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('edge cases', () => {
    it('should handle empty workflow definition', async () => {
      const emptyWorkflow: WorkflowDefinition = {
        id: 'empty',
        name: 'Empty Workflow',
        steps: [],
      };

      await expect(orchestrator.createCustomWorkflow(emptyWorkflow)).rejects.toThrow(
        'Workflow must have at least one step'
      );
    });

    it('should handle circular step references', async () => {
      const circularWorkflow: WorkflowDefinition = {
        id: 'circular',
        name: 'Circular Workflow',
        steps: [
          {
            id: 'step-1',
            type: 'agent' as StepType,
            agent: 'TestWeaver',
            operation: 'generate',
            input: { data: '${steps.step-2.output}' }, // References future step
          },
          {
            id: 'step-2',
            type: 'agent' as StepType,
            agent: 'ScriptSmith',
            operation: 'generate',
            input: { data: '${steps.step-1.output}' },
          },
        ],
      };

      await expect(orchestrator.createCustomWorkflow(circularWorkflow)).rejects.toThrow(
        'Circular dependency detected'
      );
    });

    it('should handle very long workflow chains', async () => {
      mockTestWeaverAgent.generate.mockResolvedValue(mockTestWeaverOutput);
      mockPrisma.workflowExecution.create.mockResolvedValue(mockWorkflowExecution);
      mockPrisma.workflowExecution.update.mockResolvedValue({
        ...mockWorkflowExecution,
        status: 'completed',
      });
      mockPrisma.workflowStep.create.mockResolvedValue({ id: 'step-1' });
      mockPrisma.workflowStep.update.mockResolvedValue({ id: 'step-1', status: 'completed' });

      const manySteps: WorkflowStep[] = Array.from({ length: 20 }, (_, i) => ({
        id: `step-${i + 1}`,
        type: 'agent' as StepType,
        agent: 'TestWeaver',
        operation: 'generate',
        input: { specification: '${input.specification}' },
      }));

      const longWorkflow: WorkflowDefinition = {
        id: 'long',
        name: 'Long Workflow',
        steps: manySteps,
      };

      const result = await orchestrator.executeCustomWorkflow(longWorkflow, {
        specification: 'Test spec',
        projectId: 'project-123',
      });

      expect(result.status).toBe('completed');
      expect(mockTestWeaverAgent.generate).toHaveBeenCalledTimes(20);
    });

    it('should handle special characters in input', async () => {
      mockTestWeaverAgent.generate.mockResolvedValue(mockTestWeaverOutput);
      mockPrisma.workflowExecution.create.mockResolvedValue(mockWorkflowExecution);
      mockPrisma.workflowExecution.update.mockResolvedValue({
        ...mockWorkflowExecution,
        status: 'completed',
      });
      mockPrisma.workflowStep.create.mockResolvedValue({ id: 'step-1' });
      mockPrisma.workflowStep.update.mockResolvedValue({ id: 'step-1', status: 'completed' });

      const result = await orchestrator.executeWorkflow('full-test-suite', {
        specification: 'Test with special chars: <>&"\'${variable}',
        projectId: 'project-123',
      });

      expect(result.status).toBe('completed');
    });

    it('should handle concurrent workflow executions', async () => {
      mockTestWeaverAgent.generate.mockResolvedValue(mockTestWeaverOutput);
      mockScriptSmithAgent.generate.mockResolvedValue(mockScriptSmithOutput);
      mockCodeGuardianAgent.generate.mockResolvedValue(mockCodeGuardianOutput);
      mockPrisma.workflowExecution.create.mockResolvedValue(mockWorkflowExecution);
      mockPrisma.workflowExecution.update.mockResolvedValue({
        ...mockWorkflowExecution,
        status: 'completed',
      });
      mockPrisma.workflowStep.create.mockResolvedValue({ id: 'step-1' });
      mockPrisma.workflowStep.update.mockResolvedValue({ id: 'step-1', status: 'completed' });

      const executions = await Promise.all([
        orchestrator.executeWorkflow('full-test-suite', {
          specification: 'Spec 1',
          projectId: 'project-123',
        }),
        orchestrator.executeWorkflow('full-test-suite', {
          specification: 'Spec 2',
          projectId: 'project-123',
        }),
      ]);

      expect(executions[0].status).toBe('completed');
      expect(executions[1].status).toBe('completed');
    });
  });
});

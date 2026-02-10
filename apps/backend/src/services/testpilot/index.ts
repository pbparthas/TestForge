/**
 * TestPilot Orchestrator Service
 * Sprint 12: Workflow orchestration for AI agent pipelines
 *
 * Public API: CRUD, status, cancel, estimate, validate.
 * Delegates step execution to WorkflowEngine.
 */

import { prisma } from '../../utils/prisma.js';
import { logger } from '../../utils/logger.js';
import { WorkflowEngine } from './workflow-engine.js';
import {
  PREDEFINED_WORKFLOWS,
  BASE_TOKEN_COST_PER_1K,
  AGENT_TOKEN_ESTIMATES,
} from './workflow-definitions.js';
import type {
  ExecutionStatus,
  PredefinedWorkflow,
  WorkflowDefinition,
  WorkflowExecutionOptions,
  WorkflowExecutionResult,
  WorkflowStatusResult,
  CostEstimate,
  WorkflowListResult,
  StepType,
} from './workflow-definitions.js';

// Re-export all types for consumers
export type {
  ExecutionStatus,
  StepType,
  PredefinedWorkflow,
  WorkflowStep,
  WorkflowDefinition,
  WorkflowExecutionOptions,
  WorkflowExecutionResult,
  WorkflowStatusResult,
  CostEstimate,
  WorkflowListResult,
} from './workflow-definitions.js';

export class TestPilotOrchestratorService {
  private cancelledExecutions: Set<string> = new Set();
  private engine = new WorkflowEngine();

  async executeWorkflow(
    workflowId: PredefinedWorkflow,
    input: Record<string, unknown>,
    options?: WorkflowExecutionOptions
  ): Promise<WorkflowExecutionResult> {
    if (!input.projectId) {
      throw new Error('projectId is required');
    }

    const workflow = PREDEFINED_WORKFLOWS[workflowId];
    if (!workflow) {
      throw new Error(`Unknown workflow: ${workflowId}`);
    }

    return this.executeCustomWorkflow(workflow, input, options);
  }

  async executeCustomWorkflow(
    definition: WorkflowDefinition,
    input: Record<string, unknown>,
    _options?: WorkflowExecutionOptions
  ): Promise<WorkflowExecutionResult> {
    if (!input.projectId) {
      throw new Error('projectId is required');
    }

    const execution = await prisma.workflowExecution.create({
      data: {
        workflowId: definition.id,
        status: 'pending',
        input: input as object,
        output: null,
        totalCostUsd: 0,
      },
    });

    const stepResults: Record<string, { output: unknown; status: ExecutionStatus }> = {};
    const executedSteps: Array<{ id: string; status: ExecutionStatus; output?: unknown; error?: string }> = [];
    let totalCostUsd = 0;
    let lastError: string | null = null;

    try {
      await prisma.workflowExecution.update({
        where: { id: execution.id },
        data: { status: 'running', startedAt: new Date() },
      });

      for (const step of definition.steps) {
        if (this.cancelledExecutions.has(execution.id)) {
          await prisma.workflowExecution.update({
            where: { id: execution.id },
            data: { status: 'cancelled', completedAt: new Date() },
          });
          return {
            id: execution.id,
            workflowId: definition.id,
            status: 'cancelled',
            input,
            output: this.engine.buildOutput(stepResults),
            steps: executedSteps,
            startedAt: new Date(),
            completedAt: new Date(),
            error: 'Workflow cancelled',
            totalCostUsd,
          };
        }

        const stepResult = await this.engine.executeStep(step, input, stepResults);

        if (stepResult.status === 'failed') {
          lastError = stepResult.error || 'Step execution failed';
          executedSteps.push({ id: step.id, status: 'failed', error: lastError });

          const stepRecord = await prisma.workflowStep.create({
            data: { executionId: execution.id, stepId: step.id, status: 'failed', error: lastError },
          });
          await prisma.workflowStep.update({
            where: { id: stepRecord.id },
            data: { status: 'failed' },
          });

          await prisma.workflowExecution.update({
            where: { id: execution.id },
            data: {
              status: 'failed',
              completedAt: new Date(),
              error: lastError,
              output: this.engine.buildOutput(stepResults) as object,
              totalCostUsd,
            },
          });

          return {
            id: execution.id,
            workflowId: definition.id,
            status: 'failed',
            input,
            output: this.engine.buildOutput(stepResults),
            steps: executedSteps,
            startedAt: new Date(),
            completedAt: new Date(),
            error: lastError,
            totalCostUsd,
          };
        }

        if (stepResult.status === 'skipped') {
          executedSteps.push({ id: step.id, status: 'completed', output: stepResult.output });
          await prisma.workflowStep.create({
            data: { executionId: execution.id, stepId: step.id, status: 'skipped', output: stepResult.output as object },
          });
          continue;
        }

        stepResults[step.id] = stepResult;
        if (step.outputKey) {
          stepResults[step.outputKey] = stepResult;
        }
        totalCostUsd += stepResult.costUsd || 0;

        executedSteps.push({ id: step.id, status: 'completed', output: stepResult.output });

        const stepRecord = await prisma.workflowStep.create({
          data: { executionId: execution.id, stepId: step.id, status: 'completed', output: stepResult.output as object },
        });
        await prisma.workflowStep.update({
          where: { id: stepRecord.id },
          data: { status: 'completed' },
        });
      }

      const outputData = this.engine.buildOutput(stepResults);
      await prisma.workflowExecution.update({
        where: { id: execution.id },
        data: { status: 'completed', completedAt: new Date(), output: outputData as object, totalCostUsd },
      });

      return {
        id: execution.id,
        workflowId: definition.id,
        status: 'completed',
        input,
        output: outputData,
        steps: executedSteps,
        startedAt: new Date(),
        completedAt: new Date(),
        error: null,
        totalCostUsd,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage, executionId: execution.id }, 'Workflow execution failed');

      await prisma.workflowExecution.update({
        where: { id: execution.id },
        data: {
          status: 'failed',
          completedAt: new Date(),
          error: errorMessage,
          output: this.engine.buildOutput(stepResults) as object,
          totalCostUsd,
        },
      });

      return {
        id: execution.id,
        workflowId: definition.id,
        status: 'failed',
        input,
        output: this.engine.buildOutput(stepResults),
        steps: executedSteps,
        startedAt: new Date(),
        completedAt: new Date(),
        error: errorMessage,
        totalCostUsd,
      };
    }
  }

  async createCustomWorkflow(definition: WorkflowDefinition): Promise<{ id: string; name: string }> {
    if (!definition.name || definition.name.trim() === '') {
      throw new Error('Workflow name is required');
    }

    if (!definition.steps || definition.steps.length === 0) {
      throw new Error('Workflow must have at least one step');
    }

    this.engine.validateWorkflowDefinition(definition);
    this.engine.checkCircularDependencies(definition);

    const workflow = await prisma.workflow.create({
      data: {
        name: definition.name,
        description: definition.description || '',
        steps: definition.steps as unknown as object,
      },
    });

    return { id: workflow.id, name: workflow.name };
  }

  async getWorkflowStatus(executionId: string): Promise<WorkflowStatusResult> {
    const execution = await prisma.workflowExecution.findUnique({
      where: { id: executionId },
      include: { steps: true },
    });

    if (!execution) {
      throw new Error(`Workflow execution with id '${executionId}' not found`);
    }

    const steps = execution.steps || [];
    const completedSteps = steps.filter(s => s.status === 'completed').length;
    const totalSteps = steps.length;

    const now = new Date();
    const startedAt = execution.startedAt;
    const elapsedMs = startedAt ? now.getTime() - startedAt.getTime() : 0;

    return {
      status: execution.status as ExecutionStatus,
      steps: steps.map(s => ({ id: s.stepId, status: s.status, output: s.output })),
      completedSteps,
      totalSteps,
      startedAt: execution.startedAt,
      completedAt: execution.completedAt || undefined,
      elapsedMs,
    };
  }

  async cancelWorkflow(executionId: string): Promise<{ status: ExecutionStatus }> {
    const execution = await prisma.workflowExecution.findUnique({
      where: { id: executionId },
    });

    if (!execution) {
      throw new Error(`Workflow execution with id '${executionId}' not found`);
    }

    if (execution.status === 'completed' || execution.status === 'cancelled' || execution.status === 'failed') {
      throw new Error(`Cannot cancel workflow with status: ${execution.status}`);
    }

    this.cancelledExecutions.add(executionId);

    const updated = await prisma.workflowExecution.update({
      where: { id: executionId },
      data: { status: 'cancelled', completedAt: new Date() },
    });

    return { status: updated.status as ExecutionStatus };
  }

  async estimateCost(workflowId: PredefinedWorkflow, input: Record<string, unknown>): Promise<CostEstimate> {
    const workflow = PREDEFINED_WORKFLOWS[workflowId];
    if (!workflow) {
      throw new Error(`Unknown workflow: ${workflowId}`);
    }

    const inputSize = JSON.stringify(input).length;
    const inputMultiplier = 1 + (inputSize / 1000) * 0.1;

    const breakdown: CostEstimate['breakdown'] = [];
    let totalTokens = 0;
    let totalCost = 0;

    for (const step of workflow.steps) {
      if (step.type === 'agent' && step.agent) {
        const baseTokens = AGENT_TOKEN_ESTIMATES[step.agent] || 1500;
        const estimatedTokens = Math.round(baseTokens * inputMultiplier);
        const estimatedCost = (estimatedTokens / 1000) * BASE_TOKEN_COST_PER_1K;

        breakdown.push({
          stepId: step.id,
          agent: step.agent,
          estimatedTokens,
          estimatedCostUsd: Math.round(estimatedCost * 1000000) / 1000000,
        });

        totalTokens += estimatedTokens;
        totalCost += estimatedCost;
      } else if (step.type === 'parallel' && step.branches) {
        for (const branch of step.branches) {
          if (branch.type === 'agent' && branch.agent) {
            const baseTokens = AGENT_TOKEN_ESTIMATES[branch.agent] || 1500;
            const estimatedTokens = Math.round(baseTokens * inputMultiplier);
            const estimatedCost = (estimatedTokens / 1000) * BASE_TOKEN_COST_PER_1K;

            breakdown.push({
              stepId: branch.id,
              agent: branch.agent,
              estimatedTokens,
              estimatedCostUsd: Math.round(estimatedCost * 1000000) / 1000000,
            });

            totalTokens += estimatedTokens;
            totalCost += estimatedCost;
          }
        }
      }
    }

    return {
      estimatedCostUsd: Math.round(totalCost * 1000000) / 1000000,
      estimatedTokens: totalTokens,
      breakdown,
    };
  }

  async listWorkflows(): Promise<WorkflowListResult> {
    const predefined = Object.values(PREDEFINED_WORKFLOWS).map(wf => ({
      id: wf.id,
      name: wf.name,
      description: wf.description || '',
      agents: this.engine.extractAgents(wf.steps),
    }));

    const customWorkflows = await prisma.workflow.findMany() || [];

    return {
      predefined,
      custom: customWorkflows.map(wf => ({
        id: wf.id,
        name: wf.name,
        description: wf.description || undefined,
      })),
    };
  }
}

export const testPilotOrchestratorService = new TestPilotOrchestratorService();

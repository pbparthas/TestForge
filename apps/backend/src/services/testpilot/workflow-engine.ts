/**
 * TestPilot Workflow Engine
 * Step execution, variable resolution, expression evaluation.
 * Pure logic — no Prisma dependency.
 */

import type { WorkflowStep, ExecutionStatus } from './workflow-definitions.js';
import { AGENT_REGISTRY } from './workflow-definitions.js';

type StepResult = { output: unknown; status: ExecutionStatus; error?: string; costUsd?: number };
type StepResults = Record<string, { output: unknown; status: ExecutionStatus }>;

export class WorkflowEngine {
  async executeStep(
    step: WorkflowStep,
    input: Record<string, unknown>,
    stepResults: StepResults,
  ): Promise<StepResult> {
    try {
      switch (step.type) {
        case 'agent':
          return await this.executeAgentStep(step, input, stepResults);
        case 'condition':
          return await this.executeConditionStep(step, input, stepResults);
        case 'parallel':
          return await this.executeParallelStep(step, input, stepResults);
        case 'aggregate':
          return await this.executeAggregateStep(step, stepResults);
        case 'transform':
          return await this.executeTransformStep(step, input, stepResults);
        case 'validate':
          return await this.executeValidateStep(step, input, stepResults);
        default:
          throw new Error(`Unknown step type: ${step.type}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { output: null, status: 'failed', error: errorMessage };
    }
  }

  private async executeAgentStep(
    step: WorkflowStep,
    input: Record<string, unknown>,
    stepResults: StepResults,
  ): Promise<StepResult> {
    if (!step.agent || !step.operation) {
      throw new Error('Agent step requires agent and operation');
    }

    const agentConfig = AGENT_REGISTRY[step.agent];
    if (!agentConfig) {
      throw new Error(`Unknown agent: ${step.agent}`);
    }

    const resolvedInput = this.resolveVariables(step.input || {}, input, stepResults);

    const agent = agentConfig.instance as Record<string, (input: unknown) => Promise<{ data: unknown; usage: { costUsd: number } }>>;
    const method = agent[step.operation];

    if (typeof method !== 'function') {
      throw new Error(`Agent ${step.agent} does not have operation ${step.operation}`);
    }

    try {
      const result = await method.call(agent, resolvedInput);
      if (!result) {
        return { output: null, status: 'completed', costUsd: 0 };
      }
      return {
        output: result.data,
        status: 'completed',
        costUsd: result.usage?.costUsd || 0,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Agent execution failed';
      return { output: null, status: 'failed', error: errorMessage };
    }
  }

  private async executeConditionStep(
    step: WorkflowStep,
    input: Record<string, unknown>,
    stepResults: StepResults,
  ): Promise<StepResult> {
    if (!step.condition) {
      throw new Error('Condition step requires condition');
    }

    const conditionResult = this.evaluateCondition(step.condition, input, stepResults);
    const branchSteps = conditionResult ? (step.then || []) : (step.else || []);

    if (branchSteps.length === 0) {
      return { output: null, status: 'skipped' as ExecutionStatus };
    }

    let totalCost = 0;
    let lastOutput: unknown = null;

    for (const branchStep of branchSteps) {
      const result = await this.executeStep(branchStep, input, stepResults);
      if (result.status === 'failed') {
        return result;
      }
      if (branchStep.outputKey) {
        stepResults[branchStep.outputKey] = result;
      }
      stepResults[branchStep.id] = result;
      totalCost += result.costUsd || 0;
      lastOutput = result.output;
    }

    return { output: lastOutput, status: 'completed', costUsd: totalCost };
  }

  private async executeParallelStep(
    step: WorkflowStep,
    input: Record<string, unknown>,
    stepResults: StepResults,
  ): Promise<StepResult> {
    if (!step.branches || step.branches.length === 0) {
      return { output: {}, status: 'completed' };
    }

    const promises = step.branches.map(branch => this.executeStep(branch, input, stepResults));
    const results = await Promise.all(promises);

    const failedResult = results.find(r => r.status === 'failed');
    if (failedResult) {
      return { output: null, status: 'failed', error: failedResult.error };
    }

    const combinedOutput: Record<string, unknown> = {};
    let totalCost = 0;

    for (let i = 0; i < step.branches.length; i++) {
      const branch = step.branches[i];
      const result = results[i];

      if (branch.outputKey) {
        combinedOutput[branch.outputKey] = result.output;
        stepResults[branch.outputKey] = result;
      }
      stepResults[branch.id] = result;
      totalCost += result.costUsd || 0;
    }

    return { output: combinedOutput, status: 'completed', costUsd: totalCost };
  }

  private async executeAggregateStep(
    step: WorkflowStep,
    stepResults: StepResults,
  ): Promise<StepResult> {
    if (!step.sources || step.sources.length === 0) {
      return { output: {}, status: 'completed' };
    }

    const aggregated: Record<string, unknown> = {};

    for (const source of step.sources) {
      const sourceResult = stepResults[source];
      if (sourceResult) {
        const outputKey = Object.keys(stepResults).find(key =>
          stepResults[key] === sourceResult && key !== source
        ) || source;
        aggregated[outputKey] = sourceResult.output;
      }
    }

    return { output: aggregated, status: 'completed' };
  }

  private async executeTransformStep(
    step: WorkflowStep,
    input: Record<string, unknown>,
    stepResults: StepResults,
  ): Promise<StepResult> {
    if (!step.transform) {
      return { output: {}, status: 'completed' };
    }

    const transformed: Record<string, unknown> = {};

    for (const [key, expression] of Object.entries(step.transform)) {
      transformed[key] = this.evaluateExpression(expression, input, stepResults);
    }

    return { output: transformed, status: 'completed' };
  }

  private async executeValidateStep(
    step: WorkflowStep,
    input: Record<string, unknown>,
    stepResults: StepResults,
  ): Promise<StepResult> {
    if (!step.validation || !step.validation.rules) {
      return { output: { valid: true }, status: 'completed' };
    }

    for (const rule of step.validation.rules) {
      const fieldValue = this.getFieldValue(rule.field, input, stepResults);
      const isValid = this.evaluateValidationCondition(rule.condition, fieldValue);

      if (!isValid) {
        return {
          output: { valid: false, message: rule.message },
          status: 'failed',
          error: rule.message
        };
      }
    }

    return { output: { valid: true }, status: 'completed' };
  }

  resolveVariables(
    template: Record<string, unknown>,
    input: Record<string, unknown>,
    stepResults: StepResults,
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(template)) {
      if (typeof value === 'string' && value.startsWith('${') && value.endsWith('}')) {
        result[key] = this.evaluateExpression(value, input, stepResults);
      } else if (typeof value === 'object' && value !== null) {
        result[key] = this.resolveVariables(value as Record<string, unknown>, input, stepResults);
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  evaluateExpression(
    expression: string,
    input: Record<string, unknown>,
    stepResults: StepResults,
  ): unknown {
    if (!expression.startsWith('${') || !expression.endsWith('}')) {
      return expression;
    }

    const path = expression.slice(2, -1);

    if (path.startsWith('input.')) {
      const inputPath = path.slice(6);
      return this.getNestedValue(input, inputPath);
    }

    if (path.startsWith('steps.')) {
      const stepPath = path.slice(6);
      const [stepId, ...rest] = stepPath.split('.');
      const stepResult = stepResults[stepId];

      if (!stepResult) return undefined;

      if (rest[0] === 'output') {
        const outputPath = rest.slice(1).join('.');
        if (outputPath) {
          return this.getNestedValue(stepResult.output as Record<string, unknown>, outputPath);
        }
        return stepResult.output;
      }

      return this.getNestedValue(stepResult as unknown as Record<string, unknown>, rest.join('.'));
    }

    return expression;
  }

  evaluateCondition(
    condition: string,
    input: Record<string, unknown>,
    stepResults: StepResults,
  ): boolean {
    if (!condition.startsWith('${') || !condition.endsWith('}')) {
      return Boolean(condition);
    }

    const expression = condition.slice(2, -1);

    if (expression.includes(' > ') || expression.includes(' < ') || expression.includes(' === ')) {
      return this.evaluateComparison(expression, input, stepResults);
    }

    const value = this.evaluateExpression(condition, input, stepResults);
    return Boolean(value);
  }

  private evaluateComparison(
    expression: string,
    input: Record<string, unknown>,
    stepResults: StepResults,
  ): boolean {
    if (expression.includes('.length > ')) {
      const [arrayPath, threshold] = expression.split('.length > ');
      const arrayValue = this.evaluateExpression('${' + arrayPath + '}', input, stepResults);
      const thresholdNum = parseInt(threshold, 10);

      if (Array.isArray(arrayValue)) {
        return arrayValue.length > thresholdNum;
      }
      return false;
    }

    return false;
  }

  private evaluateValidationCondition(condition: string, value: unknown): boolean {
    if (condition === 'length > 0') {
      return Array.isArray(value) ? value.length > 0 : Boolean(value);
    }

    if (condition.startsWith('length > ')) {
      const threshold = parseInt(condition.slice(9), 10);
      return Array.isArray(value) ? value.length > threshold : false;
    }

    return Boolean(value);
  }

  private getFieldValue(
    field: string,
    input: Record<string, unknown>,
    stepResults: StepResults,
  ): unknown {
    if (field.startsWith('steps.')) {
      const path = field.slice(6);
      const [stepId, ...rest] = path.split('.');
      const stepResult = stepResults[stepId];

      if (!stepResult) return undefined;

      if (rest[0] === 'output') {
        const outputPath = rest.slice(1).join('.');
        if (outputPath) {
          return this.getNestedValue(stepResult.output as Record<string, unknown>, outputPath);
        }
        return stepResult.output;
      }

      return this.getNestedValue(stepResult as unknown as Record<string, unknown>, rest.join('.'));
    }

    if (field.startsWith('input.')) {
      return this.getNestedValue(input, field.slice(6));
    }

    return undefined;
  }

  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    if (!path) return obj;

    const parts = path.split('.');
    let current: unknown = obj;

    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      if (typeof current !== 'object') return undefined;
      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }

  buildOutput(
    stepResults: StepResults,
  ): Record<string, unknown> {
    const output: Record<string, unknown> = {};

    for (const [key, result] of Object.entries(stepResults)) {
      if (!key.startsWith('step-') && !key.startsWith('branch-')) {
        output[key] = result.output;
      }
    }

    return output;
  }

  extractAgents(steps: WorkflowStep[]): string[] {
    const agents: string[] = [];

    const extract = (stepList: WorkflowStep[]) => {
      for (const step of stepList) {
        if (step.type === 'agent' && step.agent && !agents.includes(step.agent)) {
          agents.push(step.agent);
        }
        if (step.then) extract(step.then);
        if (step.else) extract(step.else);
        if (step.branches) extract(step.branches);
      }
    };

    extract(steps);
    return agents;
  }

  validateWorkflowDefinition(definition: { steps: WorkflowStep[] }): void {
    const validStepTypes = ['agent', 'condition', 'parallel', 'aggregate', 'transform', 'validate'];

    const validateSteps = (steps: WorkflowStep[]) => {
      for (const step of steps) {
        if (!validStepTypes.includes(step.type)) {
          throw new Error(`Invalid step type: ${step.type}`);
        }

        if (step.type === 'agent') {
          if (step.agent && !AGENT_REGISTRY[step.agent]) {
            throw new Error(`Unknown agent: ${step.agent}`);
          }
        }

        if (step.then) validateSteps(step.then);
        if (step.else) validateSteps(step.else);
        if (step.branches) validateSteps(step.branches);
      }
    };

    validateSteps(definition.steps);
  }

  checkCircularDependencies(definition: { steps: WorkflowStep[] }): void {
    const stepRefs: Record<string, Set<string>> = {};

    const collectRefs = (steps: WorkflowStep[]) => {
      for (const step of steps) {
        stepRefs[step.id] = new Set();

        if (step.input) {
          const inputStr = JSON.stringify(step.input);
          const matches = inputStr.matchAll(/\$\{steps\.([^.}]+)/g);
          for (const match of matches) {
            const referencedStep = match[1];
            const stepIndex = steps.findIndex(s => s.id === step.id);
            const refIndex = steps.findIndex(s => s.id === referencedStep);

            if (refIndex > stepIndex && refIndex !== -1) {
              throw new Error('Circular dependency detected');
            }

            stepRefs[step.id].add(referencedStep);
          }
        }

        if (step.then) collectRefs(step.then);
        if (step.else) collectRefs(step.else);
        if (step.branches) collectRefs(step.branches);
      }
    };

    collectRefs(definition.steps);

    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (stepId: string): boolean => {
      visited.add(stepId);
      recursionStack.add(stepId);

      const refs = stepRefs[stepId] || new Set();
      for (const ref of refs) {
        if (!visited.has(ref)) {
          if (hasCycle(ref)) return true;
        } else if (recursionStack.has(ref)) {
          return true;
        }
      }

      recursionStack.delete(stepId);
      return false;
    };

    for (const stepId of Object.keys(stepRefs)) {
      if (!visited.has(stepId)) {
        if (hasCycle(stepId)) {
          throw new Error('Circular dependency detected');
        }
      }
    }
  }
}

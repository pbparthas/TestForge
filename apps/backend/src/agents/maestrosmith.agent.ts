/**
 * MaestroSmith Agent
 * Generates and edits Maestro YAML flows for Flutter mobile app automation
 *
 * Uses widget registry from BankBazaar codebase (via GitLab artifact)
 * to prefer id-based selectors over text-based selectors
 */

import { BaseAgent, AgentResponse, AgentConfig } from './base.agent.js';
import { maestroService, RegistryWidget } from '../services/maestro.service.js';
import { logger } from '../utils/logger.js';

// =============================================================================
// Types
// =============================================================================

export interface MaestroFlowInput {
  inputMethod: 'test_case' | 'description';

  testCase?: {
    id?: string;
    title: string;
    steps: Array<{ order: number; action: string; expected: string }>;
    preconditions?: string;
  };

  description?: string;

  options: {
    appId: string;
    projectId: string;
    includeAssertions?: boolean;
  };
}

export interface MaestroFlowOutput {
  name: string;
  yaml: string;
  appId: string;
  commands: string[];
  warnings: string[];
}

export interface EditFlowInput {
  existingYaml: string;
  instruction: string;
  projectId: string;
  context?: {
    errorMessage?: string;
    failedCommand?: string;
  };
}

export interface EditFlowOutput {
  yaml: string;
  changes: string[];
  explanation: string;
  warnings: string[];
}

// =============================================================================
// System Prompts
// =============================================================================

const GENERATE_SYSTEM_PROMPT = `You are MaestroSmith, an expert at generating Maestro YAML flows for Flutter mobile app automation.

## Maestro Basics
- Flows are YAML files starting with appId header, then --- separator, then commands
- Maestro has built-in auto-wait - no explicit sleeps needed
- Commands are sequential, each on a new line starting with -

## Available Commands
| Command | Description | Example |
|---------|-------------|---------|
| launchApp | Start the app | - launchApp: { clearState: true } |
| tapOn | Tap element | - tapOn: { id: "login_btn" } |
| inputText | Enter text | - inputText: "hello" |
| assertVisible | Check element visible | - assertVisible: "Welcome" |
| assertNotVisible | Check element gone | - assertNotVisible: "Loading" |
| scroll | Scroll direction | - scroll: { direction: DOWN } |
| scrollUntilVisible | Scroll to find element | - scrollUntilVisible: { element: { id: "item" } } |
| swipe | Swipe gesture | - swipe: { direction: LEFT } |
| back | Android back button | - back |
| hideKeyboard | Dismiss keyboard | - hideKeyboard |
| extendedWaitUntil | Wait with timeout | - extendedWaitUntil: { visible: "X", timeout: 5000 } |
| repeat | Loop commands | - repeat: { times: 3, commands: [...] } |
| runFlow | Include sub-flow | - runFlow: { file: login.yaml } |
| takeScreenshot | Capture screen | - takeScreenshot: "step1" |
| setLocation | Mock GPS | - setLocation: { lat: 12.97, lng: 77.59 } |

## Selector Priority
1. ALWAYS prefer id-based selectors: tapOn: { id: "eventName" }
2. Only use text selectors if no id available: tapOn: "Button Text"
3. If using text selector, add warning explaining why

## Widget Registry
You will be provided with available widget identifiers (eventNames) from the app.
Match test case actions to registry eventNames when possible.

## Output Format
Return JSON:
{
  "name": "flow_name.yaml",
  "yaml": "appId: com.example.app\\n---\\n- launchApp\\n...",
  "appId": "com.example.app",
  "commands": ["launchApp", "tapOn", "inputText"],
  "warnings": ["Text-based selector used for 'Submit' - no matching eventName found"]
}`;

const EDIT_SYSTEM_PROMPT = `You are MaestroSmith, an expert at fixing and improving Maestro YAML flows.

## Guidelines
1. Understand the existing flow structure
2. Make minimal changes to address the instruction
3. Maintain YAML formatting and indentation
4. Prefer id-based selectors over text when possible
5. If error context provided, focus on fixing that specific issue

## Selector Priority
1. Use id-based selectors: tapOn: { id: "eventName" }
2. Only use text as fallback: tapOn: "Button Text"

## Output Format
Return JSON:
{
  "yaml": "# Updated flow...",
  "changes": ["Changed selector from 'Login' to id: Login"],
  "explanation": "Brief explanation of changes",
  "warnings": []
}`;

// =============================================================================
// Agent
// =============================================================================

export class MaestroSmithAgent extends BaseAgent {
  constructor(config?: AgentConfig) {
    super('MaestroSmith', config);
  }

  /**
   * Generate Maestro YAML flow from test case or description
   */
  async generate(input: MaestroFlowInput): Promise<AgentResponse<MaestroFlowOutput>> {
    const { projectId } = input.options;

    // Get registry context for prompt
    const widgets = maestroService.getWidgets(projectId);
    const registry = maestroService.getRegistry(projectId);

    const userPrompt = this.buildGeneratePrompt(input, widgets);

    const result = await this.call<MaestroFlowOutput>(
      GENERATE_SYSTEM_PROMPT,
      userPrompt,
      (text) => this.parseJSON<MaestroFlowOutput>(text)
    );

    // Validate and analyze the generated YAML
    const validation = maestroService.validateYaml(result.data.yaml);
    const selectorAnalysis = maestroService.analyzeSelectors(projectId, result.data.yaml);

    // Merge warnings from validation and selector analysis
    const allWarnings = [
      ...result.data.warnings,
      ...validation.warnings,
      ...selectorAnalysis.warnings,
    ];

    // Add registry availability warning if needed
    if (!registry) {
      allWarnings.unshift('No registry available - using text-based selectors');
    }

    result.data.warnings = [...new Set(allWarnings)]; // Dedupe warnings

    logger.info({
      agent: 'MaestroSmith',
      projectId,
      flowName: result.data.name,
      commands: result.data.commands.length,
      warnings: result.data.warnings.length,
      selectorStats: {
        total: selectorAnalysis.totalSelectors,
        idBased: selectorAnalysis.idBased,
        textBased: selectorAnalysis.textBased,
      },
    }, 'Flow generated');

    return result;
  }

  /**
   * Edit existing Maestro YAML flow
   */
  async edit(input: EditFlowInput): Promise<AgentResponse<EditFlowOutput>> {
    const { projectId } = input;

    // Get registry context for prompt
    const widgets = maestroService.getWidgets(projectId);

    const userPrompt = this.buildEditPrompt(input, widgets);

    const result = await this.call<EditFlowOutput>(
      EDIT_SYSTEM_PROMPT,
      userPrompt,
      (text) => this.parseJSON<EditFlowOutput>(text)
    );

    // Analyze selectors in edited YAML
    const selectorAnalysis = maestroService.analyzeSelectors(projectId, result.data.yaml);

    // Merge warnings
    const allWarnings = [
      ...(result.data.warnings || []),
      ...selectorAnalysis.warnings,
    ];

    result.data.warnings = [...new Set(allWarnings)];

    logger.info({
      agent: 'MaestroSmith',
      projectId,
      changesCount: result.data.changes.length,
      warnings: result.data.warnings.length,
    }, 'Flow edited');

    return result;
  }

  /**
   * Build user prompt for generate endpoint
   */
  private buildGeneratePrompt(input: MaestroFlowInput, widgets: RegistryWidget[]): string {
    const { options } = input;

    let prompt = `Generate a Maestro YAML flow for appId: ${options.appId}\n\n`;

    // Add input based on method
    if (input.inputMethod === 'test_case' && input.testCase) {
      prompt += `TEST CASE:\n`;
      prompt += `Title: ${input.testCase.title}\n`;
      if (input.testCase.preconditions) {
        prompt += `Preconditions: ${input.testCase.preconditions}\n`;
      }
      prompt += `Steps:\n`;
      for (const step of input.testCase.steps) {
        prompt += `  ${step.order}. Action: ${step.action}\n     Expected: ${step.expected}\n`;
      }
    } else if (input.inputMethod === 'description' && input.description) {
      prompt += `DESCRIPTION:\n${input.description}\n`;
    }

    // Add registry context if available
    if (widgets.length > 0) {
      prompt += `\nAvailable widget identifiers (use these for id-based selectors):\n`;
      prompt += `| eventName | file | type |\n|-----------|------|------|\n`;
      for (const widget of widgets.slice(0, 50)) { // Limit to avoid token bloat
        prompt += `| ${widget.eventName} | ${widget.file} | ${widget.type || '-'} |\n`;
      }
      if (widgets.length > 50) {
        prompt += `\n... and ${widgets.length - 50} more widgets\n`;
      }
    } else {
      prompt += `\nNote: No widget registry available. Use text-based selectors.\n`;
    }

    // Options
    prompt += `\nOPTIONS:\n`;
    prompt += `- Include assertions: ${options.includeAssertions ?? true}\n`;

    prompt += `\nReturn the flow as a JSON object with name, yaml, appId, commands, and warnings.`;

    return prompt;
  }

  /**
   * Build user prompt for edit endpoint
   */
  private buildEditPrompt(input: EditFlowInput, widgets: RegistryWidget[]): string {
    let prompt = `Edit the following Maestro YAML flow:\n\n`;
    prompt += `EXISTING YAML:\n\`\`\`yaml\n${input.existingYaml}\n\`\`\`\n\n`;
    prompt += `INSTRUCTION: ${input.instruction}\n`;

    // Add error context if provided
    if (input.context?.errorMessage) {
      prompt += `\nERROR MESSAGE: ${input.context.errorMessage}\n`;
    }
    if (input.context?.failedCommand) {
      prompt += `FAILED COMMAND: ${input.context.failedCommand}\n`;
    }

    // Add registry context if available
    if (widgets.length > 0) {
      prompt += `\nAvailable widget identifiers (use for id-based selectors):\n`;
      const relevantWidgets = widgets.slice(0, 30);
      for (const widget of relevantWidgets) {
        prompt += `- ${widget.eventName} (${widget.file})\n`;
      }
    }

    prompt += `\nReturn the updated flow as a JSON object with yaml, changes, explanation, and warnings.`;

    return prompt;
  }
}

// Export singleton instance
export const maestroSmithAgent = new MaestroSmithAgent();

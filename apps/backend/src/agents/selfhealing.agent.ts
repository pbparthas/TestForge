/**
 * Self-Healing Agent
 * Diagnoses test failures and suggests/applies fixes
 */

import { BaseAgent, AgentResponse, AgentConfig } from './base.agent.js';

export interface DiagnoseInput {
  errorMessage: string;
  errorStack?: string | undefined;
  failedCode: string;
  selector?: string | undefined;
  screenshot?: string | undefined; // Base64 encoded
  pageHtml?: string | undefined;
}

export interface DiagnoseOutput {
  diagnosis: {
    type: 'selector' | 'timing' | 'assertion' | 'network' | 'state' | 'unknown';
    confidence: number; // 0-100
    explanation: string;
  };
  rootCause: string;
  suggestedFixes: Array<{
    description: string;
    code: string;
    confidence: number;
    autoApplicable: boolean;
  }>;
  preventionTips: string[];
}

export interface FixInput {
  failedCode: string;
  diagnosis: DiagnoseOutput['diagnosis'];
  selectedFix: number; // Index of suggested fix to apply
  context?: {
    pageHtml?: string | undefined;
    availableSelectors?: string[] | undefined;
  } | undefined;
}

export interface FixOutput {
  fixedCode: string;
  changes: Array<{
    line: number;
    before: string;
    after: string;
    reason: string;
  }>;
  testNeeded: boolean;
  warnings: string[];
}

const DIAGNOSE_SYSTEM_PROMPT = `You are Self-Healing Agent, an expert at diagnosing test automation failures.

Analyze the failure and determine:
1. Root cause (selector changed, timing issue, assertion wrong, etc.)
2. Specific fix recommendations
3. Prevention strategies

Output JSON:
{
  "diagnosis": {
    "type": "selector|timing|assertion|network|state|unknown",
    "confidence": 85,
    "explanation": "The selector '#old-button' no longer exists in the DOM"
  },
  "rootCause": "Button ID changed from 'old-button' to 'submit-btn' in recent UI update",
  "suggestedFixes": [
    {
      "description": "Update selector to new ID",
      "code": "await page.click('#submit-btn')",
      "confidence": 90,
      "autoApplicable": true
    }
  ],
  "preventionTips": ["Use data-testid attributes", "Avoid brittle CSS selectors"]
}`;

const FIX_SYSTEM_PROMPT = `You are Self-Healing Agent, applying fixes to broken test code.

Apply the selected fix carefully:
1. Make minimal changes
2. Preserve code structure
3. Add comments if the fix is non-obvious
4. Flag if manual testing is recommended

Output JSON:
{
  "fixedCode": "// Full updated code",
  "changes": [
    {"line": 10, "before": "old code", "after": "new code", "reason": "Selector updated"}
  ],
  "testNeeded": true,
  "warnings": ["Verify the new selector works in all environments"]
}`;

export class SelfHealingAgent extends BaseAgent {
  constructor(config?: AgentConfig) {
    super('SelfHealingAgent', config);
  }

  async diagnose(input: DiagnoseInput): Promise<AgentResponse<DiagnoseOutput>> {
    const userPrompt = this.buildDiagnosePrompt(input);
    return this.call<DiagnoseOutput>(
      DIAGNOSE_SYSTEM_PROMPT,
      userPrompt,
      (text) => this.parseJSON<DiagnoseOutput>(text)
    );
  }

  async fix(input: FixInput): Promise<AgentResponse<FixOutput>> {
    const userPrompt = this.buildFixPrompt(input);
    return this.call<FixOutput>(
      FIX_SYSTEM_PROMPT,
      userPrompt,
      (text) => this.parseJSON<FixOutput>(text)
    );
  }

  private buildDiagnosePrompt(input: DiagnoseInput): string {
    let prompt = `Diagnose this test failure:\n\n`;
    prompt += `ERROR: ${input.errorMessage}\n`;
    if (input.errorStack) prompt += `STACK:\n${input.errorStack}\n`;
    prompt += `\nFAILED CODE:\n\`\`\`\n${input.failedCode}\n\`\`\`\n`;
    if (input.selector) prompt += `\nFAILED SELECTOR: ${input.selector}\n`;
    if (input.pageHtml) prompt += `\nPAGE HTML (excerpt):\n${input.pageHtml.substring(0, 2000)}\n`;
    return prompt;
  }

  private buildFixPrompt(input: FixInput): string {
    let prompt = `Apply fix #${input.selectedFix + 1} to this code:\n\n`;
    prompt += `DIAGNOSIS: ${input.diagnosis.type} - ${input.diagnosis.explanation}\n\n`;
    prompt += `CODE TO FIX:\n\`\`\`\n${input.failedCode}\n\`\`\`\n`;
    if (input.context?.availableSelectors?.length) {
      prompt += `\nAVAILABLE SELECTORS:\n${input.context.availableSelectors.join('\n')}\n`;
    }
    return prompt;
  }
}

export const selfHealingAgent = new SelfHealingAgent();

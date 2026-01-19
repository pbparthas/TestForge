/**
 * Recorder Agent
 * Converts browser recordings to automation scripts
 *
 * Features:
 * 1. Convert recordings to Playwright/Cypress/Selenium scripts
 * 2. Optimize/clean up recorded actions
 * 3. Add assertions to recordings
 * 4. Suggest robust element selectors
 */

import { BaseAgent, AgentResponse, AgentConfig } from './base.agent.js';
import { DeviceTarget, getDefaultDeviceTarget } from '../types/deviceTargeting.js';

// ============================================================================
// Recording Types
// ============================================================================

/**
 * Types of recorded browser actions
 */
export type RecordedActionType =
  | 'click'
  | 'dblclick'
  | 'type'
  | 'fill'
  | 'navigate'
  | 'scroll'
  | 'hover'
  | 'select'
  | 'upload'
  | 'keypress'
  | 'wait'
  | 'drag'
  | 'focus'
  | 'blur';

/**
 * Element selector with multiple strategies
 */
export interface ElementSelector {
  css?: string;
  xpath?: string;
  text?: string;
  testId?: string;
  role?: {
    name: string;
    options?: {
      name?: string;
      exact?: boolean;
    };
  };
  placeholder?: string;
  label?: string;
  alt?: string;
  title?: string;
}

/**
 * A single recorded browser action
 */
export interface RecordedAction {
  /** Unique identifier for this action */
  id: string;
  /** Action type */
  type: RecordedActionType;
  /** Timestamp when action occurred (ms since recording start) */
  timestamp: number;
  /** Target element selector(s) */
  target: ElementSelector;
  /** Value for type/fill actions, URL for navigate, key for keypress */
  value?: string;
  /** Mouse/touch coordinates */
  coordinates?: {
    x: number;
    y: number;
    clientX?: number;
    clientY?: number;
  };
  /** Additional metadata about the action */
  metadata?: {
    /** Tag name of target element */
    tagName?: string;
    /** Element text content */
    textContent?: string;
    /** Whether element is visible */
    isVisible?: boolean;
    /** Whether element is in viewport */
    isInViewport?: boolean;
    /** Element dimensions */
    boundingBox?: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    /** For file upload: file name(s) */
    fileNames?: string[];
    /** For select: option value/text */
    selectedOption?: {
      value: string;
      text: string;
    };
    /** Key modifiers (Shift, Ctrl, Alt, Meta) */
    modifiers?: string[];
    /** Frame/iframe context */
    frameId?: string;
    /** Shadow DOM path */
    shadowPath?: string[];
  };
}

/**
 * Complete browser recording
 */
export interface Recording {
  /** Unique identifier */
  id: string;
  /** Recording name/description */
  name?: string;
  /** Starting URL */
  url: string;
  /** Viewport dimensions during recording */
  viewport: {
    width: number;
    height: number;
  };
  /** Browser used for recording */
  browser: 'chromium' | 'firefox' | 'webkit' | 'chrome' | 'edge';
  /** User agent string */
  userAgent?: string;
  /** Recorded actions in chronological order */
  actions: RecordedAction[];
  /** Total recording duration in ms */
  duration: number;
  /** Recording timestamp */
  recordedAt: string;
  /** Device profile if applicable */
  deviceProfile?: DeviceTarget;
}

// ============================================================================
// Output Types
// ============================================================================

/**
 * Supported automation frameworks
 */
export type AutomationFramework = 'playwright' | 'cypress' | 'selenium';

/**
 * Supported output languages
 */
export type OutputLanguage = 'typescript' | 'javascript' | 'python' | 'java' | 'csharp';

/**
 * Options for script conversion
 */
export interface ConversionOptions {
  framework: AutomationFramework;
  language: OutputLanguage;
  /** Include Page Object Model structure */
  includePageObjects?: boolean;
  /** Base URL to use in tests */
  baseUrl?: string;
  /** Test name/description */
  testName?: string;
  /** Include comments in generated code */
  includeComments?: boolean;
  /** Selector preference order */
  selectorPreference?: ('role' | 'testid' | 'text' | 'css' | 'xpath')[];
  /** Wait strategy */
  waitStrategy?: 'minimal' | 'standard' | 'conservative';
  /** Include device emulation setup */
  includeDeviceEmulation?: boolean;
  /** Generate helper utilities */
  extractUtilities?: boolean;
  /** Add console logging */
  addLogging?: boolean;
}

/**
 * Generated automation script
 */
export interface GeneratedScript {
  /** File name for the script */
  name: string;
  /** Generated code */
  code: string;
  /** Language of generated code */
  language: OutputLanguage;
  /** Framework used */
  framework: AutomationFramework;
  /** Page Objects if generated */
  pageObjects?: Array<{
    name: string;
    code: string;
  }>;
  /** Utility functions if extracted */
  utilities?: Array<{
    name: string;
    code: string;
  }>;
  /** Required dependencies */
  dependencies: string[];
  /** Warnings or notes about the conversion */
  notes?: string[];
}

/**
 * Options for recording optimization
 */
export interface OptimizationOptions {
  /** Remove duplicate/redundant actions */
  removeDuplicates?: boolean;
  /** Merge consecutive type actions into single fill */
  mergeTypeActions?: boolean;
  /** Remove scroll actions that don't affect test */
  removeUnnecessaryScrolls?: boolean;
  /** Improve selector robustness */
  improveSelectors?: boolean;
  /** Add smart waits */
  addSmartWaits?: boolean;
  /** Collapse rapid clicks on same element */
  collapseRapidClicks?: boolean;
  /** Remove hover actions before click on same element */
  removeRedundantHovers?: boolean;
  /** Timeout threshold for combining actions (ms) */
  actionMergeThreshold?: number;
}

/**
 * Optimization suggestion
 */
export interface OptimizationSuggestion {
  /** Affected action ID(s) */
  actionIds: string[];
  /** Type of optimization */
  type: 'remove' | 'merge' | 'improve' | 'add' | 'replace';
  /** Description of the optimization */
  description: string;
  /** Priority (higher = more important) */
  priority: 'low' | 'medium' | 'high';
  /** Whether this was auto-applied */
  applied: boolean;
}

/**
 * Optimized recording result
 */
export interface OptimizedRecording {
  /** The optimized recording */
  recording: Recording;
  /** Actions that were removed */
  removedActions: RecordedAction[];
  /** Actions that were modified */
  modifiedActions: Array<{
    original: RecordedAction;
    modified: RecordedAction;
    reason: string;
  }>;
  /** Actions that were added */
  addedActions: RecordedAction[];
  /** Optimization suggestions (applied and not applied) */
  suggestions: OptimizationSuggestion[];
  /** Summary statistics */
  summary: {
    originalActionCount: number;
    optimizedActionCount: number;
    removedCount: number;
    modifiedCount: number;
    addedCount: number;
    estimatedTimeReduction: number; // percentage
  };
}

/**
 * Types of assertions
 */
export type AssertionType =
  | 'visible'
  | 'hidden'
  | 'enabled'
  | 'disabled'
  | 'checked'
  | 'unchecked'
  | 'text'
  | 'value'
  | 'attribute'
  | 'url'
  | 'title'
  | 'count'
  | 'screenshot';

/**
 * Assertion hint for AI
 */
export interface AssertionHint {
  /** Action ID to add assertion after */
  afterActionId?: string;
  /** Type of assertion to add */
  type?: AssertionType;
  /** Description of what to assert */
  description?: string;
  /** Expected value for comparison assertions */
  expectedValue?: string;
}

/**
 * Generated assertion
 */
export interface GeneratedAssertion {
  /** Where to insert (after which action ID) */
  afterActionId: string;
  /** Type of assertion */
  type: AssertionType;
  /** Target element selector */
  target?: ElementSelector;
  /** Expected value */
  expectedValue?: string;
  /** Assertion description */
  description: string;
  /** Confidence score (0-1) */
  confidence: number;
  /** Generated code for the assertion */
  code: {
    playwright?: string;
    cypress?: string;
    selenium?: string;
  };
}

/**
 * Result of assertion generation
 */
export interface AssertionResult {
  /** Generated assertions */
  assertions: GeneratedAssertion[];
  /** Summary */
  summary: {
    total: number;
    byType: Record<AssertionType, number>;
    averageConfidence: number;
  };
  /** The recording with assertions added as pseudo-actions */
  enhancedRecording?: Recording;
}

/**
 * Selector suggestion
 */
export interface SelectorSuggestion {
  /** Selector strategy */
  strategy: 'role' | 'testid' | 'text' | 'css' | 'xpath' | 'label' | 'placeholder';
  /** Selector value */
  value: string;
  /** Full selector code for different frameworks */
  code: {
    playwright: string;
    cypress: string;
    selenium: string;
  };
  /** Robustness score (0-1) */
  robustness: number;
  /** Maintainability score (0-1) */
  maintainability: number;
  /** Uniqueness - whether this selector matches only one element */
  isUnique: boolean;
  /** Reasoning for this suggestion */
  reasoning: string;
}

/**
 * Element info for selector suggestion
 */
export interface ElementInfo {
  /** Current selector */
  currentSelector: ElementSelector;
  /** HTML of the element */
  html?: string;
  /** Element attributes */
  attributes?: Record<string, string>;
  /** Surrounding HTML context */
  context?: string;
  /** Page URL */
  pageUrl?: string;
}

/**
 * Result of selector suggestion
 */
export interface SelectorSuggestionResult {
  /** Ranked selector suggestions */
  suggestions: SelectorSuggestion[];
  /** Recommended selector (best balance) */
  recommended: SelectorSuggestion;
  /** Analysis of the element */
  analysis: {
    hasTestId: boolean;
    hasAriaLabel: boolean;
    hasUniqueText: boolean;
    isInteractive: boolean;
    isInForm: boolean;
    nestingLevel: number;
  };
}

// ============================================================================
// System Prompts
// ============================================================================

const CONVERT_SYSTEM_PROMPT = `You are RecorderAgent, an expert at converting browser recordings into clean, maintainable automation scripts.

Your expertise:
1. Converting raw recordings to Playwright, Cypress, and Selenium scripts
2. Choosing optimal selectors for stability
3. Adding appropriate waits and error handling
4. Generating clean, readable code

Guidelines:
- Use the most stable selector strategy available (prefer: role > testid > text > css > xpath)
- Add appropriate waits for dynamic content
- Include meaningful comments explaining each step
- Follow framework best practices
- Handle common edge cases (loading states, animations)
- Generate proper async/await patterns for Playwright
- Use proper chaining for Cypress
- Include proper imports and setup

Wait Strategies:
- minimal: Only waitForLoadState, avoid explicit waits
- standard: Balanced waits with reasonable timeouts
- conservative: Extra waits for slow/flaky applications

Selector Preferences:
- role: Use getByRole() for accessibility
- testid: Use getByTestId() for stability
- text: Use getByText() for readability
- css: Use CSS selectors when specific styling needed
- xpath: Use XPath for complex DOM navigation

Output Format:
Return a JSON object:
{
  "name": "test-name.spec.ts",
  "code": "// Full test code",
  "language": "typescript",
  "framework": "playwright",
  "pageObjects": [{"name": "PageName", "code": "// Page object code"}],
  "utilities": [{"name": "helper", "code": "// Utility code"}],
  "dependencies": ["@playwright/test"],
  "notes": ["Note about flaky selector on line 15"]
}`;

const OPTIMIZE_SYSTEM_PROMPT = `You are RecorderAgent, an expert at optimizing browser recordings for cleaner, more reliable test scripts.

Your optimization goals:
1. Remove redundant/unnecessary actions
2. Merge related actions (consecutive types, rapid clicks)
3. Improve selector robustness
4. Add smart waits where needed
5. Simplify complex action sequences

Optimization types:
- remove: Delete unnecessary actions (redundant scrolls, double events)
- merge: Combine related actions (type + type = fill)
- improve: Enhance selectors or add waits
- add: Insert missing waits or setup steps
- replace: Swap action for better alternative

Analysis approach:
1. Identify patterns in the recording
2. Flag rapid sequential actions on same element
3. Detect navigation-related waits needed
4. Find brittle selectors that need improvement
5. Remove actions that don't affect test outcome

Output Format:
Return a JSON object:
{
  "recording": { /* optimized recording object */ },
  "removedActions": [/* removed actions */],
  "modifiedActions": [
    {"original": {...}, "modified": {...}, "reason": "explanation"}
  ],
  "addedActions": [/* added wait actions, etc */],
  "suggestions": [
    {
      "actionIds": ["id1", "id2"],
      "type": "merge",
      "description": "Merged consecutive type actions",
      "priority": "medium",
      "applied": true
    }
  ],
  "summary": {
    "originalActionCount": 25,
    "optimizedActionCount": 18,
    "removedCount": 7,
    "modifiedCount": 3,
    "addedCount": 0,
    "estimatedTimeReduction": 15
  }
}`;

const ASSERTION_SYSTEM_PROMPT = `You are RecorderAgent, an expert at adding meaningful assertions to browser recordings.

Your assertion expertise:
1. Identifying key verification points in user flows
2. Suggesting appropriate assertion types
3. Determining assertion placement for maximum coverage
4. Balancing thoroughness with test speed

Assertion Types:
- visible: Element is visible on page
- hidden: Element is not visible
- enabled: Element is enabled/interactive
- disabled: Element is disabled
- checked: Checkbox/radio is checked
- unchecked: Checkbox/radio is unchecked
- text: Element contains expected text
- value: Input has expected value
- attribute: Element has expected attribute
- url: Page URL matches expected
- title: Page title matches expected
- count: Number of matching elements
- screenshot: Visual snapshot comparison

When to add assertions:
- After navigation: verify page load (url, title, key element visible)
- After form submit: verify success message or redirect
- After click on toggle: verify state change
- After input: verify value is set (for critical fields)
- After selection: verify selected option
- At flow end: verify final state

Confidence scoring:
- 0.9+: Essential assertion, high certainty
- 0.7-0.9: Recommended assertion, good confidence
- 0.5-0.7: Optional assertion, moderate confidence
- <0.5: Possible assertion, low confidence

Output Format:
Return a JSON object:
{
  "assertions": [
    {
      "afterActionId": "action-id",
      "type": "visible",
      "target": {"css": ".success-message"},
      "expectedValue": null,
      "description": "Verify success message appears after form submit",
      "confidence": 0.95,
      "code": {
        "playwright": "await expect(page.locator('.success-message')).toBeVisible();",
        "cypress": "cy.get('.success-message').should('be.visible');",
        "selenium": "wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '.success-message')))"
      }
    }
  ],
  "summary": {
    "total": 5,
    "byType": {"visible": 3, "url": 1, "text": 1},
    "averageConfidence": 0.85
  }
}`;

const SELECTOR_SYSTEM_PROMPT = `You are RecorderAgent, an expert at suggesting robust, maintainable element selectors.

Your selector expertise:
1. Analyzing element characteristics for optimal selection
2. Evaluating selector strategies for robustness
3. Predicting selector stability over time
4. Framework-specific selector syntax

Selector Strategy Priority:
1. role: Best for accessibility, most stable ("getByRole('button', { name: 'Submit' })")
2. testid: Excellent stability, requires attribute ("getByTestId('submit-btn')")
3. label: Good for form fields ("getByLabel('Email')")
4. placeholder: Good for inputs ("getByPlaceholder('Enter email')")
5. text: Good for buttons/links ("getByText('Click me')")
6. css: Flexible, moderate stability (".btn-primary")
7. xpath: Powerful but often brittle ("//button[@type='submit']")

Robustness factors:
- Semantic selectors (role, label) > structural (css, xpath)
- Data attributes (testid) > class names
- Unique text content > partial matches
- Single attribute > chained attributes
- Shallow nesting > deep nesting

Maintainability factors:
- Readable > terse
- Intent-clear > implementation-specific
- Framework-native > workarounds

Output Format:
Return a JSON object:
{
  "suggestions": [
    {
      "strategy": "role",
      "value": "button[name='Submit']",
      "code": {
        "playwright": "page.getByRole('button', { name: 'Submit' })",
        "cypress": "cy.findByRole('button', { name: 'Submit' })",
        "selenium": "driver.find_element(By.XPATH, \"//button[text()='Submit']\")"
      },
      "robustness": 0.95,
      "maintainability": 0.90,
      "isUnique": true,
      "reasoning": "Uses semantic role with unique accessible name"
    }
  ],
  "recommended": { /* best suggestion */ },
  "analysis": {
    "hasTestId": false,
    "hasAriaLabel": true,
    "hasUniqueText": true,
    "isInteractive": true,
    "isInForm": true,
    "nestingLevel": 3
  }
}`;

// ============================================================================
// RecorderAgent Class
// ============================================================================

export class RecorderAgent extends BaseAgent {
  constructor(config?: AgentConfig) {
    super('RecorderAgent', config);
  }

  /**
   * Convert a browser recording to an automation script
   */
  async convertToScript(
    recording: Recording,
    options: ConversionOptions
  ): Promise<AgentResponse<GeneratedScript>> {
    const userPrompt = this.buildConvertPrompt(recording, options);
    return this.call<GeneratedScript>(
      CONVERT_SYSTEM_PROMPT,
      userPrompt,
      (text) => this.parseJSON<GeneratedScript>(text)
    );
  }

  /**
   * Optimize a recording by removing redundant actions and improving selectors
   */
  async optimizeRecording(
    recording: Recording,
    options?: OptimizationOptions
  ): Promise<AgentResponse<OptimizedRecording>> {
    const effectiveOptions: OptimizationOptions = {
      removeDuplicates: true,
      mergeTypeActions: true,
      removeUnnecessaryScrolls: true,
      improveSelectors: true,
      addSmartWaits: true,
      collapseRapidClicks: true,
      removeRedundantHovers: true,
      actionMergeThreshold: 500,
      ...options,
    };

    const userPrompt = this.buildOptimizePrompt(recording, effectiveOptions);
    return this.call<OptimizedRecording>(
      OPTIMIZE_SYSTEM_PROMPT,
      userPrompt,
      (text) => this.parseJSON<OptimizedRecording>(text)
    );
  }

  /**
   * Add assertions to a recording based on the actions and optional hints
   */
  async addAssertions(
    recording: Recording,
    hints?: AssertionHint[]
  ): Promise<AgentResponse<AssertionResult>> {
    const userPrompt = this.buildAssertionPrompt(recording, hints);
    return this.call<AssertionResult>(
      ASSERTION_SYSTEM_PROMPT,
      userPrompt,
      (text) => this.parseJSON<AssertionResult>(text)
    );
  }

  /**
   * Suggest robust selectors for an element
   */
  async suggestSelectors(
    element: ElementInfo
  ): Promise<AgentResponse<SelectorSuggestionResult>> {
    const userPrompt = this.buildSelectorPrompt(element);
    return this.call<SelectorSuggestionResult>(
      SELECTOR_SYSTEM_PROMPT,
      userPrompt,
      (text) => this.parseJSON<SelectorSuggestionResult>(text)
    );
  }

  /**
   * Full pipeline: optimize recording, add assertions, then convert to script
   */
  async processRecording(
    recording: Recording,
    options: {
      conversion: ConversionOptions;
      optimization?: OptimizationOptions;
      assertionHints?: AssertionHint[];
      skipOptimization?: boolean;
      skipAssertions?: boolean;
    }
  ): Promise<AgentResponse<{
    script: GeneratedScript;
    optimization?: OptimizedRecording | undefined;
    assertions?: AssertionResult | undefined;
  }>> {
    const startTime = Date.now();
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCostUsd = 0;
    let totalCostInr = 0;

    let processedRecording = recording;
    let optimizationResult: OptimizedRecording | undefined;
    let assertionResult: AssertionResult | undefined;

    // Step 1: Optimize recording
    if (!options.skipOptimization) {
      const optResult = await this.optimizeRecording(recording, options.optimization);
      optimizationResult = optResult.data;
      processedRecording = optResult.data.recording;
      totalInputTokens += optResult.usage.inputTokens;
      totalOutputTokens += optResult.usage.outputTokens;
      totalCostUsd += optResult.usage.costUsd;
      totalCostInr += optResult.usage.costInr;
    }

    // Step 2: Add assertions
    if (!options.skipAssertions) {
      const assertResult = await this.addAssertions(processedRecording, options.assertionHints);
      assertionResult = assertResult.data;
      totalInputTokens += assertResult.usage.inputTokens;
      totalOutputTokens += assertResult.usage.outputTokens;
      totalCostUsd += assertResult.usage.costUsd;
      totalCostInr += assertResult.usage.costInr;

      // Use enhanced recording if available
      if (assertResult.data.enhancedRecording) {
        processedRecording = assertResult.data.enhancedRecording;
      }
    }

    // Step 3: Convert to script
    const scriptResult = await this.convertToScript(processedRecording, options.conversion);
    totalInputTokens += scriptResult.usage.inputTokens;
    totalOutputTokens += scriptResult.usage.outputTokens;
    totalCostUsd += scriptResult.usage.costUsd;
    totalCostInr += scriptResult.usage.costInr;

    const durationMs = Date.now() - startTime;

    return {
      data: {
        script: scriptResult.data,
        optimization: optimizationResult,
        assertions: assertionResult,
      },
      usage: {
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        cacheReadTokens: 0,
        cacheCreationTokens: 0,
        costUsd: totalCostUsd,
        costInr: totalCostInr,
        model: this.config.model,
        durationMs,
      },
    };
  }

  // ============================================================================
  // Private Prompt Builders
  // ============================================================================

  private buildConvertPrompt(recording: Recording, options: ConversionOptions): string {
    const deviceTarget = recording.deviceProfile ?? getDefaultDeviceTarget();
    const selectorPref = options.selectorPreference ?? ['role', 'testid', 'text', 'css'];
    const waitStrategy = options.waitStrategy ?? 'standard';

    let prompt = `Convert the following browser recording to a ${options.framework} test script in ${options.language}.\n\n`;

    // Recording metadata
    prompt += `RECORDING METADATA:\n`;
    prompt += `- URL: ${recording.url}\n`;
    prompt += `- Browser: ${recording.browser}\n`;
    prompt += `- Viewport: ${recording.viewport.width}x${recording.viewport.height}\n`;
    prompt += `- Duration: ${recording.duration}ms\n`;
    prompt += `- Action count: ${recording.actions.length}\n`;
    if (recording.name) {
      prompt += `- Name: ${recording.name}\n`;
    }
    prompt += `\n`;

    // Device targeting
    prompt += `DEVICE CONTEXT:\n`;
    prompt += `- Type: ${deviceTarget.type}\n`;
    prompt += `- Viewport: ${deviceTarget.viewport.width}x${deviceTarget.viewport.height}\n`;
    if (deviceTarget.deviceName) {
      prompt += `- Device: ${deviceTarget.deviceName}\n`;
    }
    if (deviceTarget.isTouchEnabled) {
      prompt += `- Touch enabled: yes\n`;
    }
    prompt += `\n`;

    // Conversion options
    prompt += `CONVERSION OPTIONS:\n`;
    prompt += `- Framework: ${options.framework}\n`;
    prompt += `- Language: ${options.language}\n`;
    prompt += `- Test name: ${options.testName ?? 'Recorded Test'}\n`;
    prompt += `- Include Page Objects: ${options.includePageObjects ?? false}\n`;
    prompt += `- Include comments: ${options.includeComments ?? true}\n`;
    prompt += `- Selector preference: ${selectorPref.join(' > ')}\n`;
    prompt += `- Wait strategy: ${waitStrategy}\n`;
    if (options.baseUrl) {
      prompt += `- Base URL: ${options.baseUrl}\n`;
    }
    if (options.includeDeviceEmulation) {
      prompt += `- Include device emulation setup: yes\n`;
    }
    if (options.extractUtilities) {
      prompt += `- Extract reusable utilities: yes\n`;
    }
    if (options.addLogging) {
      prompt += `- Add console logging: yes\n`;
    }
    prompt += `\n`;

    // Actions
    prompt += `RECORDED ACTIONS:\n`;
    prompt += JSON.stringify(recording.actions, null, 2);
    prompt += `\n\n`;

    prompt += `Convert this recording to a clean, maintainable test script. Return as JSON.`;

    return prompt;
  }

  private buildOptimizePrompt(recording: Recording, options: OptimizationOptions): string {
    let prompt = `Optimize the following browser recording.\n\n`;

    // Recording metadata
    prompt += `RECORDING:\n`;
    prompt += `- URL: ${recording.url}\n`;
    prompt += `- Action count: ${recording.actions.length}\n`;
    prompt += `- Duration: ${recording.duration}ms\n\n`;

    // Optimization options
    prompt += `OPTIMIZATION OPTIONS:\n`;
    prompt += `- Remove duplicates: ${options.removeDuplicates ?? true}\n`;
    prompt += `- Merge type actions: ${options.mergeTypeActions ?? true}\n`;
    prompt += `- Remove unnecessary scrolls: ${options.removeUnnecessaryScrolls ?? true}\n`;
    prompt += `- Improve selectors: ${options.improveSelectors ?? true}\n`;
    prompt += `- Add smart waits: ${options.addSmartWaits ?? true}\n`;
    prompt += `- Collapse rapid clicks: ${options.collapseRapidClicks ?? true}\n`;
    prompt += `- Remove redundant hovers: ${options.removeRedundantHovers ?? true}\n`;
    prompt += `- Action merge threshold: ${options.actionMergeThreshold ?? 500}ms\n\n`;

    // Full recording
    prompt += `FULL RECORDING:\n`;
    prompt += JSON.stringify(recording, null, 2);
    prompt += `\n\n`;

    prompt += `Analyze and optimize this recording. Return the optimized recording with all changes documented as JSON.`;

    return prompt;
  }

  private buildAssertionPrompt(recording: Recording, hints?: AssertionHint[]): string {
    let prompt = `Add assertions to the following browser recording.\n\n`;

    // Recording context
    prompt += `RECORDING CONTEXT:\n`;
    prompt += `- URL: ${recording.url}\n`;
    prompt += `- Action count: ${recording.actions.length}\n`;
    prompt += `- Flow duration: ${recording.duration}ms\n\n`;

    // Hints if provided
    if (hints && hints.length > 0) {
      prompt += `ASSERTION HINTS (user-provided):\n`;
      hints.forEach((hint, i) => {
        prompt += `${i + 1}. `;
        if (hint.afterActionId) {
          prompt += `After action "${hint.afterActionId}": `;
        }
        if (hint.type) {
          prompt += `Type: ${hint.type}, `;
        }
        if (hint.description) {
          prompt += `${hint.description}`;
        }
        if (hint.expectedValue) {
          prompt += ` (expected: "${hint.expectedValue}")`;
        }
        prompt += `\n`;
      });
      prompt += `\n`;
    }

    // Actions
    prompt += `RECORDED ACTIONS:\n`;
    prompt += JSON.stringify(recording.actions, null, 2);
    prompt += `\n\n`;

    prompt += `Analyze this recording and suggest assertions at appropriate points. Generate assertion code for Playwright, Cypress, and Selenium. Return as JSON.`;

    return prompt;
  }

  private buildSelectorPrompt(element: ElementInfo): string {
    let prompt = `Suggest robust selectors for the following element.\n\n`;

    // Current selector
    prompt += `CURRENT SELECTOR:\n`;
    prompt += JSON.stringify(element.currentSelector, null, 2);
    prompt += `\n\n`;

    // Element HTML
    if (element.html) {
      prompt += `ELEMENT HTML:\n`;
      prompt += `${element.html}\n\n`;
    }

    // Attributes
    if (element.attributes && Object.keys(element.attributes).length > 0) {
      prompt += `ELEMENT ATTRIBUTES:\n`;
      prompt += JSON.stringify(element.attributes, null, 2);
      prompt += `\n\n`;
    }

    // Context
    if (element.context) {
      prompt += `SURROUNDING HTML CONTEXT:\n`;
      prompt += `${element.context}\n\n`;
    }

    // Page URL
    if (element.pageUrl) {
      prompt += `PAGE URL: ${element.pageUrl}\n\n`;
    }

    prompt += `Analyze this element and suggest multiple selector strategies ranked by robustness and maintainability. Return as JSON.`;

    return prompt;
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const recorderAgent = new RecorderAgent();

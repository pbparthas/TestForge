/**
 * VisualAnalysis Agent
 * Uses Claude Vision for visual regression testing and UI element detection
 */

import { BaseAgent, AgentResponse, AgentConfig, MessageContent } from './base.agent.js';

// ============================================================================
// Region and Bounding Box Types
// ============================================================================

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface IgnoreRegion {
  /** Region bounding box */
  box: BoundingBox;
  /** Reason for ignoring this region */
  reason: string;
  /** Type of content being ignored */
  type: 'dynamic' | 'ad' | 'timestamp' | 'animation' | 'user-content' | 'custom';
}

// ============================================================================
// Screenshot Input Types
// ============================================================================

export interface ScreenshotInput {
  /** Base64 encoded image data */
  base64: string;
  /** Image media type */
  mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
  /** Optional metadata about the screenshot */
  metadata?: {
    url?: string;
    viewport?: { width: number; height: number };
    devicePixelRatio?: number;
    timestamp?: string;
    browser?: string;
    platform?: string;
  };
}

// ============================================================================
// Compare Method Types
// ============================================================================

export type DifferenceSeverity = 'low' | 'medium' | 'high' | 'critical';
export type DifferenceCategory =
  | 'layout'
  | 'color'
  | 'typography'
  | 'spacing'
  | 'content'
  | 'visibility'
  | 'size'
  | 'position'
  | 'missing'
  | 'added';

export interface VisualDifference {
  /** Unique identifier for this difference */
  id: string;
  /** Category of the difference */
  category: DifferenceCategory;
  /** Severity level */
  severity: DifferenceSeverity;
  /** Human-readable description of the difference */
  description: string;
  /** Location in the baseline image */
  baselineRegion?: BoundingBox;
  /** Location in the current image */
  currentRegion?: BoundingBox;
  /** Confidence score (0-1) that this is a real difference */
  confidence: number;
  /** Suggested fix or action */
  suggestion?: string;
}

export interface CompareInput {
  /** Baseline screenshot (expected) */
  baseline: ScreenshotInput;
  /** Current screenshot (actual) */
  current: ScreenshotInput;
  /** Regions to ignore during comparison */
  ignoreRegions?: IgnoreRegion[];
  /** Sensitivity threshold (0-1, lower = more sensitive) */
  sensitivity?: number;
  /** Categories of differences to detect */
  categories?: DifferenceCategory[];
  /** Context about what is being compared */
  context?: string;
}

export interface CompareOutput {
  /** Whether the images match (within tolerance) */
  match: boolean;
  /** Overall similarity score (0-1) */
  similarityScore: number;
  /** List of detected differences */
  differences: VisualDifference[];
  /** Summary of findings */
  summary: {
    totalDifferences: number;
    bySeverity: Record<DifferenceSeverity, number>;
    byCategory: Record<string, number>;
    criticalCount: number;
  };
  /** Overall recommendation */
  recommendation: 'pass' | 'review' | 'fail';
  /** Detailed analysis notes */
  analysisNotes: string;
}

// ============================================================================
// AnalyzeRegression Method Types
// ============================================================================

export type RegressionType =
  | 'intentional_change'
  | 'regression'
  | 'environment_difference'
  | 'data_difference'
  | 'timing_issue'
  | 'unknown';

export interface RegressionAnalysisInput {
  /** The visual difference to analyze */
  difference: VisualDifference;
  /** Baseline screenshot */
  baseline: ScreenshotInput;
  /** Current screenshot */
  current: ScreenshotInput;
  /** Additional context (PR description, commit message, etc.) */
  changeContext?: string;
  /** Recent changes that might be relevant */
  recentChanges?: string[];
  /** History of similar differences */
  historicalContext?: string;
}

export interface RegressionAnalysisOutput {
  /** Determined type of the difference */
  type: RegressionType;
  /** Confidence in the classification (0-1) */
  confidence: number;
  /** Detailed reasoning for the classification */
  reasoning: string;
  /** Whether this should be flagged for human review */
  requiresHumanReview: boolean;
  /** Suggested action */
  suggestedAction: 'accept' | 'reject' | 'investigate' | 'update_baseline';
  /** Impact assessment */
  impact: {
    userExperience: 'none' | 'minor' | 'moderate' | 'major';
    functionality: 'none' | 'minor' | 'moderate' | 'major';
    accessibility: 'none' | 'minor' | 'moderate' | 'major';
  };
  /** Related areas that might be affected */
  relatedAreas?: string[];
}

// ============================================================================
// DetectElements Method Types
// ============================================================================

export type UIElementType =
  | 'button'
  | 'input'
  | 'text'
  | 'link'
  | 'image'
  | 'icon'
  | 'checkbox'
  | 'radio'
  | 'dropdown'
  | 'toggle'
  | 'slider'
  | 'tab'
  | 'menu'
  | 'modal'
  | 'card'
  | 'list'
  | 'table'
  | 'form'
  | 'navigation'
  | 'header'
  | 'footer'
  | 'container'
  | 'unknown';

export interface DetectedElement {
  /** Element type */
  type: UIElementType;
  /** Bounding box location */
  boundingBox: BoundingBox;
  /** Confidence score (0-1) */
  confidence: number;
  /** Visible text content (if any) */
  text?: string;
  /** Detected state */
  state?: 'default' | 'hover' | 'active' | 'disabled' | 'focused' | 'error';
  /** Accessibility attributes detected */
  accessibility?: {
    hasLabel: boolean;
    suggestedLabel?: string;
    role?: string;
    issues?: string[];
  };
  /** Suggested test selector */
  suggestedSelector?: string;
  /** Suggested test action */
  suggestedAction?: string;
  /** Nested or related elements */
  children?: DetectedElement[];
}

export interface DetectElementsInput {
  /** Screenshot to analyze */
  screenshot: ScreenshotInput;
  /** Types of elements to detect (all if not specified) */
  elementTypes?: UIElementType[];
  /** Minimum confidence threshold (0-1) */
  minConfidence?: number;
  /** Whether to detect nested elements */
  detectNested?: boolean;
  /** Context about the page */
  context?: string;
}

export interface DetectElementsOutput {
  /** Detected elements */
  elements: DetectedElement[];
  /** Page structure analysis */
  pageStructure: {
    hasHeader: boolean;
    hasFooter: boolean;
    hasNavigation: boolean;
    hasSidebar: boolean;
    mainContentArea?: BoundingBox;
  };
  /** Summary statistics */
  summary: {
    totalElements: number;
    byType: Record<string, number>;
    averageConfidence: number;
    accessibilityIssues: number;
  };
  /** Overall page description */
  pageDescription: string;
}

// ============================================================================
// GenerateVisualTestCase Method Types
// ============================================================================

export interface VisualTestAssertion {
  /** Assertion type */
  type: 'exists' | 'visible' | 'position' | 'size' | 'style' | 'content' | 'screenshot';
  /** Target element or region */
  target: {
    selector?: string;
    region?: BoundingBox;
    elementDescription?: string;
  };
  /** Expected value or condition */
  expected: string;
  /** Tolerance for comparison (if applicable) */
  tolerance?: number;
}

export interface VisualTestStep {
  /** Step order */
  order: number;
  /** Action to perform */
  action: string;
  /** Selector or target */
  target?: string;
  /** Input data (if any) */
  data?: string;
  /** Visual assertions after this step */
  visualAssertions: VisualTestAssertion[];
  /** Wait condition before assertions */
  waitCondition?: string;
}

export interface GeneratedVisualTestCase {
  /** Test title */
  title: string;
  /** Test description */
  description: string;
  /** Preconditions */
  preconditions: string;
  /** Test steps with visual assertions */
  steps: VisualTestStep[];
  /** Expected final visual state */
  expectedVisualState: string;
  /** Priority */
  priority: 'low' | 'medium' | 'high' | 'critical';
  /** Test type */
  type: 'visual' | 'visual-regression' | 'layout' | 'responsive';
  /** Tags for categorization */
  tags: string[];
  /** Regions to capture for baseline */
  baselineRegions?: Array<{
    name: string;
    region: BoundingBox;
    tolerance: number;
  }>;
  /** Viewport sizes to test */
  viewports?: Array<{ width: number; height: number; name: string }>;
}

export interface GenerateVisualTestCaseInput {
  /** Baseline screenshot */
  screenshot: ScreenshotInput;
  /** Detected elements (optional, will detect if not provided) */
  elements?: DetectedElement[];
  /** Feature or flow being tested */
  feature?: string;
  /** Test focus areas */
  focusAreas?: string[];
  /** Include responsive testing */
  includeResponsive?: boolean;
  /** Maximum test cases to generate */
  maxTestCases?: number;
  /** Test types to generate */
  testTypes?: ('visual' | 'visual-regression' | 'layout' | 'responsive')[];
}

export interface GenerateVisualTestCaseOutput {
  /** Generated test cases */
  testCases: GeneratedVisualTestCase[];
  /** Summary */
  summary: {
    total: number;
    byPriority: Record<string, number>;
    byType: Record<string, number>;
    totalAssertions: number;
  };
  /** Recommended baseline configuration */
  baselineConfig: {
    captureFullPage: boolean;
    regions: Array<{ name: string; selector: string; tolerance: number }>;
    ignoreRegions: Array<{ reason: string; selector: string }>;
  };
}

// ============================================================================
// System Prompts
// ============================================================================

const COMPARE_SYSTEM_PROMPT = `You are VisualAnalysis, an expert visual regression testing agent powered by Claude Vision. Your role is to compare two screenshots (baseline vs current) and identify visual differences.

Guidelines:
1. Analyze both images pixel-by-pixel conceptually
2. Identify differences in layout, colors, typography, spacing, content, and positioning
3. Classify each difference by severity:
   - critical: Functionality is broken or major UI elements missing
   - high: Significant visual issues affecting user experience
   - medium: Noticeable differences that may need attention
   - low: Minor cosmetic differences
4. Assign confidence scores based on how certain you are about each difference
5. Consider ignore regions - do not report differences in those areas
6. Provide actionable recommendations

Output Format:
Return a JSON object with this structure:
{
  "match": false,
  "similarityScore": 0.85,
  "differences": [
    {
      "id": "diff-1",
      "category": "layout",
      "severity": "high",
      "description": "Button moved 20px to the right",
      "baselineRegion": {"x": 100, "y": 200, "width": 80, "height": 40},
      "currentRegion": {"x": 120, "y": 200, "width": 80, "height": 40},
      "confidence": 0.95,
      "suggestion": "Check if layout change was intentional"
    }
  ],
  "summary": {
    "totalDifferences": 1,
    "bySeverity": {"critical": 0, "high": 1, "medium": 0, "low": 0},
    "byCategory": {"layout": 1},
    "criticalCount": 0
  },
  "recommendation": "review",
  "analysisNotes": "One significant layout change detected..."
}`;

const ANALYZE_REGRESSION_SYSTEM_PROMPT = `You are VisualAnalysis, an expert at determining whether visual differences are regressions or intentional changes.

Guidelines:
1. Analyze the specific difference in context of both screenshots
2. Consider any provided change context (PR descriptions, commit messages)
3. Classify the difference type:
   - intentional_change: Part of expected updates
   - regression: Unintended visual break
   - environment_difference: Due to different test environments
   - data_difference: Different data causing visual change
   - timing_issue: Animation or loading state captured differently
   - unknown: Cannot determine with confidence
4. Assess impact on user experience, functionality, and accessibility
5. Recommend appropriate action

Output Format:
Return a JSON object with this structure:
{
  "type": "regression",
  "confidence": 0.85,
  "reasoning": "The button color change doesn't align with any recent style updates...",
  "requiresHumanReview": true,
  "suggestedAction": "investigate",
  "impact": {
    "userExperience": "minor",
    "functionality": "none",
    "accessibility": "minor"
  },
  "relatedAreas": ["Header navigation", "CTA buttons"]
}`;

const DETECT_ELEMENTS_SYSTEM_PROMPT = `You are VisualAnalysis, an expert at detecting and classifying UI elements from screenshots.

Guidelines:
1. Identify all interactive elements (buttons, inputs, links, etc.)
2. Identify structural elements (headers, footers, navigation, cards, etc.)
3. Provide accurate bounding box coordinates
4. Assess accessibility attributes and issues
5. Suggest test selectors and actions
6. Identify element states (default, hover, disabled, etc.)
7. Detect nested elements when requested

Output Format:
Return a JSON object with this structure:
{
  "elements": [
    {
      "type": "button",
      "boundingBox": {"x": 100, "y": 200, "width": 80, "height": 40},
      "confidence": 0.95,
      "text": "Submit",
      "state": "default",
      "accessibility": {
        "hasLabel": true,
        "suggestedLabel": "Submit form",
        "role": "button",
        "issues": []
      },
      "suggestedSelector": "[data-testid='submit-btn']",
      "suggestedAction": "click"
    }
  ],
  "pageStructure": {
    "hasHeader": true,
    "hasFooter": true,
    "hasNavigation": true,
    "hasSidebar": false,
    "mainContentArea": {"x": 0, "y": 80, "width": 1200, "height": 600}
  },
  "summary": {
    "totalElements": 15,
    "byType": {"button": 3, "input": 4, "link": 8},
    "averageConfidence": 0.92,
    "accessibilityIssues": 2
  },
  "pageDescription": "Login page with email/password form and social login options"
}`;

const GENERATE_VISUAL_TEST_SYSTEM_PROMPT = `You are VisualAnalysis, an expert at generating visual test cases from screenshots.

Guidelines:
1. Analyze the screenshot to understand the UI structure and purpose
2. Generate comprehensive visual test cases covering:
   - Element presence and visibility
   - Layout and positioning
   - Content and text
   - Visual consistency
   - Responsive behavior (if requested)
3. Include specific visual assertions for each step
4. Define baseline regions with appropriate tolerances
5. Suggest ignore regions for dynamic content
6. Prioritize based on visual importance and user impact

Output Format:
Return a JSON object with this structure:
{
  "testCases": [
    {
      "title": "Verify login form visual layout",
      "description": "Ensures the login form elements are properly positioned and styled",
      "preconditions": "User is on the login page, not authenticated",
      "steps": [
        {
          "order": 1,
          "action": "Navigate to login page",
          "target": "/login",
          "visualAssertions": [
            {
              "type": "exists",
              "target": {"selector": "[data-testid='login-form']"},
              "expected": "Login form is visible"
            }
          ],
          "waitCondition": "networkIdle"
        }
      ],
      "expectedVisualState": "Clean login form with email, password fields and submit button",
      "priority": "high",
      "type": "visual",
      "tags": ["login", "form", "visual"],
      "baselineRegions": [
        {"name": "login-form", "region": {"x": 400, "y": 200, "width": 400, "height": 300}, "tolerance": 0.02}
      ],
      "viewports": [
        {"width": 1920, "height": 1080, "name": "desktop"},
        {"width": 375, "height": 667, "name": "mobile"}
      ]
    }
  ],
  "summary": {
    "total": 3,
    "byPriority": {"high": 2, "medium": 1},
    "byType": {"visual": 2, "layout": 1},
    "totalAssertions": 12
  },
  "baselineConfig": {
    "captureFullPage": false,
    "regions": [{"name": "main-content", "selector": "main", "tolerance": 0.02}],
    "ignoreRegions": [{"reason": "Dynamic timestamp", "selector": ".timestamp"}]
  }
}`;

// ============================================================================
// VisualAnalysisAgent Class
// ============================================================================

export class VisualAnalysisAgent extends BaseAgent {
  constructor(config?: AgentConfig) {
    super('VisualAnalysis', config);
  }

  /**
   * Compare two screenshots and detect visual differences
   */
  async compare(input: CompareInput): Promise<AgentResponse<CompareOutput>> {
    const textPrompt = this.buildComparePrompt(input);

    // Build content with both images
    const content: MessageContent[] = [
      {
        type: 'image',
        source: {
          type: 'base64',
          media_type: input.baseline.mediaType,
          data: input.baseline.base64,
        },
      },
      {
        type: 'text',
        text: 'BASELINE IMAGE (Expected):',
      },
      {
        type: 'image',
        source: {
          type: 'base64',
          media_type: input.current.mediaType,
          data: input.current.base64,
        },
      },
      {
        type: 'text',
        text: 'CURRENT IMAGE (Actual):',
      },
      {
        type: 'text',
        text: textPrompt,
      },
    ];

    return this.callWithHistory<CompareOutput>(
      COMPARE_SYSTEM_PROMPT,
      [{ role: 'user', content }],
      (text) => this.parseJSON<CompareOutput>(text)
    );
  }

  /**
   * Analyze a visual difference to determine if it's a regression or intentional change
   */
  async analyzeRegression(input: RegressionAnalysisInput): Promise<AgentResponse<RegressionAnalysisOutput>> {
    const textPrompt = this.buildRegressionAnalysisPrompt(input);

    // Build content with both images and the difference context
    const content: MessageContent[] = [
      {
        type: 'image',
        source: {
          type: 'base64',
          media_type: input.baseline.mediaType,
          data: input.baseline.base64,
        },
      },
      {
        type: 'text',
        text: 'BASELINE IMAGE:',
      },
      {
        type: 'image',
        source: {
          type: 'base64',
          media_type: input.current.mediaType,
          data: input.current.base64,
        },
      },
      {
        type: 'text',
        text: 'CURRENT IMAGE:',
      },
      {
        type: 'text',
        text: textPrompt,
      },
    ];

    return this.callWithHistory<RegressionAnalysisOutput>(
      ANALYZE_REGRESSION_SYSTEM_PROMPT,
      [{ role: 'user', content }],
      (text) => this.parseJSON<RegressionAnalysisOutput>(text)
    );
  }

  /**
   * Detect UI elements from a screenshot
   */
  async detectElements(input: DetectElementsInput): Promise<AgentResponse<DetectElementsOutput>> {
    const textPrompt = this.buildDetectElementsPrompt(input);

    return this.callWithVision<DetectElementsOutput>(
      DETECT_ELEMENTS_SYSTEM_PROMPT,
      textPrompt,
      input.screenshot.base64,
      input.screenshot.mediaType,
      (text) => this.parseJSON<DetectElementsOutput>(text)
    );
  }

  /**
   * Generate visual test cases from a baseline screenshot
   */
  async generateVisualTestCase(input: GenerateVisualTestCaseInput): Promise<AgentResponse<GenerateVisualTestCaseOutput>> {
    // If elements not provided, detect them first
    let elements = input.elements;
    if (!elements) {
      const detectionResult = await this.detectElements({
        screenshot: input.screenshot,
        minConfidence: 0.7,
        detectNested: true,
      });
      elements = detectionResult.data.elements;
    }

    const textPrompt = this.buildGenerateTestCasePrompt(input, elements);

    return this.callWithVision<GenerateVisualTestCaseOutput>(
      GENERATE_VISUAL_TEST_SYSTEM_PROMPT,
      textPrompt,
      input.screenshot.base64,
      input.screenshot.mediaType,
      (text) => this.parseJSON<GenerateVisualTestCaseOutput>(text)
    );
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private buildComparePrompt(input: CompareInput): string {
    let prompt = 'Compare these two screenshots and identify all visual differences.\n\n';

    if (input.context) {
      prompt += `Context: ${input.context}\n\n`;
    }

    if (input.sensitivity !== undefined) {
      prompt += `Sensitivity threshold: ${input.sensitivity} (${input.sensitivity < 0.5 ? 'high sensitivity' : 'low sensitivity'})\n`;
    }

    if (input.categories?.length) {
      prompt += `Focus on these difference categories: ${input.categories.join(', ')}\n`;
    }

    if (input.ignoreRegions?.length) {
      prompt += '\nIgnore these regions (do not report differences in these areas):\n';
      input.ignoreRegions.forEach((region, i) => {
        prompt += `${i + 1}. ${region.reason} (${region.type}): x=${region.box.x}, y=${region.box.y}, w=${region.box.width}, h=${region.box.height}\n`;
      });
    }

    if (input.baseline.metadata) {
      prompt += '\nBaseline metadata:\n';
      if (input.baseline.metadata.url) prompt += `  URL: ${input.baseline.metadata.url}\n`;
      if (input.baseline.metadata.viewport) prompt += `  Viewport: ${input.baseline.metadata.viewport.width}x${input.baseline.metadata.viewport.height}\n`;
      if (input.baseline.metadata.browser) prompt += `  Browser: ${input.baseline.metadata.browser}\n`;
    }

    if (input.current.metadata) {
      prompt += '\nCurrent metadata:\n';
      if (input.current.metadata.url) prompt += `  URL: ${input.current.metadata.url}\n`;
      if (input.current.metadata.viewport) prompt += `  Viewport: ${input.current.metadata.viewport.width}x${input.current.metadata.viewport.height}\n`;
      if (input.current.metadata.browser) prompt += `  Browser: ${input.current.metadata.browser}\n`;
    }

    prompt += '\nReturn the comparison results as a JSON object.';
    return prompt;
  }

  private buildRegressionAnalysisPrompt(input: RegressionAnalysisInput): string {
    let prompt = 'Analyze this visual difference and determine if it is a regression or intentional change.\n\n';

    prompt += 'DIFFERENCE DETAILS:\n';
    prompt += `- Category: ${input.difference.category}\n`;
    prompt += `- Severity: ${input.difference.severity}\n`;
    prompt += `- Description: ${input.difference.description}\n`;
    prompt += `- Detection confidence: ${input.difference.confidence}\n`;

    if (input.difference.baselineRegion) {
      const r = input.difference.baselineRegion;
      prompt += `- Baseline region: x=${r.x}, y=${r.y}, w=${r.width}, h=${r.height}\n`;
    }

    if (input.difference.currentRegion) {
      const r = input.difference.currentRegion;
      prompt += `- Current region: x=${r.x}, y=${r.y}, w=${r.width}, h=${r.height}\n`;
    }

    if (input.changeContext) {
      prompt += `\nCHANGE CONTEXT:\n${input.changeContext}\n`;
    }

    if (input.recentChanges?.length) {
      prompt += '\nRECENT CHANGES:\n';
      input.recentChanges.forEach((change, i) => {
        prompt += `${i + 1}. ${change}\n`;
      });
    }

    if (input.historicalContext) {
      prompt += `\nHISTORICAL CONTEXT:\n${input.historicalContext}\n`;
    }

    prompt += '\nAnalyze and return the classification as a JSON object.';
    return prompt;
  }

  private buildDetectElementsPrompt(input: DetectElementsInput): string {
    let prompt = 'Analyze this screenshot and detect all UI elements.\n\n';

    if (input.context) {
      prompt += `Context: ${input.context}\n\n`;
    }

    if (input.elementTypes?.length) {
      prompt += `Focus on these element types: ${input.elementTypes.join(', ')}\n`;
    }

    if (input.minConfidence !== undefined) {
      prompt += `Minimum confidence threshold: ${input.minConfidence}\n`;
    }

    prompt += `Detect nested elements: ${input.detectNested ?? false}\n`;

    if (input.screenshot.metadata) {
      prompt += '\nScreenshot metadata:\n';
      if (input.screenshot.metadata.url) prompt += `  URL: ${input.screenshot.metadata.url}\n`;
      if (input.screenshot.metadata.viewport) prompt += `  Viewport: ${input.screenshot.metadata.viewport.width}x${input.screenshot.metadata.viewport.height}\n`;
    }

    prompt += '\nReturn the detected elements as a JSON object.';
    return prompt;
  }

  private buildGenerateTestCasePrompt(input: GenerateVisualTestCaseInput, elements: DetectedElement[]): string {
    let prompt = 'Generate visual test cases for this screenshot.\n\n';

    if (input.feature) {
      prompt += `Feature being tested: ${input.feature}\n`;
    }

    if (input.focusAreas?.length) {
      prompt += `Focus areas: ${input.focusAreas.join(', ')}\n`;
    }

    if (input.maxTestCases) {
      prompt += `Maximum test cases: ${input.maxTestCases}\n`;
    }

    if (input.testTypes?.length) {
      prompt += `Test types to generate: ${input.testTypes.join(', ')}\n`;
    }

    prompt += `Include responsive testing: ${input.includeResponsive ?? false}\n`;

    prompt += '\nDETECTED ELEMENTS:\n';
    elements.forEach((el, i) => {
      prompt += `${i + 1}. ${el.type}`;
      if (el.text) prompt += ` "${el.text}"`;
      prompt += ` at (${el.boundingBox.x}, ${el.boundingBox.y})`;
      if (el.suggestedSelector) prompt += ` - selector: ${el.suggestedSelector}`;
      prompt += '\n';
    });

    if (input.screenshot.metadata) {
      prompt += '\nScreenshot metadata:\n';
      if (input.screenshot.metadata.url) prompt += `  URL: ${input.screenshot.metadata.url}\n`;
      if (input.screenshot.metadata.viewport) prompt += `  Viewport: ${input.screenshot.metadata.viewport.width}x${input.screenshot.metadata.viewport.height}\n`;
    }

    prompt += '\nReturn the generated test cases as a JSON object.';
    return prompt;
  }
}

// ============================================================================
// Export Singleton Instance
// ============================================================================

export const visualAnalysisAgent = new VisualAnalysisAgent();

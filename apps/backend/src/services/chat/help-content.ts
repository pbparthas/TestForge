/**
 * Chat Help Content
 * Static help data, contextual help lookup, and help search functionality
 */

// =============================================================================
// Types
// =============================================================================

export interface HelpContent {
  title: string;
  topics: HelpTopic[];
}

export interface HelpTopic {
  id: string;
  question: string;
  answer: string;
  keywords: string[];
}

// =============================================================================
// Help Content Database
// =============================================================================

// Comprehensive Help Content Database
export const HELP_CONTENT: Record<string, HelpContent> = {
  // ==========================================================================
  // ScriptSmith Pro - All 5 Input Methods
  // ==========================================================================
  scriptsmith: {
    title: 'ScriptSmith Pro Help',
    topics: [
      {
        id: 'scriptsmith-overview',
        question: 'What is ScriptSmith Pro?',
        answer: 'ScriptSmith Pro generates Playwright or Cypress automation scripts from various inputs. It has 5 input methods: Record (browser recording), Upload (HAR/trace files), Screenshot (annotated screenshots), Describe (natural language), and Edit (modify existing scripts). Navigate to Testing & Automation \u2192 ScriptSmith Pro to get started.',
        keywords: ['scriptsmith', 'what', 'overview', 'intro', 'about'],
      },
      {
        id: 'scriptsmith-record',
        question: 'How do I use ScriptSmith Record input?',
        answer: 'The Record method captures browser interactions and converts them to test scripts. Steps: 1) Select "Record" as your input method, 2) Enter the URL to record, 3) The recorder captures clicks, inputs, and navigation, 4) Click Transform to generate Playwright/Cypress code. Tip: Use the Recorder page (sidebar) for more recording options.',
        keywords: ['record', 'recording', 'capture', 'browser', 'scriptsmith'],
      },
      {
        id: 'scriptsmith-upload',
        question: 'How do I use ScriptSmith Upload input?',
        answer: 'Upload converts HAR files or Playwright trace files into automation scripts. Steps: 1) Select "Upload" as input method, 2) Drag & drop or click to upload your .har, .json, or .zip file, 3) ScriptSmith analyzes the network traffic/actions, 4) Click Transform to generate test code with proper assertions.',
        keywords: ['upload', 'har', 'trace', 'file', 'import', 'scriptsmith'],
      },
      {
        id: 'scriptsmith-screenshot',
        question: 'How do I use ScriptSmith Screenshot input?',
        answer: 'Screenshot input lets you annotate UI screenshots to generate tests. Steps: 1) Select "Screenshot" as input method, 2) Upload a screenshot of the page you want to test, 3) Add annotations to mark clickable elements, input fields, or assertions, 4) ScriptSmith uses AI vision to generate accurate selectors and test steps.',
        keywords: ['screenshot', 'image', 'annotate', 'visual', 'picture', 'scriptsmith'],
      },
      {
        id: 'scriptsmith-describe',
        question: 'How do I use ScriptSmith Describe input?',
        answer: 'Describe lets you write test steps in plain English. Steps: 1) Select "Describe" as input method, 2) Write your test scenario naturally, e.g., "Navigate to login page, enter email test@example.com, enter password Test123, click Sign In, verify dashboard loads", 3) ScriptSmith converts this to working Playwright/Cypress code with proper waits and assertions.',
        keywords: ['describe', 'natural', 'language', 'text', 'write', 'plain', 'english', 'scriptsmith'],
      },
      {
        id: 'scriptsmith-edit',
        question: 'How do I use ScriptSmith Edit input?',
        answer: 'Edit mode improves or fixes existing automation scripts. Steps: 1) Select "Edit" as input method, 2) Paste your existing test code, 3) Describe what you want to change (e.g., "Add error handling", "Fix the login selector", "Add retry logic"), 4) ScriptSmith modifies the code intelligently while preserving your patterns.',
        keywords: ['edit', 'modify', 'fix', 'improve', 'existing', 'code', 'scriptsmith'],
      },
      {
        id: 'scriptsmith-framework',
        question: 'How do I choose between Playwright and Cypress?',
        answer: 'In ScriptSmith Pro Step 3 (Transform), select your framework: Playwright (recommended for cross-browser, API testing, mobile) or Cypress (great for component testing, time-travel debugging). You can also choose TypeScript or JavaScript, and enable Page Object generation for maintainable code.',
        keywords: ['playwright', 'cypress', 'framework', 'choose', 'typescript', 'javascript'],
      },
    ],
  },

  // ==========================================================================
  // TestWeaver AI (AI Generator)
  // ==========================================================================
  testweaver: {
    title: 'TestWeaver AI Help',
    topics: [
      {
        id: 'testweaver-overview',
        question: 'What is TestWeaver AI?',
        answer: 'TestWeaver AI generates test cases from requirements, screenshots, or natural language. Find it at Testing & Automation \u2192 AI Generator. It has 3 tabs: Generate Tests (create new test cases), Batch Generate (multiple specs at once), and Evolve Tests (update tests when requirements change).',
        keywords: ['testweaver', 'ai', 'generator', 'what', 'overview'],
      },
      {
        id: 'testweaver-generate',
        question: 'How do I generate test cases with TestWeaver?',
        answer: 'In the Generate Tests tab: 1) Choose input method (Text, Screenshot, File, or Chat), 2) Enter your requirement or upload content, 3) Select test types (functional, integration, e2e, api), 4) Click Generate. TestWeaver creates structured test cases with steps, expected results, and priority.',
        keywords: ['generate', 'test', 'case', 'testweaver', 'create'],
      },
      {
        id: 'testweaver-batch',
        question: 'How do I batch generate test cases?',
        answer: 'Use the Batch Generate tab to process multiple requirements at once: 1) Click "Add Specification" for each requirement, 2) Enter the requirement text for each, 3) Click Generate All. TestWeaver processes them in parallel and shows results with cost breakdown.',
        keywords: ['batch', 'multiple', 'bulk', 'many', 'testweaver'],
      },
      {
        id: 'testweaver-evolve',
        question: 'How do I update tests when requirements change?',
        answer: 'Use the Evolve Tests tab: 1) Select existing test cases to update, 2) Enter the old specification, 3) Enter the new specification, 4) Click Evolve. TestWeaver identifies which tests need changes, what\'s deprecated, and generates new tests for added functionality.',
        keywords: ['evolve', 'update', 'change', 'requirement', 'modify', 'testweaver'],
      },
    ],
  },

  // ==========================================================================
  // Recorder Page
  // ==========================================================================
  recorder: {
    title: 'Recorder Help',
    topics: [
      {
        id: 'recorder-overview',
        question: 'What is the Recorder page?',
        answer: 'The Recorder page (Testing & Automation \u2192 Recorder) converts browser recordings into automation scripts. It has 4 tabs: Convert (recording to code), Optimize (clean up recordings), Assertions (add verifications), and Pipeline (CI/CD integration). It\'s a dedicated tool separate from ScriptSmith\'s Record input method.',
        keywords: ['recorder', 'page', 'what', 'convert', 'recording'],
      },
      {
        id: 'recorder-convert',
        question: 'How do I convert a recording to a script?',
        answer: 'In the Convert tab: 1) Paste your recording JSON (from browser devtools or recording extension), 2) Select output framework (Playwright/Cypress/Selenium), 3) Choose language (TypeScript/JavaScript/Python), 4) Enable Page Objects if wanted, 5) Click Convert. You get clean, runnable test code.',
        keywords: ['convert', 'recording', 'json', 'script', 'recorder'],
      },
    ],
  },

  // ==========================================================================
  // Other AI Agents
  // ==========================================================================
  agents: {
    title: 'AI Agents Help',
    topics: [
      {
        id: 'codeguardian',
        question: 'What is CodeGuardian?',
        answer: 'CodeGuardian generates unit tests for your source code. Go to Testing & Automation \u2192 CodeGuardian, paste your code, select language (TypeScript/JavaScript/Python/Java) and test framework (Vitest/Jest), then click Generate. It creates comprehensive tests with mocks, edge cases, and setup code.',
        keywords: ['codeguardian', 'unit', 'test', 'code', 'coverage'],
      },
      {
        id: 'flowpilot',
        question: 'What is FlowPilot?',
        answer: 'FlowPilot generates API tests from OpenAPI/Swagger specifications. Go to Testing & Automation \u2192 FlowPilot, paste your OpenAPI spec (JSON/YAML), and click Generate. It creates tests for each endpoint with proper authentication, request bodies, and response validation.',
        keywords: ['flowpilot', 'api', 'openapi', 'swagger', 'rest'],
      },
      {
        id: 'selfhealing',
        question: 'What is Self-Healing?',
        answer: 'Self-Healing diagnoses and fixes failing tests. Go to Testing & Automation \u2192 Self-Healing, enter the failed test details (error message, stack trace, optionally screenshot), and click Diagnose. It identifies the root cause (selector change, timing issue, etc.) and suggests fixes or auto-applies them.',
        keywords: ['self-healing', 'heal', 'fix', 'broken', 'failing', 'selector'],
      },
      {
        id: 'visualtesting',
        question: 'What is Visual Testing?',
        answer: 'Visual Testing detects UI changes using AI vision. Go to Testing & Automation \u2192 Visual Testing to: Compare screenshots (baseline vs current), Analyze regressions, Detect page elements, or Generate visual tests. It identifies layout, color, typography, and content changes.',
        keywords: ['visual', 'testing', 'screenshot', 'regression', 'ui', 'compare'],
      },
    ],
  },

  // ==========================================================================
  // Test Management
  // ==========================================================================
  test_management: {
    title: 'Test Management Help',
    topics: [
      {
        id: 'create-testcase',
        question: 'How do I create a test case?',
        answer: 'Two ways: 1) Manual: Go to Test Management \u2192 Test Cases, click New, fill in title, steps, expected results. 2) AI: Use AI Generator (TestWeaver) to generate test cases from requirements automatically.',
        keywords: ['create', 'test', 'case', 'new', 'add'],
      },
      {
        id: 'create-suite',
        question: 'How do I create a test suite?',
        answer: 'Go to Test Management \u2192 Test Suites, click New Suite. Add name, description, and select test cases to include. Suites help organize tests for execution (e.g., "Smoke Tests", "Regression Suite").',
        keywords: ['create', 'suite', 'new', 'organize', 'group'],
      },
      {
        id: 'requirements',
        question: 'How do I manage requirements?',
        answer: 'Go to Test Management \u2192 Requirements. Add requirements with title, description, and priority. Link test cases to requirements for traceability. The Coverage page shows which requirements have test coverage.',
        keywords: ['requirement', 'requirements', 'trace', 'coverage', 'link'],
      },
    ],
  },

  // ==========================================================================
  // Execution & Results
  // ==========================================================================
  execution: {
    title: 'Execution Help',
    topics: [
      {
        id: 'run-tests',
        question: 'How do I run tests?',
        answer: 'Go to Execution & Bugs \u2192 Executions, click New Execution. Select a test suite, environment, and configuration. The execution runs your tests and records results with screenshots, logs, and timing for each test.',
        keywords: ['run', 'execute', 'test', 'trigger', 'start'],
      },
      {
        id: 'view-results',
        question: 'How do I view test results?',
        answer: 'Click any execution on the Executions page to see detailed results: pass/fail status per test, duration, error messages, stack traces, and screenshots. Failed tests show exactly what went wrong.',
        keywords: ['results', 'view', 'report', 'status', 'passed', 'failed'],
      },
      {
        id: 'flaky-tests',
        question: 'How do I handle flaky tests?',
        answer: 'Go to Execution & Bugs \u2192 Flaky Tests to see tests that pass/fail inconsistently. The page shows flakiness scores and patterns. Use Self-Healing to diagnose and fix flaky selectors or timing issues.',
        keywords: ['flaky', 'unstable', 'intermittent', 'inconsistent'],
      },
    ],
  },

  // ==========================================================================
  // General / Getting Started
  // ==========================================================================
  general: {
    title: 'General Help',
    topics: [
      {
        id: 'getting-started',
        question: 'How do I get started with TestForge?',
        answer: 'Welcome to TestForge! Quick start: 1) Create a project from the Dashboard, 2) Add requirements (Test Management \u2192 Requirements), 3) Generate test cases with AI Generator, 4) Create automation scripts with ScriptSmith Pro, 5) Run tests from Executions. Need help with a specific feature? Just ask!',
        keywords: ['start', 'begin', 'new', 'setup', 'getting', 'started', 'hello', 'hi', 'hey'],
      },
      {
        id: 'navigation',
        question: 'How do I navigate TestForge?',
        answer: 'The sidebar has grouped sections: Overview (Dashboard), Test Management (Test Cases, Suites, Requirements), Testing & Automation (all AI tools), Execution & Bugs (run tests, track bugs), AI Analysis (code analysis, test evolution), Analytics (coverage, reports), Settings (CI/CD, audit logs).',
        keywords: ['navigate', 'find', 'where', 'sidebar', 'menu', 'page'],
      },
      {
        id: 'ai-costs',
        question: 'How much does AI usage cost?',
        answer: 'View AI costs at AI Analysis \u2192 TestPilot Suite, or in the AI Agents page under the Usage tab. Costs are shown in USD and INR, broken down by agent. TestForge uses Claude AI - costs depend on input/output tokens.',
        keywords: ['cost', 'price', 'token', 'usage', 'money', 'inr', 'usd'],
      },
    ],
  },
};

// =============================================================================
// Help Functions
// =============================================================================

/**
 * Get contextual help based on page context type
 */
export function getContextualHelp(contextType: string): HelpContent {
  // Map page contexts to relevant help sections
  const contextMap: Record<string, string> = {
    'scriptsmith': 'scriptsmith',
    'script': 'scriptsmith',
    'ai-generator': 'testweaver',
    'testweaver': 'testweaver',
    'recorder': 'recorder',
    'code-guardian': 'agents',
    'flowpilot': 'agents',
    'self-healing': 'agents',
    'visual-testing': 'agents',
    'test-case': 'test_management',
    'test-suite': 'test_management',
    'requirement': 'test_management',
    'execution': 'execution',
    'flaky': 'execution',
  };

  const mappedContext = contextMap[contextType] || contextType;
  return HELP_CONTENT[mappedContext] || HELP_CONTENT.general;
}

/**
 * Search help topics with score-based relevance matching
 */
export function searchHelp(query: string): HelpTopic[] {
  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);

  // Score-based matching for better relevance
  const scored: { topic: HelpTopic; score: number }[] = [];

  for (const content of Object.values(HELP_CONTENT)) {
    for (const topic of content.topics) {
      let score = 0;
      const questionLower = topic.question.toLowerCase();
      const answerLower = topic.answer.toLowerCase();

      // Exact phrase match in question (highest priority)
      if (questionLower.includes(queryLower)) {
        score += 100;
      }

      // Keyword matches (high priority)
      for (const keyword of topic.keywords) {
        if (queryLower.includes(keyword)) {
          score += 50;
        }
        // Query word matches keyword
        for (const word of queryWords) {
          if (keyword.includes(word) || word.includes(keyword)) {
            score += 30;
          }
        }
      }

      // Word matches in question
      for (const word of queryWords) {
        if (questionLower.includes(word)) {
          score += 20;
        }
      }

      // Word matches in answer (lower priority)
      for (const word of queryWords) {
        if (answerLower.includes(word)) {
          score += 5;
        }
      }

      if (score > 0) {
        scored.push({ topic, score });
      }
    }
  }

  // Sort by score descending, return top results
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 5).map(s => s.topic);
}

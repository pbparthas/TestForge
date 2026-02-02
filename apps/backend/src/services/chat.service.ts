/**
 * Chat Service
 * Support/help chat system for TestForge (FAQ + Support Tickets)
 */

import { prisma } from '../utils/prisma.js';
import { NotFoundError, ValidationError } from '../errors/index.js';
import type {
  ChatConversation,
  ChatMessage,
  ChatSuggestion,
  ChatConversationStatus,
  ChatConversationCategory,
  ChatSuggestionStatus,
  ChatSuggestionType,
} from '@prisma/client';

// =============================================================================
// Types
// =============================================================================

export interface CreateConversationInput {
  userId: string;
  projectId?: string;
  contextType?: string;
  contextId?: string;
  title?: string;
  category?: ChatConversationCategory;
}

export interface UpdateConversationInput {
  title?: string;
  status?: ChatConversationStatus;
}

export interface ConversationFilters {
  status?: ChatConversationStatus;
  category?: ChatConversationCategory;
  projectId?: string;
  limit?: number;
  offset?: number;
}

export interface MessageFilters {
  limit?: number;
  offset?: number;
}

export interface CreateSuggestionInput {
  messageId?: string;
  suggestionType: ChatSuggestionType;
  targetType?: string;
  targetId?: string;
  targetPath?: string;
  originalContent?: string;
  suggestedContent: string;
  description?: string;
}

export interface SuggestionFilters {
  status?: ChatSuggestionStatus;
}

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

// Jailbreak detection patterns (security)
const JAILBREAK_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior)\s+instructions/i,
  /you\s+are\s+now\s+(DAN|jailbroken|unrestricted)/i,
  /pretend\s+(you\s+)?(have\s+)?no\s+restrictions/i,
  /system:\s*override/i,
  /forget\s+(your\s+)?rules/i,
  /bypass\s+(your\s+)?safety/i,
  /disable\s+(your\s+)?ethics/i,
  /act\s+as\s+if\s+you\s+have\s+no\s+guidelines/i,
];

// Comprehensive Help Content Database
const HELP_CONTENT: Record<string, HelpContent> = {
  // ==========================================================================
  // ScriptSmith Pro - All 5 Input Methods
  // ==========================================================================
  scriptsmith: {
    title: 'ScriptSmith Pro Help',
    topics: [
      {
        id: 'scriptsmith-overview',
        question: 'What is ScriptSmith Pro?',
        answer: 'ScriptSmith Pro generates Playwright or Cypress automation scripts from various inputs. It has 5 input methods: Record (browser recording), Upload (HAR/trace files), Screenshot (annotated screenshots), Describe (natural language), and Edit (modify existing scripts). Navigate to Testing & Automation → ScriptSmith Pro to get started.',
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
        answer: 'TestWeaver AI generates test cases from requirements, screenshots, or natural language. Find it at Testing & Automation → AI Generator. It has 3 tabs: Generate Tests (create new test cases), Batch Generate (multiple specs at once), and Evolve Tests (update tests when requirements change).',
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
        answer: 'The Recorder page (Testing & Automation → Recorder) converts browser recordings into automation scripts. It has 4 tabs: Convert (recording to code), Optimize (clean up recordings), Assertions (add verifications), and Pipeline (CI/CD integration). It\'s a dedicated tool separate from ScriptSmith\'s Record input method.',
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
        answer: 'CodeGuardian generates unit tests for your source code. Go to Testing & Automation → CodeGuardian, paste your code, select language (TypeScript/JavaScript/Python/Java) and test framework (Vitest/Jest), then click Generate. It creates comprehensive tests with mocks, edge cases, and setup code.',
        keywords: ['codeguardian', 'unit', 'test', 'code', 'coverage'],
      },
      {
        id: 'flowpilot',
        question: 'What is FlowPilot?',
        answer: 'FlowPilot generates API tests from OpenAPI/Swagger specifications. Go to Testing & Automation → FlowPilot, paste your OpenAPI spec (JSON/YAML), and click Generate. It creates tests for each endpoint with proper authentication, request bodies, and response validation.',
        keywords: ['flowpilot', 'api', 'openapi', 'swagger', 'rest'],
      },
      {
        id: 'selfhealing',
        question: 'What is Self-Healing?',
        answer: 'Self-Healing diagnoses and fixes failing tests. Go to Testing & Automation → Self-Healing, enter the failed test details (error message, stack trace, optionally screenshot), and click Diagnose. It identifies the root cause (selector change, timing issue, etc.) and suggests fixes or auto-applies them.',
        keywords: ['self-healing', 'heal', 'fix', 'broken', 'failing', 'selector'],
      },
      {
        id: 'visualtesting',
        question: 'What is Visual Testing?',
        answer: 'Visual Testing detects UI changes using AI vision. Go to Testing & Automation → Visual Testing to: Compare screenshots (baseline vs current), Analyze regressions, Detect page elements, or Generate visual tests. It identifies layout, color, typography, and content changes.',
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
        answer: 'Two ways: 1) Manual: Go to Test Management → Test Cases, click New, fill in title, steps, expected results. 2) AI: Use AI Generator (TestWeaver) to generate test cases from requirements automatically.',
        keywords: ['create', 'test', 'case', 'new', 'add'],
      },
      {
        id: 'create-suite',
        question: 'How do I create a test suite?',
        answer: 'Go to Test Management → Test Suites, click New Suite. Add name, description, and select test cases to include. Suites help organize tests for execution (e.g., "Smoke Tests", "Regression Suite").',
        keywords: ['create', 'suite', 'new', 'organize', 'group'],
      },
      {
        id: 'requirements',
        question: 'How do I manage requirements?',
        answer: 'Go to Test Management → Requirements. Add requirements with title, description, and priority. Link test cases to requirements for traceability. The Coverage page shows which requirements have test coverage.',
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
        answer: 'Go to Execution & Bugs → Executions, click New Execution. Select a test suite, environment, and configuration. The execution runs your tests and records results with screenshots, logs, and timing for each test.',
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
        answer: 'Go to Execution & Bugs → Flaky Tests to see tests that pass/fail inconsistently. The page shows flakiness scores and patterns. Use Self-Healing to diagnose and fix flaky selectors or timing issues.',
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
        answer: 'Welcome to TestForge! Quick start: 1) Create a project from the Dashboard, 2) Add requirements (Test Management → Requirements), 3) Generate test cases with AI Generator, 4) Create automation scripts with ScriptSmith Pro, 5) Run tests from Executions. Need help with a specific feature? Just ask!',
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
        answer: 'View AI costs at AI Analysis → TestPilot Suite, or in the AI Agents page under the Usage tab. Costs are shown in USD and INR, broken down by agent. TestForge uses Claude AI - costs depend on input/output tokens.',
        keywords: ['cost', 'price', 'token', 'usage', 'money', 'inr', 'usd'],
      },
    ],
  },
};

// =============================================================================
// Service
// =============================================================================

export class ChatService {
  // ===========================================================================
  // Conversation CRUD
  // ===========================================================================

  async createConversation(input: CreateConversationInput): Promise<ChatConversation> {
    return prisma.chatConversation.create({
      data: {
        userId: input.userId,
        projectId: input.projectId,
        contextType: input.contextType,
        contextId: input.contextId,
        title: input.title,
        category: input.category || 'help_question',
      },
    });
  }

  async getConversation(id: string): Promise<ChatConversation & { messages: ChatMessage[]; suggestions: ChatSuggestion[] }> {
    const conversation = await prisma.chatConversation.findUnique({
      where: { id },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        suggestions: true,
      },
    });

    if (!conversation) {
      throw new NotFoundError('ChatConversation', id);
    }

    return conversation;
  }

  async getUserConversations(
    userId: string,
    filters?: ConversationFilters
  ): Promise<{ data: ChatConversation[]; total: number }> {
    const where = {
      userId,
      ...(filters?.status && { status: filters.status }),
      ...(filters?.category && { category: filters.category }),
      ...(filters?.projectId && { projectId: filters.projectId }),
    };

    const [data, total] = await Promise.all([
      prisma.chatConversation.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        take: filters?.limit || 20,
        skip: filters?.offset || 0,
        include: {
          messages: { take: 1, orderBy: { createdAt: 'desc' } },
        },
      }),
      prisma.chatConversation.count({ where }),
    ]);

    return { data, total };
  }

  async updateConversation(
    id: string,
    input: UpdateConversationInput
  ): Promise<ChatConversation> {
    const existing = await prisma.chatConversation.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundError('ChatConversation', id);
    }

    const updateData: Record<string, unknown> = {};

    if (input.title !== undefined) {
      updateData.title = input.title;
    }
    if (input.status !== undefined) {
      updateData.status = input.status;
      if (input.status === 'closed') {
        updateData.closedAt = new Date();
      }
    }

    return prisma.chatConversation.update({
      where: { id },
      data: updateData,
    });
  }

  async deleteConversation(id: string): Promise<void> {
    const existing = await prisma.chatConversation.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundError('ChatConversation', id);
    }

    await prisma.chatConversation.delete({
      where: { id },
    });
  }

  // ===========================================================================
  // Admin Methods
  // ===========================================================================

  async getAllConversations(
    filters?: ConversationFilters
  ): Promise<{ data: (ChatConversation & { user?: { name: string; email: string } })[]; total: number }> {
    const where = {
      ...(filters?.status && { status: filters.status }),
      ...(filters?.category && { category: filters.category }),
      ...(filters?.projectId && { projectId: filters.projectId }),
    };

    const [data, total] = await Promise.all([
      prisma.chatConversation.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        take: filters?.limit || 50,
        skip: filters?.offset || 0,
        include: {
          messages: { take: 1, orderBy: { createdAt: 'desc' } },
          user: { select: { name: true, email: true } },
        },
      }),
      prisma.chatConversation.count({ where }),
    ]);

    return { data, total };
  }

  async addAdminReply(
    conversationId: string,
    content: string,
    adminUserId: string
  ): Promise<ChatMessage> {
    const conversation = await prisma.chatConversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundError('ChatConversation', conversationId);
    }

    // Create admin message
    const message = await prisma.chatMessage.create({
      data: {
        conversationId,
        role: 'system',
        content: `**Admin Response:**\n\n${content}`,
        metadata: { adminUserId },
      },
    });

    // Update conversation timestamp and set to active if it was closed
    await prisma.chatConversation.update({
      where: { id: conversationId },
      data: {
        updatedAt: new Date(),
        status: 'active',
      },
    });

    return message;
  }

  // ===========================================================================
  // Messaging (Support Ticket System - No AI)
  // ===========================================================================

  async sendMessage(conversationId: string, content: string): Promise<{ userMessage: ChatMessage; suggestions: HelpTopic[]; systemMessage?: ChatMessage }> {
    // Validate conversation
    const conversation = await prisma.chatConversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundError('ChatConversation', conversationId);
    }

    if (conversation.status === 'closed') {
      throw new ValidationError('Cannot send message to closed conversation');
    }

    // Security: Check for jailbreak attempts
    if (this.detectJailbreak(content)) {
      throw new ValidationError('Message contains prohibited content');
    }

    // Sanitize input
    const sanitizedContent = this.sanitizeInput(content);

    // Create user message
    const userMessage = await prisma.chatMessage.create({
      data: {
        conversationId,
        role: 'user',
        content: sanitizedContent,
      },
    });

    // Generate appropriate response based on category
    let systemMessage: ChatMessage | undefined;
    let additionalSuggestions: HelpTopic[] = [];

    // Bug reports and feature requests: Just acknowledge, don't search help
    if (conversation.category === 'bug_report') {
      systemMessage = await prisma.chatMessage.create({
        data: {
          conversationId,
          role: 'system',
          content: `**Bug Report Logged** ✓\n\nThank you for reporting this issue. Your bug report has been logged and will be reviewed by the TestForge team.\n\n**What happens next:**\n1. Our team will review your report\n2. We may ask follow-up questions in this conversation\n3. You'll be notified when the issue is addressed\n\nFeel free to add more details, screenshots, or steps to reproduce.`,
        },
      });
    } else if (conversation.category === 'feature_request') {
      systemMessage = await prisma.chatMessage.create({
        data: {
          conversationId,
          role: 'system',
          content: `**Feature Request Logged** ✓\n\nThank you for your suggestion! Your feature request has been logged for the product team to review.\n\n**What happens next:**\n1. Product team evaluates the request\n2. Highly requested features get prioritized\n3. You'll be notified if we implement it\n\nFeel free to add more context about your use case or why this feature would help.`,
        },
      });
    } else {
      // Help questions: Search for relevant topics
      const allSuggestions = this.searchHelp(sanitizedContent);

      if (allSuggestions.length > 0) {
        // Found relevant help - include the best answer directly
        const topMatch = allSuggestions[0];

        // Only show additional suggestions if there are more relevant topics
        additionalSuggestions = allSuggestions.slice(1);

        let responseContent = `**${topMatch.question}**\n\n${topMatch.answer}`;

        if (additionalSuggestions.length > 0) {
          responseContent += '\n\n---\n*See related topics below for more help.*';
        }

        systemMessage = await prisma.chatMessage.create({
          data: {
            conversationId,
            role: 'system',
            content: responseContent,
          },
        });
      } else {
        // No matching help - give context-aware acknowledgement
        const ackMessage = this.getAcknowledgement(conversation.category, sanitizedContent);
        systemMessage = await prisma.chatMessage.create({
          data: {
            conversationId,
            role: 'system',
            content: ackMessage,
          },
        });
      }
    }

    // Update conversation timestamp
    await prisma.chatConversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    // Only return additional suggestions (top match is already in system message)
    return { userMessage, suggestions: additionalSuggestions, systemMessage };
  }

  // Get acknowledgement message based on category and content
  private getAcknowledgement(category: string, content: string): string {
    // Check for greetings
    const greetingPatterns = /^(hi|hello|hey|good\s*(morning|afternoon|evening)|howdy|greetings|sup|yo)\b/i;
    if (greetingPatterns.test(content.trim())) {
      return 'Hello! Welcome to TestForge Help. I can help you with:\n\n• **ScriptSmith Pro** - Generate automation scripts (5 input methods: Record, Upload, Screenshot, Describe, Edit)\n• **TestWeaver AI** - Generate test cases from requirements\n• **CodeGuardian** - Generate unit tests\n• **FlowPilot** - Generate API tests\n• **Self-Healing** - Fix broken tests\n• **Visual Testing** - Visual regression testing\n\nWhat would you like help with?';
    }

    switch (category) {
      case 'bug_report':
        return 'Thank you for reporting this issue. I\'ve logged it for our team to review. In the meantime:\n\n• Try refreshing the page\n• Clear browser cache (Ctrl+Shift+Delete)\n• Check if the issue persists in incognito mode\n\nWe\'ll get back to you soon.';
      case 'feature_request':
        return 'Thank you for your feature suggestion! We value your feedback and will consider this for future updates. Our product team reviews all requests.';
      default:
        return 'I couldn\'t find a specific answer in our help topics. Our team will review your question and respond. In the meantime, try browsing Quick Help or ask about a specific feature like "How do I use ScriptSmith Pro?"';
    }
  }

  async addResponse(conversationId: string, content: string): Promise<ChatMessage> {
    // Validate conversation
    const conversation = await prisma.chatConversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundError('ChatConversation', conversationId);
    }

    // Create system response
    const message = await prisma.chatMessage.create({
      data: {
        conversationId,
        role: 'system',
        content,
      },
    });

    // Update conversation timestamp
    await prisma.chatConversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    return message;
  }

  async getMessages(
    conversationId: string,
    filters?: MessageFilters
  ): Promise<{ data: ChatMessage[]; total: number }> {
    const conversation = await prisma.chatConversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundError('ChatConversation', conversationId);
    }

    const [data, total] = await Promise.all([
      prisma.chatMessage.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'asc' },
        take: filters?.limit || 50,
        skip: filters?.offset || 0,
      }),
      prisma.chatMessage.count({ where: { conversationId } }),
    ]);

    return { data, total };
  }

  // ===========================================================================
  // Suggestions (Show but not apply directly)
  // ===========================================================================

  async createSuggestion(
    conversationId: string,
    input: CreateSuggestionInput
  ): Promise<ChatSuggestion> {
    const conversation = await prisma.chatConversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundError('ChatConversation', conversationId);
    }

    return prisma.chatSuggestion.create({
      data: {
        conversationId,
        messageId: input.messageId,
        suggestionType: input.suggestionType,
        targetType: input.targetType,
        targetId: input.targetId,
        targetPath: input.targetPath,
        originalContent: input.originalContent,
        suggestedContent: input.suggestedContent,
        description: input.description,
      },
    });
  }

  async getSuggestions(
    conversationId: string,
    filters?: SuggestionFilters
  ): Promise<ChatSuggestion[]> {
    const conversation = await prisma.chatConversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundError('ChatConversation', conversationId);
    }

    return prisma.chatSuggestion.findMany({
      where: {
        conversationId,
        ...(filters?.status && { status: filters.status }),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async acknowledgeSuggestion(id: string, userId: string): Promise<ChatSuggestion> {
    const suggestion = await prisma.chatSuggestion.findUnique({
      where: { id },
    });

    if (!suggestion) {
      throw new NotFoundError('ChatSuggestion', id);
    }

    if (suggestion.status !== 'pending') {
      throw new ValidationError('Suggestion has already been processed');
    }

    return prisma.chatSuggestion.update({
      where: { id },
      data: {
        status: 'acknowledged',
        acknowledgedById: userId,
        acknowledgedAt: new Date(),
      },
    });
  }

  async dismissSuggestion(id: string): Promise<ChatSuggestion> {
    const suggestion = await prisma.chatSuggestion.findUnique({
      where: { id },
    });

    if (!suggestion) {
      throw new NotFoundError('ChatSuggestion', id);
    }

    if (suggestion.status !== 'pending') {
      throw new ValidationError('Suggestion has already been processed');
    }

    return prisma.chatSuggestion.update({
      where: { id },
      data: { status: 'dismissed' },
    });
  }

  // ===========================================================================
  // Contextual Help
  // ===========================================================================

  getContextualHelp(contextType: string): HelpContent {
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

  searchHelp(query: string): HelpTopic[] {
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

  // ===========================================================================
  // Security
  // ===========================================================================

  detectJailbreak(content: string): boolean {
    return JAILBREAK_PATTERNS.some(pattern => pattern.test(content));
  }

  sanitizeInput(content: string): string {
    // Remove HTML tags
    let sanitized = content.replace(/<[^>]*>/g, '');

    // Trim whitespace
    sanitized = sanitized.trim();

    // Limit length
    if (sanitized.length > 5000) {
      sanitized = sanitized.substring(0, 5000);
    }

    return sanitized;
  }
}

export const chatService = new ChatService();

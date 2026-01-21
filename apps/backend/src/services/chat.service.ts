/**
 * Chat Service
 * Support/help chat system for TestForge (no AI)
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

// Help content database
const HELP_CONTENT: Record<string, HelpContent> = {
  test_suite: {
    title: 'Test Suite Help',
    topics: [
      {
        id: 'run-suite',
        question: 'How do I run a test suite?',
        answer: 'Go to the Test Suites page, find your suite, and click the "Run" button. You can also trigger runs from the Executions page.',
        keywords: ['run', 'execute', 'suite', 'trigger'],
      },
      {
        id: 'create-suite',
        question: 'How do I create a test suite?',
        answer: 'Click the "New Suite" button on the Test Suites page. Add a name, description, and select test cases to include.',
        keywords: ['create', 'new', 'suite', 'add'],
      },
      {
        id: 'suite-failing',
        question: 'Why is my suite failing?',
        answer: 'Check the Executions page for the latest run results. Click on failed tests to see error details and screenshots.',
        keywords: ['fail', 'failing', 'error', 'debug'],
      },
    ],
  },
  test_case: {
    title: 'Test Case Help',
    topics: [
      {
        id: 'create-test',
        question: 'How do I create a test case?',
        answer: 'Use the AI Generator (TestWeaver) to generate test cases from requirements, or manually create them on the Test Cases page.',
        keywords: ['create', 'new', 'test', 'case'],
      },
      {
        id: 'edit-test',
        question: 'How do I edit a test case?',
        answer: 'Click on any test case to open it, then click the Edit button to modify steps, expected results, or metadata.',
        keywords: ['edit', 'modify', 'update', 'change'],
      },
      {
        id: 'link-requirement',
        question: 'How do I link a test case to a requirement?',
        answer: 'Open the test case and use the "Link Requirement" option to associate it with existing requirements for traceability.',
        keywords: ['link', 'requirement', 'trace', 'associate'],
      },
    ],
  },
  script: {
    title: 'Script Help',
    topics: [
      {
        id: 'generate-script',
        question: 'How do I generate automation scripts?',
        answer: 'Use ScriptSmith Pro to generate Playwright or Cypress scripts from test cases. Select your test cases and click Generate.',
        keywords: ['generate', 'script', 'automation', 'scriptsmith'],
      },
      {
        id: 'edit-script',
        question: 'How do I edit a script?',
        answer: 'Use ScriptSmith Pro Edit mode to modify scripts. It provides intelligent suggestions and framework-aware editing.',
        keywords: ['edit', 'modify', 'script', 'change'],
      },
      {
        id: 'script-flaky',
        question: 'Why is my script flaky?',
        answer: 'Check the Flaky Tests page for analysis. Common causes: missing waits, dynamic selectors, race conditions. Self-Healing can help fix issues.',
        keywords: ['flaky', 'unstable', 'intermittent', 'fail'],
      },
    ],
  },
  execution: {
    title: 'Execution Help',
    topics: [
      {
        id: 'trigger-execution',
        question: 'How do I trigger a test execution?',
        answer: 'Go to Executions page and click "New Execution". Select environment, test suite, and configuration options.',
        keywords: ['trigger', 'run', 'execute', 'start'],
      },
      {
        id: 'view-results',
        question: 'How do I view execution results?',
        answer: 'Click on any execution to see detailed results including pass/fail status, screenshots, logs, and timing.',
        keywords: ['view', 'results', 'report', 'status'],
      },
      {
        id: 'retry-failed',
        question: 'How do I retry failed tests?',
        answer: 'Open the execution details and click "Retry Failed" to re-run only the failed test cases.',
        keywords: ['retry', 'rerun', 'failed', 'again'],
      },
    ],
  },
  general: {
    title: 'TestForge Help',
    topics: [
      {
        id: 'getting-started',
        question: 'How do I get started with TestForge?',
        answer: 'Start by creating a project, then add requirements, generate test cases with AI, and create automation scripts.',
        keywords: ['start', 'begin', 'new', 'setup'],
      },
      {
        id: 'report-bug',
        question: 'How do I report a bug in TestForge?',
        answer: 'Start a new chat, select "Bug Report" category, and describe the issue. Include steps to reproduce if possible.',
        keywords: ['bug', 'report', 'issue', 'problem'],
      },
      {
        id: 'request-feature',
        question: 'How do I request a new feature?',
        answer: 'Start a new chat, select "Feature Request" category, and describe what you need and why it would be helpful.',
        keywords: ['feature', 'request', 'new', 'want'],
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
  // Messaging (No AI)
  // ===========================================================================

  async sendMessage(conversationId: string, content: string): Promise<ChatMessage> {
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
    const message = await prisma.chatMessage.create({
      data: {
        conversationId,
        role: 'user',
        content: sanitizedContent,
      },
    });

    // Update conversation timestamp
    await prisma.chatConversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    return message;
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
    return HELP_CONTENT[contextType] || HELP_CONTENT.general;
  }

  searchHelp(query: string): HelpTopic[] {
    const queryLower = query.toLowerCase();
    const results: HelpTopic[] = [];

    for (const content of Object.values(HELP_CONTENT)) {
      for (const topic of content.topics) {
        const matchesQuestion = topic.question.toLowerCase().includes(queryLower);
        const matchesAnswer = topic.answer.toLowerCase().includes(queryLower);
        const matchesKeyword = topic.keywords.some(k => queryLower.includes(k) || k.includes(queryLower));

        if (matchesQuestion || matchesAnswer || matchesKeyword) {
          results.push(topic);
        }
      }
    }

    return results;
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

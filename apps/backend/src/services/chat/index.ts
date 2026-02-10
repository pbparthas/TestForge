/**
 * Chat Service
 * Support/help chat system for TestForge (FAQ + Support Tickets)
 */

import { prisma } from '../../utils/prisma.js';
import { NotFoundError, ValidationError } from '../../errors/index.js';
import type {
  ChatConversation,
  ChatMessage,
  ChatSuggestion,
  ChatConversationStatus,
  ChatConversationCategory,
  ChatSuggestionStatus,
  ChatSuggestionType,
} from '@prisma/client';

import type { HelpContent, HelpTopic } from './help-content.js';
import {
  HELP_CONTENT,
  getContextualHelp as getContextualHelpFn,
  searchHelp as searchHelpFn,
} from './help-content.js';
import {
  JAILBREAK_PATTERNS,
  detectJailbreak as detectJailbreakFn,
  sanitizeInput as sanitizeInputFn,
} from './security.js';

// Re-export types and utilities from sub-modules
export type { HelpContent, HelpTopic } from './help-content.js';
export { HELP_CONTENT } from './help-content.js';
export { JAILBREAK_PATTERNS } from './security.js';

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
          content: `**Bug Report Logged** \u2713\n\nThank you for reporting this issue. Your bug report has been logged and will be reviewed by the TestForge team.\n\n**What happens next:**\n1. Our team will review your report\n2. We may ask follow-up questions in this conversation\n3. You'll be notified when the issue is addressed\n\nFeel free to add more details, screenshots, or steps to reproduce.`,
        },
      });
    } else if (conversation.category === 'feature_request') {
      systemMessage = await prisma.chatMessage.create({
        data: {
          conversationId,
          role: 'system',
          content: `**Feature Request Logged** \u2713\n\nThank you for your suggestion! Your feature request has been logged for the product team to review.\n\n**What happens next:**\n1. Product team evaluates the request\n2. Highly requested features get prioritized\n3. You'll be notified if we implement it\n\nFeel free to add more context about your use case or why this feature would help.`,
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
      return 'Hello! Welcome to TestForge Help. I can help you with:\n\n\u2022 **ScriptSmith Pro** - Generate automation scripts (5 input methods: Record, Upload, Screenshot, Describe, Edit)\n\u2022 **TestWeaver AI** - Generate test cases from requirements\n\u2022 **CodeGuardian** - Generate unit tests\n\u2022 **FlowPilot** - Generate API tests\n\u2022 **Self-Healing** - Fix broken tests\n\u2022 **Visual Testing** - Visual regression testing\n\nWhat would you like help with?';
    }

    switch (category) {
      case 'bug_report':
        return 'Thank you for reporting this issue. I\'ve logged it for our team to review. In the meantime:\n\n\u2022 Try refreshing the page\n\u2022 Clear browser cache (Ctrl+Shift+Delete)\n\u2022 Check if the issue persists in incognito mode\n\nWe\'ll get back to you soon.';
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
  // Contextual Help (delegates to help-content module)
  // ===========================================================================

  getContextualHelp(contextType: string): HelpContent {
    return getContextualHelpFn(contextType);
  }

  searchHelp(query: string): HelpTopic[] {
    return searchHelpFn(query);
  }

  // ===========================================================================
  // Security (delegates to security module)
  // ===========================================================================

  detectJailbreak(content: string): boolean {
    return detectJailbreakFn(content);
  }

  sanitizeInput(content: string): string {
    return sanitizeInputFn(content);
  }
}

export const chatService = new ChatService();

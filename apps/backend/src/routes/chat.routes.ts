/**
 * Chat Routes
 * Support/help chat endpoints
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { chatService } from '../services/chat.service.js';
import { ValidationError } from '../errors/index.js';
import { asyncHandler } from '../utils/async-handler.js';

// Async handler wrapper
const router = Router();

// All routes require authentication
router.use(authenticate);

// =============================================================================
// Conversation Routes
// =============================================================================

/**
 * Create a new conversation
 * POST /api/chat/conversations
 */
router.post(
  '/conversations',
  asyncHandler(async (req, res) => {
    const { projectId, contextType, contextId, title, category } = req.body;

    const conversation = await chatService.createConversation({
      userId: req.user!.userId,
      projectId,
      contextType,
      contextId,
      title,
      category,
    });

    res.status(201).json({
      message: 'Conversation created',
      data: conversation,
    });
  })
);

/**
 * Get user's conversations
 * GET /api/chat/conversations
 */
router.get(
  '/conversations',
  asyncHandler(async (req, res) => {
    const { status, category, projectId, limit, offset } = req.query;

    const result = await chatService.getUserConversations(req.user!.userId, {
      status: status as any,
      category: category as any,
      projectId: projectId as string,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      offset: offset ? parseInt(offset as string, 10) : undefined,
    });

    res.json({
      data: result.data,
      total: result.total,
    });
  })
);

/**
 * Get a specific conversation
 * GET /api/chat/conversations/:id
 */
router.get(
  '/conversations/:id',
  asyncHandler(async (req, res) => {
    const conversation = await chatService.getConversation(req.params.id);

    // Verify ownership
    if (conversation.userId !== req.user!.userId && req.user!.role !== 'admin') {
      throw new ValidationError('You do not have access to this conversation');
    }

    res.json({ data: conversation });
  })
);

/**
 * Update a conversation
 * PATCH /api/chat/conversations/:id
 */
router.patch(
  '/conversations/:id',
  asyncHandler(async (req, res) => {
    const { title, status } = req.body;

    // Verify ownership first
    const existing = await chatService.getConversation(req.params.id);
    if (existing.userId !== req.user!.userId && req.user!.role !== 'admin') {
      throw new ValidationError('You do not have access to this conversation');
    }

    const conversation = await chatService.updateConversation(req.params.id, {
      title,
      status,
    });

    res.json({
      message: 'Conversation updated',
      data: conversation,
    });
  })
);

/**
 * Delete a conversation
 * DELETE /api/chat/conversations/:id
 */
router.delete(
  '/conversations/:id',
  asyncHandler(async (req, res) => {
    // Verify ownership first
    const existing = await chatService.getConversation(req.params.id);
    if (existing.userId !== req.user!.userId && req.user!.role !== 'admin') {
      throw new ValidationError('You do not have access to this conversation');
    }

    await chatService.deleteConversation(req.params.id);

    res.json({ message: 'Conversation deleted' });
  })
);

// =============================================================================
// Message Routes
// =============================================================================

/**
 * Send a message in a conversation (returns help suggestions)
 * POST /api/chat/conversations/:id/messages
 */
router.post(
  '/conversations/:id/messages',
  asyncHandler(async (req, res) => {
    const { content } = req.body;

    if (!content || typeof content !== 'string') {
      throw new ValidationError('Message content is required');
    }

    // Verify ownership first
    const existing = await chatService.getConversation(req.params.id);
    if (existing.userId !== req.user!.userId && req.user!.role !== 'admin') {
      throw new ValidationError('You do not have access to this conversation');
    }

    const result = await chatService.sendMessage(req.params.id, content);

    res.status(201).json({
      message: 'Message sent',
      data: result.userMessage,
      systemMessage: result.systemMessage,
      suggestions: result.suggestions,
    });
  })
);

/**
 * Get messages in a conversation
 * GET /api/chat/conversations/:id/messages
 */
router.get(
  '/conversations/:id/messages',
  asyncHandler(async (req, res) => {
    const { limit, offset } = req.query;

    // Verify ownership first
    const existing = await chatService.getConversation(req.params.id);
    if (existing.userId !== req.user!.userId && req.user!.role !== 'admin') {
      throw new ValidationError('You do not have access to this conversation');
    }

    const result = await chatService.getMessages(req.params.id, {
      limit: limit ? parseInt(limit as string, 10) : undefined,
      offset: offset ? parseInt(offset as string, 10) : undefined,
    });

    res.json({
      data: result.data,
      total: result.total,
    });
  })
);

// =============================================================================
// Suggestion Routes
// =============================================================================

/**
 * Get suggestions for a conversation
 * GET /api/chat/conversations/:id/suggestions
 */
router.get(
  '/conversations/:id/suggestions',
  asyncHandler(async (req, res) => {
    const { status } = req.query;

    // Verify ownership first
    const existing = await chatService.getConversation(req.params.id);
    if (existing.userId !== req.user!.userId && req.user!.role !== 'admin') {
      throw new ValidationError('You do not have access to this conversation');
    }

    const suggestions = await chatService.getSuggestions(req.params.id, {
      status: status as any,
    });

    res.json({ data: suggestions });
  })
);

/**
 * Acknowledge a suggestion
 * POST /api/chat/suggestions/:id/acknowledge
 */
router.post(
  '/suggestions/:id/acknowledge',
  asyncHandler(async (req, res) => {
    const suggestion = await chatService.acknowledgeSuggestion(
      req.params.id,
      req.user!.userId
    );

    res.json({
      message: 'Suggestion acknowledged',
      data: suggestion,
    });
  })
);

/**
 * Dismiss a suggestion
 * POST /api/chat/suggestions/:id/dismiss
 */
router.post(
  '/suggestions/:id/dismiss',
  asyncHandler(async (req, res) => {
    const suggestion = await chatService.dismissSuggestion(req.params.id);

    res.json({
      message: 'Suggestion dismissed',
      data: suggestion,
    });
  })
);

// =============================================================================
// Admin Routes (Admin Only)
// =============================================================================

/**
 * Get all conversations (admin only)
 * GET /api/chat/conversations/admin
 */
router.get(
  '/conversations/admin',
  asyncHandler(async (req, res) => {
    // Admin only
    if (req.user!.role !== 'admin' && req.user!.role !== 'lead') {
      throw new ValidationError('Admin access required');
    }

    const { status, category, limit, offset } = req.query;

    const result = await chatService.getAllConversations({
      status: status as any,
      category: category as any,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      offset: offset ? parseInt(offset as string, 10) : undefined,
    });

    res.json({
      data: result.data,
      total: result.total,
    });
  })
);

/**
 * Admin reply to a conversation
 * POST /api/chat/conversations/:id/admin-reply
 */
router.post(
  '/conversations/:id/admin-reply',
  asyncHandler(async (req, res) => {
    // Admin only
    if (req.user!.role !== 'admin' && req.user!.role !== 'lead') {
      throw new ValidationError('Admin access required');
    }

    const { content } = req.body;

    if (!content || typeof content !== 'string') {
      throw new ValidationError('Reply content is required');
    }

    const message = await chatService.addAdminReply(
      req.params.id,
      content,
      req.user!.userId
    );

    res.status(201).json({
      message: 'Reply sent',
      data: message,
    });
  })
);

// =============================================================================
// Help Content Routes
// =============================================================================

/**
 * Get contextual help
 * GET /api/chat/help/:contextType
 */
router.get(
  '/help/:contextType',
  asyncHandler(async (req, res) => {
    const help = chatService.getContextualHelp(req.params.contextType);

    res.json({ data: help });
  })
);

/**
 * Search help topics
 * GET /api/chat/help/search
 */
router.get(
  '/help',
  asyncHandler(async (req, res) => {
    const { q } = req.query;

    if (!q || typeof q !== 'string') {
      // Return general help if no query
      const help = chatService.getContextualHelp('general');
      return res.json({ data: help.topics });
    }

    const results = chatService.searchHelp(q);

    res.json({ data: results });
  })
);

export default router;

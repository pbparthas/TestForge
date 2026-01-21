/**
 * Help Routes
 * Feedback management endpoints
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import { helpService } from '../services/help.service.js';
import { ValidationError } from '../errors/index.js';

// Async handler wrapper
function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

const router = Router();

// =============================================================================
// Public Feedback Submission (authenticated users)
// =============================================================================

/**
 * Submit feedback
 * POST /api/help/feedback
 */
router.post(
  '/feedback',
  authenticate,
  asyncHandler(async (req, res) => {
    const { feedbackType, content, pageContext, screenshotUrl } = req.body;

    if (!feedbackType || !['bug', 'feature', 'question', 'other'].includes(feedbackType)) {
      throw new ValidationError('Valid feedback type is required (bug, feature, question, other)');
    }

    if (!content) {
      throw new ValidationError('Feedback content is required');
    }

    const feedback = await helpService.submitFeedback({
      userId: req.user!.userId,
      feedbackType,
      content,
      pageContext,
      screenshotUrl,
    });

    res.status(201).json({
      message: 'Feedback submitted successfully',
      data: feedback,
    });
  })
);

/**
 * Get current user's feedback
 * GET /api/help/feedback/me
 */
router.get(
  '/feedback/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const { status, feedbackType, limit, offset } = req.query;

    const result = await helpService.getUserFeedback(req.user!.userId, {
      status: status as any,
      feedbackType: feedbackType as any,
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
// Admin Feedback Management
// =============================================================================

/**
 * Get all feedback (admin only)
 * GET /api/help/feedback
 */
router.get(
  '/feedback',
  authenticate,
  authorize(['admin', 'lead']),
  asyncHandler(async (req, res) => {
    const { status, feedbackType, userId, limit, offset } = req.query;

    const result = await helpService.getAllFeedback({
      status: status as any,
      feedbackType: feedbackType as any,
      userId: userId as string,
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
 * Get feedback statistics (admin only)
 * GET /api/help/feedback/stats
 */
router.get(
  '/feedback/stats',
  authenticate,
  authorize(['admin', 'lead']),
  asyncHandler(async (req, res) => {
    const stats = await helpService.getFeedbackStats();

    res.json({ data: stats });
  })
);

/**
 * Get specific feedback (admin only)
 * GET /api/help/feedback/:id
 */
router.get(
  '/feedback/:id',
  authenticate,
  authorize(['admin', 'lead']),
  asyncHandler(async (req, res) => {
    const feedback = await helpService.getFeedback(req.params.id);

    res.json({ data: feedback });
  })
);

/**
 * Update feedback status (admin only)
 * PATCH /api/help/feedback/:id
 */
router.patch(
  '/feedback/:id',
  authenticate,
  authorize(['admin', 'lead']),
  asyncHandler(async (req, res) => {
    const { status } = req.body;

    if (!status || !['new_feedback', 'reviewed', 'resolved'].includes(status)) {
      throw new ValidationError('Valid status is required (new_feedback, reviewed, resolved)');
    }

    const feedback = await helpService.updateFeedbackStatus(req.params.id, status);

    res.json({
      message: 'Feedback status updated',
      data: feedback,
    });
  })
);

/**
 * Delete feedback (admin only)
 * DELETE /api/help/feedback/:id
 */
router.delete(
  '/feedback/:id',
  authenticate,
  authorize(['admin']),
  asyncHandler(async (req, res) => {
    await helpService.deleteFeedback(req.params.id);

    res.json({ message: 'Feedback deleted' });
  })
);

export default router;

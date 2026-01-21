/**
 * Help Service
 * Feedback management for TestForge
 */

import { prisma } from '../utils/prisma.js';
import { NotFoundError, ValidationError } from '../errors/index.js';
import type {
  HelpFeedback,
  HelpFeedbackType,
  HelpFeedbackStatus,
} from '@prisma/client';

// =============================================================================
// Types
// =============================================================================

export interface SubmitFeedbackInput {
  userId?: string;
  feedbackType: HelpFeedbackType;
  content: string;
  pageContext?: string;
  screenshotUrl?: string;
}

export interface FeedbackFilters {
  status?: HelpFeedbackStatus;
  feedbackType?: HelpFeedbackType;
  userId?: string;
  limit?: number;
  offset?: number;
}

export interface FeedbackStats {
  total: number;
  byStatus: {
    new_feedback: number;
    reviewed: number;
    resolved: number;
  };
  byType: {
    bug: number;
    feature: number;
    question: number;
    other: number;
  };
}

// =============================================================================
// Service
// =============================================================================

export class HelpService {
  // ===========================================================================
  // Submit Feedback
  // ===========================================================================

  async submitFeedback(input: SubmitFeedbackInput): Promise<HelpFeedback> {
    // Validate content
    if (!input.content || input.content.trim().length === 0) {
      throw new ValidationError('Feedback content is required');
    }

    if (input.content.trim().length < 10) {
      throw new ValidationError('Feedback content must be at least 10 characters');
    }

    return prisma.helpFeedback.create({
      data: {
        userId: input.userId,
        feedbackType: input.feedbackType,
        content: input.content.trim(),
        pageContext: input.pageContext,
        screenshotUrl: input.screenshotUrl,
      },
    });
  }

  // ===========================================================================
  // Get Feedback
  // ===========================================================================

  async getFeedback(id: string): Promise<HelpFeedback> {
    const feedback = await prisma.helpFeedback.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!feedback) {
      throw new NotFoundError('HelpFeedback', id);
    }

    return feedback;
  }

  async getAllFeedback(
    filters?: FeedbackFilters
  ): Promise<{ data: HelpFeedback[]; total: number }> {
    const where = {
      ...(filters?.status && { status: filters.status }),
      ...(filters?.feedbackType && { feedbackType: filters.feedbackType }),
      ...(filters?.userId && { userId: filters.userId }),
    };

    const [data, total] = await Promise.all([
      prisma.helpFeedback.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: filters?.limit || 20,
        skip: filters?.offset || 0,
        include: { user: true },
      }),
      prisma.helpFeedback.count({ where }),
    ]);

    return { data, total };
  }

  async getUserFeedback(
    userId: string,
    filters?: Omit<FeedbackFilters, 'userId'>
  ): Promise<{ data: HelpFeedback[]; total: number }> {
    const where = {
      userId,
      ...(filters?.status && { status: filters.status }),
      ...(filters?.feedbackType && { feedbackType: filters.feedbackType }),
    };

    const [data, total] = await Promise.all([
      prisma.helpFeedback.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: filters?.limit || 20,
        skip: filters?.offset || 0,
      }),
      prisma.helpFeedback.count({ where }),
    ]);

    return { data, total };
  }

  // ===========================================================================
  // Update Feedback
  // ===========================================================================

  async updateFeedbackStatus(
    id: string,
    status: HelpFeedbackStatus
  ): Promise<HelpFeedback> {
    const existing = await prisma.helpFeedback.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundError('HelpFeedback', id);
    }

    return prisma.helpFeedback.update({
      where: { id },
      data: { status },
    });
  }

  // ===========================================================================
  // Delete Feedback
  // ===========================================================================

  async deleteFeedback(id: string): Promise<void> {
    const existing = await prisma.helpFeedback.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundError('HelpFeedback', id);
    }

    await prisma.helpFeedback.delete({
      where: { id },
    });
  }

  // ===========================================================================
  // Statistics
  // ===========================================================================

  async getFeedbackStats(): Promise<FeedbackStats> {
    const [
      total,
      newCount,
      reviewedCount,
      resolvedCount,
      bugCount,
      featureCount,
      questionCount,
      otherCount,
    ] = await Promise.all([
      prisma.helpFeedback.count(),
      prisma.helpFeedback.count({ where: { status: 'new_feedback' } }),
      prisma.helpFeedback.count({ where: { status: 'reviewed' } }),
      prisma.helpFeedback.count({ where: { status: 'resolved' } }),
      prisma.helpFeedback.count({ where: { feedbackType: 'bug' } }),
      prisma.helpFeedback.count({ where: { feedbackType: 'feature' } }),
      prisma.helpFeedback.count({ where: { feedbackType: 'question' } }),
      prisma.helpFeedback.count({ where: { feedbackType: 'other' } }),
    ]);

    return {
      total,
      byStatus: {
        new_feedback: newCount,
        reviewed: reviewedCount,
        resolved: resolvedCount,
      },
      byType: {
        bug: bugCount,
        feature: featureCount,
        question: questionCount,
        other: otherCount,
      },
    };
  }
}

export const helpService = new HelpService();

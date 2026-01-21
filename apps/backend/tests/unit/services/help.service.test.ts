/**
 * Help Service Tests
 * TDD for feedback/help system
 */

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    helpFeedback: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock('../../../src/utils/prisma.js', () => ({ prisma: mockPrisma }));

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HelpService } from '../../../src/services/help.service.js';
import { NotFoundError, ValidationError } from '../../../src/errors/index.js';

describe('HelpService', () => {
  let service: HelpService;

  const mockFeedback = {
    id: 'fb-123',
    userId: 'user-123',
    feedbackType: 'bug',
    pageContext: '/test-suites',
    content: 'The run button is not working',
    screenshotUrl: null,
    status: 'new_feedback',
    createdAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new HelpService();
  });

  // ===========================================================================
  // Submit Feedback Tests
  // ===========================================================================

  describe('submitFeedback', () => {
    it('should create a bug report', async () => {
      mockPrisma.helpFeedback.create.mockResolvedValue(mockFeedback);

      const result = await service.submitFeedback({
        userId: 'user-123',
        feedbackType: 'bug',
        content: 'The run button is not working',
        pageContext: '/test-suites',
      });

      expect(mockPrisma.helpFeedback.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-123',
          feedbackType: 'bug',
          content: 'The run button is not working',
          pageContext: '/test-suites',
          screenshotUrl: undefined,
        },
      });
      expect(result).toEqual(mockFeedback);
    });

    it('should create a feature request', async () => {
      const featureFeedback = { ...mockFeedback, feedbackType: 'feature', content: 'Add dark mode' };
      mockPrisma.helpFeedback.create.mockResolvedValue(featureFeedback);

      const result = await service.submitFeedback({
        userId: 'user-123',
        feedbackType: 'feature',
        content: 'Add dark mode',
      });

      expect(result.feedbackType).toBe('feature');
    });

    it('should create a question', async () => {
      const questionFeedback = { ...mockFeedback, feedbackType: 'question' };
      mockPrisma.helpFeedback.create.mockResolvedValue(questionFeedback);

      const result = await service.submitFeedback({
        userId: 'user-123',
        feedbackType: 'question',
        content: 'How do I run tests?',
      });

      expect(result.feedbackType).toBe('question');
    });

    it('should include screenshot URL if provided', async () => {
      const feedbackWithScreenshot = { ...mockFeedback, screenshotUrl: 'https://example.com/screenshot.png' };
      mockPrisma.helpFeedback.create.mockResolvedValue(feedbackWithScreenshot);

      const result = await service.submitFeedback({
        userId: 'user-123',
        feedbackType: 'bug',
        content: 'Bug report',
        screenshotUrl: 'https://example.com/screenshot.png',
      });

      expect(mockPrisma.helpFeedback.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          screenshotUrl: 'https://example.com/screenshot.png',
        }),
      });
      expect(result.screenshotUrl).toBe('https://example.com/screenshot.png');
    });

    it('should allow anonymous feedback (no userId)', async () => {
      const anonFeedback = { ...mockFeedback, userId: null };
      mockPrisma.helpFeedback.create.mockResolvedValue(anonFeedback);

      const result = await service.submitFeedback({
        feedbackType: 'bug',
        content: 'Anonymous bug report',
      });

      expect(mockPrisma.helpFeedback.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: undefined,
        }),
      });
      expect(result.userId).toBeNull();
    });

    it('should throw ValidationError for empty content', async () => {
      await expect(
        service.submitFeedback({
          feedbackType: 'bug',
          content: '',
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for content that is too short', async () => {
      await expect(
        service.submitFeedback({
          feedbackType: 'bug',
          content: 'hi',
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  // ===========================================================================
  // Get Feedback Tests
  // ===========================================================================

  describe('getFeedback', () => {
    it('should return feedback by ID', async () => {
      mockPrisma.helpFeedback.findUnique.mockResolvedValue(mockFeedback);

      const result = await service.getFeedback('fb-123');

      expect(mockPrisma.helpFeedback.findUnique).toHaveBeenCalledWith({
        where: { id: 'fb-123' },
        include: { user: true },
      });
      expect(result).toEqual(mockFeedback);
    });

    it('should throw NotFoundError when feedback not found', async () => {
      mockPrisma.helpFeedback.findUnique.mockResolvedValue(null);

      await expect(service.getFeedback('not-found')).rejects.toThrow(NotFoundError);
    });
  });

  describe('getAllFeedback', () => {
    it('should return all feedback with pagination', async () => {
      mockPrisma.helpFeedback.findMany.mockResolvedValue([mockFeedback]);
      mockPrisma.helpFeedback.count.mockResolvedValue(1);

      const result = await service.getAllFeedback({ limit: 10, offset: 0 });

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by status', async () => {
      mockPrisma.helpFeedback.findMany.mockResolvedValue([mockFeedback]);
      mockPrisma.helpFeedback.count.mockResolvedValue(1);

      await service.getAllFeedback({ status: 'new_feedback' });

      expect(mockPrisma.helpFeedback.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'new_feedback' }),
        })
      );
    });

    it('should filter by feedback type', async () => {
      mockPrisma.helpFeedback.findMany.mockResolvedValue([mockFeedback]);
      mockPrisma.helpFeedback.count.mockResolvedValue(1);

      await service.getAllFeedback({ feedbackType: 'bug' });

      expect(mockPrisma.helpFeedback.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ feedbackType: 'bug' }),
        })
      );
    });

    it('should filter by user ID', async () => {
      mockPrisma.helpFeedback.findMany.mockResolvedValue([mockFeedback]);
      mockPrisma.helpFeedback.count.mockResolvedValue(1);

      await service.getAllFeedback({ userId: 'user-123' });

      expect(mockPrisma.helpFeedback.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: 'user-123' }),
        })
      );
    });
  });

  describe('getUserFeedback', () => {
    it('should return feedback for a specific user', async () => {
      mockPrisma.helpFeedback.findMany.mockResolvedValue([mockFeedback]);
      mockPrisma.helpFeedback.count.mockResolvedValue(1);

      const result = await service.getUserFeedback('user-123');

      expect(mockPrisma.helpFeedback.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-123' },
        })
      );
      expect(result.data).toHaveLength(1);
    });
  });

  // ===========================================================================
  // Update Feedback Tests
  // ===========================================================================

  describe('updateFeedbackStatus', () => {
    it('should update feedback status to reviewed', async () => {
      mockPrisma.helpFeedback.findUnique.mockResolvedValue(mockFeedback);
      mockPrisma.helpFeedback.update.mockResolvedValue({
        ...mockFeedback,
        status: 'reviewed',
      });

      const result = await service.updateFeedbackStatus('fb-123', 'reviewed');

      expect(mockPrisma.helpFeedback.update).toHaveBeenCalledWith({
        where: { id: 'fb-123' },
        data: { status: 'reviewed' },
      });
      expect(result.status).toBe('reviewed');
    });

    it('should update feedback status to resolved', async () => {
      mockPrisma.helpFeedback.findUnique.mockResolvedValue({
        ...mockFeedback,
        status: 'reviewed',
      });
      mockPrisma.helpFeedback.update.mockResolvedValue({
        ...mockFeedback,
        status: 'resolved',
      });

      const result = await service.updateFeedbackStatus('fb-123', 'resolved');

      expect(result.status).toBe('resolved');
    });

    it('should throw NotFoundError when feedback not found', async () => {
      mockPrisma.helpFeedback.findUnique.mockResolvedValue(null);

      await expect(service.updateFeedbackStatus('not-found', 'reviewed')).rejects.toThrow(NotFoundError);
    });
  });

  // ===========================================================================
  // Delete Feedback Tests
  // ===========================================================================

  describe('deleteFeedback', () => {
    it('should delete feedback', async () => {
      mockPrisma.helpFeedback.findUnique.mockResolvedValue(mockFeedback);
      mockPrisma.helpFeedback.delete.mockResolvedValue(mockFeedback);

      await service.deleteFeedback('fb-123');

      expect(mockPrisma.helpFeedback.delete).toHaveBeenCalledWith({
        where: { id: 'fb-123' },
      });
    });

    it('should throw NotFoundError when feedback not found', async () => {
      mockPrisma.helpFeedback.findUnique.mockResolvedValue(null);

      await expect(service.deleteFeedback('not-found')).rejects.toThrow(NotFoundError);
    });
  });

  // ===========================================================================
  // Feedback Stats Tests
  // ===========================================================================

  describe('getFeedbackStats', () => {
    it('should return feedback statistics', async () => {
      mockPrisma.helpFeedback.count
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(5)  // new
        .mockResolvedValueOnce(3)  // reviewed
        .mockResolvedValueOnce(2)  // resolved
        .mockResolvedValueOnce(4)  // bugs
        .mockResolvedValueOnce(3)  // features
        .mockResolvedValueOnce(2)  // questions
        .mockResolvedValueOnce(1); // other

      const result = await service.getFeedbackStats();

      expect(result).toEqual({
        total: 10,
        byStatus: {
          new_feedback: 5,
          reviewed: 3,
          resolved: 2,
        },
        byType: {
          bug: 4,
          feature: 3,
          question: 2,
          other: 1,
        },
      });
    });
  });
});

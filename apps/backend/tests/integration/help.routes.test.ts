/**
 * Help Routes Integration Tests
 */

const { mockHelpService, mockJwt } = vi.hoisted(() => ({
  mockHelpService: {
    submitFeedback: vi.fn(),
    getFeedback: vi.fn(),
    getAllFeedback: vi.fn(),
    getUserFeedback: vi.fn(),
    updateFeedbackStatus: vi.fn(),
    deleteFeedback: vi.fn(),
    getFeedbackStats: vi.fn(),
  },
  mockJwt: { verify: vi.fn(), sign: vi.fn() },
}));

vi.mock('../../src/services/help.service.js', () => ({
  helpService: mockHelpService,
}));
vi.mock('jsonwebtoken', () => ({ default: mockJwt }));

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';

describe('Help Routes', () => {
  const userToken = 'user-token';
  const adminToken = 'admin-token';
  const leadToken = 'lead-token';

  const mockFeedback = {
    id: '550e8400-e29b-41d4-a716-446655440001',
    userId: 'user-123',
    feedbackType: 'bug',
    content: 'The button is not working properly',
    pageContext: '/test-suites',
    screenshotUrl: null,
    status: 'new_feedback',
    createdAt: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockJwt.verify.mockImplementation((token) => {
      if (token === userToken) return { userId: 'user-123', role: 'qae' };
      if (token === adminToken) return { userId: 'admin-123', role: 'admin' };
      if (token === leadToken) return { userId: 'lead-123', role: 'lead' };
      throw new Error('Invalid token');
    });
  });

  // ===========================================================================
  // Submit Feedback Tests
  // ===========================================================================

  describe('POST /api/help/feedback', () => {
    it('should submit bug feedback', async () => {
      mockHelpService.submitFeedback.mockResolvedValue(mockFeedback);

      const res = await request(app)
        .post('/api/help/feedback')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          feedbackType: 'bug',
          content: 'The button is not working properly',
          pageContext: '/test-suites',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.feedbackType).toBe('bug');
      expect(res.body.message).toBe('Feedback submitted successfully');
    });

    it('should submit feature request', async () => {
      mockHelpService.submitFeedback.mockResolvedValue({
        ...mockFeedback,
        feedbackType: 'feature',
        content: 'Add dark mode please',
      });

      const res = await request(app)
        .post('/api/help/feedback')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          feedbackType: 'feature',
          content: 'Add dark mode please',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.feedbackType).toBe('feature');
    });

    it('should return 400 for invalid feedback type', async () => {
      const res = await request(app)
        .post('/api/help/feedback')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          feedbackType: 'invalid',
          content: 'Some content',
        });

      expect(res.status).toBe(400);
    });

    it('should return 400 for missing content', async () => {
      const res = await request(app)
        .post('/api/help/feedback')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          feedbackType: 'bug',
        });

      expect(res.status).toBe(400);
    });

    it('should return 401 without auth', async () => {
      const res = await request(app)
        .post('/api/help/feedback')
        .send({
          feedbackType: 'bug',
          content: 'Test',
        });

      expect(res.status).toBe(401);
    });
  });

  // ===========================================================================
  // Get User Feedback Tests
  // ===========================================================================

  describe('GET /api/help/feedback/me', () => {
    it('should return user feedback', async () => {
      mockHelpService.getUserFeedback.mockResolvedValue({
        data: [mockFeedback],
        total: 1,
      });

      const res = await request(app)
        .get('/api/help/feedback/me')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.total).toBe(1);
    });

    it('should support filtering', async () => {
      mockHelpService.getUserFeedback.mockResolvedValue({
        data: [mockFeedback],
        total: 1,
      });

      const res = await request(app)
        .get('/api/help/feedback/me?feedbackType=bug&status=new_feedback')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(mockHelpService.getUserFeedback).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({
          feedbackType: 'bug',
          status: 'new_feedback',
        })
      );
    });
  });

  // ===========================================================================
  // Admin Feedback Management Tests
  // ===========================================================================

  describe('GET /api/help/feedback', () => {
    it('should return all feedback for admin', async () => {
      mockHelpService.getAllFeedback.mockResolvedValue({
        data: [mockFeedback],
        total: 1,
      });

      const res = await request(app)
        .get('/api/help/feedback')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    it('should return all feedback for lead', async () => {
      mockHelpService.getAllFeedback.mockResolvedValue({
        data: [mockFeedback],
        total: 1,
      });

      const res = await request(app)
        .get('/api/help/feedback')
        .set('Authorization', `Bearer ${leadToken}`);

      expect(res.status).toBe(200);
    });

    it('should return 403 for regular user', async () => {
      const res = await request(app)
        .get('/api/help/feedback')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/help/feedback/stats', () => {
    it('should return feedback stats for admin', async () => {
      mockHelpService.getFeedbackStats.mockResolvedValue({
        total: 10,
        byStatus: { new_feedback: 5, reviewed: 3, resolved: 2 },
        byType: { bug: 4, feature: 3, question: 2, other: 1 },
      });

      const res = await request(app)
        .get('/api/help/feedback/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(10);
      expect(res.body.data.byStatus.new_feedback).toBe(5);
    });

    it('should return 403 for regular user', async () => {
      const res = await request(app)
        .get('/api/help/feedback/stats')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/help/feedback/:id', () => {
    it('should return specific feedback for admin', async () => {
      mockHelpService.getFeedback.mockResolvedValue(mockFeedback);

      const res = await request(app)
        .get(`/api/help/feedback/${mockFeedback.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(mockFeedback.id);
    });

    it('should return 403 for regular user', async () => {
      const res = await request(app)
        .get(`/api/help/feedback/${mockFeedback.id}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('PATCH /api/help/feedback/:id', () => {
    it('should update feedback status for admin', async () => {
      mockHelpService.updateFeedbackStatus.mockResolvedValue({
        ...mockFeedback,
        status: 'reviewed',
      });

      const res = await request(app)
        .patch(`/api/help/feedback/${mockFeedback.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'reviewed' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('reviewed');
    });

    it('should return 400 for invalid status', async () => {
      const res = await request(app)
        .patch(`/api/help/feedback/${mockFeedback.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'invalid' });

      expect(res.status).toBe(400);
    });

    it('should return 403 for regular user', async () => {
      const res = await request(app)
        .patch(`/api/help/feedback/${mockFeedback.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ status: 'reviewed' });

      expect(res.status).toBe(403);
    });
  });

  describe('DELETE /api/help/feedback/:id', () => {
    it('should delete feedback for admin', async () => {
      mockHelpService.deleteFeedback.mockResolvedValue(undefined);

      const res = await request(app)
        .delete(`/api/help/feedback/${mockFeedback.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Feedback deleted');
    });

    it('should return 403 for lead (only admin can delete)', async () => {
      const res = await request(app)
        .delete(`/api/help/feedback/${mockFeedback.id}`)
        .set('Authorization', `Bearer ${leadToken}`);

      expect(res.status).toBe(403);
    });

    it('should return 403 for regular user', async () => {
      const res = await request(app)
        .delete(`/api/help/feedback/${mockFeedback.id}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(403);
    });
  });
});

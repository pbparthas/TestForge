/**
 * Chat Routes Integration Tests
 */

const { mockChatService, mockJwt } = vi.hoisted(() => ({
  mockChatService: {
    createConversation: vi.fn(),
    getConversation: vi.fn(),
    getUserConversations: vi.fn(),
    updateConversation: vi.fn(),
    deleteConversation: vi.fn(),
    sendMessage: vi.fn(),
    getMessages: vi.fn(),
    getSuggestions: vi.fn(),
    acknowledgeSuggestion: vi.fn(),
    dismissSuggestion: vi.fn(),
    getContextualHelp: vi.fn(),
    searchHelp: vi.fn(),
  },
  mockJwt: { verify: vi.fn(), sign: vi.fn() },
}));

vi.mock('../../src/services/chat.service.js', () => ({
  chatService: mockChatService,
}));
vi.mock('jsonwebtoken', () => ({ default: mockJwt }));

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';

describe('Chat Routes', () => {
  const userToken = 'user-token';
  const adminToken = 'admin-token';

  const mockConversation = {
    id: '550e8400-e29b-41d4-a716-446655440001',
    userId: 'user-123',
    projectId: 'proj-123',
    title: 'Help with testing',
    category: 'help_question',
    status: 'active',
    messages: [],
    suggestions: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockMessage = {
    id: '550e8400-e29b-41d4-a716-446655440002',
    conversationId: mockConversation.id,
    role: 'user',
    content: 'How do I run tests?',
    createdAt: new Date().toISOString(),
  };

  const mockSuggestion = {
    id: '550e8400-e29b-41d4-a716-446655440003',
    conversationId: mockConversation.id,
    suggestionType: 'navigation',
    suggestedContent: 'Go to Executions page',
    status: 'pending',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockJwt.verify.mockImplementation((token) => {
      if (token === userToken) return { userId: 'user-123', role: 'qae' };
      if (token === adminToken) return { userId: 'admin-123', role: 'admin' };
      throw new Error('Invalid token');
    });
  });

  // ===========================================================================
  // Conversation Tests
  // ===========================================================================

  describe('POST /api/chat/conversations', () => {
    it('should create a conversation', async () => {
      mockChatService.createConversation.mockResolvedValue(mockConversation);

      const res = await request(app)
        .post('/api/chat/conversations')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ title: 'Help with testing', category: 'help_question' });

      expect(res.status).toBe(201);
      expect(res.body.data.title).toBe('Help with testing');
    });

    it('should return 401 without auth', async () => {
      const res = await request(app)
        .post('/api/chat/conversations')
        .send({ title: 'Test' });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/chat/conversations', () => {
    it('should return user conversations', async () => {
      mockChatService.getUserConversations.mockResolvedValue({
        data: [mockConversation],
        total: 1,
      });

      const res = await request(app)
        .get('/api/chat/conversations')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.total).toBe(1);
    });

    it('should support filtering by category', async () => {
      mockChatService.getUserConversations.mockResolvedValue({
        data: [mockConversation],
        total: 1,
      });

      const res = await request(app)
        .get('/api/chat/conversations?category=feature_request')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(mockChatService.getUserConversations).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({ category: 'feature_request' })
      );
    });
  });

  describe('GET /api/chat/conversations/:id', () => {
    it('should return a conversation', async () => {
      mockChatService.getConversation.mockResolvedValue(mockConversation);

      const res = await request(app)
        .get(`/api/chat/conversations/${mockConversation.id}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(mockConversation.id);
    });

    it('should deny access to other users conversation', async () => {
      mockChatService.getConversation.mockResolvedValue({
        ...mockConversation,
        userId: 'other-user',
      });

      const res = await request(app)
        .get(`/api/chat/conversations/${mockConversation.id}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(400);
    });

    it('should allow admin to access any conversation', async () => {
      mockChatService.getConversation.mockResolvedValue({
        ...mockConversation,
        userId: 'other-user',
      });

      const res = await request(app)
        .get(`/api/chat/conversations/${mockConversation.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
    });
  });

  describe('PATCH /api/chat/conversations/:id', () => {
    it('should update a conversation', async () => {
      mockChatService.getConversation.mockResolvedValue(mockConversation);
      mockChatService.updateConversation.mockResolvedValue({
        ...mockConversation,
        title: 'Updated title',
      });

      const res = await request(app)
        .patch(`/api/chat/conversations/${mockConversation.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ title: 'Updated title' });

      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe('Updated title');
    });
  });

  describe('DELETE /api/chat/conversations/:id', () => {
    it('should delete a conversation', async () => {
      mockChatService.getConversation.mockResolvedValue(mockConversation);
      mockChatService.deleteConversation.mockResolvedValue(undefined);

      const res = await request(app)
        .delete(`/api/chat/conversations/${mockConversation.id}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Conversation deleted');
    });
  });

  // ===========================================================================
  // Message Tests
  // ===========================================================================

  describe('POST /api/chat/conversations/:id/messages', () => {
    it('should send a message', async () => {
      mockChatService.getConversation.mockResolvedValue(mockConversation);
      mockChatService.sendMessage.mockResolvedValue(mockMessage);

      const res = await request(app)
        .post(`/api/chat/conversations/${mockConversation.id}/messages`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ content: 'How do I run tests?' });

      expect(res.status).toBe(201);
      expect(res.body.data.content).toBe('How do I run tests?');
    });

    it('should return 400 for empty content', async () => {
      mockChatService.getConversation.mockResolvedValue(mockConversation);

      const res = await request(app)
        .post(`/api/chat/conversations/${mockConversation.id}/messages`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ content: '' });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/chat/conversations/:id/messages', () => {
    it('should return messages', async () => {
      mockChatService.getConversation.mockResolvedValue(mockConversation);
      mockChatService.getMessages.mockResolvedValue({
        data: [mockMessage],
        total: 1,
      });

      const res = await request(app)
        .get(`/api/chat/conversations/${mockConversation.id}/messages`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });
  });

  // ===========================================================================
  // Suggestion Tests
  // ===========================================================================

  describe('GET /api/chat/conversations/:id/suggestions', () => {
    it('should return suggestions', async () => {
      mockChatService.getConversation.mockResolvedValue(mockConversation);
      mockChatService.getSuggestions.mockResolvedValue([mockSuggestion]);

      const res = await request(app)
        .get(`/api/chat/conversations/${mockConversation.id}/suggestions`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });
  });

  describe('POST /api/chat/suggestions/:id/acknowledge', () => {
    it('should acknowledge a suggestion', async () => {
      mockChatService.acknowledgeSuggestion.mockResolvedValue({
        ...mockSuggestion,
        status: 'acknowledged',
      });

      const res = await request(app)
        .post(`/api/chat/suggestions/${mockSuggestion.id}/acknowledge`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('acknowledged');
    });
  });

  describe('POST /api/chat/suggestions/:id/dismiss', () => {
    it('should dismiss a suggestion', async () => {
      mockChatService.dismissSuggestion.mockResolvedValue({
        ...mockSuggestion,
        status: 'dismissed',
      });

      const res = await request(app)
        .post(`/api/chat/suggestions/${mockSuggestion.id}/dismiss`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('dismissed');
    });
  });

  // ===========================================================================
  // Help Content Tests
  // ===========================================================================

  describe('GET /api/chat/help/:contextType', () => {
    it('should return contextual help', async () => {
      mockChatService.getContextualHelp.mockReturnValue({
        title: 'Test Suite Help',
        topics: [{ id: '1', question: 'How to run?', answer: 'Click run', keywords: ['run'] }],
      });

      const res = await request(app)
        .get('/api/chat/help/test_suite')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe('Test Suite Help');
    });
  });

  describe('GET /api/chat/help', () => {
    it('should search help topics', async () => {
      mockChatService.searchHelp.mockReturnValue([
        { id: '1', question: 'How to run tests?', answer: 'Click run', keywords: ['run'] },
      ]);

      const res = await request(app)
        .get('/api/chat/help?q=run')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    it('should return general help without query', async () => {
      mockChatService.getContextualHelp.mockReturnValue({
        title: 'TestForge Help',
        topics: [],
      });

      const res = await request(app)
        .get('/api/chat/help')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
    });
  });
});

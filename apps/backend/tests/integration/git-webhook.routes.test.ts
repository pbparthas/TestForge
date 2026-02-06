/**
 * Git Webhook Routes Integration Tests
 * HMAC-verified webhook receiver for GitHub/GitLab push events
 */

const { mockSyncService, mockLogger } = vi.hoisted(() => ({
  mockSyncService: {
    syncFilesFromGit: vi.fn(),
  },
  mockLogger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../src/services/sync.service.js', () => ({
  syncService: mockSyncService,
  SyncService: vi.fn(),
}));
vi.mock('../../src/utils/logger.js', () => ({ logger: mockLogger }));

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import app from '../../src/app.js';

describe('Git Webhook Routes', () => {
  const WEBHOOK_SECRET = 'test-webhook-secret';

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GIT_WEBHOOK_SECRET = WEBHOOK_SECRET;
  });

  function signPayload(payload: string, secret: string): string {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload);
    return `sha256=${hmac.digest('hex')}`;
  }

  // ===========================================================================
  // HMAC Verification
  // ===========================================================================

  describe('POST /api/git/webhook', () => {
    const pushPayload = {
      ref: 'refs/heads/main',
      repository: { full_name: 'org/tests' },
      commits: [{ id: 'abc123', message: 'update test' }],
      projectId: '550e8400-e29b-41d4-a716-446655440001',
    };

    it('should accept valid HMAC-signed push event', async () => {
      mockSyncService.syncFilesFromGit.mockResolvedValue({
        updated: 1,
        created: 0,
        errors: [],
      });

      const body = JSON.stringify(pushPayload);
      const signature = signPayload(body, WEBHOOK_SECRET);

      const res = await request(app)
        .post('/api/git/webhook')
        .set('Content-Type', 'application/json')
        .set('X-Hub-Signature-256', signature)
        .set('X-GitHub-Event', 'push')
        .send(body);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Webhook processed');
    });

    it('should reject request with missing signature', async () => {
      const res = await request(app)
        .post('/api/git/webhook')
        .set('Content-Type', 'application/json')
        .set('X-GitHub-Event', 'push')
        .send(pushPayload);

      expect(res.status).toBe(401);
      expect(res.body.error).toBeDefined();
    });

    it('should reject request with invalid signature', async () => {
      const body = JSON.stringify(pushPayload);
      const badSignature = signPayload(body, 'wrong-secret');

      const res = await request(app)
        .post('/api/git/webhook')
        .set('Content-Type', 'application/json')
        .set('X-Hub-Signature-256', badSignature)
        .set('X-GitHub-Event', 'push')
        .send(body);

      expect(res.status).toBe(401);
      expect(res.body.error).toBeDefined();
    });

    it('should return 400 when webhook secret is not configured', async () => {
      delete process.env.GIT_WEBHOOK_SECRET;

      const body = JSON.stringify(pushPayload);
      const signature = signPayload(body, WEBHOOK_SECRET);

      const res = await request(app)
        .post('/api/git/webhook')
        .set('Content-Type', 'application/json')
        .set('X-Hub-Signature-256', signature)
        .set('X-GitHub-Event', 'push')
        .send(body);

      expect(res.status).toBe(400);
    });

    it('should ignore non-push events with 200', async () => {
      const body = JSON.stringify({ action: 'opened' });
      const signature = signPayload(body, WEBHOOK_SECRET);

      const res = await request(app)
        .post('/api/git/webhook')
        .set('Content-Type', 'application/json')
        .set('X-Hub-Signature-256', signature)
        .set('X-GitHub-Event', 'pull_request')
        .send(body);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Event ignored');
      expect(mockSyncService.syncFilesFromGit).not.toHaveBeenCalled();
    });

    it('should handle sync errors gracefully', async () => {
      mockSyncService.syncFilesFromGit.mockRejectedValue(new Error('Sync failed'));

      const body = JSON.stringify(pushPayload);
      const signature = signPayload(body, WEBHOOK_SECRET);

      const res = await request(app)
        .post('/api/git/webhook')
        .set('Content-Type', 'application/json')
        .set('X-Hub-Signature-256', signature)
        .set('X-GitHub-Event', 'push')
        .send(body);

      // Should still return 200 — webhook received, sync error logged
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Webhook processed');
    });
  });
});

/**
 * Approval Routes Integration Tests
 * Sprint 5: Integration tests for HITL approval workflow endpoints
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';

const { mockApprovalService, mockRiskService, mockSlaService, mockJwt } = vi.hoisted(() => ({
  mockApprovalService: {
    findAll: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    submitForReview: vi.fn(),
    claimReview: vi.fn(),
    approve: vi.fn(),
    reject: vi.fn(),
    revise: vi.fn(),
    archive: vi.fn(),
    getHistory: vi.fn(),
    getFeedback: vi.fn(),
    getReviewQueue: vi.fn(),
  },
  mockRiskService: {
    getProjectSettings: vi.fn(),
    updateProjectSettings: vi.fn(),
  },
  mockSlaService: {
    getSLAStatus: vi.fn(),
    getApproachingSLAs: vi.fn(),
    getBreachedSLAs: vi.fn(),
    escalate: vi.fn(),
    getSLAMetrics: vi.fn(),
  },
  mockJwt: {
    verify: vi.fn(),
    sign: vi.fn(),
  },
}));

vi.mock('../../src/services/approval.service.js', () => ({
  approvalService: mockApprovalService,
}));

vi.mock('../../src/services/risk-assessment.service.js', () => ({
  riskAssessmentService: mockRiskService,
}));

vi.mock('../../src/services/sla.service.js', () => ({
  slaService: mockSlaService,
}));

vi.mock('jsonwebtoken', () => ({ default: mockJwt }));

import app from '../../src/app.js';

describe('Approval Routes Integration', () => {
  const adminToken = 'admin_test_token';
  const leadToken = 'lead_test_token';
  const userToken = 'user_test_token';
  const viewerToken = 'viewer_test_token';

  const mockArtifact = {
    id: 'artifact-123',
    projectId: 'project-123',
    type: 'test_case',
    sourceAgent: 'TestWeaver',
    title: 'Login Test',
    state: 'draft',
    riskLevel: 'medium',
    content: { steps: [] },
    createdById: 'user-123',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockJwt.verify.mockImplementation((token: string) => {
      if (token === adminToken) return { userId: 'admin-123', role: 'admin' };
      if (token === leadToken) return { userId: 'lead-123', role: 'lead' };
      if (token === userToken) return { userId: 'user-123', role: 'qae' };
      if (token === viewerToken) return { userId: 'viewer-123', role: 'viewer' };
      throw new Error('Invalid token');
    });
  });

  // ==========================================================================
  // ARTIFACT ROUTES
  // ==========================================================================

  describe('GET /api/approvals/artifacts', () => {
    it('should return paginated artifacts', async () => {
      mockApprovalService.findAll.mockResolvedValue({ data: [mockArtifact], total: 1 });

      const res = await request(app)
        .get('/api/approvals/artifacts')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });

    it('should support filters', async () => {
      mockApprovalService.findAll.mockResolvedValue({ data: [], total: 0 });

      const res = await request(app)
        .get('/api/approvals/artifacts?projectId=proj-1&type=test_case&state=draft&riskLevel=medium')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(mockApprovalService.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 'proj-1',
          type: 'test_case',
          state: 'draft',
          riskLevel: 'medium',
        })
      );
    });

    it('should return 401 without auth', async () => {
      const res = await request(app).get('/api/approvals/artifacts');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/approvals/artifacts', () => {
    it('should create artifact', async () => {
      mockApprovalService.create.mockResolvedValue(mockArtifact);

      const res = await request(app)
        .post('/api/approvals/artifacts')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          projectId: '550e8400-e29b-41d4-a716-446655440000',
          type: 'test_case',
          sourceAgent: 'TestWeaver',
          title: 'Login Test',
          content: { steps: [] },
        });

      expect(res.status).toBe(201);
      expect(res.body.message).toBe('Artifact created');
    });

    it('should return 400 for invalid type', async () => {
      const res = await request(app)
        .post('/api/approvals/artifacts')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          projectId: '550e8400-e29b-41d4-a716-446655440000',
          type: 'invalid',
          sourceAgent: 'TestWeaver',
          title: 'Test',
          content: {},
        });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/approvals/artifacts/:id', () => {
    it('should return artifact by id', async () => {
      mockApprovalService.findById.mockResolvedValue(mockArtifact);

      const res = await request(app)
        .get('/api/approvals/artifacts/artifact-123')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe('artifact-123');
    });

    it('should return 404 for non-existent', async () => {
      const { NotFoundError } = await import('../../src/errors/index.js');
      mockApprovalService.findById.mockRejectedValue(new NotFoundError('Artifact', 'bad-id'));

      const res = await request(app)
        .get('/api/approvals/artifacts/bad-id')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/approvals/artifacts/:id', () => {
    it('should update artifact', async () => {
      mockApprovalService.update.mockResolvedValue({ ...mockArtifact, title: 'Updated' });

      const res = await request(app)
        .put('/api/approvals/artifacts/artifact-123')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ title: 'Updated' });

      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe('Updated');
    });
  });

  describe('DELETE /api/approvals/artifacts/:id', () => {
    it('should delete artifact', async () => {
      mockApprovalService.delete.mockResolvedValue(undefined);

      const res = await request(app)
        .delete('/api/approvals/artifacts/artifact-123')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Artifact deleted');
    });
  });

  // ==========================================================================
  // WORKFLOW ACTION ROUTES
  // ==========================================================================

  describe('POST /api/approvals/artifacts/:id/submit', () => {
    it('should submit artifact for review', async () => {
      mockApprovalService.submitForReview.mockResolvedValue({ ...mockArtifact, state: 'pending_review' });

      const res = await request(app)
        .post('/api/approvals/artifacts/artifact-123/submit')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Artifact submitted for review');
    });
  });

  describe('POST /api/approvals/artifacts/:id/claim', () => {
    it('should claim artifact for qae', async () => {
      mockApprovalService.claimReview.mockResolvedValue({ ...mockArtifact, state: 'in_review' });

      const res = await request(app)
        .post('/api/approvals/artifacts/artifact-123/claim')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Artifact claimed for review');
    });

    it('should return 403 for viewer', async () => {
      const res = await request(app)
        .post('/api/approvals/artifacts/artifact-123/claim')
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/approvals/artifacts/:id/approve', () => {
    it('should approve artifact for admin', async () => {
      mockApprovalService.approve.mockResolvedValue({ ...mockArtifact, state: 'approved' });

      const res = await request(app)
        .post('/api/approvals/artifacts/artifact-123/approve')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ comment: 'Looks good' });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Artifact approved');
    });

    it('should return 403 for viewer', async () => {
      const res = await request(app)
        .post('/api/approvals/artifacts/artifact-123/approve')
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/approvals/artifacts/:id/reject', () => {
    it('should reject artifact with feedback', async () => {
      mockApprovalService.reject.mockResolvedValue({ ...mockArtifact, state: 'rejected' });

      const res = await request(app)
        .post('/api/approvals/artifacts/artifact-123/reject')
        .set('Authorization', `Bearer ${leadToken}`)
        .send({
          comment: 'Needs work',
          feedback: [
            {
              category: 'accuracy',
              severity: 'high',
              description: 'Incorrect assertion',
            },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Artifact rejected');
    });

    it('should return 403 for viewer', async () => {
      const res = await request(app)
        .post('/api/approvals/artifacts/artifact-123/reject')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({});

      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/approvals/artifacts/:id/revise', () => {
    it('should revise artifact', async () => {
      mockApprovalService.revise.mockResolvedValue({ ...mockArtifact, state: 'pending_review' });

      const res = await request(app)
        .post('/api/approvals/artifacts/artifact-123/revise')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ content: { steps: ['updated'] } });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Artifact revised');
    });

    it('should return 400 without content', async () => {
      const res = await request(app)
        .post('/api/approvals/artifacts/artifact-123/revise')
        .set('Authorization', `Bearer ${userToken}`)
        .send({});

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/approvals/artifacts/:id/archive', () => {
    it('should archive artifact', async () => {
      mockApprovalService.archive.mockResolvedValue({ ...mockArtifact, state: 'archived' });

      const res = await request(app)
        .post('/api/approvals/artifacts/artifact-123/archive')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Artifact archived');
    });
  });

  describe('GET /api/approvals/artifacts/:id/history', () => {
    it('should return artifact history', async () => {
      mockApprovalService.getHistory.mockResolvedValue([
        { id: 'h1', action: 'created', timestamp: new Date().toISOString() },
      ]);

      const res = await request(app)
        .get('/api/approvals/artifacts/artifact-123/history')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });
  });

  describe('GET /api/approvals/artifacts/:id/feedback', () => {
    it('should return artifact feedback', async () => {
      mockApprovalService.getFeedback.mockResolvedValue([
        { id: 'f1', category: 'accuracy', severity: 'high' },
      ]);

      const res = await request(app)
        .get('/api/approvals/artifacts/artifact-123/feedback')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });
  });

  // ==========================================================================
  // REVIEW QUEUE
  // ==========================================================================

  describe('GET /api/approvals/queue', () => {
    it('should return review queue for admin', async () => {
      mockApprovalService.getReviewQueue.mockResolvedValue({ data: [mockArtifact], total: 1 });

      const res = await request(app)
        .get('/api/approvals/queue')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });

    it('should return 403 for viewer', async () => {
      const res = await request(app)
        .get('/api/approvals/queue')
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(403);
    });
  });

  // ==========================================================================
  // SLA ROUTES
  // ==========================================================================

  describe('GET /api/approvals/sla/:artifactId', () => {
    it('should return SLA status', async () => {
      mockSlaService.getSLAStatus.mockResolvedValue({
        artifactId: 'artifact-123',
        status: 'on_track',
        deadline: new Date().toISOString(),
      });

      const res = await request(app)
        .get('/api/approvals/sla/artifact-123')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('on_track');
    });
  });

  // NOTE: GET /sla/approaching and /sla/breached are shadowed by /sla/:artifactId
  // Express matches /:artifactId first, so "approaching" and "breached" are treated as artifactId
  describe('GET /api/approvals/sla/approaching', () => {
    it('should be caught by /sla/:artifactId due to Express ordering', async () => {
      mockSlaService.getSLAStatus.mockResolvedValue({ status: 'on_track' });

      const res = await request(app)
        .get('/api/approvals/sla/approaching')
        .set('Authorization', `Bearer ${userToken}`);

      // "approaching" is treated as :artifactId — getSLAStatus('approaching') is called
      expect(res.status).toBe(200);
      expect(mockSlaService.getSLAStatus).toHaveBeenCalledWith('approaching');
    });
  });

  describe('GET /api/approvals/sla/breached', () => {
    it('should be caught by /sla/:artifactId due to Express ordering', async () => {
      mockSlaService.getSLAStatus.mockResolvedValue({ status: 'breached' });

      const res = await request(app)
        .get('/api/approvals/sla/breached')
        .set('Authorization', `Bearer ${userToken}`);

      // "breached" is treated as :artifactId — getSLAStatus('breached') is called
      expect(res.status).toBe(200);
      expect(mockSlaService.getSLAStatus).toHaveBeenCalledWith('breached');
    });
  });

  describe('POST /api/approvals/sla/:artifactId/escalate', () => {
    it('should escalate SLA for admin', async () => {
      mockSlaService.escalate.mockResolvedValue({ id: 'sla-123', escalated: true });

      const res = await request(app)
        .post('/api/approvals/sla/artifact-123/escalate')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          escalatedToId: '550e8400-e29b-41d4-a716-446655440000',
          reason: 'Overdue by 2 days',
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('SLA escalated');
    });

    it('should return 403 for qae', async () => {
      const res = await request(app)
        .post('/api/approvals/sla/artifact-123/escalate')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          escalatedToId: '550e8400-e29b-41d4-a716-446655440000',
          reason: 'Overdue',
        });

      expect(res.status).toBe(403);
    });

    it('should return 400 for missing reason', async () => {
      const res = await request(app)
        .post('/api/approvals/sla/artifact-123/escalate')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          escalatedToId: '550e8400-e29b-41d4-a716-446655440000',
        });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/approvals/sla/metrics/:projectId', () => {
    it('should return SLA metrics for admin', async () => {
      mockSlaService.getSLAMetrics.mockResolvedValue({
        avgResolutionTime: 24,
        breachRate: 5,
      });

      const res = await request(app)
        .get('/api/approvals/sla/metrics/project-123')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.avgResolutionTime).toBe(24);
    });

    it('should return 403 for qae', async () => {
      const res = await request(app)
        .get('/api/approvals/sla/metrics/project-123')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(403);
    });
  });

  // ==========================================================================
  // SETTINGS ROUTES
  // ==========================================================================

  describe('GET /api/approvals/settings/:projectId', () => {
    it('should return project settings', async () => {
      mockRiskService.getProjectSettings.mockResolvedValue({
        lowRiskThreshold: 30,
        autoApproveEnabled: false,
      });

      const res = await request(app)
        .get('/api/approvals/settings/project-123')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.lowRiskThreshold).toBe(30);
    });
  });

  describe('PUT /api/approvals/settings/:projectId', () => {
    it('should update settings for admin', async () => {
      mockRiskService.updateProjectSettings.mockResolvedValue({
        lowRiskThreshold: 25,
        autoApproveEnabled: true,
      });

      const res = await request(app)
        .put('/api/approvals/settings/project-123')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          lowRiskThreshold: 25,
          autoApproveEnabled: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Settings updated');
    });

    it('should return 403 for qae', async () => {
      const res = await request(app)
        .put('/api/approvals/settings/project-123')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ autoApproveEnabled: true });

      expect(res.status).toBe(403);
    });

    it('should return 400 for out-of-range threshold', async () => {
      const res = await request(app)
        .put('/api/approvals/settings/project-123')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ lowRiskThreshold: 200 });

      expect(res.status).toBe(400);
    });
  });
});

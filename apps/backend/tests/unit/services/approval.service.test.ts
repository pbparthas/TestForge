/**
 * Approval Service Unit Tests
 * Sprint 18: Tests for artifact CRUD and state machine transitions
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// All mocks must be hoisted
const { mockPrisma, mockRiskAssessmentService, mockSlaService } = vi.hoisted(() => ({
  mockPrisma: {
    artifact: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    approvalWorkflow: {
      update: vi.fn(),
    },
    approvalStep: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    artifactHistory: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    approvalFeedback: {
      createMany: vi.fn(),
      findMany: vi.fn(),
    },
    project: {
      findUnique: vi.fn(),
    },
  },
  mockRiskAssessmentService: {
    assessRisk: vi.fn(),
    getProjectSettings: vi.fn(),
  },
  mockSlaService: {
    createSLATracking: vi.fn(),
    completeSLATracking: vi.fn(),
  },
}));

vi.mock('../../../src/utils/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../../../src/services/risk-assessment.service.js', () => ({
  riskAssessmentService: mockRiskAssessmentService,
}));
vi.mock('../../../src/services/sla.service.js', () => ({
  slaService: mockSlaService,
}));

import { ApprovalService } from '../../../src/services/approval.service.js';
import { NotFoundError, ValidationError } from '../../../src/errors/index.js';

describe('ApprovalService', () => {
  let service: ApprovalService;

  const mockProject = { id: 'project-123', name: 'Test Project' };
  const mockUser = { id: 'user-123' };

  const mockWorkflow = {
    id: 'workflow-123',
    artifactId: 'artifact-123',
    requiredApprovals: 1,
    currentApprovals: 0,
    requiresAdmin: false,
    requiresLead: false,
    autoApproved: false,
    autoApproveReason: null,
    startedAt: new Date(),
    completedAt: null,
    steps: [],
  };

  const mockArtifact = {
    id: 'artifact-123',
    projectId: mockProject.id,
    type: 'test_case' as const,
    state: 'draft' as const,
    riskLevel: 'low' as const,
    sourceAgent: 'testweaver',
    sourceSessionId: null,
    sourceType: null,
    title: 'Test Artifact',
    description: 'A test artifact',
    content: { test: 'content' },
    metadata: null,
    riskScore: 20,
    riskFactors: {},
    aiConfidenceScore: 95,
    targetEntityType: null,
    targetEntityId: null,
    submittedAt: null,
    approvedAt: null,
    rejectedAt: null,
    archivedAt: null,
    createdById: mockUser.id,
    createdAt: new Date(),
    updatedAt: new Date(),
    version: 1,
    previousVersionId: null,
    workflow: mockWorkflow,
    history: [],
    feedback: [],
  };

  const mockRiskAssessment = {
    riskScore: 20,
    riskLevel: 'low' as const,
    riskFactors: {
      artifactTypeScore: 20,
      scopeScore: 0,
      confidenceScore: 5,
      historicalRejectionScore: 0,
      details: { artifactType: 'test_case' },
    },
    approvalRequirements: {
      requiredApprovals: 1,
      requiresAdmin: false,
      requiresLead: false,
      canAutoApprove: true,
      autoApproveReason: 'Low risk, high confidence',
    },
  };

  const mockSettings = {
    autoApproveEnabled: true,
    autoApproveMaxRisk: 'low',
    autoApproveMinConfidence: 90,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ApprovalService();
    mockRiskAssessmentService.assessRisk.mockResolvedValue(mockRiskAssessment);
    mockRiskAssessmentService.getProjectSettings.mockResolvedValue(mockSettings);
  });

  // ==========================================================================
  // CREATE
  // ==========================================================================

  describe('create', () => {
    it('should create an artifact with risk assessment', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockPrisma.artifact.create.mockResolvedValue(mockArtifact);
      mockPrisma.artifactHistory.create.mockResolvedValue({});

      const result = await service.create({
        projectId: mockProject.id,
        type: 'test_case',
        sourceAgent: 'testweaver',
        title: 'Test Artifact',
        content: { test: 'content' },
        aiConfidenceScore: 95,
        createdById: mockUser.id,
      });

      expect(mockRiskAssessmentService.assessRisk).toHaveBeenCalled();
      expect(mockPrisma.artifact.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            projectId: mockProject.id,
            type: 'test_case',
            state: 'draft',
            riskLevel: 'low',
            workflow: {
              create: expect.objectContaining({
                requiredApprovals: 1,
              }),
            },
          }),
        })
      );
      expect(result).toEqual(mockArtifact);
    });

    it('should throw NotFoundError for invalid project', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(null);

      await expect(
        service.create({
          projectId: 'invalid-id',
          type: 'test_case',
          sourceAgent: 'testweaver',
          title: 'Test',
          content: {},
          createdById: mockUser.id,
        })
      ).rejects.toThrow(NotFoundError);
    });

    it('should record creation in history', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockPrisma.artifact.create.mockResolvedValue(mockArtifact);
      mockPrisma.artifactHistory.create.mockResolvedValue({});

      await service.create({
        projectId: mockProject.id,
        type: 'test_case',
        sourceAgent: 'testweaver',
        title: 'Test',
        content: {},
        createdById: mockUser.id,
      });

      expect(mockPrisma.artifactHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          artifactId: mockArtifact.id,
          toState: 'draft',
          action: 'created',
        }),
      });
    });
  });

  // ==========================================================================
  // FIND BY ID
  // ==========================================================================

  describe('findById', () => {
    it('should return artifact with relations', async () => {
      mockPrisma.artifact.findUnique.mockResolvedValue(mockArtifact);

      const result = await service.findById(mockArtifact.id);

      expect(mockPrisma.artifact.findUnique).toHaveBeenCalledWith({
        where: { id: mockArtifact.id },
        include: expect.objectContaining({
          workflow: expect.any(Object),
          history: expect.any(Object),
          feedback: expect.any(Object),
        }),
      });
      expect(result).toEqual(mockArtifact);
    });

    it('should throw NotFoundError for invalid artifact', async () => {
      mockPrisma.artifact.findUnique.mockResolvedValue(null);

      await expect(service.findById('invalid-id')).rejects.toThrow(NotFoundError);
    });
  });

  // ==========================================================================
  // FIND ALL
  // ==========================================================================

  describe('findAll', () => {
    it('should return paginated artifacts', async () => {
      mockPrisma.artifact.findMany.mockResolvedValue([mockArtifact]);
      mockPrisma.artifact.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it('should filter by projectId', async () => {
      mockPrisma.artifact.findMany.mockResolvedValue([mockArtifact]);
      mockPrisma.artifact.count.mockResolvedValue(1);

      await service.findAll({ page: 1, limit: 10, projectId: mockProject.id });

      expect(mockPrisma.artifact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ projectId: mockProject.id }),
        })
      );
    });

    it('should filter by type and state', async () => {
      mockPrisma.artifact.findMany.mockResolvedValue([]);
      mockPrisma.artifact.count.mockResolvedValue(0);

      await service.findAll({
        page: 1,
        limit: 10,
        type: 'script',
        state: 'pending_review',
      });

      expect(mockPrisma.artifact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            type: 'script',
            state: 'pending_review',
          }),
        })
      );
    });
  });

  // ==========================================================================
  // GET REVIEW QUEUE
  // ==========================================================================

  describe('getReviewQueue', () => {
    it('should return pending and in_review artifacts', async () => {
      const pendingArtifact = { ...mockArtifact, state: 'pending_review' };
      mockPrisma.artifact.findMany.mockResolvedValue([pendingArtifact]);
      mockPrisma.artifact.count.mockResolvedValue(1);

      const result = await service.getReviewQueue({ page: 1, limit: 10 });

      expect(mockPrisma.artifact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            state: { in: ['pending_review', 'in_review'] },
          }),
        })
      );
      expect(result.data).toHaveLength(1);
    });
  });

  // ==========================================================================
  // UPDATE
  // ==========================================================================

  describe('update', () => {
    it('should update artifact in draft state', async () => {
      mockPrisma.artifact.findUnique.mockResolvedValue(mockArtifact);
      mockPrisma.artifact.update.mockResolvedValue({
        ...mockArtifact,
        title: 'Updated Title',
      });

      const result = await service.update(mockArtifact.id, { title: 'Updated Title' });

      expect(mockPrisma.artifact.update).toHaveBeenCalledWith({
        where: { id: mockArtifact.id },
        data: expect.objectContaining({ title: 'Updated Title' }),
        include: expect.any(Object),
      });
      expect(result.title).toBe('Updated Title');
    });

    it('should throw ValidationError when updating non-draft artifact', async () => {
      mockPrisma.artifact.findUnique.mockResolvedValue({
        ...mockArtifact,
        state: 'pending_review',
      });

      await expect(
        service.update(mockArtifact.id, { title: 'New Title' })
      ).rejects.toThrow(ValidationError);
    });
  });

  // ==========================================================================
  // DELETE
  // ==========================================================================

  describe('delete', () => {
    it('should delete artifact in draft state', async () => {
      mockPrisma.artifact.findUnique.mockResolvedValue(mockArtifact);
      mockPrisma.artifact.delete.mockResolvedValue(mockArtifact);

      await service.delete(mockArtifact.id);

      expect(mockPrisma.artifact.delete).toHaveBeenCalledWith({
        where: { id: mockArtifact.id },
      });
    });

    it('should delete archived artifact', async () => {
      mockPrisma.artifact.findUnique.mockResolvedValue({
        ...mockArtifact,
        state: 'archived',
      });
      mockPrisma.artifact.delete.mockResolvedValue(mockArtifact);

      await service.delete(mockArtifact.id);

      expect(mockPrisma.artifact.delete).toHaveBeenCalled();
    });

    it('should throw ValidationError when deleting non-deletable artifact', async () => {
      mockPrisma.artifact.findUnique.mockResolvedValue({
        ...mockArtifact,
        state: 'pending_review',
      });

      await expect(service.delete(mockArtifact.id)).rejects.toThrow(ValidationError);
    });
  });

  // ==========================================================================
  // STATE MACHINE - SUBMIT FOR REVIEW
  // ==========================================================================

  describe('submitForReview', () => {
    it('should submit draft artifact for review', async () => {
      mockPrisma.artifact.findUnique.mockResolvedValue(mockArtifact);
      mockPrisma.artifact.update.mockResolvedValue({
        ...mockArtifact,
        state: 'pending_review',
        submittedAt: new Date(),
      });
      mockPrisma.artifactHistory.create.mockResolvedValue({});
      mockSlaService.createSLATracking.mockResolvedValue({});

      // Disable auto-approve for this test
      mockRiskAssessmentService.getProjectSettings.mockResolvedValue({
        ...mockSettings,
        autoApproveEnabled: false,
      });

      const result = await service.submitForReview({
        artifactId: mockArtifact.id,
        userId: mockUser.id,
      });

      expect(mockPrisma.artifact.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            state: 'pending_review',
          }),
        })
      );
      expect(mockSlaService.createSLATracking).toHaveBeenCalled();
      expect(result.state).toBe('pending_review');
    });

    it('should auto-approve when conditions met', async () => {
      const autoApproveArtifact = {
        ...mockArtifact,
        aiConfidenceScore: 95,
      };
      mockPrisma.artifact.findUnique.mockResolvedValue(autoApproveArtifact);
      mockPrisma.approvalWorkflow.update.mockResolvedValue({});
      mockPrisma.artifact.update.mockResolvedValue({
        ...autoApproveArtifact,
        state: 'approved',
        approvedAt: new Date(),
      });
      mockPrisma.artifactHistory.create.mockResolvedValue({});

      const result = await service.submitForReview({
        artifactId: mockArtifact.id,
        userId: mockUser.id,
      });

      expect(result.state).toBe('approved');
      expect(mockPrisma.approvalWorkflow.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            autoApproved: true,
          }),
        })
      );
    });

    it('should throw ValidationError for invalid state transition', async () => {
      mockPrisma.artifact.findUnique.mockResolvedValue({
        ...mockArtifact,
        state: 'approved',
      });

      await expect(
        service.submitForReview({ artifactId: mockArtifact.id, userId: mockUser.id })
      ).rejects.toThrow(ValidationError);
    });
  });

  // ==========================================================================
  // STATE MACHINE - CLAIM REVIEW
  // ==========================================================================

  describe('claimReview', () => {
    it('should claim pending artifact for review', async () => {
      const pendingArtifact = { ...mockArtifact, state: 'pending_review' as const };
      mockPrisma.artifact.findUnique.mockResolvedValue(pendingArtifact);
      mockPrisma.approvalStep.create.mockResolvedValue({});
      mockPrisma.artifact.update.mockResolvedValue({
        ...pendingArtifact,
        state: 'in_review',
      });
      mockPrisma.artifactHistory.create.mockResolvedValue({});

      const result = await service.claimReview({
        artifactId: mockArtifact.id,
        userId: mockUser.id,
      });

      expect(mockPrisma.approvalStep.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          assignedToId: mockUser.id,
          status: 'in_progress',
        }),
      });
      expect(result.state).toBe('in_review');
    });
  });

  // ==========================================================================
  // STATE MACHINE - APPROVE
  // ==========================================================================

  describe('approve', () => {
    it('should approve artifact in review', async () => {
      const inReviewArtifact = {
        ...mockArtifact,
        state: 'in_review' as const,
        workflow: mockWorkflow,
      };
      mockPrisma.artifact.findUnique.mockResolvedValue(inReviewArtifact);
      mockPrisma.approvalStep.findFirst.mockResolvedValue({
        id: 'step-1',
        workflowId: mockWorkflow.id,
        assignedToId: mockUser.id,
        status: 'in_progress',
      });
      mockPrisma.approvalStep.update.mockResolvedValue({});
      mockPrisma.approvalWorkflow.update.mockResolvedValue({});
      mockPrisma.artifact.update.mockResolvedValue({
        ...inReviewArtifact,
        state: 'approved',
        approvedAt: new Date(),
      });
      mockPrisma.artifactHistory.create.mockResolvedValue({});
      mockSlaService.completeSLATracking.mockResolvedValue();

      const result = await service.approve({
        artifactId: mockArtifact.id,
        userId: mockUser.id,
        comment: 'LGTM',
      });

      expect(mockPrisma.approvalStep.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'approved',
            comment: 'LGTM',
          }),
        })
      );
      expect(mockSlaService.completeSLATracking).toHaveBeenCalled();
      expect(result.state).toBe('approved');
    });

    it('should handle multi-level approval', async () => {
      const multiApprovalWorkflow = {
        ...mockWorkflow,
        requiredApprovals: 2,
        currentApprovals: 0,
      };
      const inReviewArtifact = {
        ...mockArtifact,
        state: 'in_review' as const,
        workflow: multiApprovalWorkflow,
      };
      mockPrisma.artifact.findUnique.mockResolvedValue(inReviewArtifact);
      mockPrisma.approvalStep.findFirst.mockResolvedValue({
        id: 'step-1',
        workflowId: mockWorkflow.id,
        assignedToId: mockUser.id,
        status: 'in_progress',
      });
      mockPrisma.approvalStep.update.mockResolvedValue({});
      mockPrisma.approvalWorkflow.update.mockResolvedValue({});
      mockPrisma.artifact.update.mockResolvedValue({
        ...inReviewArtifact,
        state: 'pending_review', // Still needs more approvals
      });
      mockPrisma.artifactHistory.create.mockResolvedValue({});

      const result = await service.approve({
        artifactId: mockArtifact.id,
        userId: mockUser.id,
      });

      expect(mockPrisma.approvalWorkflow.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            currentApprovals: 1, // 0 + 1
          }),
        })
      );
      expect(result.state).toBe('pending_review'); // Not fully approved yet
    });
  });

  // ==========================================================================
  // STATE MACHINE - REJECT
  // ==========================================================================

  describe('reject', () => {
    it('should reject artifact with feedback', async () => {
      const inReviewArtifact = {
        ...mockArtifact,
        state: 'in_review' as const,
        workflow: mockWorkflow,
      };
      mockPrisma.artifact.findUnique.mockResolvedValue(inReviewArtifact);
      mockPrisma.approvalStep.findFirst.mockResolvedValue({
        id: 'step-1',
        workflowId: mockWorkflow.id,
        assignedToId: mockUser.id,
        status: 'in_progress',
      });
      mockPrisma.approvalStep.update.mockResolvedValue({});
      mockPrisma.approvalFeedback.createMany.mockResolvedValue({ count: 1 });
      mockPrisma.artifact.update.mockResolvedValue({
        ...inReviewArtifact,
        state: 'rejected',
        rejectedAt: new Date(),
      });
      mockPrisma.artifactHistory.create.mockResolvedValue({});
      mockSlaService.completeSLATracking.mockResolvedValue();

      const result = await service.reject({
        artifactId: mockArtifact.id,
        userId: mockUser.id,
        comment: 'Needs improvement',
        feedback: [
          {
            category: 'accuracy',
            severity: 'medium',
            description: 'Test steps are incorrect',
            suggestedFix: 'Fix step 3',
          },
        ],
      });

      expect(mockPrisma.approvalFeedback.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            category: 'accuracy',
            description: 'Test steps are incorrect',
          }),
        ]),
      });
      expect(mockSlaService.completeSLATracking).toHaveBeenCalled();
      expect(result.state).toBe('rejected');
    });
  });

  // ==========================================================================
  // STATE MACHINE - REVISE
  // ==========================================================================

  describe('revise', () => {
    it('should create new version from rejected artifact', async () => {
      const rejectedArtifact = {
        ...mockArtifact,
        state: 'rejected' as const,
        version: 1,
      };
      mockPrisma.artifact.findUnique.mockResolvedValue(rejectedArtifact);
      mockPrisma.artifact.create.mockResolvedValue({
        ...rejectedArtifact,
        id: 'artifact-456',
        state: 'draft',
        version: 2,
        previousVersionId: mockArtifact.id,
      });
      mockPrisma.artifact.update.mockResolvedValue({
        ...rejectedArtifact,
        state: 'archived',
        archivedAt: new Date(),
      });
      mockPrisma.artifactHistory.create.mockResolvedValue({});

      const result = await service.revise({
        artifactId: mockArtifact.id,
        userId: mockUser.id,
        content: { updated: 'content' },
      });

      expect(mockPrisma.artifact.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            version: 2,
            previousVersionId: mockArtifact.id,
            state: 'draft',
          }),
        })
      );
      expect(mockPrisma.artifact.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            state: 'archived',
          }),
        })
      );
      expect(result.version).toBe(2);
    });

    it('should throw ValidationError when revising non-rejected artifact', async () => {
      mockPrisma.artifact.findUnique.mockResolvedValue({
        ...mockArtifact,
        state: 'approved',
      });

      await expect(
        service.revise({
          artifactId: mockArtifact.id,
          userId: mockUser.id,
          content: {},
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  // ==========================================================================
  // STATE MACHINE - ARCHIVE
  // ==========================================================================

  describe('archive', () => {
    it('should archive approved artifact', async () => {
      const approvedArtifact = { ...mockArtifact, state: 'approved' as const };
      mockPrisma.artifact.findUnique.mockResolvedValue(approvedArtifact);
      mockPrisma.artifact.update.mockResolvedValue({
        ...approvedArtifact,
        state: 'archived',
        archivedAt: new Date(),
      });
      mockPrisma.artifactHistory.create.mockResolvedValue({});

      const result = await service.archive(mockArtifact.id, mockUser.id);

      expect(result.state).toBe('archived');
    });

    it('should throw ValidationError when archiving non-archivable artifact', async () => {
      mockPrisma.artifact.findUnique.mockResolvedValue({
        ...mockArtifact,
        state: 'in_review',
      });

      await expect(
        service.archive(mockArtifact.id, mockUser.id)
      ).rejects.toThrow(ValidationError);
    });
  });

  // ==========================================================================
  // HISTORY AND FEEDBACK
  // ==========================================================================

  describe('getHistory', () => {
    it('should return artifact history', async () => {
      const mockHistory = [
        { id: 'h1', artifactId: mockArtifact.id, action: 'created', toState: 'draft' },
        { id: 'h2', artifactId: mockArtifact.id, action: 'submitted', toState: 'pending_review' },
      ];
      mockPrisma.artifact.findUnique.mockResolvedValue(mockArtifact);
      mockPrisma.artifactHistory.findMany.mockResolvedValue(mockHistory);

      const result = await service.getHistory(mockArtifact.id);

      expect(mockPrisma.artifactHistory.findMany).toHaveBeenCalledWith({
        where: { artifactId: mockArtifact.id },
        orderBy: { actionAt: 'desc' },
      });
      expect(result).toHaveLength(2);
    });

    it('should throw NotFoundError for invalid artifact', async () => {
      mockPrisma.artifact.findUnique.mockResolvedValue(null);

      await expect(service.getHistory('invalid-id')).rejects.toThrow(NotFoundError);
    });
  });

  describe('getFeedback', () => {
    it('should return artifact feedback', async () => {
      const mockFeedback = [
        { id: 'f1', artifactId: mockArtifact.id, category: 'accuracy', description: 'Issue 1' },
      ];
      mockPrisma.artifact.findUnique.mockResolvedValue(mockArtifact);
      mockPrisma.approvalFeedback.findMany.mockResolvedValue(mockFeedback);

      const result = await service.getFeedback(mockArtifact.id);

      expect(mockPrisma.approvalFeedback.findMany).toHaveBeenCalledWith({
        where: { artifactId: mockArtifact.id },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toHaveLength(1);
    });
  });
});

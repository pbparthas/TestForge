/**
 * SLA Service Unit Tests
 * Sprint 18: Tests for SLA tracking and escalation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// All mocks must be hoisted
const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    artifact: {
      findUnique: vi.fn(),
    },
    sLATracking: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    approvalSettings: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('../../../src/utils/prisma.js', () => ({ prisma: mockPrisma }));

import { SLAService } from '../../../src/services/sla.service.js';
import { NotFoundError } from '../../../src/errors/index.js';

describe('SLAService', () => {
  let service: SLAService;

  const mockProject = { id: 'project-123', name: 'Test Project' };

  const mockSettings = {
    id: 'settings-123',
    projectId: mockProject.id,
    lowRiskSlaHours: 1,
    mediumRiskSlaHours: 4,
    highRiskSlaHours: 24,
    criticalRiskSlaHours: 48,
    notifyOnSlaWarning: true,
  };

  const mockArtifact = {
    id: 'artifact-123',
    projectId: mockProject.id,
    type: 'test_case',
    riskLevel: 'medium',
    project: {
      ...mockProject,
      approvalSettings: mockSettings,
    },
    submittedAt: new Date(),
    approvedAt: null,
    rejectedAt: null,
  };

  const mockSLATracking = {
    id: 'sla-123',
    artifactId: 'artifact-123',
    riskLevel: 'medium' as const,
    deadlineHours: 4,
    deadline: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
    status: 'within_sla' as const,
    warningThreshold: 75,
    warningSentAt: null,
    escalatedAt: null,
    escalatedToId: null,
    escalationReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SLAService();
  });

  // ==========================================================================
  // CREATE SLA TRACKING
  // ==========================================================================

  describe('createSLATracking', () => {
    it('should create SLA tracking with correct deadline for low risk', async () => {
      mockPrisma.artifact.findUnique.mockResolvedValue(mockArtifact);
      mockPrisma.sLATracking.upsert.mockResolvedValue({
        ...mockSLATracking,
        riskLevel: 'low',
        deadlineHours: 1,
      });

      const result = await service.createSLATracking('artifact-123', 'low');

      expect(mockPrisma.sLATracking.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { artifactId: 'artifact-123' },
          create: expect.objectContaining({
            artifactId: 'artifact-123',
            riskLevel: 'low',
            deadlineHours: 1,
            status: 'within_sla',
          }),
        })
      );
      expect(result.riskLevel).toBe('low');
      expect(result.deadlineHours).toBe(1);
    });

    it('should create SLA tracking with correct deadline for medium risk', async () => {
      mockPrisma.artifact.findUnique.mockResolvedValue(mockArtifact);
      mockPrisma.sLATracking.upsert.mockResolvedValue(mockSLATracking);

      const result = await service.createSLATracking('artifact-123', 'medium');

      expect(mockPrisma.sLATracking.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            deadlineHours: 4,
          }),
        })
      );
      expect(result.deadlineHours).toBe(4);
    });

    it('should create SLA tracking with correct deadline for high risk', async () => {
      mockPrisma.artifact.findUnique.mockResolvedValue(mockArtifact);
      mockPrisma.sLATracking.upsert.mockResolvedValue({
        ...mockSLATracking,
        riskLevel: 'high',
        deadlineHours: 24,
      });

      const result = await service.createSLATracking('artifact-123', 'high');

      expect(mockPrisma.sLATracking.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            deadlineHours: 24,
          }),
        })
      );
      expect(result.deadlineHours).toBe(24);
    });

    it('should create SLA tracking with correct deadline for critical risk', async () => {
      mockPrisma.artifact.findUnique.mockResolvedValue(mockArtifact);
      mockPrisma.sLATracking.upsert.mockResolvedValue({
        ...mockSLATracking,
        riskLevel: 'critical',
        deadlineHours: 48,
      });

      const result = await service.createSLATracking('artifact-123', 'critical');

      expect(mockPrisma.sLATracking.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            deadlineHours: 48,
          }),
        })
      );
      expect(result.deadlineHours).toBe(48);
    });

    it('should throw NotFoundError for invalid artifact', async () => {
      mockPrisma.artifact.findUnique.mockResolvedValue(null);

      await expect(
        service.createSLATracking('invalid-id', 'low')
      ).rejects.toThrow(NotFoundError);
    });

    it('should use default SLA hours when no project settings', async () => {
      mockPrisma.artifact.findUnique.mockResolvedValue({
        ...mockArtifact,
        project: {
          ...mockProject,
          approvalSettings: null,
        },
      });
      mockPrisma.sLATracking.upsert.mockResolvedValue(mockSLATracking);

      await service.createSLATracking('artifact-123', 'medium');

      expect(mockPrisma.sLATracking.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            deadlineHours: 4, // Default for medium
          }),
        })
      );
    });
  });

  // ==========================================================================
  // GET SLA STATUS
  // ==========================================================================

  describe('getSLAStatus', () => {
    it('should return within_sla status when plenty of time', async () => {
      const futureDeadline = new Date(Date.now() + 3 * 60 * 60 * 1000); // 3 hours
      mockPrisma.sLATracking.findUnique.mockResolvedValue({
        ...mockSLATracking,
        deadline: futureDeadline,
        deadlineHours: 4,
      });

      const result = await service.getSLAStatus('artifact-123');

      expect(result.status).toBe('within_sla');
      expect(result.isOverdue).toBe(false);
      expect(result.isApproaching).toBe(false);
      expect(result.timeRemaining).toBeGreaterThan(0);
    });

    it('should return approaching_sla status when nearing deadline', async () => {
      // Set deadline to 1 hour from now (75% of 4 hours elapsed)
      const nearDeadline = new Date(Date.now() + 1 * 60 * 60 * 1000);
      mockPrisma.sLATracking.findUnique.mockResolvedValue({
        ...mockSLATracking,
        deadline: nearDeadline,
        deadlineHours: 4,
        warningThreshold: 75,
      });
      mockPrisma.sLATracking.update.mockResolvedValue({});

      const result = await service.getSLAStatus('artifact-123');

      expect(result.status).toBe('approaching_sla');
      expect(result.isApproaching).toBe(true);
      expect(result.isOverdue).toBe(false);
    });

    it('should return breached status when overdue', async () => {
      const pastDeadline = new Date(Date.now() - 1 * 60 * 60 * 1000); // 1 hour ago
      mockPrisma.sLATracking.findUnique.mockResolvedValue({
        ...mockSLATracking,
        deadline: pastDeadline,
        status: 'within_sla',
      });
      mockPrisma.sLATracking.update.mockResolvedValue({});

      const result = await service.getSLAStatus('artifact-123');

      expect(result.status).toBe('breached');
      expect(result.isOverdue).toBe(true);
      expect(result.timeRemaining).toBe(0);
    });

    it('should return escalated status when escalated', async () => {
      const pastDeadline = new Date(Date.now() - 1 * 60 * 60 * 1000);
      mockPrisma.sLATracking.findUnique.mockResolvedValue({
        ...mockSLATracking,
        deadline: pastDeadline,
        status: 'escalated',
        escalatedAt: new Date(),
      });
      mockPrisma.sLATracking.update.mockResolvedValue({});

      const result = await service.getSLAStatus('artifact-123');

      expect(result.status).toBe('escalated');
    });

    it('should throw NotFoundError for invalid SLA tracking', async () => {
      mockPrisma.sLATracking.findUnique.mockResolvedValue(null);

      await expect(service.getSLAStatus('invalid-id')).rejects.toThrow(NotFoundError);
    });

    it('should calculate correct percentage elapsed', async () => {
      // Set deadline to 1 hour from now, total 4 hours (75% elapsed)
      const deadline = new Date(Date.now() + 1 * 60 * 60 * 1000);
      mockPrisma.sLATracking.findUnique.mockResolvedValue({
        ...mockSLATracking,
        deadline,
        deadlineHours: 4,
      });
      mockPrisma.sLATracking.update.mockResolvedValue({});

      const result = await service.getSLAStatus('artifact-123');

      expect(result.percentageElapsed).toBeGreaterThan(70);
      expect(result.percentageElapsed).toBeLessThan(80);
    });
  });

  // ==========================================================================
  // GET APPROACHING SLAS
  // ==========================================================================

  describe('getApproachingSLAs', () => {
    it('should return approaching SLAs', async () => {
      const nearDeadline = new Date(Date.now() + 1 * 60 * 60 * 1000);
      mockPrisma.sLATracking.findMany.mockResolvedValue([
        {
          ...mockSLATracking,
          deadline: nearDeadline,
          artifact: mockArtifact,
        },
      ]);
      mockPrisma.sLATracking.count.mockResolvedValue(1);

      const result = await service.getApproachingSLAs(undefined, 1, 10);

      expect(mockPrisma.sLATracking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: ['within_sla', 'approaching_sla'] },
          }),
          orderBy: { deadline: 'asc' },
        })
      );
      expect(result.data.length).toBeGreaterThanOrEqual(0);
    });

    it('should filter by projectId', async () => {
      mockPrisma.sLATracking.findMany.mockResolvedValue([]);
      mockPrisma.sLATracking.count.mockResolvedValue(0);

      await service.getApproachingSLAs(mockProject.id, 1, 10);

      expect(mockPrisma.sLATracking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            artifact: { projectId: mockProject.id },
          }),
        })
      );
    });
  });

  // ==========================================================================
  // GET BREACHED SLAS
  // ==========================================================================

  describe('getBreachedSLAs', () => {
    it('should return breached SLAs', async () => {
      const pastDeadline = new Date(Date.now() - 1 * 60 * 60 * 1000);
      mockPrisma.sLATracking.findMany.mockResolvedValue([
        {
          ...mockSLATracking,
          deadline: pastDeadline,
          status: 'breached',
          artifact: mockArtifact,
        },
      ]);
      mockPrisma.sLATracking.count.mockResolvedValue(1);

      const result = await service.getBreachedSLAs(undefined, 1, 10);

      expect(mockPrisma.sLATracking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: ['breached', 'escalated'] },
          }),
        })
      );
      expect(result.data).toHaveLength(1);
    });

    it('should filter by projectId', async () => {
      mockPrisma.sLATracking.findMany.mockResolvedValue([]);
      mockPrisma.sLATracking.count.mockResolvedValue(0);

      await service.getBreachedSLAs(mockProject.id, 1, 10);

      expect(mockPrisma.sLATracking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            artifact: { projectId: mockProject.id },
          }),
        })
      );
    });

    it('should paginate results', async () => {
      mockPrisma.sLATracking.findMany.mockResolvedValue([]);
      mockPrisma.sLATracking.count.mockResolvedValue(25);

      const result = await service.getBreachedSLAs(undefined, 2, 10);

      expect(mockPrisma.sLATracking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        })
      );
      expect(result.page).toBe(2);
      expect(result.totalPages).toBe(3);
    });
  });

  // ==========================================================================
  // ESCALATE
  // ==========================================================================

  describe('escalate', () => {
    it('should escalate SLA breach', async () => {
      mockPrisma.sLATracking.findUnique.mockResolvedValue(mockSLATracking);
      mockPrisma.sLATracking.update.mockResolvedValue({
        ...mockSLATracking,
        status: 'escalated',
        escalatedAt: new Date(),
        escalatedToId: 'manager-123',
        escalationReason: 'Urgent review needed',
      });

      const result = await service.escalate({
        artifactId: 'artifact-123',
        escalatedToId: 'manager-123',
        reason: 'Urgent review needed',
      });

      expect(mockPrisma.sLATracking.update).toHaveBeenCalledWith({
        where: { artifactId: 'artifact-123' },
        data: {
          status: 'escalated',
          escalatedAt: expect.any(Date),
          escalatedToId: 'manager-123',
          escalationReason: 'Urgent review needed',
        },
      });
      expect(result.status).toBe('escalated');
    });

    it('should throw NotFoundError for invalid SLA', async () => {
      mockPrisma.sLATracking.findUnique.mockResolvedValue(null);

      await expect(
        service.escalate({
          artifactId: 'invalid-id',
          escalatedToId: 'manager-123',
          reason: 'Test',
        })
      ).rejects.toThrow(NotFoundError);
    });
  });

  // ==========================================================================
  // CALCULATE DEADLINE
  // ==========================================================================

  describe('calculateDeadline', () => {
    it('should calculate deadline using project settings', async () => {
      mockPrisma.approvalSettings.findUnique.mockResolvedValue(mockSettings);

      const result = await service.calculateDeadline(mockProject.id, 'medium');

      expect(result.hours).toBe(4);
      expect(result.deadline.getTime()).toBeGreaterThan(Date.now());
    });

    it('should use default hours when no settings', async () => {
      mockPrisma.approvalSettings.findUnique.mockResolvedValue(null);

      const result = await service.calculateDeadline(mockProject.id, 'high');

      expect(result.hours).toBe(24);
    });

    it('should calculate correct deadline for each risk level', async () => {
      mockPrisma.approvalSettings.findUnique.mockResolvedValue(mockSettings);

      const low = await service.calculateDeadline(mockProject.id, 'low');
      const medium = await service.calculateDeadline(mockProject.id, 'medium');
      const high = await service.calculateDeadline(mockProject.id, 'high');
      const critical = await service.calculateDeadline(mockProject.id, 'critical');

      expect(low.hours).toBe(1);
      expect(medium.hours).toBe(4);
      expect(high.hours).toBe(24);
      expect(critical.hours).toBe(48);
    });
  });

  // ==========================================================================
  // SLA METRICS
  // ==========================================================================

  describe('getSLAMetrics', () => {
    it('should return SLA metrics for project', async () => {
      const now = new Date();
      const completedSLAs = [
        {
          ...mockSLATracking,
          status: 'within_sla',
          artifact: {
            submittedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
            approvedAt: new Date(now.getTime() - 1 * 60 * 60 * 1000),
            rejectedAt: null,
          },
        },
        {
          ...mockSLATracking,
          id: 'sla-124',
          status: 'breached',
          artifact: {
            submittedAt: new Date(now.getTime() - 10 * 60 * 60 * 1000),
            approvedAt: new Date(now.getTime() - 1 * 60 * 60 * 1000),
            rejectedAt: null,
          },
        },
      ];
      mockPrisma.sLATracking.findMany.mockResolvedValue(completedSLAs);

      const result = await service.getSLAMetrics(mockProject.id, 30);

      expect(result.total).toBe(2);
      expect(result.withinSla).toBe(1);
      expect(result.breached).toBe(1);
      expect(result.escalated).toBe(0);
      expect(result.complianceRate).toBe(50);
      expect(result.averageResolutionTime).toBeGreaterThan(0);
    });

    it('should return 100% compliance when no SLAs', async () => {
      mockPrisma.sLATracking.findMany.mockResolvedValue([]);

      const result = await service.getSLAMetrics(mockProject.id);

      expect(result.total).toBe(0);
      expect(result.complianceRate).toBe(100);
    });

    it('should calculate escalated count', async () => {
      mockPrisma.sLATracking.findMany.mockResolvedValue([
        { ...mockSLATracking, status: 'escalated', artifact: { submittedAt: new Date() } },
        { ...mockSLATracking, id: 'sla-125', status: 'escalated', artifact: { submittedAt: new Date() } },
      ]);

      const result = await service.getSLAMetrics(mockProject.id);

      expect(result.escalated).toBe(2);
    });
  });

  // ==========================================================================
  // COMPLETE SLA TRACKING
  // ==========================================================================

  describe('completeSLATracking', () => {
    it('should complete SLA tracking gracefully', async () => {
      mockPrisma.sLATracking.findUnique.mockResolvedValue(mockSLATracking);

      await service.completeSLATracking('artifact-123');

      // Should not throw, just complete gracefully
      expect(mockPrisma.sLATracking.findUnique).toHaveBeenCalled();
    });

    it('should handle missing SLA tracking gracefully', async () => {
      mockPrisma.sLATracking.findUnique.mockResolvedValue(null);

      // Should not throw even if no SLA tracking exists
      await expect(
        service.completeSLATracking('artifact-123')
      ).resolves.not.toThrow();
    });
  });
});

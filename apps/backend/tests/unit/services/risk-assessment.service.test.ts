/**
 * Risk Assessment Service Unit Tests
 * Sprint 18: Tests for risk calculation and approval settings
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// All mocks must be hoisted
const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    approvalSettings: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    artifact: {
      count: vi.fn(),
    },
    project: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('../../../src/utils/prisma.js', () => ({ prisma: mockPrisma }));

import { RiskAssessmentService } from '../../../src/services/risk-assessment.service.js';
import { NotFoundError, ValidationError } from '../../../src/errors/index.js';

describe('RiskAssessmentService', () => {
  let service: RiskAssessmentService;

  const mockProject = { id: 'project-123', name: 'Test Project' };

  const mockSettings = {
    id: 'settings-123',
    projectId: mockProject.id,
    lowRiskThreshold: 25,
    mediumRiskThreshold: 50,
    highRiskThreshold: 75,
    lowRiskSlaHours: 1,
    mediumRiskSlaHours: 4,
    highRiskSlaHours: 24,
    criticalRiskSlaHours: 48,
    autoApproveEnabled: true,
    autoApproveMaxRisk: 'low',
    autoApproveMinConfidence: 90,
    notifyOnSubmission: true,
    notifyOnApproval: true,
    notifyOnRejection: true,
    notifyOnSlaWarning: true,
    escalationEnabled: true,
    escalationChain: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new RiskAssessmentService();
  });

  // ==========================================================================
  // ASSESS RISK
  // ==========================================================================

  describe('assessRisk', () => {
    beforeEach(() => {
      mockPrisma.approvalSettings.findUnique.mockResolvedValue(mockSettings);
      mockPrisma.artifact.count.mockResolvedValue(0); // No historical data
    });

    it('should assess risk for a script artifact (high base risk)', async () => {
      const result = await service.assessRisk({
        projectId: mockProject.id,
        artifactType: 'script',
        aiConfidenceScore: 80,
        filesAffected: 1,
        sourceAgent: 'scriptsmith',
      });

      expect(result.riskScore).toBeGreaterThan(25); // Script has base score of 70
      expect(result.riskLevel).toBeDefined();
      expect(result.riskFactors).toBeDefined();
      expect(result.riskFactors.artifactTypeScore).toBe(70);
      expect(result.approvalRequirements).toBeDefined();
    });

    it('should assess risk for a test_case artifact (low base risk)', async () => {
      const result = await service.assessRisk({
        projectId: mockProject.id,
        artifactType: 'test_case',
        aiConfidenceScore: 95,
        filesAffected: 1,
        sourceAgent: 'testweaver',
      });

      expect(result.riskFactors.artifactTypeScore).toBe(20);
      expect(result.riskScore).toBeLessThan(50);
    });

    it('should increase risk for low AI confidence', async () => {
      const highConfidence = await service.assessRisk({
        projectId: mockProject.id,
        artifactType: 'test_case',
        aiConfidenceScore: 95,
        filesAffected: 1,
        sourceAgent: 'testweaver',
      });

      const lowConfidence = await service.assessRisk({
        projectId: mockProject.id,
        artifactType: 'test_case',
        aiConfidenceScore: 30,
        filesAffected: 1,
        sourceAgent: 'testweaver',
      });

      expect(lowConfidence.riskScore).toBeGreaterThan(highConfidence.riskScore);
      expect(lowConfidence.riskFactors.confidenceScore).toBeGreaterThan(
        highConfidence.riskFactors.confidenceScore
      );
    });

    it('should increase risk for multi-file scope', async () => {
      const singleFile = await service.assessRisk({
        projectId: mockProject.id,
        artifactType: 'script',
        aiConfidenceScore: 80,
        filesAffected: 1,
        sourceAgent: 'scriptsmith',
      });

      const multiFile = await service.assessRisk({
        projectId: mockProject.id,
        artifactType: 'script',
        aiConfidenceScore: 80,
        filesAffected: 10,
        sourceAgent: 'scriptsmith',
      });

      expect(multiFile.riskScore).toBeGreaterThan(singleFile.riskScore);
      expect(multiFile.riskFactors.scopeScore).toBeGreaterThan(singleFile.riskFactors.scopeScore);
    });

    it('should factor in historical rejection rate', async () => {
      // First call - no rejections
      mockPrisma.artifact.count.mockResolvedValue(0);

      const noHistory = await service.assessRisk({
        projectId: mockProject.id,
        artifactType: 'script',
        aiConfidenceScore: 80,
        filesAffected: 1,
        sourceAgent: 'scriptsmith',
      });

      // Second call - high rejection rate
      mockPrisma.artifact.count
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(8); // rejected

      const highRejection = await service.assessRisk({
        projectId: mockProject.id,
        artifactType: 'script',
        aiConfidenceScore: 80,
        filesAffected: 1,
        sourceAgent: 'scriptsmith',
      });

      expect(highRejection.riskScore).toBeGreaterThan(noHistory.riskScore);
      expect(highRejection.riskFactors.historicalRejectionScore).toBeGreaterThan(0);
    });

    it('should use default settings when project has none', async () => {
      mockPrisma.approvalSettings.findUnique.mockResolvedValue(null);

      const result = await service.assessRisk({
        projectId: mockProject.id,
        artifactType: 'test_case',
        aiConfidenceScore: 95,
        sourceAgent: 'testweaver',
      });

      expect(result.riskLevel).toBeDefined();
      expect(result.approvalRequirements).toBeDefined();
    });

    it('should determine correct risk level based on score', async () => {
      // Low risk (score <= 25)
      mockPrisma.artifact.count.mockResolvedValue(0);
      const low = await service.assessRisk({
        projectId: mockProject.id,
        artifactType: 'test_case',
        aiConfidenceScore: 100,
        filesAffected: 1,
        sourceAgent: 'testweaver',
      });
      expect(low.riskLevel).toBe('low');

      // High risk (script with low confidence)
      const high = await service.assessRisk({
        projectId: mockProject.id,
        artifactType: 'script',
        aiConfidenceScore: 20,
        filesAffected: 5,
        sourceAgent: 'scriptsmith',
      });
      expect(['high', 'critical']).toContain(high.riskLevel);
    });

    it('should enable auto-approve for low risk + high confidence', async () => {
      const result = await service.assessRisk({
        projectId: mockProject.id,
        artifactType: 'test_case',
        aiConfidenceScore: 95,
        filesAffected: 1,
        sourceAgent: 'testweaver',
      });

      expect(result.riskLevel).toBe('low');
      expect(result.approvalRequirements.canAutoApprove).toBe(true);
      expect(result.approvalRequirements.autoApproveReason).toBeDefined();
    });

    it('should disable auto-approve for high risk', async () => {
      const result = await service.assessRisk({
        projectId: mockProject.id,
        artifactType: 'script',
        aiConfidenceScore: 50,
        filesAffected: 10,
        sourceAgent: 'scriptsmith',
      });

      expect(result.approvalRequirements.canAutoApprove).toBe(false);
    });
  });

  // ==========================================================================
  // MAP SCORE TO LEVEL
  // ==========================================================================

  describe('mapScoreToLevel', () => {
    it('should map scores to correct risk levels', () => {
      expect(service.mapScoreToLevel(10)).toBe('low');
      expect(service.mapScoreToLevel(25)).toBe('low');
      expect(service.mapScoreToLevel(26)).toBe('medium');
      expect(service.mapScoreToLevel(50)).toBe('medium');
      expect(service.mapScoreToLevel(51)).toBe('high');
      expect(service.mapScoreToLevel(75)).toBe('high');
      expect(service.mapScoreToLevel(76)).toBe('critical');
      expect(service.mapScoreToLevel(100)).toBe('critical');
    });
  });

  // ==========================================================================
  // GET PROJECT SETTINGS
  // ==========================================================================

  describe('getProjectSettings', () => {
    it('should return project settings if they exist', async () => {
      mockPrisma.approvalSettings.findUnique.mockResolvedValue(mockSettings);

      const result = await service.getProjectSettings(mockProject.id);

      expect(mockPrisma.approvalSettings.findUnique).toHaveBeenCalledWith({
        where: { projectId: mockProject.id },
      });
      expect(result).toEqual(mockSettings);
    });

    it('should return default settings if none exist', async () => {
      mockPrisma.approvalSettings.findUnique.mockResolvedValue(null);

      const result = await service.getProjectSettings(mockProject.id);

      expect(result.lowRiskThreshold).toBe(25);
      expect(result.mediumRiskThreshold).toBe(50);
      expect(result.highRiskThreshold).toBe(75);
      expect(result.autoApproveEnabled).toBe(true);
      expect(result.autoApproveMinConfidence).toBe(90);
    });
  });

  // ==========================================================================
  // UPDATE PROJECT SETTINGS
  // ==========================================================================

  describe('updateProjectSettings', () => {
    it('should update existing settings', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockPrisma.approvalSettings.upsert.mockResolvedValue({
        ...mockSettings,
        lowRiskThreshold: 20,
      });

      const result = await service.updateProjectSettings(mockProject.id, {
        lowRiskThreshold: 20,
        mediumRiskThreshold: 50,
        highRiskThreshold: 75,
      });

      expect(mockPrisma.approvalSettings.upsert).toHaveBeenCalled();
      expect(result.lowRiskThreshold).toBe(20);
    });

    it('should throw NotFoundError for invalid project', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(null);

      await expect(
        service.updateProjectSettings('invalid-id', { lowRiskThreshold: 20 })
      ).rejects.toThrow(NotFoundError);
    });

    it('should validate threshold order (low < medium < high)', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(mockProject);

      await expect(
        service.updateProjectSettings(mockProject.id, {
          lowRiskThreshold: 50,
          mediumRiskThreshold: 30,
          highRiskThreshold: 75,
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should validate threshold range (0-100)', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(mockProject);

      await expect(
        service.updateProjectSettings(mockProject.id, {
          lowRiskThreshold: -10,
          mediumRiskThreshold: 50,
          highRiskThreshold: 75,
        })
      ).rejects.toThrow(ValidationError);

      await expect(
        service.updateProjectSettings(mockProject.id, {
          lowRiskThreshold: 25,
          mediumRiskThreshold: 50,
          highRiskThreshold: 110,
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should create settings if they do not exist', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockPrisma.approvalSettings.upsert.mockResolvedValue(mockSettings);

      await service.updateProjectSettings(mockProject.id, {
        autoApproveEnabled: false,
      });

      expect(mockPrisma.approvalSettings.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { projectId: mockProject.id },
          create: expect.objectContaining({
            projectId: mockProject.id,
          }),
          update: expect.objectContaining({
            autoApproveEnabled: false,
          }),
        })
      );
    });

    it('should update SLA hours', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockPrisma.approvalSettings.upsert.mockResolvedValue({
        ...mockSettings,
        lowRiskSlaHours: 2,
        mediumRiskSlaHours: 8,
      });

      const result = await service.updateProjectSettings(mockProject.id, {
        lowRiskSlaHours: 2,
        mediumRiskSlaHours: 8,
      });

      expect(result.lowRiskSlaHours).toBe(2);
      expect(result.mediumRiskSlaHours).toBe(8);
    });

    it('should update notification settings', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockPrisma.approvalSettings.upsert.mockResolvedValue({
        ...mockSettings,
        notifyOnSubmission: false,
        notifyOnApproval: false,
      });

      const result = await service.updateProjectSettings(mockProject.id, {
        notifyOnSubmission: false,
        notifyOnApproval: false,
      });

      expect(result.notifyOnSubmission).toBe(false);
      expect(result.notifyOnApproval).toBe(false);
    });
  });
});

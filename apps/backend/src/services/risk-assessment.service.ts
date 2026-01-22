/**
 * Risk Assessment Service
 * Calculates risk scores for AI-generated artifacts to determine approval requirements
 * Sprint 18: HITL Approval Workflows
 */

import type { ArtifactType, RiskLevel, Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma.js';
import { NotFoundError, ValidationError } from '../errors/index.js';
import { logger } from '../utils/logger.js';

// ============================================================================
// TYPES
// ============================================================================

export interface RiskFactors {
  artifactTypeScore: number;
  scopeScore: number;
  confidenceScore: number;
  historicalRejectionScore: number;
  details: {
    artifactType: string;
    filesAffected?: number;
    aiConfidence?: number;
    historicalRejectionRate?: number;
  };
}

export interface RiskAssessmentResult {
  riskScore: number;
  riskLevel: RiskLevel;
  riskFactors: RiskFactors;
  approvalRequirements: ApprovalRequirements;
}

export interface ApprovalRequirements {
  requiredApprovals: number;
  requiresAdmin: boolean;
  requiresLead: boolean;
  canAutoApprove: boolean;
  autoApproveReason?: string;
}

export interface AssessRiskInput {
  projectId: string;
  artifactType: ArtifactType;
  aiConfidenceScore?: number;
  filesAffected?: number;
  sourceAgent: string;
}

export interface ApprovalSettingsInput {
  lowRiskThreshold?: number;
  mediumRiskThreshold?: number;
  highRiskThreshold?: number;
  lowRiskSlaHours?: number;
  mediumRiskSlaHours?: number;
  highRiskSlaHours?: number;
  criticalRiskSlaHours?: number;
  autoApproveEnabled?: boolean;
  autoApproveMaxRisk?: RiskLevel;
  autoApproveMinConfidence?: number;
  notifyOnSubmission?: boolean;
  notifyOnApproval?: boolean;
  notifyOnRejection?: boolean;
  notifyOnSlaWarning?: boolean;
  escalationEnabled?: boolean;
  escalationChain?: string[];
}

// ============================================================================
// CONSTANTS
// ============================================================================

// Base risk scores by artifact type (0-100)
const ARTIFACT_TYPE_BASE_SCORES: Record<ArtifactType, number> = {
  script: 70,              // Scripts can modify test execution - higher risk
  test_case: 20,           // Test cases are mostly documentation
  bug_analysis: 40,        // Analysis has moderate impact
  chat_suggestion: 30,     // Suggestions need review but limited scope
  self_healing_fix: 60,    // Auto-fixes to code have significant impact
};

// Risk level thresholds (default, can be overridden per project)
const DEFAULT_THRESHOLDS = {
  low: 25,
  medium: 50,
  high: 75,
};

// Approval requirements by risk level
const DEFAULT_APPROVAL_REQUIREMENTS: Record<RiskLevel, ApprovalRequirements> = {
  low: {
    requiredApprovals: 1,
    requiresAdmin: false,
    requiresLead: false,
    canAutoApprove: true,
  },
  medium: {
    requiredApprovals: 1,
    requiresAdmin: false,
    requiresLead: false,
    canAutoApprove: false,
  },
  high: {
    requiredApprovals: 2,
    requiresAdmin: false,
    requiresLead: true,
    canAutoApprove: false,
  },
  critical: {
    requiredApprovals: 2,
    requiresAdmin: true,
    requiresLead: true,
    canAutoApprove: false,
  },
};

// ============================================================================
// SERVICE CLASS
// ============================================================================

export class RiskAssessmentService {
  /**
   * Assess risk for an artifact based on multiple factors
   */
  async assessRisk(input: AssessRiskInput): Promise<RiskAssessmentResult> {
    const { projectId, artifactType, aiConfidenceScore, filesAffected, sourceAgent } = input;

    // Get project settings (if any)
    const settings = await this.getProjectSettings(projectId);

    // Calculate individual risk factors
    const artifactTypeScore = this.calculateArtifactTypeScore(artifactType);
    const scopeScore = this.calculateScopeScore(filesAffected);
    const confidenceScore = this.calculateConfidenceScore(aiConfidenceScore);
    const historicalRejectionScore = await this.calculateHistoricalRejectionScore(
      projectId,
      artifactType,
      sourceAgent
    );

    // Calculate weighted risk score (0-100)
    const riskScore = this.calculateWeightedScore({
      artifactTypeScore,
      scopeScore,
      confidenceScore,
      historicalRejectionScore,
    });

    // Determine risk level based on thresholds
    const riskLevel = this.determineRiskLevel(riskScore, settings);

    // Get approval requirements for risk level
    const approvalRequirements = this.getApprovalRequirements(
      riskLevel,
      aiConfidenceScore,
      settings
    );

    const riskFactors: RiskFactors = {
      artifactTypeScore,
      scopeScore,
      confidenceScore,
      historicalRejectionScore,
      details: {
        artifactType,
        filesAffected,
        aiConfidence: aiConfidenceScore,
        historicalRejectionRate: historicalRejectionScore > 0 ? historicalRejectionScore : undefined,
      },
    };

    logger.info({
      projectId,
      artifactType,
      riskScore,
      riskLevel,
    }, 'Risk assessment completed');

    return {
      riskScore,
      riskLevel,
      riskFactors,
      approvalRequirements,
    };
  }

  /**
   * Get approval settings for a project (creates defaults if not exists)
   */
  async getProjectSettings(projectId: string) {
    const settings = await prisma.approvalSettings.findUnique({
      where: { projectId },
    });

    if (!settings) {
      // Return default settings
      return {
        lowRiskThreshold: DEFAULT_THRESHOLDS.low,
        mediumRiskThreshold: DEFAULT_THRESHOLDS.medium,
        highRiskThreshold: DEFAULT_THRESHOLDS.high,
        autoApproveEnabled: true,
        autoApproveMaxRisk: 'low' as RiskLevel,
        autoApproveMinConfidence: 90,
      };
    }

    return settings;
  }

  /**
   * Update approval settings for a project
   */
  async updateProjectSettings(projectId: string, input: ApprovalSettingsInput) {
    // Verify project exists
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundError('Project', projectId);

    // Validate thresholds are in ascending order
    const low = input.lowRiskThreshold ?? DEFAULT_THRESHOLDS.low;
    const medium = input.mediumRiskThreshold ?? DEFAULT_THRESHOLDS.medium;
    const high = input.highRiskThreshold ?? DEFAULT_THRESHOLDS.high;

    if (low >= medium || medium >= high) {
      throw new ValidationError('Risk thresholds must be in ascending order: low < medium < high');
    }

    if (low < 0 || high > 100) {
      throw new ValidationError('Risk thresholds must be between 0 and 100');
    }

    const settings = await prisma.approvalSettings.upsert({
      where: { projectId },
      create: {
        projectId,
        lowRiskThreshold: low,
        mediumRiskThreshold: medium,
        highRiskThreshold: high,
        lowRiskSlaHours: input.lowRiskSlaHours ?? 1,
        mediumRiskSlaHours: input.mediumRiskSlaHours ?? 4,
        highRiskSlaHours: input.highRiskSlaHours ?? 24,
        criticalRiskSlaHours: input.criticalRiskSlaHours ?? 48,
        autoApproveEnabled: input.autoApproveEnabled ?? true,
        autoApproveMaxRisk: input.autoApproveMaxRisk ?? 'low',
        autoApproveMinConfidence: input.autoApproveMinConfidence ?? 90,
        notifyOnSubmission: input.notifyOnSubmission ?? true,
        notifyOnApproval: input.notifyOnApproval ?? true,
        notifyOnRejection: input.notifyOnRejection ?? true,
        notifyOnSlaWarning: input.notifyOnSlaWarning ?? true,
        escalationEnabled: input.escalationEnabled ?? true,
        escalationChain: input.escalationChain ?? [],
      },
      update: {
        lowRiskThreshold: low,
        mediumRiskThreshold: medium,
        highRiskThreshold: high,
        lowRiskSlaHours: input.lowRiskSlaHours,
        mediumRiskSlaHours: input.mediumRiskSlaHours,
        highRiskSlaHours: input.highRiskSlaHours,
        criticalRiskSlaHours: input.criticalRiskSlaHours,
        autoApproveEnabled: input.autoApproveEnabled,
        autoApproveMaxRisk: input.autoApproveMaxRisk,
        autoApproveMinConfidence: input.autoApproveMinConfidence,
        notifyOnSubmission: input.notifyOnSubmission,
        notifyOnApproval: input.notifyOnApproval,
        notifyOnRejection: input.notifyOnRejection,
        notifyOnSlaWarning: input.notifyOnSlaWarning,
        escalationEnabled: input.escalationEnabled,
        escalationChain: input.escalationChain,
      },
    });

    logger.info({ projectId }, 'Approval settings updated');
    return settings;
  }

  /**
   * Map risk score to risk level
   */
  mapScoreToLevel(score: number): RiskLevel {
    if (score <= DEFAULT_THRESHOLDS.low) return 'low';
    if (score <= DEFAULT_THRESHOLDS.medium) return 'medium';
    if (score <= DEFAULT_THRESHOLDS.high) return 'high';
    return 'critical';
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Calculate risk score based on artifact type
   */
  private calculateArtifactTypeScore(artifactType: ArtifactType): number {
    return ARTIFACT_TYPE_BASE_SCORES[artifactType] ?? 50;
  }

  /**
   * Calculate risk score based on scope (files affected)
   */
  private calculateScopeScore(filesAffected?: number): number {
    if (!filesAffected || filesAffected <= 1) return 0;
    if (filesAffected <= 3) return 20;
    if (filesAffected <= 5) return 40;
    if (filesAffected <= 10) return 60;
    return 80;
  }

  /**
   * Calculate risk score based on AI confidence (inverse relationship)
   * Low confidence = higher risk
   */
  private calculateConfidenceScore(aiConfidence?: number): number {
    if (aiConfidence === undefined || aiConfidence === null) return 30; // Default moderate risk
    // Inverse: 100% confidence = 0 risk, 0% confidence = 100 risk
    return Math.max(0, 100 - aiConfidence);
  }

  /**
   * Calculate risk score based on historical rejection rate for this type/agent
   */
  private async calculateHistoricalRejectionScore(
    projectId: string,
    artifactType: ArtifactType,
    sourceAgent: string
  ): Promise<number> {
    // Look at last 30 days of artifacts
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [total, rejected] = await Promise.all([
      prisma.artifact.count({
        where: {
          projectId,
          type: artifactType,
          sourceAgent,
          createdAt: { gte: thirtyDaysAgo },
          state: { in: ['approved', 'rejected'] },
        },
      }),
      prisma.artifact.count({
        where: {
          projectId,
          type: artifactType,
          sourceAgent,
          createdAt: { gte: thirtyDaysAgo },
          state: 'rejected',
        },
      }),
    ]);

    if (total === 0) return 0; // No history
    const rejectionRate = (rejected / total) * 100;
    return Math.min(rejectionRate, 100);
  }

  /**
   * Calculate weighted overall risk score
   */
  private calculateWeightedScore(factors: {
    artifactTypeScore: number;
    scopeScore: number;
    confidenceScore: number;
    historicalRejectionScore: number;
  }): number {
    // Weights: artifact type = 40%, scope = 20%, confidence = 25%, history = 15%
    const weighted =
      factors.artifactTypeScore * 0.4 +
      factors.scopeScore * 0.2 +
      factors.confidenceScore * 0.25 +
      factors.historicalRejectionScore * 0.15;

    return Math.round(Math.min(100, Math.max(0, weighted)));
  }

  /**
   * Determine risk level based on score and project settings
   */
  private determineRiskLevel(
    score: number,
    settings: { lowRiskThreshold: number | Prisma.Decimal; mediumRiskThreshold: number | Prisma.Decimal; highRiskThreshold: number | Prisma.Decimal }
  ): RiskLevel {
    const low = Number(settings.lowRiskThreshold);
    const medium = Number(settings.mediumRiskThreshold);
    const high = Number(settings.highRiskThreshold);

    if (score <= low) return 'low';
    if (score <= medium) return 'medium';
    if (score <= high) return 'high';
    return 'critical';
  }

  /**
   * Get approval requirements for a risk level
   */
  private getApprovalRequirements(
    riskLevel: RiskLevel,
    aiConfidence: number | undefined,
    settings: {
      autoApproveEnabled?: boolean;
      autoApproveMaxRisk?: RiskLevel;
      autoApproveMinConfidence?: number | Prisma.Decimal;
    }
  ): ApprovalRequirements {
    const baseRequirements = { ...DEFAULT_APPROVAL_REQUIREMENTS[riskLevel] };

    // Check if auto-approve is possible
    const autoApproveEnabled = settings.autoApproveEnabled ?? true;
    const autoApproveMaxRisk = settings.autoApproveMaxRisk ?? 'low';
    const autoApproveMinConfidence = Number(settings.autoApproveMinConfidence ?? 90);

    const riskOrder: RiskLevel[] = ['low', 'medium', 'high', 'critical'];
    const currentRiskIndex = riskOrder.indexOf(riskLevel);
    const maxRiskIndex = riskOrder.indexOf(autoApproveMaxRisk);

    let canAutoApprove = false;
    let autoApproveReason: string | undefined;

    if (autoApproveEnabled && currentRiskIndex <= maxRiskIndex) {
      if (aiConfidence !== undefined && aiConfidence >= autoApproveMinConfidence) {
        canAutoApprove = true;
        autoApproveReason = `Risk level ${riskLevel} <= ${autoApproveMaxRisk} and confidence ${aiConfidence}% >= ${autoApproveMinConfidence}%`;
      }
    }

    return {
      ...baseRequirements,
      canAutoApprove,
      autoApproveReason,
    };
  }
}

export const riskAssessmentService = new RiskAssessmentService();

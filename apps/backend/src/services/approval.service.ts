/**
 * Approval Service
 * Manages AI-generated artifacts through the HITL approval workflow
 * Sprint 18: HITL Approval Workflows
 */

import type {
  Artifact,
  ArtifactType,
  ArtifactState,
  RiskLevel,
  RejectionCategory,
  ApprovalWorkflow,
  ArtifactHistory,
  ApprovalFeedback,
} from '@prisma/client';
import { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma.js';
import { NotFoundError, ValidationError } from '../errors/index.js';
import { logger } from '../utils/logger.js';
import { riskAssessmentService } from './risk-assessment.service.js';
import { slaService } from './sla.service.js';

// ============================================================================
// TYPES
// ============================================================================

export interface CreateArtifactInput {
  projectId: string;
  type: ArtifactType;
  sourceAgent: string;
  sourceSessionId?: string;
  sourceType?: string;
  title: string;
  description?: string;
  content: Prisma.InputJsonValue;
  metadata?: Prisma.InputJsonValue;
  aiConfidenceScore?: number;
  targetEntityType?: string;
  targetEntityId?: string;
  createdById: string;
}

export interface UpdateArtifactInput {
  title?: string;
  description?: string;
  content?: Prisma.InputJsonValue;
  metadata?: Prisma.InputJsonValue;
}

export interface SubmitForReviewInput {
  artifactId: string;
  userId: string;
}

export interface ClaimReviewInput {
  artifactId: string;
  userId: string;
}

export interface ApproveInput {
  artifactId: string;
  userId: string;
  comment?: string;
}

export interface RejectInput {
  artifactId: string;
  userId: string;
  comment?: string;
  feedback?: RejectionFeedbackInput[];
}

export interface RejectionFeedbackInput {
  category: RejectionCategory;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  suggestedFix?: string;
  affectedSection?: string;
  correctedContent?: string;
}

export interface ReviseInput {
  artifactId: string;
  userId: string;
  content: Prisma.InputJsonValue;
  metadata?: Prisma.InputJsonValue;
}

export interface FindArtifactsParams {
  page: number;
  limit: number;
  projectId?: string;
  type?: ArtifactType;
  state?: ArtifactState;
  riskLevel?: RiskLevel;
  createdById?: string;
  assignedToId?: string;
}

export interface ReviewQueueParams {
  page: number;
  limit: number;
  projectId?: string;
  type?: ArtifactType;
  riskLevel?: RiskLevel;
  userId?: string;
}

export interface ArtifactWithRelations extends Artifact {
  workflow?: ApprovalWorkflow | null;
  history?: ArtifactHistory[];
  feedback?: ApprovalFeedback[];
}

// ============================================================================
// STATE MACHINE
// ============================================================================

// Valid state transitions
const STATE_TRANSITIONS: Record<ArtifactState, ArtifactState[]> = {
  draft: ['pending_review', 'archived'],
  pending_review: ['in_review', 'draft', 'archived'],
  in_review: ['approved', 'rejected', 'pending_review'],
  approved: ['archived'],
  rejected: ['draft', 'archived'],
  archived: [],
};

// ============================================================================
// SERVICE CLASS
// ============================================================================

export class ApprovalService {
  /**
   * Create a new artifact with risk assessment
   */
  async create(input: CreateArtifactInput): Promise<ArtifactWithRelations> {
    // Verify project exists
    const project = await prisma.project.findUnique({ where: { id: input.projectId } });
    if (!project) throw new NotFoundError('Project', input.projectId);

    // Assess risk
    const riskAssessment = await riskAssessmentService.assessRisk({
      projectId: input.projectId,
      artifactType: input.type,
      aiConfidenceScore: input.aiConfidenceScore,
      filesAffected: this.countFilesAffected(input.content),
      sourceAgent: input.sourceAgent,
    });

    // Create artifact with workflow
    const artifact = await prisma.artifact.create({
      data: {
        projectId: input.projectId,
        type: input.type,
        state: 'draft',
        riskLevel: riskAssessment.riskLevel,
        sourceAgent: input.sourceAgent,
        sourceSessionId: input.sourceSessionId,
        sourceType: input.sourceType,
        title: input.title,
        description: input.description,
        content: input.content,
        metadata: input.metadata ?? Prisma.JsonNull,
        riskScore: riskAssessment.riskScore,
        riskFactors: riskAssessment.riskFactors as unknown as Prisma.InputJsonValue,
        aiConfidenceScore: input.aiConfidenceScore,
        targetEntityType: input.targetEntityType,
        targetEntityId: input.targetEntityId,
        createdById: input.createdById,
        workflow: {
          create: {
            requiredApprovals: riskAssessment.approvalRequirements.requiredApprovals,
            requiresAdmin: riskAssessment.approvalRequirements.requiresAdmin,
            requiresLead: riskAssessment.approvalRequirements.requiresLead,
          },
        },
      },
      include: {
        workflow: true,
        history: true,
        feedback: true,
      },
    });

    // Record creation in history
    await this.recordHistory(artifact.id, null, 'draft', 'created', input.createdById);

    logger.info({
      artifactId: artifact.id,
      type: input.type,
      riskLevel: riskAssessment.riskLevel,
      riskScore: riskAssessment.riskScore,
    }, 'Artifact created');

    return artifact;
  }

  /**
   * Get artifact by ID
   */
  async findById(id: string): Promise<ArtifactWithRelations> {
    const artifact = await prisma.artifact.findUnique({
      where: { id },
      include: {
        workflow: {
          include: { steps: { orderBy: { stepOrder: 'asc' } } },
        },
        history: { orderBy: { actionAt: 'desc' } },
        feedback: { orderBy: { createdAt: 'desc' } },
        slaTracking: true,
      },
    });

    if (!artifact) throw new NotFoundError('Artifact', id);
    return artifact;
  }

  /**
   * Find artifacts with pagination and filters
   */
  async findAll(params: FindArtifactsParams) {
    const { page, limit, projectId, type, state, riskLevel, createdById, assignedToId } = params;
    const where: Prisma.ArtifactWhereInput = {};

    if (projectId) where.projectId = projectId;
    if (type) where.type = type;
    if (state) where.state = state;
    if (riskLevel) where.riskLevel = riskLevel;
    if (createdById) where.createdById = createdById;
    if (assignedToId) {
      where.workflow = {
        steps: {
          some: { assignedToId, status: 'pending' },
        },
      };
    }

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      prisma.artifact.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          workflow: true,
          slaTracking: true,
        },
      }),
      prisma.artifact.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /**
   * Get review queue (pending/in_review artifacts)
   */
  async getReviewQueue(params: ReviewQueueParams) {
    const { page, limit, projectId, type, riskLevel, userId } = params;
    const where: Prisma.ArtifactWhereInput = {
      state: { in: ['pending_review', 'in_review'] },
    };

    if (projectId) where.projectId = projectId;
    if (type) where.type = type;
    if (riskLevel) where.riskLevel = riskLevel;
    if (userId) {
      where.workflow = {
        steps: {
          some: { assignedToId: userId, status: 'pending' },
        },
      };
    }

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      prisma.artifact.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          { riskLevel: 'desc' }, // Critical first
          { submittedAt: 'asc' }, // Oldest first
        ],
        include: {
          workflow: true,
          slaTracking: true,
        },
      }),
      prisma.artifact.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /**
   * Update artifact (only in draft state)
   */
  async update(id: string, input: UpdateArtifactInput): Promise<ArtifactWithRelations> {
    const artifact = await this.findById(id);

    if (artifact.state !== 'draft') {
      throw new ValidationError('Can only update artifacts in draft state');
    }

    const updated = await prisma.artifact.update({
      where: { id },
      data: {
        title: input.title,
        description: input.description,
        content: input.content,
        metadata: input.metadata,
      },
      include: {
        workflow: true,
        history: true,
        feedback: true,
      },
    });

    logger.info({ artifactId: id }, 'Artifact updated');
    return updated;
  }

  /**
   * Delete artifact (only draft or archived)
   */
  async delete(id: string): Promise<void> {
    const artifact = await this.findById(id);

    if (!['draft', 'archived'].includes(artifact.state)) {
      throw new ValidationError('Can only delete artifacts in draft or archived state');
    }

    await prisma.artifact.delete({ where: { id } });
    logger.info({ artifactId: id }, 'Artifact deleted');
  }

  /**
   * Submit artifact for review
   */
  async submitForReview(input: SubmitForReviewInput): Promise<ArtifactWithRelations> {
    const { artifactId, userId } = input;
    const artifact = await this.findById(artifactId);

    this.validateStateTransition(artifact.state, 'pending_review');

    // Check if auto-approve is possible
    const settings = await riskAssessmentService.getProjectSettings(artifact.projectId);
    const canAutoApprove = this.checkAutoApprove(artifact, settings);

    if (canAutoApprove) {
      return this.autoApprove(artifactId, userId, settings);
    }

    // Update state and create SLA tracking
    const updated = await prisma.artifact.update({
      where: { id: artifactId },
      data: {
        state: 'pending_review',
        submittedAt: new Date(),
      },
      include: {
        workflow: true,
        history: true,
        feedback: true,
      },
    });

    // Create SLA tracking
    await slaService.createSLATracking(artifactId, artifact.riskLevel);

    // Record history
    await this.recordHistory(artifactId, artifact.state, 'pending_review', 'submitted', userId);

    logger.info({ artifactId, userId }, 'Artifact submitted for review');
    return updated;
  }

  /**
   * Claim an artifact for review
   */
  async claimReview(input: ClaimReviewInput): Promise<ArtifactWithRelations> {
    const { artifactId, userId } = input;
    const artifact = await this.findById(artifactId);

    this.validateStateTransition(artifact.state, 'in_review');

    // Update workflow step
    if (artifact.workflow) {
      await prisma.approvalStep.create({
        data: {
          workflowId: artifact.workflow.id,
          stepOrder: artifact.workflow.currentApprovals + 1,
          assignedToId: userId,
          status: 'in_progress',
        },
      });
    }

    const updated = await prisma.artifact.update({
      where: { id: artifactId },
      data: { state: 'in_review' },
      include: {
        workflow: {
          include: { steps: { orderBy: { stepOrder: 'asc' } } },
        },
        history: true,
        feedback: true,
      },
    });

    await this.recordHistory(artifactId, artifact.state, 'in_review', 'claimed', userId);

    logger.info({ artifactId, userId }, 'Artifact claimed for review');
    return updated;
  }

  /**
   * Approve an artifact
   */
  async approve(input: ApproveInput): Promise<ArtifactWithRelations> {
    const { artifactId, userId, comment } = input;
    const artifact = await this.findById(artifactId);

    this.validateStateTransition(artifact.state, 'approved');

    if (!artifact.workflow) {
      throw new ValidationError('Artifact has no workflow');
    }

    // Find and update current step
    const currentStep = await prisma.approvalStep.findFirst({
      where: {
        workflowId: artifact.workflow.id,
        assignedToId: userId,
        status: 'in_progress',
      },
    });

    if (currentStep) {
      await prisma.approvalStep.update({
        where: { id: currentStep.id },
        data: {
          status: 'approved',
          actionById: userId,
          actionAt: new Date(),
          comment,
        },
      });
    }

    // Update workflow approval count
    const newApprovalCount = artifact.workflow.currentApprovals + 1;
    const isFullyApproved = newApprovalCount >= artifact.workflow.requiredApprovals;

    await prisma.approvalWorkflow.update({
      where: { id: artifact.workflow.id },
      data: {
        currentApprovals: newApprovalCount,
        completedAt: isFullyApproved ? new Date() : undefined,
      },
    });

    // Update artifact state if fully approved
    const newState: ArtifactState = isFullyApproved ? 'approved' : 'pending_review';

    const updated = await prisma.artifact.update({
      where: { id: artifactId },
      data: {
        state: newState,
        approvedAt: isFullyApproved ? new Date() : undefined,
      },
      include: {
        workflow: {
          include: { steps: { orderBy: { stepOrder: 'asc' } } },
        },
        history: true,
        feedback: true,
      },
    });

    // Complete SLA tracking if fully approved
    if (isFullyApproved) {
      await slaService.completeSLATracking(artifactId);
    }

    await this.recordHistory(
      artifactId,
      artifact.state,
      newState,
      isFullyApproved ? 'approved' : 'approval_step_completed',
      userId,
      comment
    );

    logger.info({ artifactId, userId, isFullyApproved }, 'Artifact approval processed');
    return updated;
  }

  /**
   * Reject an artifact
   */
  async reject(input: RejectInput): Promise<ArtifactWithRelations> {
    const { artifactId, userId, comment, feedback } = input;
    const artifact = await this.findById(artifactId);

    this.validateStateTransition(artifact.state, 'rejected');

    if (!artifact.workflow) {
      throw new ValidationError('Artifact has no workflow');
    }

    // Update current step
    const currentStep = await prisma.approvalStep.findFirst({
      where: {
        workflowId: artifact.workflow.id,
        assignedToId: userId,
        status: 'in_progress',
      },
    });

    if (currentStep) {
      await prisma.approvalStep.update({
        where: { id: currentStep.id },
        data: {
          status: 'rejected',
          actionById: userId,
          actionAt: new Date(),
          comment,
        },
      });
    }

    // Record rejection feedback for AI improvement
    if (feedback && feedback.length > 0) {
      await prisma.approvalFeedback.createMany({
        data: feedback.map(f => ({
          artifactId,
          category: f.category,
          severity: f.severity,
          description: f.description,
          suggestedFix: f.suggestedFix,
          affectedSection: f.affectedSection,
          correctedContent: f.correctedContent,
          createdById: userId,
        })),
      });
    }

    const updated = await prisma.artifact.update({
      where: { id: artifactId },
      data: {
        state: 'rejected',
        rejectedAt: new Date(),
      },
      include: {
        workflow: {
          include: { steps: { orderBy: { stepOrder: 'asc' } } },
        },
        history: true,
        feedback: true,
      },
    });

    // Complete SLA tracking
    await slaService.completeSLATracking(artifactId);

    await this.recordHistory(artifactId, artifact.state, 'rejected', 'rejected', userId, comment);

    logger.info({ artifactId, userId, feedbackCount: feedback?.length ?? 0 }, 'Artifact rejected');
    return updated;
  }

  /**
   * Revise a rejected artifact and create new version
   */
  async revise(input: ReviseInput): Promise<ArtifactWithRelations> {
    const { artifactId, userId, content, metadata } = input;
    const artifact = await this.findById(artifactId);

    if (artifact.state !== 'rejected' && artifact.state !== 'draft') {
      throw new ValidationError('Can only revise rejected or draft artifacts');
    }

    // Create new version
    const newArtifact = await prisma.artifact.create({
      data: {
        projectId: artifact.projectId,
        type: artifact.type,
        state: 'draft',
        riskLevel: artifact.riskLevel,
        sourceAgent: artifact.sourceAgent,
        sourceSessionId: artifact.sourceSessionId,
        sourceType: artifact.sourceType,
        title: artifact.title,
        description: artifact.description,
        content,
        metadata: metadata ?? artifact.metadata,
        riskScore: artifact.riskScore,
        riskFactors: artifact.riskFactors,
        aiConfidenceScore: artifact.aiConfidenceScore,
        targetEntityType: artifact.targetEntityType,
        targetEntityId: artifact.targetEntityId,
        createdById: userId,
        version: artifact.version + 1,
        previousVersionId: artifact.id,
        workflow: {
          create: {
            requiredApprovals: artifact.workflow?.requiredApprovals ?? 1,
            requiresAdmin: artifact.workflow?.requiresAdmin ?? false,
            requiresLead: artifact.workflow?.requiresLead ?? false,
          },
        },
      },
      include: {
        workflow: true,
        history: true,
        feedback: true,
      },
    });

    // Archive old version
    await prisma.artifact.update({
      where: { id: artifactId },
      data: {
        state: 'archived',
        archivedAt: new Date(),
      },
    });

    await this.recordHistory(newArtifact.id, null, 'draft', 'revised', userId);

    logger.info({
      oldArtifactId: artifactId,
      newArtifactId: newArtifact.id,
      version: newArtifact.version,
    }, 'Artifact revised');

    return newArtifact;
  }

  /**
   * Archive an artifact
   */
  async archive(artifactId: string, userId: string): Promise<ArtifactWithRelations> {
    const artifact = await this.findById(artifactId);

    this.validateStateTransition(artifact.state, 'archived');

    const updated = await prisma.artifact.update({
      where: { id: artifactId },
      data: {
        state: 'archived',
        archivedAt: new Date(),
      },
      include: {
        workflow: true,
        history: true,
        feedback: true,
      },
    });

    await this.recordHistory(artifactId, artifact.state, 'archived', 'archived', userId);

    logger.info({ artifactId, userId }, 'Artifact archived');
    return updated;
  }

  /**
   * Get artifact history
   */
  async getHistory(artifactId: string): Promise<ArtifactHistory[]> {
    const artifact = await prisma.artifact.findUnique({ where: { id: artifactId } });
    if (!artifact) throw new NotFoundError('Artifact', artifactId);

    return prisma.artifactHistory.findMany({
      where: { artifactId },
      orderBy: { actionAt: 'desc' },
    });
  }

  /**
   * Get feedback for an artifact
   */
  async getFeedback(artifactId: string): Promise<ApprovalFeedback[]> {
    const artifact = await prisma.artifact.findUnique({ where: { id: artifactId } });
    if (!artifact) throw new NotFoundError('Artifact', artifactId);

    return prisma.approvalFeedback.findMany({
      where: { artifactId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Validate state transition
   */
  private validateStateTransition(currentState: ArtifactState, targetState: ArtifactState): void {
    const validTransitions = STATE_TRANSITIONS[currentState];
    if (!validTransitions.includes(targetState)) {
      throw new ValidationError(
        `Invalid state transition: ${currentState} -> ${targetState}`
      );
    }
  }

  /**
   * Record history entry
   */
  private async recordHistory(
    artifactId: string,
    fromState: ArtifactState | null,
    toState: ArtifactState,
    action: string,
    userId?: string,
    comment?: string
  ): Promise<void> {
    await prisma.artifactHistory.create({
      data: {
        artifactId,
        fromState,
        toState,
        action,
        actionById: userId,
        comment,
      },
    });
  }

  /**
   * Count files affected by artifact content
   */
  private countFilesAffected(content: Prisma.InputJsonValue): number {
    if (!content || typeof content !== 'object') return 1;

    // Check if content has files array
    const contentObj = content as Record<string, unknown>;
    if (Array.isArray(contentObj.files)) {
      return contentObj.files.length;
    }

    // Check for multiple scripts/test cases
    if (Array.isArray(contentObj.scripts)) {
      return contentObj.scripts.length;
    }

    return 1;
  }

  /**
   * Check if artifact qualifies for auto-approval
   */
  private checkAutoApprove(
    artifact: Artifact,
    settings: {
      autoApproveEnabled?: boolean;
      autoApproveMaxRisk?: RiskLevel;
      autoApproveMinConfidence?: number | Prisma.Decimal;
    }
  ): boolean {
    if (!settings.autoApproveEnabled) return false;

    const riskOrder: RiskLevel[] = ['low', 'medium', 'high', 'critical'];
    const currentRiskIndex = riskOrder.indexOf(artifact.riskLevel);
    const maxRiskIndex = riskOrder.indexOf(settings.autoApproveMaxRisk ?? 'low');

    if (currentRiskIndex > maxRiskIndex) return false;

    const minConfidence = Number(settings.autoApproveMinConfidence ?? 90);
    const artifactConfidence = artifact.aiConfidenceScore
      ? Number(artifact.aiConfidenceScore)
      : 0;

    return artifactConfidence >= minConfidence;
  }

  /**
   * Auto-approve an artifact
   */
  private async autoApprove(
    artifactId: string,
    userId: string,
    settings: {
      autoApproveMaxRisk?: RiskLevel;
      autoApproveMinConfidence?: number | Prisma.Decimal;
    }
  ): Promise<ArtifactWithRelations> {
    const artifact = await this.findById(artifactId);
    const reason = `Auto-approved: Risk ${artifact.riskLevel} <= ${settings.autoApproveMaxRisk}, ` +
      `Confidence ${artifact.aiConfidenceScore}% >= ${settings.autoApproveMinConfidence}%`;

    await prisma.approvalWorkflow.update({
      where: { artifactId },
      data: {
        autoApproved: true,
        autoApproveReason: reason,
        currentApprovals: artifact.workflow?.requiredApprovals ?? 1,
        completedAt: new Date(),
      },
    });

    const updated = await prisma.artifact.update({
      where: { id: artifactId },
      data: {
        state: 'approved',
        submittedAt: new Date(),
        approvedAt: new Date(),
      },
      include: {
        workflow: true,
        history: true,
        feedback: true,
      },
    });

    await this.recordHistory(
      artifactId,
      artifact.state,
      'approved',
      'auto_approved',
      userId,
      reason
    );

    logger.info({ artifactId, reason }, 'Artifact auto-approved');
    return updated;
  }
}

export const approvalService = new ApprovalService();

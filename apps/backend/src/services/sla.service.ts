/**
 * SLA Service
 * Manages SLA tracking and escalation for approval workflows
 * Sprint 18: HITL Approval Workflows
 */

import type { SLATracking, RiskLevel, SLAStatus, Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma.js';
import { NotFoundError } from '../errors/index.js';
import { logger } from '../utils/logger.js';

// ============================================================================
// TYPES
// ============================================================================

export interface SLAStatusResult {
  artifactId: string;
  status: SLAStatus;
  deadline: Date;
  deadlineHours: number;
  percentageElapsed: number;
  timeRemaining: number; // milliseconds
  isOverdue: boolean;
  isApproaching: boolean;
}

export interface SLAListResult {
  data: SLATracking[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface EscalateInput {
  artifactId: string;
  escalatedToId: string;
  reason: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

// Default SLA deadlines by risk level (in hours)
const DEFAULT_SLA_HOURS: Record<RiskLevel, number> = {
  low: 1,
  medium: 4,
  high: 24,
  critical: 48,
};

// Warning threshold percentage (default 75%)
const DEFAULT_WARNING_THRESHOLD = 75;

// ============================================================================
// SERVICE CLASS
// ============================================================================

export class SLAService {
  /**
   * Create SLA tracking for an artifact
   */
  async createSLATracking(
    artifactId: string,
    riskLevel: RiskLevel
  ): Promise<SLATracking> {
    // Get artifact to find project settings
    const artifact = await prisma.artifact.findUnique({
      where: { id: artifactId },
      include: { project: { include: { approvalSettings: true } } },
    });

    if (!artifact) throw new NotFoundError('Artifact', artifactId);

    // Get SLA hours from settings or use defaults
    const settings = artifact.project.approvalSettings;
    let deadlineHours: number;

    if (settings) {
      switch (riskLevel) {
        case 'low':
          deadlineHours = settings.lowRiskSlaHours;
          break;
        case 'medium':
          deadlineHours = settings.mediumRiskSlaHours;
          break;
        case 'high':
          deadlineHours = settings.highRiskSlaHours;
          break;
        case 'critical':
          deadlineHours = settings.criticalRiskSlaHours;
          break;
        default:
          deadlineHours = DEFAULT_SLA_HOURS[riskLevel];
      }
    } else {
      deadlineHours = DEFAULT_SLA_HOURS[riskLevel];
    }

    const deadline = new Date();
    deadline.setHours(deadline.getHours() + deadlineHours);

    const slaTracking = await prisma.sLATracking.upsert({
      where: { artifactId },
      create: {
        artifactId,
        riskLevel,
        deadlineHours,
        deadline,
        status: 'within_sla',
        warningThreshold: settings?.notifyOnSlaWarning ? DEFAULT_WARNING_THRESHOLD : 100,
      },
      update: {
        riskLevel,
        deadlineHours,
        deadline,
        status: 'within_sla',
        warningSentAt: null,
        escalatedAt: null,
        escalatedToId: null,
        escalationReason: null,
      },
    });

    logger.info({
      artifactId,
      riskLevel,
      deadlineHours,
      deadline,
    }, 'SLA tracking created');

    return slaTracking;
  }

  /**
   * Get SLA status for an artifact
   */
  async getSLAStatus(artifactId: string): Promise<SLAStatusResult> {
    const slaTracking = await prisma.sLATracking.findUnique({
      where: { artifactId },
    });

    if (!slaTracking) throw new NotFoundError('SLA Tracking', artifactId);

    const now = new Date();
    const deadline = new Date(slaTracking.deadline);
    const timeRemaining = deadline.getTime() - now.getTime();
    const isOverdue = timeRemaining < 0;

    // Calculate percentage elapsed
    const totalTime = slaTracking.deadlineHours * 60 * 60 * 1000; // in ms
    const elapsed = totalTime - timeRemaining;
    const percentageElapsed = Math.min(100, Math.max(0, (elapsed / totalTime) * 100));

    // Check if approaching SLA
    const isApproaching = percentageElapsed >= slaTracking.warningThreshold && !isOverdue;

    // Determine current status
    let status: SLAStatus = 'within_sla';
    if (isOverdue) {
      status = slaTracking.escalatedAt ? 'escalated' : 'breached';
    } else if (isApproaching) {
      status = 'approaching_sla';
    }

    // Update status in DB if changed
    if (status !== slaTracking.status) {
      await prisma.sLATracking.update({
        where: { artifactId },
        data: {
          status,
          warningSentAt: status === 'approaching_sla' && !slaTracking.warningSentAt
            ? new Date()
            : slaTracking.warningSentAt,
        },
      });
    }

    return {
      artifactId,
      status,
      deadline,
      deadlineHours: slaTracking.deadlineHours,
      percentageElapsed: Math.round(percentageElapsed),
      timeRemaining: Math.max(0, timeRemaining),
      isOverdue,
      isApproaching,
    };
  }

  /**
   * Get artifacts approaching SLA deadline
   */
  async getApproachingSLAs(
    projectId?: string,
    page = 1,
    limit = 10
  ): Promise<SLAListResult> {
    const now = new Date();

    // Build where clause to find artifacts within warning threshold
    const where: Prisma.SLATrackingWhereInput = {
      status: { in: ['within_sla', 'approaching_sla'] },
      deadline: { gt: now },
    };

    if (projectId) {
      where.artifact = { projectId };
    }

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      prisma.sLATracking.findMany({
        where,
        skip,
        take: limit,
        orderBy: { deadline: 'asc' },
        include: {
          artifact: {
            select: {
              id: true,
              title: true,
              type: true,
              riskLevel: true,
              projectId: true,
            },
          },
        },
      }),
      prisma.sLATracking.count({ where }),
    ]);

    // Filter for approaching only (>= warning threshold)
    const approaching = data.filter(sla => {
      const deadline = new Date(sla.deadline);
      const timeRemaining = deadline.getTime() - now.getTime();
      const totalTime = sla.deadlineHours * 60 * 60 * 1000;
      const percentageElapsed = ((totalTime - timeRemaining) / totalTime) * 100;
      return percentageElapsed >= sla.warningThreshold;
    });

    return {
      data: approaching,
      total: approaching.length,
      page,
      limit,
      totalPages: Math.ceil(approaching.length / limit),
    };
  }

  /**
   * Get breached SLAs
   */
  async getBreachedSLAs(
    projectId?: string,
    page = 1,
    limit = 10
  ): Promise<SLAListResult> {
    const now = new Date();

    const where: Prisma.SLATrackingWhereInput = {
      status: { in: ['breached', 'escalated'] },
      OR: [
        { deadline: { lt: now } },
        { status: 'escalated' },
      ],
    };

    if (projectId) {
      where.artifact = { projectId };
    }

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      prisma.sLATracking.findMany({
        where,
        skip,
        take: limit,
        orderBy: { deadline: 'asc' },
        include: {
          artifact: {
            select: {
              id: true,
              title: true,
              type: true,
              riskLevel: true,
              projectId: true,
            },
          },
        },
      }),
      prisma.sLATracking.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Escalate an SLA breach
   */
  async escalate(input: EscalateInput): Promise<SLATracking> {
    const { artifactId, escalatedToId, reason } = input;

    const slaTracking = await prisma.sLATracking.findUnique({
      where: { artifactId },
    });

    if (!slaTracking) throw new NotFoundError('SLA Tracking', artifactId);

    const updated = await prisma.sLATracking.update({
      where: { artifactId },
      data: {
        status: 'escalated',
        escalatedAt: new Date(),
        escalatedToId,
        escalationReason: reason,
      },
    });

    logger.info({
      artifactId,
      escalatedToId,
      reason,
    }, 'SLA escalated');

    return updated;
  }

  /**
   * Complete SLA tracking (artifact approved/rejected)
   */
  async completeSLATracking(artifactId: string): Promise<void> {
    const slaTracking = await prisma.sLATracking.findUnique({
      where: { artifactId },
    });

    if (!slaTracking) {
      // No SLA tracking exists, possibly auto-approved
      return;
    }

    // Keep the record for metrics but don't delete
    logger.info({ artifactId }, 'SLA tracking completed');
  }

  /**
   * Calculate deadline for a risk level
   */
  async calculateDeadline(
    projectId: string,
    riskLevel: RiskLevel
  ): Promise<{ deadline: Date; hours: number }> {
    const settings = await prisma.approvalSettings.findUnique({
      where: { projectId },
    });

    let hours: number;
    if (settings) {
      switch (riskLevel) {
        case 'low':
          hours = settings.lowRiskSlaHours;
          break;
        case 'medium':
          hours = settings.mediumRiskSlaHours;
          break;
        case 'high':
          hours = settings.highRiskSlaHours;
          break;
        case 'critical':
          hours = settings.criticalRiskSlaHours;
          break;
        default:
          hours = DEFAULT_SLA_HOURS[riskLevel];
      }
    } else {
      hours = DEFAULT_SLA_HOURS[riskLevel];
    }

    const deadline = new Date();
    deadline.setHours(deadline.getHours() + hours);

    return { deadline, hours };
  }

  /**
   * Get SLA metrics for a project
   */
  async getSLAMetrics(
    projectId: string,
    days = 30
  ): Promise<{
    total: number;
    withinSla: number;
    breached: number;
    escalated: number;
    averageResolutionTime: number;
    complianceRate: number;
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const slaRecords = await prisma.sLATracking.findMany({
      where: {
        artifact: { projectId },
        createdAt: { gte: startDate },
      },
      include: {
        artifact: {
          select: { approvedAt: true, rejectedAt: true, submittedAt: true },
        },
      },
    });

    const total = slaRecords.length;
    const breached = slaRecords.filter(s => s.status === 'breached').length;
    const escalated = slaRecords.filter(s => s.status === 'escalated').length;
    const withinSla = total - breached - escalated;

    // Calculate average resolution time (for completed artifacts)
    const completed = slaRecords.filter(
      s => s.artifact.approvedAt || s.artifact.rejectedAt
    );

    let averageResolutionTime = 0;
    if (completed.length > 0) {
      const totalTime = completed.reduce((sum, s) => {
        const start = s.artifact.submittedAt ?? s.createdAt;
        const end = s.artifact.approvedAt ?? s.artifact.rejectedAt ?? new Date();
        return sum + (end.getTime() - start.getTime());
      }, 0);
      averageResolutionTime = totalTime / completed.length;
    }

    const complianceRate = total > 0 ? Math.round((withinSla / total) * 100) : 100;

    return {
      total,
      withinSla,
      breached,
      escalated,
      averageResolutionTime,
      complianceRate,
    };
  }
}

export const slaService = new SLAService();

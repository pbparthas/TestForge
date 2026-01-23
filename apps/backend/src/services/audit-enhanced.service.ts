/**
 * Enhanced Audit Service
 * Handles comprehensive audit logging operations
 */

import type { AuditLogEnhanced, AuditCategory, AuditSeverity } from '@prisma/client';
import { prisma } from '../utils/prisma.js';
import { NotFoundError } from '../errors/index.js';

// =============================================================================
// TYPES
// =============================================================================

export interface CreateAuditLogInput {
  userId?: string;
  sessionId?: string;
  action: string;
  category: AuditCategory;
  severity?: AuditSeverity;
  resource: string;
  resourceId?: string;
  projectId?: string;
  description?: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  durationMs?: number;
  success?: boolean;
  errorMessage?: string;
}

export interface LogAuthenticationInput {
  userId?: string;
  action: string;
  success: boolean;
  ipAddress?: string;
  userAgent?: string;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

export interface LogAuthorizationInput {
  userId: string;
  action: string;
  resource: string;
  resourceId?: string;
  projectId?: string;
  success: boolean;
  errorMessage?: string;
}

export interface LogSecurityInput {
  userId?: string;
  action: string;
  description: string;
  ipAddress?: string;
  metadata?: Record<string, unknown>;
}

export interface FindAllParams {
  page: number;
  limit: number;
  userId?: string;
  category?: AuditCategory;
  severity?: AuditSeverity;
  resource?: string;
  resourceId?: string;
  projectId?: string;
  action?: string;
  success?: boolean;
  startDate?: Date;
  endDate?: Date;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// =============================================================================
// SERVICE
// =============================================================================

export class AuditEnhancedService {
  /**
   * Create a generic audit log entry
   */
  async log(input: CreateAuditLogInput): Promise<AuditLogEnhanced> {
    const auditLog = await prisma.auditLogEnhanced.create({
      data: {
        userId: input.userId,
        sessionId: input.sessionId,
        action: input.action,
        category: input.category,
        severity: input.severity ?? 'info',
        resource: input.resource,
        resourceId: input.resourceId,
        projectId: input.projectId,
        description: input.description,
        oldValue: input.oldValue ?? undefined,
        newValue: input.newValue ?? undefined,
        metadata: input.metadata ?? undefined,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        requestId: input.requestId,
        durationMs: input.durationMs,
        success: input.success ?? true,
        errorMessage: input.errorMessage,
      },
    });

    return auditLog;
  }

  /**
   * Log authentication event
   */
  async logAuthentication(input: LogAuthenticationInput): Promise<AuditLogEnhanced> {
    return this.log({
      userId: input.userId,
      action: input.action,
      category: 'authentication',
      severity: input.success ? 'info' : 'warning',
      resource: 'user',
      resourceId: input.userId,
      description: `Authentication ${input.action}: ${input.success ? 'success' : 'failed'}`,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      success: input.success,
      errorMessage: input.errorMessage,
      metadata: input.metadata,
    });
  }

  /**
   * Log authorization event
   */
  async logAuthorization(input: LogAuthorizationInput): Promise<AuditLogEnhanced> {
    return this.log({
      userId: input.userId,
      action: input.action,
      category: 'authorization',
      severity: input.success ? 'info' : 'warning',
      resource: input.resource,
      resourceId: input.resourceId,
      projectId: input.projectId,
      description: `Authorization ${input.action} on ${input.resource}: ${input.success ? 'granted' : 'denied'}`,
      success: input.success,
      errorMessage: input.errorMessage,
    });
  }

  /**
   * Log security event
   */
  async logSecurity(input: LogSecurityInput): Promise<AuditLogEnhanced> {
    return this.log({
      userId: input.userId,
      action: input.action,
      category: 'security',
      severity: 'critical',
      resource: 'security',
      description: input.description,
      ipAddress: input.ipAddress,
      metadata: input.metadata,
    });
  }

  /**
   * Log data access event
   */
  async logDataAccess(
    userId: string,
    resource: string,
    resourceId?: string,
    projectId?: string
  ): Promise<AuditLogEnhanced> {
    return this.log({
      userId,
      action: 'READ',
      category: 'data_access',
      resource,
      resourceId,
      projectId,
    });
  }

  /**
   * Log data modification event
   */
  async logDataModification(
    userId: string,
    action: string,
    resource: string,
    resourceId?: string,
    projectId?: string,
    oldValue?: Record<string, unknown>,
    newValue?: Record<string, unknown>
  ): Promise<AuditLogEnhanced> {
    return this.log({
      userId,
      action,
      category: 'data_modification',
      resource,
      resourceId,
      projectId,
      oldValue,
      newValue,
    });
  }

  /**
   * Find audit log by ID
   */
  async findById(id: string): Promise<AuditLogEnhanced> {
    const auditLog = await prisma.auditLogEnhanced.findUnique({
      where: { id },
    });

    if (!auditLog) {
      throw new NotFoundError('AuditLog', id);
    }

    return auditLog;
  }

  /**
   * Find all audit logs with pagination and filtering
   */
  async findAll(params: FindAllParams): Promise<PaginatedResult<AuditLogEnhanced>> {
    const {
      page,
      limit,
      userId,
      category,
      severity,
      resource,
      resourceId,
      projectId,
      action,
      success,
      startDate,
      endDate,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = params;

    const where: Record<string, unknown> = {};

    if (userId) where.userId = userId;
    if (category) where.category = category;
    if (severity) where.severity = severity;
    if (resource) where.resource = resource;
    if (resourceId) where.resourceId = resourceId;
    if (projectId) where.projectId = projectId;
    if (action) where.action = action;
    if (success !== undefined) where.success = success;

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) (where.createdAt as Record<string, Date>).gte = startDate;
      if (endDate) (where.createdAt as Record<string, Date>).lte = endDate;
    }

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      prisma.auditLogEnhanced.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      prisma.auditLogEnhanced.count({ where }),
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
   * Get audit trail for a specific resource
   */
  async getAuditTrailForResource(
    resource: string,
    resourceId: string,
    limit = 100
  ): Promise<AuditLogEnhanced[]> {
    return prisma.auditLogEnhanced.findMany({
      where: { resource, resourceId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Get user activity log
   */
  async getUserActivityLog(
    userId: string,
    limit = 100,
    startDate?: Date
  ): Promise<AuditLogEnhanced[]> {
    const where: Record<string, unknown> = { userId };

    if (startDate) {
      where.createdAt = { gte: startDate };
    }

    return prisma.auditLogEnhanced.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Get security alerts
   */
  async getSecurityAlerts(
    limit = 50,
    startDate?: Date
  ): Promise<AuditLogEnhanced[]> {
    const where: Record<string, unknown> = {
      OR: [
        { category: 'security' },
        { severity: 'critical' },
      ],
    };

    if (startDate) {
      where.createdAt = { gte: startDate };
    }

    return prisma.auditLogEnhanced.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Get failed operations
   */
  async getFailedOperations(
    limit = 50,
    startDate?: Date
  ): Promise<AuditLogEnhanced[]> {
    const where: Record<string, unknown> = { success: false };

    if (startDate) {
      where.createdAt = { gte: startDate };
    }

    return prisma.auditLogEnhanced.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Get audit summary statistics
   */
  async getAuditSummary(
    startDate: Date,
    endDate: Date,
    projectId?: string
  ): Promise<{
    totalLogs: number;
    byCategory: Record<string, number>;
    bySeverity: Record<string, number>;
    bySuccess: { success: number; failed: number };
  }> {
    const where: Record<string, unknown> = {
      createdAt: { gte: startDate, lte: endDate },
    };

    if (projectId) where.projectId = projectId;

    const logs = await prisma.auditLogEnhanced.findMany({ where });

    const byCategory: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    let successCount = 0;
    let failedCount = 0;

    for (const log of logs) {
      byCategory[log.category] = (byCategory[log.category] || 0) + 1;
      bySeverity[log.severity] = (bySeverity[log.severity] || 0) + 1;
      if (log.success) successCount++;
      else failedCount++;
    }

    return {
      totalLogs: logs.length,
      byCategory,
      bySeverity,
      bySuccess: { success: successCount, failed: failedCount },
    };
  }

  /**
   * Cleanup old audit logs
   */
  async cleanupOldLogs(retentionDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await prisma.auditLogEnhanced.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
        // Don't delete critical security logs
        NOT: {
          AND: [
            { category: 'security' },
            { severity: 'critical' },
          ],
        },
      },
    });

    return result.count;
  }
}

// Export singleton instance
export const auditEnhancedService = new AuditEnhancedService();

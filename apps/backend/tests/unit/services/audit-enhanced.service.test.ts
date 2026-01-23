/**
 * Enhanced Audit Service Tests (TDD - RED phase)
 * Tests for comprehensive audit logging operations
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { AuditLogEnhanced, AuditCategory, AuditSeverity } from '@prisma/client';

// Mock Prisma client - must be hoisted with vi.hoisted
const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    auditLogEnhanced: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

vi.mock('../../../src/utils/prisma.js', () => ({
  prisma: mockPrisma,
}));

// Import after mocking
import { AuditEnhancedService } from '../../../src/services/audit-enhanced.service.js';

describe('AuditEnhancedService', () => {
  let auditService: AuditEnhancedService;

  const mockAuditLog: AuditLogEnhanced = {
    id: 'audit-123',
    userId: 'user-123',
    sessionId: 'session-123',
    action: 'CREATE',
    category: 'data_modification' as AuditCategory,
    severity: 'info' as AuditSeverity,
    resource: 'project',
    resourceId: 'project-123',
    projectId: 'project-123',
    description: 'Created project',
    oldValue: null,
    newValue: { name: 'New Project' },
    metadata: null,
    ipAddress: '127.0.0.1',
    userAgent: 'Mozilla/5.0',
    requestId: 'req-123',
    durationMs: 100,
    success: true,
    errorMessage: null,
    createdAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    auditService = new AuditEnhancedService();
  });

  describe('log', () => {
    it('should create an audit log entry', async () => {
      mockPrisma.auditLogEnhanced.create.mockResolvedValue(mockAuditLog);

      const result = await auditService.log({
        userId: 'user-123',
        action: 'CREATE',
        category: 'data_modification',
        resource: 'project',
        resourceId: 'project-123',
        description: 'Created project',
        newValue: { name: 'New Project' },
      });

      expect(result.action).toBe('CREATE');
      expect(result.resource).toBe('project');
      expect(mockPrisma.auditLogEnhanced.create).toHaveBeenCalledTimes(1);
    });

    it('should set default severity to info', async () => {
      mockPrisma.auditLogEnhanced.create.mockResolvedValue(mockAuditLog);

      await auditService.log({
        userId: 'user-123',
        action: 'READ',
        category: 'data_access',
        resource: 'project',
      });

      const createCall = mockPrisma.auditLogEnhanced.create.mock.calls[0]?.[0];
      expect(createCall?.data?.severity).toBe('info');
    });

    it('should capture old and new values for modifications', async () => {
      mockPrisma.auditLogEnhanced.create.mockResolvedValue({
        ...mockAuditLog,
        oldValue: { name: 'Old Project' },
        newValue: { name: 'New Project' },
      });

      await auditService.log({
        userId: 'user-123',
        action: 'UPDATE',
        category: 'data_modification',
        resource: 'project',
        resourceId: 'project-123',
        oldValue: { name: 'Old Project' },
        newValue: { name: 'New Project' },
      });

      const createCall = mockPrisma.auditLogEnhanced.create.mock.calls[0]?.[0];
      expect(createCall?.data?.oldValue).toEqual({ name: 'Old Project' });
      expect(createCall?.data?.newValue).toEqual({ name: 'New Project' });
    });
  });

  describe('logAuthentication', () => {
    it('should create authentication audit log', async () => {
      mockPrisma.auditLogEnhanced.create.mockResolvedValue({
        ...mockAuditLog,
        category: 'authentication' as AuditCategory,
        action: 'LOGIN',
      });

      const result = await auditService.logAuthentication({
        userId: 'user-123',
        action: 'LOGIN',
        success: true,
        ipAddress: '127.0.0.1',
      });

      expect(result.category).toBe('authentication');
      expect(result.action).toBe('LOGIN');
    });

    it('should log failed authentication with error message', async () => {
      mockPrisma.auditLogEnhanced.create.mockResolvedValue({
        ...mockAuditLog,
        category: 'authentication' as AuditCategory,
        success: false,
        errorMessage: 'Invalid credentials',
      });

      await auditService.logAuthentication({
        userId: 'user-123',
        action: 'LOGIN',
        success: false,
        errorMessage: 'Invalid credentials',
      });

      const createCall = mockPrisma.auditLogEnhanced.create.mock.calls[0]?.[0];
      expect(createCall?.data?.success).toBe(false);
      expect(createCall?.data?.errorMessage).toBe('Invalid credentials');
    });
  });

  describe('logAuthorization', () => {
    it('should create authorization audit log', async () => {
      mockPrisma.auditLogEnhanced.create.mockResolvedValue({
        ...mockAuditLog,
        category: 'authorization' as AuditCategory,
      });

      const result = await auditService.logAuthorization({
        userId: 'user-123',
        action: 'ACCESS_DENIED',
        resource: 'project',
        resourceId: 'project-123',
        success: false,
      });

      expect(result.category).toBe('authorization');
    });
  });

  describe('logSecurity', () => {
    it('should create security audit log with critical severity', async () => {
      mockPrisma.auditLogEnhanced.create.mockResolvedValue({
        ...mockAuditLog,
        category: 'security' as AuditCategory,
        severity: 'critical' as AuditSeverity,
      });

      const result = await auditService.logSecurity({
        userId: 'user-123',
        action: 'SUSPICIOUS_ACTIVITY',
        description: 'Multiple failed login attempts',
      });

      expect(result.category).toBe('security');
      expect(result.severity).toBe('critical');
    });
  });

  describe('findById', () => {
    it('should return audit log by id', async () => {
      mockPrisma.auditLogEnhanced.findUnique.mockResolvedValue(mockAuditLog);

      const result = await auditService.findById('audit-123');

      expect(result).toEqual(mockAuditLog);
    });

    it('should throw NotFoundError if audit log does not exist', async () => {
      mockPrisma.auditLogEnhanced.findUnique.mockResolvedValue(null);

      await expect(auditService.findById('nonexistent')).rejects.toThrow(
        "AuditLog with id 'nonexistent' not found"
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated audit logs', async () => {
      mockPrisma.auditLogEnhanced.findMany.mockResolvedValue([mockAuditLog]);
      mockPrisma.auditLogEnhanced.count.mockResolvedValue(1);

      const result = await auditService.findAll({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by userId', async () => {
      mockPrisma.auditLogEnhanced.findMany.mockResolvedValue([mockAuditLog]);
      mockPrisma.auditLogEnhanced.count.mockResolvedValue(1);

      await auditService.findAll({ page: 1, limit: 10, userId: 'user-123' });

      expect(mockPrisma.auditLogEnhanced.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: 'user-123' }),
        })
      );
    });

    it('should filter by category', async () => {
      mockPrisma.auditLogEnhanced.findMany.mockResolvedValue([mockAuditLog]);
      mockPrisma.auditLogEnhanced.count.mockResolvedValue(1);

      await auditService.findAll({ page: 1, limit: 10, category: 'authentication' });

      expect(mockPrisma.auditLogEnhanced.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ category: 'authentication' }),
        })
      );
    });

    it('should filter by severity', async () => {
      mockPrisma.auditLogEnhanced.findMany.mockResolvedValue([mockAuditLog]);
      mockPrisma.auditLogEnhanced.count.mockResolvedValue(1);

      await auditService.findAll({ page: 1, limit: 10, severity: 'critical' });

      expect(mockPrisma.auditLogEnhanced.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ severity: 'critical' }),
        })
      );
    });

    it('should filter by date range', async () => {
      mockPrisma.auditLogEnhanced.findMany.mockResolvedValue([mockAuditLog]);
      mockPrisma.auditLogEnhanced.count.mockResolvedValue(1);

      const startDate = new Date('2026-01-01');
      const endDate = new Date('2026-01-31');

      await auditService.findAll({ page: 1, limit: 10, startDate, endDate });

      expect(mockPrisma.auditLogEnhanced.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: {
              gte: startDate,
              lte: endDate,
            },
          }),
        })
      );
    });

    it('should filter by resource', async () => {
      mockPrisma.auditLogEnhanced.findMany.mockResolvedValue([mockAuditLog]);
      mockPrisma.auditLogEnhanced.count.mockResolvedValue(1);

      await auditService.findAll({ page: 1, limit: 10, resource: 'project' });

      expect(mockPrisma.auditLogEnhanced.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ resource: 'project' }),
        })
      );
    });
  });

  describe('getAuditTrailForResource', () => {
    it('should return audit trail for a specific resource', async () => {
      mockPrisma.auditLogEnhanced.findMany.mockResolvedValue([mockAuditLog]);

      const result = await auditService.getAuditTrailForResource('project', 'project-123');

      expect(result).toHaveLength(1);
      expect(mockPrisma.auditLogEnhanced.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { resource: 'project', resourceId: 'project-123' },
        })
      );
    });
  });

  describe('getUserActivityLog', () => {
    it('should return activity log for a user', async () => {
      mockPrisma.auditLogEnhanced.findMany.mockResolvedValue([mockAuditLog]);

      const result = await auditService.getUserActivityLog('user-123');

      expect(result).toHaveLength(1);
      expect(mockPrisma.auditLogEnhanced.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: 'user-123' }),
        })
      );
    });
  });

  describe('getSecurityAlerts', () => {
    it('should return security alerts', async () => {
      mockPrisma.auditLogEnhanced.findMany.mockResolvedValue([
        { ...mockAuditLog, category: 'security' as AuditCategory },
      ]);

      const result = await auditService.getSecurityAlerts();

      expect(result).toHaveLength(1);
      expect(mockPrisma.auditLogEnhanced.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { category: 'security' },
              { severity: 'critical' },
            ],
          }),
        })
      );
    });
  });

  describe('cleanupOldLogs', () => {
    it('should delete logs older than specified days', async () => {
      mockPrisma.auditLogEnhanced.deleteMany.mockResolvedValue({ count: 100 });

      const result = await auditService.cleanupOldLogs(90);

      expect(result).toBe(100);
      expect(mockPrisma.auditLogEnhanced.deleteMany).toHaveBeenCalled();
    });
  });
});

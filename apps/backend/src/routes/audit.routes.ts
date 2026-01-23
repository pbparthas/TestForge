/**
 * Audit Routes
 * Handles audit log viewing and management endpoints
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { auditEnhancedService } from '../services/audit-enhanced.service.js';
import { authenticate, authorize, AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { ValidationError } from '../errors/index.js';
import type { AuditCategory, AuditSeverity } from '@prisma/client';

const router = Router();

// All audit routes require authentication
router.use(authenticate);

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const findAllSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  userId: z.string().uuid().optional(),
  category: z.enum(['authentication', 'authorization', 'data_access', 'data_modification', 'system', 'security']).optional(),
  severity: z.enum(['info', 'warning', 'critical']).optional(),
  resource: z.string().optional(),
  resourceId: z.string().optional(),
  projectId: z.string().uuid().optional(),
  action: z.string().optional(),
  success: z.enum(['true', 'false']).optional().transform(v => v === 'true' ? true : v === 'false' ? false : undefined),
  startDate: z.string().datetime().optional().transform(v => v ? new Date(v) : undefined),
  endDate: z.string().datetime().optional().transform(v => v ? new Date(v) : undefined),
});

const summarySchema = z.object({
  startDate: z.string().datetime().transform(v => new Date(v)),
  endDate: z.string().datetime().transform(v => new Date(v)),
  projectId: z.string().uuid().optional(),
});

// =============================================================================
// HELPERS
// =============================================================================

function validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const errors = result.error.errors.map(e => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    throw new ValidationError('Validation failed', errors);
  }
  return result.data;
}

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// =============================================================================
// ROUTES
// =============================================================================

/**
 * GET /api/audit
 * List audit logs with pagination and filtering (admin/lead only)
 */
router.get('/', authorize(['admin', 'lead']), asyncHandler(async (req: Request, res: Response) => {
  const params = validate(findAllSchema, req.query);

  const result = await auditEnhancedService.findAll({
    ...params,
    category: params.category as AuditCategory | undefined,
    severity: params.severity as AuditSeverity | undefined,
  });

  res.json({ data: result });
}));

/**
 * GET /api/audit/:id
 * Get audit log by ID (admin/lead only)
 */
router.get('/:id', authorize(['admin', 'lead']), asyncHandler(async (req: Request, res: Response) => {
  const auditLog = await auditEnhancedService.findById(req.params.id);
  res.json({ data: auditLog });
}));

/**
 * GET /api/audit/resource/:resource/:resourceId
 * Get audit trail for a specific resource
 */
router.get('/resource/:resource/:resourceId', asyncHandler(async (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 100;

  const auditTrail = await auditEnhancedService.getAuditTrailForResource(
    req.params.resource,
    req.params.resourceId,
    limit
  );

  res.json({ data: auditTrail });
}));

/**
 * GET /api/audit/user/:userId
 * Get activity log for a user (admin/lead only)
 */
router.get('/user/:userId', authorize(['admin', 'lead']), asyncHandler(async (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 100;
  const startDate = req.query.startDate
    ? new Date(req.query.startDate as string)
    : undefined;

  const activityLog = await auditEnhancedService.getUserActivityLog(
    req.params.userId,
    limit,
    startDate
  );

  res.json({ data: activityLog });
}));

/**
 * GET /api/audit/my-activity
 * Get activity log for current user
 */
router.get('/my-activity', asyncHandler(async (req: Request, res: Response) => {
  const { userId } = (req as AuthenticatedRequest).user;
  const limit = parseInt(req.query.limit as string) || 100;
  const startDate = req.query.startDate
    ? new Date(req.query.startDate as string)
    : undefined;

  const activityLog = await auditEnhancedService.getUserActivityLog(
    userId,
    limit,
    startDate
  );

  res.json({ data: activityLog });
}));

/**
 * GET /api/audit/security-alerts
 * Get security alerts (admin only)
 */
router.get('/security-alerts', authorize(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 50;
  const startDate = req.query.startDate
    ? new Date(req.query.startDate as string)
    : undefined;

  const alerts = await auditEnhancedService.getSecurityAlerts(limit, startDate);

  res.json({ data: alerts });
}));

/**
 * GET /api/audit/failed-operations
 * Get failed operations (admin/lead only)
 */
router.get('/failed-operations', authorize(['admin', 'lead']), asyncHandler(async (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 50;
  const startDate = req.query.startDate
    ? new Date(req.query.startDate as string)
    : undefined;

  const failedOps = await auditEnhancedService.getFailedOperations(limit, startDate);

  res.json({ data: failedOps });
}));

/**
 * GET /api/audit/summary
 * Get audit summary statistics (admin only)
 */
router.get('/summary', authorize(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const params = validate(summarySchema, req.query);

  const summary = await auditEnhancedService.getAuditSummary(
    params.startDate,
    params.endDate,
    params.projectId
  );

  res.json({ data: summary });
}));

/**
 * POST /api/audit/cleanup
 * Cleanup old audit logs (admin only)
 */
router.post('/cleanup', authorize(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const retentionDays = parseInt(req.body.retentionDays as string) || 90;

  const deletedCount = await auditEnhancedService.cleanupOldLogs(retentionDays);

  res.json({
    message: `Cleaned up ${deletedCount} old audit logs`,
    data: { deletedCount },
  });
}));

export default router;

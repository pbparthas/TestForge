/**
 * Permission Routes
 * Handles permission management endpoints
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { permissionService } from '../services/permission.service.js';
import { authenticate, authorize, AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { ValidationError } from '../errors/index.js';

const router = Router();

// All permission routes require authentication
router.use(authenticate);

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const createPermissionSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  resource: z.string().min(1, 'Resource is required'),
  action: z.string().min(1, 'Action is required'),
});

const grantPermissionSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  permissionId: z.string().uuid('Invalid permission ID'),
  projectId: z.string().uuid().optional().nullable(),
  expiresAt: z.string().datetime().optional(),
});

const checkPermissionSchema = z.object({
  resource: z.string().min(1, 'Resource is required'),
  action: z.string().min(1, 'Action is required'),
  projectId: z.string().uuid().optional().nullable(),
});

const bulkCheckSchema = z.object({
  checks: z.array(z.object({
    resource: z.string().min(1),
    action: z.string().min(1),
  })),
  projectId: z.string().uuid().optional().nullable(),
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
// PERMISSION CRUD ROUTES
// =============================================================================

/**
 * GET /api/permissions
 * List all permissions
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const resource = req.query.resource as string | undefined;
  const action = req.query.action as string | undefined;

  const permissions = await permissionService.findAllPermissions({ resource, action });
  res.json({ data: permissions });
}));

/**
 * GET /api/permissions/:id
 * Get permission by ID
 */
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const permission = await permissionService.findPermissionById(req.params.id);
  res.json({ data: permission });
}));

/**
 * POST /api/permissions
 * Create a new permission (admin only)
 */
router.post('/', authorize(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const data = validate(createPermissionSchema, req.body);
  const permission = await permissionService.createPermission(data);

  res.status(201).json({
    message: 'Permission created successfully',
    data: permission,
  });
}));

/**
 * DELETE /api/permissions/:id
 * Delete permission (admin only)
 */
router.delete('/:id', authorize(['admin']), asyncHandler(async (req: Request, res: Response) => {
  await permissionService.deletePermission(req.params.id);
  res.json({
    message: 'Permission deleted successfully',
  });
}));

// =============================================================================
// USER PERMISSION MANAGEMENT ROUTES
// =============================================================================

/**
 * POST /api/permissions/grant
 * Grant permission to user (admin only)
 */
router.post('/grant', authorize(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const { userId } = (req as AuthenticatedRequest).user;
  const data = validate(grantPermissionSchema, req.body);

  const userPermission = await permissionService.grantPermissionToUser(
    data.userId,
    data.permissionId,
    data.projectId ?? null,
    userId,
    data.expiresAt ? new Date(data.expiresAt) : undefined
  );

  res.status(201).json({
    message: 'Permission granted successfully',
    data: userPermission,
  });
}));

/**
 * POST /api/permissions/deny
 * Deny permission to user (admin only)
 */
router.post('/deny', authorize(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const { userId } = (req as AuthenticatedRequest).user;
  const data = validate(grantPermissionSchema, req.body);

  const userPermission = await permissionService.denyPermissionToUser(
    data.userId,
    data.permissionId,
    data.projectId ?? null,
    userId
  );

  res.status(201).json({
    message: 'Permission denied successfully',
    data: userPermission,
  });
}));

/**
 * DELETE /api/permissions/user/:userId/:permissionId
 * Remove permission from user (admin only)
 */
router.delete('/user/:userId/:permissionId', authorize(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const projectId = req.query.projectId as string | undefined;

  await permissionService.removePermissionFromUser(
    req.params.userId,
    req.params.permissionId,
    projectId ?? null
  );

  res.json({
    message: 'Permission removed successfully',
  });
}));

/**
 * GET /api/permissions/user/:userId
 * Get direct permissions for user
 */
router.get('/user/:userId', asyncHandler(async (req: Request, res: Response) => {
  const projectId = req.query.projectId as string | undefined;

  const permissions = await permissionService.getUserDirectPermissions(
    req.params.userId,
    projectId
  );

  res.json({ data: permissions });
}));

/**
 * GET /api/permissions/user/:userId/effective
 * Get effective permissions for user (including role-based)
 */
router.get('/user/:userId/effective', asyncHandler(async (req: Request, res: Response) => {
  const projectId = req.query.projectId as string | undefined;

  const permissions = await permissionService.getUserEffectivePermissions(
    req.params.userId,
    projectId
  );

  res.json({ data: permissions });
}));

// =============================================================================
// PERMISSION CHECKING ROUTES
// =============================================================================

/**
 * POST /api/permissions/check
 * Check if current user has permission
 */
router.post('/check', asyncHandler(async (req: Request, res: Response) => {
  const { userId } = (req as AuthenticatedRequest).user;
  const data = validate(checkPermissionSchema, req.body);

  const hasPermission = await permissionService.checkPermission(
    userId,
    data.resource,
    data.action,
    data.projectId
  );

  res.json({
    data: {
      hasPermission,
      resource: data.resource,
      action: data.action,
    },
  });
}));

/**
 * POST /api/permissions/check-bulk
 * Check multiple permissions for current user
 */
router.post('/check-bulk', asyncHandler(async (req: Request, res: Response) => {
  const { userId } = (req as AuthenticatedRequest).user;
  const data = validate(bulkCheckSchema, req.body);

  const results = await permissionService.checkPermissions(
    userId,
    data.checks,
    data.projectId
  );

  res.json({
    data: Object.fromEntries(results),
  });
}));

/**
 * GET /api/permissions/my-permissions
 * Get effective permissions for current user
 */
router.get('/my-permissions', asyncHandler(async (req: Request, res: Response) => {
  const { userId } = (req as AuthenticatedRequest).user;
  const projectId = req.query.projectId as string | undefined;

  const permissions = await permissionService.getUserEffectivePermissions(
    userId,
    projectId
  );

  res.json({ data: permissions });
}));

export default router;

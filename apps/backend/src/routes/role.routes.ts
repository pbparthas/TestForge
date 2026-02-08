/**
 * Role Routes
 * Handles role management endpoints
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { permissionService } from '../services/permission.service.js';
import { authenticate, authorize, AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { ValidationError } from '../errors/index.js';
import { validate } from '../middleware/validation.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();

// All role routes require authentication
router.use(authenticate);

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const createRoleSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
});

const updateRoleSchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
  description: z.string().optional(),
});

const assignRoleSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  roleId: z.string().uuid('Invalid role ID'),
  projectId: z.string().uuid().optional().nullable(),
  expiresAt: z.string().datetime().optional(),
});

const rolePermissionSchema = z.object({
  permissionId: z.string().uuid('Invalid permission ID'),
});

// =============================================================================
// HELPERS
// =============================================================================

// =============================================================================
// ROLE CRUD ROUTES
// =============================================================================

/**
 * GET /api/roles
 * List all roles
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const roles = await permissionService.findAllRoles();
  res.json({ data: roles });
}));

/**
 * GET /api/roles/:id
 * Get role by ID
 */
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const role = await permissionService.findRoleById(req.params.id);
  res.json({ data: role });
}));

/**
 * POST /api/roles
 * Create a new role (admin only)
 */
router.post('/', authorize(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const data = validate(createRoleSchema, req.body);
  const role = await permissionService.createRole(data);

  res.status(201).json({
    message: 'Role created successfully',
    data: role,
  });
}));

/**
 * PATCH /api/roles/:id
 * Update role (admin only)
 */
router.patch('/:id', authorize(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const data = validate(updateRoleSchema, req.body);
  const role = await permissionService.updateRole(req.params.id, data);

  res.json({
    message: 'Role updated successfully',
    data: role,
  });
}));

/**
 * DELETE /api/roles/:id
 * Delete role (admin only)
 */
router.delete('/:id', authorize(['admin']), asyncHandler(async (req: Request, res: Response) => {
  await permissionService.deleteRole(req.params.id);
  res.json({
    message: 'Role deleted successfully',
  });
}));

// =============================================================================
// ROLE PERMISSION MANAGEMENT ROUTES
// =============================================================================

/**
 * GET /api/roles/:id/permissions
 * Get permissions for role
 */
router.get('/:id/permissions', asyncHandler(async (req: Request, res: Response) => {
  const permissions = await permissionService.getRolePermissions(req.params.id);
  res.json({ data: permissions });
}));

/**
 * POST /api/roles/:id/permissions
 * Add permission to role (admin only)
 */
router.post('/:id/permissions', authorize(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const data = validate(rolePermissionSchema, req.body);
  const rolePermission = await permissionService.assignPermissionToRole(
    req.params.id,
    data.permissionId
  );

  res.status(201).json({
    message: 'Permission added to role successfully',
    data: rolePermission,
  });
}));

/**
 * DELETE /api/roles/:roleId/permissions/:permissionId
 * Remove permission from role (admin only)
 */
router.delete('/:roleId/permissions/:permissionId', authorize(['admin']), asyncHandler(async (req: Request, res: Response) => {
  await permissionService.removePermissionFromRole(
    req.params.roleId,
    req.params.permissionId
  );

  res.json({
    message: 'Permission removed from role successfully',
  });
}));

// =============================================================================
// USER ROLE ASSIGNMENT ROUTES
// =============================================================================

/**
 * POST /api/roles/assign
 * Assign role to user (admin only)
 */
router.post('/assign', authorize(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const { userId: assignedBy } = (req as AuthenticatedRequest).user;
  const data = validate(assignRoleSchema, req.body);

  const assignment = await permissionService.assignRoleToUser(
    data.userId,
    data.roleId,
    data.projectId ?? null,
    assignedBy,
    data.expiresAt ? new Date(data.expiresAt) : undefined
  );

  res.status(201).json({
    message: 'Role assigned successfully',
    data: assignment,
  });
}));

/**
 * DELETE /api/roles/unassign/:userId/:roleId
 * Remove role from user (admin only)
 */
router.delete('/unassign/:userId/:roleId', authorize(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const projectId = req.query.projectId as string | undefined;

  await permissionService.removeRoleFromUser(
    req.params.userId,
    req.params.roleId,
    projectId ?? null
  );

  res.json({
    message: 'Role removed successfully',
  });
}));

/**
 * GET /api/roles/user/:userId
 * Get roles for user
 */
router.get('/user/:userId', asyncHandler(async (req: Request, res: Response) => {
  const projectId = req.query.projectId as string | undefined;

  const roles = await permissionService.getUserRoles(
    req.params.userId,
    projectId
  );

  res.json({ data: roles });
}));

/**
 * GET /api/roles/my-roles
 * Get roles for current user
 */
router.get('/my-roles', asyncHandler(async (req: Request, res: Response) => {
  const { userId } = (req as AuthenticatedRequest).user;
  const projectId = req.query.projectId as string | undefined;

  const roles = await permissionService.getUserRoles(userId, projectId);

  res.json({ data: roles });
}));

export default router;

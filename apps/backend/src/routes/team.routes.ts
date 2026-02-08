/**
 * Team Routes
 * Handles team management endpoints: CRUD, members, project access
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { teamService } from '../services/team.service.js';
import { authenticate, authorize, AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { ValidationError } from '../errors/index.js';
import { validate } from '../middleware/validation.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();

// All team routes require authentication
router.use(authenticate);

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const createTeamSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
});

const updateTeamSchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
});

const addMemberSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  role: z.enum(['owner', 'admin', 'member']).default('member'),
});

const updateMemberRoleSchema = z.object({
  role: z.enum(['owner', 'admin', 'member']),
});

const grantAccessSchema = z.object({
  projectId: z.string().uuid('Invalid project ID'),
  accessLevel: z.enum(['read', 'write', 'admin']).default('read'),
});

const updateAccessSchema = z.object({
  accessLevel: z.enum(['read', 'write', 'admin']),
});

// =============================================================================
// HELPERS
// =============================================================================

// =============================================================================
// TEAM CRUD ROUTES
// =============================================================================

/**
 * GET /api/teams
 * List all teams with pagination
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const isActive = req.query.isActive !== undefined
    ? req.query.isActive === 'true'
    : undefined;

  const result = await teamService.findAll({
    page,
    limit,
    isActive,
  });

  res.json({ data: result });
}));

/**
 * GET /api/teams/my-teams
 * Get teams for current user
 */
router.get('/my-teams', asyncHandler(async (req: Request, res: Response) => {
  const { userId } = (req as AuthenticatedRequest).user;
  const teams = await teamService.getTeamsByUser(userId);
  res.json({ data: teams });
}));

/**
 * GET /api/teams/:id
 * Get team by ID
 */
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const team = await teamService.findById(req.params.id);
  res.json({ data: team });
}));

/**
 * GET /api/teams/:id/details
 * Get team with members and project access
 */
router.get('/:id/details', asyncHandler(async (req: Request, res: Response) => {
  const team = await teamService.findByIdWithMembers(req.params.id);
  res.json({ data: team });
}));

/**
 * POST /api/teams
 * Create a new team (admin/lead only)
 */
router.post('/', authorize(['admin', 'lead']), asyncHandler(async (req: Request, res: Response) => {
  const { userId } = (req as AuthenticatedRequest).user;
  const data = validate(createTeamSchema, req.body);

  const team = await teamService.create({
    ...data,
    createdById: userId,
  });

  res.status(201).json({
    message: 'Team created successfully',
    data: team,
  });
}));

/**
 * PATCH /api/teams/:id
 * Update team (admin/lead only)
 */
router.patch('/:id', authorize(['admin', 'lead']), asyncHandler(async (req: Request, res: Response) => {
  const data = validate(updateTeamSchema, req.body);
  const team = await teamService.update(req.params.id, data);

  res.json({
    message: 'Team updated successfully',
    data: team,
  });
}));

/**
 * DELETE /api/teams/:id
 * Delete team (admin only)
 */
router.delete('/:id', authorize(['admin']), asyncHandler(async (req: Request, res: Response) => {
  await teamService.delete(req.params.id);
  res.json({
    message: 'Team deleted successfully',
  });
}));

// =============================================================================
// MEMBER MANAGEMENT ROUTES
// =============================================================================

/**
 * GET /api/teams/:id/members
 * Get team members
 */
router.get('/:id/members', asyncHandler(async (req: Request, res: Response) => {
  const members = await teamService.getTeamMembers(req.params.id);
  res.json({ data: members });
}));

/**
 * POST /api/teams/:id/members
 * Add member to team (admin/lead only)
 */
router.post('/:id/members', authorize(['admin', 'lead']), asyncHandler(async (req: Request, res: Response) => {
  const data = validate(addMemberSchema, req.body);
  const member = await teamService.addMember(
    req.params.id,
    data.userId,
    data.role
  );

  res.status(201).json({
    message: 'Member added successfully',
    data: member,
  });
}));

/**
 * PATCH /api/teams/:teamId/members/:userId
 * Update member role (admin/lead only)
 */
router.patch('/:teamId/members/:userId', authorize(['admin', 'lead']), asyncHandler(async (req: Request, res: Response) => {
  const data = validate(updateMemberRoleSchema, req.body);
  const member = await teamService.updateMemberRole(
    req.params.teamId,
    req.params.userId,
    data.role
  );

  res.json({
    message: 'Member role updated successfully',
    data: member,
  });
}));

/**
 * DELETE /api/teams/:teamId/members/:userId
 * Remove member from team (admin/lead only)
 */
router.delete('/:teamId/members/:userId', authorize(['admin', 'lead']), asyncHandler(async (req: Request, res: Response) => {
  await teamService.removeMember(req.params.teamId, req.params.userId);
  res.json({
    message: 'Member removed successfully',
  });
}));

// =============================================================================
// PROJECT ACCESS ROUTES
// =============================================================================

/**
 * GET /api/teams/:id/projects
 * Get team project access
 */
router.get('/:id/projects', asyncHandler(async (req: Request, res: Response) => {
  const access = await teamService.getTeamProjectAccess(req.params.id);
  res.json({ data: access });
}));

/**
 * POST /api/teams/:id/projects
 * Grant project access to team (admin/lead only)
 */
router.post('/:id/projects', authorize(['admin', 'lead']), asyncHandler(async (req: Request, res: Response) => {
  const { userId } = (req as AuthenticatedRequest).user;
  const data = validate(grantAccessSchema, req.body);
  const access = await teamService.grantProjectAccess(
    req.params.id,
    data.projectId,
    data.accessLevel,
    userId
  );

  res.status(201).json({
    message: 'Project access granted successfully',
    data: access,
  });
}));

/**
 * PATCH /api/teams/:teamId/projects/:projectId
 * Update project access level (admin/lead only)
 */
router.patch('/:teamId/projects/:projectId', authorize(['admin', 'lead']), asyncHandler(async (req: Request, res: Response) => {
  const data = validate(updateAccessSchema, req.body);
  const access = await teamService.updateProjectAccess(
    req.params.teamId,
    req.params.projectId,
    data.accessLevel
  );

  res.json({
    message: 'Project access updated successfully',
    data: access,
  });
}));

/**
 * DELETE /api/teams/:teamId/projects/:projectId
 * Revoke project access from team (admin/lead only)
 */
router.delete('/:teamId/projects/:projectId', authorize(['admin', 'lead']), asyncHandler(async (req: Request, res: Response) => {
  await teamService.revokeProjectAccess(req.params.teamId, req.params.projectId);
  res.json({
    message: 'Project access revoked successfully',
  });
}));

export default router;

/**
 * Project Routes
 * Handles project management endpoints: CRUD operations, activation/deactivation
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { projectService } from '../services/project.service.js';
import { authenticate, authorize, AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { ValidationError } from '../errors/index.js';
import type { Framework, Language } from '@prisma/client';

const router = Router();

// All project routes require authentication
router.use(authenticate);

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const createProjectSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  repositoryUrl: z.string().url().optional().or(z.literal('')),
  framework: z.enum(['playwright', 'cypress']).optional(),
  language: z.enum(['typescript', 'javascript']).optional(),
});

const updateProjectSchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
  description: z.string().optional(),
  repositoryUrl: z.string().url().optional().or(z.literal('')),
  framework: z.enum(['playwright', 'cypress']).optional(),
  language: z.enum(['typescript', 'javascript']).optional(),
  isActive: z.boolean().optional(),
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
 * GET /api/projects
 * List all projects with pagination
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const framework = req.query.framework as Framework | undefined;
  const language = req.query.language as Language | undefined;
  const isActive = req.query.isActive !== undefined
    ? req.query.isActive === 'true'
    : undefined;

  const result = await projectService.findAll({
    page,
    limit,
    framework,
    language,
    isActive,
  });

  res.json({ data: result });
}));

/**
 * GET /api/projects/:id
 * Get project by ID
 */
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const project = await projectService.findById(req.params.id);
  res.json({ data: project });
}));

/**
 * GET /api/projects/:id/stats
 * Get project statistics
 */
router.get('/:id/stats', asyncHandler(async (req: Request, res: Response) => {
  const stats = await projectService.getProjectStats(req.params.id);
  res.json({ data: stats });
}));

/**
 * POST /api/projects
 * Create a new project (admin/lead only)
 */
router.post('/', authorize(['admin', 'lead']), asyncHandler(async (req: Request, res: Response) => {
  const { userId } = (req as AuthenticatedRequest).user;
  const data = validate(createProjectSchema, req.body);

  const project = await projectService.create({
    ...data,
    createdById: userId,
  });

  res.status(201).json({
    message: 'Project created successfully',
    data: project,
  });
}));

/**
 * PATCH /api/projects/:id
 * Update project (admin/lead only)
 */
router.patch('/:id', authorize(['admin', 'lead']), asyncHandler(async (req: Request, res: Response) => {
  const data = validate(updateProjectSchema, req.body);
  const project = await projectService.update(req.params.id, data);

  res.json({
    message: 'Project updated successfully',
    data: project,
  });
}));

/**
 * DELETE /api/projects/:id
 * Delete project (admin only)
 */
router.delete('/:id', authorize(['admin']), asyncHandler(async (req: Request, res: Response) => {
  await projectService.delete(req.params.id);
  res.json({
    message: 'Project deleted successfully',
  });
}));

/**
 * POST /api/projects/:id/deactivate
 * Deactivate project (admin/lead only)
 */
router.post('/:id/deactivate', authorize(['admin', 'lead']), asyncHandler(async (req: Request, res: Response) => {
  const project = await projectService.deactivate(req.params.id);
  res.json({
    message: 'Project deactivated successfully',
    data: project,
  });
}));

/**
 * POST /api/projects/:id/activate
 * Activate project (admin/lead only)
 */
router.post('/:id/activate', authorize(['admin', 'lead']), asyncHandler(async (req: Request, res: Response) => {
  const project = await projectService.activate(req.params.id);
  res.json({
    message: 'Project activated successfully',
    data: project,
  });
}));

export default router;

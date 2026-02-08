/**
 * User Routes
 * Handles user management endpoints: CRUD operations, activation/deactivation
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { userService } from '../services/user.service.js';
import { authenticate, authorize, AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { ValidationError, ForbiddenError } from '../errors/index.js';
import type { UserRole } from '@prisma/client';
import { validate } from '../middleware/validation.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();

// All user routes require authentication
router.use(authenticate);

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const createUserSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1, 'Name is required'),
  role: z.enum(['admin', 'lead', 'qae', 'dev']).optional(),
});

const updateUserSchema = z.object({
  email: z.string().email('Invalid email format').optional(),
  name: z.string().min(1, 'Name is required').optional(),
  role: z.enum(['admin', 'lead', 'qae', 'dev']).optional(),
  isActive: z.boolean().optional(),
});

// =============================================================================
// HELPERS
// =============================================================================

function excludePassword<T extends { passwordHash?: string }>(user: T): Omit<T, 'passwordHash'> {
  const { passwordHash: _, ...userWithoutPassword } = user;
  return userWithoutPassword;
}

// =============================================================================
// ROUTES
// =============================================================================

/**
 * GET /api/users
 * List all users with pagination (admin only)
 */
router.get('/', authorize(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const role = req.query.role as UserRole | undefined;
  const isActive = req.query.isActive !== undefined
    ? req.query.isActive === 'true'
    : undefined;

  const result = await userService.findAll({
    page,
    limit,
    role,
    isActive,
  });

  res.json({
    data: {
      ...result,
      data: result.data.map(excludePassword),
    },
  });
}));

/**
 * GET /api/users/:id
 * Get user by ID (admin or self)
 */
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { userId, role } = (req as AuthenticatedRequest).user;
  const targetId = req.params.id;

  // Non-admins can only view their own profile
  if (role !== 'admin' && userId !== targetId) {
    throw new ForbiddenError('You can only view your own profile');
  }

  const user = await userService.findById(targetId);
  res.json({
    data: excludePassword(user),
  });
}));

/**
 * POST /api/users
 * Create a new user (admin only)
 */
router.post('/', authorize(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const data = validate(createUserSchema, req.body);
  const user = await userService.create(data);

  res.status(201).json({
    message: 'User created successfully',
    data: excludePassword(user),
  });
}));

/**
 * PATCH /api/users/:id
 * Update user (admin or self for limited fields)
 */
router.patch('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { userId, role } = (req as AuthenticatedRequest).user;
  const targetId = req.params.id;
  const isAdmin = role === 'admin';

  // Non-admins can only update their own profile
  if (!isAdmin && userId !== targetId) {
    throw new ForbiddenError('You can only update your own profile');
  }

  let updateData = validate(updateUserSchema, req.body);

  // Non-admins cannot change role or isActive status
  if (!isAdmin) {
    const { role: _, isActive: __, ...allowedData } = updateData;
    updateData = allowedData;
  }

  const user = await userService.update(targetId, updateData);
  res.json({
    message: 'User updated successfully',
    data: excludePassword(user),
  });
}));

/**
 * DELETE /api/users/:id
 * Delete user (admin only)
 */
router.delete('/:id', authorize(['admin']), asyncHandler(async (req: Request, res: Response) => {
  await userService.delete(req.params.id);
  res.json({
    message: 'User deleted successfully',
  });
}));

/**
 * POST /api/users/:id/deactivate
 * Deactivate user (admin only)
 */
router.post('/:id/deactivate', authorize(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const user = await userService.deactivate(req.params.id);
  res.json({
    message: 'User deactivated successfully',
    data: excludePassword(user),
  });
}));

/**
 * POST /api/users/:id/activate
 * Activate user (admin only)
 */
router.post('/:id/activate', authorize(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const user = await userService.activate(req.params.id);
  res.json({
    message: 'User activated successfully',
    data: excludePassword(user),
  });
}));

export default router;

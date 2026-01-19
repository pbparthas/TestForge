/**
 * Auth Routes
 * Handles authentication endpoints: register, login, refresh, logout
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authService } from '../services/auth.service.js';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { ValidationError } from '../errors/index.js';

const router = Router();

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  username: z.string().min(3, 'Username must be at least 3 characters').regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1, 'Name is required'),
});

const loginSchema = z.object({
  identifier: z.string().min(1, 'Username or email is required'),
  password: z.string().min(1, 'Password is required'),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
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
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register', asyncHandler(async (req: Request, res: Response) => {
  const data = validate(registerSchema, req.body);
  const result = await authService.register(data);

  res.status(201).json({
    message: 'User registered successfully',
    data: result,
  });
}));

/**
 * POST /api/auth/login
 * Login with email and password
 */
router.post('/login', asyncHandler(async (req: Request, res: Response) => {
  const data = validate(loginSchema, req.body);
  const result = await authService.login(data);

  res.json({
    message: 'Login successful',
    data: result,
  });
}));

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh', asyncHandler(async (req: Request, res: Response) => {
  const data = validate(refreshSchema, req.body);
  const result = await authService.refreshTokens(data.refreshToken);

  res.json({
    message: 'Tokens refreshed successfully',
    data: result,
  });
}));

/**
 * POST /api/auth/logout
 * Logout user (revoke refresh tokens)
 */
router.post('/logout', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { userId } = (req as AuthenticatedRequest).user;
  await authService.logout(userId);

  res.json({
    message: 'Logged out successfully',
  });
}));

/**
 * POST /api/auth/change-password
 * Change user password
 */
router.post('/change-password', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { userId } = (req as AuthenticatedRequest).user;
  const data = validate(changePasswordSchema, req.body);

  await authService.changePassword(userId, data.currentPassword, data.newPassword);

  res.json({
    message: 'Password changed successfully',
  });
}));

/**
 * GET /api/auth/me
 * Get current user info
 */
router.get('/me', authenticate, (req: Request, res: Response) => {
  const { userId, role } = (req as AuthenticatedRequest).user;

  res.json({
    data: { userId, role },
  });
});

export default router;

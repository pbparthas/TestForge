/**
 * Auth Routes
 * Handles authentication endpoints: register, login, refresh, logout
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authService } from '../services/auth.service.js';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { ValidationError } from '../errors/index.js';
import { validate } from '../middleware/validation.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';
import { generateCsrfToken, setCsrfCookie } from '../middleware/csrf.middleware.js';

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

const isProduction = process.env.NODE_ENV === 'production';

function setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
  res.cookie('access_token', accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    path: '/api',
    maxAge: 15 * 60 * 1000, // 15 minutes
  });
  res.cookie('refresh_token', refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    path: '/api/auth/refresh',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
  setCsrfCookie(res, generateCsrfToken());
}

function clearAuthCookies(res: Response): void {
  res.clearCookie('access_token', { path: '/api' });
  res.clearCookie('refresh_token', { path: '/api/auth/refresh' });
  res.clearCookie('csrf_token', { path: '/' });
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

  setAuthCookies(res, result.accessToken, result.refreshToken);

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

  setAuthCookies(res, result.accessToken, result.refreshToken);

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
  // Accept refresh token from body or cookie
  const refreshToken = req.body.refreshToken || req.cookies?.refresh_token;
  if (!refreshToken) {
    res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Refresh token is required' },
    });
    return;
  }
  const result = await authService.refreshTokens(refreshToken);

  setAuthCookies(res, result.accessToken, result.refreshToken);

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

  clearAuthCookies(res);

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

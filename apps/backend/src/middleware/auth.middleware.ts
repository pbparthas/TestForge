/**
 * Auth Middleware
 * Handles authentication and authorization for protected routes
 */

import type { Request, Response, NextFunction } from 'express';
import type { UserRole } from '@prisma/client';
import { authService } from '../services/auth.service.js';
import { prisma } from '../utils/prisma.js';

// =============================================================================
// TYPES
// =============================================================================

export interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    role: UserRole;
  };
}

// =============================================================================
// MIDDLEWARE
// =============================================================================

/**
 * Extract token from request: cookie first, then Bearer header (dual-mode SEC-003).
 */
function extractToken(req: Request): string | null {
  // 1. Try httpOnly cookie
  const cookieToken = req.cookies?.access_token;
  if (cookieToken) return cookieToken;

  // 2. Fall back to Authorization: Bearer header
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      return parts[1];
    }
  }

  return null;
}

/**
 * Authenticate request by verifying JWT token.
 * Supports both httpOnly cookie and Bearer header (dual-mode transition).
 */
export function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const token = extractToken(req);

  if (!token) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'No authentication token provided',
      },
    });
    return;
  }

  try {
    const payload = authService.verifyAccessToken(token);
    (req as AuthenticatedRequest).user = payload;
    next();
  } catch {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired token',
      },
    });
  }
}

/**
 * Authenticate request and verify user is active (async version).
 * Supports both httpOnly cookie and Bearer header (dual-mode transition).
 */
export async function authenticateWithActiveCheck(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const token = extractToken(req);

  if (!token) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'No authentication token provided',
      },
    });
    return;
  }

  try {
    const payload = authService.verifyAccessToken(token);

    // Check if user is active
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user || !user.isActive) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'User account is inactive',
        },
      });
      return;
    }

    (req as AuthenticatedRequest).user = payload;
    next();
  } catch {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired token',
      },
    });
  }
}

/**
 * Authorize request by checking user role
 */
export function authorize(allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as AuthenticatedRequest).user;

    if (!user) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not authenticated',
        },
      });
      return;
    }

    if (!allowedRoles.includes(user.role)) {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions',
        },
      });
      return;
    }

    next();
  };
}

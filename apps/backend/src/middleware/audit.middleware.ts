/**
 * Audit Middleware
 * Auto-logs API requests for audit trail
 */

import type { Request, Response, NextFunction } from 'express';
import type { AuditCategory } from '@prisma/client';
import { auditEnhancedService } from '../services/audit-enhanced.service.js';
import { AuthenticatedRequest } from './auth.middleware.js';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger.js';

// =============================================================================
// TYPES
// =============================================================================

export interface AuditConfig {
  /** Resources to audit (default: all) */
  resources?: string[];
  /** Actions to audit (default: modifying actions) */
  actions?: string[];
  /** Skip paths that match these patterns */
  skipPaths?: RegExp[];
  /** Include request body in audit log */
  includeBody?: boolean;
  /** Include response in audit log */
  includeResponse?: boolean;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Extract resource and action from request
 */
function extractResourceAndAction(req: Request): { resource: string; action: string; resourceId?: string } {
  const pathParts = req.path.split('/').filter(Boolean);

  // Remove 'api' prefix if present
  if (pathParts[0] === 'api') {
    pathParts.shift();
  }

  const resource = pathParts[0] || 'unknown';
  const resourceId = pathParts[1] && !['create', 'list', 'search'].includes(pathParts[1])
    ? pathParts[1]
    : undefined;

  // Map HTTP method to action
  const methodToAction: Record<string, string> = {
    GET: 'READ',
    POST: 'CREATE',
    PUT: 'UPDATE',
    PATCH: 'UPDATE',
    DELETE: 'DELETE',
  };

  const action = methodToAction[req.method] || req.method;

  return { resource, action, resourceId };
}

/**
 * Determine audit category from request
 */
function determineCategory(req: Request): AuditCategory {
  const path = req.path.toLowerCase();

  if (path.includes('/auth/')) {
    return 'authentication';
  }

  if (path.includes('/permissions') || path.includes('/roles')) {
    return 'authorization';
  }

  if (req.method === 'GET') {
    return 'data_access';
  }

  return 'data_modification';
}

/**
 * Extract project ID from request
 */
function extractProjectId(req: Request): string | undefined {
  // Check query params
  if (req.query.projectId) {
    return req.query.projectId as string;
  }

  // Check body
  if (req.body?.projectId) {
    return req.body.projectId;
  }

  // Check path params
  if (req.params?.projectId) {
    return req.params.projectId;
  }

  // Check path for project resource
  const pathParts = req.path.split('/').filter(Boolean);
  const projectIndex = pathParts.indexOf('projects');
  if (projectIndex !== -1 && pathParts[projectIndex + 1]) {
    return pathParts[projectIndex + 1];
  }

  return undefined;
}

// =============================================================================
// MIDDLEWARE
// =============================================================================

/**
 * Default paths to skip auditing
 */
const DEFAULT_SKIP_PATHS = [
  /^\/health$/,
  /^\/api\/health$/,
  /^\/favicon\.ico$/,
  /^\/api\/audit/, // Don't audit audit endpoints
];

/**
 * Create audit middleware with configuration
 */
export function createAuditMiddleware(config: AuditConfig = {}) {
  const skipPaths = [...DEFAULT_SKIP_PATHS, ...(config.skipPaths || [])];

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Check if path should be skipped
    const shouldSkip = skipPaths.some(pattern => pattern.test(req.path));
    if (shouldSkip) {
      next();
      return;
    }

    // Skip GET requests unless configured to audit reads
    if (req.method === 'GET' && !config.actions?.includes('READ')) {
      next();
      return;
    }

    const startTime = Date.now();
    const requestId = uuidv4();

    // Store request ID on request for correlation
    (req as Request & { requestId: string }).requestId = requestId;

    // Capture original end method
    const originalEnd = res.end;
    let responseBody: unknown;

    // Override end to capture response
    res.end = function (chunk?: unknown, ...args: unknown[]): Response {
      if (config.includeResponse && chunk) {
        try {
          responseBody = JSON.parse(chunk.toString());
        } catch {
          responseBody = chunk.toString();
        }
      }
      return originalEnd.apply(res, [chunk, ...args] as Parameters<typeof originalEnd>);
    };

    // After response is finished, log the audit
    res.on('finish', async () => {
      const durationMs = Date.now() - startTime;
      const user = (req as AuthenticatedRequest).user;
      const { resource, action, resourceId } = extractResourceAndAction(req);
      const category = determineCategory(req);
      const projectId = extractProjectId(req);

      try {
        await auditEnhancedService.log({
          userId: user?.userId,
          action,
          category,
          resource,
          resourceId,
          projectId,
          description: `${req.method} ${req.path}`,
          newValue: config.includeBody ? (req.body as Record<string, unknown>) : undefined,
          metadata: config.includeResponse ? { response: responseBody } : undefined,
          ipAddress: (req.ip || req.socket.remoteAddress) ?? undefined,
          userAgent: req.headers['user-agent'],
          requestId,
          durationMs,
          success: res.statusCode < 400,
          errorMessage: res.statusCode >= 400 ? `HTTP ${res.statusCode}` : undefined,
        });
      } catch (error) {
        // Don't fail request if audit logging fails
        logger.error({ error }, 'Failed to create audit log');
      }
    });

    next();
  };
}

/**
 * Default audit middleware instance
 */
export const auditMiddleware = createAuditMiddleware({
  includeBody: true,
});

/**
 * Strict audit middleware that includes response
 */
export const strictAuditMiddleware = createAuditMiddleware({
  includeBody: true,
  includeResponse: true,
});

/**
 * Lightweight audit middleware for high-traffic endpoints
 */
export const lightAuditMiddleware = createAuditMiddleware({
  includeBody: false,
  includeResponse: false,
});

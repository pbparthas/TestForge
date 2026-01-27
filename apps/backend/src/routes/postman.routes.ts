/**
 * Postman Import Routes
 * Sprint 20: API endpoints for Postman collection import
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, authorize, AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { postmanImportService } from '../services/postman-import.service.js';
import { ValidationError } from '../errors/index.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// =============================================================================
// HELPERS
// =============================================================================

function validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ValidationError(
      'Validation failed',
      result.error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }))
    );
  }
  return result.data;
}

function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// =============================================================================
// SCHEMAS
// =============================================================================

const previewSchema = z.object({
  collection: z.string().min(1, 'Collection JSON is required'),
});

const importSchema = z.object({
  collection: z.string().min(1, 'Collection JSON is required'),
  projectId: z.string().uuid('Invalid project ID'),
  importType: z.enum(['test_cases', 'scripts', 'both']),
  defaultPriority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  defaultTestType: z.enum(['functional', 'integration', 'e2e', 'api', 'performance']).optional(),
  framework: z.enum(['playwright', 'cypress']).optional(),
  variableMapping: z.record(z.string()).optional(),
});

const listSchema = z.object({
  projectId: z.string().uuid('Invalid project ID'),
  limit: z.coerce.number().min(1).max(100).optional(),
});

// =============================================================================
// ROUTES
// =============================================================================

/**
 * POST /api/postman/preview
 * Preview a Postman collection before importing
 */
router.post(
  '/preview',
  asyncHandler(async (req: Request, res: Response) => {
    const { collection } = validate(previewSchema, req.body);

    try {
      const preview = await postmanImportService.preview(collection);
      res.json({
        message: 'Collection parsed successfully',
        data: preview,
      });
    } catch (error) {
      // Convert parse errors to validation errors for proper 400 response
      if (error instanceof Error &&
          (error.message.includes('Invalid') ||
           error.message.includes('Missing') ||
           error.message.includes('too large'))) {
        throw new ValidationError(error.message, [{ field: 'collection', message: error.message }]);
      }
      throw error;
    }
  })
);

/**
 * POST /api/postman/import
 * Import a Postman collection
 */
router.post(
  '/import',
  authorize(['admin', 'lead', 'qae']),
  asyncHandler(async (req: Request, res: Response) => {
    const data = validate(importSchema, req.body);
    const authReq = req as AuthenticatedRequest;

    const result = await postmanImportService.import(data.collection, {
      importType: data.importType,
      projectId: data.projectId,
      userId: authReq.user!.userId,
      defaultPriority: data.defaultPriority,
      defaultTestType: data.defaultTestType,
      framework: data.framework,
      variableMapping: data.variableMapping,
    });

    res.status(201).json({
      message: `Successfully imported ${result.importedCount} items`,
      data: result,
    });
  })
);

/**
 * GET /api/postman/imports
 * Get import history for a project
 */
router.get(
  '/imports',
  asyncHandler(async (req: Request, res: Response) => {
    const { projectId, limit } = validate(listSchema, req.query);

    const imports = await postmanImportService.getImportHistory(projectId, limit);

    res.json({
      message: 'Import history retrieved',
      data: imports,
    });
  })
);

/**
 * GET /api/postman/imports/:id
 * Get a specific import by ID
 */
router.get(
  '/imports/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const importRecord = await postmanImportService.getImport(req.params.id);

    res.json({
      message: 'Import retrieved',
      data: importRecord,
    });
  })
);

export default router;

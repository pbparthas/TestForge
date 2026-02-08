/**
 * Test Template Routes
 * Sprint 20: API endpoints for test template management
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, authorize, AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { templateService } from '../services/template.service.js';
import { ValidationError } from '../errors/index.js';
import type { TestTemplateCategory } from '@prisma/client';
import { validate } from '../middleware/validation.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// =============================================================================
// HELPERS
// =============================================================================
// =============================================================================
// SCHEMAS
// =============================================================================

const stepSchema = z.object({
  order: z.number().int().positive(),
  action: z.string().min(1),
  expected: z.string().min(1),
});

const contentSchema = z.object({
  steps: z.array(stepSchema).min(1, 'At least one step is required'),
  preconditions: z.string().optional(),
  expectedResult: z.string().optional(),
  testData: z.record(z.unknown()).optional(),
});

const createSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  category: z.enum(['auth', 'crud', 'api', 'forms', 'e2e', 'performance', 'security', 'custom']),
  content: contentSchema,
  variables: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  testType: z.enum(['functional', 'integration', 'e2e', 'api', 'performance']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  isPublic: z.boolean().optional(),
  projectId: z.string().uuid().optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  category: z.enum(['auth', 'crud', 'api', 'forms', 'e2e', 'performance', 'security', 'custom']).optional(),
  content: contentSchema.optional(),
  variables: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  testType: z.enum(['functional', 'integration', 'e2e', 'api', 'performance']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  isPublic: z.boolean().optional(),
});

const listSchema = z.object({
  category: z.enum(['auth', 'crud', 'api', 'forms', 'e2e', 'performance', 'security', 'custom']).optional(),
  isBuiltIn: z.coerce.boolean().optional(),
  projectId: z.string().uuid().optional(),
  search: z.string().optional(),
  tags: z.string().optional(), // Comma-separated
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

const useTemplateSchema = z.object({
  templateId: z.string().uuid(),
  projectId: z.string().uuid(),
  variableValues: z.record(z.string()).optional(),
  overrides: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
    testType: z.enum(['functional', 'integration', 'e2e', 'api', 'performance']).optional(),
  }).optional(),
});

// =============================================================================
// ROUTES
// =============================================================================

/**
 * GET /api/templates
 * List templates with filtering
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const options = validate(listSchema, req.query);

    const { data, total } = await templateService.list({
      ...options,
      tags: options.tags ? options.tags.split(',').map((t: string) => t.trim()) : undefined,
    });

    res.json({
      message: 'Templates retrieved',
      data,
      pagination: {
        page: options.page ?? 1,
        limit: options.limit ?? 20,
        total,
        totalPages: Math.ceil(total / (options.limit ?? 20)),
      },
    });
  })
);

/**
 * GET /api/templates/categories
 * Get all categories with template counts
 */
router.get(
  '/categories',
  asyncHandler(async (_req: Request, res: Response) => {
    const stats = await templateService.getCategoryStats();

    res.json({
      message: 'Category stats retrieved',
      data: stats,
    });
  })
);

/**
 * GET /api/templates/tags
 * Get all unique tags
 */
router.get(
  '/tags',
  asyncHandler(async (_req: Request, res: Response) => {
    const tags = await templateService.getAllTags();

    res.json({
      message: 'Tags retrieved',
      data: tags,
    });
  })
);

const categoryParamSchema = z.object({
  category: z.enum(['auth', 'crud', 'api', 'forms', 'e2e', 'performance', 'security', 'custom']),
});

/**
 * GET /api/templates/category/:category
 * Get templates by category
 */
router.get(
  '/category/:category',
  asyncHandler(async (req: Request, res: Response) => {
    const { category } = validate(categoryParamSchema, req.params);

    const templates = await templateService.getByCategory(category);

    res.json({
      message: 'Templates retrieved',
      data: templates,
    });
  })
);

/**
 * GET /api/templates/:id
 * Get a single template by ID
 */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const template = await templateService.findById(req.params.id);

    res.json({
      message: 'Template retrieved',
      data: template,
    });
  })
);

/**
 * POST /api/templates
 * Create a new custom template
 */
router.post(
  '/',
  authorize(['admin', 'lead', 'qae']),
  asyncHandler(async (req: Request, res: Response) => {
    const data = validate(createSchema, req.body);
    const authReq = req as AuthenticatedRequest;

    const template = await templateService.create({
      ...data,
      createdById: authReq.user!.userId,
    });

    res.status(201).json({
      message: 'Template created successfully',
      data: template,
    });
  })
);

/**
 * POST /api/templates/use
 * Create a test case from a template
 */
router.post(
  '/use',
  authorize(['admin', 'lead', 'qae']),
  asyncHandler(async (req: Request, res: Response) => {
    const data = validate(useTemplateSchema, req.body);
    const authReq = req as AuthenticatedRequest;

    const testCase = await templateService.useTemplate({
      ...data,
      createdById: authReq.user!.userId,
    });

    res.status(201).json({
      message: 'Test case created from template',
      data: testCase,
    });
  })
);

/**
 * POST /api/templates/seed
 * Seed built-in templates (admin only)
 */
router.post(
  '/seed',
  authorize(['admin']),
  asyncHandler(async (_req: Request, res: Response) => {
    const result = await templateService.seedBuiltInTemplates();

    res.json({
      message: `Seeded templates: ${result.created} created, ${result.skipped} skipped`,
      data: result,
    });
  })
);

/**
 * PUT /api/templates/:id
 * Update a custom template
 */
router.put(
  '/:id',
  authorize(['admin', 'lead', 'qae']),
  asyncHandler(async (req: Request, res: Response) => {
    const data = validate(updateSchema, req.body);

    const template = await templateService.update(req.params.id, data);

    res.json({
      message: 'Template updated successfully',
      data: template,
    });
  })
);

/**
 * DELETE /api/templates/:id
 * Delete a custom template
 */
router.delete(
  '/:id',
  authorize(['admin', 'lead']),
  asyncHandler(async (req: Request, res: Response) => {
    await templateService.delete(req.params.id);

    res.json({
      message: 'Template deleted successfully',
    });
  })
);

export default router;

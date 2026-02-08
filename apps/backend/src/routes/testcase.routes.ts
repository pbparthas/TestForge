/**
 * TestCase Routes
 * Handles test case CRUD operations
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { testCaseService } from '../services/testcase.service.js';
import { authenticate, authorize, AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { ValidationError } from '../errors/index.js';
import type { Priority, Status, TestType } from '@prisma/client';
import { validate } from '../middleware/validation.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const testStepSchema = z.object({
  order: z.number(),
  action: z.string(),
  expected: z.string(),
});

const createTestCaseSchema = z.object({
  projectId: z.string().uuid('Invalid project ID'),
  requirementId: z.string().uuid('Invalid requirement ID').optional(),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  preconditions: z.string().optional(),
  steps: z.array(testStepSchema).optional(),
  expectedResult: z.string().optional(),
  testData: z.record(z.unknown()).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  status: z.enum(['active', 'inactive', 'archived']).optional(),
  type: z.enum(['functional', 'integration', 'e2e', 'api', 'performance']).optional(),
  isAutomated: z.boolean().optional(),
});

const updateTestCaseSchema = z.object({
  requirementId: z.string().uuid('Invalid requirement ID').nullable().optional(),
  title: z.string().min(1, 'Title is required').optional(),
  description: z.string().optional(),
  preconditions: z.string().optional(),
  steps: z.array(testStepSchema).optional(),
  expectedResult: z.string().optional(),
  testData: z.record(z.unknown()).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  status: z.enum(['active', 'inactive', 'archived']).optional(),
  type: z.enum(['functional', 'integration', 'e2e', 'api', 'performance']).optional(),
  isAutomated: z.boolean().optional(),
});

const bulkUpdateStatusSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, 'At least one ID required'),
  status: z.enum(['active', 'inactive', 'archived']),
});

// =============================================================================
// HELPERS
// =============================================================================

// =============================================================================
// ROUTES
// =============================================================================

/**
 * GET /api/test-cases
 * List test cases with pagination and filtering
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const projectId = req.query.projectId as string | undefined;
  const requirementId = req.query.requirementId as string | undefined;
  const priority = req.query.priority as Priority | undefined;
  const status = req.query.status as Status | undefined;
  const type = req.query.type as TestType | undefined;
  const isAutomated = req.query.isAutomated !== undefined
    ? req.query.isAutomated === 'true'
    : undefined;

  const result = await testCaseService.findAll({
    page,
    limit,
    projectId,
    requirementId,
    priority,
    status,
    type,
    isAutomated,
  });

  res.json({ data: result });
}));

/**
 * GET /api/test-cases/:id
 * Get test case by ID
 */
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const testCase = await testCaseService.findById(req.params.id);
  res.json({ data: testCase });
}));

/**
 * POST /api/test-cases
 * Create a new test case
 */
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const { userId } = (req as AuthenticatedRequest).user;
  const data = validate(createTestCaseSchema, req.body);

  const testCase = await testCaseService.create({
    ...data,
    createdById: userId,
  });

  res.status(201).json({
    message: 'Test case created successfully',
    data: testCase,
  });
}));

/**
 * PATCH /api/test-cases/:id
 * Update test case
 */
router.patch('/:id', asyncHandler(async (req: Request, res: Response) => {
  const data = validate(updateTestCaseSchema, req.body);
  const testCase = await testCaseService.update(req.params.id, data);

  res.json({
    message: 'Test case updated successfully',
    data: testCase,
  });
}));

/**
 * DELETE /api/test-cases/:id
 * Delete test case (admin only)
 */
router.delete('/:id', authorize(['admin']), asyncHandler(async (req: Request, res: Response) => {
  await testCaseService.delete(req.params.id);
  res.json({
    message: 'Test case deleted successfully',
  });
}));

/**
 * POST /api/test-cases/:id/archive
 * Archive test case
 */
router.post('/:id/archive', asyncHandler(async (req: Request, res: Response) => {
  const testCase = await testCaseService.archive(req.params.id);
  res.json({
    message: 'Test case archived successfully',
    data: testCase,
  });
}));

/**
 * POST /api/test-cases/:id/duplicate
 * Duplicate test case
 */
router.post('/:id/duplicate', asyncHandler(async (req: Request, res: Response) => {
  const { userId } = (req as AuthenticatedRequest).user;
  const testCase = await testCaseService.duplicate(req.params.id, userId);

  res.status(201).json({
    message: 'Test case duplicated successfully',
    data: testCase,
  });
}));

/**
 * POST /api/test-cases/bulk-update-status
 * Bulk update status for multiple test cases (admin only)
 */
router.post('/bulk-update-status', authorize(['admin', 'lead']), asyncHandler(async (req: Request, res: Response) => {
  const data = validate(bulkUpdateStatusSchema, req.body);
  const result = await testCaseService.bulkUpdateStatus(data.ids, data.status);

  res.json({
    message: 'Test cases updated successfully',
    data: result,
  });
}));

export default router;

/**
 * Duplicate Detection Routes
 * Sprint 14: API endpoints for duplicate detection
 *
 * Routes:
 * - POST /api/duplicate/test-case - Check test case for duplicates
 * - POST /api/duplicate/script - Check script for duplicates
 * - POST /api/duplicate/session/:sessionId - Check ScriptSmith session
 * - GET /api/duplicate/check/:id - Get duplicate check by ID
 * - GET /api/duplicate/project/:projectId - Get checks for project
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.middleware.js';
import { duplicateDetectionService } from '../services/duplicate.service.js';
import { ValidationError } from '../errors/index.js';
import { validate } from '../middleware/validation.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();
router.use(authenticate);

// =============================================================================
// HELPERS
// =============================================================================
// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const checkTestCaseSchema = z.object({
  content: z.string().min(1, 'Content is required'),
  projectId: z.string().uuid('Invalid project ID'),
  testCaseId: z.string().uuid().optional(),
});

const checkScriptSchema = z.object({
  code: z.string().min(1, 'Code is required'),
  projectId: z.string().uuid('Invalid project ID'),
  scriptId: z.string().uuid().optional(),
});

const getProjectChecksQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(200).optional().default(50),
});

// =============================================================================
// ROUTES
// =============================================================================

/**
 * POST /api/duplicate/test-case - Check test case for duplicates
 */
router.post(
  '/test-case',
  asyncHandler(async (req, res) => {
    const data = validate(checkTestCaseSchema, req.body);

    const result = await duplicateDetectionService.checkTestCase(
      data.content,
      data.projectId,
      data.testCaseId
    );

    res.json({
      message: result.isDuplicate
        ? 'Potential duplicate found'
        : 'No duplicates detected',
      data: result,
    });
  })
);

/**
 * POST /api/duplicate/script - Check script for duplicates
 */
router.post(
  '/script',
  asyncHandler(async (req, res) => {
    const data = validate(checkScriptSchema, req.body);

    const result = await duplicateDetectionService.checkScript(
      data.code,
      data.projectId,
      data.scriptId
    );

    res.json({
      message: result.isDuplicate
        ? 'Potential duplicate found'
        : 'No duplicates detected',
      data: result,
    });
  })
);

/**
 * POST /api/duplicate/session/:sessionId - Check ScriptSmith session
 */
router.post(
  '/session/:sessionId',
  asyncHandler(async (req, res) => {
    const sessionId = req.params.sessionId as string;

    const result = await duplicateDetectionService.checkSession(sessionId);

    res.json({
      message: result.isDuplicate
        ? 'Potential duplicates found in session'
        : 'No duplicates detected',
      data: result,
    });
  })
);

/**
 * GET /api/duplicate/check/:id - Get duplicate check by ID
 */
router.get(
  '/check/:id',
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;

    const check = await duplicateDetectionService.getCheckById(id);

    res.json({ data: check });
  })
);

/**
 * GET /api/duplicate/project/:projectId - Get checks for project
 */
router.get(
  '/project/:projectId',
  asyncHandler(async (req, res) => {
    const projectId = req.params.projectId as string;
    const query = validate(getProjectChecksQuerySchema, req.query);

    const checks = await duplicateDetectionService.getProjectChecks(
      projectId,
      query.limit
    );

    res.json({
      data: checks,
      total: checks.length,
    });
  })
);

export default router;

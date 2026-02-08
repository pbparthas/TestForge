/**
 * Flaky Test Routes
 * Sprint 14: API endpoints for flaky test management
 *
 * Routes:
 * - GET /api/flaky/:projectId - Get flaky tests for project
 * - GET /api/flaky/:projectId/summary - Get project flaky summary
 * - GET /api/flaky/:projectId/trends - Get flaky test trends
 * - GET /api/flaky/:projectId/quarantined - Get quarantined tests
 * - GET /api/flaky/:projectId/patterns - Get detected patterns
 * - GET /api/flaky/test/:id - Get single flaky test
 * - POST /api/flaky/test/:id/quarantine - Quarantine a test
 * - POST /api/flaky/test/:id/unquarantine - Unquarantine a test
 * - POST /api/flaky/test/:id/fix-status - Update fix status
 * - POST /api/flaky/test/:id/pattern - Update pattern type
 * - POST /api/flaky/execution/:executionId/update - Update metrics from execution
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { flakyTestService } from '../services/flaky.service.js';
import { flakyAnalysisAgent } from '../agents/flakyanalysis.agent.js';
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

const getFlakyTestsQuerySchema = z.object({
  threshold: z.coerce.number().min(0).max(100).optional(),
  isQuarantined: z.enum(['true', 'false']).optional().transform(v => v === 'true'),
  fixStatus: z.enum(['open', 'investigating', 'fixed', 'wont_fix']).optional(),
  patternType: z.enum([
    'timing',
    'race_condition',
    'flaky_selector',
    'network',
    'state_dependent',
    'environment',
    'data_dependent',
    'unknown',
  ]).optional(),
});

const getTrendsQuerySchema = z.object({
  days: z.coerce.number().min(1).max(365).optional().default(30),
});

const quarantineSchema = z.object({
  reason: z.string().min(1, 'Reason is required'),
});

const fixStatusSchema = z.object({
  status: z.enum(['open', 'investigating', 'fixed', 'wont_fix']),
});

const patternTypeSchema = z.object({
  patternType: z.enum([
    'timing',
    'race_condition',
    'flaky_selector',
    'network',
    'state_dependent',
    'environment',
    'data_dependent',
    'unknown',
  ]),
});

const updateFromExecutionSchema = z.object({
  autoQuarantineThreshold: z.number().min(0).max(100).optional(),
});

// =============================================================================
// PROJECT ROUTES
// =============================================================================

/**
 * GET /api/flaky/:projectId - Get flaky tests for project
 */
router.get(
  '/:projectId',
  asyncHandler(async (req, res) => {
    const projectId = req.params.projectId as string;
    const query = validate(getFlakyTestsQuerySchema, req.query);

    const flakyTests = await flakyTestService.getFlakyTests({
      projectId,
      threshold: query.threshold,
      isQuarantined: query.isQuarantined,
      fixStatus: query.fixStatus,
      patternType: query.patternType,
    });

    res.json({
      data: flakyTests,
      total: flakyTests.length,
    });
  })
);

/**
 * GET /api/flaky/:projectId/summary - Get project flaky summary
 */
router.get(
  '/:projectId/summary',
  asyncHandler(async (req, res) => {
    const projectId = req.params.projectId as string;

    const summary = await flakyTestService.getProjectSummary(projectId);

    res.json({ data: summary });
  })
);

/**
 * GET /api/flaky/:projectId/trends - Get flaky test trends
 */
router.get(
  '/:projectId/trends',
  asyncHandler(async (req, res) => {
    const projectId = req.params.projectId as string;
    const query = validate(getTrendsQuerySchema, req.query);

    const trends = await flakyTestService.getTrends(projectId, query.days);

    res.json({ data: trends });
  })
);

/**
 * GET /api/flaky/:projectId/quarantined - Get quarantined tests
 */
router.get(
  '/:projectId/quarantined',
  asyncHandler(async (req, res) => {
    const projectId = req.params.projectId as string;

    const quarantined = await flakyTestService.getQuarantinedTests(projectId);

    res.json({
      data: quarantined,
      total: quarantined.length,
    });
  })
);

/**
 * GET /api/flaky/:projectId/patterns - Get detected patterns
 */
router.get(
  '/:projectId/patterns',
  asyncHandler(async (req, res) => {
    const projectId = req.params.projectId as string;

    const patterns = await flakyTestService.getPatterns(projectId);

    res.json({
      data: patterns,
      total: patterns.length,
    });
  })
);

// =============================================================================
// SINGLE TEST ROUTES
// =============================================================================

/**
 * GET /api/flaky/test/:id - Get single flaky test
 */
router.get(
  '/test/:id',
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;

    const flakyTest = await flakyTestService.getFlakyTestById(id);

    res.json({ data: flakyTest });
  })
);

/**
 * POST /api/flaky/test/:id/quarantine - Quarantine a test
 */
router.post(
  '/test/:id/quarantine',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const id = req.params.id as string;
    const data = validate(quarantineSchema, req.body);

    const flakyTest = await flakyTestService.quarantineTest(
      id,
      authReq.user.userId,
      data.reason
    );

    res.json({
      message: 'Test quarantined',
      data: flakyTest,
    });
  })
);

/**
 * POST /api/flaky/test/:id/unquarantine - Unquarantine a test
 */
router.post(
  '/test/:id/unquarantine',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const id = req.params.id as string;

    const flakyTest = await flakyTestService.unquarantineTest(
      id,
      authReq.user.userId
    );

    res.json({
      message: 'Test unquarantined',
      data: flakyTest,
    });
  })
);

/**
 * POST /api/flaky/test/:id/fix-status - Update fix status
 */
router.post(
  '/test/:id/fix-status',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const id = req.params.id as string;
    const data = validate(fixStatusSchema, req.body);

    const flakyTest = await flakyTestService.updateFixStatus(
      id,
      data.status,
      authReq.user.userId
    );

    res.json({
      message: 'Fix status updated',
      data: flakyTest,
    });
  })
);

/**
 * POST /api/flaky/test/:id/pattern - Update pattern type
 */
router.post(
  '/test/:id/pattern',
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    const data = validate(patternTypeSchema, req.body);

    const flakyTest = await flakyTestService.updatePatternType(
      id,
      data.patternType
    );

    res.json({
      message: 'Pattern type updated',
      data: flakyTest,
    });
  })
);

/**
 * POST /api/flaky/test/:id/mark-fixed - Mark test as fixed
 */
router.post(
  '/test/:id/mark-fixed',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const id = req.params.id as string;

    const flakyTest = await flakyTestService.markAsFixed(
      id,
      authReq.user.userId
    );

    res.json({
      message: 'Test marked as fixed',
      data: flakyTest,
    });
  })
);

/**
 * POST /api/flaky/test/:id/reset - Reset test metrics
 */
router.post(
  '/test/:id/reset',
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;

    const flakyTest = await flakyTestService.resetMetrics(id);

    res.json({
      message: 'Metrics reset',
      data: flakyTest,
    });
  })
);

// =============================================================================
// EXECUTION INTEGRATION
// =============================================================================

/**
 * POST /api/flaky/execution/:executionId/update - Update metrics from execution
 */
router.post(
  '/execution/:executionId/update',
  asyncHandler(async (req, res) => {
    const executionId = req.params.executionId as string;
    const data = validate(updateFromExecutionSchema, req.body);

    const result = await flakyTestService.updateMetricsFromExecution(
      executionId,
      data.autoQuarantineThreshold
    );

    res.json({
      message: 'Metrics updated from execution',
      data: result,
    });
  })
);

// =============================================================================
// AI ANALYSIS ROUTES
// =============================================================================

const analyzeRootCauseSchema = z.object({
  testName: z.string().min(1),
  testCode: z.string().min(1),
  executionHistory: z.array(z.object({
    executionId: z.string(),
    timestamp: z.string().transform(s => new Date(s)),
    status: z.enum(['passed', 'failed']),
    duration: z.number(),
    errorMessage: z.string().optional(),
    stackTrace: z.string().optional(),
    environment: z.string().optional(),
    browser: z.string().optional(),
    retryAttempt: z.number().optional(),
  })),
  flakinessScore: z.number().min(0).max(100),
  recentErrors: z.array(z.string()),
});

const detectPatternsSchema = z.object({
  projectId: z.string().uuid(),
  flakyTests: z.array(z.object({
    testName: z.string(),
    flakinessScore: z.number(),
    totalRuns: z.number(),
    passRate: z.number(),
    recentErrors: z.array(z.string()),
    lastPassAt: z.string().transform(s => new Date(s)).optional(),
    lastFailAt: z.string().transform(s => new Date(s)).optional(),
  })),
});

const generateReportSchema = z.object({
  projectId: z.string().uuid(),
  projectName: z.string().min(1),
  flakyTests: z.array(z.object({
    testName: z.string(),
    flakinessScore: z.number(),
    patternType: z.string().nullable(),
    isQuarantined: z.boolean(),
    fixStatus: z.string(),
  })),
  patterns: z.array(z.object({
    patternType: z.string(),
    description: z.string(),
    affectedCount: z.number(),
  })),
  trends: z.object({
    totalFlaky: z.number(),
    newFlaky: z.number(),
    fixed: z.number(),
    quarantined: z.number(),
    avgScore: z.number(),
  }),
});

const suggestFixSchema = z.object({
  testName: z.string().min(1),
  testCode: z.string().min(1),
  patternType: z.enum([
    'timing',
    'race_condition',
    'flaky_selector',
    'network',
    'state_dependent',
    'environment',
    'data_dependent',
    'unknown',
  ]),
  errorMessages: z.array(z.string()),
});

const classifyPatternSchema = z.object({
  testName: z.string().min(1),
  errorMessages: z.array(z.string()).min(1),
});

/**
 * POST /api/flaky/ai/analyze - AI root cause analysis
 */
router.post(
  '/ai/analyze',
  asyncHandler(async (req, res) => {
    const data = validate(analyzeRootCauseSchema, req.body);

    const result = await flakyAnalysisAgent.analyzeRootCause(data);

    res.json({
      message: 'Root cause analysis complete',
      data: result.data,
      usage: result.usage,
    });
  })
);

/**
 * POST /api/flaky/ai/patterns - Detect patterns across flaky tests
 */
router.post(
  '/ai/patterns',
  asyncHandler(async (req, res) => {
    const data = validate(detectPatternsSchema, req.body);

    const result = await flakyAnalysisAgent.detectPatterns(data);

    res.json({
      message: 'Pattern detection complete',
      data: result.data,
      usage: result.usage,
    });
  })
);

/**
 * POST /api/flaky/ai/report - Generate flaky test report
 */
router.post(
  '/ai/report',
  asyncHandler(async (req, res) => {
    const data = validate(generateReportSchema, req.body);

    const result = await flakyAnalysisAgent.generateReport(data as Parameters<typeof flakyAnalysisAgent.generateReport>[0]);

    res.json({
      message: 'Report generated',
      data: result.data,
      usage: result.usage,
    });
  })
);

/**
 * POST /api/flaky/ai/suggest-fix - Get fix suggestions for a flaky test
 */
router.post(
  '/ai/suggest-fix',
  asyncHandler(async (req, res) => {
    const data = validate(suggestFixSchema, req.body);

    const result = await flakyAnalysisAgent.suggestFix(data);

    res.json({
      message: 'Fix suggestions generated',
      data: result.data,
      usage: result.usage,
    });
  })
);

/**
 * POST /api/flaky/ai/classify - Classify flakiness pattern from errors
 */
router.post(
  '/ai/classify',
  asyncHandler(async (req, res) => {
    const data = validate(classifyPatternSchema, req.body);

    const result = await flakyAnalysisAgent.classifyPattern(
      data.testName,
      data.errorMessages
    );

    res.json({
      message: 'Pattern classification complete',
      data: result.data,
      usage: result.usage,
    });
  })
);

export default router;

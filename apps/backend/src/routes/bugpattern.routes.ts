/**
 * Bug Pattern Routes
 * Routes for analyzing bug patterns and predicting issues
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { bugPatternAgent } from '../agents/bugpattern.agent.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { ValidationError } from '../errors/index.js';
import { validate } from '../middleware/validation.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();
router.use(authenticate);

// =============================================================================
// SHARED SCHEMAS
// =============================================================================

const bugDataSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional().default(''),
  status: z.enum(['open', 'in_progress', 'resolved', 'closed', 'wontfix']),
  severity: z.enum(['critical', 'high', 'medium', 'low']),
  component: z.string().optional().default(''),
  stackTrace: z.string().optional(),
  steps: z.array(z.string()).optional(),
  environment: z.object({
    os: z.string().optional(),
    browser: z.string().optional(),
    version: z.string().optional(),
    device: z.string().optional(),
  }).optional(),
  createdAt: z.string().optional().default(() => new Date().toISOString()),
  labels: z.array(z.string()).optional(),
  assignee: z.string().optional(),
  reporter: z.string().optional(),
});

const testFailureSchema = z.object({
  testId: z.string(),
  name: z.string().optional().default(''),
  error: z.string(),
  stackTrace: z.string().optional(),
  duration: z.number().optional().default(0),
  retries: z.number().optional().default(0),
  screenshot: z.string().optional(),
  file: z.string().optional(),
  line: z.number().optional(),
});

const codeChangeSchema = z.object({
  file: z.string(),
  additions: z.number().optional().default(0),
  deletions: z.number().optional().default(0),
  author: z.string().optional().default(''),
  date: z.string().optional().default(() => new Date().toISOString()),
  commitMessage: z.string().optional().default(''),
  commitHash: z.string().optional(),
  filesChanged: z.array(z.string()).optional(),
});

// =============================================================================
// ANALYZE PATTERNS ROUTE
// =============================================================================

const analyzeSchema = z.object({
  bugs: z.array(bugDataSchema).min(1, 'At least one bug is required'),
  options: z.object({
    timeRange: z.object({
      from: z.string(),
      to: z.string(),
    }).optional(),
    components: z.array(z.string()).optional(),
    severities: z.array(z.enum(['critical', 'high', 'medium', 'low'])).optional(),
    minPatternFrequency: z.number().optional(),
  }).optional(),
});

/**
 * POST /api/bug-patterns/analyze
 * Analyze bug patterns in a collection of bugs
 */
router.post('/analyze', asyncHandler(async (req, res) => {
  const data = validate(analyzeSchema, req.body);

  const result = await bugPatternAgent.analyzePatterns(data.bugs, data.options);

  res.json({
    data: result.data,
    usage: result.usage,
  });
}));

// =============================================================================
// ROOT CAUSE ROUTE
// =============================================================================

const rootCauseSchema = z.object({
  failure: testFailureSchema.refine(
    (f) => f.testId && f.error,
    { message: 'failure must have testId and error' }
  ),
  context: z.array(codeChangeSchema).optional(),
});

/**
 * POST /api/bug-patterns/root-cause
 * Find root cause of a test failure
 */
router.post('/root-cause', asyncHandler(async (req, res) => {
  const data = validate(rootCauseSchema, req.body);

  const result = await bugPatternAgent.findRootCause(data.failure, data.context);

  res.json({
    data: result.data,
    usage: result.usage,
  });
}));

// =============================================================================
// PREDICT BUG-PRONE AREAS ROUTE
// =============================================================================

const predictSchema = z.object({
  codeChanges: z.array(codeChangeSchema).min(1, 'At least one code change is required'),
  historicalBugs: z.array(bugDataSchema).optional(),
});

/**
 * POST /api/bug-patterns/predict
 * Predict bug-prone areas based on code changes
 */
router.post('/predict', asyncHandler(async (req, res) => {
  const data = validate(predictSchema, req.body);

  const result = await bugPatternAgent.predictBugProne(data.codeChanges, data.historicalBugs);

  res.json({
    data: result.data,
    usage: result.usage,
  });
}));

// =============================================================================
// GENERATE REPORT ROUTE
// =============================================================================

const reportSchema = z.object({
  bugs: z.array(bugDataSchema).min(1, 'At least one bug is required'),
  options: z.object({
    format: z.enum(['detailed', 'summary', 'executive']).optional(),
    includeCharts: z.boolean().optional(),
    timeRange: z.object({
      from: z.string(),
      to: z.string(),
    }).optional(),
    focusAreas: z.array(z.string()).optional(),
  }).optional(),
});

/**
 * POST /api/bug-patterns/report
 * Generate a comprehensive bug analysis report
 */
router.post('/report', asyncHandler(async (req, res) => {
  const data = validate(reportSchema, req.body);

  const result = await bugPatternAgent.generateReport(data.bugs, data.options);

  res.json({
    data: result.data,
    usage: result.usage,
  });
}));

// =============================================================================
// CLUSTER BUGS ROUTE
// =============================================================================

const clusterSchema = z.object({
  bugs: z.array(bugDataSchema).min(1, 'At least one bug is required'),
  options: z.object({
    minClusterSize: z.number().optional(),
    maxClusters: z.number().optional(),
    similarityThreshold: z.number().optional(),
  }).optional(),
});

/**
 * POST /api/bug-patterns/cluster
 * Cluster similar bugs for efficient triage
 */
router.post('/cluster', asyncHandler(async (req, res) => {
  const data = validate(clusterSchema, req.body);

  const result = await bugPatternAgent.clusterBugs(data.bugs, data.options);

  res.json({
    data: result.data,
    usage: result.usage,
  });
}));

export default router;

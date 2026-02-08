/**
 * Test Evolution Agent Routes
 * Routes for analyzing test health, coverage evolution, stale tests, and test risk
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  testEvolutionAgent,
  TestSuiteInput,
  TestExecutionHistory,
  CoverageData,
  CodeChange,
  TestHealthOptions,
  CoverageEvolutionOptions,
  StaleTestsOptions,
  TestRiskOptions,
} from '../agents/testevolution.agent.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { ValidationError } from '../errors/index.js';
import { validate } from '../middleware/validation.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();
router.use(authenticate);

// =============================================================================
// SHARED SCHEMAS
// =============================================================================

const testInfoSchema = z.object({
  id: z.string().min(1, 'Test ID is required'),
  name: z.string(),
  file: z.string(),
  line: z.number().optional(),
  suite: z.string().optional(),
  tags: z.array(z.string()).optional(),
  lastModified: z.string().optional(),
  createdAt: z.string().optional(),
});

const testSuiteInputSchema = z.object({
  tests: z.array(testInfoSchema).min(1, 'At least one test is required'),
  projectRoot: z.string().optional(),
});

const testExecutionResultSchema = z.object({
  testId: z.string(),
  status: z.enum(['passed', 'failed', 'skipped', 'flaky']),
  duration: z.number(),
  error: z.string().optional(),
  retries: z.number().optional(),
  environment: z.string().optional(),
});

const testRunSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  duration: z.number(),
  results: z.array(testExecutionResultSchema),
  branch: z.string().optional(),
  commit: z.string().optional(),
});

const testExecutionHistorySchema = z.object({
  runs: z.array(testRunSchema).min(1, 'At least one run is required'),
  totalRuns: z.number(),
  timeRange: z.object({
    from: z.string(),
    to: z.string(),
  }),
});

const fileCoverageSchema = z.object({
  path: z.string(),
  lines: z.number(),
  branches: z.number(),
  functions: z.number(),
  statements: z.number(),
  uncoveredLines: z.array(z.number()).optional(),
});

const coverageSnapshotSchema = z.object({
  timestamp: z.string(),
  overall: z.number(),
  lines: z.number().optional(),
  branches: z.number().optional(),
  functions: z.number().optional(),
  statements: z.number().optional(),
  files: z.array(fileCoverageSchema).optional(),
});

const coverageDataSchema = z.object({
  current: coverageSnapshotSchema,
  history: z.array(z.object({
    timestamp: z.string(),
    overall: z.number(),
  })),
});

const codeChangeSchema = z.object({
  file: z.string(),
  lastModified: z.string(),
  changeCount: z.number(),
  changedFunctions: z.array(z.string()).optional(),
});

// =============================================================================
// POST /api/test-evolution/health - Analyze test health
// =============================================================================

const testHealthOptionsSchema = z.object({
  flakinessThreshold: z.number().optional(),
  slowTestThreshold: z.number().optional(),
  minRunsForAnalysis: z.number().optional(),
  filterByTags: z.array(z.string()).optional(),
  filterBySuite: z.string().optional(),
});

const testHealthSchema = z.object({
  testSuite: testSuiteInputSchema,
  executionHistory: testExecutionHistorySchema,
  options: testHealthOptionsSchema.optional(),
});

/**
 * POST /api/test-evolution/health
 * Analyze test suite health and identify problematic tests
 */
router.post('/health', asyncHandler(async (req, res) => {
  const data = validate(testHealthSchema, req.body);

  const result = await testEvolutionAgent.analyzeTestHealth(
    data.testSuite as TestSuiteInput,
    data.executionHistory as TestExecutionHistory,
    data.options as TestHealthOptions | undefined
  );

  res.json({
    data: result.data,
    usage: result.usage,
  });
}));

// =============================================================================
// POST /api/test-evolution/coverage - Track coverage evolution
// =============================================================================

const coverageEvolutionOptionsSchema = z.object({
  targetCoverage: z.number().optional(),
  regressionThreshold: z.number().optional(),
  gapThreshold: z.number().optional(),
  includePatterns: z.array(z.string()).optional(),
  excludePatterns: z.array(z.string()).optional(),
});

const coverageEvolutionSchema = z.object({
  coverageData: coverageDataSchema,
  options: coverageEvolutionOptionsSchema.optional(),
});

/**
 * POST /api/test-evolution/coverage
 * Track coverage evolution and identify trends
 */
router.post('/coverage', asyncHandler(async (req, res) => {
  const data = validate(coverageEvolutionSchema, req.body);

  const result = await testEvolutionAgent.trackCoverageEvolution(
    data.coverageData as CoverageData,
    data.options as CoverageEvolutionOptions | undefined
  );

  res.json({
    data: result.data,
    usage: result.usage,
  });
}));

// =============================================================================
// POST /api/test-evolution/stale - Detect stale tests
// =============================================================================

const staleTestsOptionsSchema = z.object({
  stalenessDays: z.number().optional(),
  includeDeadCodeAnalysis: z.boolean().optional(),
  includeApiContractAnalysis: z.boolean().optional(),
});

const staleTestsSchema = z.object({
  testSuite: testSuiteInputSchema,
  codeChanges: z.array(codeChangeSchema),
  options: staleTestsOptionsSchema.optional(),
});

/**
 * POST /api/test-evolution/stale
 * Detect stale and outdated tests
 */
router.post('/stale', asyncHandler(async (req, res) => {
  const data = validate(staleTestsSchema, req.body);

  const result = await testEvolutionAgent.detectStaleTests(
    data.testSuite as TestSuiteInput,
    data.codeChanges as CodeChange[],
    data.options as StaleTestsOptions | undefined
  );

  res.json({
    data: result.data,
    usage: result.usage,
  });
}));

// =============================================================================
// POST /api/test-evolution/risk - Score test risk
// =============================================================================

const riskWeightsSchema = z.object({
  flakiness: z.number().optional(),
  staleness: z.number().optional(),
  complexity: z.number().optional(),
  dependencies: z.number().optional(),
});

const testRiskOptionsSchema = z.object({
  riskWeights: riskWeightsSchema.optional(),
  criticalThreshold: z.number().optional(),
  highThreshold: z.number().optional(),
  mediumThreshold: z.number().optional(),
});

const testRiskSchema = z.object({
  testSuite: testSuiteInputSchema,
  executionHistory: testExecutionHistorySchema,
  coverageData: coverageDataSchema,
  options: testRiskOptionsSchema.optional(),
});

/**
 * POST /api/test-evolution/risk
 * Score test risk and prioritize maintenance
 */
router.post('/risk', asyncHandler(async (req, res) => {
  const data = validate(testRiskSchema, req.body);

  const result = await testEvolutionAgent.scoreTestRisk(
    data.testSuite as TestSuiteInput,
    data.executionHistory as TestExecutionHistory,
    data.coverageData as CoverageData,
    data.options as TestRiskOptions | undefined
  );

  res.json({
    data: result.data,
    usage: result.usage,
  });
}));

export default router;

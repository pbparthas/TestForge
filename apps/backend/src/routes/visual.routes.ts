/**
 * Visual Analysis Routes
 * Routes for visual regression testing and UI element detection
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { visualAnalysisAgent } from '../agents/visualanalysis.agent.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { ValidationError } from '../errors/index.js';

const router = Router();
router.use(authenticate);

function validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ValidationError('Validation failed', result.error.errors.map(e => ({
      field: e.path.join('.'), message: e.message,
    })));
  }
  return result.data;
}

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// =============================================================================
// SHARED SCHEMAS
// =============================================================================

const screenshotInputSchema = z.object({
  base64: z.string().min(100),
  mediaType: z.enum(['image/jpeg', 'image/png', 'image/gif', 'image/webp']),
  metadata: z.object({
    url: z.string().optional(),
    viewport: z.object({
      width: z.number(),
      height: z.number(),
    }).optional(),
    devicePixelRatio: z.number().optional(),
    timestamp: z.string().optional(),
    browser: z.string().optional(),
    platform: z.string().optional(),
  }).optional(),
});

const boundingBoxSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});

const ignoreRegionSchema = z.object({
  box: boundingBoxSchema,
  reason: z.string(),
  type: z.enum(['dynamic', 'ad', 'timestamp', 'animation', 'user-content', 'custom']),
});

const visualDifferenceSchema = z.object({
  id: z.string(),
  category: z.enum(['layout', 'color', 'typography', 'spacing', 'content', 'visibility', 'size', 'position', 'missing', 'added']),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  description: z.string(),
  baselineRegion: boundingBoxSchema.optional(),
  currentRegion: boundingBoxSchema.optional(),
  confidence: z.number(),
  suggestion: z.string().optional(),
});

// =============================================================================
// COMPARE ROUTE
// =============================================================================

const compareSchema = z.object({
  baseline: screenshotInputSchema,
  current: screenshotInputSchema,
  ignoreRegions: z.array(ignoreRegionSchema).optional(),
  sensitivity: z.number().min(0).max(1).optional(),
  categories: z.array(z.enum(['layout', 'color', 'typography', 'spacing', 'content', 'visibility', 'size', 'position', 'missing', 'added'])).optional(),
  context: z.string().optional(),
});

/**
 * POST /api/visual/compare
 * Compare two screenshots and detect visual differences
 */
router.post('/compare', asyncHandler(async (req, res) => {
  const data = validate(compareSchema, req.body);

  const result = await visualAnalysisAgent.compare({
    baseline: data.baseline,
    current: data.current,
    ignoreRegions: data.ignoreRegions,
    sensitivity: data.sensitivity,
    categories: data.categories,
    context: data.context,
  });

  res.json({
    data: result.data,
    usage: result.usage,
  });
}));

// =============================================================================
// ANALYZE REGRESSION ROUTE
// =============================================================================

const analyzeRegressionSchema = z.object({
  difference: visualDifferenceSchema,
  baseline: screenshotInputSchema,
  current: screenshotInputSchema,
  changeContext: z.string().optional(),
  recentChanges: z.array(z.string()).optional(),
  historicalContext: z.string().optional(),
});

/**
 * POST /api/visual/analyze-regression
 * Analyze a visual difference to determine if it's a regression or intentional change
 */
router.post('/analyze-regression', asyncHandler(async (req, res) => {
  const data = validate(analyzeRegressionSchema, req.body);

  const result = await visualAnalysisAgent.analyzeRegression({
    difference: data.difference,
    baseline: data.baseline,
    current: data.current,
    changeContext: data.changeContext,
    recentChanges: data.recentChanges,
    historicalContext: data.historicalContext,
  });

  res.json({
    data: result.data,
    usage: result.usage,
  });
}));

// =============================================================================
// DETECT ELEMENTS ROUTE
// =============================================================================

const detectElementsSchema = z.object({
  screenshot: screenshotInputSchema,
  elementTypes: z.array(z.enum([
    'button', 'input', 'text', 'link', 'image', 'icon', 'checkbox', 'radio',
    'dropdown', 'toggle', 'slider', 'tab', 'menu', 'modal', 'card', 'list',
    'table', 'form', 'navigation', 'header', 'footer', 'container', 'unknown',
  ])).optional(),
  minConfidence: z.number().min(0).max(1).optional(),
  detectNested: z.boolean().optional(),
  context: z.string().optional(),
});

/**
 * POST /api/visual/detect-elements
 * Detect UI elements from a screenshot
 */
router.post('/detect-elements', asyncHandler(async (req, res) => {
  const data = validate(detectElementsSchema, req.body);

  const result = await visualAnalysisAgent.detectElements({
    screenshot: data.screenshot,
    elementTypes: data.elementTypes,
    minConfidence: data.minConfidence,
    detectNested: data.detectNested,
    context: data.context,
  });

  res.json({
    data: result.data,
    usage: result.usage,
  });
}));

// =============================================================================
// GENERATE TEST CASE ROUTE
// =============================================================================

const generateTestCaseSchema = z.object({
  screenshot: screenshotInputSchema,
  feature: z.string().optional(),
  focusAreas: z.array(z.string()).optional(),
  includeResponsive: z.boolean().optional(),
  maxTestCases: z.number().min(1).max(50).optional(),
  testTypes: z.array(z.enum(['visual', 'visual-regression', 'layout', 'responsive'])).optional(),
});

/**
 * POST /api/visual/generate-test-case
 * Generate visual test cases from a baseline screenshot
 */
router.post('/generate-test-case', asyncHandler(async (req, res) => {
  const data = validate(generateTestCaseSchema, req.body);

  const result = await visualAnalysisAgent.generateVisualTestCase({
    screenshot: data.screenshot,
    feature: data.feature,
    focusAreas: data.focusAreas,
    includeResponsive: data.includeResponsive,
    maxTestCases: data.maxTestCases,
    testTypes: data.testTypes,
  });

  res.json({
    data: result.data,
    usage: result.usage,
  });
}));

export default router;

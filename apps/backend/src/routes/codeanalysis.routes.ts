/**
 * Code Analysis Agent Routes
 * Routes for analyzing code complexity, architecture, best practices, and technical debt
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  codeAnalysisAgent,
  CodeInput,
  ComplexityOptions,
  ArchitectureOptions,
  BestPracticesOptions,
  TechnicalDebtOptions,
} from '../agents/codeanalysis.agent.js';
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

const fileInputSchema = z.object({
  path: z.string().min(1, 'File path is required'),
  content: z.string().min(1, 'File content is required'),
  language: z.string().optional(),
});

const codeInputSchema = z.object({
  files: z.array(fileInputSchema).min(1, 'At least one file is required'),
  projectRoot: z.string().optional(),
});

// =============================================================================
// POST /api/code-analysis/complexity - Analyze code complexity
// =============================================================================

const complexityOptionsSchema = z.object({
  cyclomaticThreshold: z.number().optional(),
  cognitiveThreshold: z.number().optional(),
  maintainabilityThreshold: z.number().optional(),
  includePatterns: z.array(z.string()).optional(),
  excludePatterns: z.array(z.string()).optional(),
});

const complexitySchema = z.object({
  input: codeInputSchema,
  options: complexityOptionsSchema.optional(),
});

/**
 * POST /api/code-analysis/complexity
 * Analyze code complexity metrics
 */
router.post('/complexity', asyncHandler(async (req, res) => {
  const data = validate(complexitySchema, req.body);

  const result = await codeAnalysisAgent.analyzeComplexity(
    data.input as CodeInput,
    data.options as ComplexityOptions | undefined
  );

  res.json({
    data: result.data,
    usage: result.usage,
  });
}));

// =============================================================================
// POST /api/code-analysis/architecture - Analyze architecture
// =============================================================================

const layerSchema = z.object({
  name: z.string(),
  patterns: z.array(z.string()),
});

const architectureOptionsSchema = z.object({
  layers: z.array(layerSchema).optional(),
  allowedDependencies: z.record(z.string(), z.array(z.string())).optional(),
});

const architectureSchema = z.object({
  input: codeInputSchema,
  options: architectureOptionsSchema.optional(),
});

/**
 * POST /api/code-analysis/architecture
 * Analyze architecture and dependencies
 */
router.post('/architecture', asyncHandler(async (req, res) => {
  const data = validate(architectureSchema, req.body);

  const result = await codeAnalysisAgent.analyzeArchitecture(
    data.input as CodeInput,
    data.options as ArchitectureOptions | undefined
  );

  res.json({
    data: result.data,
    usage: result.usage,
  });
}));

// =============================================================================
// POST /api/code-analysis/best-practices - Check best practices
// =============================================================================

const customRuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  pattern: z.string(),
  message: z.string(),
  severity: z.enum(['critical', 'warning', 'info']),
});

const bestPracticesOptionsSchema = z.object({
  enabledRules: z.array(z.string()).optional(),
  disabledRules: z.array(z.string()).optional(),
  customRules: z.array(customRuleSchema).optional(),
});

const bestPracticesSchema = z.object({
  input: codeInputSchema,
  options: bestPracticesOptionsSchema.optional(),
});

/**
 * POST /api/code-analysis/best-practices
 * Check code against best practices
 */
router.post('/best-practices', asyncHandler(async (req, res) => {
  const data = validate(bestPracticesSchema, req.body);

  const result = await codeAnalysisAgent.checkBestPractices(
    data.input as CodeInput,
    data.options as BestPracticesOptions | undefined
  );

  res.json({
    data: result.data,
    usage: result.usage,
  });
}));

// =============================================================================
// POST /api/code-analysis/technical-debt - Score technical debt
// =============================================================================

const historicalDataSchema = z.object({
  date: z.string(),
  totalHours: z.number(),
});

const technicalDebtOptionsSchema = z.object({
  hourlyRate: z.number().optional(),
  currency: z.string().optional(),
  includeSeverities: z.array(z.enum(['critical', 'high', 'medium', 'low'])).optional(),
  historicalData: z.array(historicalDataSchema).optional(),
});

const technicalDebtSchema = z.object({
  input: codeInputSchema,
  options: technicalDebtOptionsSchema.optional(),
});

/**
 * POST /api/code-analysis/technical-debt
 * Score and analyze technical debt
 */
router.post('/technical-debt', asyncHandler(async (req, res) => {
  const data = validate(technicalDebtSchema, req.body);

  const result = await codeAnalysisAgent.scoreTechnicalDebt(
    data.input as CodeInput,
    data.options as TechnicalDebtOptions | undefined
  );

  res.json({
    data: result.data,
    usage: result.usage,
  });
}));

export default router;

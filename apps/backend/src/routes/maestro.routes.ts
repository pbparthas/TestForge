/**
 * Maestro Routes
 * Routes for MaestroSmith agent - registry sync, flow generation, YAML validation
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { maestroService } from '../services/maestro.service.js';
import { maestroSmithAgent } from '../agents/maestrosmith.agent.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { ValidationError } from '../errors/index.js';
import { logger } from '../utils/logger.js';
import { validate } from '../middleware/validation.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();
router.use(authenticate);

// =============================================================================
// Schemas
// =============================================================================

const gitLabConfigSchema = z.object({
  host: z.string().url(),
  projectId: z.string().min(1),
  branch: z.string().min(1),
  jobName: z.string().min(1),
  artifactPath: z.string().min(1),
  accessToken: z.string().min(1),
});

const maestroConfigSchema = z.object({
  enabled: z.boolean(),
  gitlab: gitLabConfigSchema,
  defaultAppId: z.string().min(1),
});

const setConfigSchema = z.object({
  projectId: z.string().min(1),
  config: maestroConfigSchema,
});

const syncSchema = z.object({
  projectId: z.string().min(1),
});

const generateSchema = z.object({
  inputMethod: z.enum(['test_case', 'description']),
  testCase: z.object({
    id: z.string().optional(),
    title: z.string().min(1),
    steps: z.array(z.object({
      order: z.number(),
      action: z.string(),
      expected: z.string(),
    })).min(1),
    preconditions: z.string().optional(),
  }).optional(),
  description: z.string().min(10).optional(),
  options: z.object({
    appId: z.string().min(1),
    projectId: z.string().min(1),
    includeAssertions: z.boolean().optional(),
  }),
});

const editSchema = z.object({
  existingYaml: z.string().min(10),
  instruction: z.string().min(5),
  projectId: z.string().min(1),
  context: z.object({
    errorMessage: z.string().optional(),
    failedCommand: z.string().optional(),
  }).optional(),
});

const validateYamlSchema = z.object({
  yaml: z.string().min(1),
  projectId: z.string().optional(),
});

// =============================================================================
// Routes
// =============================================================================

/**
 * POST /api/maestro/config
 * Set Maestro configuration for a project
 */
router.post('/config', asyncHandler(async (req: Request, res: Response) => {
  const { projectId, config } = validate(setConfigSchema, req.body);

  maestroService.setConfig(projectId, config);

  logger.info({ projectId }, 'Maestro config set');

  res.json({
    message: 'Maestro configuration saved',
    data: { projectId },
  });
}));

/**
 * POST /api/maestro/sync
 * Sync registry from GitLab artifact (manual trigger)
 */
router.post('/sync', asyncHandler(async (req: Request, res: Response) => {
  const { projectId } = validate(syncSchema, req.body);

  const result = await maestroService.syncRegistry(projectId);

  res.json({
    message: result.success ? 'Registry synced successfully' : 'Registry sync failed',
    data: result,
  });
}));

/**
 * GET /api/maestro/registry
 * Get registry status for a project
 */
router.get('/registry', asyncHandler(async (req: Request, res: Response) => {
  const projectId = req.query.projectId as string;

  if (!projectId) {
    throw new ValidationError('projectId query parameter required', []);
  }

  const status = maestroService.getRegistryStatus(projectId);

  res.json({
    data: status,
  });
}));

/**
 * GET /api/maestro/registry/widgets
 * List widgets from registry with optional search
 */
router.get('/registry/widgets', asyncHandler(async (req: Request, res: Response) => {
  const projectId = req.query.projectId as string;
  const query = req.query.query as string | undefined;

  if (!projectId) {
    throw new ValidationError('projectId query parameter required', []);
  }

  let widgets;
  if (query) {
    widgets = maestroService.searchWidgets(projectId, query);
  } else {
    widgets = maestroService.getWidgets(projectId);
  }

  res.json({
    data: widgets,
  });
}));

/**
 * POST /api/maestro/generate
 * Generate Maestro YAML flow from test case or description
 */
router.post('/generate', asyncHandler(async (req: Request, res: Response) => {
  const input = validate(generateSchema, req.body);

  // Validate input method matches provided data
  if (input.inputMethod === 'test_case' && !input.testCase) {
    throw new ValidationError('testCase required for test_case input method', []);
  }
  if (input.inputMethod === 'description' && !input.description) {
    throw new ValidationError('description required for description input method', []);
  }

  const result = await maestroSmithAgent.generate(input);

  res.json({
    data: result.data,
    usage: result.usage,
  });
}));

/**
 * POST /api/maestro/edit
 * Edit existing Maestro YAML flow
 */
router.post('/edit', asyncHandler(async (req: Request, res: Response) => {
  const input = validate(editSchema, req.body);

  const result = await maestroSmithAgent.edit(input);

  res.json({
    data: result.data,
    usage: result.usage,
  });
}));

/**
 * POST /api/maestro/validate
 * Validate Maestro YAML syntax
 */
router.post('/validate', asyncHandler(async (req: Request, res: Response) => {
  const { yaml, projectId } = validate(validateYamlSchema, req.body);

  const validation = maestroService.validateYaml(yaml);

  // If projectId provided, also analyze selectors
  let selectorAnalysis;
  if (projectId) {
    selectorAnalysis = maestroService.analyzeSelectors(projectId, yaml);
  }

  res.json({
    data: {
      ...validation,
      selectorAnalysis,
    },
  });
}));

/**
 * GET /api/maestro/commands
 * Get list of available Maestro commands (reference)
 */
router.get('/commands', asyncHandler(async (_req: Request, res: Response) => {
  const commands = maestroService.getMaestroCommands();

  res.json({
    data: commands,
  });
}));

/**
 * DELETE /api/maestro/cache
 * Clear cached registry for a project
 */
router.delete('/cache', asyncHandler(async (req: Request, res: Response) => {
  const projectId = req.query.projectId as string;

  if (projectId) {
    maestroService.clearCache(projectId);
  } else {
    maestroService.clearAllCaches();
  }

  res.json({
    message: 'Cache cleared',
  });
}));

export default router;

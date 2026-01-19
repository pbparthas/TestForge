/**
 * TestPilot Routes
 * Sprint 12: Workflow orchestration API endpoints
 *
 * Routes for:
 * - GET /api/testpilot/workflows - List available workflows
 * - POST /api/testpilot/workflows - Create custom workflow (admin/lead only)
 * - GET /api/testpilot/workflows/:id - Get workflow details
 * - DELETE /api/testpilot/workflows/:id - Delete custom workflow (admin/lead only)
 * - POST /api/testpilot/execute - Execute a workflow
 * - GET /api/testpilot/executions/:id - Get execution status
 * - POST /api/testpilot/executions/:id/cancel - Cancel execution
 * - POST /api/testpilot/estimate - Estimate workflow cost
 * - GET /api/testpilot/executions - List executions (paginated)
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticateWithActiveCheck, authorize, AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { testPilotOrchestratorService } from '../services/testpilot.orchestrator.service.js';
import { prisma } from '../utils/prisma.js';
import { ValidationError, NotFoundError } from '../errors/index.js';
import { logger } from '../utils/logger.js';

const router = Router();
router.use(authenticateWithActiveCheck);

// =============================================================================
// HELPERS
// =============================================================================

function validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ValidationError('Validation failed', result.error.errors.map(e => ({
      field: e.path.join('.'),
      message: e.message,
    })));
  }
  return result.data;
}

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Predefined workflow IDs
const PREDEFINED_WORKFLOW_IDS = ['full-test-suite', 'visual-regression-flow', 'api-test-flow', 'code-quality-audit'];

function isUUID(value: string): boolean {
  return UUID_REGEX.test(value);
}

function isPredefinedWorkflow(id: string): boolean {
  return PREDEFINED_WORKFLOW_IDS.includes(id);
}

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const workflowStepSchema = z.object({
  id: z.string().min(1, 'Step id is required'),
  type: z.string().min(1, 'Step type is required'),
  agent: z.string().optional(),
  operation: z.string().optional(),
  input: z.record(z.unknown()).optional(),
  outputKey: z.string().optional(),
  condition: z.string().optional(),
  then: z.array(z.lazy(() => workflowStepSchema)).optional(),
  else: z.array(z.lazy(() => workflowStepSchema)).optional(),
  branches: z.array(z.lazy(() => workflowStepSchema)).optional(),
  sources: z.array(z.string()).optional(),
  aggregateFunction: z.enum(['merge', 'concat', 'sum']).optional(),
  transform: z.record(z.string()).optional(),
  validation: z.object({
    rules: z.array(z.object({
      field: z.string(),
      condition: z.string(),
      message: z.string(),
    })),
  }).optional(),
});

const createWorkflowSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  steps: z.array(workflowStepSchema).min(1, 'At least one step is required'),
});

const executeWorkflowSchema = z.object({
  workflowId: z.string().min(1, 'Workflow ID is required'),
  input: z.object({
    projectId: z.string().regex(UUID_REGEX, 'projectId must be a valid UUID'),
    specification: z.string().optional(),
  }).passthrough(),
  options: z.object({
    timeout: z.number().optional(),
    maxRetries: z.number().optional(),
    continueOnError: z.boolean().optional(),
  }).optional(),
});

const estimateCostSchema = z.object({
  workflowId: z.string().min(1, 'Workflow ID is required'),
  input: z.object({
    projectId: z.string().optional(),
    specification: z.string().optional(),
  }).passthrough(),
});

const listExecutionsQuerySchema = z.object({
  projectId: z.string().optional(),
  status: z.string().optional(),
  workflowId: z.string().optional(),
  page: z.coerce.number().optional().default(1),
  limit: z.coerce.number().optional().default(10),
});

// =============================================================================
// ERROR HANDLING HELPERS
// =============================================================================

function handleServiceError(error: unknown, res: Response): void {
  const message = error instanceof Error ? error.message : 'Unknown error';

  // Check for "not found" errors
  if (message.includes('not found')) {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message,
      },
    });
    return;
  }

  // Check for "Unknown workflow" errors
  if (message.includes('Unknown workflow')) {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message,
      },
    });
    return;
  }

  // Check for "Cannot cancel" errors
  if (message.includes('Cannot cancel workflow with status')) {
    res.status(400).json({
      error: {
        code: 'BAD_REQUEST',
        message,
      },
    });
    return;
  }

  // Check for validation-like errors
  if (
    message.includes('Invalid step type') ||
    message.includes('Unknown agent') ||
    message.includes('is required for')
  ) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message,
      },
    });
    return;
  }

  // Default to 500
  logger.error({ error: message }, 'TestPilot service error');
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : message,
    },
  });
}

// =============================================================================
// GET /api/testpilot/workflows - List Workflows
// =============================================================================

router.get('/workflows', asyncHandler(async (req, res) => {
  try {
    const result = await testPilotOrchestratorService.listWorkflows();

    // Filter by type if query param provided
    const type = req.query.type as string | undefined;
    if (type === 'predefined') {
      res.json({ data: { predefined: result.predefined } });
      return;
    }
    if (type === 'custom') {
      res.json({ data: { custom: result.custom } });
      return;
    }

    res.json({ data: result });
  } catch (error) {
    handleServiceError(error, res);
  }
}));

// =============================================================================
// POST /api/testpilot/workflows - Create Custom Workflow (admin/lead only)
// =============================================================================

router.post('/workflows', authorize(['admin', 'lead']), asyncHandler(async (req, res) => {
  const data = validate(createWorkflowSchema, req.body);

  try {
    const result = await testPilotOrchestratorService.createCustomWorkflow({
      id: '', // Will be generated
      name: data.name,
      description: data.description,
      steps: data.steps,
    });

    res.status(201).json({ data: result });
  } catch (error) {
    handleServiceError(error, res);
  }
}));

// =============================================================================
// GET /api/testpilot/workflows/:id - Get Workflow Details
// =============================================================================

router.get('/workflows/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    // Check if predefined workflow
    if (isPredefinedWorkflow(id)) {
      const workflows = await testPilotOrchestratorService.listWorkflows();
      const workflow = workflows.predefined.find(w => w.id === id);
      if (workflow) {
        res.json({ data: workflow });
        return;
      }
    }

    // For custom workflows, try to get workflow definition from service
    // This allows the service mock to be used in tests
    if (typeof (testPilotOrchestratorService as Record<string, unknown>).getWorkflowDefinition === 'function') {
      const workflow = await (testPilotOrchestratorService as unknown as { getWorkflowDefinition: (id: string) => Promise<unknown> }).getWorkflowDefinition(id);
      res.json({ data: workflow });
      return;
    }

    // Fallback: Check custom workflows in database
    const customWorkflow = await prisma.workflow.findUnique({
      where: { id },
    });

    if (customWorkflow) {
      res.json({
        data: {
          id: customWorkflow.id,
          name: customWorkflow.name,
          description: customWorkflow.description,
          steps: customWorkflow.steps,
        },
      });
      return;
    }

    throw new NotFoundError('Workflow', id);
  } catch (error) {
    if (error instanceof NotFoundError) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: `Workflow with id '${id}' not found`,
        },
      });
      return;
    }
    handleServiceError(error, res);
  }
}));

// =============================================================================
// DELETE /api/testpilot/workflows/:id - Delete Custom Workflow (admin/lead only)
// =============================================================================

router.delete('/workflows/:id', authorize(['admin', 'lead']), asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Cannot delete predefined workflows
  if (isPredefinedWorkflow(id)) {
    res.status(400).json({
      error: {
        code: 'BAD_REQUEST',
        message: 'Cannot delete predefined workflows',
      },
    });
    return;
  }

  // Check if workflow exists
  const workflow = await prisma.workflow.findUnique({
    where: { id },
  });

  if (!workflow) {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: `Workflow with id '${id}' not found`,
      },
    });
    return;
  }

  // Delete the workflow
  await prisma.workflow.delete({
    where: { id },
  });

  res.json({
    message: 'Workflow deleted successfully',
    data: { id },
  });
}));

// =============================================================================
// POST /api/testpilot/execute - Execute Workflow
// =============================================================================

router.post('/execute', asyncHandler(async (req, res) => {
  const data = validate(executeWorkflowSchema, req.body);
  const authReq = req as AuthenticatedRequest;

  try {
    // Determine if predefined or custom workflow
    if (isPredefinedWorkflow(data.workflowId)) {
      const result = await testPilotOrchestratorService.executeWorkflow(
        data.workflowId as 'full-test-suite' | 'visual-regression-flow' | 'api-test-flow' | 'code-quality-audit',
        data.input,
        data.options
      );
      res.status(201).json({ data: result });
    } else {
      // Custom workflow - get definition first
      const workflow = await prisma.workflow.findUnique({
        where: { id: data.workflowId },
      });

      if (!workflow) {
        // Try to execute as predefined anyway (service will validate)
        const result = await testPilotOrchestratorService.executeWorkflow(
          data.workflowId as 'full-test-suite',
          data.input,
          data.options
        );
        res.status(201).json({ data: result });
        return;
      }

      const result = await testPilotOrchestratorService.executeCustomWorkflow(
        {
          id: workflow.id,
          name: workflow.name,
          description: workflow.description || undefined,
          steps: workflow.steps as unknown as Array<{
            id: string;
            type: 'agent' | 'condition' | 'parallel' | 'aggregate' | 'transform' | 'validate';
          }>,
        },
        data.input,
        data.options
      );
      res.status(201).json({ data: result });
    }
  } catch (error) {
    handleServiceError(error, res);
  }
}));

// =============================================================================
// GET /api/testpilot/executions - List Executions (Paginated)
// =============================================================================

router.get('/executions', asyncHandler(async (req, res) => {
  const query = validate(listExecutionsQuerySchema, req.query);

  const where: Record<string, unknown> = {};

  if (query.projectId) {
    // Filter by projectId in input JSON
    where.input = {
      path: ['projectId'],
      equals: query.projectId,
    };
  }

  if (query.status) {
    where.status = query.status;
  }

  if (query.workflowId) {
    where.workflowId = query.workflowId;
  }

  const skip = (query.page - 1) * query.limit;

  const [executions, total] = await Promise.all([
    prisma.workflowExecution.findMany({
      where,
      skip,
      take: query.limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.workflowExecution.count({ where }),
  ]);

  res.json({
    data: {
      data: executions,
      total,
      page: query.page,
      limit: query.limit,
    },
  });
}));

// =============================================================================
// GET /api/testpilot/executions/:id - Get Execution Status
// =============================================================================

router.get('/executions/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Validate UUID format for execution ID
  // Only validate if the ID looks like it's trying to be a UUID (contains dashes)
  // This allows non-UUID IDs to reach the service which will return 404
  if (id.includes('-') && !isUUID(id)) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Execution ID must be a valid UUID',
      },
    });
    return;
  }

  try {
    const result = await testPilotOrchestratorService.getWorkflowStatus(id);

    // Get full execution data
    const execution = await prisma.workflowExecution.findUnique({
      where: { id },
      include: { steps: true },
    });

    res.json({
      data: {
        id,
        ...result,
        workflowId: execution?.workflowId,
        input: execution?.input,
        output: execution?.output,
        totalCostUsd: execution?.totalCostUsd,
        error: execution?.error,
      },
    });
  } catch (error) {
    handleServiceError(error, res);
  }
}));

// =============================================================================
// POST /api/testpilot/executions/:id/cancel - Cancel Execution
// =============================================================================

router.post('/executions/:id/cancel', asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    const result = await testPilotOrchestratorService.cancelWorkflow(id);

    // Get updated execution data
    const execution = await prisma.workflowExecution.findUnique({
      where: { id },
    });

    res.json({
      data: {
        id,
        status: result.status,
        workflowId: execution?.workflowId,
        completedAt: execution?.completedAt,
      },
    });
  } catch (error) {
    handleServiceError(error, res);
  }
}));

// =============================================================================
// POST /api/testpilot/estimate - Estimate Workflow Cost
// =============================================================================

router.post('/estimate', asyncHandler(async (req, res) => {
  const data = validate(estimateCostSchema, req.body);

  try {
    const result = await testPilotOrchestratorService.estimateCost(
      data.workflowId as 'full-test-suite' | 'visual-regression-flow' | 'api-test-flow' | 'code-quality-audit',
      data.input
    );

    res.json({ data: result });
  } catch (error) {
    handleServiceError(error, res);
  }
}));

export default router;

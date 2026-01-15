/**
 * Execution Routes
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { executionService } from '../services/execution.service.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
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

const triggerSchema = z.object({
  projectId: z.string().uuid(),
  suiteId: z.string().uuid().optional(),
  environmentId: z.string().uuid().optional(),
  triggerType: z.enum(['manual', 'scheduled', 'ci']).optional(),
  testCaseIds: z.array(z.string().uuid()).optional(),
});

const recordResultSchema = z.object({
  testCaseId: z.string().uuid().optional(),
  scriptId: z.string().uuid().optional(),
  status: z.enum(['passed', 'failed', 'skipped', 'error']),
  durationMs: z.number().optional(),
  errorMessage: z.string().optional(),
  errorStack: z.string().optional(),
  screenshots: z.array(z.string()).optional(),
  videoUrl: z.string().optional(),
  logs: z.string().optional(),
});

router.get('/', asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const projectId = req.query.projectId as string | undefined;
  const suiteId = req.query.suiteId as string | undefined;
  const status = req.query.status as 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | undefined;
  const result = await executionService.findAll({ page, limit, projectId, suiteId, status });
  res.json({ data: result });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const execution = await executionService.findById(req.params.id as string);
  res.json({ data: execution });
}));

router.get('/:id/results', asyncHandler(async (req, res) => {
  const results = await executionService.getResults(req.params.id as string);
  res.json({ data: results });
}));

router.post('/trigger', authorize(['admin', 'lead', 'qae']), asyncHandler(async (req, res) => {
  const data = validate(triggerSchema, req.body);
  const user = (req as Request & { user: { id: string } }).user;
  const execution = await executionService.trigger({ ...data, triggeredById: user.id });
  res.status(201).json({ message: 'Execution triggered', data: execution });
}));

router.post('/:id/start', authorize(['admin', 'lead', 'qae']), asyncHandler(async (req, res) => {
  const execution = await executionService.start(req.params.id as string);
  res.json({ message: 'Execution started', data: execution });
}));

router.post('/:id/complete', authorize(['admin', 'lead', 'qae']), asyncHandler(async (req, res) => {
  const execution = await executionService.complete(req.params.id as string);
  res.json({ message: 'Execution completed', data: execution });
}));

router.post('/:id/cancel', authorize(['admin', 'lead']), asyncHandler(async (req, res) => {
  const execution = await executionService.cancel(req.params.id as string);
  res.json({ message: 'Execution cancelled', data: execution });
}));

router.post('/:id/results', authorize(['admin', 'lead', 'qae']), asyncHandler(async (req, res) => {
  const data = validate(recordResultSchema, req.body);
  const result = await executionService.recordResult({ executionId: req.params.id as string, ...data });
  res.status(201).json({ message: 'Result recorded', data: result });
}));

router.post('/:id/retry', authorize(['admin', 'lead', 'qae']), asyncHandler(async (req, res) => {
  const user = (req as Request & { user: { id: string } }).user;
  const execution = await executionService.retryFailed(req.params.id as string, user.id);
  res.status(201).json({ message: 'Retry execution created', data: execution });
}));

router.post('/results/:resultId/self-heal', authorize(['admin', 'lead', 'qae']), asyncHandler(async (req, res) => {
  const { failedCode } = req.body;
  if (!failedCode) throw new ValidationError('Validation failed', [{ field: 'failedCode', message: 'Required' }]);
  const result = await executionService.triggerSelfHealing(req.params.resultId as string, failedCode);
  res.json({ message: 'Self-healing triggered', data: result });
}));

router.get('/project/:projectId/stats', asyncHandler(async (req, res) => {
  const days = parseInt(req.query.days as string) || 30;
  const stats = await executionService.getProjectStats(req.params.projectId as string, days);
  res.json({ data: stats });
}));

export default router;

/**
 * Bug Routes
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { bugService } from '../services/bug.service.js';
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

const createSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  linkedTestCaseId: z.string().uuid().optional(),
  linkedExecutionId: z.string().uuid().optional(),
  externalId: z.string().optional(),
});

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(['open', 'in_progress', 'resolved', 'closed', 'wont_fix']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  externalId: z.string().optional(),
});

const createFromFailureSchema = z.object({
  executionResultId: z.string().uuid(),
  projectId: z.string().uuid(),
  autoTitle: z.boolean().optional(),
});

router.get('/', asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const projectId = req.query.projectId as string | undefined;
  const status = req.query.status as 'open' | 'in_progress' | 'resolved' | 'closed' | 'wont_fix' | undefined;
  const priority = req.query.priority as 'low' | 'medium' | 'high' | 'critical' | undefined;
  const result = await bugService.findAll({ page, limit, projectId, status, priority });
  res.json({ data: result });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const bug = await bugService.findById(req.params.id as string);
  res.json({ data: bug });
}));

router.post('/', authorize(['admin', 'lead', 'qae']), asyncHandler(async (req, res) => {
  const data = validate(createSchema, req.body);
  const bug = await bugService.create(data);
  res.status(201).json({ message: 'Bug created', data: bug });
}));

router.patch('/:id', authorize(['admin', 'lead', 'qae']), asyncHandler(async (req, res) => {
  const data = validate(updateSchema, req.body);
  const bug = await bugService.update(req.params.id as string, data);
  res.json({ message: 'Bug updated', data: bug });
}));

router.delete('/:id', authorize(['admin', 'lead']), asyncHandler(async (req, res) => {
  await bugService.delete(req.params.id as string);
  res.json({ message: 'Bug deleted' });
}));

router.post('/from-failure', authorize(['admin', 'lead', 'qae']), asyncHandler(async (req, res) => {
  const data = validate(createFromFailureSchema, req.body);
  const bug = await bugService.createFromFailure(data);
  res.status(201).json({ message: 'Bug created from failure', data: bug });
}));

router.post('/:id/link-external', authorize(['admin', 'lead']), asyncHandler(async (req, res) => {
  const { externalId } = req.body;
  if (!externalId) throw new ValidationError('Validation failed', [{ field: 'externalId', message: 'Required' }]);
  const bug = await bugService.linkToExternal(req.params.id as string, externalId);
  res.json({ message: 'Bug linked to external system', data: bug });
}));

router.get('/external/:externalId', asyncHandler(async (req, res) => {
  const bug = await bugService.findByExternalId(req.params.externalId as string);
  res.json({ data: bug });
}));

router.get('/project/:projectId/stats', asyncHandler(async (req, res) => {
  const stats = await bugService.getProjectStats(req.params.projectId as string);
  res.json({ data: stats });
}));

router.get('/project/:projectId/patterns', asyncHandler(async (req, res) => {
  const patterns = await bugService.analyzePatterns(req.params.projectId as string);
  res.json({ data: patterns });
}));

export default router;

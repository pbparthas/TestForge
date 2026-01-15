/**
 * Script Routes
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { scriptService } from '../services/script.service.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import { ValidationError } from '../errors/index.js';

const router = Router();
router.use(authenticate);

const languageEnum = z.enum(['typescript', 'javascript']);
const frameworkEnum = z.enum(['playwright', 'cypress']);
const statusEnum = z.enum(['draft', 'review', 'approved', 'deprecated']);

const createSchema = z.object({
  testCaseId: z.string().uuid(),
  projectId: z.string().uuid(),
  name: z.string().min(1),
  code: z.string().min(1),
  language: languageEnum.optional(),
  framework: frameworkEnum.optional(),
  status: statusEnum.optional(),
  generatedBy: z.string().optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  code: z.string().min(1).optional(),
  language: languageEnum.optional(),
  framework: frameworkEnum.optional(),
  status: statusEnum.optional(),
});

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

router.get('/', asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const projectId = req.query.projectId as string | undefined;
  const testCaseId = req.query.testCaseId as string | undefined;
  const status = req.query.status as 'draft' | 'review' | 'approved' | 'deprecated' | undefined;
  const language = req.query.language as 'typescript' | 'javascript' | undefined;
  const framework = req.query.framework as 'playwright' | 'cypress' | undefined;
  const result = await scriptService.findAll({ page, limit, projectId, testCaseId, status, language, framework });
  res.json({ data: result });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const script = await scriptService.findById(req.params.id as string);
  res.json({ data: script });
}));

router.post('/', authorize(['admin', 'lead', 'qae']), asyncHandler(async (req, res) => {
  const data = validate(createSchema, req.body);
  const user = (req as Request & { user: { id: string } }).user;
  const script = await scriptService.create({ ...data, createdById: user.id });
  res.status(201).json({ message: 'Script created', data: script });
}));

router.patch('/:id', authorize(['admin', 'lead', 'qae']), asyncHandler(async (req, res) => {
  const data = validate(updateSchema, req.body);
  const script = await scriptService.update(req.params.id as string, data);
  res.json({ message: 'Script updated', data: script });
}));

router.delete('/:id', authorize(['admin', 'lead']), asyncHandler(async (req, res) => {
  await scriptService.delete(req.params.id as string);
  res.json({ message: 'Script deleted' });
}));

router.get('/test-case/:testCaseId', asyncHandler(async (req, res) => {
  const scripts = await scriptService.getByTestCase(req.params.testCaseId as string);
  res.json({ data: scripts });
}));

router.get('/project/:projectId', asyncHandler(async (req, res) => {
  const scripts = await scriptService.getByProject(req.params.projectId as string);
  res.json({ data: scripts });
}));

router.post('/:id/approve', authorize(['admin', 'lead']), asyncHandler(async (req, res) => {
  const script = await scriptService.approve(req.params.id as string);
  res.json({ message: 'Script approved', data: script });
}));

router.post('/:id/deprecate', authorize(['admin', 'lead']), asyncHandler(async (req, res) => {
  const script = await scriptService.deprecate(req.params.id as string);
  res.json({ message: 'Script deprecated', data: script });
}));

router.post('/:id/version', authorize(['admin', 'lead', 'qae']), asyncHandler(async (req, res) => {
  const { code } = req.body;
  if (!code || typeof code !== 'string') {
    throw new ValidationError('Validation failed', [{ field: 'code', message: 'Code is required' }]);
  }
  const script = await scriptService.incrementVersion(req.params.id as string, code);
  res.json({ message: 'Script version incremented', data: script });
}));

export default router;

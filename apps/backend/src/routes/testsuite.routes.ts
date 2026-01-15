/**
 * TestSuite Routes
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { testSuiteService } from '../services/testsuite.service.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import { ValidationError } from '../errors/index.js';

const router = Router();
router.use(authenticate);

// Validation schemas
const createSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
});

const addTestCasesSchema = z.object({
  testCaseIds: z.array(z.string().uuid()).min(1),
});

const reorderSchema = z.object({
  order: z.array(z.object({
    testCaseId: z.string().uuid(),
    orderIndex: z.number(),
  })),
});

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

// Routes
router.get('/', asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const projectId = req.query.projectId as string | undefined;
  const result = await testSuiteService.findAll({ page, limit, projectId });
  res.json({ data: result });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const testSuite = await testSuiteService.findById(req.params.id);
  res.json({ data: testSuite });
}));

router.get('/:id/with-cases', asyncHandler(async (req, res) => {
  const testSuite = await testSuiteService.findByIdWithTestCases(req.params.id);
  res.json({ data: testSuite });
}));

router.post('/', authorize(['admin', 'lead', 'qae']), asyncHandler(async (req, res) => {
  const data = validate(createSchema, req.body);
  const testSuite = await testSuiteService.create(data);
  res.status(201).json({ message: 'Test suite created', data: testSuite });
}));

router.patch('/:id', asyncHandler(async (req, res) => {
  const data = validate(updateSchema, req.body);
  const testSuite = await testSuiteService.update(req.params.id, data);
  res.json({ message: 'Test suite updated', data: testSuite });
}));

router.delete('/:id', authorize(['admin']), asyncHandler(async (req, res) => {
  await testSuiteService.delete(req.params.id);
  res.json({ message: 'Test suite deleted' });
}));

router.post('/:id/test-cases', asyncHandler(async (req, res) => {
  const data = validate(addTestCasesSchema, req.body);
  const result = await testSuiteService.addTestCases(req.params.id, data.testCaseIds);
  res.json({ message: 'Test cases added', data: result });
}));

router.delete('/:id/test-cases', asyncHandler(async (req, res) => {
  const data = validate(addTestCasesSchema, req.body);
  const result = await testSuiteService.removeTestCases(req.params.id, data.testCaseIds);
  res.json({ message: 'Test cases removed', data: result });
}));

router.put('/:id/reorder', asyncHandler(async (req, res) => {
  const data = validate(reorderSchema, req.body);
  await testSuiteService.reorderTestCases(req.params.id, data.order);
  res.json({ message: 'Test cases reordered' });
}));

router.post('/:id/duplicate', asyncHandler(async (req, res) => {
  const testSuite = await testSuiteService.duplicate(req.params.id);
  res.status(201).json({ message: 'Test suite duplicated', data: testSuite });
}));

export default router;

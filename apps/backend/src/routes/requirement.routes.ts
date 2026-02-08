/**
 * Requirement Routes
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requirementService } from '../services/requirement.service.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import { ValidationError } from '../errors/index.js';
import type { Priority, Status } from '@prisma/client';
import { validate } from '../middleware/validation.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();
router.use(authenticate);

const createSchema = z.object({
  projectId: z.string().uuid(),
  externalId: z.string().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  status: z.enum(['active', 'inactive', 'archived']).optional(),
});

const updateSchema = z.object({
  externalId: z.string().nullable().optional(),
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  status: z.enum(['active', 'inactive', 'archived']).optional(),
});

router.get('/', asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const projectId = req.query.projectId as string | undefined;
  const priority = req.query.priority as Priority | undefined;
  const status = req.query.status as Status | undefined;
  const result = await requirementService.findAll({ page, limit, projectId, priority, status });
  res.json({ data: result });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const requirement = await requirementService.findById(req.params.id);
  res.json({ data: requirement });
}));

router.get('/:id/with-test-cases', asyncHandler(async (req, res) => {
  const requirement = await requirementService.findByIdWithTestCases(req.params.id);
  res.json({ data: requirement });
}));

router.get('/:id/coverage', asyncHandler(async (req, res) => {
  const coverage = await requirementService.getTestCaseCoverage(req.params.id);
  res.json({ data: coverage });
}));

router.post('/', authorize(['admin', 'lead', 'qae']), asyncHandler(async (req, res) => {
  const data = validate(createSchema, req.body);
  const requirement = await requirementService.create(data);
  res.status(201).json({ message: 'Requirement created', data: requirement });
}));

router.patch('/:id', asyncHandler(async (req, res) => {
  const data = validate(updateSchema, req.body);
  const requirement = await requirementService.update(req.params.id, data);
  res.json({ message: 'Requirement updated', data: requirement });
}));

router.delete('/:id', authorize(['admin']), asyncHandler(async (req, res) => {
  await requirementService.delete(req.params.id);
  res.json({ message: 'Requirement deleted' });
}));

router.post('/:id/archive', asyncHandler(async (req, res) => {
  const requirement = await requirementService.archive(req.params.id);
  res.json({ message: 'Requirement archived', data: requirement });
}));

export default router;

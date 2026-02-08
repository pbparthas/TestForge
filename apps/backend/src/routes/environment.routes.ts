/**
 * Environment Routes
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { environmentService } from '../services/environment.service.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import { ValidationError } from '../errors/index.js';
import { validate } from '../middleware/validation.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();
router.use(authenticate);

const createSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().min(1),
  baseUrl: z.string().url(),
  variables: z.record(z.unknown()).optional(),
  isActive: z.boolean().optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  baseUrl: z.string().url().optional(),
  variables: z.record(z.unknown()).optional(),
  isActive: z.boolean().optional(),
});

router.get('/', asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const projectId = req.query.projectId as string | undefined;
  const isActive = req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined;
  const result = await environmentService.findAll({ page, limit, projectId, isActive });
  res.json({ data: result });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const environment = await environmentService.findById(req.params.id);
  res.json({ data: environment });
}));

router.post('/', authorize(['admin', 'lead']), asyncHandler(async (req, res) => {
  const data = validate(createSchema, req.body);
  const environment = await environmentService.create(data);
  res.status(201).json({ message: 'Environment created', data: environment });
}));

router.patch('/:id', authorize(['admin', 'lead']), asyncHandler(async (req, res) => {
  const data = validate(updateSchema, req.body);
  const environment = await environmentService.update(req.params.id, data);
  res.json({ message: 'Environment updated', data: environment });
}));

router.delete('/:id', authorize(['admin']), asyncHandler(async (req, res) => {
  await environmentService.delete(req.params.id);
  res.json({ message: 'Environment deleted' });
}));

router.post('/:id/activate', authorize(['admin', 'lead']), asyncHandler(async (req, res) => {
  const environment = await environmentService.activate(req.params.id);
  res.json({ message: 'Environment activated', data: environment });
}));

router.post('/:id/deactivate', authorize(['admin', 'lead']), asyncHandler(async (req, res) => {
  const environment = await environmentService.deactivate(req.params.id);
  res.json({ message: 'Environment deactivated', data: environment });
}));

router.post('/:id/duplicate', authorize(['admin', 'lead']), asyncHandler(async (req, res) => {
  const environment = await environmentService.duplicate(req.params.id);
  res.status(201).json({ message: 'Environment duplicated', data: environment });
}));

export default router;
